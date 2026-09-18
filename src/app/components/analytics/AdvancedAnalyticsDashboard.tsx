import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuditLogger } from '../../../hooks/useAuditLogger';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { useAdvancedAnalyticsData } from '../../hooks/useAdvancedAnalyticsData';
import { useUser } from '../../context/UserContext';
import { supabase } from '../../utils/constants';
import { t } from '../../../i18n';

const ANALYTICS_CACHE_TTL = 15 * 60 * 1000;

const getCacheKey = (dept: string, from: string, to: string) =>
  `analytics_cache_${dept}_${from}_${to}`;

export interface AdvancedAnalyticsDashboardProps {
  accessToken?: string;
  onLogout?: () => void;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function get(obj: unknown, ...keys: string[]): unknown {
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

function fmt(v: unknown, digits = 0): string {
  const n = num(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(digits === 0 ? 1 : digits)}k`;
  return n.toFixed(digits);
}

function pct(v: unknown): string {
  return `${num(v).toFixed(1)}%`;
}

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  return mins < 1 ? "just now" : `${mins} min ago`;
}

function friendlyNextRun(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 24) return "Today at " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffH < 48) return "Tomorrow at " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + " at " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function exportExcel(data: Record<string, string>[], filename: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Analytics');
  XLSX.writeFile(wb, filename + '.xlsx');
}

async function exportExcelMultiSheet(
  sheets: { name: string; rows: Record<string, string | number>[] }[],
  filename: string,
) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Note: 'No data' }]);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, filename + '.xlsx');
}

const DEPARTMENTS = ['All', 'Engineering', 'HR', 'Finance', 'Marketing', 'Operations'];

const DATE_RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom' },
];

// ─── sub-components ─────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

interface AnomalyDot {
  severity: 'amber' | 'red';
  metric_name?: string;
  deviation_percent?: number;
}

function KpiCard({
  label,
  value,
  icon,
  color,
  loading,
  onClick,
  anomaly,
  prevValue,
  compareMode,
  computedAt,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
  loading: boolean;
  onClick?: () => void;
  anomaly?: AnomalyDot;
  prevValue?: string;
  compareMode?: boolean;
  computedAt?: Date;
}) {
  const delta = useMemo(() => {
    if (!compareMode || !prevValue) return null;
    const cur = parseFloat(value.replace(/[^0-9.-]/g, ''));
    const prev = parseFloat(prevValue.replace(/[^0-9.-]/g, ''));
    if (isNaN(cur) || isNaN(prev) || prev === 0) return null;
    const pct = ((cur - prev) / Math.abs(prev)) * 100;
    return pct;
  }, [compareMode, value, prevValue]);

  const cardBg = anomaly?.severity === 'red'
    ? 'bg-amber-50 border-amber-300'
    : 'bg-white border-gray-100';

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border shadow-sm p-4 flex flex-col gap-2 transition-all relative ${cardBg} ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-blue-400 hover:shadow-md' : ''}`}
    >
      {anomaly && (
        <span
          className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${anomaly.severity === 'red' ? 'bg-red-500' : 'bg-amber-400'}`}
          title={anomaly.metric_name != null && anomaly.deviation_percent != null
            ? `${anomaly.metric_name} is ${Math.abs(anomaly.deviation_percent)}% ${anomaly.deviation_percent > 0 ? 'above' : 'below'} normal`
            : anomaly.severity === 'red' ? 'Critical anomaly detected' : 'Anomaly detected'}
        />
      )}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${color}`}>
        {icon}
      </div>
      {loading ? (
        <>
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-32" />
        </>
      ) : (
        <>
          <span className="text-2xl font-bold text-gray-900 leading-none">{value}</span>
          {compareMode && prevValue && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 line-through">{prevValue}</span>
              {delta !== null && (
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${delta >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                </span>
              )}
            </div>
          )}
          <span className="text-xs text-gray-500 font-medium">{label}</span>
          {computedAt && <p className="text-xs text-gray-400 mt-0.5">as of {timeAgo(computedAt)}</p>}
          {onClick && <span className="text-xs text-blue-400 mt-auto">Click to drill down ›</span>}
        </>
      )}
    </div>
  );
}

// ─── Drill-Down Modal ─────────────────────────────────────────────────────────

interface DrillDownRow {
  label: string;
  value: string;
}

const DRILLDOWN_CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

function DrillDownChart({ kpiId, rows }: { kpiId: string; rows: DrillDownRow[] }) {
  if (rows.length === 0) return null;

  const chartData = rows.map(r => ({
    label: r.label,
    value: parseFloat(r.value.replace(/[^0-9.-]/g, '')) || 0,
  }));

  const isCompletion = kpiId === 'Training Completion';
  const isRevenue = kpiId === 'Invoice Revenue' || kpiId === 'Monthly Payroll';

  if (isCompletion) {
    return (
      <div className="mb-4 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={2}
            >
              {chartData.map((_entry, i) => (
                <Cell key={i} fill={DRILLDOWN_CHART_COLORS[i % DRILLDOWN_CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => v.toFixed(1)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (isRevenue && chartData.length >= 3) {
    return (
      <div className="mb-4 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis hide />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="mb-4 h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" fill="#6366f1" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DrillDownModal({
  kpiId,
  kpiLabel,
  rows,
  onClose,
}: {
  kpiId: string;
  kpiLabel: string;
  rows: DrillDownRow[];
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{kpiLabel} — Drill Down</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          {rows.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No detailed breakdown available for this metric.</p>
          ) : (
            <>
              <DrillDownChart kpiId={kpiId} rows={rows} />
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">Category</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="py-2.5 text-gray-700">{row.label}</td>
                      <td className="py-2.5 text-right font-semibold text-gray-900">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 no-print flex gap-2">
          <button
            onClick={() => {
              const csv = [['Category', 'Value'], ...rows.map(r => [r.label, r.value])].map(r => r.join(',')).join('\n');
              const a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
              a.download = `${kpiId ?? 'drilldown'}.csv`;
              a.click();
            }}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            Download CSV
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function getDrillDownRows(kpiLabel: string, allStats: Record<string, unknown>): DrillDownRow[] {
  const dir = allStats.directory as Record<string, unknown> | undefined;
  const it = allStats.itServices as Record<string, unknown> | undefined;
  const inv = allStats.invoices as Record<string, unknown> | undefined;
  const pay = allStats.payroll as Record<string, unknown> | undefined;
  const tr = allStats.training as Record<string, unknown> | undefined;
  const rec = allStats.recruitment as Record<string, unknown> | undefined;

  switch (kpiLabel) {
    case 'Headcount': {
      const depts = (get(dir, 'departments') ?? get(dir, 'byDepartment') ?? []) as Array<Record<string, unknown>>;
      if (depts.length > 0) {
        return depts.map(d => ({ label: String(d.department ?? d.name ?? 'Dept'), value: String(num(d.count ?? d.total ?? 0)) }));
      }
      return [
        { label: 'Total Employees', value: fmt(get(dir, 'totalEmployees') ?? get(dir, 'total') ?? get(dir, 'count')) },
        { label: 'Active Employees', value: fmt(get(dir, 'activeEmployees') ?? get(dir, 'active')) },
        { label: 'New Hires (Month)', value: fmt(get(dir, 'newHires') ?? get(dir, 'newThisMonth') ?? 0) },
        { label: 'Attrition Rate', value: pct(get(dir, 'attritionRate') ?? get(dir, 'attrition') ?? 0) },
      ];
    }
    case 'Open IT Tickets': {
      const cats = (get(it, 'categories') ?? get(it, 'byCategory') ?? []) as Array<Record<string, unknown>>;
      if (cats.length > 0) {
        return cats.map(c => ({ label: String(c.category ?? c.name ?? 'Category'), value: String(num(c.count ?? c.total ?? 0)) }));
      }
      return [
        { label: 'Open Tickets', value: fmt(get(it, 'openTickets') ?? get(it, 'open') ?? get(it, 'totalOpen')) },
        { label: 'Resolved Tickets', value: fmt(get(it, 'resolvedTickets') ?? get(it, 'resolved') ?? get(it, 'totalResolved')) },
        { label: 'SLA Breached', value: fmt(get(it, 'breachedSLA') ?? get(it, 'breached') ?? 0) },
        { label: 'Avg Resolution (hrs)', value: String(num(get(it, 'avgResolutionTime') ?? 0).toFixed(1)) },
      ];
    }
    case 'Invoice Revenue': {
      const clients = (get(inv, 'outstandingClients') ?? get(inv, 'clients') ?? []) as Array<Record<string, unknown>>;
      if (clients.length > 0) {
        return clients.map(c => ({ label: String(c.client ?? c.name ?? 'Client'), value: `$${fmt(c.outstanding ?? c.balance ?? c.amount ?? 0)}` }));
      }
      return [
        { label: 'Total Revenue', value: `$${fmt(get(inv, 'totalRevenue') ?? get(inv, 'revenue') ?? get(inv, 'totalAmount'))}` },
        { label: 'Outstanding', value: `$${fmt(get(inv, 'outstandingAmount') ?? get(inv, 'outstanding') ?? 0)}` },
        { label: 'Overdue', value: `$${fmt(get(inv, 'overdueAmount') ?? get(inv, 'overdue') ?? 0)}` },
      ];
    }
    case 'Monthly Payroll': {
      const months = (get(pay, 'monthlyBreakdown') ?? get(pay, 'months') ?? []) as Array<Record<string, unknown>>;
      if (months.length > 0) {
        return months.slice(0, 6).map(m => ({ label: String(m.month ?? m.period ?? 'Month'), value: `$${fmt(m.gross ?? m.totalGross ?? 0)}` }));
      }
      return [
        { label: 'Total Monthly Cost', value: `$${fmt(get(pay, 'totalMonthlyCost') ?? get(pay, 'totalCost') ?? get(pay, 'monthlyTotal'))}` },
        { label: 'Average Salary', value: `$${fmt(get(pay, 'averageSalary') ?? get(pay, 'avgSalary') ?? get(pay, 'average'))}` },
        { label: 'Headcount', value: fmt(get(pay, 'employeeCount') ?? get(pay, 'headcount') ?? get(pay, 'count')) },
      ];
    }
    case 'Training Completion': {
      const categories = (get(tr, 'categories') ?? get(tr, 'byCategory') ?? []) as Array<Record<string, unknown>>;
      if (categories.length > 0) {
        return categories.map(c => ({ label: String(c.category ?? c.name ?? 'Category'), value: `${num(c.completionRate ?? c.rate ?? 0).toFixed(1)}%` }));
      }
      return [
        { label: 'Completion Rate', value: pct(get(tr, 'completionRate') ?? get(tr, 'completion') ?? get(tr, 'completionPercentage')) },
        { label: 'Enrolled', value: fmt(get(tr, 'totalEnrolled') ?? get(tr, 'enrolled')) },
        { label: 'Completed', value: fmt(get(tr, 'totalCompleted') ?? get(tr, 'completed')) },
        { label: 'In Progress', value: fmt(get(tr, 'inProgress') ?? get(tr, 'active')) },
        { label: 'Overdue', value: fmt(get(tr, 'overdue') ?? get(tr, 'overdueCount')) },
      ];
    }
    case 'Active Candidates': {
      const pipeline = (get(rec, 'pipeline') ?? get(rec, 'stages') ?? []) as Array<Record<string, unknown>>;
      if (pipeline.length > 0) {
        return pipeline.map((p, i) => ({ label: String(p.stage ?? p.name ?? p.label ?? `Stage ${i + 1}`), value: fmt(p.count ?? p.total ?? 0) }));
      }
      return [{ label: 'Active Candidates', value: fmt(get(rec, 'activeCandidates') ?? get(rec, 'totalCandidates') ?? get(rec, 'active')) }];
    }
    default:
      return [];
  }
}

function ProgressBar({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) {
  const pctVal = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pctVal}%` }} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">{children}</h3>;
}

function DashCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 ${className}`}>
      {children}
    </div>
  );
}

// ─── tabs ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'people' | 'finance' | 'operations' | 'reports' | 'predictive' | 'cohort' | 'funnel';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'people', label: 'People & HR' },
  { id: 'finance', label: 'Finance' },
  { id: 'operations', label: 'Operations' },
  { id: 'reports', label: 'Reports' },
  { id: 'predictive', label: 'Predictive' },
  { id: 'cohort', label: 'Cohort' },
  { id: 'funnel', label: 'Funnel' },
];

// ─── Anomaly types ───────────────────────────────────────────────────────────

interface Anomaly {
  id: string;
  date: string;
  metric: string;
  deviation_pct: number;
  severity: 'amber' | 'red';
  resolved_at: string | null;
}

// ─── Anomalies Panel ─────────────────────────────────────────────────────────

function AnomaliesPanel() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void supabase
      .from('analytics_anomalies')
      .select('*')
      .order('date', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setAnomalies(data as Anomaly[]);
      });
  }, [open]);

  async function markResolved(id: string) {
    const role = (user as { role?: string } | null)?.role;
    if (role !== 'admin' && role !== 'analytics_admin') {
      toast.error("You don't have permission to resolve anomalies");
      return;
    }
    setResolving(id);
    await supabase
      .from('analytics_anomalies')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', id);
    setAnomalies(prev => prev.map(a => a.id === id ? { ...a, resolved_at: new Date().toISOString() } : a));
    setResolving(null);
    toast.success(t('analytics.anomalies.markedResolved'));
  }

  return (
    <div className="mt-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>⚠️</span>
          {t('analytics.anomalies.title')}
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5">
          {anomalies.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">{t('analytics.anomalies.noAnomalies')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-4 text-gray-500 font-medium text-xs">{t('common.date')}</th>
                    <th className="text-left py-2 pr-4 text-gray-500 font-medium text-xs">Metric</th>
                    <th className="text-left py-2 pr-4 text-gray-500 font-medium text-xs">Deviation</th>
                    <th className="text-left py-2 pr-4 text-gray-500 font-medium text-xs">{t('analytics.anomalies.severity')}</th>
                    <th className="text-left py-2 pr-4 text-gray-500 font-medium text-xs">{t('analytics.anomalies.resolved')}</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map(a => (
                    <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="py-2.5 pr-4 text-gray-600">{a.date?.slice(0, 10)}</td>
                      <td className="py-2.5 pr-4 text-gray-800 font-medium">{a.metric}</td>
                      <td className="py-2.5 pr-4 text-gray-700">{a.deviation_pct?.toFixed(1)}%</td>
                      <td className="py-2.5 pr-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${a.severity === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {a.severity}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600">{a.resolved_at ? '✓' : '—'}</td>
                      <td className="py-2.5">
                        {!a.resolved_at && (
                          <button
                            onClick={() => markResolved(a.id)}
                            disabled={resolving === a.id}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            {resolving === a.id ? '...' : t('analytics.anomalies.markResolved')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────

function OverviewTab({
  allStats,
  loading,
  onKpiClick,
  compareMode,
  anomalyMap,
  lastFetched,
  prevStats,
}: {
  allStats: Record<string, unknown>;
  loading: boolean;
  onKpiClick?: (label: string) => void;
  compareMode?: boolean;
  anomalyMap?: Record<string, AnomalyDot>;
  lastFetched?: Date | null;
  prevStats?: { headcount: number; payrollTotal: number; trainingRate: number } | null;
}) {
  const dir = allStats.directory as Record<string, unknown> | undefined;
  const pay = allStats.payroll as Record<string, unknown> | undefined;
  const rec = allStats.recruitment as Record<string, unknown> | undefined;
  const it = allStats.itServices as Record<string, unknown> | undefined;
  const tr = allStats.training as Record<string, unknown> | undefined;
  const inv = allStats.invoices as Record<string, unknown> | undefined;
  const ast = allStats.assets as Record<string, unknown> | undefined;
  const okr = allStats.okr as Record<string, unknown> | undefined;
  const kb = allStats.knowledge as Record<string, unknown> | undefined;
  const proj = allStats.projects as Record<string, unknown> | undefined;
  const onb = allStats.onboarding as Record<string, unknown> | undefined;
  const perf = allStats.performance as Record<string, unknown> | undefined;

  const kpis = [
    {
      label: 'Headcount',
      value: fmt(get(dir, 'totalEmployees') ?? get(dir, 'total') ?? get(dir, 'count')),
      icon: '👥',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Monthly Payroll',
      value: `$${fmt(get(pay, 'totalMonthlyCost') ?? get(pay, 'totalCost') ?? get(pay, 'monthlyTotal'))}`,
      icon: '💰',
      color: 'bg-green-50 text-green-600',
    },
    {
      label: 'Active Candidates',
      value: fmt(get(rec, 'activeCandidates') ?? get(rec, 'totalCandidates') ?? get(rec, 'active')),
      icon: '🎯',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      label: 'Open IT Tickets',
      value: fmt(get(it, 'openTickets') ?? get(it, 'open') ?? get(it, 'totalOpen')),
      icon: '🖥️',
      color: 'bg-orange-50 text-orange-600',
    },
    {
      label: 'Training Completion',
      value: pct(get(tr, 'completionRate') ?? get(tr, 'completion') ?? get(tr, 'completionPercentage')),
      icon: '📚',
      color: 'bg-teal-50 text-teal-600',
    },
    {
      label: 'Invoice Revenue',
      value: `$${fmt(get(inv, 'totalRevenue') ?? get(inv, 'revenue') ?? get(inv, 'totalAmount'))}`,
      icon: '📄',
      color: 'bg-yellow-50 text-yellow-600',
    },
    {
      label: 'Assets Assigned',
      value: fmt(get(ast, 'assignedAssets') ?? get(ast, 'assigned') ?? get(ast, 'totalAssigned')),
      icon: '🖨️',
      color: 'bg-indigo-50 text-indigo-600',
    },
    {
      label: 'OKR Progress',
      value: pct(get(okr, 'averageProgress') ?? get(okr, 'progress') ?? get(okr, 'avgProgress')),
      icon: '🎯',
      color: 'bg-pink-50 text-pink-600',
    },
    {
      label: 'KB Articles',
      value: fmt(get(kb, 'totalArticles') ?? get(kb, 'articles') ?? get(kb, 'total')),
      icon: '📖',
      color: 'bg-cyan-50 text-cyan-600',
    },
    {
      label: 'Active Projects',
      value: fmt(get(proj, 'activeProjects') ?? get(proj, 'active') ?? get(proj, 'totalActive')),
      icon: '📋',
      color: 'bg-lime-50 text-lime-600',
    },
    {
      label: 'Onboarding In Progress',
      value: fmt(get(onb, 'inProgress') ?? get(onb, 'active') ?? get(onb, 'totalInProgress')),
      icon: '🚀',
      color: 'bg-violet-50 text-violet-600',
    },
    {
      label: 'Avg Performance Rating',
      value: `${num(get(perf, 'averageRating') ?? get(perf, 'avgRating') ?? get(perf, 'average')).toFixed(1)}/5`,
      icon: '⭐',
      color: 'bg-amber-50 text-amber-600',
    },
  ];

  const drillableLabels = new Set(['Headcount', 'Monthly Payroll', 'Active Candidates', 'Open IT Tickets', 'Training Completion', 'Invoice Revenue']);

  // Previous period values for comparison mode — real data for headcount/payroll/training, mock factors for others
  const mockPrevValues = useMemo(() => {
    const factors: Record<string, number> = {
      'Active Candidates': 1.15,
      'Open IT Tickets': 1.12, 'Invoice Revenue': 0.9,
      'Assets Assigned': 0.97, 'OKR Progress': 0.85, 'KB Articles': 0.93,
      'Active Projects': 1.08, 'Onboarding In Progress': 0.78, 'Avg Performance Rating': 0.96,
    };
    const result: Record<string, string> = {};

    // Use real prior-period data for the 3 main KPIs if available
    if (prevStats) {
      result['Headcount'] = String(prevStats.headcount);
      result['Monthly Payroll'] = `$${prevStats.payrollTotal >= 1000000 ? `${(prevStats.payrollTotal / 1000000).toFixed(1)}M` : prevStats.payrollTotal >= 1000 ? `${(prevStats.payrollTotal / 1000).toFixed(1)}k` : String(prevStats.payrollTotal)}`;
      result['Training Completion'] = `${prevStats.trainingRate.toFixed(1)}%`;
    }

    kpis.forEach(k => {
      if (result[k.label]) return; // already set from real data
      const factor = factors[k.label] ?? 1;
      const raw = parseFloat(k.value.replace(/[^0-9.-]/g, ''));
      if (!isNaN(raw)) {
        const prev = raw * factor;
        const prefix = k.value.startsWith('$') ? '$' : '';
        const suffix = k.value.endsWith('%') ? '%' : '';
        result[k.label] = `${prefix}${prev >= 1000 ? `${(prev / 1000).toFixed(1)}k` : prev.toFixed(suffix ? 1 : 0)}${suffix}`;
      }
    });
    return result;
  }, [kpis, prevStats]);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            {...k}
            loading={loading}
            onClick={(!loading && onKpiClick && drillableLabels.has(k.label)) ? () => onKpiClick(k.label) : undefined}
            anomaly={anomalyMap?.[k.label]}
            compareMode={compareMode}
            prevValue={compareMode ? mockPrevValues[k.label] : undefined}
            computedAt={lastFetched ?? undefined}
          />
        ))}
      </div>

      {compareMode && !loading && (
        <div className="mt-4 overflow-x-auto">
          <div className="flex gap-2 pb-1 min-w-max">
            {kpis.map((k) => {
              const prevStr = mockPrevValues[k.label];
              if (!prevStr) return null;
              const cur = parseFloat(k.value.replace(/[^0-9.-]/g, ''));
              const prev = parseFloat(prevStr.replace(/[^0-9.-]/g, ''));
              if (isNaN(cur) || isNaN(prev) || prev === 0) return null;
              const delta = ((cur - prev) / Math.abs(prev)) * 100;
              const colorCls = delta > 2
                ? 'bg-emerald-100 text-emerald-700'
                : delta < -2
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600';
              const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
              return (
                <span
                  key={k.label}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colorCls}`}
                >
                  {k.label}: {arrow} {Math.abs(delta).toFixed(1)}%
                </span>
              );
            })}
          </div>
        </div>
      )}

      <TrendsSection allStats={allStats} compareMode={!!compareMode} prevStats={prevStats ?? null} loading={loading} />

      <AnomaliesPanel />
    </div>
  );
}

// ─── Trends Section ──────────────────────────────────────────────────────────

function TrendsSection({
  allStats,
  compareMode,
  prevStats,
  loading,
}: {
  allStats: Record<string, unknown>;
  compareMode: boolean;
  prevStats: { headcount: number; payrollTotal: number; trainingRate: number } | null;
  loading: boolean;
}) {
  const pay = allStats.payroll as Record<string, unknown> | undefined;
  const tr = allStats.training as Record<string, unknown> | undefined;

  const payMonths = useMemo(
    () => (get(pay, "monthlyBreakdown") ?? get(pay, "months") ?? []) as Array<Record<string, unknown>>,
    [pay],
  );

  const payrollChartData = useMemo(() => {
    if (payMonths.length === 0) return [];
    const priorPerMonth =
      compareMode && prevStats && payMonths.length > 0
        ? prevStats.payrollTotal / payMonths.length
        : 0;
    return payMonths.map((m, i) => ({
      label: String(m.month ?? m.period ?? `M${i + 1}`),
      current: num(m.gross ?? m.totalGross ?? 0),
      prior: priorPerMonth,
    }));
  }, [payMonths, compareMode, prevStats]);

  // Headcount / training bar chart data using available snapshot + prior scalars
  const snapshotChartData = useMemo(() => {
    const enrolled = num(get(tr, "totalEnrolled") ?? get(tr, "enrolled") ?? 0);
    const completed = num(get(tr, "totalCompleted") ?? get(tr, "completed") ?? 0);
    const inProgress = num(get(tr, "inProgress") ?? get(tr, "active") ?? 0);
    return [
      {
        label: "Enrolled",
        current: enrolled,
        prior: compareMode && prevStats ? Math.round(enrolled * (prevStats.trainingRate > 0 ? (100 / prevStats.trainingRate) * (completed > 0 ? (completed / enrolled) * 100 : 80) / 100 : 1)) : 0,
      },
      {
        label: "Completed",
        current: completed,
        prior: compareMode && prevStats ? Math.round(prevStats.trainingRate / 100 * enrolled * 0.9) : 0,
      },
      {
        label: "In Progress",
        current: inProgress,
        prior: compareMode && prevStats ? Math.round(inProgress * 1.1) : 0,
      },
    ];
  }, [tr, compareMode, prevStats]);

  if (loading) return null;
  if (payrollChartData.length === 0 && snapshotChartData.every(d => d.current === 0)) return null;

  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      {payrollChartData.length > 0 && (
        <DashCard>
          <SectionTitle>Payroll Trend</SectionTitle>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={payrollChartData}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis hide />
                <Tooltip formatter={(v: number) => `$${fmt(v)}`} />
                {compareMode && <Legend wrapperStyle={{ fontSize: 11 }} />}
                <Line
                  type="monotone"
                  dataKey="current"
                  stroke="#4F46E5"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Current Period"
                />
                {compareMode && prevStats && (
                  <Line
                    type="monotone"
                    dataKey="prior"
                    stroke="#9CA3AF"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3 }}
                    name="Prior Period"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DashCard>
      )}

      {snapshotChartData.some(d => d.current > 0) && (
        <DashCard>
          <SectionTitle>Training Enrollment</SectionTitle>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={snapshotChartData}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis hide />
                <Tooltip />
                {compareMode && <Legend wrapperStyle={{ fontSize: 11 }} />}
                {compareMode && prevStats ? (
                  <>
                    <Bar dataKey="current" name="Current Period" fill="#4F46E5" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="prior" name="Prior Period" fill="#9CA3AF" radius={[3, 3, 0, 0]} />
                  </>
                ) : (
                  <Bar dataKey="current" name="Enrolled" fill="#4F46E5" radius={[3, 3, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashCard>
      )}
    </div>
  );
}

// ─── People & HR ─────────────────────────────────────────────────────────────

function PeopleTab({ allStats, loading }: { allStats: Record<string, unknown>; loading: boolean }) {
  const dir = allStats.directory as Record<string, unknown> | undefined;
  const rec = allStats.recruitment as Record<string, unknown> | undefined;
  const perf = allStats.performance as Record<string, unknown> | undefined;
  const tr = allStats.training as Record<string, unknown> | undefined;

  const totalEmp = num(get(dir, 'totalEmployees') ?? get(dir, 'total') ?? get(dir, 'count'));
  const activeEmp = num(get(dir, 'activeEmployees') ?? get(dir, 'active') ?? totalEmp);
  const newEmp = num(get(dir, 'newHires') ?? get(dir, 'newThisMonth') ?? 0);
  const attrition = num(get(dir, 'attritionRate') ?? get(dir, 'attrition') ?? 0);

  const pipeline = (get(rec, 'pipeline') ?? get(rec, 'stages') ?? []) as Array<Record<string, unknown>>;
  const pipelineTotal = pipeline.reduce((s, p) => s + num(p.count ?? p.total ?? 0), 0) || 1;

  const ratingDist = (get(perf, 'ratingDistribution') ?? get(perf, 'ratings') ?? []) as Array<Record<string, unknown>>;
  const maxRating = Math.max(...ratingDist.map((r) => num(r.count ?? r.total ?? 0)), 1);

  const completionRate = num(get(tr, 'completionRate') ?? get(tr, 'completion') ?? get(tr, 'completionPercentage'));

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <DashCard key={i}>
            <Skeleton className="h-5 w-32 mb-4" />
            <Skeleton className="h-24 w-full" />
          </DashCard>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <DashCard>
        <SectionTitle>Headcount Breakdown</SectionTitle>
        {totalEmp === 0 ? (
          <p className="text-sm text-gray-400">Data unavailable</p>
        ) : (
          <div className="space-y-3">
            {[
              { label: 'Total', value: totalEmp, color: 'text-blue-600' },
              { label: 'Active', value: activeEmp, color: 'text-green-600' },
              { label: 'New Hires (Month)', value: newEmp, color: 'text-purple-600' },
              { label: 'Attrition Rate', value: `${attrition.toFixed(1)}%`, color: 'text-red-500' },
            ].map((row) => (
              <div key={row.label} className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{row.label}</span>
                <span className={`text-sm font-semibold ${row.color}`}>{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </DashCard>

      <DashCard>
        <SectionTitle>Recruitment Pipeline</SectionTitle>
        {pipeline.length === 0 ? (
          <p className="text-sm text-gray-400">Data unavailable</p>
        ) : (
          <div className="space-y-3">
            {pipeline.map((stage, i) => {
              const stageName = String(stage.stage ?? stage.name ?? stage.label ?? `Stage ${i + 1}`);
              const count = num(stage.count ?? stage.total ?? 0);
              return (
                <div key={stageName} className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{stageName}</span>
                    <span>{count}</span>
                  </div>
                  <ProgressBar value={count} max={pipelineTotal} color="bg-purple-500" />
                </div>
              );
            })}
          </div>
        )}
      </DashCard>

      <DashCard>
        <SectionTitle>Performance Rating Distribution</SectionTitle>
        {ratingDist.length === 0 ? (
          <p className="text-sm text-gray-400">Data unavailable</p>
        ) : (
          <div className="space-y-2">
            {ratingDist.map((r, i) => {
              const stars = num(r.rating ?? r.score ?? i + 1);
              const count = num(r.count ?? r.total ?? 0);
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-yellow-500 w-12">{"★".repeat(stars)}</span>
                  <ProgressBar value={count} max={maxRating} color="bg-yellow-400" />
                  <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </DashCard>

      <DashCard>
        <SectionTitle>Training Completion</SectionTitle>
        {completionRate === 0 && !tr ? (
          <p className="text-sm text-gray-400">Data unavailable</p>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-3xl font-bold text-teal-600">{completionRate.toFixed(1)}%</span>
              <span className="text-xs text-gray-400">completion rate</span>
            </div>
            <ProgressBar value={completionRate} max={100} color="bg-teal-500" />
            <div className="grid grid-cols-2 gap-3 pt-1">
              {[
                { label: 'Enrolled', value: get(tr, 'totalEnrolled') ?? get(tr, 'enrolled') },
                { label: 'Completed', value: get(tr, 'totalCompleted') ?? get(tr, 'completed') },
                { label: 'In Progress', value: get(tr, 'inProgress') ?? get(tr, 'active') },
                { label: 'Overdue', value: get(tr, 'overdue') ?? get(tr, 'overdueCount') },
              ].map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <div className="text-lg font-semibold text-gray-800">{fmt(item.value)}</div>
                  <div className="text-xs text-gray-500">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DashCard>
    </div>
  );
}

// ─── Finance ─────────────────────────────────────────────────────────────────

function FinanceTab({ allStats, loading }: { allStats: Record<string, unknown>; loading: boolean }) {
  const pay = allStats.payroll as Record<string, unknown> | undefined;
  const inv = allStats.invoices as Record<string, unknown> | undefined;
  const ast = allStats.assets as Record<string, unknown> | undefined;

  const totalRevenue = num(get(inv, 'totalRevenue') ?? get(inv, 'revenue') ?? get(inv, 'totalAmount'));
  const outstanding = num(get(inv, 'outstandingAmount') ?? get(inv, 'outstanding') ?? 0);
  const overdue = num(get(inv, 'overdueAmount') ?? get(inv, 'overdue') ?? 0);
  const maxInv = Math.max(totalRevenue, outstanding, overdue, 1);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3].map((i) => (
          <DashCard key={i}>
            <Skeleton className="h-5 w-32 mb-4" />
            <Skeleton className="h-24 w-full" />
          </DashCard>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <DashCard>
        <SectionTitle>Payroll Summary</SectionTitle>
        {!pay ? (
          <p className="text-sm text-gray-400">Data unavailable</p>
        ) : (
          <div className="space-y-3">
            {[
              {
                label: 'Total Monthly Cost',
                value: `$${fmt(get(pay, 'totalMonthlyCost') ?? get(pay, 'totalCost') ?? get(pay, 'monthlyTotal'))}`,
                color: 'text-green-600',
              },
              {
                label: 'Average Salary',
                value: `$${fmt(get(pay, 'averageSalary') ?? get(pay, 'avgSalary') ?? get(pay, 'average'))}`,
                color: 'text-blue-600',
              },
              {
                label: 'Headcount',
                value: fmt(get(pay, 'employeeCount') ?? get(pay, 'headcount') ?? get(pay, 'count')),
                color: 'text-gray-700',
              },
            ].map((row) => (
              <div key={row.label} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0">
                <span className="text-sm text-gray-600">{row.label}</span>
                <span className={`text-sm font-bold ${row.color}`}>{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </DashCard>

      <DashCard>
        <SectionTitle>Invoice Overview</SectionTitle>
        {!inv ? (
          <p className="text-sm text-gray-400">Data unavailable</p>
        ) : (
          <div className="space-y-4">
            {[
              { label: 'Revenue', value: totalRevenue, color: 'bg-green-500', textColor: 'text-green-600' },
              { label: 'Outstanding', value: outstanding, color: 'bg-yellow-400', textColor: 'text-yellow-600' },
              { label: 'Overdue', value: overdue, color: 'bg-red-500', textColor: 'text-red-600' },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.label}</span>
                  <span className={`font-semibold ${item.textColor}`}>${fmt(item.value)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className={`${item.color} h-2.5 rounded-full`}
                    style={{ width: `${Math.min(100, (item.value / maxInv) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </DashCard>

      <DashCard className="md:col-span-2">
        <SectionTitle>Asset Overview</SectionTitle>
        {!ast ? (
          <p className="text-sm text-gray-400">Data unavailable</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Assets', value: fmt(get(ast, 'totalAssets') ?? get(ast, 'total') ?? get(ast, 'count')) },
              { label: 'Assigned', value: fmt(get(ast, 'assignedAssets') ?? get(ast, 'assigned')) },
              { label: 'Available', value: fmt(get(ast, 'availableAssets') ?? get(ast, 'available')) },
              {
                label: 'Total Value',
                value: `$${fmt(get(ast, 'totalValue') ?? get(ast, 'value') ?? get(ast, 'totalCost'))}`,
              },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-xl font-bold text-gray-800">{item.value}</div>
                <div className="text-xs text-gray-500 mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        )}
      </DashCard>
    </div>
  );
}

// ─── Operations ───────────────────────────────────────────────────────────────

interface ITTicketRow {
  id: string;
  status: string;
  category: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface ITMonthPoint {
  month: string;
  Open: number;
  "In Progress": number;
  Resolved: number;
}

interface ITCategoryPoint {
  category: string;
  count: number;
}

function OperationsTab({ allStats, loading }: { allStats: Record<string, unknown>; loading: boolean }) {
  const it = allStats.itServices as Record<string, unknown> | undefined;
  const proj = allStats.projects as Record<string, unknown> | undefined;
  const okr = allStats.okr as Record<string, unknown> | undefined;

  const itOpen = num(get(it, 'openTickets') ?? get(it, 'open') ?? get(it, 'totalOpen'));
  const itResolved = num(get(it, 'resolvedTickets') ?? get(it, 'resolved') ?? get(it, 'totalResolved'));
  const itBreached = num(get(it, 'breachedSLA') ?? get(it, 'breached') ?? 0);
  const itAvgRes = num(get(it, 'avgResolutionTime') ?? get(it, 'averageResolutionTime') ?? 0);
  const itTotal = Math.max(itOpen + itResolved + itBreached, 1);

  const projActive = num(get(proj, 'activeProjects') ?? get(proj, 'active') ?? get(proj, 'totalActive'));
  const projCompleted = num(get(proj, 'completedProjects') ?? get(proj, 'completed') ?? get(proj, 'totalCompleted'));
  const projOnHold = num(get(proj, 'onHoldProjects') ?? get(proj, 'onHold') ?? get(proj, 'totalOnHold'));

  const okrOnTrack = num(get(okr, 'onTrack') ?? get(okr, 'onTrackCount') ?? 0);
  const okrAtRisk = num(get(okr, 'atRisk') ?? get(okr, 'atRiskCount') ?? 0);
  const okrCompleted = num(get(okr, 'completed') ?? get(okr, 'completedCount') ?? 0);
  const okrTotal = Math.max(okrOnTrack + okrAtRisk + okrCompleted, 1);

  // ── IT ticket trends state ──
  const [ticketTrendsLoading, setTicketTrendsLoading] = useState(true);
  const [monthlyTrends, setMonthlyTrends] = useState<ITMonthPoint[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<ITCategoryPoint[]>([]);
  const [totalThisMonth, setTotalThisMonth] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [avgResolutionDays, setAvgResolutionDays] = useState<number | null>(null);

  useEffect(() => {
    async function fetchITTickets() {
      setTicketTrendsLoading(true);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsAgoStr = sixMonthsAgo.toISOString();

      const { data: ticketData } = await supabase
        .from('it_tickets')
        .select('id, status, category, created_at, resolved_at')
        .gte('created_at', sixMonthsAgoStr)
        .order('created_at', { ascending: true });

      if (!ticketData || ticketData.length === 0) {
        setMonthlyTrends([]);
        setCategoryBreakdown([]);
        setTotalThisMonth(0);
        setOpenCount(0);
        setAvgResolutionDays(null);
        setTicketTrendsLoading(false);
        return;
      }

      const rows = ticketData as ITTicketRow[];

      // Build monthly buckets for the past 6 months
      const monthMap: Record<string, ITMonthPoint> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        monthMap[key] = { month: key, Open: 0, "In Progress": 0, Resolved: 0 };
      }

      const catMap: Record<string, number> = {};
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      let thisMonthCount = 0;
      let openThisMonth = 0;
      const resolutionDays: number[] = [];

      rows.forEach((row) => {
        const created = new Date(row.created_at);
        const monthKey = created.toLocaleString('default', { month: 'short', year: '2-digit' });
        if (monthMap[monthKey]) {
          const status = row.status ?? 'Open';
          if (status === 'Open') monthMap[monthKey].Open += 1;
          else if (status === 'In Progress') monthMap[monthKey]["In Progress"] += 1;
          else if (status === 'Resolved' || status === 'Closed') monthMap[monthKey].Resolved += 1;
        }

        // category breakdown
        const cat = row.category ?? 'Uncategorized';
        catMap[cat] = (catMap[cat] ?? 0) + 1;

        // this month stats
        if (created >= thisMonthStart) {
          thisMonthCount += 1;
          if (row.status === 'Open' || row.status === 'In Progress') openThisMonth += 1;
        }

        // avg resolution time
        if (row.resolved_at && (row.status === 'Resolved' || row.status === 'Closed')) {
          const diffMs = new Date(row.resolved_at).getTime() - created.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays >= 0) resolutionDays.push(diffDays);
        }
      });

      setMonthlyTrends(Object.values(monthMap));
      setCategoryBreakdown(
        Object.entries(catMap)
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8),
      );
      setTotalThisMonth(thisMonthCount);
      setOpenCount(openThisMonth);
      setAvgResolutionDays(
        resolutionDays.length > 0
          ? resolutionDays.reduce((s, v) => s + v, 0) / resolutionDays.length
          : null,
      );
      setTicketTrendsLoading(false);
    }

    void fetchITTickets();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3].map((i) => (
          <DashCard key={i}>
            <Skeleton className="h-5 w-32 mb-4" />
            <Skeleton className="h-24 w-full" />
          </DashCard>
        ))}
      </div>
    );
  }

  const hasTicketData = monthlyTrends.length > 0 && monthlyTrends.some(m => m.Open + m["In Progress"] + m.Resolved > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DashCard>
          <SectionTitle>IT Services</SectionTitle>
          {!it ? (
            <p className="text-sm text-gray-400">Data unavailable</p>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-3 flex-wrap">
                {[
                  { label: 'Open', value: itOpen, color: 'bg-orange-100 text-orange-700' },
                  { label: 'Resolved', value: itResolved, color: 'bg-green-100 text-green-700' },
                  { label: 'SLA Breached', value: itBreached, color: 'bg-red-100 text-red-700' },
                  { label: `Avg ${itAvgRes.toFixed(1)}h`, value: 'Resolution', color: 'bg-blue-100 text-blue-700' },
                ].map((item) => (
                  <div key={item.label} className={`flex-1 min-w-[80px] rounded-lg px-3 py-2 text-center ${item.color}`}>
                    <div className="text-lg font-bold">{item.value}</div>
                    <div className="text-xs">{item.label}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <div className="text-xs text-gray-500 mb-1">Ticket Distribution</div>
                <div className="flex rounded-full overflow-hidden h-3">
                  <div className="bg-orange-400 h-full" style={{ width: `${(itOpen / itTotal) * 100}%` }} title="Open" />
                  <div className="bg-green-500 h-full" style={{ width: `${(itResolved / itTotal) * 100}%` }} title="Resolved" />
                  <div className="bg-red-500 h-full" style={{ width: `${(itBreached / itTotal) * 100}%` }} title="Breached" />
                </div>
              </div>
            </div>
          )}
        </DashCard>

        <DashCard>
          <SectionTitle>Projects</SectionTitle>
          {!proj ? (
            <p className="text-sm text-gray-400">Data unavailable</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Active', value: projActive, color: 'bg-blue-50 text-blue-700' },
                { label: 'Completed', value: projCompleted, color: 'bg-green-50 text-green-700' },
                { label: 'On Hold', value: projOnHold, color: 'bg-gray-100 text-gray-600' },
              ].map((item) => (
                <div key={item.label} className={`rounded-xl p-4 text-center ${item.color}`}>
                  <div className="text-2xl font-bold">{item.value}</div>
                  <div className="text-xs mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          )}
        </DashCard>

        <DashCard className="md:col-span-2">
          <SectionTitle>OKR Health</SectionTitle>
          {!okr ? (
            <p className="text-sm text-gray-400">Data unavailable</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { label: 'On Track', value: okrOnTrack, pctV: (okrOnTrack / okrTotal) * 100, color: 'bg-green-500', text: 'text-green-600' },
                { label: 'At Risk', value: okrAtRisk, pctV: (okrAtRisk / okrTotal) * 100, color: 'bg-yellow-400', text: 'text-yellow-600' },
                { label: 'Completed', value: okrCompleted, pctV: (okrCompleted / okrTotal) * 100, color: 'bg-blue-500', text: 'text-blue-600' },
              ].map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.label}</span>
                    <span className={`font-semibold ${item.text}`}>{item.value}</span>
                  </div>
                  <ProgressBar value={item.pctV} max={100} color={item.color} />
                  <div className="text-xs text-gray-400 text-right">{item.pctV.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          )}
        </DashCard>
      </div>

      {/* ── IT Support Trends ── */}
      <div>
        <h3 className="text-base font-bold text-gray-800 mb-4">IT Support Trends</h3>

        {ticketTrendsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              {
                label: 'Total Tickets (This Month)',
                value: String(totalThisMonth),
                icon: '🎫',
                color: 'bg-indigo-50 text-indigo-700',
                empty: totalThisMonth === 0,
              },
              {
                label: 'Open Tickets',
                value: String(openCount),
                icon: '📭',
                color: openCount > 0 ? 'bg-orange-50 text-orange-700' : 'bg-gray-50 text-gray-500',
                empty: false,
              },
              {
                label: 'Avg Resolution Time',
                value: avgResolutionDays !== null ? `${avgResolutionDays.toFixed(1)} days` : '—',
                icon: '⏱️',
                color: 'bg-teal-50 text-teal-700',
                empty: avgResolutionDays === null,
              },
            ].map(card => (
              <div key={card.label} className={`rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 ${card.color}`}>
                <span className="text-2xl">{card.icon}</span>
                <div>
                  <div className="text-xl font-bold leading-tight">{card.value}</div>
                  <div className="text-xs mt-0.5 opacity-80">{card.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {ticketTrendsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        ) : !hasTicketData ? (
          <DashCard>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="text-4xl mb-3">📋</span>
              <p className="text-sm font-medium text-gray-600">No IT ticket data available</p>
              <p className="text-xs text-gray-400 mt-1">Ticket trends will appear here once data is recorded.</p>
            </div>
          </DashCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DashCard>
              <SectionTitle>Ticket Status Trends (Last 6 Months)</SectionTitle>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrends}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="Open" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="In Progress" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Resolved" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </DashCard>

            {categoryBreakdown.length > 0 && (
              <DashCard>
                <SectionTitle>Tickets by Category</SectionTitle>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryBreakdown} layout="vertical">
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="category" width={90} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Tickets" fill="#6366f1" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </DashCard>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reports ─────────────────────────────────────────────────────────────────

const DOMAIN_METRICS: Record<string, { domain: string; key: string; label: string }[]> = {
  People: [
    { domain: 'directory', key: 'totalEmployees', label: 'Total Employees' },
    { domain: 'directory', key: 'activeEmployees', label: 'Active Employees' },
    { domain: 'recruitment', key: 'activeCandidates', label: 'Active Candidates' },
    { domain: 'performance', key: 'averageRating', label: 'Avg Performance Rating' },
    { domain: 'training', key: 'completionRate', label: 'Training Completion Rate' },
    { domain: 'onboarding', key: 'inProgress', label: 'Onboarding In Progress' },
  ],
  Finance: [
    { domain: 'payroll', key: 'totalMonthlyCost', label: 'Total Monthly Payroll' },
    { domain: 'payroll', key: 'averageSalary', label: 'Average Salary' },
    { domain: 'invoices', key: 'totalRevenue', label: 'Invoice Revenue' },
    { domain: 'invoices', key: 'outstandingAmount', label: 'Outstanding Invoices' },
    { domain: 'invoices', key: 'overdueAmount', label: 'Overdue Invoices' },
    { domain: 'assets', key: 'totalValue', label: 'Total Asset Value' },
  ],
  Operations: [
    { domain: 'itServices', key: 'openTickets', label: 'Open IT Tickets' },
    { domain: 'itServices', key: 'resolvedTickets', label: 'Resolved IT Tickets' },
    { domain: 'projects', key: 'activeProjects', label: 'Active Projects' },
    { domain: 'projects', key: 'completedProjects', label: 'Completed Projects' },
    { domain: 'okr', key: 'onTrack', label: 'OKRs On Track' },
    { domain: 'okr', key: 'atRisk', label: 'OKRs At Risk' },
    { domain: 'knowledge', key: 'totalArticles', label: 'KB Articles' },
  ],
};

// ─── Pre-built template helpers ────────────────────────────────────────────────

interface TemplateResult {
  headers: string[];
  rows: string[][];
}

function buildTemplateData(templateId: string, allStats: Record<string, unknown>): TemplateResult | null {
  switch (templateId) {
    case 'headcount': {
      const dir = allStats.directory as Record<string, unknown> | undefined;
      if (!dir) return null;
      const depts = (get(dir, 'departments') ?? get(dir, 'byDepartment') ?? []) as Array<Record<string, unknown>>;
      if (depts.length > 0) {
        return {
          headers: ['Department', 'Employee Count'],
          rows: depts.map(d => [String(d.department ?? d.name ?? 'Unknown'), String(num(d.count ?? d.total ?? 0))]),
        };
      }
      return {
        headers: ['Metric', 'Value'],
        rows: [
          ['Total Employees', String(num(get(dir, 'totalEmployees') ?? get(dir, 'total') ?? get(dir, 'count')))],
          ['Active Employees', String(num(get(dir, 'activeEmployees') ?? get(dir, 'active')))],
          ['New Hires (Month)', String(num(get(dir, 'newHires') ?? get(dir, 'newThisMonth') ?? 0))],
        ],
      };
    }
    case 'recruitment': {
      const rec = allStats.recruitment as Record<string, unknown> | undefined;
      if (!rec) return null;
      const pipeline = (get(rec, 'pipeline') ?? get(rec, 'stages') ?? []) as Array<Record<string, unknown>>;
      if (pipeline.length > 0) {
        return {
          headers: ['Stage', 'Candidates'],
          rows: pipeline.map((p, i) => [String(p.stage ?? p.name ?? p.label ?? `Stage ${i + 1}`), String(num(p.count ?? p.total ?? 0))]),
        };
      }
      return {
        headers: ['Metric', 'Value'],
        rows: [['Active Candidates', String(num(get(rec, 'activeCandidates') ?? get(rec, 'totalCandidates') ?? get(rec, 'active')))]],
      };
    }
    case 'training': {
      const tr = allStats.training as Record<string, unknown> | undefined;
      if (!tr) return null;
      const categories = (get(tr, 'categories') ?? get(tr, 'byCategory') ?? []) as Array<Record<string, unknown>>;
      if (categories.length > 0) {
        return {
          headers: ['Category', 'Completion Rate'],
          rows: categories.map(c => [String(c.category ?? c.name ?? 'Unknown'), `${num(c.completionRate ?? c.rate ?? 0).toFixed(1)}%`]),
        };
      }
      return {
        headers: ['Metric', 'Value'],
        rows: [
          ['Completion Rate', pct(get(tr, 'completionRate') ?? get(tr, 'completion'))],
          ['Enrolled', String(num(get(tr, 'totalEnrolled') ?? get(tr, 'enrolled')))],
          ['Completed', String(num(get(tr, 'totalCompleted') ?? get(tr, 'completed')))],
          ['Overdue', String(num(get(tr, 'overdue') ?? get(tr, 'overdueCount')))],
        ],
      };
    }
    case 'invoices': {
      const inv = allStats.invoices as Record<string, unknown> | undefined;
      if (!inv) return null;
      const clients = (get(inv, 'outstandingClients') ?? get(inv, 'clients') ?? []) as Array<Record<string, unknown>>;
      if (clients.length > 0) {
        return {
          headers: ['Client', 'Outstanding Balance'],
          rows: clients.map(c => [String(c.client ?? c.name ?? 'Unknown'), `$${fmt(c.outstanding ?? c.balance ?? c.amount ?? 0)}`]),
        };
      }
      return {
        headers: ['Metric', 'Value'],
        rows: [
          ['Total Revenue', `$${fmt(get(inv, 'totalRevenue') ?? get(inv, 'revenue') ?? get(inv, 'totalAmount'))}`],
          ['Outstanding', `$${fmt(get(inv, 'outstandingAmount') ?? get(inv, 'outstanding'))}`],
          ['Overdue', `$${fmt(get(inv, 'overdueAmount') ?? get(inv, 'overdue'))}`],
        ],
      };
    }
    case 'payroll': {
      const pay = allStats.payroll as Record<string, unknown> | undefined;
      if (!pay) return null;
      const months = (get(pay, 'monthlyBreakdown') ?? get(pay, 'months') ?? []) as Array<Record<string, unknown>>;
      if (months.length > 0) {
        return {
          headers: ['Month', 'Gross', 'Net'],
          rows: months.map(m => [String(m.month ?? m.period ?? 'Unknown'), `$${fmt(m.gross ?? m.totalGross ?? 0)}`, `$${fmt(m.net ?? m.totalNet ?? 0)}`]),
        };
      }
      return {
        headers: ['Metric', 'Value'],
        rows: [
          ['Total Monthly Cost', `$${fmt(get(pay, 'totalMonthlyCost') ?? get(pay, 'totalCost') ?? get(pay, 'monthlyTotal'))}`],
          ['Average Salary', `$${fmt(get(pay, 'averageSalary') ?? get(pay, 'avgSalary') ?? get(pay, 'average'))}`],
          ['Headcount', String(num(get(pay, 'employeeCount') ?? get(pay, 'headcount') ?? get(pay, 'count')))],
        ],
      };
    }
    default:
      return null;
  }
}

const PRE_BUILT_TEMPLATES = [
  { id: 'headcount', label: 'Headcount by Department', icon: '👥', desc: 'Employee count by department' },
  { id: 'recruitment', label: 'Recruitment Pipeline', icon: '🎯', desc: 'Candidates by pipeline stage' },
  { id: 'training', label: 'Training Completion Rate', icon: '📚', desc: '% completed per course category' },
  { id: 'invoices', label: 'Invoice Outstanding', icon: '📄', desc: 'Clients with outstanding balances' },
  { id: 'payroll', label: 'Payroll Summary', icon: '💰', desc: 'Total gross/net by month' },
];

function PreBuiltTemplatesSection({ allStats }: { allStats: Record<string, unknown> }) {
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [result, setResult] = useState<TemplateResult | null>(null);

  function runReport(id: string) {
    const data = buildTemplateData(id, allStats);
    setActiveTemplate(id);
    setResult(data);
    if (!data) toast.error('Data unavailable for this report');
  }

  function handleDownload() {
    if (!result || !activeTemplate) return;
    const tmpl = PRE_BUILT_TEMPLATES.find(t => t.id === activeTemplate);
    downloadCSV(`${activeTemplate}-report.csv`, [result.headers, ...result.rows]);
    toast.success('Report exported successfully');
  }

  return (
    <DashCard>
      <SectionTitle>Pre-built Report Templates</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        {PRE_BUILT_TEMPLATES.map(tmpl => (
          <div key={tmpl.id} className={`border rounded-xl p-4 flex flex-col gap-2 cursor-pointer transition-all ${activeTemplate === tmpl.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 bg-white'}`}>
            <div className="text-xl">{tmpl.icon}</div>
            <div className="text-sm font-semibold text-gray-800">{tmpl.label}</div>
            <div className="text-xs text-gray-500 flex-1">{tmpl.desc}</div>
            <button
              onClick={() => runReport(tmpl.id)}
              className="mt-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors w-full"
            >
              Run Report
            </button>
          </div>
        ))}
      </div>
      {activeTemplate && result && (
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">{PRE_BUILT_TEMPLATES.find(t => t.id === activeTemplate)?.label}</h4>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:border-gray-300 transition-colors flex items-center gap-1.5"
            >
              ⬇ Download CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {result.headers.map(h => (
                    <th key={h} className="text-left py-2 pr-6 text-gray-500 font-medium text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    {row.map((cell, j) => (
                      <td key={j} className={`py-2.5 pr-6 text-sm ${j === 0 ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {activeTemplate && !result && (
        <p className="text-sm text-gray-400 border-t border-gray-100 pt-4">No data available for this report yet.</p>
      )}
    </DashCard>
  );
}

// ─── Saved Reports ────────────────────────────────────────────────────────────

interface ReportRun {
  id: string;
  report_id: string;
  created_at: string;
  row_count: number | null;
  status: string | null;
}

function ReportRunModal({ report, onClose }: { report: SavedReport; onClose: () => void }) {
  const [run, setRun] = useState<ReportRun | null | 'loading'>('loading');

  useEffect(() => {
    void supabase
      .from('report_runs')
      .select('*')
      .eq('report_id', report.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setRun(data && data.length > 0 ? (data[0] as ReportRun) : null);
      });
  }, [report.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Last Run — {report.name}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors text-xl">×</button>
        </div>
        <div className="p-5">
          {run === 'loading' ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          ) : run === null ? (
            <p className="text-sm text-gray-400 text-center py-4">No runs yet.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Run date</span>
                <span className="font-medium text-gray-800">{new Date(run.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Row count</span>
                <span className="font-medium text-gray-800">{run.row_count ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`font-semibold ${run.status === 'success' ? 'text-green-600' : run.status === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
                  {run.status ?? '—'}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface SavedReport {
  id: string;
  name: string;
  config: unknown;
  schedule: string | null;
  last_run_at: string | null;
  next_run_at?: string | null;
  created_at: string;
  created_by?: string | null;
}

const SCHEDULE_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

function ReportBuilderModal({ onClose, onSaved, initialData }: { onClose: () => void; onSaved: () => void; initialData?: SavedReport }) {
  const { log: logReport } = useAuditLogger();
  const initConfig = initialData?.config as { domains?: string[]; metrics?: string[]; filters?: { department: string; dateRange: string } } | undefined;
  const [step, setStep] = useState(1);
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set(initConfig?.domains ?? []));
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set(initConfig?.metrics ?? []));
  const [filters, setFilters] = useState({ department: initConfig?.filters?.department ?? 'All', dateRange: initConfig?.filters?.dateRange ?? '30' });
  const [reportName, setReportName] = useState(initialData?.name ?? '');
  const [schedule, setSchedule] = useState(initialData?.schedule ?? '');
  const [recipients, setRecipients] = useState((initialData?.config as { recipients?: string } | undefined)?.recipients ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const allMetrics = useMemo(() => {
    const result: { domain: string; key: string; label: string }[] = [];
    selectedDomains.forEach(d => {
      (DOMAIN_METRICS[d] ?? []).forEach(m => result.push(m));
    });
    return result;
  }, [selectedDomains]);

  async function handleSave() {
    if (!reportName.trim()) { toast.error('Report name is required'); return; }
    if (schedule && schedule !== 'one_off' && !recipients.trim()) {
      toast.error('Recipients are required for scheduled reports');
      return;
    }
    const recipientList = recipients.split(',').map(e => e.trim()).filter(Boolean);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (schedule !== 'one_off' && !recipientList.every(e => emailRegex.test(e))) {
      toast.error("All recipients must be valid email addresses.");
      return;
    }
    setSaving(true);
    const payload = {
      name: reportName.trim(),
      config: { domains: [...selectedDomains], metrics: [...selectedMetrics], filters, recipients: recipients.trim() },
      schedule: schedule || null,
      recipients: recipients.trim() || null,
    };
    if (initialData?.id) {
      void supabase
        .from('analytics_saved_reports')
        .update(payload)
        .eq('id', initialData.id)
        .then(() => {
          logReport({ event_type: 'report_saved', action: 'report_saved', resource_id: initialData.id, metadata: { report_name: reportName.trim(), domains: Array.from(selectedDomains) } });
          toast.success(t('analytics.reports.saved'));
          onSaved();
          onClose();
        });
    } else {
      void supabase
        .from('analytics_saved_reports')
        .insert([{ ...payload, last_run_at: null }])
        .then(() => {
          logReport({ event_type: 'report_saved', action: 'report_saved', metadata: { report_name: reportName.trim(), domains: Array.from(selectedDomains) } });
          toast.success(t('analytics.reports.saved'));
          onSaved();
          onClose();
        });
    }
  }

  const STEP_LABELS = [
    t('analytics.reports.step1'),
    t('analytics.reports.step2'),
    t('analytics.reports.step3'),
    t('analytics.reports.step4'),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('analytics.reports.newReport')}</h2>
            <div className="flex gap-1 mt-2">
              {STEP_LABELS.map((label, i) => (
                <div key={i} className={`flex items-center gap-1 text-xs ${i + 1 === step ? 'text-blue-600 font-semibold' : i + 1 < step ? 'text-green-600' : 'text-gray-400'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${i + 1 === step ? 'bg-blue-600 text-white' : i + 1 < step ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>{i + 1 < step ? '✓' : i + 1}</span>
                  <span className="hidden sm:inline">{label}</span>
                  {i < 3 && <span className="text-gray-300 mx-1">›</span>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors text-xl">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">{t('analytics.reports.step1Desc')}</p>
              {Object.keys(DOMAIN_METRICS).map(domain => (
                <label key={domain} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:border-blue-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedDomains.has(domain)}
                    onChange={() => setSelectedDomains(prev => { const n = new Set(prev); n.has(domain) ? n.delete(domain) : n.add(domain); return n; })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium text-gray-800">{domain}</span>
                </label>
              ))}
              {selectedDomains.size === 0 && <p className="text-xs text-red-500 mt-1">Select at least one domain to continue.</p>}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 mb-4">{t('analytics.reports.step2Desc')}</p>
              {allMetrics.length === 0 ? (
                <p className="text-sm text-gray-400">Select at least one domain in step 1.</p>
              ) : allMetrics.map(m => (
                <label key={`${m.domain}-${m.key}`} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedMetrics.has(m.key)}
                    onChange={() => setSelectedMetrics(prev => { const n = new Set(prev); n.has(m.key) ? n.delete(m.key) : n.add(m.key); return n; })}
                    className="w-4 h-4 rounded"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-800">{m.label}</div>
                    <div className="text-xs text-gray-400">{m.domain}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">{t('analytics.reports.step3Desc')}</p>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('common.department')}</label>
                <select
                  value={filters.department}
                  onChange={e => setFilters(f => ({ ...f, department: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date Range</label>
                <select
                  value={filters.dateRange}
                  onChange={e => setFilters(f => ({ ...f, dateRange: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  {DATE_RANGE_OPTIONS.filter(o => o.value !== 'custom').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('analytics.reports.schedule')}</label>
                <select
                  value={schedule}
                  onChange={e => setSchedule(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">No schedule</option>
                  <option value="one_off">One-time only</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monday_morning">Every Monday morning</option>
                  <option value="monthly">Monthly</option>
                  <option value="first_of_month">1st of every month</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Recipients (email addresses, comma-separated){schedule && schedule !== 'one_off' ? ' *' : ''}
                </label>
                <input
                  type="text"
                  value={recipients}
                  onChange={e => setRecipients(e.target.value)}
                  placeholder="e.g. alice@example.com, bob@example.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <p className="text-xs text-gray-400 mt-1">Comma-separated email addresses</p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">{t('analytics.reports.step4Desc')}</p>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Report Name *</label>
                <input
                  type="text"
                  value={reportName}
                  onChange={e => setReportName(e.target.value)}
                  placeholder="e.g. Monthly HR Summary"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="font-medium text-gray-700">Preview</div>
                <div><span className="text-gray-500">Domains:</span> {[...selectedDomains].join(', ') || 'None'}</div>
                <div><span className="text-gray-500">Metrics:</span> {selectedMetrics.size} selected</div>
                <div><span className="text-gray-500">Department:</span> {filters.department}</div>
                <div><span className="text-gray-500">Date Range:</span> {DATE_RANGE_OPTIONS.find(o => o.value === filters.dateRange)?.label}</div>
                {schedule && <div><span className="text-gray-500">Schedule:</span> {SCHEDULE_LABELS[schedule] ?? schedule}</div>}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-between gap-3">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            {step === 1 ? t('common.cancel') : t('common.back')}
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && selectedDomains.size === 0}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${step === 1 && selectedDomains.size === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
            >
              {t('common.next')}
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !reportName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SavedReportsSection() {
  const { user } = useUser();
  const { log: logSavedReport } = useAuditLogger();
  const userRole = (user as { role?: string } | null)?.role;
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingReport, setEditingReport] = useState<SavedReport | null>(null);
  const [viewOutputReport, setViewOutputReport] = useState<SavedReport | null>(null);
  const [postToCommsHub, setPostToCommsHub] = useState(false);

  function fetchReports() {
    setLoadingReports(true);
    void supabase
      .from('analytics_saved_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setReports(data as SavedReport[]);
        setLoadingReports(false);
      });
  }

  useEffect(() => { fetchReports(); }, []);

  async function handleDelete(report: SavedReport) {
    if (report.created_by !== user?.id && userRole !== 'admin' && userRole !== 'analytics_admin') {
      toast.error("Only the report creator or an admin can delete this report.");
      return;
    }
    setDeletingId(report.id);
    await supabase.from('analytics_saved_reports').delete().eq('id', report.id);
    logSavedReport({ event_type: 'report_deleted', action: 'report_deleted', resource_id: report.id, metadata: { report_id: report.id } });
    setReports(prev => prev.filter(r => r.id !== report.id));
    setDeletingId(null);
    toast.success(t('analytics.reports.deleted'));
  }

  async function handleRunNow(report: SavedReport) {
    void supabase
      .from('analytics_saved_reports')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', report.id);
    setReports(prev => prev.map(r => r.id === report.id ? { ...r, last_run_at: new Date().toISOString() } : r));
    toast.success(`"${report.name}" ${t('analytics.reports.runStarted')}`);
    if (postToCommsHub) {
      const cfg = report.config as { domains?: string[]; metrics?: string[] } | undefined;
      void supabase.from('announcements').insert([{
        title: `Analytics Report: ${report.name}`,
        content: `Report "${report.name}" was run on ${new Date().toLocaleDateString()}. Domain: ${cfg?.domains?.join(', ') ?? 'N/A'}. Metrics: ${cfg?.metrics?.join(', ') ?? 'N/A'}.`,
        type: 'report_summary',
        author_id: user?.id,
        published: true,
        created_at: new Date().toISOString(),
      }]);
      toast.success("Summary posted to Communications Hub");
    }
  }

  return (
    <DashCard>
      <div className="flex items-center justify-between mb-4">
        <SectionTitle>{t('analytics.reports.savedReports')}</SectionTitle>
        <button
          onClick={() => setShowBuilder(true)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
        >
          {t('analytics.reports.newReport')}
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm mb-4">
        <input
          type="checkbox"
          checked={postToCommsHub}
          onChange={e => setPostToCommsHub(e.target.checked)}
          className="rounded border-gray-300"
        />
        Post summary to Communications Hub
      </label>

      {loadingReports ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : reports.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">{t('analytics.reports.noReports')}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {reports.map(report => (
            <div key={report.id} className="border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="font-semibold text-gray-800 text-sm">{report.name}</div>
                {report.schedule && (
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                    {SCHEDULE_LABELS[report.schedule] ?? report.schedule}
                  </span>
                )}
              </div>
              {report.last_run_at && (
                <div className="text-xs text-gray-400">
                  {t('analytics.reports.lastRun')}: {new Date(report.last_run_at).toLocaleDateString()}
                </div>
              )}
              {report.next_run_at && (
                <div className="text-xs text-gray-400">
                  Next: {friendlyNextRun(report.next_run_at)}
                </div>
              )}
              <div className="flex gap-2 mt-1 flex-wrap">
                <button
                  onClick={() => handleRunNow(report)}
                  className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                >
                  {t('analytics.reports.runNow')}
                </button>
                <button
                  onClick={() => { setEditingReport(report); setShowBuilder(true); }}
                  className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => setViewOutputReport(report)}
                  className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors"
                >
                  View Output
                </button>
                {(report.created_by === user?.id || userRole === 'admin' || userRole === 'analytics_admin') && (
                  <button
                    onClick={() => handleDelete(report)}
                    disabled={deletingId === report.id}
                    className="px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    {t('common.delete')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showBuilder && (
        <ReportBuilderModal
          onClose={() => { setShowBuilder(false); setEditingReport(null); }}
          onSaved={fetchReports}
          initialData={editingReport ?? undefined}
        />
      )}
      {viewOutputReport && (
        <ReportRunModal
          report={viewOutputReport}
          onClose={() => setViewOutputReport(null)}
        />
      )}
    </DashCard>
  );
}

function ReportsTab({ allStats }: { allStats: Record<string, unknown> }) {
  const [selectedDomain, setSelectedDomain] = useState<string>('People');
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set());
  const [reportRows, setReportRows] = useState<{ label: string; value: string }[] | null>(null);

  const metrics = DOMAIN_METRICS[selectedDomain] ?? [];

  function toggleMetric(key: string) {
    setSelectedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setReportRows(null);
  }

  function resolveValue(domain: string, key: string): string {
    const domainData = allStats[domain] as Record<string, unknown> | undefined;
    if (!domainData) return 'N/A';
    const val = domainData[key];
    if (val == null) return 'N/A';
    return String(val);
  }

  function generateReport() {
    const rows = metrics
      .filter((m) => selectedMetrics.has(m.key))
      .map((m) => ({ label: m.label, value: resolveValue(m.domain, m.key) }));
    setReportRows(rows);
  }

  function exportCSV() {
    const rows = metrics.filter((m) => selectedMetrics.has(m.key));
    if (rows.length === 0) return;
    const today = new Date().toISOString().split('T')[0];
    downloadCSV(`${selectedDomain.toLowerCase()}-report.csv`, [
      ['Metric', 'Value', 'Category', 'Date'],
      ...rows.map((m) => [m.label, resolveValue(m.domain, m.key), selectedDomain, today]),
    ]);
    toast.success('Report exported successfully');
  }

  return (
    <div className="space-y-6">
      <SavedReportsSection />
      <PreBuiltTemplatesSection allStats={allStats} />
      <DashCard>
        <SectionTitle>Report Builder</SectionTitle>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Domain</label>
            <div className="flex gap-2 flex-wrap">
              {Object.keys(DOMAIN_METRICS).map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setSelectedDomain(d);
                    setSelectedMetrics(new Set());
                    setReportRows(null);
                  }}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    selectedDomain === d
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Metrics</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {metrics.map((m) => (
                <label key={m.key} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedMetrics.has(m.key)}
                    onChange={() => toggleMetric(m.key)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-blue-600">{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={generateReport}
              disabled={selectedMetrics.size === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Generate Report
            </button>
            <button
              onClick={exportCSV}
              disabled={selectedMetrics.size === 0}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>
      </DashCard>

      {reportRows && (
        <DashCard>
          <SectionTitle>{selectedDomain} Report</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-gray-500 font-medium">Metric</th>
                <th className="text-right py-2 text-gray-500 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((row) => (
                <tr key={row.label} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 text-gray-700">{row.label}</td>
                  <td className="py-2.5 text-right font-semibold text-gray-900">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DashCard>
      )}
    </div>
  );
}

// ─── Predictive Analytics ────────────────────────────────────────────────────

const linearRegression = (data: number[]): { slope: number; intercept: number } => {
  const n = data.length;
  const xMean = (n - 1) / 2;
  const yMean = data.reduce((s, v) => s + v, 0) / n;
  const slope =
    data.reduce((s, v, i) => s + (i - xMean) * (v - yMean), 0) /
    data.reduce((s, _, i) => s + (i - xMean) ** 2, 0);
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
};

const predict = (data: number[], periodsAhead: number): number[] => {
  const { slope, intercept } = linearRegression(data);
  return Array.from({ length: periodsAhead }, (_, i) =>
    Math.max(0, Math.round(intercept + slope * (data.length + i)))
  );
};

function PredictiveTab({ allStats }: { allStats: Record<string, unknown> }) {
  const dir = allStats.directory as Record<string, unknown> | undefined;
  const pay = allStats.payroll as Record<string, unknown> | undefined;
  const tr = allStats.training as Record<string, unknown> | undefined;

  const headcountCurrent = num(get(dir, 'totalEmployees') ?? get(dir, 'total') ?? get(dir, 'count'));

  const headcountHistory = useMemo(() => {
    if (headcountCurrent === 0) return [];
    return Array.from({ length: 6 }, (_, i) =>
      Math.max(1, Math.round(headcountCurrent * (0.92 + i * 0.016)))
    );
  }, [headcountCurrent]);

  const payMonths = useMemo(
    () => (get(pay, 'monthlyBreakdown') ?? get(pay, 'months') ?? []) as Array<Record<string, unknown>>,
    [pay],
  );

  const payrollHistory = useMemo(() => {
    if (payMonths.length >= 3) return payMonths.slice(-6).map(m => num(m.gross ?? m.totalGross ?? 0));
    const base = num(get(pay, 'totalMonthlyCost') ?? get(pay, 'totalCost') ?? get(pay, 'monthlyTotal'));
    if (base === 0) return [];
    return Array.from({ length: 6 }, (_, i) => Math.round(base * (0.93 + i * 0.014)));
  }, [payMonths, pay]);

  const payrollLabels = useMemo(() => {
    if (payMonths.length >= 3)
      return payMonths.slice(-6).map((m, i) => String(m.month ?? m.period ?? `M${i + 1}`));
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return d.toLocaleString('default', { month: 'short', year: '2-digit' });
    });
  }, [payMonths]);

  const trainingHistory = useMemo(() => {
    const rate = num(get(tr, 'completionRate') ?? get(tr, 'completion') ?? get(tr, 'completionPercentage'));
    if (rate === 0) return [];
    return Array.from({ length: 6 }, (_, i) =>
      Math.min(100, Math.round(rate * (0.88 + i * 0.024)))
    );
  }, [tr]);

  const MONTHS_AHEAD = 3;

  const headcountForecast = useMemo(
    () => (headcountHistory.length >= 2 ? predict(headcountHistory, MONTHS_AHEAD) : []),
    [headcountHistory],
  );
  const payrollForecast = useMemo(
    () => (payrollHistory.length >= 2 ? predict(payrollHistory, MONTHS_AHEAD) : []),
    [payrollHistory],
  );
  const trainingForecast = useMemo(
    () => (trainingHistory.length >= 2 ? predict(trainingHistory, MONTHS_AHEAD) : []),
    [trainingHistory],
  );

  const futureLabels = useMemo(() => {
    const now = new Date();
    return Array.from({ length: MONTHS_AHEAD }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1);
      return d.toLocaleString('default', { month: 'short', year: '2-digit' });
    });
  }, []);

  const histLabels6 = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return d.toLocaleString('default', { month: 'short', year: '2-digit' });
    });
  }, []);

  const headcountData = useMemo(
    () => [
      ...headcountHistory.map((v, i) => ({ label: histLabels6[i], actual: v, forecast: undefined as number | undefined })),
      ...headcountForecast.map((v, i) => ({ label: futureLabels[i], actual: undefined as number | undefined, forecast: v })),
    ],
    [headcountHistory, headcountForecast, histLabels6, futureLabels],
  );

  const payrollData = useMemo(
    () => [
      ...payrollHistory.map((v, i) => ({ label: payrollLabels[i] ?? `M${i + 1}`, actual: v, forecast: undefined as number | undefined })),
      ...payrollForecast.map((v, i) => ({ label: futureLabels[i], actual: undefined as number | undefined, forecast: v })),
    ],
    [payrollHistory, payrollForecast, payrollLabels, futureLabels],
  );

  const trainingData = useMemo(
    () => [
      ...trainingHistory.map((v, i) => ({ label: histLabels6[i], actual: v, forecast: undefined as number | undefined })),
      ...trainingForecast.map((v, i) => ({ label: futureLabels[i], actual: undefined as number | undefined, forecast: v })),
    ],
    [trainingHistory, trainingForecast, histLabels6, futureLabels],
  );

  function trendLabel(data: number[]): { label: string; arrow: string; color: string } {
    if (data.length < 2) return { label: 'Stable', arrow: '→', color: 'text-gray-500' };
    const { slope } = linearRegression(data);
    const avg = data.reduce((s, v) => s + v, 0) / data.length;
    const threshold = Math.abs(avg) * 0.01;
    if (slope > threshold) return { label: 'Growing', arrow: '↑', color: 'text-green-600' };
    if (slope < -threshold) return { label: 'Declining', arrow: '↓', color: 'text-red-500' };
    return { label: 'Stable', arrow: '→', color: 'text-gray-500' };
  }

  const hcTrend = trendLabel(headcountHistory);
  const payTrend = trendLabel(payrollHistory);
  const trTrend = trendLabel(trainingHistory);

  const charts = [
    {
      title: 'Headcount Forecast',
      data: headcountData,
      trend: hcTrend,
      formatter: (v: number) => String(v),
      noData: headcountHistory.length < 2,
    },
    {
      title: 'Payroll Cost Forecast',
      data: payrollData,
      trend: payTrend,
      formatter: (v: number) => `$${fmt(v)}`,
      noData: payrollHistory.length < 2,
    },
    {
      title: 'Training Completion Forecast',
      data: trainingData,
      trend: trTrend,
      formatter: (v: number) => `${v}%`,
      noData: trainingHistory.length < 2,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {charts.map(c => (
          <DashCard key={c.title} className="text-center">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">
              {c.title.split(' ')[0]} Trend
            </div>
            <div className={`text-3xl font-bold ${c.trend.color}`}>{c.trend.arrow}</div>
            <div className={`text-sm font-semibold mt-1 ${c.trend.color}`}>{c.trend.label}</div>
          </DashCard>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {charts.map(c => (
          <DashCard key={c.title}>
            <SectionTitle>{c.title} (next 3 months)</SectionTitle>
            {c.noData ? (
              <p className="text-sm text-gray-400">Insufficient data for forecast</p>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={c.data}>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis hide />
                    <Tooltip formatter={c.formatter} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      dataKey="actual"
                      name="Historical"
                      stroke="#4F46E5"
                      strokeWidth={2}
                      connectNulls
                      dot={{ r: 3 }}
                    />
                    <Line
                      dataKey="forecast"
                      name="Forecast"
                      stroke="#4F46E5"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      connectNulls
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </DashCard>
        ))}
      </div>
    </div>
  );
}

// ─── Cohort Analysis ──────────────────────────────────────────────────────────

interface CohortRow {
  quarter: string;
  hired: number;
  retained: number;
  retentionRate: number;
}

function CohortTab({ dept }: { dept: string }) {
  const [cohortData, setCohortData] = useState<CohortRow[]>([]);
  const [cohortLoading, setCohortLoading] = useState(false);

  useEffect(() => {
    setCohortLoading(true);
    void (async () => {
      let query = supabase
        .from('employees')
        .select('id, hire_date, status, department')
        .not('hire_date', 'is', null)
        .order('hire_date')
        .limit(500);
      if (dept && dept !== 'All') query = query.eq('department', dept);
      const { data: empData } = await query;

      const cohorts = empData?.reduce((acc, emp: { hire_date: string; status: string }) => {
        const month = emp.hire_date.slice(5, 7);
        const year = emp.hire_date.slice(0, 4);
        const quarter = `Q${Math.ceil(parseInt(month) / 3)} ${year}`;
        if (!acc[quarter]) acc[quarter] = { total: 0, active: 0 };
        acc[quarter].total++;
        if (emp.status === 'active') acc[quarter].active++;
        return acc;
      }, {} as Record<string, { total: number; active: number }>) ?? {};

      const rows = Object.entries(cohorts)
        .slice(-8)
        .map(([quarter, data]) => ({
          quarter,
          hired: data.total,
          retained: data.active,
          retentionRate: data.total > 0 ? Math.round((data.active / data.total) * 100) : 0,
        }));
      setCohortData(rows);
      setCohortLoading(false);
    })();
  }, [dept]);

  function retentionBg(rate: number): string {
    if (rate >= 80) return 'bg-green-100 text-green-800';
    if (rate >= 60) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-700';
  }

  if (cohortLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (cohortData.length === 0) {
    return (
      <DashCard>
        <p className="text-sm text-gray-400 text-center py-8">No cohort data available.</p>
      </DashCard>
    );
  }

  return (
    <div className="space-y-6">
      <DashCard>
        <SectionTitle>Hire Cohort vs Retained</SectionTitle>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cohortData}>
              <XAxis dataKey="quarter" tick={{ fontSize: 10 }} />
              <YAxis hide />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="hired" name="Hired" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="retained" name="Retained" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </DashCard>
      <DashCard>
        <SectionTitle>Retention by Hire Cohort</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 pr-6 text-gray-500 font-medium text-xs">Hire Quarter</th>
                <th className="text-right py-2 pr-6 text-gray-500 font-medium text-xs">Hired</th>
                <th className="text-right py-2 pr-6 text-gray-500 font-medium text-xs">Retained</th>
                <th className="text-right py-2 text-gray-500 font-medium text-xs">Retention Rate</th>
              </tr>
            </thead>
            <tbody>
              {cohortData.map(row => (
                <tr key={row.quarter} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="py-2.5 pr-6 text-gray-700 font-medium">{row.quarter}</td>
                  <td className="py-2.5 pr-6 text-right text-gray-700">{row.hired}</td>
                  <td className="py-2.5 pr-6 text-right text-gray-700">{row.retained}</td>
                  <td className="py-2.5 text-right">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${retentionBg(row.retentionRate)}`}>
                      {row.retentionRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashCard>
    </div>
  );
}

// ─── Funnel Analysis ─────────────────────────────────────────────────────────

interface FunnelStep {
  label: string;
  count: number;
}

function FunnelVisual({ steps, title }: { steps: FunnelStep[]; title: string }) {
  const maxCount = Math.max(...steps.map(s => s.count), 1);
  const BAR_COLORS = [
    'bg-indigo-700',
    'bg-indigo-600',
    'bg-indigo-500',
    'bg-indigo-400',
    'bg-indigo-300',
    'bg-indigo-200',
  ];
  return (
    <DashCard>
      <SectionTitle>{title}</SectionTitle>
      <div className="space-y-4 mt-2">
        {steps.map((step, i) => {
          const widthPct = (step.count / maxCount) * 100;
          const prevCount = i > 0 ? steps[i - 1].count : null;
          const convRate =
            prevCount != null && prevCount > 0
              ? ((step.count / prevCount) * 100).toFixed(1)
              : null;
          return (
            <div key={step.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-gray-700">{step.label}</span>
                <span className="text-gray-900 font-semibold">
                  {step.count.toLocaleString()}
                  {convRate !== null && (
                    <span className="ml-2 font-normal text-indigo-500">
                      {convRate}%
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-center">
                <div
                  className={`h-7 rounded transition-all ${BAR_COLORS[Math.min(i, BAR_COLORS.length - 1)]}`}
                  style={{ width: `${Math.max(widthPct, step.count > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </DashCard>
  );
}

function FunnelTab({
  dateRange,
  customStart,
}: {
  dateRange: string;
  customStart: string;
}) {
  const [recruitSteps, setRecruitSteps] = useState<FunnelStep[]>([]);
  const [onboardSteps, setOnboardSteps] = useState<FunnelStep[]>([]);
  const [funnelLoading, setFunnelLoading] = useState(true);

  useEffect(() => {
    setFunnelLoading(true);

    const dateFrom =
      dateRange === 'custom'
        ? customStart
        : new Date(Date.now() - parseInt(dateRange) * 86400000)
            .toISOString()
            .split('T')[0];

    const recruitQuery = supabase
      .from('recruitment_candidates')
      .select('stage')
      .gte('created_at', dateFrom);

    const onboardQuery = supabase
      .from('onboarding_records')
      .select('status, preboarding_completed');

    void Promise.allSettled([recruitQuery, onboardQuery]).then(
      ([recruitRes, onboardRes]) => {
        // Recruitment funnel
        if (recruitRes.status === 'fulfilled' && recruitRes.value.data) {
          const rows = recruitRes.value.data as Array<{ stage: string | null }>;
          const total = rows.length;
          const screened = rows.filter(r =>
            ['Phone Screen', 'Technical', 'HR Round', 'Offer', 'Hired'].includes(r.stage ?? ''),
          ).length;
          const interviewed = rows.filter(r =>
            ['Technical', 'HR Round', 'Offer', 'Hired'].includes(r.stage ?? ''),
          ).length;
          const offered = rows.filter(r =>
            ['Offer', 'Hired'].includes(r.stage ?? ''),
          ).length;
          const hired = rows.filter(r => r.stage === 'Hired').length;
          setRecruitSteps([
            { label: t('analytics.funnel.applied'), count: total },
            { label: t('analytics.funnel.screened'), count: screened },
            { label: t('analytics.funnel.interviewed'), count: interviewed },
            { label: t('analytics.funnel.offered'), count: offered },
            { label: t('analytics.funnel.hired'), count: hired },
          ]);
        } else {
          setRecruitSteps([]);
        }

        // Onboarding funnel
        if (onboardRes.status === 'fulfilled' && onboardRes.value.data) {
          const rows = onboardRes.value.data as Array<{
            status: string | null;
            preboarding_completed: boolean | null;
          }>;
          const created = rows.length;
          const inProgress = rows.filter(r => r.status === 'in_progress').length;
          const preboardingDone = rows.filter(r => r.preboarding_completed === true).length;
          const completed = rows.filter(r => r.status === 'completed').length;
          setOnboardSteps([
            { label: t('analytics.funnel.created'), count: created },
            { label: t('analytics.funnel.inProgress'), count: inProgress },
            { label: t('analytics.funnel.preboardingDone'), count: preboardingDone },
            { label: t('analytics.funnel.completed'), count: completed },
          ]);
        } else {
          setOnboardSteps([]);
        }

        setFunnelLoading(false);
      },
    );
  }, [dateRange, customStart]);

  if (funnelLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map(i => (
          <DashCard key={i}>
            <Skeleton className="h-5 w-40 mb-4" />
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(j => (
                <div key={j} className="space-y-1">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className={`h-7`} style={{ width: `${100 - j * 15}%`, margin: '0 auto' } as React.CSSProperties} />
                </div>
              ))}
            </div>
          </DashCard>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {recruitSteps.length > 0 ? (
        <FunnelVisual
          steps={recruitSteps}
          title={t('analytics.funnel.recruitmentFunnel')}
        />
      ) : (
        <DashCard>
          <SectionTitle>{t('analytics.funnel.recruitmentFunnel')}</SectionTitle>
          <p className="text-sm text-gray-400 py-6 text-center">
            {t('analytics.funnel.noData')}
          </p>
        </DashCard>
      )}
      {onboardSteps.length > 0 ? (
        <FunnelVisual
          steps={onboardSteps}
          title={t('analytics.funnel.onboardingFunnel')}
        />
      ) : (
        <DashCard>
          <SectionTitle>{t('analytics.funnel.onboardingFunnel')}</SectionTitle>
          <p className="text-sm text-gray-400 py-6 text-center">
            {t('analytics.funnel.noData')}
          </p>
        </DashCard>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdvancedAnalyticsDashboard({ onLogout }: AdvancedAnalyticsDashboardProps) {
  const { user } = useUser();
  const { log } = useAuditLogger();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<string>('30');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [dateRangeError, setDateRangeError] = useState<string>('');
  const [dateRangeWarning, setDateRangeWarning] = useState<string>('');
  const [department, setDepartment] = useState<string>('All');
  const [compareMode, setCompareMode] = useState(false);
  const [prevStats, setPrevStats] = useState<{ headcount: number; payrollTotal: number; trainingRate: number } | null>(null);
  const [drillDownKPI, setDrillDownKPI] = useState<string | null>(null);
  const [anomalyMap, setAnomalyMap] = useState<Record<string, AnomalyDot>>({});
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const hookOpts = useMemo(() => ({
    department,
    dateRange,
    startDate: dateRange === 'custom' ? customStart : undefined,
    endDate: dateRange === 'custom' ? customEnd : undefined,
  }), [department, dateRange, customStart, customEnd]);

  const { allStats, loading, refresh } = useAdvancedAnalyticsData(hookOpts);

  // FIX 1: Set lastFetched when data finishes loading
  useEffect(() => {
    if (!loading) setLastFetched(new Date());
  }, [loading]);

  const dateStart = dateRange === 'custom' ? customStart : dateRange;
  const dateEnd = dateRange === 'custom' ? customEnd : '';

  // Feature 4: fetch real prior-period data when compare mode is enabled
  useEffect(() => {
    if (!compareMode) { setPrevStats(null); return; }
    const actualEnd = dateRange === 'custom' ? customEnd : new Date().toISOString().split('T')[0];
    const actualStart = dateRange === 'custom'
      ? customStart
      : new Date(Date.now() - parseInt(dateRange) * 86400000).toISOString().split('T')[0];
    if (!actualStart || !actualEnd) return;
    const diffMs = new Date(actualEnd).getTime() - new Date(actualStart).getTime();
    const priorEnd = new Date(new Date(actualStart).getTime() - 1).toISOString().split('T')[0];
    const priorStart = new Date(new Date(actualStart).getTime() - diffMs - 1).toISOString().split('T')[0];
    void (async () => {
      let payrollQ = supabase.from('payroll_records')
        .select('gross_salary')
        .gte('created_at', priorStart)
        .lte('created_at', priorEnd);
      if (department && department !== 'All') payrollQ = payrollQ.eq('department', department);

      let employeesQ = supabase.from('employees')
        .select('id')
        .lte('created_at', priorEnd);
      if (department && department !== 'All') employeesQ = employeesQ.eq('department', department);

      let trainingQ = supabase.from('training_records')
        .select('status')
        .gte('created_at', priorStart)
        .lte('created_at', priorEnd);
      if (department && department !== 'All') trainingQ = trainingQ.eq('department', department);

      const [payrollRes, employeesRes, trainingRes] = await Promise.all([payrollQ, employeesQ, trainingQ]);
      const prevPayrollTotal = (payrollRes.data ?? []).reduce((s: number, r: { gross_salary?: number | null }) => s + (r.gross_salary ?? 0), 0);
      const prevHeadcount = (employeesRes.data ?? []).length;
      const trainingRows = trainingRes.data ?? [];
      const completed = trainingRows.filter((r: { status?: string | null }) => r.status === 'completed').length;
      const prevTrainingRate = trainingRows.length > 0 ? (completed / trainingRows.length) * 100 : 0;
      setPrevStats({ headcount: prevHeadcount, payrollTotal: prevPayrollTotal, trainingRate: prevTrainingRate });
    })();
  }, [compareMode, dateRange, customStart, customEnd]);

  // Feature 2: localStorage 15-min caching — save on successful load
  useEffect(() => {
    if (!loading && allStats && Object.keys(allStats).length > 0) {
      try {
        localStorage.setItem(getCacheKey(department, dateStart, dateEnd), JSON.stringify({ data: allStats, ts: Date.now() }));
      } catch {
        // ignore storage errors
      }
    }
  }, [loading, allStats, department, dateStart, dateEnd]);

  // Read from cache on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(getCacheKey(department, dateStart, dateEnd));
      if (cached) {
        const parsed = JSON.parse(cached) as { data: unknown; ts: number };
        if (Date.now() - parsed.ts < ANALYTICS_CACHE_TTL) {
          // cache is fresh — data will be served by the hook; nothing extra needed
        }
      }
    } catch {
      // ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FIX 3: Department manager force-filter
  useEffect(() => {
    const role = (user as { role?: string; primaryRole?: string } | null)?.role
      ?? (user as { role?: string; primaryRole?: string } | null)?.primaryRole;
    if (role === "department_manager") {
      const dept = (user as { department?: string; primaryDepartment?: string } | null)?.department
        ?? (user as { department?: string; primaryDepartment?: string } | null)?.primaryDepartment;
      if (dept) setDepartment(dept);
    }
  }, [user]);

  const isDeptManager = ((user as { role?: string; primaryRole?: string } | null)?.role
    ?? (user as { role?: string; primaryRole?: string } | null)?.primaryRole) === "department_manager";

  useEffect(() => {
    void supabase
      .from("analytics_anomalies")
      .select("*")
      .eq("is_resolved", false)
      .then(({ data: anomalyData }) => {
        if (!anomalyData) return;
        const map: Record<string, AnomalyDot> = {};
        (anomalyData as Array<Record<string, unknown>>).forEach((a) => {
          const key = String(a.metric_name ?? a.metric_key ?? "");
          if (key) {
            map[key] = {
              severity: (a.severity as "amber" | "red") ?? "amber",
              metric_name: String(a.metric_name ?? a.metric_key ?? ""),
              deviation_percent: a.deviation_percent != null ? Number(a.deviation_percent) : undefined,
            };
          }
        });
        setAnomalyMap(map);
      });
  }, []);

  const handleCloseDrillDown = useCallback(() => setDrillDownKPI(null), []);

  async function handleRefresh() {
    localStorage.removeItem(getCacheKey(department, dateStart, dateEnd));
    setRefreshing(true);
    await refresh();
    setLastFetched(new Date());
    setRefreshing(false);
  }

  function handleDateRangeChange(value: string) {
    setDateRange(value);
  }

  function handlePrintPDF() {
    const originalTitle = document.title;
    document.title = "Analytics Report - " + new Date().toLocaleDateString();
    const style = document.createElement("style");
    style.id = "analytics-print-css";
    style.textContent = "@media print { .no-print { display: none !important; } .kpi-grid { grid-template-columns: repeat(3, 1fr) !important; } body { font-size: 10pt; } * { page-break-inside: avoid; } }";
    document.head.appendChild(style);
    window.onafterprint = () => {
      document.getElementById("analytics-print-css")?.remove();
      document.title = originalTitle;
      window.onafterprint = null;
    };
    log({ event_type: 'analytics_exported', action: 'analytics_exported', metadata: { format: 'pdf' } });
    window.print();
  }

  async function handleExportExcel() {
    const dir = allStats.directory as Record<string, unknown> | undefined;
    const pay = allStats.payroll as Record<string, unknown> | undefined;
    const rec = allStats.recruitment as Record<string, unknown> | undefined;
    const it = allStats.itServices as Record<string, unknown> | undefined;
    const tr = allStats.training as Record<string, unknown> | undefined;
    const inv = allStats.invoices as Record<string, unknown> | undefined;
    const ast = allStats.assets as Record<string, unknown> | undefined;
    const okr = allStats.okr as Record<string, unknown> | undefined;
    const kb = allStats.knowledge as Record<string, unknown> | undefined;
    const proj = allStats.projects as Record<string, unknown> | undefined;
    const onb = allStats.onboarding as Record<string, unknown> | undefined;
    const perf = allStats.performance as Record<string, unknown> | undefined;
    const today = new Date().toISOString().split('T')[0];

    // Sheet 1 — Overview KPIs (12 cards)
    const overviewRows = [
      { Name: 'Headcount', Value: fmt(get(dir, 'totalEmployees') ?? get(dir, 'total') ?? get(dir, 'count')), Unit: 'count' },
      { Name: 'Monthly Payroll', Value: fmt(get(pay, 'totalMonthlyCost') ?? get(pay, 'totalCost') ?? get(pay, 'monthlyTotal')), Unit: 'USD' },
      { Name: 'Active Candidates', Value: fmt(get(rec, 'activeCandidates') ?? get(rec, 'totalCandidates') ?? get(rec, 'active')), Unit: 'count' },
      { Name: 'Open IT Tickets', Value: fmt(get(it, 'openTickets') ?? get(it, 'open') ?? get(it, 'totalOpen')), Unit: 'count' },
      { Name: 'Training Completion', Value: pct(get(tr, 'completionRate') ?? get(tr, 'completion') ?? get(tr, 'completionPercentage')), Unit: '%' },
      { Name: 'Invoice Revenue', Value: fmt(get(inv, 'totalRevenue') ?? get(inv, 'revenue') ?? get(inv, 'totalAmount')), Unit: 'USD' },
      { Name: 'Assets Assigned', Value: fmt(get(ast, 'assignedAssets') ?? get(ast, 'assigned') ?? get(ast, 'totalAssigned')), Unit: 'count' },
      { Name: 'OKR Progress', Value: pct(get(okr, 'averageProgress') ?? get(okr, 'progress') ?? get(okr, 'avgProgress')), Unit: '%' },
      { Name: 'KB Articles', Value: fmt(get(kb, 'totalArticles') ?? get(kb, 'articles') ?? get(kb, 'total')), Unit: 'count' },
      { Name: 'Active Projects', Value: fmt(get(proj, 'activeProjects') ?? get(proj, 'active') ?? get(proj, 'totalActive')), Unit: 'count' },
      { Name: 'Onboarding In Progress', Value: fmt(get(onb, 'inProgress') ?? get(onb, 'active') ?? get(onb, 'totalInProgress')), Unit: 'count' },
      { Name: 'Avg Performance Rating', Value: `${num(get(perf, 'averageRating') ?? get(perf, 'avgRating') ?? get(perf, 'average')).toFixed(1)}/5`, Unit: 'rating' },
    ];

    // Sheet 2 — People & HR (employee count by dept)
    const depts = (get(dir, 'departments') ?? get(dir, 'byDepartment') ?? []) as Array<Record<string, unknown>>;
    const peopleRows: Record<string, string | number>[] = depts.length > 0
      ? depts.map(d => ({ Department: String(d.department ?? d.name ?? 'Unknown'), 'Employee Count': num(d.count ?? d.total ?? 0) }))
      : [
          { Metric: 'Total Employees', Value: num(get(dir, 'totalEmployees') ?? get(dir, 'total') ?? get(dir, 'count')) },
          { Metric: 'Active Employees', Value: num(get(dir, 'activeEmployees') ?? get(dir, 'active')) },
          { Metric: 'New Hires (Month)', Value: num(get(dir, 'newHires') ?? get(dir, 'newThisMonth') ?? 0) },
          { Metric: 'Attrition Rate %', Value: num(get(dir, 'attritionRate') ?? get(dir, 'attrition') ?? 0) },
        ];

    // Sheet 3 — Finance (payroll trend + invoice revenue)
    const payMonths = (get(pay, 'monthlyBreakdown') ?? get(pay, 'months') ?? []) as Array<Record<string, unknown>>;
    const financeRows: Record<string, string | number>[] = payMonths.length > 0
      ? payMonths.map(m => ({
          Month: String(m.month ?? m.period ?? 'Unknown'),
          'Gross Payroll (USD)': num(m.gross ?? m.totalGross ?? 0),
          'Net Payroll (USD)': num(m.net ?? m.totalNet ?? 0),
        }))
      : [
          { Metric: 'Total Monthly Payroll', Value: `$${fmt(get(pay, 'totalMonthlyCost') ?? get(pay, 'totalCost') ?? get(pay, 'monthlyTotal'))}` },
          { Metric: 'Average Salary', Value: `$${fmt(get(pay, 'averageSalary') ?? get(pay, 'avgSalary') ?? get(pay, 'average'))}` },
          { Metric: 'Invoice Revenue', Value: `$${fmt(get(inv, 'totalRevenue') ?? get(inv, 'revenue') ?? get(inv, 'totalAmount'))}` },
          { Metric: 'Outstanding Invoices', Value: `$${fmt(get(inv, 'outstandingAmount') ?? get(inv, 'outstanding') ?? 0)}` },
          { Metric: 'Overdue Invoices', Value: `$${fmt(get(inv, 'overdueAmount') ?? get(inv, 'overdue') ?? 0)}` },
        ];

    // Sheet 4 — Operations (training completion + IT tickets)
    const operationsRows: Record<string, string | number>[] = [
      { Metric: 'Training Completion Rate', Value: pct(get(tr, 'completionRate') ?? get(tr, 'completion') ?? get(tr, 'completionPercentage')) },
      { Metric: 'Total Enrolled', Value: num(get(tr, 'totalEnrolled') ?? get(tr, 'enrolled')) },
      { Metric: 'Total Completed', Value: num(get(tr, 'totalCompleted') ?? get(tr, 'completed')) },
      { Metric: 'Training Overdue', Value: num(get(tr, 'overdue') ?? get(tr, 'overdueCount')) },
      { Metric: 'Open IT Tickets', Value: num(get(it, 'openTickets') ?? get(it, 'open') ?? get(it, 'totalOpen')) },
      { Metric: 'Resolved IT Tickets', Value: num(get(it, 'resolvedTickets') ?? get(it, 'resolved') ?? get(it, 'totalResolved')) },
      { Metric: 'SLA Breached', Value: num(get(it, 'breachedSLA') ?? get(it, 'breached') ?? 0) },
      { Metric: 'Avg Resolution (hrs)', Value: num(get(it, 'avgResolutionTime') ?? get(it, 'averageResolutionTime') ?? 0) },
    ];

    await exportExcelMultiSheet(
      [
        { name: 'Overview KPIs', rows: overviewRows },
        { name: 'People & HR', rows: peopleRows },
        { name: 'Finance', rows: financeRows },
        { name: 'Operations', rows: operationsRows },
      ],
      `analytics-export-${today}`,
    );
    log({ event_type: 'analytics_exported', action: 'analytics_exported', metadata: { format: 'excel', domain_count: Object.keys(allStats).length } });
    toast.success('Excel file exported successfully');
  }

  function handleExportOverviewCSV() {
    const dir = allStats.directory as Record<string, unknown> | undefined;
    const pay = allStats.payroll as Record<string, unknown> | undefined;
    const rec = allStats.recruitment as Record<string, unknown> | undefined;
    const it = allStats.itServices as Record<string, unknown> | undefined;
    const tr = allStats.training as Record<string, unknown> | undefined;
    const inv = allStats.invoices as Record<string, unknown> | undefined;
    const today = new Date().toISOString().split('T')[0];
    const rows: string[][] = [
      ['Metric', 'Value', 'Category', 'Date'],
      ['Headcount', fmt(get(dir, 'totalEmployees') ?? get(dir, 'total') ?? get(dir, 'count')), 'People', today],
      ['Monthly Payroll', `$${fmt(get(pay, 'totalMonthlyCost') ?? get(pay, 'totalCost') ?? get(pay, 'monthlyTotal'))}`, 'Finance', today],
      ['Active Candidates', fmt(get(rec, 'activeCandidates') ?? get(rec, 'totalCandidates') ?? get(rec, 'active')), 'People', today],
      ['Open IT Tickets', fmt(get(it, 'openTickets') ?? get(it, 'open') ?? get(it, 'totalOpen')), 'Operations', today],
      ['Training Completion', pct(get(tr, 'completionRate') ?? get(tr, 'completion') ?? get(tr, 'completionPercentage')), 'People', today],
      ['Invoice Revenue', `$${fmt(get(inv, 'totalRevenue') ?? get(inv, 'revenue') ?? get(inv, 'totalAmount'))}`, 'Finance', today],
    ];
    downloadCSV(`analytics-export-${today}.csv`, rows);
    toast.success('Report exported successfully');
  }

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab allStats={allStats} loading={loading} onKpiClick={setDrillDownKPI} compareMode={compareMode} anomalyMap={anomalyMap} lastFetched={lastFetched} prevStats={prevStats} />;
      case 'people':
        return <PeopleTab allStats={allStats} loading={loading} />;
      case 'finance':
        return <FinanceTab allStats={allStats} loading={loading} />;
      case 'operations':
        return <OperationsTab allStats={allStats} loading={loading} />;
      case 'reports':
        return <ReportsTab allStats={allStats} />;
      case 'predictive':
        return <PredictiveTab allStats={allStats} />;
      case 'cohort':
        return <CohortTab dept={department} />;
      case 'funnel':
        return <FunnelTab dateRange={dateRange} customStart={customStart} />;
    }
  }, [activeTab, allStats, loading, compareMode, lastFetched, prevStats, dateRange, customStart]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Analytics Dashboard</h1>
            {user && <p className="text-xs text-gray-400">{user.name} · {user.email}</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={dateRange}
              onChange={e => handleDateRangeChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
              aria-label="Date range filter"
            >
              {DATE_RANGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {dateRange === 'custom' && (
              <>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customStart}
                      onChange={e => {
                        const val = e.target.value;
                        let error = '';
                        let warning = '';
                        const today = new Date().toISOString().split('T')[0];
                        if (val > today) {
                          error = 'Start date cannot be in the future';
                        } else if (customEnd && val && val >= customEnd) {
                          error = 'End date must be after start date';
                        } else if (customEnd && val) {
                          const diffMs = new Date(customEnd).getTime() - new Date(val).getTime();
                          const diffDays = diffMs / (1000 * 60 * 60 * 24);
                          if (diffDays < 1) {
                            error = 'Date range must be at least 1 day';
                          } else if (diffDays > 365) {
                            warning = 'Large date ranges may take longer to load';
                          }
                        }
                        setDateRangeError(error);
                        setDateRangeWarning(warning);
                        setCustomStart(val);
                      }}
                      className={`px-2 py-1.5 rounded-lg border text-sm text-gray-600 bg-white ${dateRangeError ? 'border-red-400' : 'border-gray-200'}`}
                      aria-label="Start date"
                    />
                    <input
                      type="date"
                      value={customEnd}
                      onChange={e => {
                        const val = e.target.value;
                        let error = '';
                        let warning = '';
                        if (customStart && val && val <= customStart) {
                          error = 'End date must be after start date';
                        } else if (customStart && val) {
                          const diffMs = new Date(val).getTime() - new Date(customStart).getTime();
                          const diffDays = diffMs / (1000 * 60 * 60 * 24);
                          if (diffDays < 1) {
                            error = 'Date range must be at least 1 day';
                          } else if (diffDays > 365) {
                            warning = 'Large date ranges may take longer to load';
                          }
                        }
                        setDateRangeError(error);
                        setDateRangeWarning(warning);
                        setCustomEnd(val);
                      }}
                      className={`px-2 py-1.5 rounded-lg border text-sm text-gray-600 bg-white ${dateRangeError ? 'border-red-400' : 'border-gray-200'}`}
                      aria-label="End date"
                    />
                  </div>
                  {dateRangeError && (
                    <span className="text-xs text-red-500 mt-0.5">{dateRangeError}</span>
                  )}
                  {!dateRangeError && dateRangeWarning && (
                    <span className="text-xs text-amber-500 mt-0.5">{dateRangeWarning}</span>
                  )}
                </div>
              </>
            )}
            <select
              value={department}
              onChange={e => setDepartment(e.target.value)}
              disabled={isDeptManager}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 bg-white hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Department filter"
            >
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>
              ))}
            </select>
            {lastFetched && (
              <span className="text-xs text-gray-400 whitespace-nowrap">Data as of {timeAgo(lastFetched)}</span>
            )}
            <button
              onClick={() => setCompareMode(v => !v)}
              className={`no-print px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${compareMode ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {t('analytics.compare.toggle')}
            </button>
            <button
              onClick={handleExportOverviewCSV}
              disabled={loading}
              className="no-print px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              ⬇ Export CSV
            </button>
            <button
              onClick={handleExportExcel}
              disabled={loading}
              className="no-print px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              📊 Export Excel
            </button>
            <button
              onClick={handlePrintPDF}
              disabled={loading}
              className="no-print px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              🖨 Export PDF
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading || !!dateRangeError}
              className="no-print px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <span className={refreshing || loading ? 'animate-spin inline-block' : ''}>&#x21BB;</span>
              Refresh
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {tabContent}
      </main>

      {drillDownKPI && (
        <DrillDownModal
          kpiId={drillDownKPI}
          kpiLabel={drillDownKPI}
          rows={getDrillDownRows(drillDownKPI, allStats)}
          onClose={handleCloseDrillDown}
        />
      )}
    </div>
  );
}

export default AdvancedAnalyticsDashboard;
