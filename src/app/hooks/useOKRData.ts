import { useState, useCallback } from 'react';
import { API_BASE, publicAnonKey, safeJson, apiHeaders } from '../utils/constants';

const OKR_URL = `${API_BASE}/okr`;

// ── Types ────────────────────────────────────────────────────────────────────

export interface KeyResult {
  id: string;
  okrId: string;
  title: string;
  unit: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  progress: number;
  dueDate?: string;
  is_boolean?: boolean;
  is_completed?: boolean;
}

export interface OKRUpdate {
  id: string;
  okrId: string;
  krId?: string;
  note: string;
  updatedBy: string;
  updatedAt: string;
  progressBefore: number;
  progressAfter: number;
}

export interface OKR {
  id: string;
  title: string;
  description: string;
  type: string;
  owner: string;
  ownerId: string;
  department: string;
  quarter: string;
  year: number;
  status: string;
  progress: number;
  parentId?: string;
  keyResults: KeyResult[];
  updates: OKRUpdate[];
  createdAt: string;
  updatedAt: string;
}

export interface OKRStats {
  total: number;
  onTrack: number;
  atRisk: number;
  behind: number;
  completed: number;
  avgProgress: number;
}

// ── API helper ───────────────────────────────────────────────────────────────

async function api<T>(path: string, options: RequestInit = {}, userId?: string, userEmail?: string): Promise<T> {
  const headers = { ...apiHeaders(userEmail), ...(userId ? { 'X-User-Id': userId } : {}) };
  const res = await fetch(`${OKR_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const json = await safeJson(res);
  return (json?.data ?? json) as T;
}

// ── Progress recalculation ────────────────────────────────────────────────────

function recalcOKRProgress(okr: OKR): OKR {
  if (!okr.keyResults || okr.keyResults.length === 0) return okr;
  const avg =
    okr.keyResults.reduce((sum, kr) => sum + (kr.progress ?? 0), 0) /
    okr.keyResults.length;
  return { ...okr, progress: Math.round(avg) };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useOKRData(userEmail?: string) {
  const [okrs, setOKRs] = useState<OKR[]>([]);
  const [stats, setStats] = useState<OKRStats>({
    total: 0,
    onTrack: 0,
    atRisk: 0,
    behind: 0,
    completed: 0,
    avgProgress: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async (userId?: string) => {
    setLoading(true);
    setError(null);
    const params = userId ? `?ownerId=${encodeURIComponent(userId)}` : '';
    const [okrRes, statsRes] = await Promise.allSettled([
      api<OKR[]>(`/okrs${params}`, {}, userId, userEmail),
      api<OKRStats>(`/stats${params}`, {}, userId, userEmail),
    ]);
    if (okrRes.status === 'fulfilled') {
      setOKRs(okrRes.value);
    } else {
      setError((okrRes.reason as Error)?.message ?? 'Failed to load OKRs');
    }
    if (statsRes.status === 'fulfilled') {
      setStats(statsRes.value);
    }
    setLoading(false);
  }, []);

  const createOKR = useCallback(async (data: Partial<OKR>, userId?: string): Promise<OKR> => {
    const created = await api<OKR>('/okrs', { method: 'POST', body: JSON.stringify(data) }, userId, userEmail);
    setOKRs((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateOKR = useCallback(async (id: string, data: Partial<OKR>, userId?: string): Promise<OKR> => {
    const updated = await api<OKR>(`/okrs/${id}`, { method: 'PUT', body: JSON.stringify(data) }, userId, userEmail);
    setOKRs((prev) => prev.map((o) => (o.id === id ? updated : o)));
    return updated;
  }, []);

  const deleteOKR = useCallback(async (id: string, userId?: string): Promise<void> => {
    await api<unknown>(`/okrs/${id}`, { method: 'DELETE' }, userId, userEmail);
    setOKRs((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const updateKRProgress = useCallback(
    async (okrId: string, krId: string, currentValue: number, note: string, userId?: string): Promise<OKR> => {
      const updated = await api<OKR>(
        `/okrs/${okrId}/key-results/${krId}/progress`,
        { method: 'PUT', body: JSON.stringify({ currentValue, note }) },
        userId ?? userEmail);
      const recalculated = recalcOKRProgress(updated);
      setOKRs((prev) => prev.map((o) => (o.id === okrId ? recalculated : o)));
      return recalculated;
    },
    []
  );

  const addKeyResult = useCallback(async (okrId: string, kr: Partial<KeyResult>, userId?: string): Promise<OKR> => {
    const updated = await api<OKR>(
      `/okrs/${okrId}/key-results`,
      { method: 'POST', body: JSON.stringify(kr) },
      userId ?? userEmail);
    const recalculated = recalcOKRProgress(updated);
    setOKRs((prev) => prev.map((o) => (o.id === okrId ? recalculated : o)));
    return recalculated;
  }, []);

  const deleteKeyResult = useCallback(async (okrId: string, krId: string, userId?: string): Promise<OKR> => {
    const updated = await api<OKR>(
      `/okrs/${okrId}/key-results/${krId}`,
      { method: 'DELETE' },
      userId ?? userEmail);
    const recalculated = recalcOKRProgress(updated);
    setOKRs((prev) => prev.map((o) => (o.id === okrId ? recalculated : o)));
    return recalculated;
  }, []);

  const checkIn = useCallback(async (okrId: string, note: string, userId?: string): Promise<OKR> => {
    const updated = await api<OKR>(
      `/okrs/${okrId}/checkin`,
      { method: 'POST', body: JSON.stringify({ note }) },
      userId ?? userEmail);
    setOKRs((prev) => prev.map((o) => (o.id === okrId ? updated : o)));
    return updated;
  }, []);

  return {
    okrs,
    stats,
    loading,
    error,
    loadAll,
    refresh: loadAll,
    createOKR,
    updateOKR,
    deleteOKR,
    updateKRProgress,
    addKeyResult,
    deleteKeyResult,
    checkIn,
  };
}
