import { useState, useCallback } from 'react';
import { API_BASE, publicAnonKey, safeJson, apiHeaders } from '../utils/constants';

const PERF_URL = `${API_BASE}/performance`;

// ── Types ────────────────────────────────────────────────────────────────────

export interface CompetencyRating {
  name: string;
  rating: number;
  comments: string;
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  employeeName: string;
  reviewPeriod: string;
  reviewDate: string;
  reviewer: string;
  overallRating: number;
  competencies: CompetencyRating[];
  strengths: string[];
  areasOfImprovement: string[];
  goals: string[];
  status: 'Draft' | 'Submitted' | 'Completed' | 'Approved';
  selfAssessment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Feedback360 {
  id: string;
  employeeId: string;
  feedbackType: 'Self' | 'Manager' | 'Peer' | 'Subordinate';
  reviewer: string;
  date: string;
  ratings: {
    leadership: number;
    communication: number;
    teamwork: number;
    innovation: number;
    technical: number;
  };
  comments: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  employeeId: string;
  title: string;
  description: string;
  targetDate: string;
  progress: number;
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface PIPGoal {
  id: string;
  description: string;
  targetDate: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  notes: string;
}

export interface PIP {
  id: string;
  employeeId: string;
  employeeName: string;
  manager: string;
  startDate: string;
  endDate: string;
  reason: string;
  goals: string;
  reviewFrequency: 'Weekly' | 'Biweekly' | 'Monthly';
  status: 'Active' | 'Completed' | 'Extended' | 'Closed';
  createdAt: string;
  updatedAt: string;
}

// ── API helper ───────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options: RequestInit = {}, userEmail?: string): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: apiHeaders(userEmail),
  });
  const json = await safeJson(res);
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message ?? `Request failed: ${res.status}`);
  }
  return json?.data ?? json;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePerformanceData(userEmail?: string) {
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [feedback, setFeedback] = useState<Feedback360[]>([]);
  const [pips, setPips] = useState<PIP[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── loadAll ──────────────────────────────────────────────────────────────

  const loadAll = useCallback(async (userId?: string) => {
    setLoading(true);
    setError(null);
    const qs = userId ? `?employeeId=${encodeURIComponent(userId)}` : '';

    const [rRes, gRes, fRes, pRes] = await Promise.allSettled([
      apiFetch<PerformanceReview[]>(`${PERF_URL}/reviews${qs}`, {}, userEmail),
      apiFetch<Goal[]>(`${PERF_URL}/goals${qs}`, {}, userEmail),
      apiFetch<Feedback360[]>(`${PERF_URL}/feedback360${qs}`, {}, userEmail),
      apiFetch<PIP[]>(`${PERF_URL}/pips${qs}`, {}, userEmail),
    ]);

    if (rRes.status === 'fulfilled') setReviews(rRes.value);
    if (gRes.status === 'fulfilled') setGoals(gRes.value);
    if (fRes.status === 'fulfilled') setFeedback(fRes.value);
    if (pRes.status === 'fulfilled') setPips(pRes.value);

    const errors = [rRes, gRes, fRes, pRes]
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => (r.reason as Error).message);
    if (errors.length) setError(errors.join('; '));

    setLoading(false);
  }, []);

  // ── Reviews ──────────────────────────────────────────────────────────────

  const createReview = useCallback(async (data: Partial<PerformanceReview>) => {
    const created = await apiFetch<PerformanceReview>(`${PERF_URL}/reviews`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, userEmail);
    setReviews(prev => [created, ...prev]);
    return created;
  }, []);

  const updateReview = useCallback(async (id: string, updates: Partial<PerformanceReview>) => {
    const updated = await apiFetch<PerformanceReview>(`${PERF_URL}/reviews/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }, userEmail);
    setReviews(prev => prev.map(r => r.id === id ? updated : r));
    return updated;
  }, []);

  const deleteReview = useCallback(async (id: string) => {
    await apiFetch(`${PERF_URL}/reviews/${id}`, { method: 'DELETE' }, userEmail);
    setReviews(prev => prev.filter(r => r.id !== id));
  }, []);

  const approveReview = useCallback(async (id: string) => {
    const updated = await apiFetch<PerformanceReview>(`${PERF_URL}/reviews/${id}/approve`, {
      method: 'POST',
    }, userEmail);
    setReviews(prev => prev.map(r => r.id === id ? updated : r));
    return updated;
  }, []);

  const submitSelfAssessment = useCallback(async (id: string, assessment: string) => {
    const updated = await apiFetch<PerformanceReview>(`${PERF_URL}/reviews/${id}/self-assessment`, {
      method: 'POST',
      body: JSON.stringify({ selfAssessment: assessment }),
    }, userEmail);
    setReviews(prev => prev.map(r => r.id === id ? updated : r));
    return updated;
  }, []);

  // ── Goals ────────────────────────────────────────────────────────────────

  const createGoal = useCallback(async (data: Partial<Goal>) => {
    const created = await apiFetch<Goal>(`${PERF_URL}/goals`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, userEmail);
    setGoals(prev => [created, ...prev]);
    return created;
  }, []);

  const updateGoal = useCallback(async (id: string, updates: Partial<Goal>) => {
    const updated = await apiFetch<Goal>(`${PERF_URL}/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }, userEmail);
    setGoals(prev => prev.map(g => g.id === id ? updated : g));
    return updated;
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    await apiFetch(`${PERF_URL}/goals/${id}`, { method: 'DELETE' }, userEmail);
    setGoals(prev => prev.filter(g => g.id !== id));
  }, []);

  // ── Feedback ─────────────────────────────────────────────────────────────

  const addFeedback = useCallback(async (data: Partial<Feedback360>) => {
    const created = await apiFetch<Feedback360>(`${PERF_URL}/feedback360`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, userEmail);
    setFeedback(prev => [created, ...prev]);
    return created;
  }, []);

  // ── PIPs ─────────────────────────────────────────────────────────────────

  const createPIP = useCallback(async (data: Partial<PIP>) => {
    const created = await apiFetch<PIP>(`${PERF_URL}/pips`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, userEmail);
    setPips(prev => [created, ...prev]);
    return created;
  }, []);

  const updatePIP = useCallback(async (id: string, updates: Partial<PIP>) => {
    const updated = await apiFetch<PIP>(`${PERF_URL}/pips/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }, userEmail);
    setPips(prev => prev.map(p => p.id === id ? updated : p));
    return updated;
  }, []);

  return {
    // state
    reviews,
    goals,
    feedback,
    pips,
    loading,
    error,
    // loaders
    loadAll,
    refresh: loadAll,
    // review actions
    createReview,
    updateReview,
    deleteReview,
    approveReview,
    submitSelfAssessment,
    // goal actions
    createGoal,
    updateGoal,
    deleteGoal,
    // feedback actions
    addFeedback,
    // pip actions
    createPIP,
    updatePIP,
  };
}
