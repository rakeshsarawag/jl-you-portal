import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import html2canvas from 'html2canvas';
import { useNavigate } from 'react-router';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Area, AreaChart, PieChart, Pie, Legend } from 'recharts';
import { useExecutiveDashboardData } from '../../hooks/useExecutiveDashboardData';
import { useUser } from '../../context/UserContext';
import { supabase } from '../../utils/constants';
import { t } from '../../../i18n';
import ReportDefectButton from '../ReportDefectButton';
import { toast } from 'sonner';

interface Props {
  accessToken?: string;
  onLogout?: () => void;
}

type Tab = 'overview' | 'people' | 'finance' | 'operations' | 'okr' | 'timeline';
type DateRange = '7d' | '30d' | '90d' | '1y';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number | undefined | null, style: 'currency' | 'number' | 'percent' = 'number'): string {
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
}

function KPICard({ label, value, trend, trendLabel, onClick, delta, sparklineData }: KPICardProps) {
  const trendEl =
    trend === 'up' ? (
      <span className="text-emerald-600 text-sm font-medium">↑ {trendLabel}</span>
    ) : trend === 'down' ? (
      <span className="text-red-500 text-sm font-medium">↓ {trendLabel}</span>
    ) : null;

  return (
    <div
      className={`group bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer hover:border-indigo-300' : ''}`}
      onClick={onClick}
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-end gap-2">
        <p className="text-3xl font-bold text-foreground leading-tight">{value}</p>
        {delta && <div className="mb-0.5"><DeltaChip current={delta.current} prev={delta.prev} higherIsBetter={delta.higherIsBetter} /></div>}
      </div>
      {sparklineData && sparklineData.length > 1 && (
        <svg width={60} height={30} className="mt-1">
          {(() => {
            const min = Math.min(...sparklineData);
            const max = Math.max(...sparklineData);
            const range = max - min || 1;
            const pts = sparklineData.map((v, i) =>
              `${(i / (sparklineData.length - 1)) * 60},${30 - ((v - min) / range) * 26 + 2}`
            ).join(' ');
            return <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-indigo-400" />;
          })()}
        </svg>
      )}
      {trendEl && <div className="mt-1">{trendEl}</div>}
      {onClick && <p className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-indigo-500 mt-1">Click to drill down →</p>}
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
function ProgressBar({ pct, color = 'bg-indigo-500' }: { pct: number; color?: string }) {
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

    const [hc, hcPrev, cand, candPrev, tickets, ticketsPrev, okr, okrPrev, dept, payrollCurr, payrollPrv, trainCurr, trainPrev, closedOKRs, totalOKRs, onTrackProjects, totalProjects, secEventsRes, invOutstandingRes] = await Promise.allSettled([
      // headcount current
      supabase.from('employees').select('id', { count: 'exact', head: true })
        .gte('created_at', from).lte('created_at', to),
      // headcount prev
      supabase.from('employees').select('id', { count: 'exact', head: true })
        .gte('created_at', prevFrom).lte('created_at', prevTo),
      // active candidates current
      supabase.from('candidates').select('id', { count: 'exact', head: true })
        .not('status', 'in', '(rejected,hired)')
        .gte('created_at', from).lte('created_at', to),
      // active candidates prev
      supabase.from('candidates').select('id', { count: 'exact', head: true })
        .not('status', 'in', '(rejected,hired)')
        .gte('created_at', prevFrom).lte('created_at', prevTo),
      // open IT tickets current
      supabase.from('it_tickets').select('id', { count: 'exact', head: true })
        .eq('status', 'open'),
      // open IT tickets prev (snapshot approximation)
      supabase.from('it_tickets').select('id', { count: 'exact', head: true })
        .eq('status', 'open').lte('created_at', prevTo),
      // OKR avg progress current
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
      // OKR completion: closed or score >= 0.9
      supabase.from('okrs').select('*', { count: 'exact', head: true }).or('is_closed.eq.true,score.gte.0.9'),
      // OKR total
      supabase.from('okrs').select('*', { count: 'exact', head: true }),
      // on-track projects (active)
      supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      // total projects
      supabase.from('projects').select('*', { count: 'exact', head: true }),
      // security events (critical audit logs in range)
      supabase.from('audit_logs').select('*', { count: 'exact', head: true }).eq('severity', 'critical').gte('created_at', from),
      // outstanding invoices
      supabase.from('invoices').select('balance_due, status').in('status', ['sent', 'overdue', 'partially_paid']),
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
      okrProgress: safeAvg(okr as PromiseSettledResult<{ data: { progress: number }[] | null }>),
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
interface InvoiceMonth { month: string; revenue: number; target: number }
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
          return { month: months[parseInt(m, 10) - 1], revenue, target: 500000 };
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
    const { data } = await supabase
      .from('analytics_anomalies')
      .select('id, metric_key, severity, deviation_percent')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) {
      setAlerts(data as Alert[]);
      setAlertsRefreshedAt(new Date());
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
    if (editing) {
      void supabase.from('scheduled_reports').update(payload).eq('id', editing.id);
    } else {
      void supabase.from('scheduled_reports').insert([payload]);
    }
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    onSaved();
    onClose();
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

const MOCK_TIMELINE_EVENTS: OrgEvent[] = [
  { id: '1', event_type: 'employee_created', action: 'New employee onboarded', created_at: new Date(Date.now() - 2 * 3600000).toISOString(), metadata: { name: 'Priya Sharma', department: 'Engineering' }, user_id: null },
  { id: '2', event_type: 'payroll_processed', action: 'Payroll run completed', created_at: new Date(Date.now() - 26 * 3600000).toISOString(), metadata: { amount: '₹12.4L', employees: 247 }, user_id: null },
  { id: '3', event_type: 'okr_cycle_closed', action: 'Q2 OKR cycle closed', created_at: new Date(Date.now() - 3 * 86400000).toISOString(), metadata: { cycle: 'Q2 2026', completion: '78%' }, user_id: null },
  { id: '4', event_type: 'invoice_sent', action: 'Large invoice dispatched', created_at: new Date(Date.now() - 5 * 86400000).toISOString(), metadata: { client: 'Acme Corp', amount: '₹4.2L' }, user_id: null },
  { id: '5', event_type: 'compliance_status_updated', action: 'GDPR compliance review completed', created_at: new Date(Date.now() - 8 * 86400000).toISOString(), metadata: { framework: 'GDPR', status: 'compliant' }, user_id: null },
  { id: '6', event_type: 'employee_created', action: 'Bulk hire — Engineering batch', created_at: new Date(Date.now() - 12 * 86400000).toISOString(), metadata: { count: 5, department: 'Engineering' }, user_id: null },
];

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
    if (data && data.length > 0) {
      setEvents(data as OrgEvent[]);
    } else {
      setEvents(MOCK_TIMELINE_EVENTS);
    }
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

function timeAgo(dateStr: string): string {
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
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(ev.created_at)}</p>
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
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'people', label: 'People' },
  { id: 'finance', label: 'Finance' },
  { id: 'operations', label: 'Operations' },
  { id: 'okr', label: 'OKRs & Projects' },
  { id: 'timeline', label: 'Timeline' },
];

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
  kpiLayout: ReactGridLayout.Layout[];
  onKpiLayoutChange: (layout: ReactGridLayout.Layout[]) => void;
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

  // KPI card element map for both static and customizing modes
  const kpiCardElements: Record<string, React.ReactNode> = {
    headcount: (
      <KPICard
        label={t('exec.kpi.headcount')}
        value={fmt(realKpis.headcount ?? data?.headcount?.total)}
        trendLabel={data?.headcount ? `+${data.headcount.newThisMonth} this month` : undefined}
        trend={data?.headcount ? 'up' : undefined}
        onClick={isCustomizing ? undefined : onDrillHeadcount}
        delta={{ current: realKpis.headcount, prev: realKpis.headcountPrev }}
        sparklineData={[238, 240, 241, 243, 244, 246, 247]}
      />
    ),
    payroll: data?.payroll ? (
      <KPICard
        label={t('exec.kpi.monthlyPayroll')}
        value={fmt(data.payroll.totalCost, 'currency')}
        delta={{ current: realKpis.payrollTotal, prev: realKpis.payrollPrev }}
        sparklineData={[420000, 435000, 428000, 441000, 450000, 448000, 460000]}
      />
    ) : (
      <Unavailable label="Payroll" />
    ),
    candidates: (
      <KPICard
        label={t('exec.kpi.activeCandidates')}
        value={fmt(realKpis.activeCandidates ?? data?.recruitment?.totalCandidates)}
        trendLabel={data?.recruitment ? `${data.recruitment.activeJobs} open roles` : undefined}
        trend="neutral"
        onClick={isCustomizing ? undefined : onDrillCandidates}
        delta={{ current: realKpis.activeCandidates, prev: realKpis.activeCandidatesPrev }}
        sparklineData={[54, 58, 61, 57, 63, 66, 64]}
      />
    ),
    training: data?.training ? (
      <KPICard
        label={t('exec.kpi.trainingCompletion')}
        value={fmt(data.training.completionRate, 'percent')}
        trend={data.training.completionRate >= 70 ? 'up' : 'down'}
        trendLabel={`${data.training.enrollments} enrolled`}
        delta={{ current: realKpis.trainingRate, prev: realKpis.trainingRatePrev }}
        sparklineData={[62, 65, 67, 70, 72, 74, 76]}
      />
    ) : (
      <Unavailable label="Training" />
    ),
    tickets: (
      <KPICard
        label={t('exec.kpi.openItTickets')}
        value={fmt(realKpis.openTickets ?? data?.itServices?.openTickets)}
        trend={data?.itServices?.slaBreached ?? 0 > 0 ? 'down' : 'neutral'}
        trendLabel={data?.itServices?.slaBreached ?? 0 > 0 ? `${data!.itServices!.slaBreached} SLA breached` : undefined}
        onClick={isCustomizing ? undefined : onDrillTickets}
        delta={{ current: realKpis.openTickets, prev: realKpis.openTicketsPrev, higherIsBetter: false }}
        sparklineData={[28, 31, 24, 27, 22, 19, 18]}
      />
    ),
    okrProgress: (
      <KPICard
        label={t('exec.kpi.okrProgress')}
        value={fmt(realKpis.okrProgress ?? data?.okr?.avgProgress, 'percent')}
        onClick={isCustomizing ? undefined : onDrillOKR}
        delta={{ current: realKpis.okrProgress, prev: realKpis.okrProgressPrev }}
        sparklineData={[48, 52, 55, 58, 61, 64, 67]}
      />
    ),
    okrCompletion: (
      <KPICard
        label="OKR Completion"
        value={realKpis.okrCompletionPct != null ? `${realKpis.okrCompletionPct}%` : '—'}
        trend={realKpis.okrCompletionPct != null && realKpis.okrCompletionPct >= 70 ? 'up' : 'neutral'}
        trendLabel="fully closed"
        sparklineData={[55, 58, 60, 63, 65, 68, 71]}
      />
    ),
    projectHealth: (
      <KPICard
        label="Project Health"
        value={realKpis.projectHealthPct != null ? `${realKpis.projectHealthPct}%` : '—'}
        trend={realKpis.projectHealthPct != null && realKpis.projectHealthPct >= 70 ? 'up' : 'down'}
        trendLabel="active projects"
        sparklineData={[80, 78, 82, 79, 83, 81, 85]}
      />
    ),
    securityEvents: (
      <KPICard
        label="Security Events"
        value={realKpis.securityEvents != null ? String(realKpis.securityEvents) : '—'}
        trend={realKpis.securityEvents != null && realKpis.securityEvents > 0 ? 'down' : 'neutral'}
        trendLabel="critical"
        sparklineData={[3, 5, 2, 4, 1, 3, 2]}
      />
    ),
    outstandingInvoices: (
      <KPICard
        label="Outstanding Invoices"
        value={realKpis.outstandingInvoices != null ? `₹${(realKpis.outstandingInvoices / 100000).toFixed(1)}L` : '—'}
        trend={realKpis.outstandingInvoices != null && realKpis.outstandingInvoices > 0 ? 'down' : 'neutral'}
        trendLabel="pending collection"
        sparklineData={[12, 15, 11, 18, 14, 16, 13]}
      />
    ),
  };

  return (
    <div className="space-y-6">
      <div>
        <SectionHeading>Key Metrics</SectionHeading>
        {isCustomizing ? (
          <div>
            <p className="text-xs text-gray-500 mb-2">Drag cards to reorder. Click "Done" when finished.</p>
            <ReactGridLayout
              className="layout"
              layout={kpiLayout}
              cols={12}
              rowHeight={80}
              width={1200}
              onLayoutChange={onKpiLayoutChange}
              isDraggable={true}
              isResizable={false}
            >
              {Object.entries(kpiCardElements).map(([id, card]) => (
                <div key={id} className="cursor-move">
                  {card}
                </div>
              ))}
            </ReactGridLayout>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(kpiCardElements)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <SectionHeading>Onboarding Status</SectionHeading>
          {data?.onboarding ? (
            <div className="space-y-3">
              {[
                { label: 'In Progress', count: data.onboarding.inProgress, color: 'bg-indigo-500' },
                { label: 'Completed', count: data.onboarding.completed, color: 'bg-emerald-500' },
                { label: 'Pending', count: data.onboarding.pending, color: 'bg-amber-400' },
              ].map(({ label, count, color }) => {
                const total = data.onboarding!.inProgress + data.onboarding!.completed + data.onboarding!.pending;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold text-foreground">{count}</span>
                    </div>
                    <ProgressBar pct={total > 0 ? (count / total) * 100 : 0} color={color} />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Data unavailable</p>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <SectionHeading>Performance Ratings</SectionHeading>
          {data?.performance ? (
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-foreground">{data.performance.avgRating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground mb-1">/ 5.0 avg rating</span>
              </div>
              <ProgressBar pct={(data.performance.avgRating / 5) * 100} color="bg-violet-500" />
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="text-center bg-muted rounded-lg p-3">
                  <p className="text-2xl font-bold text-foreground">{fmt(data.performance.reviewsCompleted)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Reviews Completed</p>
                </div>
                <div className="text-center bg-muted rounded-lg p-3">
                  <p className="text-2xl font-bold text-foreground">{fmt(data.performance.goalsAchieved)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Goals Achieved</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Data unavailable</p>
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

  // Onboarding funnel stages
  const funnelStages = onb ? [
    { label: 'Invited', count: onbTotal, pct: 100 },
    { label: 'In Progress', count: onb.inProgress, pct: onbTotal > 0 ? Math.round((onb.inProgress / onbTotal) * 100) : 0 },
    { label: 'Task Complete', count: Math.round(onb.inProgress * 0.75), pct: onbTotal > 0 ? Math.round((onb.inProgress * 0.75 / onbTotal) * 100) : 0 },
    { label: 'Reviewed', count: Math.round(onb.completed * 1.1), pct: onbTotal > 0 ? Math.round((onb.completed * 1.1 / onbTotal) * 100) : 0 },
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
              <KPICard label="Total Headcount" value={fmt(data.headcount.total)} />
              <KPICard label="New Joiners This Month" value={fmt(data.headcount.newThisMonth)} trend="up" />
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
              <KPICard label="Training Enrolled" value={fmt(data.training.enrollments)} />
              <KPICard label="Certificates Earned" value={fmt(data.training.certified)} trend="up" />
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
              <KPICard label="Monthly Payroll Cost" value={fmt(data.payroll.totalCost, 'currency')} />
              <KPICard label="Average Salary" value={fmt(data.payroll.avgSalary, 'currency')} />
              <KPICard label="Employees Processed" value={fmt(data.payroll.processed)} />
            </>
          ) : (
            <div className="col-span-3"><Unavailable label="Payroll" /></div>
          )}
          {data?.invoices ? (
            <>
              <KPICard label="Invoice Revenue" value={fmt(data.invoices.totalRevenue, 'currency')} trend="up" />
              <KPICard label="Outstanding" value={fmt(data.invoices.outstanding, 'currency')} />
              <KPICard label="Overdue" value={fmt(data.invoices.overdue, 'currency')} trend={data.invoices.overdue > 0 ? 'down' : 'neutral'} />
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

      {/* 2b: Invoice Revenue vs Target + 2c: Outstanding donut */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {invoiceMonthly.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-5">
            <SectionHeading>Invoice Revenue vs Target (6 Months)</SectionHeading>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={invoiceMonthly} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmtLakhs} tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(v: number) => fmtLakhs(v)} />
                <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target" name="Target" fill="#d1d5db" radius={[4, 4, 0, 0]} />
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
              <Tooltip formatter={(v: number) => fmt(v, 'currency')} />
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
                  <span className="font-semibold text-rose-700">{fmt(data.payroll.totalCost, 'currency')}</span>
                </div>
                <ProgressBar pct={(data.payroll.totalCost / maxBar) * 100} color="bg-rose-400" />
              </div>
            )}
            {data?.invoices && (
              <>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground font-medium">Invoice Revenue</span>
                    <span className="font-semibold text-emerald-700">{fmt(data.invoices.totalRevenue, 'currency')}</span>
                  </div>
                  <ProgressBar pct={(data.invoices.totalRevenue / maxBar) * 100} color="bg-emerald-500" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground font-medium">Outstanding</span>
                    <span className="font-semibold text-amber-700">{fmt(data.invoices.outstanding, 'currency')}</span>
                  </div>
                  <ProgressBar pct={(data.invoices.outstanding / maxBar) * 100} color="bg-amber-400" />
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
                  <th className="text-right py-2 text-muted-foreground font-medium">Budget</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Actual</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Variance</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">% vs Budget</th>
                </tr>
              </thead>
              <tbody>
                {costCenterRows.map((row) => {
                  const budget = Math.round(row.totalGross * 1.05);
                  const actual = row.totalGross;
                  const variance = actual - budget;
                  const pctOver = (((actual / budget) - 1) * 100).toFixed(1);
                  return (
                    <tr key={row.department} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="py-2.5 font-medium text-foreground">{row.department}</td>
                      <td className="py-2.5 text-right text-foreground">{row.headcount}</td>
                      <td className="py-2.5 text-right text-foreground">{fmt(budget, "currency")}</td>
                      <td className="py-2.5 text-right font-semibold text-foreground">{fmt(actual, "currency")}</td>
                      <td className={`py-2.5 text-right font-semibold ${variance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(variance, "currency")}</td>
                      <td className="py-2.5 text-right">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${parseFloat(pctOver) > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {parseFloat(pctOver) > 0 ? '+' : ''}{pctOver}%
                        </span>
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

// ── OPERATIONS TAB ────────────────────────────────────────────────────────────
interface ProjectRow { id: string; name: string; status: string; progress: number; owner_id: string; due_date: string }

const MOCK_PROJECTS: ProjectRow[] = [
  { id: '1', name: 'HR System Migration', status: 'active', progress: 82, owner_id: 'Alice', due_date: '2026-12-31' },
  { id: '2', name: 'Payroll Automation', status: 'active', progress: 55, owner_id: 'Bob', due_date: '2026-10-15' },
  { id: '3', name: 'Compliance Audit', status: 'active', progress: 30, owner_id: 'Carol', due_date: '2026-09-30' },
  { id: '4', name: 'Employee Portal v2', status: 'active', progress: 75, owner_id: 'Dave', due_date: '2026-11-01' },
  { id: '5', name: 'Data Warehouse', status: 'active', progress: 20, owner_id: 'Eve', due_date: '2027-01-15' },
];

function OperationsTab({ data, loading }: { data: DashData; loading: boolean }) {
  const [slaRate, setSlaRate] = useState(0.85);
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
      setSlaRate(totalTickets > 0 ? slaCount / totalTickets : 0.85);

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
      if (projRes.data && projRes.data.length > 0) {
        setProjects(projRes.data as ProjectRow[]);
      } else {
        setProjects(MOCK_PROJECTS);
      }

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
                <StatusRow label="Open Tickets" value={fmt(data.itServices.openTickets)} color="text-indigo-700" />
                <StatusRow label="SLA Breached" value={fmt(data.itServices.slaBreached)} color={data.itServices.slaBreached > 0 ? 'text-red-600' : 'text-emerald-600'} />
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
              <StatusRow label="Total Assets" value={fmt(data.assets.total)} />
              <StatusRow label="Assigned" value={fmt(data.assets.assigned)} color="text-indigo-700" />
              <StatusRow label="In Maintenance" value={fmt(data.assets.maintenance)} color={data.assets.maintenance > 0 ? 'text-amber-600' : 'text-emerald-600'} />
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
                { label: 'Active Jobs', value: fmt(data.recruitment.activeJobs) },
                { label: 'Total Candidates', value: fmt(data.recruitment.totalCandidates) },
                { label: 'In Pipeline', value: fmt(data.recruitment.pipelineCount) },
                { label: 'Hired This Month', value: fmt(data.recruitment.hiredThisMonth) },
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
                <p className="text-2xl font-bold text-emerald-700">{fmt(data.okr.onTrack)}</p>
                <p className="text-xs text-muted-foreground">On Track</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{fmt(data.okr.atRisk)}</p>
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
            onClick={() => {
              void supabase.from('scheduled_reports').update({ last_run_at: new Date().toISOString() }).eq('id', r.id);
              toast.success("Report queued for delivery");
              void log({ event_type: 'report_executed', action: 'run_scheduled_report', resource_type: 'scheduled_report', resource_id: r.id, severity: 'low', status: 'success' });
            }}
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
const DEFAULT_KPI_LAYOUT: ReactGridLayout.Layout[] = [
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

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export function ExecutiveDashboardEnhanced({ onLogout }: Props) {
  const { currentUser } = useUser();
  const { log } = useAuditLogger();
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const { data, loading, refresh } = useExecutiveDashboardData(dateRange);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const allowedRoles = ['admin', 'manager', 'finance', 'hr'];
  const hasAccess = currentUser?.roles?.some((r: string) => allowedRoles.includes(r)) ?? false;
  const canCustomize = currentUser?.roles?.some((r: string) => ['admin', 'manager'].includes(r)) ?? false;

  const [isCustomizing, setIsCustomizing] = useState(false);
  const [kpiLayout, setKpiLayout] = useState<ReactGridLayout.Layout[]>(() => {
    try {
      const saved = localStorage.getItem('exec_dashboard_layout');
      return saved ? JSON.parse(saved) : DEFAULT_KPI_LAYOUT;
    } catch {
      return DEFAULT_KPI_LAYOUT;
    }
  });

  function handleKpiLayoutChange(newLayout: ReactGridLayout.Layout[]) {
    setKpiLayout(newLayout);
    localStorage.setItem('exec_dashboard_layout', JSON.stringify(newLayout));
  }

  // Real KPIs from Supabase — only fetched when user has access
  const { kpis: realKpis, deptBreakdown, loading: realLoading, refresh: refreshReal } = useRealKPIs(dateRange, hasAccess);

  // Alerts
  const { alerts, alertsRefreshedAt } = useAlerts();

  // Scheduled reports
  const userId = currentUser?.email ?? currentUser?.id ?? '';
  const { reports, reload: reloadReports } = useScheduledReports(userId);

  // Drill modal
  type DrillType = 'headcount' | 'candidates' | 'tickets' | 'okr' | null;
  const [drillType, setDrillType] = useState<DrillType>(null);

  // Schedule modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);

  const lastUpdatedLabel = useMemo(
    () => (data ? minutesAgo(data.lastUpdated) : '—'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data?.lastUpdated]
  );

  const dashboardRef = useRef<HTMLDivElement>(null);

  // Inject print CSS once
  const printStyleRef = useRef<HTMLStyleElement | null>(null);
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
    printStyleRef.current = style;
    return () => { style.remove(); };
  }, []);

  const checkExportRateLimit = () => {
    const today = new Date().toDateString();
    const key = `exec_export_${today}`;
    const count = parseInt(localStorage.getItem(key) || '0');
    if (count >= 5) {
      toast.error("Export limit reached (5/day). Try again tomorrow.");
      return false;
    }
    localStorage.setItem(key, String(count + 1));
    return true;
  };

  const handleExportPdf = () => {
    if (!checkExportRateLimit()) return;
    const prev = document.title;
    document.title = `Executive Dashboard - ${DATE_RANGE_LABELS[dateRange]}`;
    window.print();
    document.title = prev;
    void log({ event_type: 'dashboard_exported', action: 'export_pdf', resource_type: 'executive_dashboard', severity: 'low', status: 'success' });
  };

  const handleExportPNG = async () => {
    if (!dashboardRef.current) return;
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `exec_png_exports_${today}`;
    const count = parseInt(localStorage.getItem(storageKey) || '0', 10);
    if (count >= 3) {
      alert('PNG export limit reached (3 per day). Try again tomorrow.');
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
      link.download = `executive-dashboard-${today}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      alert('PNG export failed. Please try again.');
    }
  };

  const handleDeleteReport = async (id: string) => {
    void supabase.from('scheduled_reports').delete().eq('id', id);
    await new Promise((r) => setTimeout(r, 300));
    void reloadReports();
  };

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-muted-foreground text-lg font-medium">{t('exec.accessDenied')}</p>
          <p className="text-muted-foreground text-sm mt-1">{t('exec.accessDeniedMsg')}</p>
        </div>
      </div>
    );
  }

  // Drill modal data
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
      { label: 'Avg Progress', value: fmt(data.okr.avgProgress, 'percent') },
      { label: 'On Track', value: data.okr.onTrack },
      { label: 'At Risk', value: data.okr.atRisk },
    ] : [];
  }

  return (
    <div className="min-h-screen bg-muted">
      <div ref={dashboardRef} className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('exec.title')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {DATE_RANGE_LABELS[dateRange]} · {t('exec.lastUpdated')}: {lastUpdatedLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-card border border-border rounded-lg overflow-hidden text-sm">
              {(['7d', '30d', '90d', '1y'] as DateRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    dateRange === r ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {DATE_RANGE_BTNS[r]}
                </button>
              ))}
            </div>
            <button
              onClick={() => { void refresh(); void refreshReal(); }}
              disabled={loading || realLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
            >
              <span className={loading || realLoading ? 'animate-spin inline-block' : ''}>↻</span>
              {t('exec.refresh')}
            </button>
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              ⬇ {t('exec.exportPdf')}
            </button>
            <button
              onClick={() => void handleExportPNG()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-sky-700 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors"
              title="Export as PNG image"
            >
              🖼 Export PNG
            </button>
            <ReportDefectButton appName="Executive Dashboard" />
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
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${isCustomizing ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  {isCustomizing ? 'Done' : 'Customize'}
                </button>
                {isCustomizing && (
                  <button
                    onClick={() => { setKpiLayout(DEFAULT_KPI_LAYOUT); localStorage.removeItem('exec_dashboard_layout'); }}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Reset Layout
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Main layout: tabs + right sidebar */}
        <div className="flex flex-col xl:flex-row gap-6">
          {/* Left: tabs + content */}
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
            <div>
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
              {activeTab === 'people' && <PeopleTab data={data} loading={loading} deptBreakdown={deptBreakdown} />}
              {activeTab === 'finance' && <FinanceTab data={data} loading={loading} />}
              {activeTab === 'operations' && <OperationsTab data={data} loading={loading} />}
              {activeTab === 'okr' && <OKRTab data={data} loading={loading} />}
              {activeTab === 'timeline' && <TimelineTab />}
            </div>

            {/* Scheduled Reports List */}
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

          {/* Right sidebar */}
          <div className="hidden xl:flex flex-col gap-4 w-72 shrink-0 no-print">
            <AlertsPanel alerts={alerts} setActiveTab={setActiveTab} lastRefreshed={alertsRefreshedAt} />
            <QuickActionsPanel />
          </div>
        </div>

        {/* Mobile: alerts + quick actions below content */}
        <div className="xl:hidden space-y-4 no-print">
          <AlertsPanel alerts={alerts} setActiveTab={setActiveTab} />
          <QuickActionsPanel />
        </div>
      </div>

      {/* Drill-through modal */}
      {drillType && (
        <DrillModal
          title={drillTitle}
          rows={drillRows}
          chartData={drillChart}
          onClose={() => setDrillType(null)}
          drillKpi={drillType}
        />
      )}

      {/* Schedule modal */}
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

export { ExecutiveDashboardEnhanced as ExecutiveDashboard };
export default ExecutiveDashboardEnhanced;
