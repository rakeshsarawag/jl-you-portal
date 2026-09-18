import { useState, useEffect, useCallback } from 'react';
import { publicAnonKey, API_BASE as BASE_URL, safeJson, apiHeaders } from '../utils/constants';
import { useUser } from '../context/UserContext';
import { WorkflowDefinition, WorkflowInstance, ApprovalRequest } from '../services/workflowEngine';

const BASE = `${BASE_URL}/workflow`;



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

      if (defsRes.status === 'fulfilled') setDefinitions(defsRes.value?.data ?? []);
      if (instsRes.status === 'fulfilled') setInstances(instsRes.value?.data ?? []);
      if (appRes.status === 'fulfilled') setPendingApprovals(appRes.value?.data ?? []);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value?.data ?? {});
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createDefinition = async (
    def: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt' | 'version'>
  ) => {
    const res = await fetch(`${BASE}/definitions`, {
      method: 'POST',
      headers: apiHeaders(userEmail),
      body: JSON.stringify({ ...def, createdBy: currentUser?.id }),
    });
    await fetchAll();
    return safeJson(res);
  };

  const updateDefinition = async (id: string, updates: Partial<WorkflowDefinition>) => {
    await fetch(`${BASE}/definitions/${id}`, {
      method: 'PUT',
      headers: apiHeaders(userEmail),
      body: JSON.stringify(updates),
    });
    await fetchAll();
  };

  const deleteDefinition = async (id: string) => {
    await fetch(`${BASE}/definitions/${id}`, { method: 'DELETE', headers: apiHeaders(userEmail) });
    await fetchAll();
  };

  const triggerWorkflow = async (
    event: string,
    entityType: string,
    entityId: string,
    context: Record<string, unknown> = {}
  ) => {
    const res = await fetch(`${BASE}/trigger`, {
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
    await fetchAll();
    return safeJson(res);
  };

  const startWorkflow = async (definitionId: string, context: Record<string, unknown> = {}) => {
    const res = await fetch(`${BASE}/instances`, {
      method: 'POST',
      headers: apiHeaders(userEmail),
      body: JSON.stringify({
        definition_id: definitionId,
        context,
        started_by: currentUser?.id,
      }),
    });
    await fetchAll();
    return safeJson(res);
  };

  const cancelInstance = async (instanceId: string) => {
    await fetch(`${BASE}/instances/${instanceId}/cancel`, { method: 'POST', headers: apiHeaders(userEmail) });
    await fetchAll();
  };

  const respondToApproval = async (
    approvalId: string,
    status: 'approved' | 'rejected',
    comment = ''
  ) => {
    await fetch(`${BASE}/approvals/${approvalId}/respond`, {
      method: 'POST',
      headers: apiHeaders(userEmail),
      body: JSON.stringify({ status, comment, responded_by: currentUser?.id }),
    });
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
