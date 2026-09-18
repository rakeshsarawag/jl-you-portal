import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import html2canvas from 'html2canvas';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Area, AreaChart, PieChart, Pie, Legend,
} from 'recharts';
import { useExecutiveDashboardData } from '../../hooks/useExecutiveDashboardData';
import { useAdvancedAnalyticsData } from '../../hooks/useAdvancedAnalyticsData';
import { useAuditLogger } from '../../../hooks/useAuditLogger';
import { useUser } from '../../context/UserContext';
import { supabase } from '../../utils/constants';
import { t } from '../../../i18n/index';
import ReportDefectButton from '../ReportDefectButton';

export interface UnifiedAnalyticsDashboardProps {
  accessToken?: string;
  onLogout?: () => void;
}

// ── Unified tab model ─────────────────────────────────────────────────────────
/** Minimal layout-item shape used with react-grid-layout (package ships no types). */
export interface GridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  static?: boolean;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
}

export type Tab =
  | 'overview' | 'people' | 'finance' | 'operations' | 'okr'
  | 'timeline' | 'reports' | 'predictive' | 'cohort' | 'funnel';

export type DateRange = '7d' | '30d' | '90d' | '1y';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'people', label: 'People & HR' },
  { id: 'finance', label: 'Finance' },
  { id: 'operations', label: 'Operations' },
  { id: 'okr', label: 'OKRs & Projects' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'reports', label: 'Reports' },
  { id: 'predictive', label: 'Predictive' },
  { id: 'cohort', label: 'Cohort' },
  { id: 'funnel', label: 'Funnel' },
];

/** Maps the executive date-range buttons onto the day counts the advanced hook expects. */
const DATE_RANGE_DAYS: Record<DateRange, string> = {
  '7d': '7',
  '30d': '30',
  '90d': '90',
  '1y': '365',
};


// ═══ Executive dashboard helpers, hooks and panels ══════════════════════════

// ── Helpers ───────────────────────────────────────────────────────────────────
function efmt(n: number | undefined | null, style: 'currency' | 'number' | 'percent' = 'number'): string {
  if (n == null || isNaN(n)) return '—';
  if (style === 'currency') {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toLocaleString()}`;
  }
  if (style === 'percent') return `${Math.round(n)}%`;
  return n.toLocaleString();
}

function minutesAgo(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff === 1) return '1 minute ago';
  return `${diff} minutes ago`;
}

function dateRangeToISO(range: DateRange): { from: string; to: string; prevFrom: string; prevTo: string } {
  const now = new Date();
  const to = now.toISOString();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const from = new Date(now.getTime() - days * 86400000).toISOString();
  const prevFrom = new Date(now.getTime() - 2 * days * 86400000).toISOString();
  return { from, to, prevFrom, prevTo: from };
}

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  '7d': t('exec.dateRange.label7d'),
  '30d': t('exec.dateRange.label30d'),
  '90d': t('exec.dateRange.label90d'),
  '1y': t('exec.dateRange.label1y'),
};

const DATE_RANGE_BTNS: Record<DateRange, string> = {
  '7d': t('exec.dateRange.7d'),
  '30d': t('exec.dateRange.30d'),
  '90d': t('exec.dateRange.90d'),
  '1y': t('exec.dateRange.1y'),
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-card rounded-xl border border-border p-5 animate-pulse">
      <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
      <div className="h-8 w-20 bg-gray-300 rounded mb-2" />
      <div className="h-3 w-16 bg-muted rounded" />
    </div>
  );
}

function SkeletonRow({ cols = 3 }: { cols?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {Array.from({ length: cols }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

// ── Delta chip ────────────────────────────────────────────────────────────────
function DeltaChip({ current, prev, higherIsBetter = true }: { current: number | null; prev: number | null; higherIsBetter?: boolean }) {
  if (current == null || prev == null || prev === 0) return null;
  const pct = ((current - prev) / Math.abs(prev)) * 100;
  const improved = higherIsBetter ? pct > 0 : pct < 0;
  const color = improved ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50';
  const arrow = pct > 0 ? '↑' : '↓';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${color}`}>
      {arrow} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
interface KPICardProps {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  onClick?: () => void;
  delta?: { current: number | null; prev: number | null; higherIsBetter?: boolean };
  sparklineData?: number[];
  icon?: string;
  iconBg?: string;
}

function KPICard({ label, value, trend, trendLabel, onClick, delta, sparklineData, icon, iconBg }: KPICardProps) {
  const trendEl =
    trend === 'up' ? (
      <span className="text-emerald-600 text-xs font-semibold flex items-center gap-0.5">↑ {trendLabel}</span>
    ) : trend === 'down' ? (
      <span className="text-red-500 text-xs font-semibold flex items-center gap-0.5">↓ {trendLabel}</span>
    ) : trendLabel ? (
      <span className="text-muted-foreground text-xs">{trendLabel}</span>
    ) : null;

  return (
    <div
      className={`group relative bg-card rounded-2xl border border-border p-5 transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-lg hover:border-indigo-300 hover:-translate-y-0.5' : 'hover:shadow-md'}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        {icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${iconBg ?? 'bg-indigo-100'}`}>
            {icon}
          </div>
        )}
        {delta && <div><DeltaChip current={delta.current} prev={delta.prev} higherIsBetter={delta.higherIsBetter} /></div>}
      </div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-foreground leading-tight tabular-nums">{value}</p>
      {sparklineData && sparklineData.length > 1 && (
        <svg width="100%" height={32} className="mt-2 overflow-visible">
          {(() => {
            const min = Math.min(...sparklineData);
            const max = Math.max(...sparklineData);
            const range = max - min || 1;
            const pts = sparklineData.map((v, i) =>
              `${(i / (sparklineData.length - 1)) * 100}%,${32 - ((v - min) / range) * 26 + 2}`
            ).join(' ');
            return <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />;
          })()}
        </svg>
      )}
      {trendEl && <div className="mt-2">{trendEl}</div>}
      {onClick && (
        <div className="absolute bottom-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-indigo-500 font-medium">Drill down →</span>
        </div>
      )}
    </div>
  );
}

// ── Unavailable placeholder ───────────────────────────────────────────────────
function Unavailable({ label }: { label: string }) {
  return (
    <div className="bg-muted rounded-xl border border-dashed border-border p-5 flex items-center justify-center text-sm text-muted-foreground">
      {label} data unavailable
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function EProgressBar({ pct, color = 'bg-indigo-500' }: { pct: number; color?: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{children}</h3>;
}

function StatusRow({ label, value, color = 'text-foreground' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
    </div>
  );
}

// ── Drill-through Modal ───────────────────────────────────────────────────────
const KPI_DRILL_LINKS: Record<string, { label: string; path: string; params?: string }> = {
  headcount: { label: 'View in Directory', path: '/directory', params: '?status=active' },
  payroll: { label: 'View in Payroll', path: '/payroll' },
  candidates: { label: 'View in Recruitment', path: '/recruitment' },
  training: { label: 'View in Training', path: '/training' },
  tickets: { label: 'View in IT Services', path: '/it-services' },
  okr: { label: 'View in OKR', path: '/okr' },
  projects: { label: 'View in Projects', path: '/projects' },
  security: { label: 'View in Security', path: '/security-compliance' },
  invoices: { label: 'View in Invoices', path: '/invoices' },
};

interface DrillRow { label: string; value: string | number }
interface DrillModalProps {
  title: string;
  rows: DrillRow[];
  chartData?: { name: string; value: number }[];
  onClose: () => void;
  drillKpi?: string;
}

function DrillModal({ title, rows, chartData, onClose, drillKpi }: DrillModalProps) {
  const navigate = useNavigate();
  const drillLink = drillKpi ? KPI_DRILL_LINKS[drillKpi] : undefined;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none px-1">✕</button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {chartData && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'][i % 6]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {rows.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">{t('exec.drill.department')}</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">{t('exec.drill.count')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2 text-foreground">{r.label}</td>
                    <td className="py-2 text-right font-semibold text-foreground">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">{t('exec.drill.noData')}</p>
          )}
        </div>
        {drillLink && (
          <div className="flex items-center justify-end px-5 py-3 border-t border-border">
            <button
              onClick={() => { onClose(); navigate(drillLink.path + (drillLink.params ?? '')); }}
              className="text-indigo-600 hover:underline text-sm font-medium"
            >
              {drillLink.label} →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Real KPI hook (Supabase direct) ──────────────────────────────────────────
interface RealKPIs {
  headcount: number | null;
  headcountPrev: number | null;
  activeCandidates: number | null;
  activeCandidatesPrev: number | null;
  openTickets: number | null;
  openTicketsPrev: number | null;
  okrProgress: number | null;
  okrProgressPrev: number | null;
  payrollTotal: number | null;
  payrollPrev: number | null;
  trainingRate: number | null;
  trainingRatePrev: number | null;
  okrCompletionPct: number | null;
  projectHealthPct: number | null;
  securityEvents: number | null;
  outstandingInvoices: number | null;
}

interface DeptRow { department: string; count: number }

function useRealKPIs(dateRange: DateRange, hasAccess: boolean) {
  const [kpis, setKpis] = useState<RealKPIs>({
    headcount: null, headcountPrev: null,
    activeCandidates: null, activeCandidatesPrev: null,
    openTickets: null, openTicketsPrev: null,
    okrProgress: null, okrProgressPrev: null,
    payrollTotal: null, payrollPrev: null,
    trainingRate: null, trainingRatePrev: null,
    okrCompletionPct: null, projectHealthPct: null, securityEvents: null,
    outstandingInvoices: null,
  });
  const [deptBreakdown, setDeptBreakdown] = useState<DeptRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { from, to, prevFrom, prevTo } = dateRangeToISO(dateRange);

    const [hc, hcPrev, cand, candPrev, tickets, ticketsPrev, okrCurr, okrPrev, dept, payrollCurr, payrollPrv, trainCurr, trainPrev, closedOKRs, totalOKRs, onTrackProjects, totalProjects, secEventsRes, invOutstandingRes] = await Promise.allSettled([
      // total headcount (all active employees, no date filter)
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      // prev headcount approximation: employees created before prevTo
      supabase.from('employees').select('id', { count: 'exact', head: true }).lte('created_at', prevTo),
      // active candidates current (in pipeline)
      supabase.from('candidates').select('id', { count: 'exact', head: true })
        .not('status', 'in', '(rejected,hired,Rejected,Hired)'),
      // active candidates prev (snapshot: created before prevTo and not immediately rejected)
      supabase.from('candidates').select('id', { count: 'exact', head: true })
        .not('status', 'in', '(rejected,hired,Rejected,Hired)')
        .lte('created_at', prevTo),
      // open + in-progress IT tickets (active workload) — status is capitalized in DB
      supabase.from('it_tickets').select('id', { count: 'exact', head: true })
        .in('status', ['Open', 'In Progress']),
      // prev open tickets snapshot
      supabase.from('it_tickets').select('id', { count: 'exact', head: true })
        .in('status', ['Open', 'In Progress']).lte('created_at', prevTo),
      // OKR avg progress current — use okr table
      supabase.from('okr').select('progress').gte('created_at', from).lte('created_at', to),
      // OKR avg progress prev
      supabase.from('okr').select('progress').gte('created_at', prevFrom).lte('created_at', prevTo),
      // dept breakdown
      supabase.from('employees').select('department'),
      // payroll total current period
      supabase.from('payroll_records').select('gross_salary').gte('payment_date', from).lte('payment_date', to),
      // payroll total prev period
      supabase.from('payroll_records').select('gross_salary').gte('payment_date', prevFrom).lte('payment_date', prevTo),
      // training enrollments current period
      supabase.from('training_enrollments').select('status').gte('created_at', from).lte('created_at', to),
      // training enrollments prev period
      supabase.from('training_enrollments').select('status').gte('created_at', prevFrom).lte('created_at', prevTo),
      // OKR completion: status = 'completed' or progress >= 90
      supabase.from('okr').select('*', { count: 'exact', head: true }).gte('progress', 90),
      // OKR total
      supabase.from('okr').select('*', { count: 'exact', head: true }),
      // on-track projects (active)
      supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      // total projects
      supabase.from('projects').select('*', { count: 'exact', head: true }),
      // security events (critical audit logs in range)
      supabase.from('audit_logs').select('*', { count: 'exact', head: true }).eq('severity', 'critical').gte('created_at', from),
      // outstanding invoices
      supabase.from('invoices').select('balance_due, status').in('status', ['sent', 'overdue', 'partially_paid', 'Sent', 'Overdue', 'Partially Paid']),
    ]);

    function safeCount(r: PromiseSettledResult<{ count: number | null }>): number | null {
      return r.status === 'fulfilled' ? (r.value.count ?? null) : null;
    }
    function safeAvg(r: PromiseSettledResult<{ data: { progress: number }[] | null }>): number | null {
      if (r.status !== 'fulfilled' || !r.value.data || r.value.data.length === 0) return null;
      const vals = r.value.data.map((x) => x.progress ?? 0);
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    function safeSum(r: PromiseSettledResult<{ data: { gross_salary: number }[] | null }>): number | null {
      if (r.status !== 'fulfilled' || !r.value.data) return null;
      return r.value.data.reduce((acc, x) => acc + (x.gross_salary ?? 0), 0);
    }
    function safeRate(r: PromiseSettledResult<{ data: { status: string }[] | null }>): number | null {
      if (r.status !== 'fulfilled' || !r.value.data || r.value.data.length === 0) return null;
      const total = r.value.data.length;
      const completed = r.value.data.filter((x) => x.status === 'completed').length;
      return (completed / total) * 100;
    }

    const closedCount = safeCount(closedOKRs as PromiseSettledResult<{ count: number | null }>);
    const totalOKRCount = safeCount(totalOKRs as PromiseSettledResult<{ count: number | null }>);
    const okrCompletionPct = closedCount != null && totalOKRCount != null && totalOKRCount > 0
      ? Math.round((closedCount / totalOKRCount) * 100)
      : null;

    const onTrackCount = safeCount(onTrackProjects as PromiseSettledResult<{ count: number | null }>);
    const totalProjCount = safeCount(totalProjects as PromiseSettledResult<{ count: number | null }>);
    const projectHealthPct = onTrackCount != null && totalProjCount != null && totalProjCount > 0
      ? Math.round((onTrackCount / totalProjCount) * 100)
      : 0;

    const securityEvents = safeCount(secEventsRes as PromiseSettledResult<{ count: number | null }>);

    let outstandingInvoices: number | null = null;
    if (invOutstandingRes.status === 'fulfilled' && invOutstandingRes.value.data) {
      outstandingInvoices = (invOutstandingRes.value.data as { balance_due: number }[]).reduce((s, i) => s + (i.balance_due ?? 0), 0);
    }

    setKpis({
      headcount: safeCount(hc as PromiseSettledResult<{ count: number | null }>),
      headcountPrev: safeCount(hcPrev as PromiseSettledResult<{ count: number | null }>),
      activeCandidates: safeCount(cand as PromiseSettledResult<{ count: number | null }>),
      activeCandidatesPrev: safeCount(candPrev as PromiseSettledResult<{ count: number | null }>),
      openTickets: safeCount(tickets as PromiseSettledResult<{ count: number | null }>),
      openTicketsPrev: safeCount(ticketsPrev as PromiseSettledResult<{ count: number | null }>),
      okrProgress: safeAvg(okrCurr as PromiseSettledResult<{ data: { progress: number }[] | null }>),
      okrProgressPrev: safeAvg(okrPrev as PromiseSettledResult<{ data: { progress: number }[] | null }>),
      payrollTotal: safeSum(payrollCurr as PromiseSettledResult<{ data: { gross_salary: number }[] | null }>),
      payrollPrev: safeSum(payrollPrv as PromiseSettledResult<{ data: { gross_salary: number }[] | null }>),
      trainingRate: safeRate(trainCurr as PromiseSettledResult<{ data: { status: string }[] | null }>),
      trainingRatePrev: safeRate(trainPrev as PromiseSettledResult<{ data: { status: string }[] | null }>),
      okrCompletionPct,
      projectHealthPct,
      securityEvents,
      outstandingInvoices,
    });

    if (dept.status === 'fulfilled' && dept.value.data) {
      const map: Record<string, number> = {};
      for (const row of dept.value.data) {
        const d = (row as { department?: string }).department ?? 'Unknown';
        map[d] = (map[d] ?? 0) + 1;
      }
      setDeptBreakdown(Object.entries(map).map(([department, count]) => ({ department, count })).sort((a, b) => b.count - a.count));
    }

    setLoading(false);
  }, [dateRange, hasAccess]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { kpis, deptBreakdown, loading, refresh: fetch };
}

// ── Payroll Trend hook (12 months) ────────────────────────────────────────────
interface PayrollMonth { month: string; total: number }

function usePayrollTrend() {
  const [trend, setTrend] = useState<PayrollMonth[]>([]);

  const load = useCallback(async () => {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    const { data } = await supabase
      .from('payroll_records')
      .select('gross_salary, payment_date')
      .gte('payment_date', twelveMonthsAgo.toISOString());
    if (data) {
      const map: Record<string, number> = {};
      for (const row of data as { gross_salary: number; payment_date: string }[]) {
        const d = new Date(row.payment_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        map[key] = (map[key] ?? 0) + (row.gross_salary ?? 0);
      }
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const result: PayrollMonth[] = Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, total]) => {
          const [, m] = key.split('-');
          return { month: months[parseInt(m, 10) - 1], total };
        });
      setTrend(result);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  return { trend };
}

// ── Invoice Monthly hook (6 months) ──────────────────────────────────────────
interface InvoiceMonth { month: string; revenue: number }
interface InvoiceStatusTotals { paid: number; outstanding: number; overdue: number }

function useInvoiceMonthly() {
  const [monthly, setMonthly] = useState<InvoiceMonth[]>([]);
  const [statusTotals, setStatusTotals] = useState<InvoiceStatusTotals>({ paid: 0, outstanding: 0, overdue: 0 });

  const load = useCallback(async () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const [monthlyRes, allRes] = await Promise.allSettled([
      supabase.from('invoices').select('total_amount, created_at').gte('created_at', sixMonthsAgo.toISOString()),
      supabase.from('invoices').select('total_amount, status, due_date'),
    ]);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (monthlyRes.status === 'fulfilled' && monthlyRes.value.data) {
      const map: Record<string, number> = {};
      for (const row of monthlyRes.value.data as { total_amount: number; created_at: string }[]) {
        const d = new Date(row.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        map[key] = (map[key] ?? 0) + (row.total_amount ?? 0);
      }
      const result: InvoiceMonth[] = Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, revenue]) => {
          const [, m] = key.split('-');
          return { month: months[parseInt(m, 10) - 1], revenue };
        });
      setMonthly(result);
    }

    if (allRes.status === 'fulfilled' && allRes.value.data) {
      let paid = 0, outstanding = 0, overdue = 0;
      for (const row of allRes.value.data as { total_amount: number; status: string; due_date: string }[]) {
        const amt = row.total_amount ?? 0;
        if (row.status === 'paid') paid += amt;
        else if (row.due_date && row.due_date < thirtyDaysAgo) overdue += amt;
        else outstanding += amt;
      }
      setStatusTotals({ paid, outstanding, overdue });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  return { monthly, statusTotals };
}

// ── OKR Details hook ──────────────────────────────────────────────────────────
interface OKRDeptRow { department: string; count: number; avgScore: number }
interface AtRiskOKR { id: string; title: string; owner: string; progress: number }
interface AllOKR { id: string; title: string; owner: string; progress: number; type: string; aligned_to_okr_id: string | null }

function useOKRDetails() {
  const [deptRows, setDeptRows] = useState<OKRDeptRow[]>([]);
  const [atRisk, setAtRisk] = useState<AtRiskOKR[]>([]);
  const [topAligned, setTopAligned] = useState<AllOKR[]>([]);

  const load = useCallback(async () => {
    const [deptRes, riskRes, allRes] = await Promise.allSettled([
      supabase.from('okr').select('department, progress'),
      supabase.from('okr').select('id, title, owner, progress').lt('progress', 40).order('progress', { ascending: true }).limit(10),
      supabase.from('okr').select('id, title, owner, progress, type, aligned_to_okr_id'),
    ]);

    if (deptRes.status === 'fulfilled' && deptRes.value.data) {
      const map: Record<string, { sum: number; count: number }> = {};
      for (const row of deptRes.value.data as { department: string; progress: number }[]) {
        const d = row.department ?? 'Unknown';
        if (!map[d]) map[d] = { sum: 0, count: 0 };
        map[d].sum += row.progress ?? 0;
        map[d].count += 1;
      }
      const rows = Object.entries(map)
        .map(([department, { sum, count }]) => ({ department, count, avgScore: count > 0 ? sum / count : 0 }))
        .sort((a, b) => a.avgScore - b.avgScore);
      setDeptRows(rows);
    }

    if (riskRes.status === 'fulfilled' && riskRes.value.data) {
      setAtRisk(riskRes.value.data as AtRiskOKR[]);
    }

    if (allRes.status === 'fulfilled' && allRes.value.data) {
      const allOKRs = allRes.value.data as AllOKR[];
      const aligned = allOKRs
        .filter((o) => o.type === 'Individual' && o.aligned_to_okr_id)
        .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))
        .slice(0, 5);
      setTopAligned(aligned);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  return { deptRows, atRisk, topAligned };
}

// ── Alerts hook ───────────────────────────────────────────────────────────────
interface Alert { id: string; metric_key: string; severity: string; deviation_percent: number }

function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsRefreshedAt, setAlertsRefreshedAt] = useState<Date | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('analytics_anomalies')
        .select('id, metric_key, severity, deviation_percent')
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(5);
      if (!error && data) {
        setAlerts(data as Alert[]);
        setAlertsRefreshedAt(new Date());
      }
    } catch {
      // table may not exist yet — keep empty alerts
    }
  }, []);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [load]);

  return { alerts, alertsRefreshedAt };
}

// ── Scheduled Reports hook ────────────────────────────────────────────────────
interface ScheduledReport { id: string; name: string; schedule: string; recipients: string; next_run_at: string | null; created_by: string }

function useScheduledReports(userId: string | undefined) {
  const [reports, setReports] = useState<ScheduledReport[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('scheduled_reports')
      .select('id, name, schedule, recipients, next_run_at, created_by')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });
    if (data) setReports(data as ScheduledReport[]);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  return { reports, reload: load };
}

// ── Alerts Panel ──────────────────────────────────────────────────────────────
const SEVERITY_STYLES: Record<string, { icon: string; color: string }> = {
  critical: { icon: '🔴', color: 'text-red-700' },
  high: { icon: '🟠', color: 'text-orange-600' },
  medium: { icon: '🟡', color: 'text-amber-600' },
  low: { icon: '🔵', color: 'text-blue-600' },
};

function AlertsPanel({ alerts, setActiveTab, lastRefreshed }: { alerts: Alert[]; setActiveTab: (tab: Tab) => void; lastRefreshed?: Date }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        <span>Alerts</span>
        {alerts.length > 0 && (
          <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
            {alerts.length}
          </span>
        )}
      </div>
      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('exec.alerts.noAlerts')}</p>
      ) : (
        alerts.map((a) => {
          const sev = SEVERITY_STYLES[a.severity] ?? { icon: '⚪', color: 'text-foreground' };
          return (
            <div key={a.id} className="flex items-center gap-2 text-sm py-1 border-b border-border last:border-0">
              <span>{sev.icon}</span>
              <span className="flex-1 font-medium text-foreground truncate">{a.metric_key}</span>
              <span className={`text-xs font-semibold ${sev.color}`}>{a.deviation_percent > 0 ? '+' : ''}{a.deviation_percent.toFixed(1)}%</span>
              <button
                onClick={() => setActiveTab('overview')}
                className="ml-auto text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap"
              >
                View →
              </button>
            </div>
          );
        })
      )}
      {lastRefreshed && (
        <p className="text-xs text-gray-400 mt-2 text-right">Last refreshed {minutesAgo(lastRefreshed)} min ago</p>
      )}
    </div>
  );
}

// ── Scheduled Reports Modal ───────────────────────────────────────────────────
interface ScheduleModalProps {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
  editing?: ScheduledReport | null;
}

type ScheduleType = 'daily' | 'weekly' | 'monthly' | 'first_of_month';

const SECTION_OPTIONS = [
  { id: 'kpi_overview', label: 'KPI Overview' },
  { id: 'people_tab', label: 'People & HR' },
  { id: 'finance_tab', label: 'Finance' },
  { id: 'operations_tab', label: 'Operations' },
  { id: 'okr_tab', label: 'OKR Summary' },
  { id: 'alerts', label: 'Anomaly Alerts' },
  { id: 'cost_center', label: 'Cost Center Breakdown' },
];

function ScheduleModal({ userId, onClose, onSaved, editing }: ScheduleModalProps) {
  const [name, setName] = useState(editing?.name ?? '');
  const [schedule, setSchedule] = useState<ScheduleType>((editing?.schedule as ScheduleType) ?? 'weekly');
  const [recipients, setRecipients] = useState(editing?.recipients ?? '');
  const [sections, setSections] = useState<string[]>(['kpi_overview', 'people_tab', 'finance_tab', 'operations_tab', 'okr_tab', 'alerts', 'cost_center']);
  const [nextRunAt, setNextRunAt] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!name.trim() || !recipients.trim()) return;
    const validateEmails = (str: string) => str.split(',').every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()));
    if (!validateEmails(recipients)) {
      toast.error("Please enter valid email addresses.");
      return;
    }
    if (nextRunAt && new Date(nextRunAt) <= new Date()) {
      toast.error("Next run time must be in the future.");
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      name: name.trim(),
      schedule,
      recipients: recipients.trim(),
      created_by: userId,
      sections,
      ...(nextRunAt ? { next_run_at: new Date(nextRunAt).toISOString() } : {}),
    };
    try {
      const { error } = editing
        ? await supabase.from('scheduled_reports').update(payload).eq('id', editing.id)
        : await supabase.from('scheduled_reports').insert([payload]);
      if (error) {
        toast.error('Failed to save the scheduled report');
        return;
      }
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to save the scheduled report');
    } finally {
      setSaving(false);
    }
  };

  const scheduleOptions: { value: ScheduleType; label: string }[] = [
    { value: 'daily', label: t('exec.schedule.daily') },
    { value: 'weekly', label: t('exec.schedule.weekly') },
    { value: 'monthly', label: t('exec.schedule.monthly') },
    { value: 'first_of_month', label: t('exec.schedule.firstOfMonth') },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">{t('exec.schedule.title')}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl px-1">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{t('exec.schedule.name')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Monthly Executive Summary"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{t('exec.schedule.schedule')}</label>
            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value as ScheduleType)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {scheduleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{t('exec.schedule.recipients')}</label>
            <input
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="ceo@company.com, cfo@company.com"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Next Run At</label>
            <input
              type="datetime-local"
              value={nextRunAt}
              onChange={(e) => setNextRunAt(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Sections</label>
            <div className="space-y-1.5">
              {SECTION_OPTIONS.map((sec) => (
                <label key={sec.id} className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={sections.includes(sec.id)}
                    onChange={() => toggleSection(sec.id)}
                    className="rounded border-border"
                  />
                  {sec.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted">{t('exec.schedule.cancel')}</button>
            <button
              onClick={() => void handleSave()}
              disabled={saving || !name.trim() || !recipients.trim()}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? '...' : t('exec.schedule.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Quick Actions Panel ───────────────────────────────────────────────────────
function QuickActionsPanel() {
  const navigate = useNavigate();
  const [pendingLeaves, setPendingLeaves] = useState<number | null>(null);
  const [pendingInvoices, setPendingInvoices] = useState<number | null>(null);
  const [pendingRevisions, setPendingRevisions] = useState<number | null>(null);
  const [pipCount, setPipCount] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      const [leavesRes, invoicesRes, revisionsRes, pipRes] = await Promise.allSettled([
        supabase.from('leaves').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('invoices').select('*', { count: 'exact', head: true }).in('status', ['Sent', 'Overdue']),
        supabase.from('salary_revision_history').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
        supabase.from('performance_reviews').select('id', { count: 'exact', head: true }).eq('status', 'pip'),
      ]);
      if (leavesRes.status === 'fulfilled') setPendingLeaves(leavesRes.value.count ?? 0);
      if (invoicesRes.status === 'fulfilled') setPendingInvoices(invoicesRes.value.count ?? 0);
      if (revisionsRes.status === 'fulfilled') setPendingRevisions(revisionsRes.value.count ?? 0);
      if (pipRes.status === 'fulfilled') setPipCount(pipRes.value.count ?? 0);
    };
    void load();
  }, []);

  const actions = [
    { label: `Leave Approvals`, path: '/leaves', icon: '🏖️', count: pendingLeaves, suffix: 'pending', warning: false },
    { label: 'Pending Invoices', path: '/invoices', icon: '🧾', count: pendingInvoices, suffix: null, warning: false },
    { label: 'Salary Revisions', path: '/salary-revisions', icon: '💰', count: pendingRevisions, suffix: 'pending', warning: false },
    { label: 'Pending PIPs', path: '/performance', icon: '⚠️', count: pipCount, suffix: null, warning: true },
    { label: t('exec.quickActions.employees'), path: '/directory', icon: '👥', count: null, suffix: null, warning: false },
    { label: t('exec.quickActions.tickets'), path: '/it-services', icon: '🎫', count: null, suffix: null, warning: false },
  ];

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-2">
      <SectionHeading>{t('exec.quickActions.title')}</SectionHeading>
      {actions.map((a) => (
        <button
          key={a.path}
          onClick={() => navigate(a.path)}
          className="w-full flex items-center gap-2 text-sm text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors text-foreground"
        >
          <span>{a.icon}</span>
          <span className="flex-1">
            {a.count !== null
              ? `${a.label} (${a.count}${a.suffix ? ` ${a.suffix}` : ''})`
              : a.label}
          </span>
          {a.count !== null && a.count > 0
            ? <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full ${a.warning ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{a.count}</span>
            : <span className="ml-auto text-muted-foreground">→</span>}
        </button>
      ))}
    </div>
  );
}

// ── Org Timeline hook ─────────────────────────────────────────────────────────
interface OrgEvent {
  id: string;
  event_type: string;
  action: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  user_id: string | null;
}

function useOrgTimeline() {
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('audit_logs')
      .select('id, event_type, action, created_at, metadata, user_id')
      .in('event_type', ['employee_created', 'payroll_processed', 'okr_cycle_closed', 'invoice_sent', 'compliance_status_updated'])
      .order('created_at', { ascending: false })
      .limit(30);
    setEvents((data ?? []) as OrgEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  return { events, loading };
}

const TIMELINE_EVENT_META: Record<string, { label: string; dot: string }> = {
  employee_created: { label: 'Employee Joined', dot: 'bg-emerald-500' },
  payroll_processed: { label: 'Payroll Processed', dot: 'bg-blue-500' },
  okr_cycle_closed: { label: 'OKR Cycle Closed', dot: 'bg-purple-500' },
  invoice_sent: { label: 'Invoice Sent', dot: 'bg-blue-400' },
  compliance_status_updated: { label: 'Compliance Updated', dot: 'bg-orange-500' },
};

function eTimeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

function TimelineTab() {
  const { events, loading } = useOrgTimeline();

  if (loading) return <div className="space-y-4"><SkeletonRow cols={1} /></div>;

  return (
    <div className="space-y-2">
      <SectionHeading>Organization Timeline</SectionHeading>
      <div className="bg-card rounded-xl border border-border p-5">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No timeline events found.</p>
        ) : (
          <ol className="relative border-l border-border ml-3 space-y-6">
            {events.map((ev) => {
              const meta = TIMELINE_EVENT_META[ev.event_type] ?? { label: ev.event_type, dot: 'bg-gray-400' };
              const snippet = ev.metadata
                ? Object.entries(ev.metadata).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ')
                : '';
              return (
                <li key={ev.id} className="ml-6">
                  <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background ${meta.dot}`} />
                  <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                  <p className="text-xs text-muted-foreground">{ev.action}</p>
                  {snippet && <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{snippet}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{eTimeAgo(ev.created_at)}</p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

// ── TABS ──────────────────────────────────────────────────────────────────────



type DashData = ReturnType<typeof useExecutiveDashboardData>['data'];

// ── OVERVIEW TAB ──────────────────────────────────────────────────────────────
interface OverviewTabProps {
  data: DashData;
  loading: boolean;
  realKpis: RealKPIs;
  realLoading: boolean;
  onDrillHeadcount: () => void;
  onDrillCandidates: () => void;
  onDrillTickets: () => void;
  onDrillOKR: () => void;
  isCustomizing: boolean;
  kpiLayout: GridLayoutItem[];
  onKpiLayoutChange: (layout: GridLayoutItem[]) => void;
}

function OverviewTab({ data, loading, realKpis, realLoading, onDrillHeadcount, onDrillCandidates, onDrillTickets, onDrillOKR, isCustomizing, kpiLayout, onKpiLayoutChange }: OverviewTabProps) {
  if (loading || realLoading) {
    return (
      <div className="space-y-6">
        <SkeletonRow cols={3} />
        <SkeletonRow cols={3} />
        <SkeletonRow cols={2} />
      </div>
    );
  }

  // KPI card element map — each card has an icon + color for visual richness
  const kpiCardElements: Record<string, React.ReactNode> = {
    headcount: (
      <KPICard
        icon="👥" iconBg="bg-blue-100"
        label={t('exec.kpi.headcount')}
        value={efmt(realKpis.headcount ?? data?.headcount?.total)}
        trendLabel={data?.headcount ? `+${data.headcount.newThisMonth} new this month` : undefined}
        trend={data?.headcount && data.headcount.newThisMonth > 0 ? 'up' : undefined}
        onClick={isCustomizing ? undefined : onDrillHeadcount}
        delta={{ current: realKpis.headcount, prev: realKpis.headcountPrev }}
      />
    ),
    payroll: (
      <KPICard
        icon="💰" iconBg="bg-emerald-100"
        label={t('exec.kpi.monthlyPayroll')}
        value={data?.payroll ? efmt(data.payroll.totalCost, 'currency') : realKpis.payrollTotal != null ? efmt(realKpis.payrollTotal, 'currency') : '—'}
        trendLabel={data?.payroll ? `${efmt(data.payroll.avgSalary, 'currency')} avg salary` : undefined}
        delta={{ current: realKpis.payrollTotal, prev: realKpis.payrollPrev }}
      />
    ),
    candidates: (
      <KPICard
        icon="🎯" iconBg="bg-purple-100"
        label={t('exec.kpi.activeCandidates')}
        value={efmt(realKpis.activeCandidates ?? data?.recruitment?.totalCandidates)}
        trendLabel={data?.recruitment ? `${data.recruitment.activeJobs} open roles` : undefined}
        trend="neutral"
        onClick={isCustomizing ? undefined : onDrillCandidates}
        delta={{ current: realKpis.activeCandidates, prev: realKpis.activeCandidatesPrev }}
      />
    ),
    training: (
      <KPICard
        icon="📚" iconBg="bg-teal-100"
        label={t('exec.kpi.trainingCompletion')}
        value={data?.training ? efmt(data.training.completionRate, 'percent') : realKpis.trainingRate != null ? efmt(realKpis.trainingRate, 'percent') : '—'}
        trend={data?.training ? (data.training.completionRate >= 70 ? 'up' : 'down') : undefined}
        trendLabel={data?.training ? `${data.training.enrollments} enrolled` : undefined}
        delta={{ current: realKpis.trainingRate, prev: realKpis.trainingRatePrev }}
      />
    ),
    tickets: (
      <KPICard
        icon="🎫" iconBg="bg-orange-100"
        label={t('exec.kpi.openItTickets')}
        value={efmt(realKpis.openTickets ?? data?.itServices?.openTickets)}
        trend={(data?.itServices?.slaBreached ?? 0) > 0 ? 'down' : 'neutral'}
        trendLabel={(data?.itServices?.slaBreached ?? 0) > 0 ? `${data!.itServices!.slaBreached} SLA breached` : 'All within SLA'}
        onClick={isCustomizing ? undefined : onDrillTickets}
        delta={{ current: realKpis.openTickets, prev: realKpis.openTicketsPrev, higherIsBetter: false }}
      />
    ),
    okrProgress: (
      <KPICard
        icon="📈" iconBg="bg-indigo-100"
        label={t('exec.kpi.okrProgress')}
        value={efmt(realKpis.okrProgress ?? data?.okr?.avgProgress, 'percent')}
        trendLabel={data?.okr ? `${data.okr.onTrack} on track · ${data.okr.atRisk} at risk` : undefined}
        onClick={isCustomizing ? undefined : onDrillOKR}
        delta={{ current: realKpis.okrProgress, prev: realKpis.okrProgressPrev }}
      />
    ),
    okrCompletion: (
      <KPICard
        icon="✅" iconBg="bg-green-100"
        label="OKR Completion"
        value={realKpis.okrCompletionPct != null ? `${realKpis.okrCompletionPct}%` : '—'}
        trend={realKpis.okrCompletionPct != null && realKpis.okrCompletionPct >= 70 ? 'up' : 'neutral'}
        trendLabel="fully closed"
      />
    ),
    projectHealth: (
      <KPICard
        icon="🏗️" iconBg="bg-sky-100"
        label="Project Health"
        value={realKpis.projectHealthPct != null ? `${realKpis.projectHealthPct}%` : '—'}
        trend={realKpis.projectHealthPct != null && realKpis.projectHealthPct >= 70 ? 'up' : 'down'}
        trendLabel="active on track"
      />
    ),
    securityEvents: (
      <KPICard
        icon="🔐" iconBg={realKpis.securityEvents ? 'bg-red-100' : 'bg-gray-100'}
        label="Security Events"
        value={realKpis.securityEvents != null ? String(realKpis.securityEvents) : '—'}
        trend={realKpis.securityEvents != null && realKpis.securityEvents > 0 ? 'down' : 'neutral'}
        trendLabel={realKpis.securityEvents === 0 ? 'No critical events' : 'critical'}
      />
    ),
    outstandingInvoices: (
      <KPICard
        icon="🧾" iconBg="bg-amber-100"
        label="Outstanding Invoices"
        value={realKpis.outstandingInvoices != null ? efmt(realKpis.outstandingInvoices, 'currency') : '—'}
        trend={realKpis.outstandingInvoices != null && realKpis.outstandingInvoices > 0 ? 'down' : 'neutral'}
        trendLabel="pending collection"
      />
    ),
  };

  return (
    <div className="space-y-6">
      {/* ── Prominent hero stat row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Headcount',
            value: efmt(realKpis.headcount ?? data?.headcount?.total),
            sub: data?.headcount ? `+${data.headcount.newThisMonth} this month` : 'Active employees',
            icon: '👥', bg: 'from-blue-500 to-blue-600', delta: { current: realKpis.headcount, prev: realKpis.headcountPrev },
            onClick: isCustomizing ? undefined : onDrillHeadcount,
          },
          {
            label: 'Monthly Payroll',
            value: data?.payroll ? efmt(data.payroll.totalCost, 'currency') : '—',
            sub: data?.payroll ? `${efmt(data.payroll.avgSalary, 'currency')} avg` : 'Total cost',
            icon: '💰', bg: 'from-emerald-500 to-emerald-600', delta: { current: realKpis.payrollTotal, prev: realKpis.payrollPrev },
            onClick: undefined,
          },
          {
            label: 'Open IT Tickets',
            value: efmt(realKpis.openTickets ?? data?.itServices?.openTickets),
            sub: (data?.itServices?.slaBreached ?? 0) > 0 ? `${data!.itServices!.slaBreached} SLA breached` : 'All within SLA',
            icon: '🎫', bg: 'from-orange-500 to-orange-600', delta: { current: realKpis.openTickets, prev: realKpis.openTicketsPrev, higherIsBetter: false },
            onClick: isCustomizing ? undefined : onDrillTickets,
          },
          {
            label: 'OKR Progress',
            value: efmt(realKpis.okrProgress ?? data?.okr?.avgProgress, 'percent'),
            sub: data?.okr ? `${data.okr.onTrack} on track` : 'Average across all',
            icon: '📈', bg: 'from-violet-500 to-violet-600', delta: { current: realKpis.okrProgress, prev: realKpis.okrProgressPrev },
            onClick: isCustomizing ? undefined : onDrillOKR,
          },
        ].map(card => (
          <div
            key={card.label}
            onClick={card.onClick}
            className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${card.bg} text-white shadow-md ${card.onClick ? 'cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200' : ''}`}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
              {card.delta && <DeltaChip current={card.delta.current} prev={card.delta.prev} higherIsBetter={(card.delta as { higherIsBetter?: boolean }).higherIsBetter} />}
            </div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">{card.label}</p>
            <p className="text-3xl font-bold mt-0.5 tabular-nums">{card.value}</p>
            <p className="text-white/60 text-xs mt-1">{card.sub}</p>
            {/* Decorative blob */}
            <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-white/10" />
          </div>
        ))}
      </div>

      {/* ── Secondary KPI grid ── */}
      <div>
        <SectionHeading>All Metrics</SectionHeading>
        {isCustomizing ? (
          <div>
            <p className="text-xs text-gray-500 mb-2">Drag cards to reorder. Click "Done" when finished.</p>
            <ReactGridLayout
              className="layout"
              layout={kpiLayout}
              width={1200}
              gridConfig={{ cols: 12, rowHeight: 100 }}
              dragConfig={{ enabled: true }}
              resizeConfig={{ enabled: false }}
              onLayoutChange={(l) => onKpiLayoutChange(l as GridLayoutItem[])}
            >
              {Object.entries(kpiCardElements).map(([id, card]) => (
                <div key={id} className="cursor-move">
                  {card}
                </div>
              ))}
            </ReactGridLayout>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Object.values(kpiCardElements)}
          </div>
        )}
      </div>

      {/* ── Operational detail panels ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-card rounded-2xl border border-border p-5">
          <SectionHeading>Onboarding Status</SectionHeading>
          {data?.onboarding ? (
            <div className="space-y-4">
              {[
                { label: 'In Progress', count: data.onboarding.inProgress, color: 'bg-indigo-500', textColor: 'text-indigo-600' },
                { label: 'Completed', count: data.onboarding.completed, color: 'bg-emerald-500', textColor: 'text-emerald-600' },
                { label: 'Pending', count: data.onboarding.pending, color: 'bg-amber-400', textColor: 'text-amber-600' },
              ].map(({ label, count, color, textColor }) => {
                const total = data.onboarding!.inProgress + data.onboarding!.completed + data.onboarding!.pending;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground font-medium">{label}</span>
                      <span className={`font-bold ${textColor}`}>{count}</span>
                    </div>
                    <EProgressBar pct={total > 0 ? (count / total) * 100 : 0} color={color} />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Data unavailable</p>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border p-5">
          <SectionHeading>Performance Summary</SectionHeading>
          {data?.performance ? (
            <div className="space-y-4">
              <div className="text-center">
                <span className="text-5xl font-bold text-foreground">{data.performance.avgRating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground ml-1">/ 5.0</span>
                <EProgressBar pct={(data.performance.avgRating / 5) * 100} color="bg-violet-500" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                {[
                  { label: 'Reviews Done', value: efmt(data.performance.reviewsCompleted), color: 'text-violet-600' },
                  { label: 'Goals Achieved', value: efmt(data.performance.goalsAchieved), color: 'text-emerald-600' },
                ].map(item => (
                  <div key={item.label} className="text-center bg-muted rounded-xl p-3">
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Data unavailable</p>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border p-5">
          <SectionHeading>Recruitment Pipeline</SectionHeading>
          {data?.recruitment ? (
            <div className="space-y-4">
              {[
                { label: 'Total Candidates', value: data.recruitment.totalCandidates, icon: '👤', color: 'text-blue-600' },
                { label: 'Active Jobs', value: data.recruitment.activeJobs, icon: '💼', color: 'text-purple-600' },
                { label: 'Hired This Month', value: data.recruitment.hiredThisMonth, icon: '🎉', color: 'text-emerald-600' },
                { label: 'In Pipeline', value: data.recruitment.pipelineCount, icon: '⏳', color: 'text-amber-600' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{row.icon}</span>
                    <span>{row.label}</span>
                  </div>
                  <span className={`text-sm font-bold ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Data unavailable</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PEOPLE TAB ────────────────────────────────────────────────────────────────
function PeopleTab({ data, loading, deptBreakdown }: { data: DashData; loading: boolean; deptBreakdown: DeptRow[] }) {
  const { rows: trainingDeptRows } = useTrainingCompliance();

  // Self-fetched people data (active headcount by dept, attrition, onboarding records)
  const [deptChartData, setDeptChartData] = useState<{ dept: string; count: number }[]>([]);
  const [attritionPctFetched, setAttritionPctFetched] = useState<number | null>(null);
  const [onbFunnelData, setOnbFunnelData] = useState<{ label: string; count: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      const yearStart = `${new Date().getFullYear()}-01-01`;
      const totalHeadcount = deptBreakdown.reduce((s, d) => s + d.count, 0) || 1;
      const [deptRes, leftRes, onbRes] = await Promise.allSettled([
        supabase.from('employees').select('department').eq('status', 'active'),
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'inactive').gte('updated_at', yearStart),
        supabase.from('onboarding_records').select('status').gte('created_at', yearStart),
      ]);
      if (deptRes.status === 'fulfilled' && deptRes.value.data) {
        const counts: Record<string, number> = {};
        for (const e of deptRes.value.data as { department: string }[]) {
          const d = e.department ?? 'Unknown';
          counts[d] = (counts[d] || 0) + 1;
        }
        setDeptChartData(
          Object.entries(counts)
            .map(([dept, count]) => ({ dept: dept.slice(0, 12), count }))
            .sort((a, b) => b.count - a.count)
        );
      }
      if (leftRes.status === 'fulfilled') {
        const leftCount = leftRes.value.count ?? 0;
        setAttritionPctFetched(Math.round(leftCount / totalHeadcount * 100));
      }
      if (onbRes.status === 'fulfilled' && onbRes.value.data) {
        const rows = onbRes.value.data as { status: string }[];
        const pending = rows.filter((r) => r.status === 'pending').length;
        const inProgress = rows.filter((r) => r.status === 'in_progress' || r.status === 'in progress').length;
        const completed = rows.filter((r) => r.status === 'completed').length;
        setOnbFunnelData([
          { label: 'Pending', count: pending },
          { label: 'In Progress', count: inProgress },
          { label: 'Completed', count: completed },
        ]);
      }
    };
    void load();
  }, [deptBreakdown]);

  if (loading) return <div className="space-y-4"><SkeletonRow cols={3} /><SkeletonRow cols={3} /></div>;

  const attritionPct = attritionPctFetched ?? data?.headcount?.attrition ?? 0;
  const onb = data?.onboarding;
  const onbTotal = onb ? onb.inProgress + onb.completed + onb.pending : 0;

  // Onboarding funnel stages — only real DB-backed counts
  const funnelStages = onb ? [
    { label: 'Total', count: onbTotal, pct: 100 },
    { label: 'In Progress', count: onb.inProgress, pct: onbTotal > 0 ? Math.round((onb.inProgress / onbTotal) * 100) : 0 },
    { label: 'Pending', count: onb.pending, pct: onbTotal > 0 ? Math.round((onb.pending / onbTotal) * 100) : 0 },
    { label: 'Completed', count: onb.completed, pct: onbTotal > 0 ? Math.round((onb.completed / onbTotal) * 100) : 0 },
  ] : [];
  const funnelWidths = ['100%', '85%', '70%', '55%', '40%'];

  // Attrition donut data
  const attritionData = [
    { name: 'Attrition', value: Math.min(100, attritionPct), fill: '#ef4444' },
    { name: 'Retained', value: Math.max(0, 100 - attritionPct), fill: '#e5e7eb' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <SectionHeading>Workforce Overview</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.headcount ? (
            <>
              <KPICard label="Total Headcount" value={efmt(data.headcount.total)} />
              <KPICard label="New Joiners This Month" value={efmt(data.headcount.newThisMonth)} trend="up" />
              <KPICard label="Attrition Rate" value={`${attritionPct.toFixed(1)}%`} trend={attritionPct > 5 ? 'down' : 'neutral'} />
            </>
          ) : (
            <div className="col-span-3"><Unavailable label="Headcount" /></div>
          )}
          {data?.performance ? (
            <KPICard label="Avg Performance Rating" value={`${data.performance.avgRating.toFixed(1)} / 5`} />
          ) : (
            <Unavailable label="Performance" />
          )}
          {data?.training ? (
            <>
              <KPICard label="Training Enrolled" value={efmt(data.training.enrollments)} />
              <KPICard label="Certificates Earned" value={efmt(data.training.certified)} trend="up" />
            </>
          ) : (
            <div className="col-span-2"><Unavailable label="Training" /></div>
          )}
        </div>
      </div>

      {/* 1a: Headcount by Department (active employees) */}
      {(deptChartData.length > 0 || deptBreakdown.length > 0) && (
        <div className="bg-card rounded-xl border border-border p-5">
          <SectionHeading>Headcount by Department (Active)</SectionHeading>
          <ResponsiveContainer width="100%" height={200}>
            {deptChartData.length > 0 ? (
              <BarChart data={deptChartData.slice(0, 10)} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <XAxis dataKey="dept" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Bar dataKey="count" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                <Tooltip />
              </BarChart>
            ) : (
              <BarChart data={deptBreakdown.slice(0, 10)} layout="vertical" margin={{ top: 4, right: 40, left: 80, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="department" tick={{ fontSize: 11 }} width={76} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fill: '#6b7280' }} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* 1b: Attrition Rate donut + 1c: Onboarding Funnel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <SectionHeading>Attrition Rate</SectionHeading>
          <div className="flex flex-col items-center">
            <PieChart width={160} height={160}>
              <Pie
                data={attritionData}
                cx={75}
                cy={75}
                innerRadius={50}
                outerRadius={70}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                strokeWidth={0}
              >
                {attritionData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
            <div className="-mt-4 text-center">
              <p className="text-3xl font-bold text-foreground">{attritionPct.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-0.5">Attrition Rate</p>
              <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${attritionPct <= 5 ? 'bg-emerald-100 text-emerald-700' : attritionPct <= 10 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                {attritionPct <= 5 ? 'Healthy' : attritionPct <= 10 ? 'Watch' : 'High'}
              </span>
              <p className="text-xs text-muted-foreground mt-2">Target: &lt;5%</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <SectionHeading>Onboarding Funnel</SectionHeading>
          {onbFunnelData.length > 0 && (
            <div className="flex gap-3 mb-4">
              {onbFunnelData.map((item) => (
                <div key={item.label} className="flex-1 text-center bg-muted rounded-lg py-2 px-1">
                  <p className="text-xl font-bold text-foreground">{item.count}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          )}
          {onb && funnelStages.length > 0 ? (
            <div className="flex flex-col items-center gap-1.5 pt-2">
              {funnelStages.map((stage, i) => (
                <div
                  key={stage.label}
                  style={{ width: funnelWidths[i] }}
                  className={`flex items-center justify-between px-3 py-1.5 rounded text-xs font-medium ${i === 0 ? 'bg-indigo-600 text-white' : i === funnelStages.length - 1 ? 'bg-emerald-600 text-white' : 'bg-indigo-100 text-indigo-800'}`}
                >
                  <span>{stage.label}</span>
                  <span>{stage.count} ({stage.pct}%)</span>
                </div>
              ))}
            </div>
          ) : (
            <Unavailable label="Onboarding funnel" />
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <SectionHeading>Onboarding Status</SectionHeading>
        {data?.onboarding ? (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Status</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Count</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'In Progress', value: data.onboarding.inProgress, color: 'text-indigo-700' },
                  { label: 'Completed', value: data.onboarding.completed, color: 'text-emerald-700' },
                  { label: 'Pending', value: data.onboarding.pending, color: 'text-amber-700' },
                ].map(({ label, value, color }) => {
                  const total = data.onboarding!.inProgress + data.onboarding!.completed + data.onboarding!.pending;
                  return (
                    <tr key={label} className="border-b border-border last:border-0">
                      <td className={`py-3 font-medium ${color}`}>{label}</td>
                      <td className="py-3 text-right font-semibold text-foreground">{value}</td>
                      <td className="py-3 text-right text-muted-foreground">{total > 0 ? `${Math.round((value / total) * 100)}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Unavailable label="Onboarding" />
        )}
      </div>

      {trainingDeptRows.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <SectionHeading>Training Compliance by Department</SectionHeading>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Department</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Total Employees</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Completed</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Compliance %</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {trainingDeptRows.map((row) => {
                  const statusCls = row.compliancePct >= 80
                    ? 'bg-emerald-100 text-emerald-700'
                    : row.compliancePct >= 50
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700';
                  const statusLabel = row.compliancePct >= 80 ? 'Good' : row.compliancePct >= 50 ? 'Needs Work' : 'Critical';
                  return (
                    <tr key={row.department} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="py-2.5 text-foreground font-medium">{row.department}</td>
                      <td className="py-2.5 text-right text-foreground">{row.totalEmployees}</td>
                      <td className="py-2.5 text-right text-foreground">{row.completed}</td>
                      <td className="py-2.5 text-right font-semibold text-foreground">{row.compliancePct}%</td>
                      <td className="py-2.5 text-right">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusCls}`}>{statusLabel}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Training Compliance hook ──────────────────────────────────────────────────
interface TrainingDeptRow {
  department: string;
  totalEmployees: number;
  completed: number;
  compliancePct: number;
}

function useTrainingCompliance() {
  const [rows, setRows] = useState<TrainingDeptRow[]>([]);

  const load = useCallback(async () => {
    const [empRes, enrollRes] = await Promise.allSettled([
      supabase.from('employees').select('department, id'),
      supabase.from('training_enrollments').select('user_id, status'),
    ]);

    if (empRes.status !== 'fulfilled' || !empRes.value.data) return;
    if (enrollRes.status !== 'fulfilled' || !enrollRes.value.data) return;

    const employees = empRes.value.data as { department: string; id: string }[];
    const enrollments = enrollRes.value.data as { user_id: string; status: string }[];

    const completedSet = new Set(
      enrollments.filter((e) => e.status === 'completed').map((e) => e.user_id)
    );

    const deptMap: Record<string, { total: number; completed: number }> = {};
    for (const emp of employees) {
      const dept = emp.department ?? 'Unknown';
      if (!deptMap[dept]) deptMap[dept] = { total: 0, completed: 0 };
      deptMap[dept].total += 1;
      if (completedSet.has(emp.id)) deptMap[dept].completed += 1;
    }

    const result: TrainingDeptRow[] = Object.entries(deptMap)
      .map(([department, { total, completed }]) => ({
        department,
        totalEmployees: total,
        completed,
        compliancePct: total > 0 ? Math.round((completed / total) * 100) : 0,
      }))
      .sort((a, b) => b.totalEmployees - a.totalEmployees)
      .slice(0, 8);

    setRows(result);
  }, []);

  useEffect(() => { void load(); }, [load]);
  return { rows };
}

// ── Cost Center Breakdown hook ────────────────────────────────────────────────
interface CostCenterRow {
  department: string;
  headcount: number;
  totalGross: number;
  totalNet: number;
  avgCostPerHead: number;
  pctOfTotal: number;
}

function useCostCenterBreakdown() {
  const [rows, setRows] = useState<CostCenterRow[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('payroll_records')
      .select('department, gross_salary, net_salary')
      .eq('status', 'approved');
    if (!data) return;

    const map: Record<string, { gross: number; net: number; count: number }> = {};
    for (const row of data as { department: string; gross_salary: number; net_salary: number }[]) {
      const dept = row.department ?? 'Unknown';
      if (!map[dept]) map[dept] = { gross: 0, net: 0, count: 0 };
      map[dept].gross += row.gross_salary ?? 0;
      map[dept].net += row.net_salary ?? 0;
      map[dept].count += 1;
    }

    const totalGross = Object.values(map).reduce((s, v) => s + v.gross, 0);
    const result: CostCenterRow[] = Object.entries(map)
      .map(([department, { gross, net, count }]) => ({
        department,
        headcount: count,
        totalGross: gross,
        totalNet: net,
        avgCostPerHead: count > 0 ? gross / count : 0,
        pctOfTotal: totalGross > 0 ? (gross / totalGross) * 100 : 0,
      }))
      .sort((a, b) => b.totalGross - a.totalGross);

    setRows(result);
  }, []);

  useEffect(() => { void load(); }, [load]);
  return { rows };
}

// ── FINANCE TAB ───────────────────────────────────────────────────────────────
function FinanceTab({ data, loading }: { data: DashData; loading: boolean }) {
  const { trend: payrollTrend } = usePayrollTrend();
  const { monthly: invoiceMonthly, statusTotals } = useInvoiceMonthly();
  const { rows: costCenterRows } = useCostCenterBreakdown();

  const handleDownloadCostCSV = () => {
    const header = "Department,Headcount,Total Gross,Total Net,Avg Cost/Head,% of Total";
    const csvRows = costCenterRows.map((r) =>
      `"${r.department}",${r.headcount},${r.totalGross.toFixed(2)},${r.totalNet.toFixed(2)},${r.avgCostPerHead.toFixed(2)},${r.pctOfTotal.toFixed(1)}`
    );
    const blob = new Blob([[header, ...csvRows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cost_center_breakdown.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="space-y-4"><SkeletonRow cols={3} /><SkeletonRow cols={2} /></div>;

  const maxBar = Math.max(data?.payroll?.totalCost ?? 0, data?.invoices?.totalRevenue ?? 0, 1);

  const fmtLakhs = (n: number) => `₹${(n / 100000).toFixed(1)}L`;

  const donutData = [
    { name: 'Paid', value: statusTotals.paid, fill: '#10b981' },
    { name: 'Outstanding', value: statusTotals.outstanding, fill: '#f59e0b' },
    { name: 'Overdue >30d', value: statusTotals.overdue, fill: '#ef4444' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <SectionHeading>Financial Metrics</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.payroll ? (
            <>
              <KPICard label="Monthly Payroll Cost" value={efmt(data.payroll.totalCost, 'currency')} />
              <KPICard label="Average Salary" value={efmt(data.payroll.avgSalary, 'currency')} />
              <KPICard label="Employees Processed" value={efmt(data.payroll.processed)} />
            </>
          ) : (
            <div className="col-span-3"><Unavailable label="Payroll" /></div>
          )}
          {data?.invoices ? (
            <>
              <KPICard label="Invoice Revenue" value={efmt(data.invoices.totalRevenue, 'currency')} trend="up" />
              <KPICard label="Outstanding" value={efmt(data.invoices.outstanding, 'currency')} />
              <KPICard label="Overdue" value={efmt(data.invoices.overdue, 'currency')} trend={data.invoices.overdue > 0 ? 'down' : 'neutral'} />
            </>
          ) : (
            <div className="col-span-3"><Unavailable label="Invoices" /></div>
          )}
        </div>
      </div>

      {/* 2a: Payroll Cost Trend */}
      {payrollTrend.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <SectionHeading>Payroll Cost Trend (12 Months)</SectionHeading>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={payrollTrend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="payrollFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmtLakhs} tick={{ fontSize: 11 }} width={52} />
              <Tooltip formatter={(v: number) => fmtLakhs(v)} />
              <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} fill="url(#payrollFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 2b: Invoice Revenue trend + 2c: Outstanding donut */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {invoiceMonthly.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-5">
            <SectionHeading>Invoice Revenue (6 Months)</SectionHeading>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={invoiceMonthly} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmtLakhs} tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(v: number) => fmtLakhs(v)} />
                <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {donutData.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-5">
            <SectionHeading>Invoice Status Breakdown</SectionHeading>
            <PieChart width={220} height={160}>
              <Pie
                data={donutData}
                cx={110}
                cy={72}
                innerRadius={44}
                outerRadius={64}
                dataKey="value"
                strokeWidth={0}
              >
                {donutData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => efmt(v, 'currency')} />
            </PieChart>
          </div>
        )}
      </div>

      {(data?.payroll || data?.invoices) && (
        <div className="bg-card rounded-xl border border-border p-5">
          <SectionHeading>Cost vs Revenue</SectionHeading>
          <div className="space-y-4">
            {data?.payroll && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground font-medium">Payroll Cost</span>
                  <span className="font-semibold text-rose-700">{efmt(data.payroll.totalCost, 'currency')}</span>
                </div>
                <EProgressBar pct={(data.payroll.totalCost / maxBar) * 100} color="bg-rose-400" />
              </div>
            )}
            {data?.invoices && (
              <>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground font-medium">Invoice Revenue</span>
                    <span className="font-semibold text-emerald-700">{efmt(data.invoices.totalRevenue, 'currency')}</span>
                  </div>
                  <EProgressBar pct={(data.invoices.totalRevenue / maxBar) * 100} color="bg-emerald-500" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground font-medium">Outstanding</span>
                    <span className="font-semibold text-amber-700">{efmt(data.invoices.outstanding, 'currency')}</span>
                  </div>
                  <EProgressBar pct={(data.invoices.outstanding / maxBar) * 100} color="bg-amber-400" />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {costCenterRows.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionHeading>Cost Center Breakdown</SectionHeading>
            <button
              onClick={handleDownloadCostCSV}
              className="text-xs font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              ⬇ Download CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Department</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Headcount</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Avg Salary</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Total Payroll</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const grandTotal = costCenterRows.reduce((s, r) => s + r.totalGross, 0) || 1;
                  return costCenterRows.map((row) => {
                  const avgSalary = row.headcount > 0 ? Math.round(row.totalGross / row.headcount) : 0;
                  const sharePct = ((row.totalGross / grandTotal) * 100).toFixed(1);
                  return (
                    <tr key={row.department} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="py-2.5 font-medium text-foreground">{row.department}</td>
                      <td className="py-2.5 text-right text-foreground">{row.headcount}</td>
                      <td className="py-2.5 text-right text-foreground">{efmt(avgSalary, "currency")}</td>
                      <td className="py-2.5 text-right font-semibold text-foreground">{efmt(row.totalGross, "currency")}</td>
                      <td className="py-2.5 text-right">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                          {sharePct}%
                        </span>
                      </td>
                    </tr>
                  );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── OPERATIONS TAB ────────────────────────────────────────────────────────────
interface ProjectRow { id: string; name: string; status: string; progress: number; owner_id: string; due_date: string }

function OperationsTab({ data, loading }: { data: DashData; loading: boolean }) {
  const [slaRate, setSlaRate] = useState(0);
  const [assetData, setAssetData] = useState<{ name: string; value: number; fill: string }[]>([]);
  const [assetTotal, setAssetTotal] = useState(0);
  const [jobChartData, setJobChartData] = useState<{ department: string; Open: number; Filled: number; InPipeline: number }[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const [slaRes, totalTicketsRes, assetRes, jobRes] = await Promise.allSettled([
        supabase.from('it_tickets').select('*', { count: 'exact', head: true }).in('status', ['resolved', 'closed']),
        supabase.from('it_tickets').select('*', { count: 'exact', head: true }),
        supabase.from('assets').select('status'),
        supabase.from('job_openings').select('department, status'),
      ]);

      // SLA compliance ring
      const slaCount = slaRes.status === 'fulfilled' ? (slaRes.value.count ?? 0) : 0;
      const totalTickets = totalTicketsRes.status === 'fulfilled' ? (totalTicketsRes.value.count ?? 0) : 0;
      setSlaRate(totalTickets > 0 ? slaCount / totalTickets : 0);

      // Asset utilization donut
      if (assetRes.status === 'fulfilled' && assetRes.value.data) {
        const rows = assetRes.value.data as { status: string }[];
        const map: Record<string, number> = {};
        for (const row of rows) {
          const s = row.status ?? 'unknown';
          map[s] = (map[s] ?? 0) + 1;
        }
        setAssetTotal(rows.length);
        setAssetData(
          [
            { name: 'In Use', value: (map['in_use'] ?? 0) + (map['assigned'] ?? 0), fill: '#6366f1' },
            { name: 'Available', value: map['available'] ?? 0, fill: '#10b981' },
            { name: 'Maintenance', value: map['maintenance'] ?? 0, fill: '#f59e0b' },
            { name: 'Retired', value: map['retired'] ?? 0, fill: '#9ca3af' },
          ].filter((d) => d.value > 0)
        );
      }

      // Project health
      const projRes = await supabase.from('projects').select('id, name, status, progress, owner_id, due_date').limit(10);
      setProjects((projRes.data ?? []) as ProjectRow[]);

      // Recruitment fill rate by department
      if (jobRes.status === 'fulfilled' && jobRes.value.data) {
        const rows = jobRes.value.data as { department: string; status: string }[];
        const map: Record<string, { Open: number; Filled: number; InPipeline: number }> = {};
        for (const row of rows) {
          const dept = row.department ?? 'Unknown';
          if (!map[dept]) map[dept] = { Open: 0, Filled: 0, InPipeline: 0 };
          const s = (row.status ?? '').toLowerCase();
          if (s === 'open') map[dept].Open += 1;
          else if (s === 'filled' || s === 'hired' || s === 'closed') map[dept].Filled += 1;
          else map[dept].InPipeline += 1;
        }
        setJobChartData(
          Object.entries(map)
            .map(([department, counts]) => ({ department, ...counts }))
            .sort((a, b) => (b.Open + b.Filled + b.InPipeline) - (a.Open + a.Filled + a.InPipeline))
            .slice(0, 8)
        );
      }
    };
    void load();
  }, []);

  if (loading) return <div className="space-y-4"><SkeletonRow cols={2} /><SkeletonRow cols={2} /></div>;

  const slaR = 32, slaCx = 40, slaCy = 40, slaCircumference = 2 * Math.PI * slaR;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <SectionHeading>IT Services</SectionHeading>
          {data?.itServices ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <StatusRow label="Open Tickets" value={efmt(data.itServices.openTickets)} color="text-indigo-700" />
                <StatusRow label="SLA Breached" value={efmt(data.itServices.slaBreached)} color={data.itServices.slaBreached > 0 ? 'text-red-600' : 'text-emerald-600'} />
                <StatusRow label="Avg Resolution" value={`${data.itServices.avgResolutionHours.toFixed(1)}h`} />
              </div>
              <div className="flex flex-col items-center pt-2">
                <svg width="80" height="80">
                  <circle cx={slaCx} cy={slaCy} r={slaR} fill="none" stroke="#e5e7eb" strokeWidth="8" />
                  <circle
                    cx={slaCx} cy={slaCy} r={slaR} fill="none" stroke="#6366f1" strokeWidth="8"
                    strokeDasharray={slaCircumference}
                    strokeDashoffset={slaCircumference * (1 - slaRate)}
                    strokeLinecap="round"
                    transform="rotate(-90 40 40)"
                  />
                  <text x="40" y="44" textAnchor="middle" fontSize="13" fontWeight="bold">{Math.round(slaRate * 100)}%</text>
                </svg>
                <p className="text-xs text-muted-foreground mt-1">SLA Compliance</p>
              </div>
            </div>
          ) : (
            <Unavailable label="IT Services" />
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <SectionHeading>Asset Management</SectionHeading>
          {assetData.length > 0 ? (
            <div className="flex flex-col items-center gap-2">
              <div className="relative" style={{ width: 120, height: 120 }}>
                <PieChart width={120} height={120}>
                  <Pie
                    data={assetData}
                    cx={55}
                    cy={55}
                    innerRadius={35}
                    outerRadius={55}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {assetData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-sm font-bold text-foreground">{assetTotal}</span>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                {assetData.map((d) => (
                  <span key={d.name} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
          ) : data?.assets ? (
            <div className="space-y-1">
              <StatusRow label="Total Assets" value={efmt(data.assets.total)} />
              <StatusRow label="Assigned" value={efmt(data.assets.assigned)} color="text-indigo-700" />
              <StatusRow label="In Maintenance" value={efmt(data.assets.maintenance)} color={data.assets.maintenance > 0 ? 'text-amber-600' : 'text-emerald-600'} />
            </div>
          ) : (
            <Unavailable label="Assets" />
          )}
        </div>
      </div>

      {(data?.recruitment || jobChartData.length > 0) && (
        <div className="bg-card rounded-xl border border-border p-5">
          <SectionHeading>Recruitment Pipeline — Fill Rate by Department</SectionHeading>
          {jobChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={jobChartData} layout="vertical" margin={{ top: 4, right: 16, left: 80, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="department" tick={{ fontSize: 11 }} width={76} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Open" fill="#fca5a5" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Filled" fill="#10b981" radius={[0, 4, 4, 0]} />
                <Bar dataKey="InPipeline" name="In Pipeline" fill="#818cf8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : data?.recruitment ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Active Jobs', value: efmt(data.recruitment.activeJobs) },
                { label: 'Total Candidates', value: efmt(data.recruitment.totalCandidates) },
                { label: 'In Pipeline', value: efmt(data.recruitment.pipelineCount) },
                { label: 'Hired This Month', value: efmt(data.recruitment.hiredThisMonth) },
              ].map(({ label, value }) => (
                <div key={label} className="text-center bg-muted rounded-lg p-4">
                  <p className="text-2xl font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Project Health RAG Table */}
      {projects.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <SectionHeading>Project Health</SectionHeading>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Project Name</th>
                  <th className="text-center py-2 text-muted-foreground font-medium">RAG Status</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">% Complete</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Owner</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((proj) => {
                  const pct = proj.progress ?? 0;
                  const rag = pct > 70
                    ? { label: 'Green', cls: 'bg-emerald-100 text-emerald-700' }
                    : pct >= 40
                    ? { label: 'Amber', cls: 'bg-amber-100 text-amber-700' }
                    : { label: 'Red', cls: 'bg-red-100 text-red-700' };
                  return (
                    <tr key={proj.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="py-2.5 font-medium text-foreground">{proj.name}</td>
                      <td className="py-2.5 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rag.cls}`}>{rag.label}</span>
                      </td>
                      <td className="py-2.5 text-right font-semibold text-foreground">{pct}%</td>
                      <td className="py-2.5 text-right text-muted-foreground">{proj.owner_id}</td>
                      <td className="py-2.5 text-right text-muted-foreground">{proj.due_date ? new Date(proj.due_date).toLocaleDateString() : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── OKR TAB ───────────────────────────────────────────────────────────────────
function OKRTab({ data, loading }: { data: DashData; loading: boolean }) {
  const { deptRows, atRisk, topAligned } = useOKRDetails();
  const navigate = useNavigate();
  const [activeCycleName, setActiveCycleName] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: activeCycle } = await supabase.from('okr_cycles').select('name').eq('status', 'Active').limit(1).single();
      if (activeCycle) setActiveCycleName((activeCycle as { name: string }).name);
    };
    void load();
  }, []);

  if (loading) return <div className="space-y-4"><SkeletonRow cols={3} /></div>;

  const score = Math.round(data?.okr?.avgProgress ?? 0);
  const r = 60, cx = 80, cy = 80;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - score / 100);

  const scoreBand = score >= 70
    ? { label: 'On Track', cls: 'bg-emerald-100 text-emerald-700' }
    : score >= 40
    ? { label: 'Progressing', cls: 'bg-amber-100 text-amber-700' }
    : { label: 'Behind', cls: 'bg-red-100 text-red-700' };

  function deptBand(s: number) {
    if (s >= 70) return { label: 'On Track', cls: 'bg-emerald-100 text-emerald-700' };
    if (s >= 40) return { label: 'Progressing', cls: 'bg-amber-100 text-amber-700' };
    return { label: 'Behind', cls: 'bg-red-100 text-red-700' };
  }

  return (
    <div className="space-y-6">
      <SectionHeading>OKR Health</SectionHeading>
      {data?.okr ? (
        <>
          {/* 3a: Large centered donut */}
          <div className="bg-card rounded-xl border border-border p-6 flex flex-col items-center gap-2">
            <svg width="160" height="160">
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="12" />
              <circle
                cx={cx} cy={cy} r={r} fill="none" stroke="#6366f1" strokeWidth="12"
                strokeDasharray={circumference} strokeDashoffset={dashOffset}
                strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
              />
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight="bold" fill="#1f2937">{score}%</text>
            </svg>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Avg OKR Progress</p>
            <p className="text-sm text-gray-500 mt-1">{activeCycleName ?? 'Current Cycle'}</p>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${scoreBand.cls}`}>{scoreBand.label}</span>
            <div className="flex gap-6 mt-2 text-center">
              <div>
                <p className="text-2xl font-bold text-emerald-700">{efmt(data.okr.onTrack)}</p>
                <p className="text-xs text-muted-foreground">On Track</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{efmt(data.okr.atRisk)}</p>
                <p className="text-xs text-muted-foreground">At Risk</p>
              </div>
            </div>
          </div>

          {/* 3b: Department Breakdown Table */}
          {deptRows.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5">
              <SectionHeading>Department Breakdown</SectionHeading>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Department</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">OKR Count</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Avg Score</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Band</th>
                  </tr>
                </thead>
                <tbody>
                  {deptRows.map((row) => {
                    const band = deptBand(row.avgScore);
                    return (
                      <tr key={row.department} className="border-b border-border last:border-0 hover:bg-muted/50">
                        <td className="py-2.5 text-foreground">
                          <button
                            onClick={() => navigate(`/okr?dept=${encodeURIComponent(row.department)}`)}
                            className="text-indigo-600 hover:underline text-left"
                          >
                            {row.department}
                          </button>
                        </td>
                        <td className="py-2.5 text-right font-semibold text-foreground">{row.count}</td>
                        <td className="py-2.5 text-right font-semibold text-foreground">{Math.round(row.avgScore)}%</td>
                        <td className="py-2.5 text-right">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${band.cls}`}>{band.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 3c: At-Risk OKRs */}
          {atRisk.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5">
              <SectionHeading>At-Risk OKRs (Progress &lt; 40%)</SectionHeading>
              <div className="space-y-2">
                {atRisk.map((okr) => (
                  <div key={okr.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{okr.title}</p>
                      <p className="text-xs text-muted-foreground">{okr.owner}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">{Math.round(okr.progress)}%</span>
                    <button
                      onClick={() => navigate(`/okr?id=${okr.id}`)}
                      className="text-xs text-indigo-600 hover:underline shrink-0"
                    >
                      View →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3d: Top Aligned Individual OKRs */}
          {topAligned.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5">
              <SectionHeading>Top Aligned OKRs</SectionHeading>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Employee</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">OKR Title</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Progress</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Aligned To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topAligned.map((okr) => (
                      <tr key={okr.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                        <td className="py-2.5 text-foreground font-medium">{okr.owner}</td>
                        <td className="py-2.5 text-foreground truncate max-w-[180px]">{okr.title}</td>
                        <td className="py-2.5 text-right">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{Math.round(okr.progress ?? 0)}%</span>
                        </td>
                        <td className="py-2.5 text-right text-xs text-muted-foreground">{okr.aligned_to_okr_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <Unavailable label="OKR" />
      )}
    </div>
  );
}

// ── Scheduled Reports List ────────────────────────────────────────────────────
function ScheduledReportsList({ reports, onEdit, onDelete }: { reports: ScheduledReport[]; onEdit: (r: ScheduledReport) => void; onDelete: (id: string) => void }) {
  const { log } = useAuditLogger();

  async function runNow(r: ScheduledReport) {
    try {
      const { error } = await supabase
        .from('scheduled_reports')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', r.id);
      if (error) {
        toast.error('Failed to queue the report for delivery');
        return;
      }
      toast.success("Report queued for delivery");
      void log({ event_type: 'report_executed', action: 'run_scheduled_report', resource_type: 'scheduled_report', resource_id: r.id, severity: 'low', status: 'success' });
    } catch {
      toast.error('Failed to queue the report for delivery');
    }
  }

  if (reports.length === 0) return <p className="text-sm text-muted-foreground">{t('exec.schedule.noReports')}</p>;
  return (
    <div className="space-y-2">
      {reports.map((r) => (
        <div key={r.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0 text-sm">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{r.name}</p>
            <p className="text-xs text-muted-foreground">{r.schedule} · {t('exec.schedule.nextRun')}: {r.next_run_at ? new Date(r.next_run_at).toLocaleDateString() : '—'}</p>
          </div>
          <button
            onClick={() => void runNow(r)}
            className="text-xs text-emerald-600 hover:underline"
          >
            Run Now
          </button>
          <button onClick={() => onEdit(r)} className="text-xs text-indigo-600 hover:underline">{t('exec.schedule.edit')}</button>
          <button onClick={() => onDelete(r.id)} className="text-xs text-red-500 hover:underline">{t('exec.schedule.delete')}</button>
        </div>
      ))}
    </div>
  );
}

// ── Print CSS ─────────────────────────────────────────────────────────────────
const PRINT_CSS = `@media print { .no-print { display: none !important; } }`;

// ── KPI Layout defaults ───────────────────────────────────────────────────────
const DEFAULT_KPI_LAYOUT: GridLayoutItem[] = [
  { i: 'headcount', x: 0, y: 0, w: 4, h: 2 },
  { i: 'payroll', x: 4, y: 0, w: 4, h: 2 },
  { i: 'candidates', x: 8, y: 0, w: 4, h: 2 },
  { i: 'training', x: 0, y: 2, w: 4, h: 2 },
  { i: 'tickets', x: 4, y: 2, w: 4, h: 2 },
  { i: 'okrProgress', x: 8, y: 2, w: 4, h: 2 },
  { i: 'okrCompletion', x: 0, y: 4, w: 4, h: 2 },
  { i: 'projectHealth', x: 4, y: 4, w: 4, h: 2 },
  { i: 'securityEvents', x: 8, y: 4, w: 4, h: 2 },
  { i: 'outstandingInvoices', x: 0, y: 6, w: 4, h: 2 },
];

// ═══ Advanced analytics helpers, hooks and panels ═══════════════════════════

const ANALYTICS_CACHE_TTL = 15 * 60 * 1000;

const getCacheKey = (dept: string, from: string, to: string) =>
  `analytics_cache_${dept}_${from}_${to}`;


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

function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} style={style} />;
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

function AProgressBar({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) {
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




// ─── Anomaly types ───────────────────────────────────────────────────────────

interface Anomaly {
  id: string;
  created_at: string;
  metric_key: string;
  deviation_percent: number;
  severity: 'amber' | 'red';
  resolved_at: string | null;
}

// ─── Anomalies Panel ─────────────────────────────────────────────────────────

function AnomaliesPanel() {
  const { currentUser: user } = useUser();
  const [open, setOpen] = useState(false);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadAnomalies() {
      try {
        const { data, error } = await supabase
          .from('analytics_anomalies')
          .select('id, created_at, metric_key, deviation_percent, severity, resolved_at')
          .order('created_at', { ascending: false })
          .limit(20);
        if (cancelled) return;
        if (error) {
          // Table may not exist yet — show empty state instead of error toast
          setAnomalies([]);
          return;
        }
        if (data) setAnomalies(data as Anomaly[]);
      } catch {
        if (!cancelled) setAnomalies([]);
      }
    }
    void loadAnomalies();
    return () => { cancelled = true; };
  }, [open]);

  async function markResolved(id: string) {
    const role = user?.primaryRole as string | undefined;
    if (role !== 'admin' && role !== 'analytics_admin') {
      toast.error("You don't have permission to resolve anomalies");
      return;
    }
    setResolving(id);
    try {
      const { error } = await supabase
        .from('analytics_anomalies')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        toast.error('Failed to resolve the anomaly');
        setResolving(null);
        return;
      }
      setAnomalies(prev => prev.map(a => a.id === id ? { ...a, resolved_at: new Date().toISOString() } : a));
    } catch {
      toast.error('Failed to resolve the anomaly');
      setResolving(null);
      return;
    }
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
                      <td className="py-2.5 pr-4 text-gray-600">{a.created_at?.slice(0, 10)}</td>
                      <td className="py-2.5 pr-4 text-gray-800 font-medium">{a.metric_key}</td>
                      <td className="py-2.5 pr-4 text-gray-700">{a.deviation_percent?.toFixed(1)}%</td>
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

function AdvOverviewTab({
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

  // Previous period values for comparison mode — sourced strictly from the
  // real prior-period query (no synthetic factors).
  const prevValues = useMemo(() => {
    const result: Record<string, string> = {};
    if (prevStats) {
      result['Headcount'] = String(prevStats.headcount);
      result['Monthly Payroll'] = `$${prevStats.payrollTotal >= 1000000 ? `${(prevStats.payrollTotal / 1000000).toFixed(1)}M` : prevStats.payrollTotal >= 1000 ? `${(prevStats.payrollTotal / 1000).toFixed(1)}k` : String(prevStats.payrollTotal)}`;
      result['Training Completion'] = `${prevStats.trainingRate.toFixed(1)}%`;
    }
    return result;
  }, [prevStats]);

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
            prevValue={compareMode ? prevValues[k.label] : undefined}
            computedAt={lastFetched ?? undefined}
          />
        ))}
      </div>

      {compareMode && !loading && (
        <div className="mt-4 overflow-x-auto">
          <div className="flex gap-2 pb-1 min-w-max">
            {kpis.map((k) => {
              const prevStr = prevValues[k.label];
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

  // Training snapshot from DB via allStats — current period only
  const snapshotChartData = useMemo(() => {
    const enrolled = num(get(tr, "totalEnrolled") ?? get(tr, "enrolled") ?? 0);
    const completed = num(get(tr, "totalCompleted") ?? get(tr, "completed") ?? 0);
    const inProgress = num(get(tr, "inProgress") ?? get(tr, "active") ?? 0);
    const overdue = num(get(tr, "overdue") ?? get(tr, "overdueCount") ?? 0);
    return [
      { label: "Enrolled", value: enrolled },
      { label: "Completed", value: completed },
      { label: "In Progress", value: inProgress },
      { label: "Overdue", value: overdue },
    ].filter(d => d.value > 0);
  }, [tr]);

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

      {snapshotChartData.length > 0 && (
        <DashCard>
          <SectionTitle>Training Enrollment</SectionTitle>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={snapshotChartData}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="value" name="Count" fill="#4F46E5" radius={[3, 3, 0, 0]}>
                  {snapshotChartData.map((_, i) => (
                    <Cell key={i} fill={['#4F46E5', '#10b981', '#f59e0b', '#ef4444'][i % 4]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashCard>
      )}
    </div>
  );
}

// ─── People & HR ─────────────────────────────────────────────────────────────

function AdvPeopleTab({ allStats, loading }: { allStats: Record<string, unknown>; loading: boolean }) {
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
                  <AProgressBar value={count} max={pipelineTotal} color="bg-purple-500" />
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
                  <AProgressBar value={count} max={maxRating} color="bg-yellow-400" />
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
            <AProgressBar value={completionRate} max={100} color="bg-teal-500" />
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

function AdvFinanceTab({ allStats, loading }: { allStats: Record<string, unknown>; loading: boolean }) {
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

function AdvOperationsTab({ allStats, loading }: { allStats: Record<string, unknown>; loading: boolean }) {
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
                  <AProgressBar value={item.pctV} max={100} color={item.color} />
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
    let cancelled = false;
    async function loadLatestRun() {
      try {
        const { data, error } = await supabase
          .from('report_runs')
          .select('*')
          .eq('report_id', report.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (cancelled) return;
        setRun(!error && data && data.length > 0 ? (data[0] as ReportRun) : null);
      } catch {
        if (!cancelled) setRun(null);
      }
    }
    void loadLatestRun();
    return () => { cancelled = true; };
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
    try {
      if (initialData?.id) {
        const { error } = await supabase
          .from('analytics_saved_reports')
          .update(payload)
          .eq('id', initialData.id);
        if (error) {
          toast.error("Failed to save the report. Please try again.");
          setSaving(false);
          return;
        }
        logReport({ event_type: 'report_saved', action: 'report_saved', resource_id: initialData.id, metadata: { report_name: reportName.trim(), domains: Array.from(selectedDomains) } });
      } else {
        const { error } = await supabase
          .from('analytics_saved_reports')
          .insert([{ ...payload, last_run_at: null }]);
        if (error) {
          toast.error("Failed to save the report. Please try again.");
          setSaving(false);
          return;
        }
        logReport({ event_type: 'report_saved', action: 'report_saved', metadata: { report_name: reportName.trim(), domains: Array.from(selectedDomains) } });
      }
      toast.success(t('analytics.reports.saved'));
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to save the report. Please try again.");
    } finally {
      setSaving(false);
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
  const { currentUser: user } = useUser();
  const { log: logSavedReport } = useAuditLogger();
  const userRole = user?.primaryRole as string | undefined;
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingReport, setEditingReport] = useState<SavedReport | null>(null);
  const [viewOutputReport, setViewOutputReport] = useState<SavedReport | null>(null);
  const [postToCommsHub, setPostToCommsHub] = useState(false);

  async function fetchReports() {
    setLoadingReports(true);
    try {
      const { data, error } = await supabase
        .from('analytics_saved_reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        toast.error('Failed to load saved reports');
      } else if (data) {
        setReports(data as SavedReport[]);
      }
    } catch {
      toast.error('Failed to load saved reports');
    } finally {
      setLoadingReports(false);
    }
  }

  useEffect(() => { void fetchReports(); }, []);

  async function handleDelete(report: SavedReport) {
    if (report.created_by !== user?.id && userRole !== 'admin' && userRole !== 'analytics_admin') {
      toast.error("Only the report creator or an admin can delete this report.");
      return;
    }
    setDeletingId(report.id);
    try {
      const { error } = await supabase.from('analytics_saved_reports').delete().eq('id', report.id);
      if (error) {
        toast.error('Failed to delete the report');
        return;
      }
      logSavedReport({ event_type: 'report_deleted', action: 'report_deleted', resource_id: report.id, metadata: { report_id: report.id } });
      setReports(prev => prev.filter(r => r.id !== report.id));
      toast.success(t('analytics.reports.deleted'));
    } catch {
      toast.error('Failed to delete the report');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRunNow(report: SavedReport) {
    try {
      const { error } = await supabase
        .from('analytics_saved_reports')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', report.id);
      if (error) {
        toast.error('Failed to start the report run');
        return;
      }
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, last_run_at: new Date().toISOString() } : r));
      toast.success(`"${report.name}" ${t('analytics.reports.runStarted')}`);
      if (postToCommsHub) {
        const cfg = report.config as { domains?: string[]; metrics?: string[] } | undefined;
        const { error: annError } = await supabase.from('announcements').insert([{
          title: `Analytics Report: ${report.name}`,
          content: `Report "${report.name}" was run on ${new Date().toLocaleDateString()}. Domain: ${cfg?.domains?.join(', ') ?? 'N/A'}. Metrics: ${cfg?.metrics?.join(', ') ?? 'N/A'}.`,
          type: 'report_summary',
          author_id: user?.id,
          published: true,
          created_at: new Date().toISOString(),
        }]);
        if (annError) {
          toast.error('Failed to post the summary to Communications Hub');
        } else {
          toast.success("Summary posted to Communications Hub");
        }
      }
    } catch {
      toast.error('Failed to start the report run');
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
          onSaved={() => void fetchReports()}
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
    // Try the exact key first, then common API field-name variants
    const FALLBACKS: Record<string, string[]> = {
      totalEmployees: ['totalEmployees', 'total', 'count', 'employeeCount'],
      activeEmployees: ['activeEmployees', 'active', 'activeCount'],
      activeCandidates: ['activeCandidates', 'active', 'totalCandidates'],
      averageRating: ['averageRating', 'avgRating', 'average'],
      completionRate: ['completionRate', 'completion', 'completionPercentage'],
      inProgress: ['inProgress', 'active', 'totalInProgress'],
      totalMonthlyCost: ['totalMonthlyCost', 'totalCost', 'monthlyTotal', 'totalPayroll'],
      averageSalary: ['averageSalary', 'avgSalary', 'average'],
      totalRevenue: ['totalRevenue', 'revenue', 'totalAmount'],
      outstandingAmount: ['outstandingAmount', 'outstanding'],
      overdueAmount: ['overdueAmount', 'overdue'],
      totalValue: ['totalValue', 'value', 'totalCost'],
      openTickets: ['openTickets', 'open', 'totalOpen'],
      resolvedTickets: ['resolvedTickets', 'resolved', 'totalResolved'],
      activeProjects: ['activeProjects', 'active', 'totalActive'],
      completedProjects: ['completedProjects', 'completed', 'totalCompleted'],
      onTrack: ['onTrack', 'onTrackCount'],
      atRisk: ['atRisk', 'atRiskCount'],
      totalArticles: ['totalArticles', 'articles', 'total'],
    };
    const keys = FALLBACKS[key] ?? [key];
    for (const k of keys) {
      const val = domainData[k];
      if (val != null) {
        const n = Number(val);
        if (!isNaN(n)) {
          // Format numbers nicely
          if (key.includes('Cost') || key.includes('Revenue') || key.includes('Amount') || key.includes('Value') || key.includes('Salary')) {
            return n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n.toLocaleString()}`;
          }
          if (key.includes('Rate') || key.includes('Pct') || key.includes('Percent')) {
            return `${n.toFixed(1)}%`;
          }
          return n.toLocaleString();
        }
        return String(val);
      }
    }
    return 'N/A';
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

function usePredictiveHistory() {
  const [headcountMonths, setHeadcountMonths] = useState<{ label: string; value: number }[]>([]);
  const [payrollMonths, setPayrollMonths] = useState<{ label: string; value: number }[]>([]);
  const [trainingMonths, setTrainingMonths] = useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const monthLabels = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - 5 + i);
        d.setDate(1);
        return {
          label: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
          start: d.toISOString(),
          end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString(),
        };
      });

      const [empRes, payRes, trainRes] = await Promise.allSettled([
        supabase.from('employees').select('created_at, status'),
        supabase.from('payroll_records').select('gross_salary, payment_date')
          .gte('payment_date', monthLabels[0].start),
        supabase.from('training_enrollments').select('status, created_at')
          .gte('created_at', monthLabels[0].start),
      ]);

      if (cancelled) return;

      // Headcount: cumulative total by month-end
      if (empRes.status === 'fulfilled' && empRes.value.data) {
        const rows = empRes.value.data as { created_at: string; status: string }[];
        const hcData = monthLabels.map(m => ({
          label: m.label,
          value: rows.filter(r => r.created_at <= m.end).length,
        }));
        setHeadcountMonths(hcData);
      }

      // Payroll: sum by month
      if (payRes.status === 'fulfilled' && payRes.value.data) {
        const rows = payRes.value.data as { gross_salary: number; payment_date: string }[];
        const payData = monthLabels.map(m => ({
          label: m.label,
          value: rows.filter(r => r.payment_date >= m.start && r.payment_date <= m.end)
            .reduce((s, r) => s + (r.gross_salary ?? 0), 0),
        }));
        setPayrollMonths(payData);
      }

      // Training: completion rate by month
      if (trainRes.status === 'fulfilled' && trainRes.value.data) {
        const rows = trainRes.value.data as { status: string; created_at: string }[];
        const trData = monthLabels.map(m => {
          const monthRows = rows.filter(r => r.created_at >= m.start && r.created_at <= m.end);
          if (monthRows.length === 0) return { label: m.label, value: 0 };
          const completed = monthRows.filter(r => r.status === 'completed').length;
          return { label: m.label, value: Math.round((completed / monthRows.length) * 100) };
        });
        setTrainingMonths(trData);
      }

      if (!cancelled) setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return { headcountMonths, payrollMonths, trainingMonths, loading };
}

function PredictiveTab({ allStats: _allStats }: { allStats: Record<string, unknown> }) {
  const { headcountMonths, payrollMonths, trainingMonths, loading: histLoading } = usePredictiveHistory();

  const headcountHistory = useMemo(() => headcountMonths.map(m => m.value), [headcountMonths]);
  const payrollHistory = useMemo(() => payrollMonths.map(m => m.value), [payrollMonths]);
  const trainingHistory = useMemo(() => trainingMonths.filter(m => m.value > 0).map(m => m.value), [trainingMonths]);
  const payrollLabels = useMemo(() => payrollMonths.map(m => m.label), [payrollMonths]);

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

  const histLabels6 = useMemo(() => headcountMonths.map(m => m.label), [headcountMonths]);

  const headcountData = useMemo(
    () => [
      ...headcountHistory.map((v, i) => ({ label: histLabels6[i] ?? `M${i + 1}`, actual: v, forecast: undefined as number | undefined })),
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
      ...trainingHistory.map((v, i) => ({ label: trainingMonths[i]?.label ?? `M${i + 1}`, actual: v, forecast: undefined as number | undefined })),
      ...trainingForecast.map((v, i) => ({ label: futureLabels[i], actual: undefined as number | undefined, forecast: v })),
    ],
    [trainingHistory, trainingForecast, trainingMonths, futureLabels],
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

  if (histLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3].map(i => (
          <DashCard key={i}>
            <Skeleton className="h-5 w-40 mb-4" />
            <Skeleton className="h-48 w-full" />
          </DashCard>
        ))}
      </div>
    );
  }

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

    let cancelled = false;
    async function loadFunnels() {
      try {
        const [recruitRes, onboardRes] = await Promise.allSettled([recruitQuery, onboardQuery]);
        if (cancelled) return;
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

      } catch {
        if (!cancelled) {
          setRecruitSteps([]);
          setOnboardSteps([]);
        }
      } finally {
        if (!cancelled) setFunnelLoading(false);
      }
    }
    void loadFunnels();
    return () => { cancelled = true; };
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


// ═══ MAIN COMPONENT ═════════════════════════════════════════════════════════

function UnifiedAnalyticsDashboard({ onLogout }: UnifiedAnalyticsDashboardProps) {
  const { currentUser } = useUser();
  const { log } = useAuditLogger();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // ── Access control ────────────────────────────────────────────────────────
  const allowedRoles = ['admin', 'manager', 'finance', 'hr'];
  const hasAccess = currentUser?.roles?.some((r: string) => allowedRoles.includes(r)) ?? false;
  const canCustomize = currentUser?.roles?.some((r: string) => ['admin', 'manager'].includes(r)) ?? false;

  // ── Date range (executive style buttons + advanced custom range) ──────────
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [dateRangeError, setDateRangeError] = useState<string>('');
  const [dateRangeWarning, setDateRangeWarning] = useState<string>('');

  const [department, setDepartment] = useState<string>('All');
  const [compareMode, setCompareMode] = useState(false);
  const [prevStats, setPrevStats] = useState<{ headcount: number; payrollTotal: number; trainingRate: number } | null>(null);
  const [anomalyMap, setAnomalyMap] = useState<Record<string, AnomalyDot>>({});
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ── Executive data sources ────────────────────────────────────────────────
  const { data, loading, refresh } = useExecutiveDashboardData(dateRange);
  const { kpis: realKpis, deptBreakdown, loading: realLoading, refresh: refreshReal } = useRealKPIs(dateRange, hasAccess);

  // ── Advanced analytics data source ────────────────────────────────────────
  const advRange = useCustomRange ? 'custom' : DATE_RANGE_DAYS[dateRange];
  const hookOpts = useMemo(() => ({
    department,
    dateRange: advRange,
    startDate: useCustomRange ? customStart : undefined,
    endDate: useCustomRange ? customEnd : undefined,
  }), [department, advRange, useCustomRange, customStart, customEnd]);

  const { allStats, loading: advLoading, refresh: refreshAdv } = useAdvancedAnalyticsData(hookOpts);

  const dateStart = useCustomRange ? customStart : advRange;
  const dateEnd = useCustomRange ? customEnd : '';

  useEffect(() => {
    if (!advLoading) setLastFetched(new Date());
  }, [advLoading]);

  // ── Alerts + scheduled reports ────────────────────────────────────────────
  const { alerts, alertsRefreshedAt } = useAlerts();
  const userId = currentUser?.email ?? currentUser?.id ?? '';
  const { reports, reload: reloadReports } = useScheduledReports(userId);

  // ── Customizable overview layout ──────────────────────────────────────────
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [kpiLayout, setKpiLayout] = useState<GridLayoutItem[]>(() => {
    try {
      const saved = localStorage.getItem('exec_dashboard_layout');
      return saved ? JSON.parse(saved) : DEFAULT_KPI_LAYOUT;
    } catch {
      return DEFAULT_KPI_LAYOUT;
    }
  });

  function handleKpiLayoutChange(newLayout: GridLayoutItem[]) {
    setKpiLayout(newLayout);
    localStorage.setItem('exec_dashboard_layout', JSON.stringify(newLayout));
  }

  // ── Modals ────────────────────────────────────────────────────────────────
  type DrillType = 'headcount' | 'candidates' | 'tickets' | 'okr' | null;
  const [drillType, setDrillType] = useState<DrillType>(null);
  const [drillDownKPI, setDrillDownKPI] = useState<string | null>(null);
  const handleCloseDrillDown = useCallback(() => setDrillDownKPI(null), []);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);
  const [showAnomalies, setShowAnomalies] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const lastUpdatedLabel = useMemo(
    () => (data ? minutesAgo(data.lastUpdated) : '—'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data?.lastUpdated]
  );

  const dashboardRef = useRef<HTMLDivElement>(null);

  // Inject print CSS once
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  // ── Department manager force-filter ───────────────────────────────────────
  const isDeptManager = (currentUser?.primaryRole as string | undefined) === 'department_manager'
    || (currentUser?.roles?.includes('department_manager' as never) ?? false);

  useEffect(() => {
    if (isDeptManager && currentUser?.department) setDepartment(currentUser.department);
  }, [isDeptManager, currentUser?.department]);

  // ── Anomaly dots for the advanced KPI cards ───────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadAnomalyDots() {
      try {
        const { data: anomalyData, error } = await supabase
          .from('analytics_anomalies')
          .select('id, metric_key, severity, deviation_percent, resolved_at')
          .is('resolved_at', null);
        if (error || !anomalyData || cancelled) return;
        const map: Record<string, AnomalyDot> = {};
        (anomalyData as Array<Record<string, unknown>>).forEach((a) => {
          const key = String(a.metric_key ?? '');
          if (key) {
            map[key] = {
              severity: (a.severity as 'amber' | 'red') ?? 'amber',
              metric_name: key,
              deviation_percent: a.deviation_percent != null ? Number(a.deviation_percent) : undefined,
            };
          }
        });
        setAnomalyMap(map);
      } catch {
        // non-fatal — KPI cards simply render without anomaly dots
      }
    }
    void loadAnomalyDots();
    return () => { cancelled = true; };
  }, []);

  // ── Comparison mode: real prior-period figures ────────────────────────────
  useEffect(() => {
    if (!compareMode) { setPrevStats(null); return; }
    let cancelled = false;
    const days = parseInt(DATE_RANGE_DAYS[dateRange], 10);
    const actualEnd = useCustomRange ? customEnd : new Date().toISOString().split('T')[0];
    const actualStart = useCustomRange
      ? customStart
      : new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    if (!actualStart || !actualEnd) return;
    const diffMs = new Date(actualEnd).getTime() - new Date(actualStart).getTime();
    const priorEnd = new Date(new Date(actualStart).getTime() - 1).toISOString().split('T')[0];
    const priorStart = new Date(new Date(actualStart).getTime() - diffMs - 1).toISOString().split('T')[0];

    async function loadPrevStats() {
      try {
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
        if (cancelled) return;
        const prevPayrollTotal = (payrollRes.data ?? []).reduce(
          (s: number, r: { gross_salary?: number | null }) => s + (r.gross_salary ?? 0), 0);
        const prevHeadcount = (employeesRes.data ?? []).length;
        const trainingRows = trainingRes.data ?? [];
        const completed = trainingRows.filter((r: { status?: string | null }) => r.status === 'completed').length;
        const prevTrainingRate = trainingRows.length > 0 ? (completed / trainingRows.length) * 100 : 0;
        setPrevStats({ headcount: prevHeadcount, payrollTotal: prevPayrollTotal, trainingRate: prevTrainingRate });
      } catch {
        if (!cancelled) setPrevStats(null);
      }
    }
    void loadPrevStats();
    return () => { cancelled = true; };
  }, [compareMode, dateRange, useCustomRange, customStart, customEnd, department]);

  // ── 15-minute localStorage cache of advanced stats ────────────────────────
  useEffect(() => {
    if (!advLoading && allStats && Object.keys(allStats).length > 0) {
      try {
        localStorage.setItem(
          getCacheKey(department, dateStart, dateEnd),
          JSON.stringify({ data: allStats, ts: Date.now() }),
        );
      } catch {
        // ignore storage errors (quota / private mode)
      }
    }
  }, [advLoading, allStats, department, dateStart, dateEnd]);

  // ── Refresh everything ────────────────────────────────────────────────────
  async function handleRefresh() {
    try {
      localStorage.removeItem(getCacheKey(department, dateStart, dateEnd));
    } catch {
      // ignore
    }
    setRefreshing(true);
    await Promise.all([refresh(), refreshReal(), refreshAdv()]);
    setLastFetched(new Date());
    setRefreshing(false);
  }

  // ── Exports ───────────────────────────────────────────────────────────────
  function checkExportRateLimit() {
    const today = new Date().toDateString();
    const key = `unified_export_${today}`;
    const count = parseInt(localStorage.getItem(key) || '0', 10);
    if (count >= 5) {
      toast.error("Export limit reached (5/day). Try again tomorrow.");
      return false;
    }
    localStorage.setItem(key, String(count + 1));
    return true;
  }

  function handleExportPdf() {
    if (!checkExportRateLimit()) return;
    const originalTitle = document.title;
    document.title = `Analytics Dashboard - ${useCustomRange ? `${customStart} → ${customEnd}` : DATE_RANGE_LABELS[dateRange]}`;
    const style = document.createElement('style');
    style.id = 'analytics-print-css';
    style.textContent = '@media print { .no-print { display: none !important; } .kpi-grid { grid-template-columns: repeat(3, 1fr) !important; } body { font-size: 10pt; } * { page-break-inside: avoid; } }';
    document.head.appendChild(style);
    window.onafterprint = () => {
      document.getElementById('analytics-print-css')?.remove();
      document.title = originalTitle;
      window.onafterprint = null;
    };
    void log({ event_type: 'analytics_exported', action: 'export_pdf', resource_type: 'unified_analytics', severity: 'low', status: 'success', metadata: { format: 'pdf' } });
    window.print();
  }

  async function handleExportPNG() {
    if (!dashboardRef.current) return;
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `unified_png_exports_${today}`;
    const count = parseInt(localStorage.getItem(storageKey) || '0', 10);
    if (count >= 3) {
      toast.error('PNG export limit reached (3 per day). Try again tomorrow.');
      return;
    }
    localStorage.setItem(storageKey, String(count + 1));
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `analytics-dashboard-${today}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      void log({ event_type: 'analytics_exported', action: 'export_png', resource_type: 'unified_analytics', severity: 'low', status: 'success', metadata: { format: 'png' } });
    } catch {
      toast.error('PNG export failed. Please try again.');
    }
  }

  function handleExportCSV() {
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
    void log({ event_type: 'analytics_exported', action: 'export_csv', resource_type: 'unified_analytics', severity: 'low', status: 'success', metadata: { format: 'csv' } });
    toast.success('Report exported successfully');
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

    // Sheet 1 — Overview KPIs
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

    // Sheet 2 — People & HR (live department breakdown from Supabase)
    const peopleRows: Record<string, string | number>[] = deptBreakdown.length > 0
      ? deptBreakdown.map((d) => ({ Department: d.department, 'Employee Count': d.count }))
      : [
          { Department: 'Total Employees', 'Employee Count': num(get(dir, 'totalEmployees') ?? get(dir, 'total') ?? get(dir, 'count')) },
        ];

    // Sheet 3 — Finance
    const payMonths = (get(pay, 'monthlyBreakdown') ?? get(pay, 'months') ?? []) as Array<Record<string, unknown>>;
    const financeRows: Record<string, string | number>[] = payMonths.length > 0
      ? payMonths.map((m) => ({
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

    // Sheet 4 — Operations
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
    void log({ event_type: 'analytics_exported', action: 'export_excel', resource_type: 'unified_analytics', severity: 'low', status: 'success', metadata: { format: 'excel', domain_count: Object.keys(allStats).length } });
    toast.success('Excel file exported successfully');
  }

  async function handleDeleteReport(id: string) {
    try {
      const { error } = await supabase.from('scheduled_reports').delete().eq('id', id);
      if (error) {
        toast.error('Failed to delete scheduled report');
        return;
      }
      await reloadReports();
      toast.success('Scheduled report deleted');
    } catch {
      toast.error('Failed to delete scheduled report');
    }
  }

  // ── Custom date range validation ──────────────────────────────────────────
  function validateRange(start: string, end: string) {
    let error = '';
    let warning = '';
    const today = new Date().toISOString().split('T')[0];
    if (start && start > today) {
      error = 'Start date cannot be in the future';
    } else if (start && end && end <= start) {
      error = 'End date must be after start date';
    } else if (start && end) {
      const diffDays = (new Date(end).getTime() - new Date(start).getTime()) / 86400000;
      if (diffDays < 1) error = 'Date range must be at least 1 day';
      else if (diffDays > 365) warning = 'Large date ranges may take longer to load';
    }
    setDateRangeError(error);
    setDateRangeWarning(warning);
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-muted-foreground text-lg font-medium">{t('exec.accessDenied')}</p>
          <p className="text-muted-foreground text-sm mt-1">{t('exec.accessDeniedMsg')}</p>
          {onLogout && (
            <button
              onClick={onLogout}
              className="mt-4 px-3 py-1.5 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              {t('common.logout')}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Executive drill-modal data ────────────────────────────────────────────
  let drillTitle = '';
  let drillRows: DrillRow[] = [];
  let drillChart: { name: string; value: number }[] | undefined;

  if (drillType === 'headcount') {
    drillTitle = t('exec.kpi.headcount') + ' — ' + t('exec.drill.department');
    drillRows = deptBreakdown.map((d) => ({ label: d.department, value: d.count }));
    drillChart = deptBreakdown.slice(0, 8).map((d) => ({ name: d.department, value: d.count }));
  } else if (drillType === 'candidates') {
    drillTitle = t('exec.kpi.activeCandidates');
    drillRows = data?.recruitment ? [
      { label: 'Active Jobs', value: data.recruitment.activeJobs },
      { label: 'Total Candidates', value: data.recruitment.totalCandidates },
      { label: 'In Pipeline', value: data.recruitment.pipelineCount },
      { label: 'Hired This Month', value: data.recruitment.hiredThisMonth },
    ] : [];
  } else if (drillType === 'tickets') {
    drillTitle = t('exec.kpi.openItTickets');
    drillRows = data?.itServices ? [
      { label: 'Open Tickets', value: data.itServices.openTickets },
      { label: 'SLA Breached', value: data.itServices.slaBreached },
      { label: 'Avg Resolution (hrs)', value: data.itServices.avgResolutionHours.toFixed(1) },
    ] : [];
  } else if (drillType === 'okr') {
    drillTitle = t('exec.kpi.okrProgress');
    drillRows = data?.okr ? [
      { label: 'Avg Progress', value: efmt(data.okr.avgProgress, 'percent') },
      { label: 'On Track', value: data.okr.onTrack },
      { label: 'At Risk', value: data.okr.atRisk },
    ] : [];
  }

  const anyLoading = loading || realLoading || advLoading || refreshing;

  return (
    <div className="min-h-screen bg-muted">
      <div ref={dashboardRef} className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ── Header + toolbar ── */}
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 no-print">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {useCustomRange && customStart && customEnd
                ? `${customStart} → ${customEnd}`
                : DATE_RANGE_LABELS[dateRange]}
              {' · '}{t('exec.lastUpdated')}: {lastUpdatedLabel}
              {lastFetched ? ` · Data as of ${timeAgo(lastFetched)}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Preset date ranges — dropdown */}
            <select
              value={useCustomRange ? 'custom' : dateRange}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setUseCustomRange(true);
                } else {
                  setDateRange(e.target.value as DateRange);
                  setUseCustomRange(false);
                  setDateRangeError('');
                  setDateRangeWarning('');
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-foreground bg-card hover:bg-muted transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
              aria-label="Date range"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last 12 months</option>
              <option value="custom">Custom range…</option>
            </select>

            {useCustomRange && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => { const v = e.target.value; setCustomStart(v); validateRange(v, customEnd); }}
                    className={`px-2 py-1.5 rounded-lg border text-sm text-muted-foreground bg-card ${dateRangeError ? 'border-red-400' : 'border-border'}`}
                    aria-label="Start date"
                  />
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => { const v = e.target.value; setCustomEnd(v); validateRange(customStart, v); }}
                    className={`px-2 py-1.5 rounded-lg border text-sm text-muted-foreground bg-card ${dateRangeError ? 'border-red-400' : 'border-border'}`}
                    aria-label="End date"
                  />
                </div>
                {dateRangeError && <span className="text-xs text-red-500">{dateRangeError}</span>}
                {!dateRangeError && dateRangeWarning && <span className="text-xs text-amber-500">{dateRangeWarning}</span>}
              </div>
            )}

            {/* Department filter */}
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              disabled={isDeptManager}
              className="px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground bg-card hover:bg-muted transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Department filter"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>
              ))}
            </select>

            {/* Comparison toggle */}
            <button
              onClick={() => setCompareMode((v) => !v)}
              className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${compareMode ? 'bg-blue-600 text-white border-blue-600' : 'border-border text-muted-foreground hover:bg-muted'}`}
            >
              {t('analytics.compare.toggle')}
            </button>

            <button
              onClick={() => void handleRefresh()}
              disabled={anyLoading || !!dateRangeError}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
            >
              <span className={anyLoading ? 'animate-spin inline-block' : ''}>↻</span>
              {t('exec.refresh')}
            </button>

            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors"
              >
                ⬇ Export
                <span className="text-xs opacity-60 ml-0.5">▾</span>
              </button>
              {showExportMenu && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-card border border-border rounded-xl shadow-lg overflow-hidden"
                  onMouseLeave={() => setShowExportMenu(false)}
                >
                  <button
                    onClick={() => { handleExportCSV(); setShowExportMenu(false); }}
                    disabled={advLoading}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    ⬇ CSV
                  </button>
                  <button
                    onClick={() => { void handleExportExcel(); setShowExportMenu(false); }}
                    disabled={advLoading}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    📊 Excel
                  </button>
                  <button
                    onClick={() => { handleExportPdf(); setShowExportMenu(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    🖨 PDF
                  </button>
                  <button
                    onClick={() => { void handleExportPNG(); setShowExportMenu(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    🖼 PNG
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => { setEditingReport(null); setShowScheduleModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
            >
              📅 {t('exec.schedule.button')}
            </button>

            {canCustomize && activeTab === 'overview' && (
              <>
                <button
                  onClick={() => setIsCustomizing(!isCustomizing)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${isCustomizing ? 'bg-indigo-600 text-white border-indigo-600' : 'border-border text-muted-foreground hover:bg-muted'}`}
                >
                  {isCustomizing ? 'Done' : 'Customize'}
                </button>
                {isCustomizing && (
                  <button
                    onClick={() => { setKpiLayout(DEFAULT_KPI_LAYOUT); localStorage.removeItem('exec_dashboard_layout'); }}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Reset Layout
                  </button>
                )}
              </>
            )}

            <ReportDefectButton appName="Analytics Dashboard" />
          </div>
        </div>

        {/* ── Main layout: tabs + right sidebar ── */}
        <div className="flex flex-col xl:flex-row gap-6">
          <div className="flex-1 min-w-0 space-y-4">
            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-border no-print [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === id
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="space-y-8">
              {activeTab === 'overview' && (
                <OverviewTab
                  data={data}
                  loading={loading}
                  realKpis={realKpis}
                  realLoading={realLoading}
                  onDrillHeadcount={() => setDrillType('headcount')}
                  onDrillCandidates={() => setDrillType('candidates')}
                  onDrillTickets={() => setDrillType('tickets')}
                  onDrillOKR={() => setDrillType('okr')}
                  isCustomizing={isCustomizing}
                  kpiLayout={kpiLayout}
                  onKpiLayoutChange={handleKpiLayoutChange}
                />
              )}

              {activeTab === 'people' && (
                <>
                  <PeopleTab data={data} loading={loading} deptBreakdown={deptBreakdown} />
                  <div>
                    <SectionHeading>Additional People Analytics</SectionHeading>
                    <AdvPeopleTab allStats={allStats} loading={advLoading} />
                  </div>
                </>
              )}

              {activeTab === 'finance' && (
                <>
                  <FinanceTab data={data} loading={loading} />
                  <div>
                    <SectionHeading>Additional Finance Analytics</SectionHeading>
                    <AdvFinanceTab allStats={allStats} loading={advLoading} />
                  </div>
                </>
              )}

              {activeTab === 'operations' && (
                <>
                  <OperationsTab data={data} loading={loading} />
                  <div>
                    <SectionHeading>Additional Operations Analytics</SectionHeading>
                    <AdvOperationsTab allStats={allStats} loading={advLoading} />
                  </div>
                </>
              )}

              {activeTab === 'okr' && <OKRTab data={data} loading={loading} />}
              {activeTab === 'timeline' && <TimelineTab />}
              {activeTab === 'reports' && <ReportsTab allStats={allStats} />}
              {activeTab === 'predictive' && <PredictiveTab allStats={allStats} />}
              {activeTab === 'cohort' && <CohortTab dept={department} />}
              {activeTab === 'funnel' && (
                <FunnelTab dateRange={useCustomRange ? 'custom' : DATE_RANGE_DAYS[dateRange]} customStart={customStart} />
              )}
            </div>

            {/* Scheduled reports */}
            {reports.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-5 no-print">
                <SectionHeading>{t('exec.schedule.title')}</SectionHeading>
                <ScheduledReportsList
                  reports={reports}
                  onEdit={(r) => { setEditingReport(r); setShowScheduleModal(true); }}
                  onDelete={(id) => void handleDeleteReport(id)}
                />
              </div>
            )}
          </div>

          {/* Right sidebar: anomalies (collapsible) + alerts + quick actions */}
          <div className="hidden xl:flex flex-col gap-4 w-80 shrink-0 no-print">
            <div>
              <button
                onClick={() => setShowAnomalies((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                <span>Anomaly Detection</span>
                <span className="text-muted-foreground">{showAnomalies ? '▾' : '▸'}</span>
              </button>
              {showAnomalies && (
                <div className="mt-3">
                  <AnomaliesPanel />
                </div>
              )}
            </div>
            <AlertsPanel alerts={alerts} setActiveTab={setActiveTab} lastRefreshed={alertsRefreshedAt} />
            <QuickActionsPanel />
          </div>
        </div>

        {/* Mobile: anomalies + alerts + quick actions below content */}
        <div className="xl:hidden space-y-4 no-print">
          <button
            onClick={() => setShowAnomalies((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <span>Anomaly Detection</span>
            <span className="text-muted-foreground">{showAnomalies ? '▾' : '▸'}</span>
          </button>
          {showAnomalies && <AnomaliesPanel />}
          <AlertsPanel alerts={alerts} setActiveTab={setActiveTab} />
          <QuickActionsPanel />
        </div>
      </div>

      {/* Executive drill-through modal */}
      {drillType && (
        <DrillModal
          title={drillTitle}
          rows={drillRows}
          chartData={drillChart}
          onClose={() => setDrillType(null)}
          drillKpi={drillType}
        />
      )}

      {/* Advanced KPI drill-down modal */}
      {drillDownKPI && (
        <DrillDownModal
          kpiId={drillDownKPI}
          kpiLabel={drillDownKPI}
          rows={getDrillDownRows(drillDownKPI, allStats)}
          onClose={handleCloseDrillDown}
        />
      )}

      {/* Schedule report modal */}
      {showScheduleModal && (
        <ScheduleModal
          userId={userId}
          onClose={() => { setShowScheduleModal(false); setEditingReport(null); }}
          onSaved={() => void reloadReports()}
          editing={editingReport}
        />
      )}
    </div>
  );
}

export { UnifiedAnalyticsDashboard };
export default UnifiedAnalyticsDashboard;
