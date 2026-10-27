import type {
  ApprovalRequest,
  WorkflowDefinition,
  WorkflowInstance,
} from './workflowEngine';

type ApiRecord = Record<string, any>;

export function mapWorkflowDefinition(row: ApiRecord): WorkflowDefinition {
  const trigger = row.trigger ?? {
    type: row.trigger_type ?? 'manual',
    config: row.trigger_config ?? {},
  };

  return {
    ...row,
    id: row.id,
    name: row.name ?? '',
    description: row.description ?? '',
    status: row.status ?? 'draft',
    trigger: {
      type: trigger.type ?? 'manual',
      config: trigger.config ?? {},
    },
    nodes: Array.isArray(row.nodes)
      ? row.nodes.map((node: ApiRecord) => ({
          ...node,
          config: node.config ?? {},
          position: node.position ?? { x: 0, y: 0 },
          connections: Array.isArray(node.connections) ? node.connections : [],
        }))
      : [],
    createdBy: row.createdBy ?? row.created_by ?? '',
    createdAt: row.createdAt ?? row.created_at ?? '',
    updatedAt: row.updatedAt ?? row.updated_at ?? '',
    version: row.version ?? 1,
  };
}

export function mapWorkflowInstance(row: ApiRecord): WorkflowInstance {
  return {
    ...row,
    id: row.id,
    workflowId: row.workflowId ?? row.definition_id ?? '',
    status: row.status ?? 'running',
    currentNodeId: row.currentNodeId ?? row.current_node_id ?? null,
    data: row.data ?? row.context ?? {},
    startedAt: row.startedAt ?? row.started_at ?? '',
    completedAt: row.completedAt ?? row.completed_at ?? undefined,
    history: Array.isArray(row.history) ? row.history : [],
  };
}

export function mapApproval(row: ApiRecord): ApprovalRequest & ApiRecord {
  return {
    ...row,
    id: row.id,
    workflowInstanceId: row.workflowInstanceId ?? row.instance_id ?? '',
    nodeId: row.nodeId ?? row.step_id ?? '',
    requestedBy: row.requestedBy ?? row.requested_by ?? '',
    approvers: row.approvers ?? [row.assignee_id ?? row.assignee_role].filter(Boolean),
    currentApproverIndex: row.currentApproverIndex ?? 0,
    status: row.status ?? 'pending',
    message: row.message ?? row.step_name ?? 'Approval required',
    data: row.data ?? row.context ?? {},
    createdAt: row.createdAt ?? row.requested_at ?? '',
    responses: Array.isArray(row.responses) ? row.responses : [],
  };
}

export function mapWorkflowStats(row: ApiRecord): Record<string, number> {
  return {
    totalWorkflows: row.totalWorkflows ?? row.total_definitions ?? 0,
    activeWorkflows: row.activeWorkflows ?? row.active_definitions ?? 0,
    runningInstances: row.runningInstances ?? row.running_instances ?? 0,
    completedToday: row.completedToday ?? row.completed_today ?? 0,
    pendingApprovals: row.pendingApprovals ?? row.pending_approvals ?? 0,
    failedInstances: row.failedInstances ?? row.failed_instances ?? 0,
  };
}

export function serializeWorkflowDefinition(definition: Partial<WorkflowDefinition>): ApiRecord {
  const { trigger, createdBy, createdAt, updatedAt, ...rest } = definition;
  return {
    ...rest,
    ...(trigger
      ? {
          trigger_type: trigger.type,
          trigger_config: {
            ...trigger.config,
            event_key:
              trigger.config?.event_key ??
              trigger.config?.event ??
              (trigger as ApiRecord).event,
          },
        }
      : {}),
    ...(createdBy ? { created_by: createdBy } : {}),
    ...(createdAt ? { created_at: createdAt } : {}),
    ...(updatedAt ? { updated_at: updatedAt } : {}),
  };
}
