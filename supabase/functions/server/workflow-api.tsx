import { Hono } from "npm:hono@4";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { sendPushToUser } from "./push-utils.tsx";
import { auditCreate, auditUpdate } from "./audit-helpers.ts";

const workflowApi = new Hono();

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function currentAppUser(
  supabase: ReturnType<typeof getSupabase>,
  c: any,
): Promise<Record<string, any> | null> {
  const authUserId = c.get("userId") as string | undefined;
  if (!authUserId) return null;
  const { data } = await supabase
    .from("app_users")
    .select("id, role, primary_role, roles")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return data ?? null;
}

function isTableMissing(err: unknown): boolean {
  const e = err as Record<string, unknown>;
  return e?.code === "42P01" || e?.code === "PGRST116" || e?.code === "PGRST200" || String(e?.message)?.includes('schema cache');
}

const SUPPORTED_NODE_TYPES = new Set([
  "trigger",
  "notification",
  "approval",
  "condition",
  "end",
]);

function triggerEventKey(config: Record<string, unknown> | null | undefined): string | undefined {
  return String(config?.event_key ?? config?.event ?? "") || undefined;
}

function definitionRecord(body: Record<string, unknown>) {
  const trigger = (body.trigger as Record<string, unknown> | undefined) ?? {};
  const triggerConfig = (
    body.trigger_config ??
    trigger.config ??
    {}
  ) as Record<string, unknown>;
  const eventKey = triggerEventKey(triggerConfig);

  return {
    name: body.name,
    description: body.description ?? null,
    status: body.status ?? "draft",
    trigger_type: body.trigger_type ?? trigger.type ?? "manual",
    trigger_config: eventKey
      ? { ...triggerConfig, event_key: eventKey }
      : triggerConfig,
    nodes: Array.isArray(body.nodes) ? body.nodes : [],
    created_by: body.created_by ?? body.createdBy ?? null,
    is_template: body.is_template ?? false,
    category: body.category ?? null,
    tags: body.tags ?? [],
  };
}

function normalizeDefinition(row: Record<string, unknown>) {
  const { trigger_type, trigger_config, created_by, created_at, updated_at, ...rest } = row;
  return {
    ...rest,
    trigger: {
      type: trigger_type ?? "manual",
      config: trigger_config ?? {},
    },
    createdBy: created_by ?? "",
    createdAt: created_at ?? "",
    updatedAt: updated_at ?? "",
    nodes: Array.isArray(rest.nodes) ? rest.nodes : [],
  };
}

function normalizeInstance(row: Record<string, unknown>) {
  const {
    definition_id,
    current_node_id,
    context,
    started_at,
    completed_at,
    ...rest
  } = row;
  return {
    ...rest,
    workflowId: definition_id ?? "",
    currentNodeId: current_node_id ?? null,
    data: context ?? {},
    startedAt: started_at ?? "",
    completedAt: completed_at ?? null,
  };
}

function validateDefinition(definition: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const nodes = Array.isArray(definition.nodes)
    ? definition.nodes as Array<Record<string, unknown>>
    : [];
  const triggerType = String(definition.trigger_type ?? "manual");
  const config = (definition.trigger_config ?? {}) as Record<string, unknown>;

  if (!String(definition.name ?? "").trim()) errors.push("Workflow name is required");
  if (nodes.length === 0) errors.push("At least one node is required");
  if (!nodes.some((node) => node.type === "trigger")) errors.push("A trigger node is required");
  if (!nodes.some((node) => node.type === "end")) errors.push("An end node is required");
  if (!["manual", "event"].includes(triggerType)) {
    errors.push(`Trigger type "${triggerType}" is not executable yet`);
  }
  if (triggerType === "event" && !triggerEventKey(config)) {
    errors.push("Event workflows require an event key");
  }

  const ids = new Set(nodes.map((node) => String(node.id)));
  for (const node of nodes) {
    if (!SUPPORTED_NODE_TYPES.has(String(node.type))) {
      errors.push(`Node "${node.label ?? node.id}" uses unsupported type "${node.type}"`);
    }
    for (const connection of (node.connections as string[] | undefined) ?? []) {
      if (!ids.has(String(connection))) {
        errors.push(`Node "${node.label ?? node.id}" connects to a missing node`);
      }
    }
    if (node.type === "approval") {
      const nodeConfig = (node.config ?? {}) as Record<string, unknown>;
      if (!nodeConfig.approver_id && !nodeConfig.approver_role) {
        errors.push(`Approval "${node.label ?? node.id}" needs an approver`);
      }
    }
  }
  return [...new Set(errors)];
}

function contextValue(context: Record<string, unknown>, path: string): unknown {
  const normalized = path.replace(/^trigger\./, "");
  return normalized.split(".").reduce<unknown>((value, key) => (
    value && typeof value === "object"
      ? (value as Record<string, unknown>)[key]
      : undefined
  ), context);
}

function evaluateRule(rule: Record<string, unknown>, context: Record<string, unknown>): boolean {
  if (Array.isArray(rule.conditions)) {
    const results = rule.conditions.map((condition) =>
      evaluateRule(condition as Record<string, unknown>, context)
    );
    return rule.operator === "OR" ? results.some(Boolean) : results.every(Boolean);
  }

  const actual = contextValue(context, String(rule.field ?? ""));
  const expected = rule.value;
  switch (rule.operator) {
    case "equals": return actual == expected;
    case "not_equals": return actual != expected;
    case "greater_than": return Number(actual) > Number(expected);
    case "greater_than_or_equal": return Number(actual) >= Number(expected);
    case "less_than": return Number(actual) < Number(expected);
    case "less_than_or_equal": return Number(actual) <= Number(expected);
    case "contains": return String(actual ?? "").includes(String(expected ?? ""));
    case "in": return Array.isArray(expected) && expected.includes(actual);
    case "not_in": return Array.isArray(expected) && !expected.includes(actual);
    case "is_empty": return actual == null || actual === "";
    case "is_not_empty": return actual != null && actual !== "";
    default: return false;
  }
}

// ─── Execution Engine ─────────────────────────────────────────────────────────

async function executeWorkflowStep(
  supabase: ReturnType<typeof getSupabase>,
  instance: Record<string, unknown>,
  definition: Record<string, unknown>,
  nodeId: string
): Promise<void> {
  const nodes = definition.nodes as Array<Record<string, unknown>>;
  const node = nodes?.find((n) => n.id === nodeId);
  if (!node) return;

  const history = (instance.history as Array<Record<string, unknown>>) || [];
  const historyEntry: Record<string, unknown> = {
    nodeId: node.id,
    nodeName: node.label,
    type: node.type,
    timestamp: new Date().toISOString(),
    status: "pending",
  };
  history.push(historyEntry);
  const stepId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const { error: stepInsertError } = await supabase.from("workflow_instance_steps").insert({
    id: stepId,
    instance_id: instance.id,
    step_id: node.id,
    step_type: node.type,
    step_name: node.label ?? node.type,
    status: "running",
    started_at: startedAt,
    input_data: instance.context ?? {},
  });
  if (stepInsertError && !isTableMissing(stepInsertError)) throw stepInsertError;
  await supabase.from("workflow_instances").update({
    current_node_id: node.id,
    history,
  }).eq("id", instance.id);

  try {
    const connections = node.connections as string[] | undefined;
    const config = (node.config as Record<string, unknown>) || {};

    switch (node.type) {
      case "trigger": {
        historyEntry.status = "success";
        historyEntry.action = "Workflow Started";
        if (connections?.[0]) {
          await executeWorkflowStep(supabase, instance, definition, connections[0]);
        }
        break;
      }

      case "notification": {
        const { recipients_role, message, title, link, assignee_id } = config as Record<string, string>;
        if (recipients_role) {
          const { data: users } = await supabase
            .from("app_users")
            .select("id")
            .eq("role", recipients_role)
            .eq("status", "active");
          for (const user of users ?? []) {
            await supabase.from("notifications").insert({
              id: crypto.randomUUID(),
              user_id: user.id,
              title: title || "Workflow Notification",
              message: message || "You have a workflow notification",
              type: "workflow",
              link: link || "/workflow-dashboard",
              created_at: new Date().toISOString(),
              read: false,
            }).catch(() => {});
            sendPushToUser(user.id, {
              title: title || "Workflow",
              body: message || "You have a workflow notification",
              type: "workflow",
              link: link || "/workflow-dashboard",
            }).catch(() => {});
          }
        }
        if (assignee_id) {
          await supabase.from("notifications").insert({
            id: crypto.randomUUID(),
            user_id: assignee_id,
            title: title || "Workflow Notification",
            message,
            type: "workflow",
            link: link || "/workflow-dashboard",
            created_at: new Date().toISOString(),
            read: false,
          }).catch(() => {});
        }
        historyEntry.status = "success";
        historyEntry.action = `Notification sent: ${title}`;
        if (connections?.[0]) await executeWorkflowStep(supabase, instance, definition, connections[0]);
        break;
      }

      case "approval": {
        const { approver_role, approver_id, step_name } = config as Record<string, string>;
        const approvalId = crypto.randomUUID();
        await supabase.from("workflow_approvals").insert({
          id: approvalId,
          instance_id: instance.id,
          definition_id: definition.id,
          workflow_name: definition.name,
          step_name: step_name || node.label,
          entity_type: instance.entity_type,
          entity_id: instance.entity_id,
          requested_by: instance.started_by,
          assignee_id: approver_id || null,
          assignee_role: approver_role || null,
          status: "pending",
          context: instance.context,
          requested_at: new Date().toISOString(),
          escalated: false,
        });

        await supabase.from("workflow_instances").update({
          status: "waiting_approval",
          current_node_id: node.id,
        }).eq("id", instance.id);

        const notifyTargets: string[] = [];
        if (approver_id) notifyTargets.push(approver_id);
        if (approver_role) {
          const { data: roleUsers } = await supabase
            .from("app_users")
            .select("id")
            .eq("role", approver_role)
            .eq("status", "active");
          notifyTargets.push(...(roleUsers ?? []).map((u: Record<string, string>) => u.id));
        }

        for (const userId of notifyTargets) {
          await supabase.from("notifications").insert({
            id: crypto.randomUUID(),
            user_id: userId,
            title: `Approval Required: ${definition.name}`,
            message: `Action needed: ${step_name || node.label} for ${instance.entity_type} requires your approval.`,
            type: "workflow_approval",
            link: "/workflow-dashboard",
            created_at: new Date().toISOString(),
            read: false,
          }).catch(() => {});
          sendPushToUser(userId, {
            title: "Approval Required",
            body: `${definition.name}: ${step_name || node.label} needs your approval`,
            type: "workflow_approval",
            link: "/workflow-dashboard",
          }).catch(() => {});
        }

        historyEntry.status = "pending";
        historyEntry.action = `Approval requested: ${step_name || node.label}`;
        await supabase.from("workflow_instances").update({ history }).eq("id", instance.id);
        await supabase.from("workflow_instance_steps").update({
          status: "pending",
          output_data: { approval_id: approvalId },
        }).eq("id", stepId);
        return; // Stop — waiting for approval response
      }

      case "condition": {
        const ctx = (instance.context ?? {}) as Record<string, unknown>;
        const condition = (config.condition ?? config) as Record<string, unknown>;
        const result = evaluateRule(condition, ctx);
        historyEntry.status = "success";
        historyEntry.action = `Condition evaluated → ${result}`;
        const nextNodeId = result
          ? config.true_path ?? connections?.[0]
          : config.false_path ?? connections?.[1];
        if (nextNodeId) {
          await executeWorkflowStep(supabase, instance, definition, String(nextNodeId));
        }
        break;
      }

      case "delay": {
        throw new Error("Delay nodes require the durable scheduler and cannot run yet");
      }

      case "end": {
        await supabase.from("workflow_instances").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          current_node_id: node.id,
        }).eq("id", instance.id);
        historyEntry.status = "success";
        historyEntry.action = "Workflow Completed";
        if (instance.started_by) {
          await supabase.from("notifications").insert({
            id: crypto.randomUUID(),
            user_id: instance.started_by,
            title: `Workflow Completed: ${definition.name}`,
            message: `The workflow "${definition.name}" has completed successfully.`,
            type: "workflow",
            link: "/workflow-dashboard",
            created_at: new Date().toISOString(),
            read: false,
          }).catch(() => {});
        }
        break;
      }

      default: {
        throw new Error(`Unsupported workflow node type: ${node.type}`);
      }
    }
  } catch (err: unknown) {
    historyEntry.status = "error";
    historyEntry.error = err instanceof Error ? err.message : String(err);
    await supabase.from("workflow_instance_steps").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: historyEntry.error,
    }).eq("id", stepId);
    await supabase.from("workflow_instances").update({
      status: "failed",
      completed_at: new Date().toISOString(),
    }).eq("id", instance.id);
  }

  await supabase.from("workflow_instances").update({ history }).eq("id", instance.id);
  if (historyEntry.status !== "error") {
    await supabase.from("workflow_instance_steps").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      output_data: { action: historyEntry.action },
    }).eq("id", stepId);
  }
}

// ─── Workflow Definitions CRUD ────────────────────────────────────────────────

workflowApi.get("/definitions", async (c) => {
  try {
    const supabase = getSupabase();
    const status = c.req.query("status");
    let query = supabase.from("workflow_definitions").select("*").order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: [] });
      throw error;
    }
    return c.json({
      success: true,
      data: (data ?? []).map((row) => normalizeDefinition(row)),
    });
  } catch (err) {
    if (isTableMissing(err)) return c.json({ success: true, data: [] });
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

workflowApi.post("/definitions", async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name) return c.json({ success: false, error: "name is required" }, 400);

    const supabase = getSupabase();
    const record = {
      id: crypto.randomUUID(),
      ...definitionRecord(body),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
    };
    if (record.status === "active") {
      const validationErrors = validateDefinition(record);
      if (validationErrors.length) {
        return c.json({ success: false, error: "Workflow cannot be activated", details: validationErrors }, 422);
      }
    }

    const { data, error } = await supabase.from("workflow_definitions").insert({ ...record, ...auditCreate(c) }).select().single();
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: record });
      throw error;
    }
    return c.json({ success: true, data: normalizeDefinition(data) }, 201);
  } catch (err) {
    if (isTableMissing(err)) return c.json({ success: false, error: "workflow_definitions table does not exist" }, 503);
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

workflowApi.get("/definitions/:id", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("workflow_definitions").select("*").eq("id", c.req.param("id")).single();
    if (error) {
      if (isTableMissing(error)) return c.json({ success: false, error: "Not found" }, 404);
      throw error;
    }
    if (!data) return c.json({ success: false, error: "Not found" }, 404);
    return c.json({ success: true, data: normalizeDefinition(data) });
  } catch (err) {
    if (isTableMissing(err)) return c.json({ success: false, error: "Not found" }, 404);
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

workflowApi.put("/definitions/:id", async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    // Fetch current version to bump it
    const { data: current } = await supabase.from("workflow_definitions").select("*").eq("id", c.req.param("id")).single();
    if (!current) return c.json({ success: false, error: "Not found" }, 404);
    const newVersion = ((current?.version as number) ?? 0) + 1;

    const incoming = definitionRecord({ ...current, ...body });
    const updates = {
      ...incoming,
      updated_at: new Date().toISOString(),
      version: newVersion,
    };
    if (updates.status === "active") {
      const validationErrors = validateDefinition(updates);
      if (validationErrors.length) {
        return c.json({ success: false, error: "Workflow cannot be activated", details: validationErrors }, 422);
      }
    }

    const { data, error } = await supabase.from("workflow_definitions").update({ ...updates, ...auditUpdate(c) }).eq("id", c.req.param("id")).select().single();
    if (error) {
      if (isTableMissing(error)) return c.json({ success: false, error: "Not found" }, 404);
      throw error;
    }
    return c.json({ success: true, data: normalizeDefinition(data) });
  } catch (err) {
    if (isTableMissing(err)) return c.json({ success: false, error: "Not found" }, 404);
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

workflowApi.delete("/definitions/:id", async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("workflow_definitions").update({ status: "archived", updated_at: new Date().toISOString(), ...auditUpdate(c) }).eq("id", c.req.param("id"));
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true });
      throw error;
    }
    return c.json({ success: true });
  } catch (err) {
    if (isTableMissing(err)) return c.json({ success: true });
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

// ─── Workflow Triggering & Instances ─────────────────────────────────────────

export async function dispatchWorkflowEvent(input: {
  event: string;
  entity_type?: string;
  entity_id?: string;
  context?: Record<string, unknown>;
  triggered_by?: string;
}) {
  const supabase = getSupabase();
  const { data: definitions, error } = await supabase
    .from("workflow_definitions")
    .select("*")
    .eq("status", "active")
    .eq("trigger_type", "event");
  if (error) throw error;

  const matches = (definitions ?? []).filter(
    (definition: Record<string, unknown>) =>
      triggerEventKey(definition.trigger_config as Record<string, unknown>) === input.event
  );
  const results: Record<string, unknown>[] = [];

  for (const definition of matches) {
    const validationErrors = validateDefinition(definition);
    if (validationErrors.length) {
      console.error(`Skipping invalid workflow "${definition.name}":`, validationErrors);
      continue;
    }

    const nodes = definition.nodes as Array<Record<string, unknown>>;
    const firstNode = nodes.find((node) => node.type === "trigger") ?? nodes[0];
    const instance = {
      id: crypto.randomUUID(),
      definition_id: definition.id,
      workflow_name: definition.name,
      status: "running",
      current_node_id: firstNode?.id ?? null,
      context: input.context ?? {},
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
      started_by: input.triggered_by ?? null,
      started_at: new Date().toISOString(),
      completed_at: null,
      history: [],
    };
    const { data: created, error: insertError } = await supabase
      .from("workflow_instances")
      .insert(instance)
      .select()
      .single();
    if (insertError) throw insertError;
    if (firstNode) {
      await executeWorkflowStep(supabase, created ?? instance, definition, String(firstNode.id));
    }
    const { data: updated } = await supabase
      .from("workflow_instances")
      .select("*")
      .eq("id", instance.id)
      .single();
    results.push(normalizeInstance((updated ?? created) as Record<string, unknown>));
  }
  return results;
}

workflowApi.post("/trigger", async (c) => {
  try {
    const body = await c.req.json();
    const { event, entity_type, entity_id, context, triggered_by } = body;
    if (!event) return c.json({ success: false, error: "event is required" }, 400);
    const instances = await dispatchWorkflowEvent({
      event,
      entity_type,
      entity_id,
      context,
      triggered_by,
    });
    if (!instances.length) {
      return c.json({ success: false, error: `No valid active workflow found for event: ${event}` }, 404);
    }
    return c.json({ success: true, data: instances, count: instances.length });
  } catch (err) {
    if (isTableMissing(err)) return c.json({ success: false, error: "Required table does not exist" }, 503);
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

workflowApi.post("/instances", async (c) => {
  try {
    const supabase = getSupabase();
    const actor = await currentAppUser(supabase, c);
    if (!actor) return c.json({ success: false, error: "Application user not found" }, 403);
    const body = await c.req.json();
    const definitionId = body.definition_id ?? body.definitionId;
    if (!definitionId) {
      return c.json({ success: false, error: "definition_id is required" }, 400);
    }

    const { data: definition, error: definitionError } = await supabase
      .from("workflow_definitions")
      .select("*")
      .eq("id", definitionId)
      .single();
    if (definitionError || !definition) {
      return c.json({ success: false, error: "Workflow definition not found" }, 404);
    }
    if (definition.status !== "active") {
      return c.json({ success: false, error: "Only active workflows can be started" }, 409);
    }

    const validationErrors = validateDefinition(definition);
    if (validationErrors.length) {
      return c.json({ success: false, error: "Workflow is invalid", details: validationErrors }, 422);
    }

    const nodes = definition.nodes as Array<Record<string, unknown>>;
    const firstNode = nodes.find((node) => node.type === "trigger") ?? nodes[0];
    const instance = {
      id: crypto.randomUUID(),
      definition_id: definition.id,
      workflow_name: definition.name,
      status: "running",
      current_node_id: firstNode?.id ?? null,
      context: body.context ?? {},
      entity_type: body.entity_type ?? null,
      entity_id: body.entity_id ?? null,
      started_by: actor.id,
      started_at: new Date().toISOString(),
      completed_at: null,
      history: [],
    };

    const { data: created, error } = await supabase
      .from("workflow_instances")
      .insert(instance)
      .select()
      .single();
    if (error) throw error;
    if (firstNode) {
      await executeWorkflowStep(supabase, created ?? instance, definition, String(firstNode.id));
    }

    const { data: updated } = await supabase
      .from("workflow_instances")
      .select("*")
      .eq("id", instance.id)
      .single();
    return c.json({
      success: true,
      data: normalizeInstance((updated ?? created) as Record<string, unknown>),
    }, 201);
  } catch (err) {
    return c.json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

workflowApi.get("/instances", async (c) => {
  try {
    const supabase = getSupabase();
    const actor = await currentAppUser(supabase, c);
    if (!actor) return c.json({ success: false, error: "Application user not found" }, 403);
    const { status, definition_id, entity_type, entity_id } = c.req.query() as Record<string, string>;

    let query = supabase.from("workflow_instances").select("*").order("started_at", { ascending: false });
    const role = (c as any).get("role");
    if (role === "employee") query = query.eq("started_by", actor.id);
    if (status) query = query.eq("status", status);
    if (definition_id) query = query.eq("definition_id", definition_id);
    if (entity_type) query = query.eq("entity_type", entity_type);
    if (entity_id) query = query.eq("entity_id", entity_id);

    const { data, error } = await query;
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: [] });
      throw error;
    }
    return c.json({
      success: true,
      data: (data ?? []).map((row) => normalizeInstance(row)),
    });
  } catch (err) {
    if (isTableMissing(err)) return c.json({ success: true, data: [] });
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

workflowApi.get("/instances/:id/steps", async (c) => {
  try {
    const supabase = getSupabase();
    const actor = await currentAppUser(supabase, c);
    if (!actor) return c.json({ success: false, error: "Application user not found" }, 403);
    if ((c as any).get("role") === "employee") {
      const { data: owned } = await supabase
        .from("workflow_instances")
        .select("id")
        .eq("id", c.req.param("id"))
        .eq("started_by", actor.id)
        .maybeSingle();
      if (!owned) return c.json({ success: false, error: "Workflow instance not found" }, 404);
    }
    const { data, error } = await supabase
      .from("workflow_instance_steps")
      .select("*")
      .eq("instance_id", c.req.param("id"))
      .order("created_at", { ascending: true });
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: [] });
      throw error;
    }
    return c.json({ success: true, data: data ?? [] });
  } catch (err) {
    return c.json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

workflowApi.post("/instances/:id/retry", async (c) => {
  try {
    const supabase = getSupabase();
    const instanceId = c.req.param("id");
    const { step_id } = await c.req.json();
    if (!step_id) return c.json({ success: false, error: "step_id is required" }, 400);

    const { data: instance } = await supabase
      .from("workflow_instances")
      .select("*")
      .eq("id", instanceId)
      .single();
    if (!instance) return c.json({ success: false, error: "Workflow instance not found" }, 404);
    if (instance.status !== "failed") {
      return c.json({ success: false, error: "Only failed workflows can be retried" }, 409);
    }

    const { data: definition } = await supabase
      .from("workflow_definitions")
      .select("*")
      .eq("id", instance.definition_id)
      .single();
    if (!definition) return c.json({ success: false, error: "Workflow definition not found" }, 404);

    const node = (definition.nodes as Array<Record<string, unknown>>)
      .find((candidate) => candidate.id === step_id);
    if (!node) return c.json({ success: false, error: "Workflow step not found" }, 404);

    await supabase.from("workflow_instances").update({
      status: "running",
      completed_at: null,
      current_node_id: step_id,
    }).eq("id", instanceId);
    await executeWorkflowStep(
      supabase,
      { ...instance, status: "running", completed_at: null },
      definition,
      step_id,
    );

    const { data: updated } = await supabase
      .from("workflow_instances")
      .select("*")
      .eq("id", instanceId)
      .single();
    return c.json({ success: true, data: normalizeInstance(updated) });
  } catch (err) {
    return c.json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

workflowApi.get("/instances/:id", async (c) => {
  try {
    const supabase = getSupabase();
    const actor = await currentAppUser(supabase, c);
    if (!actor) return c.json({ success: false, error: "Application user not found" }, 403);
    let query = supabase.from("workflow_instances").select("*").eq("id", c.req.param("id"));
    if ((c as any).get("role") === "employee") query = query.eq("started_by", actor.id);
    const { data, error } = await query.single();
    if (error) {
      if (isTableMissing(error)) return c.json({ success: false, error: "Not found" }, 404);
      throw error;
    }
    if (!data) return c.json({ success: false, error: "Not found" }, 404);
    return c.json({ success: true, data: normalizeInstance(data) });
  } catch (err) {
    if (isTableMissing(err)) return c.json({ success: false, error: "Not found" }, 404);
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

workflowApi.post("/instances/:id/cancel", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("workflow_instances")
      .update({ status: "cancelled", completed_at: new Date().toISOString(), ...auditUpdate(c) })
      .eq("id", c.req.param("id"))
      .select()
      .single();
    if (error) {
      if (isTableMissing(error)) return c.json({ success: false, error: "Not found" }, 404);
      throw error;
    }
    return c.json({ success: true, data });
  } catch (err) {
    if (isTableMissing(err)) return c.json({ success: false, error: "Not found" }, 404);
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

// ─── Approval Management ──────────────────────────────────────────────────────

// GET /approvals/my — must be before /approvals/:id to avoid conflict
workflowApi.get("/approvals/my", async (c) => {
  try {
    const supabase = getSupabase();
    const userRecord = await currentAppUser(supabase, c);
    if (!userRecord) return c.json({ success: false, error: "Application user not found" }, 403);
    const userId = String(userRecord.id);
    const userRoles = [
      userRecord.role,
      userRecord.primary_role,
      ...(Array.isArray(userRecord.roles) ? userRecord.roles : []),
    ].filter(Boolean);

    let query = supabase.from("workflow_approvals").select("*").eq("status", "pending");
    if (userRoles.length) {
      const roleFilters = userRoles.map((role) => `assignee_role.eq.${role}`);
      query = query.or([`assignee_id.eq.${userId}`, ...roleFilters].join(","));
    } else {
      query = query.eq("assignee_id", userId);
    }

    const { data, error } = await query.order("requested_at", { ascending: false });
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: [] });
      throw error;
    }
    return c.json({ success: true, data: data ?? [] });
  } catch (err) {
    if (isTableMissing(err)) return c.json({ success: true, data: [] });
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

workflowApi.get("/approvals", async (c) => {
  try {
    if (!["admin", "hr", "manager"].includes((c as any).get("role"))) {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }
    const supabase = getSupabase();
    const { assignee_id, assignee_role } = c.req.query() as Record<string, string>;

    let query = supabase.from("workflow_approvals").select("*").eq("status", "pending").order("requested_at", { ascending: false });
    if (assignee_id) query = query.eq("assignee_id", assignee_id);
    if (assignee_role) query = query.eq("assignee_role", assignee_role);

    const { data, error } = await query;
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: [] });
      throw error;
    }
    return c.json({ success: true, data: data ?? [] });
  } catch (err) {
    if (isTableMissing(err)) return c.json({ success: true, data: [] });
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

workflowApi.post("/approvals/:id/respond", async (c) => {
  try {
    const supabase = getSupabase();
    const { id } = c.req.param();
    const { status, comment } = await c.req.json();

    if (!status || !["approved", "rejected"].includes(status)) {
      return c.json({ success: false, error: "status must be 'approved' or 'rejected'" }, 400);
    }

    const actor = await currentAppUser(supabase, c);
    if (!actor) return c.json({ success: false, error: "Application user not found" }, 403);

    const { data: pendingApproval } = await supabase
      .from("workflow_approvals")
      .select("*")
      .eq("id", id)
      .eq("status", "pending")
      .maybeSingle();
    if (!pendingApproval) {
      return c.json({ success: false, error: "Approval is not pending" }, 409);
    }

    const actorRoles = new Set([
      actor.role,
      actor.primary_role,
      ...(Array.isArray(actor.roles) ? actor.roles : []),
    ].filter(Boolean));
    const isAssigned =
      pendingApproval.assignee_id === actor.id ||
      (pendingApproval.assignee_role && actorRoles.has(pendingApproval.assignee_role));
    if (!isAssigned) {
      return c.json({ success: false, error: "You are not assigned to this approval" }, 403);
    }

    const { data: approval, error: approvalErr } = await supabase
      .from("workflow_approvals")
      .update({ status, comment: comment ?? null, responded_by: actor.id, responded_at: new Date().toISOString(), ...auditUpdate(c) })
      .eq("id", id)
      .eq("status", "pending")
      .select()
      .single();

    if (approvalErr) {
      if (isTableMissing(approvalErr)) return c.json({ success: false, error: "Not found" }, 404);
      throw approvalErr;
    }
    if (!approval) return c.json({ success: false, error: "Approval not found" }, 404);

    const { data: instance } = await supabase.from("workflow_instances").select("*").eq("id", (approval as Record<string, string>).instance_id).single();
    const { data: definition } = await supabase.from("workflow_definitions").select("*").eq("id", (instance as Record<string, string> | null)?.definition_id).single();

    if (instance && definition) {
      const inst = instance as Record<string, unknown>;
      const def = definition as Record<string, unknown>;
      const nodes = def.nodes as Array<Record<string, unknown>>;

      if (status === "approved") {
        const currentNode = nodes?.find((n) => n.id === inst.current_node_id);
        const connections = currentNode?.connections as string[] | undefined;
        const nextNodeId = connections?.[0];

        await supabase.from("workflow_instance_steps").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          output_data: { approval_status: "approved", responded_by: actor.id },
        }).eq("instance_id", inst.id).eq("step_id", inst.current_node_id).eq("status", "pending");
        await supabase.from("workflow_instances").update({ status: "running" }).eq("id", inst.id);

        if (nextNodeId) {
          await executeWorkflowStep(supabase, { ...inst, status: "running" }, def, nextNodeId);
        } else {
          await supabase.from("workflow_instances").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", inst.id);
        }
      } else {
        // Rejected
        await supabase.from("workflow_instance_steps").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          output_data: { approval_status: "rejected", responded_by: actor.id, comment: comment ?? null },
        }).eq("instance_id", inst.id).eq("step_id", inst.current_node_id).eq("status", "pending");
        await supabase.from("workflow_instances").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", inst.id);

        if (inst.started_by) {
          const approvalRecord = approval as Record<string, string>;
          await supabase.from("notifications").insert({
            id: crypto.randomUUID(),
            user_id: inst.started_by,
            title: `Workflow Rejected: ${def.name}`,
            message: `${approvalRecord.step_name} was rejected. Reason: ${comment || "No comment provided."}`,
            type: "workflow",
            link: "/workflow-dashboard",
            created_at: new Date().toISOString(),
            read: false,
          }).catch(() => {});
          sendPushToUser(String(inst.started_by), {
            title: "Workflow Rejected",
            body: `${approvalRecord.step_name} rejected: ${comment || "No comment provided."}`,
            type: "workflow",
            link: "/workflow-dashboard",
          }).catch(() => {});
        }
      }
    }

    return c.json({ success: true, data: approval });
  } catch (err) {
    if (isTableMissing(err)) return c.json({ success: false, error: "Not found" }, 404);
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

// ─── Statistics ───────────────────────────────────────────────────────────────

workflowApi.get("/stats", async (c) => {
  try {
    const supabase = getSupabase();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      { count: total_definitions },
      { count: active_definitions },
      { count: running_instances },
      { count: completed_today },
      { count: pending_approvals },
      { count: failed_instances },
    ] = await Promise.all([
      supabase.from("workflow_definitions").select("*", { count: "exact", head: true }),
      supabase.from("workflow_definitions").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("workflow_instances").select("*", { count: "exact", head: true }).eq("status", "running"),
      supabase.from("workflow_instances").select("*", { count: "exact", head: true }).eq("status", "completed").gte("completed_at", todayStart.toISOString()),
      supabase.from("workflow_approvals").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("workflow_instances").select("*", { count: "exact", head: true }).eq("status", "failed"),
    ]);

    return c.json({
      success: true,
      data: {
        totalWorkflows: total_definitions ?? 0,
        activeWorkflows: active_definitions ?? 0,
        runningInstances: running_instances ?? 0,
        completedToday: completed_today ?? 0,
        pendingApprovals: pending_approvals ?? 0,
        failedInstances: failed_instances ?? 0,
        total_definitions: total_definitions ?? 0,
        active_definitions: active_definitions ?? 0,
        running_instances: running_instances ?? 0,
        completed_today: completed_today ?? 0,
        pending_approvals: pending_approvals ?? 0,
        failed_instances: failed_instances ?? 0,
      },
    });
  } catch (err) {
    if (isTableMissing(err)) {
      return c.json({
        success: true,
        data: {
          totalWorkflows: 0,
          activeWorkflows: 0,
          runningInstances: 0,
          completedToday: 0,
          pendingApprovals: 0,
          failedInstances: 0,
          total_definitions: 0,
          active_definitions: 0,
          running_instances: 0,
          completed_today: 0,
          pending_approvals: 0,
          failed_instances: 0,
        },
      });
    }
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

const DEFAULT_WORKFLOWS = [
  {
    name: "Leave Request Approval",
    description: "Routes a submitted leave request to a manager for approval.",
    status: "active",
    category: "HR",
    trigger_type: "event",
    trigger_config: { event_key: "leave_applied" },
    nodes: [
      { id: "leave-start", type: "trigger", label: "Leave submitted", config: {}, position: { x: 100, y: 160 }, connections: ["leave-notify"] },
      { id: "leave-notify", type: "notification", label: "Notify managers", config: { recipients_role: "manager", title: "Leave request pending", message: "A leave request requires review.", link: "/workflow-dashboard" }, position: { x: 320, y: 160 }, connections: ["leave-approval"] },
      { id: "leave-approval", type: "approval", label: "Manager approval", config: { approver_role: "manager", step_name: "Manager approval" }, position: { x: 540, y: 160 }, connections: ["leave-end"] },
      { id: "leave-end", type: "end", label: "Complete", config: {}, position: { x: 760, y: 160 }, connections: [] },
    ],
  },
  {
    name: "Payroll Run Approval",
    description: "Routes an initiated payroll run to Finance for approval.",
    status: "active",
    category: "Finance",
    trigger_type: "event",
    trigger_config: { event_key: "payroll_run_initiated" },
    nodes: [
      { id: "payroll-start", type: "trigger", label: "Payroll initiated", config: {}, position: { x: 100, y: 160 }, connections: ["payroll-notify"] },
      { id: "payroll-notify", type: "notification", label: "Notify Finance", config: { recipients_role: "finance", title: "Payroll approval required", message: "A payroll run requires approval.", link: "/workflow-dashboard" }, position: { x: 320, y: 160 }, connections: ["payroll-approval"] },
      { id: "payroll-approval", type: "approval", label: "Finance approval", config: { approver_role: "finance", step_name: "Finance approval" }, position: { x: 540, y: 160 }, connections: ["payroll-end"] },
      { id: "payroll-end", type: "end", label: "Complete", config: {}, position: { x: 760, y: 160 }, connections: [] },
    ],
  },
  {
    name: "Onboarding Team Notification",
    description: "Notifies HR and IT when an onboarding record is started.",
    status: "active",
    category: "HR",
    trigger_type: "event",
    trigger_config: { event_key: "onboarding_started" },
    nodes: [
      { id: "onboarding-start", type: "trigger", label: "Onboarding started", config: {}, position: { x: 100, y: 160 }, connections: ["onboarding-it"] },
      { id: "onboarding-it", type: "notification", label: "Notify IT", config: { recipients_role: "it", title: "New onboarding started", message: "Please prepare access and equipment.", link: "/onboarding" }, position: { x: 320, y: 100 }, connections: ["onboarding-hr"] },
      { id: "onboarding-hr", type: "notification", label: "Notify HR", config: { recipients_role: "hr", title: "Onboarding workflow started", message: "A new employee onboarding record has been created.", link: "/onboarding" }, position: { x: 540, y: 220 }, connections: ["onboarding-end"] },
      { id: "onboarding-end", type: "end", label: "Complete", config: {}, position: { x: 760, y: 160 }, connections: [] },
    ],
  },
] as const;

workflowApi.post("/seed-defaults", async (c) => {
  try {
    const supabase = getSupabase();
    const names = DEFAULT_WORKFLOWS.map((workflow) => workflow.name);
    const { data: existing, error: lookupError } = await supabase
      .from("workflow_definitions")
      .select("name")
      .in("name", names);
    if (lookupError) throw lookupError;

    const existingNames = new Set((existing ?? []).map((row) => row.name));
    const now = new Date().toISOString();
    const records = DEFAULT_WORKFLOWS
      .filter((workflow) => !existingNames.has(workflow.name))
      .map((workflow) => ({
        id: crypto.randomUUID(),
        ...workflow,
        version: 1,
        is_template: false,
        tags: ["default"],
        created_at: now,
        updated_at: now,
        ...auditCreate(c),
      }));

    if (records.length) {
      const { error } = await supabase.from("workflow_definitions").insert(records);
      if (error) throw error;
    }
    return c.json({
      success: true,
      seeded: records.length,
      message: records.length
        ? `Created ${records.length} default workflows`
        : "Default workflows already exist",
    });
  } catch (err) {
    if (isTableMissing(err)) {
      return c.json({ success: false, error: "workflow_definitions table does not exist" }, 503);
    }
    return c.json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

export default workflowApi;
