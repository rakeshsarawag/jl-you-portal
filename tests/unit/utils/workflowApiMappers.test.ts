import { describe, expect, it } from 'vitest';
import {
  mapWorkflowDefinition,
  mapWorkflowInstance,
  mapWorkflowStats,
  serializeWorkflowDefinition,
} from '../../../src/app/services/workflowApiMappers';

describe('workflow API mappers', () => {
  it('normalizes database definitions for the builder', () => {
    const definition = mapWorkflowDefinition({
      id: 'wf-1',
      name: 'Leave approval',
      status: 'active',
      trigger_type: 'event',
      trigger_config: { event_key: 'leave_applied' },
      nodes: [{ id: 'start', type: 'trigger', label: 'Start' }],
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
    });

    expect(definition.trigger).toEqual({
      type: 'event',
      config: { event_key: 'leave_applied' },
    });
    expect(definition.nodes[0].connections).toEqual([]);
    expect(definition.createdAt).toBe('2026-01-01');
  });

  it('serializes the builder trigger without losing the canonical event key', () => {
    const serialized = serializeWorkflowDefinition({
      trigger: {
        type: 'event',
        config: { event: 'leave_applied' },
      },
    });

    expect(serialized.trigger_type).toBe('event');
    expect(serialized.trigger_config.event_key).toBe('leave_applied');
  });

  it('normalizes instances and stats', () => {
    expect(mapWorkflowInstance({
      id: 'run-1',
      definition_id: 'wf-1',
      current_node_id: 'start',
      context: { leaveId: 'leave-1' },
      started_at: '2026-01-01',
    })).toMatchObject({
      workflowId: 'wf-1',
      currentNodeId: 'start',
      data: { leaveId: 'leave-1' },
      startedAt: '2026-01-01',
    });

    expect(mapWorkflowStats({
      total_definitions: 4,
      active_definitions: 3,
      running_instances: 2,
    })).toMatchObject({
      totalWorkflows: 4,
      activeWorkflows: 3,
      runningInstances: 2,
    });
  });
});
