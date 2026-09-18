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

function isTableMissing(err: unknown): boolean {
  const e = err as Record<string, unknown>;
  return e?.code === "42P01" || e?.code === "PGRST116" || e?.code === "PGRST200" || String(e?.message)?.includes('schema cache');
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
        history.push(historyEntry);
        await supabase.from("workflow_instances").update({ history }).eq("id", instance.id);
        return; // Stop — waiting for approval response
      }

      case "condition": {
        const { field, operator, value, true_path, false_path } = config as Record<string, string>;
        const ctx = instance.context as Record<string, unknown> | undefined;
        const contextValue = ctx?.[field];
        let result = false;
        switch (operator) {
          case "equals": result = contextValue == value; break;
          case "not_equals": result = contextValue != value; break;
          case "greater_than": result = Number(contextValue) > Number(value); break;
          case "less_than": result = Number(contextValue) < Number(value); break;
          case "contains": result = String(contextValue).includes(value); break;
        }
        historyEntry.status = "success";
        historyEntry.action = `Condition: ${field} ${operator} ${value} → ${result}`;
        const nextNodeId = result ? true_path : false_path;
        if (nextNodeId) await executeWorkflowStep(supabase, instance, definition, nextNodeId);
        break;
      }

      case "delay": {
        historyEntry.status = "success";
        historyEntry.action = `Delay: ${config.duration} ${config.unit} (simulated)`;
        if (connections?.[0]) await executeWorkflowStep(supabase, instance, definition, connections[0]);
        break;
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
        historyEntry.status = "success";
        historyEntry.action = `Node executed: ${node.type}`;
        if (connections?.[0]) await executeWorkflowStep(supabase, instance, definition, connections[0]);
      }
    }
  } catch (err: unknown) {
    historyEntry.status = "error";
    historyEntry.error = String(err);
    await supabase.from("workflow_instances").update({ status: "failed" }).eq("id", instance.id);
  }

  history.push(historyEntry);
  await supabase.from("workflow_instances").update({ history, current_node_id: node.id }).eq("id", instance.id);
}

// ─── Workflow Definitions CRUD ────────────────────────────────────────────────

// Normalize a DB row into the shape the frontend expects:
//   trigger: { type, config } instead of flat trigger_type / trigger_config
function normalizeDefinition(row: Record<string, any>): Record<string, any> {
  if (!row) return row;
  const { trigger_type, trigger_config, ...rest } = row;
  // If row already has a nested trigger object, leave it
  if (rest.trigger && typeof rest.trigger === "object") return rest;
  return {
    ...rest,
    trigger: {
      type: trigger_type ?? "manual",
      config: trigger_config ?? {},
    },
    nodes: Array.isArray(rest.nodes) ? rest.nodes : [],
  };
}

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
    return c.json({ success: true, data: (data ?? []).map(normalizeDefinition) });
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
      name: body.name,
      description: body.description ?? null,
      status: body.status ?? "draft",
      trigger_type: body.trigger_type ?? "manual",
      trigger_config: body.trigger_config ?? {},
      nodes: body.nodes ?? [],
      created_by: body.created_by ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      is_template: body.is_template ?? false,
      category: body.category ?? null,
      tags: body.tags ?? [],
    };

    const { data, error } = await supabase.from("workflow_definitions").insert({ ...record, ...auditCreate(c) }).select().single();
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: record });
      throw error;
    }
    return c.json({ success: true, data }, 201);
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
    const { data: current } = await supabase.from("workflow_definitions").select("version").eq("id", c.req.param("id")).single();
    const newVersion = ((current?.version as number) ?? 0) + 1;

    const updates = { ...body, updated_at: new Date().toISOString(), version: newVersion };
    delete updates.id;

    const { data, error } = await supabase.from("workflow_definitions").update({ ...updates, ...auditUpdate(c) }).eq("id", c.req.param("id")).select().single();
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

workflowApi.post("/trigger", async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { event, entity_type, entity_id, context, triggered_by } = body;

    if (!event) return c.json({ success: false, error: "event is required" }, 400);

    // Find matching active workflow definition
    const { data: definitions, error: defErr } = await supabase
      .from("workflow_definitions")
      .select("*")
      .eq("status", "active")
      .eq("trigger_type", "event");

    if (defErr) {
      if (isTableMissing(defErr)) return c.json({ success: false, error: "workflow_definitions table does not exist" }, 503);
      throw defErr;
    }

    const definition = (definitions ?? []).find(
      (d: Record<string, unknown>) => (d.trigger_config as Record<string, string>)?.event === event
    );

    if (!definition) return c.json({ success: false, error: `No active workflow found for event: ${event}` }, 404);

    // Create instance
    const instanceId = crypto.randomUUID();
    const nodes = definition.nodes as Array<Record<string, unknown>>;
    const firstNode = nodes?.[0];

    const instance = {
      id: instanceId,
      definition_id: definition.id,
      workflow_name: definition.name,
      status: "running",
      current_node_id: firstNode?.id ?? null,
      context: context ?? {},
      entity_type: entity_type ?? null,
      entity_id: entity_id ?? null,
      started_by: triggered_by ?? null,
      started_at: new Date().toISOString(),
      completed_at: null,
      history: [],
    };

    const { data: createdInstance, error: insErr } = await supabase.from("workflow_instances").insert({ ...instance, ...auditCreate(c) }).select().single();
    if (insErr) {
      if (isTableMissing(insErr)) return c.json({ success: false, error: "workflow_instances table does not exist" }, 503);
      throw insErr;
    }

    // Execute starting from first node
    if (firstNode) {
      await executeWorkflowStep(supabase, createdInstance ?? instance, definition, String(firstNode.id));
    }

    // Refresh instance after execution
    const { data: updatedInstance } = await supabase.from("workflow_instances").select("*").eq("id", instanceId).single();
    return c.json({ success: true, data: updatedInstance ?? createdInstance });
  } catch (err) {
    if (isTableMissing(err)) return c.json({ success: false, error: "Required table does not exist" }, 503);
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

workflowApi.get("/instances", async (c) => {
  try {
    const supabase = getSupabase();
    const { status, definition_id, entity_type, entity_id } = c.req.query() as Record<string, string>;

    let query = supabase.from("workflow_instances").select("*").order("started_at", { ascending: false });
    if (status) query = query.eq("status", status);
    if (definition_id) query = query.eq("definition_id", definition_id);
    if (entity_type) query = query.eq("entity_type", entity_type);
    if (entity_id) query = query.eq("entity_id", entity_id);

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

workflowApi.get("/instances/:id", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("workflow_instances").select("*").eq("id", c.req.param("id")).single();
    if (error) {
      if (isTableMissing(error)) return c.json({ success: false, error: "Not found" }, 404);
      throw error;
    }
    if (!data) return c.json({ success: false, error: "Not found" }, 404);
    return c.json({ success: true, data });
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
    const userId = c.req.query("user_id");
    if (!userId) return c.json({ success: false, error: "user_id is required" }, 400);

    // Get user's role first
    const { data: userRecord } = await supabase.from("app_users").select("role").eq("id", userId).single();
    const userRole = (userRecord as Record<string, string> | null)?.role;

    let query = supabase.from("workflow_approvals").select("*").eq("status", "pending");
    if (userRole) {
      query = query.or(`assignee_id.eq.${userId},assignee_role.eq.${userRole}`);
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
    const { status, comment, responded_by } = await c.req.json();

    if (!status || !["approved", "rejected"].includes(status)) {
      return c.json({ success: false, error: "status must be 'approved' or 'rejected'" }, 400);
    }

    const { data: approval, error: approvalErr } = await supabase
      .from("workflow_approvals")
      .update({ status, comment: comment ?? null, responded_by: responded_by ?? null, responded_at: new Date().toISOString(), ...auditUpdate(c) })
      .eq("id", id)
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

        await supabase.from("workflow_instances").update({ status: "running" }).eq("id", inst.id);

        if (nextNodeId) {
          await executeWorkflowStep(supabase, { ...inst, status: "running" }, def, nextNodeId);
        } else {
          await supabase.from("workflow_instances").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", inst.id);
        }
      } else {
        // Rejected
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

// ─── Seed default workflows ───────────────────────────────────────────────────

const DEFAULT_WORKFLOWS = [
  {
    name: "Leave Request Approval",
    description: "Automatically routes leave requests to the reporting manager for approval. Notifies the employee on approval or rejection.",
    status: "active",
    category: "HR",
    trigger_type: "leave_request",
    trigger_config: { entity: "leave" },
    nodes: [
      { id: "n1", type: "trigger", label: "Leave Submitted", config: {}, position: { x: 100, y: 150 }, connections: ["n2"] },
      { id: "n2", type: "notification", label: "Notify Manager", config: { recipients_role: "manager", title: "Leave Request Pending Approval", message: "A leave request requires your approval.", link: "/workflow-dashboard" }, position: { x: 320, y: 150 }, connections: ["n3"] },
      { id: "n3", type: "approval", label: "Manager Approval", config: { approver_role: "manager", step_name: "Manager Approval" }, position: { x: 540, y: 150 }, connections: ["n4"] },
      { id: "n4", type: "notification", label: "Notify Employee", config: { title: "Leave Request Processed", message: "Your leave request has been reviewed.", link: "/dashboard" }, position: { x: 760, y: 150 }, connections: ["n5"] },
      { id: "n5", type: "end", label: "Done", config: {}, position: { x: 960, y: 150 }, connections: [] },
    ],
  },
  {
    name: "Payroll Approval Workflow",
    description: "Routes payroll processing requests to Finance for review and approval before finalizing.",
    status: "active",
    category: "Finance",
    trigger_type: "payroll_run",
    trigger_config: { entity: "payroll" },
    nodes: [
      { id: "n1", type: "trigger", label: "Payroll Run Initiated", config: {}, position: { x: 100, y: 150 }, connections: ["n2"] },
      { id: "n2", type: "notification", label: "Notify Finance Team", config: { recipients_role: "finance", title: "Payroll Approval Required", message: "A payroll run requires your approval.", link: "/workflow-dashboard" }, position: { x: 320, y: 150 }, connections: ["n3"] },
      { id: "n3", type: "approval", label: "Finance Approval", config: { approver_role: "finance", step_name: "Finance Approval" }, position: { x: 540, y: 150 }, connections: ["n4"] },
      { id: "n4", type: "notification", label: "Notify HR", config: { recipients_role: "hr", title: "Payroll Approved", message: "The payroll run has been approved by Finance.", link: "/payroll" }, position: { x: 760, y: 150 }, connections: ["n5"] },
      { id: "n5", type: "end", label: "Done", config: {}, position: { x: 960, y: 150 }, connections: [] },
    ],
  },
  {
    name: "New Employee Onboarding",
    description: "Automatically creates onboarding tasks and notifies relevant teams when a new employee joins.",
    status: "active",
    category: "HR",
    trigger_type: "employee_created",
    trigger_config: { entity: "employee" },
    nodes: [
      { id: "n1", type: "trigger", label: "Employee Record Created", config: {}, position: { x: 100, y: 150 }, connections: ["n2"] },
      { id: "n2", type: "notification", label: "Notify IT", config: { recipients_role: "it", title: "New Employee — IT Setup Required", message: "Please provision accounts and equipment.", link: "/onboarding" }, position: { x: 320, y: 150 }, connections: ["n3"] },
      { id: "n3", type: "notification", label: "Notify HR", config: { recipients_role: "hr", title: "New Employee Onboarding Started", message: "Onboarding checklist has been triggered.", link: "/onboarding" }, position: { x: 540, y: 150 }, connections: ["n4"] },
      { id: "n4", type: "action", label: "Create Onboarding Tasks", config: { actionType: "create_tasks", entity: "onboarding" }, position: { x: 760, y: 150 }, connections: ["n5"] },
      { id: "n5", type: "end", label: "Done", config: {}, position: { x: 960, y: 150 }, connections: [] },
    ],
  },
  {
    name: "IT Ticket Escalation",
    description: "Escalates unresolved IT support tickets to the IT manager after 24 hours.",
    status: "active",
    category: "IT",
    trigger_type: "ticket_created",
    trigger_config: { entity: "ticket", escalation_hours: 24 },
    nodes: [
      { id: "n1", type: "trigger", label: "Ticket Created", config: {}, position: { x: 100, y: 150 }, connections: ["n2"] },
      { id: "n2", type: "delay", label: "Wait 24 hours", config: { duration: 24, unit: "hours" }, position: { x: 320, y: 150 }, connections: ["n3"] },
      { id: "n3", type: "condition", label: "Still Unresolved?", config: { field: "status", operator: "not_in", value: ["Resolved", "Closed"] }, position: { x: 540, y: 150 }, connections: ["n4"] },
      { id: "n4", type: "notification", label: "Escalate to IT Manager", config: { recipients_role: "it", title: "Ticket Escalation Alert", message: "A support ticket has been open for over 24 hours.", link: "/it-services" }, position: { x: 760, y: 150 }, connections: ["n5"] },
      { id: "n5", type: "end", label: "Done", config: {}, position: { x: 960, y: 150 }, connections: [] },
    ],
  },
  {
    name: "Performance Review Cycle",
    description: "Triggers annual performance review notifications and approval chain for review submissions.",
    status: "active",
    category: "HR",
    trigger_type: "scheduled",
    trigger_config: { schedule: "0 9 1 1,7 *" },
    nodes: [
      { id: "n1", type: "trigger", label: "Review Cycle Starts", config: {}, position: { x: 100, y: 150 }, connections: ["n2"] },
      { id: "n2", type: "notification", label: "Notify All Managers", config: { recipients_role: "manager", title: "Performance Review Period Open", message: "Please complete reviews for your direct reports.", link: "/performance" }, position: { x: 320, y: 150 }, connections: ["n3"] },
      { id: "n3", type: "approval", label: "HR Final Approval", config: { approver_role: "hr", step_name: "HR Approval" }, position: { x: 540, y: 150 }, connections: ["n4"] },
      { id: "n4", type: "end", label: "Done", config: {}, position: { x: 760, y: 150 }, connections: [] },
    ],
  },
];

workflowApi.post("/seed-defaults", async (c) => {
  try {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    // Only insert workflows that don't already exist (match by name)
    const { data: existing } = await supabase
      .from("workflow_definitions")
      .select("name")
      .in("name", DEFAULT_WORKFLOWS.map(w => w.name));

    const existingNames = new Set((existing ?? []).map((r: any) => r.name));
    const toInsert = DEFAULT_WORKFLOWS
      .filter(w => !existingNames.has(w.name))
      .map(w => ({
        id: crypto.randomUUID(),
        ...w,
        created_at: now,
        updated_at: now,
        version: 1,
        is_template: false,
        tags: [],
      }));

    if (toInsert.length === 0) {
      return c.json({ success: true, message: "Default workflows already exist", seeded: 0 });
    }

    const { error } = await supabase.from("workflow_definitions").insert(toInsert);
    if (error) {
      if (isTableMissing(error)) return c.json({ success: false, error: "workflow_definitions table does not exist" }, 503);
      throw error;
    }

    return c.json({ success: true, seeded: toInsert.length, message: `Seeded ${toInsert.length} default workflows` });
  } catch (err) {
    return c.json({ success: false, error: err instanceof Error ? err.message : JSON.stringify(err) }, 500);
  }
});

export default workflowApi;
