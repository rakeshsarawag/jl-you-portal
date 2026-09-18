import { useState, useEffect, useCallback } from 'react';
import { API_BASE, publicAnonKey, safeJson } from '../utils/constants';

const BASE = `${API_BASE}`;

export interface AnalyticsDataOptions {
  department?: string;
  dateRange?: string;
  startDate?: string;
  endDate?: string;
}

async function api(path: string, opts?: AnalyticsDataOptions): Promise<unknown> {
  const params = new URLSearchParams();
  if (opts?.department && opts.department !== 'All') params.set('department', opts.department);
  if (opts?.dateRange && opts.dateRange !== 'custom') params.set('dateRange', opts.dateRange);
  if (opts?.dateRange === 'custom' && opts.startDate) params.set('startDate', opts.startDate);
  if (opts?.dateRange === 'custom' && opts.endDate) params.set('endDate', opts.endDate);
  const qs = params.toString();
  const url = `${BASE}/${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return safeJson(res);
}

const ENDPOINTS: Record<string, string> = {
  payroll: 'payroll/stats',
  recruitment: 'recruitment/stats',
  onboarding: 'onboarding/stats',
  performance: 'performance/stats',
  training: 'training/stats',
  itServices: 'it-services/stats',
  directory: 'directory/stats',
  invoices: 'invoices/analytics',
  assets: 'assets/stats/all',
  okr: 'okr/stats/all',
  knowledge: 'knowledge/stats',
  projects: 'projects/stats/all',
};

export type AllStats = Record<string, unknown>;

export function useAdvancedAnalyticsData(opts?: AnalyticsDataOptions) {
  const [allStats, setAllStats] = useState<AllStats>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const keys = Object.keys(ENDPOINTS);
    const results = await Promise.allSettled(keys.map((k) => api(ENDPOINTS[k], opts)));
    const stats: AllStats = {};
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        stats[keys[i]] = result.value;
      }
    });
    setAllStats(stats);
    setLoading(false);
  }, [opts?.department, opts?.dateRange, opts?.startDate, opts?.endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { allStats, loading, refresh };
}
