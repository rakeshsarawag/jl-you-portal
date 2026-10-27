import { useState, useEffect, useCallback } from 'react';
import { API_BASE as BASE_URL, safeJson, apiHeaders, apiFetch }from '../utils/constants';
import { useUser } from '../context/UserContext';
import { WorkflowDefinition, WorkflowInstance, ApprovalRequest } from '../services/workflowEngine';
import {
  mapApproval,
  mapWorkflowDefinition,
  mapWorkflowInstance,
  mapWorkflowStats,
  serializeWorkflowDefinition,
} from '../services/workflowApiMappers';

const BASE = `${BASE_URL}/workflow`;

function apiErrorMessage(json: any, fallback: string): string {
  const error = json?.error;
  const message = typeof error === 'string' ? error : error?.message;
  const details = Array.isArray(json?.details)
    ? json.details.join(' ')
    : Array.isArray(error?.details)
      ? error.details.join(' ')
      : '';
  return [message || fallback, details].filter(Boolean).join(' — ');
}


// Extended approval shape returned by the API
export interface ApiApprovalRequest extends ApprovalRequest {
  workflow_name?: string;
  step_name?: string;
  entity_type?: string;
  entity_id?: string;
  requested_at?: string;
  context?: Record<string, unknown>;
}

export function useWorkflow() {
  const { currentUser } = useUser();
  const userEmail = currentUser?.email;
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApiApprovalRequest[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [defsRes, instsRes, appRes, statsRes] = await Promise.allSettled([
        fetch(`${BASE}/definitions`, { headers: apiHeaders(userEmail) }).then(r => safeJson(r)),
        fetch(`${BASE}/instances`, { headers: apiHeaders(userEmail) }).then(r => safeJson(r)),
        fetch(`${BASE}/approvals/my?user_id=${currentUser?.id ?? ''}`, { headers: apiHeaders(userEmail) }).then(r => safeJson(r)),
        fetch(`${BASE}/stats`, { headers: apiHeaders(userEmail) }).then(r => safeJson(r)),
      ]);

      if (defsRes.status === 'fulfilled') {
        setDefinitions((defsRes.value?.data ?? []).map(mapWorkflowDefinition));
      }
      if (instsRes.status === 'fulfilled') {
        setInstances((instsRes.value?.data ?? []).map(mapWorkflowInstance));
      }
      if (appRes.status === 'fulfilled') {
        setPendingApprovals((appRes.value?.data ?? []).map(mapApproval));
      }
      if (statsRes.status === 'fulfilled') {
        setStats(mapWorkflowStats(statsRes.value?.data ?? {}));
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, userEmail]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createDefinition = async (
    def: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt' | 'version'>
  ) => {
    const res = await apiFetch(`${BASE}/definitions`, {
      method: 'POST',
      headers: apiHeaders(userEmail),
      body: JSON.stringify(serializeWorkflowDefinition({
        ...def,
        createdBy: currentUser?.id,
      })),
    });
    const json = await safeJson(res);
    if (!res.ok || !json?.success) throw new Error(apiErrorMessage(json, 'Failed to create workflow'));
    await fetchAll();
    return json;
  };

  const updateDefinition = async (id: string, updates: Partial<WorkflowDefinition>) => {
    const res = await apiFetch(`${BASE}/definitions/${id}`, {
      method: 'PUT',
      headers: apiHeaders(userEmail),
      body: JSON.stringify(serializeWorkflowDefinition(updates)),
    });
    const json = await safeJson(res);
    if (!res.ok || !json?.success) throw new Error(apiErrorMessage(json, 'Failed to update workflow'));
    await fetchAll();
  };

  const deleteDefinition = async (id: string) => {
    const res = await apiFetch(`${BASE}/definitions/${id}`, { method: 'DELETE', headers: apiHeaders(userEmail) });
    if (!res.ok) throw new Error('Failed to archive workflow');
    await fetchAll();
  };

  const triggerWorkflow = async (
    event: string,
    entityType: string,
    entityId: string,
    context: Record<string, unknown> = {}
  ) => {
    const res = await apiFetch(`${BASE}/trigger`, {
      method: 'POST',
      headers: apiHeaders(userEmail),
      body: JSON.stringify({
        event,
        entity_type: entityType,
        entity_id: entityId,
        context,
        triggered_by: currentUser?.id,
      }),
    });
    const json = await safeJson(res);
    if (!res.ok || !json?.success) throw new Error(apiErrorMessage(json, 'Failed to trigger workflow'));
    await fetchAll();
    return json;
  };

  const startWorkflow = async (definitionId: string, context: Record<string, unknown> = {}) => {
    const res = await apiFetch(`${BASE}/instances`, {
      method: 'POST',
      headers: apiHeaders(userEmail),
      body: JSON.stringify({
        definition_id: definitionId,
        context,
        started_by: currentUser?.id,
      }),
    });
    const json = await safeJson(res);
    if (!res.ok || !json?.success) throw new Error(apiErrorMessage(json, 'Failed to start workflow'));
    await fetchAll();
    return json;
  };

  const cancelInstance = async (instanceId: string) => {
    const res = await apiFetch(`${BASE}/instances/${instanceId}/cancel`, { method: 'POST', headers: apiHeaders(userEmail) });
    if (!res.ok) throw new Error('Failed to cancel workflow');
    await fetchAll();
  };

  const respondToApproval = async (
    approvalId: string,
    status: 'approved' | 'rejected',
    comment = ''
  ) => {
    const res = await apiFetch(`${BASE}/approvals/${approvalId}/respond`, {
      method: 'POST',
      headers: apiHeaders(userEmail),
      body: JSON.stringify({ status, comment, responded_by: currentUser?.id }),
    });
    const json = await safeJson(res);
    if (!res.ok || !json?.success) throw new Error(apiErrorMessage(json, 'Failed to respond to approval'));
    await fetchAll();
  };

  return {
    definitions,
    instances,
    pendingApprovals,
    stats,
    loading,
    createDefinition,
    updateDefinition,
    deleteDefinition,
    triggerWorkflow,
    startWorkflow,
    cancelInstance,
    respondToApproval,
    refresh: fetchAll,
  };
}
