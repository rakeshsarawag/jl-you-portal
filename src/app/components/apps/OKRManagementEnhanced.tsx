import { useState, useEffect, useCallback, useRef } from 'react';
import { InlineLoader } from '../ui/PageLoader';
import { useUnsavedChanges } from '../../context/UnsavedChangesContext';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  Target, Plus, ChevronDown, ChevronRight, Edit2, Trash2,
  Eye, CheckSquare, BarChart2, AlertTriangle, CheckCircle,
  X, Search, GitBranch, Award, History, Calendar, FileText,
  Shield, TrendingUp, Columns, GripVertical
} from 'lucide-react';
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { useOKRData, OKR, KeyResult } from '../../hooks/useOKRData';
import { useAuditLogger } from '../../../hooks/useAuditLogger';
import { useUser } from '../../context/UserContext';
import { useSectionPermission } from "../SectionGuard";
import { OKR_STATUSES, OKR_TYPES, OKR_QUARTERS, KR_UNITS } from '../../../constants/apps/okr';
import { SelectOptions } from '../../context/ValueHelpsContext';
import { useDepartmentOptions } from '../../hooks/useSharedData';
import { t } from '../../../i18n/index';
import { API_BASE, publicAnonKey, supabase } from '../../utils/constants';
import ConfirmDialog from '../ui/ConfirmDialog';
import ReportDefectButton from '../ReportDefectButton';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OKRCycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: 'Planning' | 'Active' | 'Review' | 'Closed';
  description?: string;
}

interface OKRCheckin {
  id: string;
  okr_id: string;
  checked_in_by?: string;
  current_value: number;
  confidence: number; // 1-5
  notes?: string;
  has_blocker: boolean;
  blocker_description?: string;
  checked_in_at: string;
}

interface OKRCycleScore {
  id?: string;
  cycle_id: string;
  okr_id: string;
  final_score: number;
  grade: string;
  graded_by?: string;
  graded_at?: string;
  notes?: string;
}

interface OKRTemplate {
  id: string;
  name: string;
  category?: string;
  description?: string;
  objective_template: string;
  key_results_template?: {
    title: string;
    unit?: string;
    targetValue?: number;
    target_value?: number;
    startValue?: number;
    start_value?: number;
    is_boolean?: boolean;
  }[];
  is_active: boolean;
}

// ── Feature 2: Cycle status transition rules ──────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  Planning: ['Active'],
  Active: ['Review'],
  Review: ['Closed'],
  Closed: ['Active'], // admin override only
};

function validateCycleTransition(currentStatus: string, newStatus: string): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

// ── Circular alignment guard ──────────────────────────────────────────────────

function wouldCreateCycle(okrs: OKR[], currentId: string, proposedParentId: string): boolean {
  let cursor: string | null = proposedParentId;
  const visited = new Set<string>();
  while (cursor) {
    if (cursor === currentId) return true;
    if (visited.has(cursor)) break;
    visited.add(cursor);
    const parent = okrs.find(o => o.id === cursor);
    cursor = parent?.parentId ?? null;
  }
  return false;
}

// ── Descendant check for drag-to-reparent ─────────────────────────────────────

function isDescendant(okrs: OKR[], ancestorId: string, targetId: string): boolean {
  const children = okrs.filter((o) => o.parentId === ancestorId);
  return children.some((c) => c.id === targetId || isDescendant(okrs, c.id, targetId));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  'On Track': 'bg-green-100 text-green-800',
  'At Risk': 'bg-orange-100 text-orange-800',
  'Behind': 'bg-red-100 text-red-800',
  'Completed': 'bg-blue-100 text-blue-800',
  'Cancelled': 'bg-gray-100 text-gray-500',
};

const STATUS_BAR: Record<string, string> = {
  'On Track': 'bg-green-500',
  'At Risk': 'bg-orange-400',
  'Behind': 'bg-red-500',
  'Completed': 'bg-blue-500',
  'Cancelled': 'bg-gray-300',
};

const TYPE_COLOR: Record<string, string> = {
  Individual: 'bg-gray-100 text-gray-700',
  Team: 'bg-blue-100 text-blue-700',
  Department: 'bg-purple-100 text-purple-700',
  Company: 'bg-orange-100 text-orange-700',
};

const CYCLE_STATUS_COLOR: Record<string, string> = {
  Planning: 'bg-gray-100 text-gray-700',
  Active: 'bg-green-100 text-green-700',
  Review: 'bg-amber-100 text-amber-700',
  Closed: 'bg-blue-100 text-blue-700',
};

const currentYear = new Date().getFullYear();

function progressBar(pct: number, status: string) {
  return (
    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all ${STATUS_BAR[status] ?? 'bg-gray-300'}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>{label}</span>;
}

// KR Score: (current - start) / (target - start), clamped to [0,1]
function krScore(kr: KeyResult): number {
  if (kr.is_boolean) return kr.is_completed ? 1.0 : 0.0;
  const range = (kr.targetValue ?? 0) - (kr.startValue ?? 0);
  if (range <= 0) return 0;
  const raw = ((kr.currentValue ?? 0) - (kr.startValue ?? 0)) / range;
  return Math.min(1, Math.max(0, raw));
}

function scoreColor(score: number): string {
  if (score >= 0.7) return 'bg-green-500';
  if (score >= 0.4) return 'bg-amber-400';
  return 'bg-red-500';
}

function scoreTextColor(score: number): string {
  if (score >= 0.7) return 'text-green-700';
  if (score >= 0.4) return 'text-amber-700';
  return 'text-red-700';
}

// ── Progress Band (4-band) ────────────────────────────────────────────────────

function getProgressBand(progress: number): { label: string; cls: string } {
  // progress is 0–1
  if (progress >= 0.70) return { label: 'Achieved', cls: 'bg-emerald-100 text-emerald-700' };
  if (progress >= 0.60) return { label: 'On Track', cls: 'bg-lime-100 text-lime-700' };
  if (progress >= 0.40) return { label: 'Progressing', cls: 'bg-amber-100 text-amber-700' };
  return { label: 'Behind', cls: 'bg-red-100 text-red-700' };
}

function ProgressBandChip({ progress }: { progress: number }) {
  const { label, cls } = getProgressBand(progress);
  return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>{label}</span>;
}

function KRScoreBar({ kr }: { kr: KeyResult }) {
  if (kr.is_boolean) {
    return (
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={!!kr.is_completed} readOnly className="rounded" />
        <span className={`text-xs font-medium ${kr.is_completed ? 'text-green-700' : 'text-muted-foreground'}`}>
          {kr.is_completed ? 'Yes (1.00)' : 'No (0.00)'}
        </span>
      </div>
    );
  }
  const score = krScore(kr);
  const pct = score * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all ${scoreColor(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-medium w-8 text-right ${scoreTextColor(score)}`}>
        {score.toFixed(2)}
      </span>
    </div>
  );
}

// ── Grade helpers ─────────────────────────────────────────────────────────────

const GRADE_LABELS: Record<string, string> = {
  A: 'A (≥90%)',
  B: 'B (75–89%)',
  C: 'C (60–74%)',
  D: 'D (40–59%)',
  F: 'F (<40%)',
};

const GRADE_COLOR: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-amber-100 text-amber-800',
  D: 'bg-orange-100 text-orange-700',
  F: 'bg-red-100 text-red-800',
};

function suggestGrade(score: number): string {
  if (score >= 0.80) return 'A';
  if (score >= 0.60) return 'B';
  if (score >= 0.40) return 'C';
  if (score >= 0.20) return 'D';
  return 'F';
}

// ── Grade Modal ───────────────────────────────────────────────────────────────

function GradeModal({
  okr,
  onSave,
  onClose,
}: {
  okr: OKR & { grade?: string; grade_comment?: string };
  onSave: (grade: string, comment: string) => Promise<void>;
  onClose: () => void;
}) {
  const progress = okr.progress ?? 0;
  const [grade, setGrade] = useState<string>(okr.grade ?? suggestGrade(progress / 100));
  const [comment, setComment] = useState(okr.grade_comment ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(grade, comment); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2"><Award size={18} className="text-amber-500" /> {t('okr.gradeOKR')}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{okr.title}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
            <BarChart2 size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('okr.currentProgress')}:</span>
            <span className="font-semibold text-foreground">{progress}%</span>
            <span className="ml-auto text-xs text-muted-foreground">{t('okr.suggested')}: <strong>{suggestGrade(progress / 100)}</strong></span>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t('okr.grade')}</label>
            <div className="grid grid-cols-5 gap-2">
              {Object.keys(GRADE_LABELS).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrade(g)}
                  className={`py-2 rounded-lg border text-sm font-semibold transition-colors ${
                    grade === g
                      ? `${GRADE_COLOR[g]} border-current`
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{GRADE_LABELS[grade] ?? ''}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t('okr.gradeRationale')}</label>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('okr.gradePlaceholder')}
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg">{t('common.cancel')}</button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('okr.submitGrade')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Export OKR History to CSV ─────────────────────────────────────────────────

function exportOKRHistory(okrs: OKR[]) {
  const headers = ['Quarter', 'Year', 'Title', 'Owner', 'Progress %', 'Status', 'Grade'];
  const rows = okrs.map(o => [
    o.quarter ?? '',
    String(o.year ?? ''),
    o.title ?? '',
    (o as OKR & { owner_name?: string }).owner_name ?? o.owner ?? '',
    String(Math.round(o.progress ?? 0)),
    o.status ?? '',
    (o as OKR & { grade?: string }).grade ?? '',
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: `okr-history-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
}

// ── History View ──────────────────────────────────────────────────────────────

function HistoryView({ okrs }: { okrs: OKR[] }) {
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');

  function quarterStartDate(year: number | undefined, quarter: string | undefined): string {
    const y = year ?? new Date().getFullYear();
    const qMonths: Record<string, string> = { Q1: '01', Q2: '04', Q3: '07', Q4: '10' };
    const m = qMonths[quarter ?? 'Q1'] ?? '01';
    return `${y}-${m}-01`;
  }

  const filteredOkrs = okrs.filter((o) => {
    const periodDate = quarterStartDate(o.year, o.quarter);
    if (historyFrom && periodDate < historyFrom) return false;
    if (historyTo && periodDate > historyTo) return false;
    return true;
  });

  const groups = filteredOkrs.reduce<Record<string, OKR[]>>((acc, o) => {
    const key = `${o.year} ${o.quarter}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

  const sortedPeriods = Object.keys(groups).sort((a, b) => {
    const [ay, aq] = a.split(' ');
    const [by, bq] = b.split(' ');
    if (by !== ay) return Number(by) - Number(ay);
    return bq.localeCompare(aq);
  });

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-4">
      {/* Date range filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs font-medium text-muted-foreground">From:</label>
        <input
          type="date"
          className="border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={historyFrom}
          onChange={(e) => setHistoryFrom(e.target.value)}
        />
        <label className="text-xs font-medium text-muted-foreground">To:</label>
        <input
          type="date"
          className="border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={historyTo}
          onChange={(e) => setHistoryTo(e.target.value)}
        />
        {(historyFrom || historyTo) && (
          <button
            onClick={() => { setHistoryFrom(''); setHistoryTo(''); }}
            className="px-2 py-1 text-xs border border-border rounded-lg hover:bg-muted text-muted-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {sortedPeriods.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <History size={32} className="mb-3 opacity-40" />
          <p className="text-sm">{t('okr.noHistory')}</p>
        </div>
      ) : (
      <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filteredOkrs.length} OKR{filteredOkrs.length !== 1 ? 's' : ''} across {sortedPeriods.length} period{sortedPeriods.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => { exportOKRHistory(filteredOkrs); toast.success(t('okr.historyExported')); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          {t('okr.exportCsv')}
        </button>
      </div>
      {sortedPeriods.map((period) => {
        const list = groups[period];
        const avg = Math.round(list.reduce((s, o) => s + (o.progress ?? 0), 0) / list.length);
        const onTrack = list.filter((o) => o.status === 'On Track').length;
        const atRisk = list.filter((o) => o.status === 'At Risk').length;
        const behind = list.filter((o) => o.status === 'Behind').length;
        const isOpen = !collapsed[period];
        const [year, quarter] = period.split(' ');

        return (
          <div key={period} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-5 text-left hover:bg-muted transition-colors"
              onClick={() => setCollapsed((c) => ({ ...c, [period]: !c[period] }))}
            >
              <div className="flex items-center gap-3">
                {isOpen ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                <span className="font-semibold text-foreground">{quarter} {year}</span>
                <span className="text-sm text-muted-foreground">{list.length} OKR{list.length !== 1 ? 's' : ''}</span>
                <span className="text-sm font-medium text-blue-600">Avg {avg}%</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {onTrack > 0 && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700">{onTrack} {t('okr.onTrack')}</span>}
                {atRisk > 0 && <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{atRisk} {t('okr.atRisk')}</span>}
                {behind > 0 && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">{behind} {t('okr.behind')}</span>}
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-border divide-y divide-gray-50">
                {list.map((o) => (
                  <div key={o.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{o.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{o.owner}{o.department ? ` · ${o.department}` : ''}</p>
                    </div>
                    <div className="w-24 shrink-0">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{o.progress ?? 0}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${STATUS_BAR[o.status] ?? 'bg-gray-300'}`}
                          style={{ width: `${Math.min(100, o.progress ?? 0)}%` }}
                        />
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLOR[o.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {o.status}
                    </span>
                    {(o as OKR & { grade?: string }).grade && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${GRADE_COLOR[(o as OKR & { grade?: string }).grade!] ?? 'bg-gray-100 text-gray-700'}`}>
                        {(o as OKR & { grade?: string }).grade}
                      </span>
                    )}
                  </div>
                ))}
                <div className="px-5 py-2 bg-muted flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="font-medium text-muted-foreground">{t('okr.periodSummary')}:</span>
                  <span>{onTrack} {t('okr.onTrack')} · {atRisk} {t('okr.atRisk')} · {behind} {t('okr.behind')}</span>
                  <span className="ml-auto font-medium text-foreground">Avg {avg}%</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
      </>
      )}
    </div>
  );
}

// ── Check-in Slide-Over ───────────────────────────────────────────────────────

interface KRCheckinState {
  currentValue: number;
  confidence: number;
  isCompleted: boolean;
}

function CheckInSlideOver({
  okr,
  userId,
  onClose,
  onSuccess,
}: {
  okr: OKR;
  userId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { log } = useAuditLogger();
  const [krStates, setKrStates] = useState<Record<string, KRCheckinState>>({});
  const [loadingKRs, setLoadingKRs] = useState(true);
  const [krs, setKrs] = useState<KeyResult[]>([]);
  const [notes, setNotes] = useState('');
  const [hasBlocker, setHasBlocker] = useState(false);
  const [blockerDescription, setBlockerDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [checkins, setCheckins] = useState<OKRCheckin[]>([]);
  const [loadingCheckins, setLoadingCheckins] = useState(true);
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const now = new Date();
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    return quarterStart.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    async function load() {
      setLoadingKRs(true);
      const { data: krData } = await supabase.from('key_results').select('*').eq('okr_id', okr.id);
      const loaded: KeyResult[] = (krData ?? okr.keyResults ?? []).map((k: Record<string, unknown>) => ({
        id: String(k.id ?? ''),
        okrId: String(k.okr_id ?? k.okrId ?? okr.id),
        title: String(k.title ?? ''),
        unit: String(k.unit ?? '%'),
        startValue: Number(k.start_value ?? k.startValue ?? 0),
        targetValue: Number(k.target_value ?? k.targetValue ?? 100),
        currentValue: Number(k.current_value ?? k.currentValue ?? 0),
        progress: Number(k.progress ?? 0),
        is_boolean: Boolean(k.is_boolean),
        is_completed: Boolean(k.is_completed),
      }));
      setKrs(loaded.length > 0 ? loaded : (okr.keyResults ?? []));
      const initial: Record<string, KRCheckinState> = {};
      (loaded.length > 0 ? loaded : (okr.keyResults ?? [])).forEach((kr) => {
        initial[kr.id] = {
          currentValue: kr.currentValue ?? 0,
          confidence: 3,
          isCompleted: !!kr.is_completed,
        };
      });
      setKrStates(initial);
      setLoadingKRs(false);
    }
    async function loadCheckins() {
      setLoadingCheckins(true);
      const { data } = await supabase
        .from('okr_checkins')
        .select('*')
        .eq('okr_id', okr.id)
        .order('checked_in_at', { ascending: false })
        .limit(20);
      setCheckins(data ?? []);
      setLoadingCheckins(false);
    }
    load();
    loadCheckins();
  }, [okr.id, okr.keyResults]);

  const filteredCheckins = checkins.filter((c) => {
    if (dateFrom && c.checked_in_at < dateFrom) return false;
    if (dateTo && c.checked_in_at > dateTo + 'T23:59:59') return false;
    return true;
  }).slice(0, 5);

  const KR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  // Group checkins by kr_id for per-KR chart
  const checkinHasKrId = filteredCheckins.some((c) => (c as OKRCheckin & { kr_id?: string }).kr_id);
  const krIds = checkinHasKrId
    ? [...new Set(filteredCheckins.map((c) => (c as OKRCheckin & { kr_id?: string }).kr_id ?? 'unknown'))]
    : [];

  // Build chart data: one entry per date, with one key per kr_id
  const chartData = checkinHasKrId && krIds.length > 1
    ? (() => {
        const byDate: Record<string, Record<string, number>> = {};
        [...filteredCheckins].reverse().forEach((c) => {
          const date = new Date(c.checked_in_at).toLocaleDateString('en', { month: 'short', day: 'numeric' });
          const krKey = (c as OKRCheckin & { kr_id?: string }).kr_id ?? 'unknown';
          if (!byDate[date]) byDate[date] = { date: 0 };
          byDate[date][krKey] = c.confidence;
          (byDate[date] as Record<string, unknown>)['_date'] = date;
        });
        return Object.entries(byDate).map(([date, vals]) => ({ date, ...vals }));
      })()
    : [...filteredCheckins].reverse().map((c) => ({
        date: new Date(c.checked_in_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        confidence: c.confidence,
      }));

  // KR title map for legend
  const krTitleMap: Record<string, string> = {};
  krs.forEach((kr, i) => { krTitleMap[kr.id] = kr.title || `KR ${i + 1}`; });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if ((okr as OKR & { is_closed?: boolean }).is_closed === true) {
      toast.error('Cannot check-in on a closed OKR');
      return;
    }
    const { data: cycle } = await supabase.from("okr_cycles").select("status").eq("id", (okr as OKR & { cycle_id?: string }).cycle_id || "").single();
    if (cycle?.status === "Planning") { toast.error("Check-ins are not allowed during the Planning phase"); return; }
    if (cycle?.status === "Closed") { toast.error("This cycle is closed. No check-ins allowed."); return; }
    if (hasBlocker && !blockerDescription.trim()) {
      toast.error("Please describe the blocker.");
      return;
    }

    const activeKRs = krs.length > 0 ? krs : (okr.keyResults ?? []);

    // Validate 120% cap for non-boolean KRs
    for (const kr of activeKRs) {
      if (!kr.is_boolean) {
        const state = krStates[kr.id];
        if (state) {
          const maxAllowed = (kr.targetValue ?? 0) * 1.2;
          if (state.currentValue > maxAllowed) {
            toast.error(`Check-in value cannot exceed 120% of target (max: ${maxAllowed.toFixed(2)}).`);
            return;
          }
        }
      }
    }

    setSaving(true);
    try {
      // Insert one checkin row per KR
      if (activeKRs.length > 0) {
        for (const kr of activeKRs) {
          const state = krStates[kr.id] ?? { currentValue: kr.currentValue, confidence: 3, isCompleted: false };
          const { error } = await supabase.from('okr_checkins').insert([{
            okr_id: okr.id,
            checked_in_by: userId,
            current_value: kr.is_boolean ? (state.isCompleted ? 1 : 0) : state.currentValue,
            confidence: state.confidence,
            notes,
            has_blocker: hasBlocker,
            blocker_description: hasBlocker ? blockerDescription : null,
            checked_in_at: new Date().toISOString(),
          }]);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from('okr_checkins').insert([{
          okr_id: okr.id,
          checked_in_by: userId,
          current_value: 0,
          confidence: 3,
          notes,
          has_blocker: hasBlocker,
          blocker_description: hasBlocker ? blockerDescription : null,
          checked_in_at: new Date().toISOString(),
        }]);
        if (error) throw error;
      }

      if (hasBlocker) {
        // Send notification to owner's manager, fallback to okr owner's user_id
        const okrOwnerId = okr.ownerId ?? userId;
        let recipientId = okrOwnerId;
        if (okrOwnerId) {
          const { data: ownerEmp } = await supabase
            .from('employees')
            .select('manager_id')
            .eq('user_id', okrOwnerId)
            .single();
          if (ownerEmp?.manager_id) recipientId = ownerEmp.manager_id;
        }
        void supabase.from('notifications').insert([{
          user_id: recipientId,
          type: 'okr_blocker_flagged',
          title: 'OKR Blocker Flagged',
          message: `A blocker has been flagged on an OKR: ${blockerDescription}`,
          app_name: 'OKR Management',
          read: false,
        }]);
      }

      log({ event_type: 'okr_checkin_submitted', action: 'okr_checkin_submitted', metadata: { okr_id: okr.id, has_blocker: hasBlocker } });
      toast.success(t('okr.checkin.submitted'));
      onSuccess();
      onClose();
    } catch (err) {
      toast.error((err as Error).message ?? t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  const CONF_EMOJI = ['', '😟', '😕', '😐', '🙂', '😄'];
  const activeKRs = krs.length > 0 ? krs : (okr.keyResults ?? []);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-card shadow-2xl flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <CheckSquare size={16} className="text-blue-500" /> {t('okr.checkin.title')}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{okr.title}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 flex-1">
          {/* Per-KR inputs */}
          {loadingKRs ? (
            <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
          ) : activeKRs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No key results found for this OKR.</p>
          ) : (
            <div className="space-y-4">
              {activeKRs.map((kr) => {
                const state = krStates[kr.id] ?? { currentValue: kr.currentValue ?? 0, confidence: 3, isCompleted: false };
                return (
                  <div key={kr.id} className="border border-border rounded-xl p-4 space-y-3">
                    <p className="text-sm font-bold text-foreground">{kr.title}</p>
                    {kr.is_boolean ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={state.isCompleted}
                          onChange={(e) => setKrStates((prev) => ({ ...prev, [kr.id]: { ...state, isCompleted: e.target.checked } }))}
                          className="rounded"
                        />
                        <span className="text-sm text-foreground">Completed?</span>
                      </label>
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Progress (start: {kr.startValue}, target: {kr.targetValue})
                        </label>
                        <input
                          type="number"
                          className="w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={state.currentValue}
                          onChange={(e) => setKrStates((prev) => ({ ...prev, [kr.id]: { ...state, currentValue: Number(e.target.value) } }))}
                        />
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">{t('okr.checkin.confidence')}</p>
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setKrStates((prev) => ({ ...prev, [kr.id]: { ...state, confidence: v } }))}
                            className={`flex-1 py-1.5 rounded-lg border text-base transition-colors ${state.confidence === v ? 'border-blue-500 bg-blue-50' : 'border-border hover:bg-muted'}`}
                          >
                            {CONF_EMOJI[v]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Global notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t('okr.checkin.notes')}</label>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('okr.checkin.notesPlaceholder')}
            />
          </div>

          {/* Blocker */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasBlocker}
                onChange={(e) => setHasBlocker(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-foreground flex items-center gap-1">
                <AlertTriangle size={14} className="text-red-500" /> {t('okr.checkin.hasBlocker')}
              </span>
            </label>
            {hasBlocker && (
              <textarea
                className="mt-2 w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                rows={2}
                value={blockerDescription}
                onChange={(e) => setBlockerDescription(e.target.value)}
                placeholder={t('okr.checkin.blockerPlaceholder')}
              />
            )}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg">{t('common.cancel')}</button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('okr.checkin.submit')}
            </button>
          </div>
        </form>

        {/* Check-in history */}
        <div className="border-t p-5 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">{t('okr.checkin.history')}</h3>
          </div>
          {/* Date range filter */}
          <div className="flex gap-2 mb-3">
            <input
              type="date"
              className="flex-1 border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From"
            />
            <input
              type="date"
              className="flex-1 border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To"
            />
          </div>
          {/* Confidence chart */}
          {chartData.length > 1 && (
            <div className="mb-4">
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[1, 5]} tick={{ fontSize: 10 }} width={20} />
                  <Tooltip />
                  {checkinHasKrId && krIds.length > 1
                    ? krIds.map((krId, i) => (
                        <Line
                          key={krId}
                          type="monotone"
                          dataKey={krId}
                          stroke={KR_COLORS[i % KR_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          name={krTitleMap[krId] ?? krId}
                        />
                      ))
                    : <Line type="monotone" dataKey="confidence" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  }
                </LineChart>
              </ResponsiveContainer>
              {checkinHasKrId && krIds.length > 1 && (
                <div className="flex flex-wrap gap-3 mt-2">
                  {krIds.map((krId, i) => (
                    <div key={krId} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: KR_COLORS[i % KR_COLORS.length] }} />
                      <span className="truncate max-w-[120px]">{krTitleMap[krId] ?? krId}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {loadingCheckins ? (
            <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
          ) : filteredCheckins.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('okr.checkin.noHistory')}</p>
          ) : (
            <div className="space-y-2">
              {filteredCheckins.map((c) => {
                type CheckinExtended = OKRCheckin & { kr_updates?: { kr_id: string; value: number; confidence: number }[] };
                const ext = c as CheckinExtended;
                const krUpdates = Array.isArray(ext.kr_updates) ? ext.kr_updates : null;
                return (
                  <div key={c.id} className="border border-border rounded-lg p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground">{new Date(c.checked_in_at).toLocaleDateString()}</span>
                      <span className="text-blue-600 font-semibold">{['', '😟', '😕', '😐', '🙂', '😄'][c.confidence]} {c.confidence}/5</span>
                    </div>
                    {c.notes && <p className="text-muted-foreground">{c.notes}</p>}
                    {c.has_blocker && (
                      <p className="mt-1 text-red-600 flex items-center gap-1">
                        <AlertTriangle size={10} /> {c.blocker_description}
                      </p>
                    )}
                    {/* Per-KR sub-rows */}
                    {krUpdates && krUpdates.length > 0 ? (
                      <div className="mt-2 space-y-1.5">
                        {krUpdates.map((ku) => {
                          const kr = krs.find(k => k.id === ku.kr_id);
                          const pct = Math.min(100, Math.max(0, ku.value));
                          return (
                            <div key={ku.kr_id} className="text-muted-foreground">
                              <div className="flex justify-between mb-0.5">
                                <span className="truncate max-w-[160px]">{kr?.title ?? ku.kr_id}</span>
                                <span className="ml-2 shrink-0">{ku.value} · conf {ku.confidence}/5</span>
                              </div>
                              <div className="h-1 bg-gray-200 rounded">
                                <div className="h-1 bg-indigo-500 rounded" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-2">
                        <div className="flex justify-between text-muted-foreground mb-0.5">
                          <span>Value</span>
                          <span>{c.current_value}</span>
                        </div>
                        <div className="h-1 bg-gray-200 rounded">
                          <div className="h-1 bg-indigo-500 rounded" style={{ width: `${Math.min(100, Math.max(0, c.current_value))}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── OKR Cycle Modal ───────────────────────────────────────────────────────────

function CycleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    description: '',
    status: 'Planning' as OKRCycle['status'],
  });
  const { log: logCycle } = useAuditLogger();
  const [cycleType, setCycleType] = useState('Quarterly');
  const [fiscalYear, setFiscalYear] = useState(String(new Date().getFullYear()));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error(t('okr.cycle.nameRequired')); return; }
    if (form.start_date && form.end_date && new Date(form.end_date) <= new Date(form.start_date)) {
      toast.error("End date must be after start date.");
      return;
    }
    setSaving(true);
    try {
      const { data: cycleData, error } = await supabase.from('okr_cycles').insert([{ ...form, type: cycleType, fiscal_year: fiscalYear }]).select('id').single();
      if (error) throw error;
      logCycle({ event_type: 'okr_cycle_created', action: 'okr_cycle_created', metadata: { cycle_id: cycleData?.id } });
      toast.success(t('okr.cycle.created'));
      onCreated();
      onClose();
    } catch (err) {
      toast.error((err as Error).message ?? t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Calendar size={18} className="text-blue-500" /> {t('okr.cycle.new')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t('okr.cycle.name')}</label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Q1 2026"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t('okr.cycle.startDate')}</label>
              <input
                type="date"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.start_date}
                onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t('okr.cycle.endDate')}</label>
              <input
                type="date"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.end_date}
                onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t('okr.cycle.status')}</label>
            <select
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.status}
              onChange={(e) => setForm(f => ({ ...f, status: e.target.value as OKRCycle['status'] }))}
            >
              {(['Planning', 'Active', 'Review', 'Closed'] as OKRCycle['status'][]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Cycle Type</label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={cycleType}
                onChange={(e) => setCycleType(e.target.value)}
              >
                {['Annual', 'Semi-Annual', 'Quarterly'].map((ct) => (
                  <option key={ct} value={ct}>{ct}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Fiscal Year</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                placeholder="e.g. 2026"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t('okr.description')}</label>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg">{t('common.cancel')}</button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('okr.cycle.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Template Modal ────────────────────────────────────────────────────────────

function TemplatePickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (tpl: OKRTemplate) => void;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<OKRTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateSearch, setTemplateSearch] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('okr_templates').select('*').eq('is_active', true);
      setTemplates(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filteredTemplates = templates.filter(t =>
    t.name?.toLowerCase().includes(templateSearch.toLowerCase()) ||
    t.description?.toLowerCase().includes(templateSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2"><FileText size={18} className="text-blue-500" /> {t('okr.template.pick')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          <input
            value={templateSearch}
            onChange={e => setTemplateSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full border rounded px-3 py-2 text-sm mb-3"
          />
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('common.loading')}</p>
          ) : filteredTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('okr.template.none')}</p>
          ) : filteredTemplates.map((tpl) => (
            <button
              key={tpl.id}
              className="w-full text-left p-4 border border-border rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-colors"
              onClick={() => { onSelect(tpl); onClose(); }}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground text-sm">{tpl.name}</p>
                {tpl.category && <Badge label={tpl.category} cls="bg-gray-100 text-gray-600" />}
              </div>
              {tpl.description && <p className="text-xs text-muted-foreground mt-1">{tpl.description}</p>}
              <p className="text-xs text-blue-600 mt-2 italic">{tpl.objective_template}</p>
            </button>
          ))}

        </div>
      </div>
    </div>
  );
}

// ── Manage Templates Modal ────────────────────────────────────────────────────

function ManageTemplatesModal({ onClose }: { onClose: () => void }) {
  const [templates, setTemplates] = useState<OKRTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTpl, setEditTpl] = useState<Partial<OKRTemplate> | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<OKRTemplate | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('okr_templates').select('*').order('name');
    setTemplates(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!editTpl?.name || !editTpl?.objective_template) {
      toast.error(t('okr.template.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      if (editTpl.id) {
        await supabase.from('okr_templates').update(editTpl).eq('id', editTpl.id);
      } else {
        await supabase.from('okr_templates').insert([{ ...editTpl, is_active: true }]);
      }
      toast.success(t('okr.template.saved'));
      setEditTpl(null);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tpl: OKRTemplate) {
    await supabase.from('okr_templates').delete().eq('id', tpl.id);
    toast.success(t('okr.template.deleted'));
    setConfirmDelete(null);
    load();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Shield size={18} className="text-purple-500" /> {t('okr.template.manage')}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setEditTpl({ name: '', objective_template: '', is_active: true })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={14} /> {t('okr.template.new')}
            </button>
            <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X size={18} /></button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {editTpl && (
            <div className="mb-4 p-4 border border-blue-200 rounded-xl bg-blue-50 space-y-3">
              <h3 className="font-medium text-sm">{editTpl.id ? t('okr.template.edit') : t('okr.template.new')}</h3>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('okr.template.namePlaceholder')}
                value={editTpl.name ?? ''}
                onChange={(e) => setEditTpl(t => ({ ...t!, name: e.target.value }))}
              />
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('okr.template.categoryPlaceholder')}
                value={editTpl.category ?? ''}
                onChange={(e) => setEditTpl(t => ({ ...t!, category: e.target.value }))}
              />
              <textarea
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                placeholder={t('okr.template.objectivePlaceholder')}
                value={editTpl.objective_template ?? ''}
                onChange={(e) => setEditTpl(t => ({ ...t!, objective_template: e.target.value }))}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditTpl(null)} className="px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted rounded-lg">{t('common.cancel')}</button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </div>
          )}
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('common.loading')}</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('okr.template.none')}</p>
          ) : (
            <div className="space-y-2">
              {templates.map((tpl) => (
                <div key={tpl.id} className="flex items-center gap-3 p-3 border border-border rounded-xl">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-foreground">{tpl.name}</p>
                      {tpl.category && <Badge label={tpl.category} cls="bg-gray-100 text-gray-600" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{tpl.objective_template}</p>
                  </div>
                  <button
                    onClick={async () => {
                      const { error: tplToggleErr } = await supabase.from('okr_templates').update({ is_active: !tpl.is_active }).eq('id', tpl.id);
                      if (tplToggleErr) throw new Error(tplToggleErr.message);
                      setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, is_active: !t.is_active } : t));
                      toast.success(tpl.is_active ? "Template deactivated" : "Template activated");
                    }}
                    className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${tpl.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {tpl.is_active ? "Active" : "Inactive"}
                  </button>
                  <button onClick={() => setEditTpl(tpl)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground"><Edit2 size={14} /></button>
                  <button onClick={() => setConfirmDelete(tpl)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title={t('okr.template.deleteTitle')}
          message={`Delete template "${confirmDelete.name}"?`}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ── Bulk EOQ Modal ────────────────────────────────────────────────────────────

function BulkGradeModal({
  okrs,
  cycleId,
  userId,
  isManager,
  user,
  onClose,
  onDone,
}: {
  okrs: OKR[];
  cycleId?: string;
  userId?: string;
  isManager?: boolean;
  user?: { id?: string } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { log: logBulk } = useAuditLogger();
  const [grades, setGrades] = useState<Record<string, { final_score: number; grade: string; notes: string }>>(
    Object.fromEntries(okrs.map(o => [o.id, { final_score: (o.progress ?? 0) / 100, grade: suggestGrade((o.progress ?? 0) / 100), notes: '' }]))
  );
  const [saving, setSaving] = useState(false);
  const [closingCycle, setClosingCycle] = useState(false);

  function handlePrintScorecard(employeeOkrs: OKR[]) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = `<html><head><title>OKR Scorecard</title>
  <style>body{font-family:Arial,sans-serif;padding:24px} table{width:100%;border-collapse:collapse} td,th{border:1px solid #ddd;padding:8px} @media print{body{padding:0}}</style>
  </head><body>
  <h2>OKR Scorecard — ${new Date().toLocaleDateString()}</h2>
  <table><thead><tr><th>OKR Title</th><th>Progress</th><th>Grade</th><th>Status</th></tr></thead>
  <tbody>${employeeOkrs.map(o => `<tr><td>${o.title}</td><td>${o.progress ?? 0}%</td><td>${(o as OKR & { grade?: string }).grade ?? "—"}</td><td>${o.status}</td></tr>`).join('')}
  </tbody></table>
  </body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 400);
  }

  function handleExportScorecard() {
    const csvRows = [['Employee', 'OKR Title', 'Grade', 'Score', 'Status']];
    okrs.forEach(okr => {
      const g = grades[okr.id];
      csvRows.push([
        (okr as OKR & { owner_name?: string }).owner_name ?? okr.owner ?? '',
        okr.title,
        g?.grade ?? '',
        String(okr.progress ?? ''),
        okr.status,
      ]);
    });
    const csv = csvRows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'scorecard.csv';
    a.click();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const rows = okrs.map(o => ({
        cycle_id: cycleId ?? null,
        okr_id: o.id,
        final_score: grades[o.id]?.final_score ?? 0,
        grade: grades[o.id]?.grade ?? 'F',
        graded_by: userId,
        graded_at: new Date().toISOString(),
        notes: grades[o.id]?.notes ?? '',
      }));
      const { error } = await supabase.from('okr_cycle_scores').insert(rows);
      if (error) throw error;
      // Fire okr_graded notification per OKR owner; celebrate 100% OKRs
      okrs.forEach((o) => {
        const g = grades[o.id];
        const ownerId = o.ownerId ?? (o as OKR & { user_id?: string }).user_id;
        if (ownerId) {
          void supabase.from('notifications').insert([{
            user_id: ownerId,
            type: 'okr_graded',
            title: 'OKR Graded',
            message: `Your OKR "${o.title}" has been graded ${g?.grade ?? 'F'} (score: ${((g?.final_score ?? 0) * 100).toFixed(0)}%).`,
            app_name: 'OKR Management',
            read: false,
          }]);
        }
        if ((g?.final_score ?? 0) >= 1.0) {
          // Avoid duplicate celebration posts
          supabase.from('communications_posts').select('id').eq('metadata->okr_id', o.id).limit(1).then(({ data }) => {
            if (data?.length) return;
            void supabase.from('communications_posts').insert([{
              title: `🎉 OKR Achievement: ${o.title}`,
              content: `Congratulations! The OKR "${o.title}" has been completed with 100% progress! Great work by the team.`,
              type: 'announcement',
              priority: 'normal',
              status: 'published',
              author_id: user?.id,
              audience: 'all',
              metadata: { okr_id: o.id, celebration: true }
            }]);
            if (ownerId) {
              void supabase.from('notifications').insert([{
                user_id: ownerId,
                type: 'okr_completed',
                title: '🎉 OKR Completed!',
                message: `Your OKR "${o.title}" has reached 100% completion!`,
                severity: 'low',
                read: false,
                action_required: false,
                action_data: { okr_id: o.id }
              }]);
            }
          });
        }
      });
      toast.success(t('okr.eoq.graded'));
      onDone();
      onClose();
    } catch (err) {
      toast.error((err as Error).message ?? t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleCloseCycle() {
    if (!cycleId) { toast.error('No cycle selected'); return; }
    // Feature 2: validate transition
    const { data: cycleRow } = await supabase.from('okr_cycles').select('status').eq('id', cycleId).single();
    const currentCycleStatus = cycleRow?.status ?? 'Active';
    if (!validateCycleTransition(currentCycleStatus, 'Closed')) {
      toast.error(`Cannot transition from ${currentCycleStatus} to Closed`);
      return;
    }
    setClosingCycle(true);
    try {
      const { error: okrsCloseErr } = await supabase.from('okrs').update({ is_closed: true }).eq('cycle_id', cycleId);
      if (okrsCloseErr) throw new Error(okrsCloseErr.message);
      const { error: cycleCloseErr } = await supabase.from('okr_cycles').update({ status: 'Closed' }).eq('id', cycleId);
      if (cycleCloseErr) throw new Error(cycleCloseErr.message);
      void supabase.from('notifications').insert([{
        user_id: user?.id,
        title: 'OKR Cycle Closed',
        message: 'The OKR cycle has been closed. Final grades are locked.',
        type: 'okr_cycle_closed',
        app: 'okr',
        created_by: user?.id,
      }]);
      // Sync scores to performance_reviews for each graded OKR
      for (const okr of okrs) {
        const gradeEntry = grades[okr.id];
        const ownerId = (okr as OKR & { owner_id?: string }).owner_id ?? okr.ownerId;
        if (gradeEntry && ownerId) {
          void supabase.from('performance_reviews').upsert([{
            employee_id: ownerId,
            review_period: cycleId,
            okr_grade: gradeEntry.grade,
            okr_score: okr.progress ?? 0,
            updated_at: new Date().toISOString(),
          }], { onConflict: 'employee_id,review_period' });
        }
      }
      logBulk({ event_type: 'okr_cycle_closed', action: 'okr_cycle_closed', metadata: { cycle_id: cycleId } });
      toast.success('Cycle closed successfully');
      onDone();
      onClose();
    } finally {
      setClosingCycle(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Award size={18} className="text-amber-500" /> {t('okr.eoq.gradeAll')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 space-y-3">
          {okrs.map((o) => {
            const g = grades[o.id] ?? { final_score: 0, grade: 'F', notes: '' };
            return (
              <div key={o.id} className="border border-border rounded-xl p-4 space-y-3">
                <p className="font-medium text-sm text-foreground">{o.title}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('okr.eoq.finalScore')}</label>
                    <input
                      type="number"
                      min="0" max="1" step="0.01"
                      className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={g.final_score}
                      onChange={(e) => setGrades(prev => ({ ...prev, [o.id]: { ...g, final_score: Number(e.target.value), grade: suggestGrade(Number(e.target.value)) } }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('okr.grade')}</label>
                    <select
                      className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={g.grade}
                      onChange={(e) => setGrades(prev => ({ ...prev, [o.id]: { ...g, grade: e.target.value } }))}
                    >
                      {['A','B','C','D','F'].map(gr => <option key={gr}>{gr}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('okr.gradeRationale')}</label>
                    <input
                      className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={g.notes}
                      onChange={(e) => setGrades(prev => ({ ...prev, [o.id]: { ...g, notes: e.target.value } }))}
                      placeholder={t('okr.gradePlaceholder')}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <div className="flex justify-end gap-3 pt-2 shrink-0 flex-wrap">
            <button type="button" onClick={handleExportScorecard} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">Export Scorecard</button>
            <button type="button" onClick={() => handlePrintScorecard(okrs)} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">Print Scorecard</button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg">{t('common.cancel')}</button>
            {isManager && cycleId && (
              <button
                type="button"
                disabled={closingCycle}
                onClick={handleCloseCycle}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {closingCycle ? 'Closing...' : 'Close Cycle'}
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('okr.eoq.submitAll')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────

interface IndivRow {
  owner_id: string;
  owner_name: string;
  total: number;
  onTrack: number;
  avgScore: number;
  grade: string;
}

function AnalyticsView({ okrs }: { okrs: OKR[] }) {
  const [indivData, setIndivData] = useState<IndivRow[]>([]);
  const [indivLoading, setIndivLoading] = useState(true);
  const [alignedCount, setAlignedCount] = useState(0);
  const [unalignedCount, setUnalignedCount] = useState(0);
  const [alignmentLoading, setAlignmentLoading] = useState(true);

  useEffect(() => {
    async function loadAlignment() {
      setAlignmentLoading(true);
      const { data: allOkrs } = await supabase.from('okrs').select('id, aligned_to_okr_id, type').eq('type', 'individual');
      const total = (allOkrs ?? []).length;
      const aligned = (allOkrs ?? []).filter((o: Record<string, unknown>) => o.aligned_to_okr_id != null).length;
      setAlignedCount(aligned);
      setUnalignedCount(total - aligned);
      setAlignmentLoading(false);
    }
    loadAlignment();
  }, []);

  useEffect(() => {
    async function loadIndiv() {
      setIndivLoading(true);
      const { data } = await supabase
        .from('okrs')
        .select('owner_id, owner_name, progress, score, type')
        .eq('type', 'individual');
      if (data && data.length > 0) {
        const grouped: Record<string, { owner_name: string; progresses: number[]; scores: number[] }> = {};
        for (const row of data) {
          const key = String(row.owner_id ?? row.owner_name ?? '');
          if (!grouped[key]) grouped[key] = { owner_name: String(row.owner_name ?? ''), progresses: [], scores: [] };
          grouped[key].progresses.push(Number(row.progress ?? 0));
          grouped[key].scores.push(Number(row.score ?? (row.progress ?? 0) / 100));
        }
        const rows: IndivRow[] = Object.entries(grouped).map(([owner_id, g]) => {
          const avgScore = g.scores.reduce((s, v) => s + v, 0) / g.scores.length;
          return {
            owner_id,
            owner_name: g.owner_name,
            total: g.scores.length,
            onTrack: g.progresses.filter((p) => p / 100 >= 0.6).length,
            avgScore,
            grade: autoGradeFromScore(avgScore).grade,
          };
        }).sort((a, b) => b.avgScore - a.avgScore);
        setIndivData(rows);
      } else {
        setIndivData([]);
      }
      setIndivLoading(false);
    }
    loadIndiv();
  }, []);

  function handleExcel() {
    exportOKRScorecard(okrs);
    toast.success(t('okr.exportExcelSuccess'));
  }

  function exportIndivExcel() {
    const ws = XLSX.utils.json_to_sheet(
      indivData.map((r) => ({
        Employee: r.owner_name,
        'Total OKRs': r.total,
        'On Track': r.onTrack,
        'Avg Score': r.avgScore.toFixed(2),
        Grade: r.grade,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Individual Performance');
    XLSX.writeFile(wb, 'individual-okr-performance.xlsx');
    toast.success('Excel exported');
  }

  // Department OKR Health
  const deptMap = okrs.reduce<Record<string, number[]>>((acc, o) => {
    if (!o.department) return acc;
    if (!acc[o.department]) acc[o.department] = [];
    acc[o.department].push(o.progress ?? 0);
    return acc;
  }, {});

  const deptData = Object.entries(deptMap).map(([dept, progresses]) => ({
    dept,
    avg: Math.round(progresses.reduce((s, v) => s + v, 0) / progresses.length),
    count: progresses.length,
  })).sort((a, b) => b.avg - a.avg);

  // Top 5 by score
  const top5 = [...okrs]
    .map(o => ({ ...o, score: (o.progress ?? 0) / 100 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={handleExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          {t('okr.exportExcel')}
        </button>
      </div>
      {/* Department health chart */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart2 size={16} className="text-blue-500" /> {t('okr.analytics.deptHealth')}
        </h3>
        {deptData.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('okr.analytics.noDeptData')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={deptData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="dept" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" width={35} />
              <Tooltip formatter={(v: number) => [`${v}%`, t('okr.progress')]} />
              <Bar dataKey="avg" fill="#3b82f6" radius={[4, 4, 0, 0]} name={t('okr.analytics.avgProgress')} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top 5 OKRs */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-green-500" /> {t('okr.analytics.top5')}
        </h3>
        {top5.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('common.noResults')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-xl overflow-hidden">
              <thead>
                <tr className="text-left text-xs text-muted-foreground bg-gray-50 border-b border-border">
                  <th className="px-3 py-2 font-medium">{t('okr.objective')}</th>
                  <th className="px-3 py-2 font-medium">{t('okr.owner')}</th>
                  <th className="px-3 py-2 font-medium">Band</th>
                  <th className="px-3 py-2 font-medium text-right">{t('okr.analytics.score')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {top5.map((o, i) => (
                  <tr key={o.id} className="hover:bg-muted/50">
                    <td className="px-3 py-2">
                      <span className="text-muted-foreground text-xs mr-2">#{i + 1}</span>
                      <span className="font-medium text-foreground">{o.title}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{o.owner}</td>
                    <td className="px-3 py-2">
                      <ProgressBandChip progress={o.score} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-semibold ${scoreTextColor(o.score)}`}>{o.score.toFixed(2)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alignment Coverage */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <GitBranch size={16} className="text-indigo-500" /> Alignment Coverage
        </h3>
        {alignmentLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (() => {
          const total = alignedCount + unalignedCount;
          const pct = total > 0 ? Math.round((alignedCount / total) * 100) : 0;
          return (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="p-4 bg-indigo-50 rounded-2xl text-center min-w-[180px]">
                <p className="text-xs text-muted-foreground mb-1">Alignment Coverage</p>
                <p className="text-2xl font-bold text-indigo-700">{pct}%</p>
                <p className="text-xs text-muted-foreground mt-1">of individual OKRs aligned to a parent</p>
              </div>
              <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Aligned', value: alignedCount || 0 },
                        { name: 'Unaligned', value: unalignedCount || 0 },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                    >
                      <Cell fill="#6366f1" />
                      <Cell fill="#e5e7eb" />
                    </Pie>
                    <Tooltip formatter={(v: number, name: string) => [v, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-lg font-bold text-indigo-700">{pct}%</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-500" />
                  <span className="text-foreground font-medium">Aligned: {alignedCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-200" />
                  <span className="text-muted-foreground">Unaligned: {unalignedCount}</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Individual OKR Performance */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Award size={16} className="text-purple-500" /> Individual OKR Performance
          </h3>
          <button
            onClick={exportIndivExcel}
            disabled={indivData.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            Export Excel
          </button>
        </div>
        {indivLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : indivData.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('common.noResults')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-xl overflow-hidden">
              <thead>
                <tr className="text-left text-xs text-muted-foreground bg-gray-50 border-b border-border">
                  <th className="px-3 py-2 font-medium">Employee</th>
                  <th className="px-3 py-2 font-medium text-right">Total OKRs</th>
                  <th className="px-3 py-2 font-medium text-right">On Track</th>
                  <th className="px-3 py-2 font-medium">Band</th>
                  <th className="px-3 py-2 font-medium text-right">Avg Score</th>
                  <th className="px-3 py-2 font-medium text-center">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {indivData.map((r) => {
                  const { cls: gradeCls } = autoGradeFromScore(r.avgScore);
                  return (
                    <tr key={r.owner_id} className="hover:bg-muted/50">
                      <td className="px-3 py-2 font-medium text-foreground">{r.owner_name || r.owner_id}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{r.total}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{r.onTrack}</td>
                      <td className="px-3 py-2">
                        <ProgressBandChip progress={r.avgScore} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={`font-semibold ${scoreTextColor(r.avgScore)}`}>{r.avgScore.toFixed(2)}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${gradeCls}`}>{r.grade}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Auto-Grade helpers ────────────────────────────────────────────────────────

function autoGradeFromScore(score: number): { grade: string; cls: string } {
  if (score >= 0.80) return { grade: 'A', cls: 'bg-green-100 text-green-800' };
  if (score >= 0.60) return { grade: 'B', cls: 'bg-blue-100 text-blue-800' };
  if (score >= 0.40) return { grade: 'C', cls: 'bg-yellow-100 text-yellow-800' };
  if (score >= 0.20) return { grade: 'D', cls: 'bg-orange-100 text-orange-800' };
  return { grade: 'F', cls: 'bg-red-100 text-red-800' };
}

function AutoGradeBadge({ score, actualGrade }: { score: number; actualGrade?: string }) {
  if (actualGrade) {
    const { cls } = autoGradeFromScore(score);
    return (
      <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${GRADE_COLOR[actualGrade] ?? cls}`}>
        {actualGrade}
      </span>
    );
  }
  const { grade, cls } = autoGradeFromScore(score);
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${cls}`}>
      {grade} <span className="font-normal opacity-70">({t('okr.gradeSuggested')})</span>
    </span>
  );
}

// ── Timeline / Gantt View ─────────────────────────────────────────────────────

const TIMELINE_BAR_COLOR: Record<string, string> = {
  Company: 'bg-purple-500',
  Department: 'bg-blue-500',
  Team: 'bg-teal-500',
  Individual: 'bg-gray-400',
};

function TimelineView({ okrs, cycles, onOKRClick }: { okrs: OKR[]; cycles: OKRCycle[]; onOKRClick?: (okr: OKR) => void }) {
  const [zoom, setZoom] = useState<'month' | 'quarter' | 'year'>('month');
  const containerRef = useRef<HTMLDivElement>(null);
  const [timelineTooltip, setTimelineTooltip] = useState<{ okr: OKR; x: number; y: number } | null>(null);

  const activeCycle = cycles.find((c) => c.status === 'Active') ?? cycles[0];
  const cycleStart = activeCycle
    ? new Date(activeCycle.start_date)
    : new Date(new Date().getFullYear(), 0, 1);
  const cycleEnd = activeCycle
    ? new Date(activeCycle.end_date)
    : new Date(new Date().getFullYear(), 11, 31);

  const totalMs = cycleEnd.getTime() - cycleStart.getTime();
  const today = new Date();

  function dateToPct(d: Date): number {
    return Math.min(100, Math.max(0, ((d.getTime() - cycleStart.getTime()) / totalMs) * 100));
  }

  const todayPct = dateToPct(today);

  function getXLabels(): { label: string; pct: number }[] {
    const labels: { label: string; pct: number }[] = [];
    const cur = new Date(cycleStart.getFullYear(), cycleStart.getMonth(), 1);
    while (cur <= cycleEnd) {
      if (zoom === 'month') {
        labels.push({ label: cur.toLocaleDateString('en', { month: 'short', year: '2-digit' }), pct: dateToPct(cur) });
        cur.setMonth(cur.getMonth() + 1);
      } else if (zoom === 'quarter') {
        const q = Math.floor(cur.getMonth() / 3) + 1;
        labels.push({ label: `Q${q} ${cur.getFullYear()}`, pct: dateToPct(cur) });
        cur.setMonth(cur.getMonth() + 3);
      } else {
        labels.push({ label: String(cur.getFullYear()), pct: dateToPct(cur) });
        cur.setFullYear(cur.getFullYear() + 1);
      }
    }
    return labels;
  }

  const xLabels = getXLabels();

  // Map OKR quarter to approximate date range
  function okrDateRange(o: OKR): { start: Date; end: Date } {
    const y = o.year ?? cycleStart.getFullYear();
    const qMap: Record<string, [number, number]> = {
      Q1: [0, 2], Q2: [3, 5], Q3: [6, 8], Q4: [9, 11],
    };
    const [sm, em] = qMap[o.quarter ?? 'Q1'] ?? [0, 11];
    return { start: new Date(y, sm, 1), end: new Date(y, em + 1, 0) };
  }

  // Group by owner
  const ownerGroups = okrs.reduce<Record<string, OKR[]>>((acc, o) => {
    const key = o.owner ?? 'Unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Columns size={16} className="text-blue-500" /> {t('okr.timeline.title')}
        </h3>
        <div className="flex gap-1">
          {(['month', 'quarter', 'year'] as const).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-3 py-1.5 text-xs rounded-lg border capitalize transition-colors ${
                zoom === z ? 'bg-blue-600 text-white border-blue-600' : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {z === 'month' ? t('okr.timeline.month') : z === 'quarter' ? t('okr.timeline.quarter') : t('okr.timeline.year')}
            </button>
          ))}
        </div>
      </div>

      {okrs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{t('common.noResults')}</p>
      ) : (
        <div className="overflow-x-auto" ref={containerRef}>
          <div style={{ minWidth: '640px' }}>
            {/* X-axis labels */}
            <div className="relative h-6 border-b border-border mb-1 ml-28">
              {xLabels.map((l, i) => (
                <span
                  key={i}
                  className="absolute text-xs text-muted-foreground -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `${l.pct}%` }}
                >
                  {l.label}
                </span>
              ))}
            </div>

            {/* Rows */}
            <div className="space-y-0.5">
              {Object.entries(ownerGroups).map(([owner, ownerOkrs]) => (
                <div key={owner}>
                  <p className="text-xs font-semibold text-muted-foreground py-1.5 bg-muted rounded px-2 mt-2">{owner}</p>
                  {ownerOkrs.map((o) => {
                    const { start, end } = okrDateRange(o);
                    const leftPct = dateToPct(start);
                    const widthPct = Math.max(1, dateToPct(end) - leftPct);
                    const barColor = TIMELINE_BAR_COLOR[o.type] ?? 'bg-gray-400';
                    const score = (o.progress ?? 0) / 100;

                    return (
                      <div key={o.id} className="flex items-center h-8">
                        <div className="w-28 shrink-0 pr-2">
                          <p className="text-xs text-muted-foreground truncate text-right">{o.type}</p>
                        </div>
                        <div className="flex-1 relative h-6">
                          <div
                            className={`absolute h-6 rounded-md ${barColor} flex items-center px-2 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity`}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%`, position: 'relative', overflow: 'visible' }}
                            onClick={() => onOKRClick?.(o)}
                            onMouseEnter={(e) => {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setTimelineTooltip({ okr: o, x: rect.left, y: rect.bottom + 6 });
                            }}
                            onMouseLeave={() => setTimelineTooltip(null)}
                          >
                            <span className="text-white text-xs font-medium truncate leading-none">{o.title}</span>
                            {(o.keyResults ?? []).map((kr) => {
                              const krPct = Math.min(100, Math.max(0, kr.targetValue ? (kr.currentValue / kr.targetValue) * 100 : 0));
                              return (
                                <div
                                  key={kr.id}
                                  className="absolute w-3 h-3 bg-white border-2 border-indigo-600 rotate-45 -translate-y-1/2 top-1/2 cursor-pointer z-10"
                                  style={{ left: `${krPct}%` }}
                                  title={`${kr.title}: ${kr.currentValue}/${kr.targetValue}`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Today line overlay */}
            <div className="relative ml-28 mt-1" style={{ height: '4px' }}>
              {todayPct >= 0 && todayPct <= 100 && (
                <div
                  className="absolute"
                  style={{
                    left: `${todayPct}%`,
                    top: '-200px',
                    width: '2px',
                    height: '200px',
                    background: 'rgba(239,68,68,0.7)',
                    borderLeft: '2px dashed #ef4444',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>

            {/* Legend */}
            <div className="flex gap-3 mt-4 flex-wrap">
              {Object.entries(TIMELINE_BAR_COLOR).map(([level, color]) => (
                <div key={level} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className={`w-3 h-3 rounded ${color}`} />
                  {level}
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-xs text-red-500">
                <div className="w-3 h-0 border-t-2 border-dashed border-red-500" />
                {t('okr.timeline.today')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styled tooltip */}
      {timelineTooltip && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm pointer-events-none"
          style={{ left: timelineTooltip.x, top: timelineTooltip.y, minWidth: 200, maxWidth: 280 }}
        >
          <p className="font-semibold text-foreground truncate mb-1">{timelineTooltip.okr.title}</p>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>Owner: <span className="text-foreground">{timelineTooltip.okr.owner ?? '—'}</span></p>
            <p>Score: <span className="text-foreground font-medium">{((timelineTooltip.okr.progress ?? 0) / 100).toFixed(2)}</span></p>
            <p>Period: <span className="text-foreground">{timelineTooltip.okr.quarter} {timelineTooltip.okr.year}</span></p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Excel Export ──────────────────────────────────────────────────────────────

function exportOKRScorecard(okrs: OKR[]) {
  const rows = okrs.map((o) => {
    const score = (o.progress ?? 0) / 100;
    const { grade: autoGrade } = autoGradeFromScore(score);
    const actualGrade = (o as OKR & { grade?: string }).grade;
    const krTitles = (o.keyResults ?? []).map((kr) => kr.title).join('; ');
    return {
      [t('okr.objective')]: o.title ?? '',
      [t('okr.type')]: o.type ?? '',
      [t('okr.owner')]: o.owner ?? '',
      [t('okr.department')]: o.department ?? '',
      Cycle: `${o.quarter ?? ''} ${o.year ?? ''}`,
      Score: score.toFixed(2),
      Grade: actualGrade ?? autoGrade,
      'Start Date': o.quarter && o.year ? `${o.year}-${o.quarter}` : '',
      'End Date': '',
      'Key Results': krTitles,
      'Is Closed': o.status === 'Completed' || o.status === 'Cancelled' ? 'Yes' : 'No',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'OKR Scorecard');
  XLSX.writeFile(wb, 'okr-scorecard.xlsx');
}

// ── OKR Form Modal ────────────────────────────────────────────────────────────

interface OKRFormData {
  title: string;
  description: string;
  type: string;
  owner: string;
  department: string;
  quarter: string;
  year: number;
  status: string;
  parentId: string;
  cycleId: string;
}

function OKRFormModal({
  initial,
  ownerDefault,
  onSave,
  onClose,
  isAdmin,
  isManager,
  selectedCycleId,
  allOkrs = [],
  canAlign = true,
}: {
  initial?: Partial<OKR>;
  ownerDefault: string;
  onSave: (data: Partial<OKR>) => Promise<void>;
  onClose: () => void;
  isAdmin?: boolean;
  isManager?: boolean;
  selectedCycleId?: string;
  allOkrs?: OKR[];
  canAlign?: boolean;
}) {
  const { options: departments = [] } = useDepartmentOptions();
  const [form, setForm] = useState<OKRFormData>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    type: initial?.type ?? 'Individual',
    owner: initial?.owner ?? ownerDefault,
    department: initial?.department ?? '',
    quarter: initial?.quarter ?? 'Q1',
    year: initial?.year ?? currentYear,
    status: initial?.status ?? 'On Track',
    parentId: initial?.parentId ?? '',
    cycleId: (initial as Partial<OKR> & { cycle_id?: string })?.cycle_id ?? selectedCycleId ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showManageTemplates, setShowManageTemplates] = useState(false);
  const [templateKRs, setTemplateKRs] = useState<Partial<KeyResult>[]>([]);
  const [cycles, setCycles] = useState<{ id: string; name: string; status: string }[]>([]);
  const [alignmentSearch, setAlignmentSearch] = useState('');
  const [alignmentOptions, setAlignmentOptions] = useState<{ id: string; title: string; type: string; owner_name?: string }[]>([]);
  const [showAlignmentDropdown, setShowAlignmentDropdown] = useState(false);

  const initialForm = useRef(form);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm.current);
  useUnsavedChanges(isDirty);

  const handleClose = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Discard them?')) return;
    onClose();
  };

  useEffect(() => {
    async function loadCycles() {
      const { data } = await supabase.from("okr_cycles").select("id, name, status").neq("status", "Closed").order("start_date", { ascending: false });
      setCycles(data ?? []);
    }
    async function loadHigherOKRs() {
      const { data } = await supabase.from("okrs").select("id, title, type, owner_name").in("type", ["company", "department", "team"]);
      setAlignmentOptions(data ?? []);
    }
    loadCycles();
    loadHigherOKRs();
  }, []);

  const set = (k: keyof OKRFormData, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (initial?.id && (initial as Partial<OKR> & { is_closed?: boolean }).is_closed === true && !isAdmin && !isManager) {
      toast.error('Closed OKRs cannot be edited');
      return;
    }
    if (form.title.trim().length < 10) { toast.error('OKR title must be at least 10 characters.'); return; }
    if (form.title.length > 200) { toast.error("Title cannot exceed 200 characters."); return; }
    if (initial?.id && (initial?.keyResults ?? []).length === 0) { toast.error('Add at least one key result.'); return; }
    // Cycle status enforcement
    if (form.cycleId) {
      const { data: selectedCycle } = await supabase.from("okr_cycles").select("status").eq("id", form.cycleId).single();
      if (!initial?.id && selectedCycle?.status === "Closed") {
        toast.error("Cannot create OKRs in a closed cycle");
        return;
      }
      if (initial?.id && selectedCycle?.status === "Closed" && !isAdmin) {
        toast.error("Cannot edit OKRs in a closed cycle");
        return;
      }
    }
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = t('validation.okr.title');
    if (!form.owner?.trim()) errs.owner = t('validation.okr.owner');
    if (!form.quarter) errs.quarter = t('validation.okr.quarter');
    if (Object.keys(errs).length > 0) { setErrors(errs); toast.error(t('common.error')); return; }
    setErrors({});
    if (form.parentId && initial?.id && wouldCreateCycle(allOkrs, initial.id, form.parentId)) {
      toast.error("Cannot align: this would create a circular reference.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...form,
        parentId: form.parentId || undefined,
        keyResults: templateKRs.length > 0 ? templateKRs as KeyResult[] : undefined,
        ...(form.cycleId ? { cycle_id: form.cycleId } as Record<string, unknown> : {}),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-lg font-semibold">{initial?.id ? t('okr.editOKR') : t('okr.newOKR')}</h2>
            <div className="flex gap-2">
              {!initial?.id && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowTemplatePicker(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted text-muted-foreground"
                  >
                    <FileText size={12} /> {t('okr.template.fromTemplate')}
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setShowManageTemplates(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted text-muted-foreground"
                    >
                      <Shield size={12} /> {t('okr.template.manage')}
                    </button>
                  )}
                </>
              )}
              <button onClick={handleClose} className="p-1 hover:bg-muted rounded-lg"><X size={18} /></button>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t('okr.titleLabel')}</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder={t('okr.titlePlaceholder')}
                maxLength={200}
              />
              {errors.title && <p className="text-xs text-red-500 mt-0.5">{errors.title}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t('okr.description')}</label>
              <textarea
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder={t('okr.descriptionPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('okr.type')}</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.type}
                  onChange={(e) => set('type', e.target.value)}
                >
                  <SelectOptions entity="okr" field="type" fallback={['Company','Department','Individual']} />
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('common.status')}</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                >
                  <SelectOptions entity="okr" field="status" fallback={['Draft','Active','Completed','Cancelled']} />
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Cycle</label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.cycleId}
                onChange={(e) => set('cycleId', e.target.value)}
              >
                <option value="">Select cycle...</option>
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('okr.quarter')}</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.quarter}
                  onChange={(e) => set('quarter', e.target.value)}
                >
                  {OKR_QUARTERS.map((q) => <option key={q}>{q}</option>)}
                </select>
                {errors.quarter && <p className="text-xs text-red-500 mt-0.5">{errors.quarter}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('okr.year')}</label>
                <input
                  type="number"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.year}
                  onChange={(e) => set('year', Number(e.target.value))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('okr.owner')}</label>
                <input
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.owner}
                  onChange={(e) => set('owner', e.target.value)}
                />
                {errors.owner && <p className="text-xs text-red-500 mt-0.5">{errors.owner}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('okr.department')}</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.department}
                  onChange={(e) => set('department', e.target.value)}
                >
                  <option value="">{t('okr.selectDepartment')}</option>
                  {departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>
            {canAlign && <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t('okr.parentOKRId')}</label>
              <div className="relative">
                <input
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search OKRs to align to..."
                  value={alignmentSearch}
                  onChange={(e) => { setAlignmentSearch(e.target.value); setShowAlignmentDropdown(true); }}
                  onFocus={() => setShowAlignmentDropdown(true)}
                />
                {form.parentId && !showAlignmentDropdown && (
                  <p className="text-xs text-blue-600 mt-1">
                    Aligned to: {alignmentOptions.find((o) => o.id === form.parentId)?.title ?? form.parentId}
                  </p>
                )}
                {showAlignmentDropdown && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2.5 text-xs text-muted-foreground hover:bg-muted border-b border-border italic"
                      onClick={() => { set('parentId', ''); setAlignmentSearch(''); setShowAlignmentDropdown(false); }}
                    >
                      None (top-level OKR)
                    </button>
                    {alignmentOptions
                      .filter((o) => !alignmentSearch || o.title.toLowerCase().includes(alignmentSearch.toLowerCase()))
                      .map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted border-b border-border last:border-b-0"
                          onClick={() => { set('parentId', o.id); setAlignmentSearch(o.title); setShowAlignmentDropdown(false); }}
                        >
                          <span className="font-medium text-foreground">{o.title}</span>
                          <span className="text-xs text-muted-foreground ml-2">({o.type})</span>
                          {o.owner_name && <span className="text-xs text-muted-foreground ml-1">· {o.owner_name}</span>}
                        </button>
                      ))}
                    {alignmentSearch && alignmentOptions.filter((o) => o.title.toLowerCase().includes(alignmentSearch.toLowerCase())).length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">No matching OKRs found</p>
                    )}
                  </div>
                )}
              </div>
            </div>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={handleClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg">
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? t('common.saving') : t('okr.saveOKR')}
              </button>
            </div>
          </form>
        </div>
      </div>
      {showTemplatePicker && (
        <TemplatePickerModal
          onSelect={(tpl) => {
            set('title', tpl.objective_template);
            if (tpl.key_results_template && Array.isArray(tpl.key_results_template)) {
              const prefilledKRs: Partial<KeyResult>[] = tpl.key_results_template.map((kr) => ({
                id: crypto.randomUUID(),
                title: kr.title || '',
                startValue: kr.start_value ?? kr.startValue ?? 0,
                targetValue: kr.target_value ?? kr.targetValue ?? 100,
                unit: kr.unit || '%',
                is_boolean: kr.is_boolean ?? false,
                is_completed: false,
                currentValue: kr.start_value ?? kr.startValue ?? 0,
              }));
              setTemplateKRs(prefilledKRs);
            }
            setShowTemplatePicker(false);
          }}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}
      {showManageTemplates && (
        <ManageTemplatesModal onClose={() => setShowManageTemplates(false)} />
      )}
    </>
  );
}

// ── KR Form Modal ─────────────────────────────────────────────────────────────

function KRFormModal({
  okrTitle,
  existingKRCount = 0,
  onAdd,
  onClose,
}: {
  okrTitle: string;
  existingKRCount?: number;
  onAdd: (kr: Partial<KeyResult>) => Promise<void>;
  onClose: () => void;
}) {
  const blank = () => ({
    title: '', unit: '%', startValue: 0, targetValue: 100, currentValue: 0, dueDate: '',
    isBoolean: false, isCompleted: false,
  });
  const [form, setForm] = useState(blank());
  const [addedCount, setAddedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [krErrors, setKrErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string | number | boolean) => setForm((f) => ({ ...f, [k]: v }));

  async function handleAdd(keepOpen: boolean) {
    const totalKRs = existingKRCount + addedCount;
    if (totalKRs >= 5) { toast.error('Maximum 5 key results per OKR.'); return; }
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = t('validation.kr.title');
    if (!form.isBoolean) {
      if (Number(form.targetValue) <= 0) errs.targetValue = t('validation.kr.targetPositive');
      else if (Number(form.targetValue) <= Number(form.startValue)) { toast.error('Target value must be greater than start value.'); return; }
    }
    if (Object.keys(errs).length > 0) { setKrErrors(errs); toast.error(t('common.error')); return; }
    setKrErrors({});
    setSaving(true);
    try {
      await onAdd({
        title: form.title,
        unit: form.isBoolean ? 'boolean' : form.unit,
        startValue: form.isBoolean ? 0 : Number(form.startValue),
        targetValue: form.isBoolean ? 1 : Number(form.targetValue),
        currentValue: form.isBoolean ? (form.isCompleted ? 1 : 0) : Number(form.currentValue),
        dueDate: form.dueDate || undefined,
        is_boolean: form.isBoolean,
        is_completed: form.isBoolean ? form.isCompleted : false,
      });
      toast.success(t('okr.keyResultAdded'));
      setAddedCount((c) => c + 1);
      if (keepOpen) setForm(blank());
      else onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold">{t('okr.addKeyResult')}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{okrTitle}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t('okr.titleLabel')}</label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={t('okr.krTitlePlaceholder')}
            />
            {krErrors.title && <p className="text-xs text-red-500 mt-0.5">{krErrors.title}</p>}
          </div>
          {/* Boolean KR toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isBoolean}
              onChange={(e) => set('isBoolean', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium text-foreground">Boolean KR (Yes/No completion)</span>
          </label>
          {form.isBoolean ? (
            <div className="p-3 bg-muted rounded-xl">
              <p className="text-sm font-medium text-foreground mb-2">Completed:</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="isCompleted" checked={!form.isCompleted} onChange={() => set('isCompleted', false)} />
                  <span className="text-sm">No</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="isCompleted" checked={form.isCompleted} onChange={() => set('isCompleted', true)} />
                  <span className="text-sm">Yes</span>
                </label>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{t('okr.unit')}</label>
                  <select
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.unit}
                    onChange={(e) => set('unit', e.target.value)}
                  >
                    <SelectOptions entity="okr" field="kr_unit" fallback={['Percentage','Number','Currency','Boolean']} />
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{t('projects.dueDate')}</label>
                  <input
                    type="date"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.dueDate}
                    onChange={(e) => set('dueDate', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{t('okr.start')}</label>
                  <input
                    type="number"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.startValue}
                    onChange={(e) => set('startValue', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{t('okr.target')}</label>
                  <input
                    type="number"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.targetValue}
                    onChange={(e) => set('targetValue', e.target.value)}
                  />
                  {krErrors.targetValue && <p className="text-xs text-red-500 mt-0.5">{krErrors.targetValue}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{t('okr.current')}</label>
                  <input
                    type="number"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.currentValue}
                    onChange={(e) => set('currentValue', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg">
              Done
            </button>
            <button
              disabled={saving}
              onClick={() => handleAdd(true)}
              className="px-4 py-2 text-sm border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
            >
              Add Another
            </button>
            <button
              disabled={saving}
              onClick={() => handleAdd(false)}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add & Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── OKR Detail Modal ──────────────────────────────────────────────────────────

function OKRDetailModal({
  okr,
  allOKRs,
  canEdit,
  onUpdateKR,
  onCheckIn,
  onClose,
}: {
  okr: OKR;
  allOKRs: OKR[];
  canEdit: boolean;
  onUpdateKR: (krId: string, currentValue: number, note: string) => Promise<void>;
  onCheckIn: () => void;
  onClose: () => void;
}) {
  const [krInputs, setKrInputs] = useState<Record<string, number>>(
    Object.fromEntries((okr.keyResults ?? []).map((kr) => [kr.id, kr.currentValue]))
  );
  const [krNotes, setKrNotes] = useState<Record<string, string>>({});
  const [updating, setUpdating] = useState<string | null>(null);

  const parentOKR = okr.parentId ? allOKRs.find((o) => o.id === okr.parentId) : null;

  async function handleKRUpdate(kr: KeyResult) {
    setUpdating(kr.id);
    try {
      await onUpdateKR(kr.id, krInputs[kr.id] ?? kr.currentValue, krNotes[kr.id] ?? '');
      toast.success('Key result updated');
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge label={okr.type} cls={TYPE_COLOR[okr.type] ?? 'bg-gray-100 text-gray-700'} />
              <Badge label={okr.status} cls={STATUS_COLOR[okr.status] ?? 'bg-gray-100 text-gray-700'} />
            </div>
            <h2 className="text-lg font-semibold text-foreground truncate">{okr.title}</h2>
            {okr.description && <p className="text-sm text-muted-foreground mt-1">{okr.description}</p>}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg shrink-0"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div><span className="text-muted-foreground">Owner</span><p className="font-medium mt-0.5">{okr.owner}</p></div>
            <div><span className="text-muted-foreground">Quarter</span><p className="font-medium mt-0.5">{okr.quarter} {okr.year}</p></div>
            <div><span className="text-muted-foreground">Department</span><p className="font-medium mt-0.5">{okr.department || '—'}</p></div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-foreground">Overall Progress</span>
              <span className="font-semibold">{okr.progress ?? 0}%</span>
            </div>
            {progressBar(okr.progress ?? 0, okr.status)}
          </div>

          {parentOKR && (
            <div className="p-3 bg-blue-50 rounded-xl text-sm">
              <span className="text-blue-600 font-medium">Parent OKR: </span>
              <span className="text-blue-800">{parentOKR.title}</span>
              <span className="text-blue-500 ml-2">({parentOKR.progress}% complete)</span>
            </div>
          )}

          <div className="p-3 bg-muted rounded-xl text-sm text-muted-foreground">
            This OKR period aligns with the <span className="font-medium text-foreground">{okr.quarter} {okr.year}</span> performance review cycle.
          </div>

          {(okr.keyResults ?? []).length > 0 && (
            <div>
              <h3 className="font-semibold text-foreground mb-3">Key Results</h3>
              <div className="space-y-4">
                {okr.keyResults.map((kr) => (
                  <div key={kr.id} className="border border-border rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium text-foreground">{kr.title}</p>
                      <span className="text-xs text-muted-foreground ml-2">{kr.unit}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <span>{kr.currentValue} / {kr.targetValue}</span>
                      <span className="font-semibold text-foreground">{kr.progress ?? 0}%</span>
                    </div>
                    {/* KR Score bar */}
                    <KRScoreBar kr={kr} />
                    {canEdit && (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="number"
                          className="flex-1 border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={krInputs[kr.id] ?? kr.currentValue}
                          onChange={(e) => setKrInputs((p) => ({ ...p, [kr.id]: Number(e.target.value) }))}
                          placeholder="Current value"
                        />
                        <input
                          className="flex-1 border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={krNotes[kr.id] ?? ''}
                          onChange={(e) => setKrNotes((p) => ({ ...p, [kr.id]: e.target.value }))}
                          placeholder="Note (optional)"
                        />
                        <button
                          disabled={updating === kr.id}
                          onClick={() => handleKRUpdate(kr)}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
                        >
                          {updating === kr.id ? '...' : 'Update'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {canEdit && (
            <button
              onClick={onCheckIn}
              className="w-full py-2 border-2 border-dashed border-blue-200 text-blue-600 text-sm rounded-xl hover:bg-blue-50 transition-colors"
            >
              + Submit Check-in
            </button>
          )}

          {(okr.updates ?? []).length > 0 && (
            <div>
              <h3 className="font-semibold text-foreground mb-3">Update History</h3>
              <div className="space-y-3">
                {[...okr.updates].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map((u) => (
                  <div key={u.id} className="border-l-2 border-blue-200 pl-3 py-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span className="font-medium text-muted-foreground">{u.updatedBy}</span>
                      <span>{new Date(u.updatedAt).toLocaleDateString()}</span>
                      {u.progressBefore !== undefined && (
                        <span className="text-blue-500">{u.progressBefore}% → {u.progressAfter}%</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{u.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── OKR Card ──────────────────────────────────────────────────────────────────

function printOKRScorecard(okr: OKR & { grade?: string }) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  const html = `<html><head><title>OKR Scorecard</title>
  <style>body{font-family:Arial,sans-serif;padding:24px} table{width:100%;border-collapse:collapse} td,th{border:1px solid #ddd;padding:8px} @media print{body{padding:0}}</style>
  </head><body>
  <h2>OKR Scorecard — ${new Date().toLocaleDateString()}</h2>
  <table><thead><tr><th>OKR Title</th><th>Progress</th><th>Grade</th><th>Status</th></tr></thead>
  <tbody><tr><td>${okr.title}</td><td>${okr.progress ?? 0}%</td><td>${okr.grade ?? "—"}</td><td>${okr.status}</td></tr>
  </tbody></table>
  </body></html>`;
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 400);
}

function OKRCard({
  okr,
  canEdit,
  canDelete,
  canGrade,
  showDisabledGrade,
  onView,
  onEdit,
  onCheckIn,
  onDelete,
  onGrade,
}: {
  okr: OKR & { grade?: string; grade_comment?: string };
  canEdit: boolean;
  canDelete: boolean;
  canGrade: boolean;
  showDisabledGrade?: boolean;
  onView: () => void;
  onEdit: () => void;
  onCheckIn: () => void;
  onDelete: () => void;
  onGrade: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge label={okr.type} cls={TYPE_COLOR[okr.type] ?? 'bg-gray-100 text-gray-700'} />
            <Badge label={okr.status} cls={STATUS_COLOR[okr.status] ?? 'bg-gray-100 text-gray-700'} />
          </div>
          <h3 className="font-semibold text-foreground text-sm truncate">{okr.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{okr.owner}</p>
        </div>
        <div className="flex gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onView} title="View" className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground">
            <Eye size={14} />
          </button>
          {canEdit && (
            <button onClick={onEdit} title="Edit" className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground">
              <Edit2 size={14} />
            </button>
          )}
          {canEdit && (
            <button onClick={onCheckIn} title="Check-in" className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500">
              <CheckSquare size={14} />
            </button>
          )}
          {canGrade && okr.status !== 'Draft' && (okr.progress ?? 0) > 0 && (
            <button onClick={onGrade} title="Grade OKR" className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-500">
              <Award size={14} />
            </button>
          )}
          {showDisabledGrade && okr.status !== 'Draft' && (
            <button
              disabled
              title="Cannot grade your own OKR"
              className="p-1.5 rounded-lg text-gray-300 cursor-not-allowed"
            >
              <Award size={14} />
            </button>
          )}
          {canDelete && (
            <button onClick={onDelete} title="Delete" className="p-1.5 hover:bg-red-50 rounded-lg text-red-400">
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={() => printOKRScorecard(okr)}
            title="Print Scorecard"
            className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-400"
          >
            <FileText size={14} />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Progress</span>
          <span className="font-semibold text-foreground">{okr.progress ?? 0}%</span>
        </div>
        {progressBar(okr.progress ?? 0, okr.status)}
      </div>

      {/* Key Results toggle */}
      {(okr.keyResults ?? []).length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {okr.keyResults.length} Key Result{okr.keyResults.length !== 1 ? 's' : ''}
          </button>
          {expanded && (
            <div className="mt-3 space-y-3">
              {okr.keyResults.map((kr) => {
                const score = krScore(kr);
                return (
                  <div key={kr.id} className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="truncate text-muted-foreground">{kr.title}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">{kr.currentValue}/{kr.targetValue} {kr.unit}</span>
                    </div>
                    <KRScoreBar kr={kr} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        <span>{okr.quarter} {okr.year}</span>
        {okr.department && <span>· {okr.department}</span>}
        <ProgressBandChip progress={(okr.progress ?? 0) / 100} />
        <AutoGradeBadge score={(okr.progress ?? 0) / 100} actualGrade={okr.grade ?? undefined} />
        {okr.updatedAt && (
          <span className="ml-auto">Updated {new Date(okr.updatedAt).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
}

// ── Cascading Tree ────────────────────────────────────────────────────────────

function DroppableZone({ id, label }: { id: string; label: string }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 border-2 border-dashed rounded-lg px-3 py-2 mb-3 text-xs font-medium transition-colors ${isOver ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-gray-200 text-muted-foreground'}`}
    >
      <GitBranch size={12} />
      {label}
    </div>
  );
}

function DraggableCascadeNode({ okr, allOKRs, depth = 0, activeDragId }: { okr: OKR; allOKRs: OKR[]; depth?: number; activeDragId?: string | null }) {
  const [open, setOpen] = useState(depth < 2);
  const children = allOKRs.filter((o) => o.parentId === okr.id);

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id: okr.id });
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: okr.id });

  const dragStyle = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 };

  // Don't show this node as a drop target if it's being dragged or is a descendant of the dragged item
  const isValidDropTarget = activeDragId && activeDragId !== okr.id && !isDescendant(allOKRs, okr.id, activeDragId);

  return (
    <div
      ref={setDropRef}
      className={`${depth > 0 ? 'ml-5 border-l border-border pl-3' : ''} ${isOver && isValidDropTarget ? 'rounded-lg ring-2 ring-indigo-400 ring-offset-1' : ''}`}
    >
      <div
        ref={setDragRef}
        style={dragStyle}
        className="flex items-center gap-2 py-2 rounded-lg px-2 hover:bg-muted"
      >
        {/* Drag handle */}
        <span
          className="shrink-0 cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </span>
        {/* Expand/collapse toggle */}
        <span className="shrink-0 cursor-pointer" onClick={() => setOpen((o) => !o)}>
          {children.length > 0 ? (open ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />) : <span className="w-3.5 inline-block" />}
        </span>
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${STATUS_BAR[okr.status] ?? 'bg-gray-300'}`}
        />
        <span className="text-sm font-medium text-foreground flex-1 truncate">{okr.title}</span>
        <span className="text-xs text-muted-foreground shrink-0">{okr.progress ?? 0}%</span>
        <div className="w-16 shrink-0">
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${STATUS_BAR[okr.status] ?? 'bg-gray-300'}`}
              style={{ width: `${okr.progress ?? 0}%` }}
            />
          </div>
        </div>
        <Badge label={okr.type} cls={`${TYPE_COLOR[okr.type] ?? 'bg-gray-100 text-gray-700'} shrink-0`} />
      </div>
      {open && children.map((child) => (
        <DraggableCascadeNode key={child.id} okr={child} allOKRs={allOKRs} depth={depth + 1} activeDragId={activeDragId} />
      ))}
    </div>
  );
}

// Legacy alias kept for backward compatibility
function CascadeNode({ okr, allOKRs, depth = 0 }: { okr: OKR; allOKRs: OKR[]; depth?: number }) {
  return <DraggableCascadeNode okr={okr} allOKRs={allOKRs} depth={depth} />;
}

// ── Cycle Status Badge ────────────────────────────────────────────────────────

function CycleStatusBadge({ status }: { status: OKRCycle['status'] }) {
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${CYCLE_STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

// ── Cycles View ───────────────────────────────────────────────────────────────

function CyclesView({
  cycles,
  okrs,
  isManager,
  onManageCycle,
  onCyclesChanged,
}: {
  cycles: OKRCycle[];
  okrs: OKR[];
  isManager: boolean;
  onManageCycle: (cycle: OKRCycle) => void;
  onCyclesChanged?: () => void;
}) {
  async function handleCycleStatusChange(cycle: OKRCycle, newStatus: string) {
    if (!validateCycleTransition(cycle.status, newStatus)) {
      toast.error(`Cannot transition from ${cycle.status} to ${newStatus}`);
      return;
    }
    const { error } = await supabase.from('okr_cycles').update({ status: newStatus }).eq('id', cycle.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Cycle moved to ${newStatus}`);
    onCyclesChanged?.();
  }
  const activeCycle = cycles.find((c) => c.status === 'Active');

  if (cycles.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-muted-foreground">
        <Calendar size={32} className="mb-3 opacity-40" />
        <p className="text-sm">No cycles found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cycles.map((cycle) => {
        const cycleOKRs = okrs.filter(
          (o) => (o as OKR & { cycle_id?: string }).cycle_id === cycle.id ||
                 o.year === new Date(cycle.start_date).getFullYear()
        );
        const avgScore =
          cycleOKRs.length > 0
            ? cycleOKRs.reduce((sum, o) => sum + (o.progress ?? 0), 0) / cycleOKRs.length
            : 0;
        const isActive = cycle.id === activeCycle?.id;
        return (
          <div
            key={cycle.id}
            className={`bg-white border rounded-lg p-4 ${isActive ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-200'}`}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-gray-900">{cycle.name}</h3>
              <CycleStatusBadge status={cycle.status} />
            </div>
            <p className="text-xs text-gray-500 mb-3">{cycle.start_date} → {cycle.end_date}</p>
            <div className="flex gap-4 text-sm text-gray-600 mb-3">
              <span>{cycleOKRs.length} OKR{cycleOKRs.length !== 1 ? 's' : ''}</span>
              <span>Avg: {avgScore.toFixed(0)}%</span>
            </div>
            {isManager && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => onManageCycle(cycle)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Manage →
                </button>
                {VALID_TRANSITIONS[cycle.status]?.map((next) => (
                  <button
                    key={next}
                    onClick={() => handleCycleStatusChange(cycle, next)}
                    className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                  >
                    → {next}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function OKRManagementEnhanced({
  accessToken,
  onLogout,
}: {
  accessToken: string;
  onLogout: () => void;
}) {
  const { currentUser } = useUser();
  const secCreate = useSectionPermission("okr", "create");
  const secUpdateProgress = useSectionPermission("okr", "update_progress");
  const secAlign = useSectionPermission("okr", "align");
  const secReports = useSectionPermission("okr", "reports");
  const { log } = useAuditLogger();
  const {
    okrs, stats, loading, error,
    loadAll, createOKR, updateOKR, deleteOKR,
    updateKRProgress, addKeyResult, checkIn,
  } = useOKRData();

  // RBAC
  const role: string = (currentUser?.primaryRole ?? currentUser?.roles?.[0] ?? 'employee').toLowerCase();
  const isAdmin = role === 'admin';
  const isManager = role === 'manager' || isAdmin;
  const userId = currentUser?.id;

  // Cycles
  const [cycles, setCycles] = useState<OKRCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('all');
  const [showNewCycle, setShowNewCycle] = useState(false);

  useEffect(() => {
    async function loadCycles() {
      const { data, count } = await supabase
        .from('okr_cycles')
        .select('*', { count: 'exact' })
        .order('start_date', { ascending: false });
      const list: OKRCycle[] = data ?? [];
      setCycles(list);
      // Pre-select active cycle
      const active = list.find((c) => c.status === 'Active');
      if (active) setSelectedCycleId(active.id);

      // Seed default cycles if empty
      if ((count ?? list.length) === 0) {
        const defaultCycles = [
          { name: 'Q1 2026', type: 'Quarterly', start_date: '2026-01-01', end_date: '2026-03-31', status: 'Planning', fiscal_year: 2026 },
          { name: 'Q2 2026', type: 'Quarterly', start_date: '2026-04-01', end_date: '2026-06-30', status: 'Active', fiscal_year: 2026 },
          { name: 'Q3 2026', type: 'Quarterly', start_date: '2026-07-01', end_date: '2026-09-30', status: 'Planning', fiscal_year: 2026 },
          { name: 'Q4 2026', type: 'Quarterly', start_date: '2026-10-01', end_date: '2026-12-31', status: 'Planning', fiscal_year: 2026 },
          { name: 'Annual 2026', type: 'Annual', start_date: '2026-01-01', end_date: '2026-12-31', status: 'Active', fiscal_year: 2026 },
        ];
        void supabase.from('okr_cycles').insert(defaultCycles);
      }
    }
    loadCycles();
  }, []);

  // Seed OKR templates if empty
  useEffect(() => {
    async function seedTemplates() {
      const { count } = await supabase
        .from('okr_templates')
        .select('*', { count: 'exact', head: true });
      if ((count ?? 1) === 0) {
        const templates = [
          {
            name: 'Increase Product Quality',
            type: 'team',
            level: 'team',
            objective_template: 'Increase overall product quality this quarter',
            key_results_template: [
              { title: 'Reduce bug count', unit: 'bugs', start_value: 50, target_value: 10 },
              { title: 'Increase test coverage', unit: '%', start_value: 60, target_value: 90 },
              { title: 'Achieve NPS score', unit: 'NPS', start_value: 30, target_value: 45 },
            ],
            is_active: true,
          },
          {
            name: 'Improve Customer Satisfaction',
            type: 'team',
            level: 'department',
            objective_template: 'Improve customer satisfaction scores across all channels',
            key_results_template: [
              { title: 'Increase CSAT score', unit: 'score', start_value: 3.5, target_value: 4.5 },
              { title: 'Reduce support response time', unit: 'hours', start_value: 24, target_value: 4 },
              { title: 'Resolve tickets within SLA', unit: '%', start_value: 70, target_value: 95 },
            ],
            is_active: true,
          },
          {
            name: 'Grow Team Capabilities',
            type: 'team',
            level: 'team',
            objective_template: 'Grow team skills through structured learning',
            key_results_template: [
              { title: 'Complete training certifications per person', unit: 'certifications', start_value: 0, target_value: 3 },
              { title: 'Mandatory training completion', unit: '%', start_value: 0, target_value: 100 },
              { title: 'Knowledge sharing sessions conducted', unit: 'sessions', start_value: 0, target_value: 4 },
            ],
            is_active: true,
          },
          {
            name: 'Revenue Growth',
            type: 'company',
            level: 'company',
            objective_template: 'Drive company revenue growth this year',
            key_results_template: [
              { title: 'Increase MRR', unit: '₹ Lakhs', start_value: 50, target_value: 75 },
              { title: 'Acquire enterprise customers', unit: 'customers', start_value: 0, target_value: 50 },
              { title: 'Reduce churn rate', unit: '%', start_value: 8, target_value: 4 },
            ],
            is_active: true,
          },
        ];
        void supabase.from('okr_templates').insert(templates);
      }
    }
    seedTemplates();
  }, []);

  // Load data
  useEffect(() => {
    const scopedId = isAdmin || isManager ? undefined : userId;
    loadAll(scopedId);
  }, [userId, isAdmin, isManager, loadAll]);

  // Filters
  const [quarterFilter, setQuarterFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [showCascade, setShowCascade] = useState(false);
  const [cascadeActiveDragId, setCascadeActiveDragId] = useState<string | null>(null);

  // View
  const [activeView, setActiveView] = useState<'list' | 'history' | 'analytics' | 'eoq' | 'timeline' | 'cycles'>('list');
  const [managingCycle, setManagingCycle] = useState<OKRCycle | null>(null);

  // Undo stack for delete
  interface OKRSnapshot {
    okr: Record<string, unknown>;
    keyResults: Record<string, unknown>[];
    checkins: Record<string, unknown>[];
  }
  const [undoStack, setUndoStack] = useState<OKRSnapshot[]>([]);

  // Modals
  const [showOKRForm, setShowOKRForm] = useState(false);
  const [editingOKR, setEditingOKR] = useState<OKR | null>(null);
  const [closedCycleReason, setClosedCycleReason] = useState('');
  const [showClosedReasonModal, setShowClosedReasonModal] = useState(false);
  const [pendingEditOKR, setPendingEditOKR] = useState<OKR | null>(null);
  const [viewingOKR, setViewingOKR] = useState<OKR | null>(null);
  const [checkInOKR, setCheckInOKR] = useState<OKR | null>(null);
  const [addKROKR, setAddKROKR] = useState<OKR | null>(null);
  const [gradingOKR, setGradingOKR] = useState<OKR | null>(null);
  const [confirmDeleteOKR, setConfirmDeleteOKR] = useState<OKR | null>(null);
  const [showBulkGrade, setShowBulkGrade] = useState(false);
  const [showCloseAllConfirm, setShowCloseAllConfirm] = useState(false);

  // Filtered OKRs
  const filtered = okrs.filter((o) => {
    if (quarterFilter !== 'All' && o.quarter !== quarterFilter) return false;
    if (typeFilter !== 'All' && o.type !== typeFilter) return false;
    if (search && !o.title.toLowerCase().includes(search.toLowerCase()) &&
      !o.owner?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Visibility-filtered OKRs for the list view
  const visibleOkrs = filtered.filter(okr => {
    if (isManager || isAdmin) return true;
    const level = (okr as OKR & { level?: string }).level ?? okr.type ?? 'Individual';
    if (level === 'Company') return true;
    if (level === 'Department') return okr.department === currentUser?.department;
    if (level === 'Team') return okr.department === currentUser?.department;
    return okr.ownerId === userId;
  });

  const handleSaveOKR = useCallback(async (data: Partial<OKR>) => {
    try {
      if (editingOKR?.id) {
        const prevParentId = editingOKR.parentId;
        const newParentId = data.parentId;
        await updateOKR(editingOKR.id, data, userId);
        log({ event_type: 'okr_created', action: 'okr_updated', resource_id: editingOKR.id, metadata: { okr_id: editingOKR.id, title: data.title, type: data.type } });
        toast.success('OKR updated');
        if (prevParentId !== newParentId && currentUser?.id) {
          const targetOkr = okrs.find(o => o.id === editingOKR.id);
          if (targetOkr && targetOkr.ownerId !== currentUser.id) {
            void supabase.from('notifications').insert([{
              user_id: targetOkr.ownerId,
              type: 'okr_aligned_to_updated',
              title: 'OKR Alignment Changed',
              message: `Your OKR "${targetOkr.title}" alignment has been updated${newParentId ? ' to a new parent OKR' : ' (alignment removed)'}.`,
              severity: 'low',
              read: false,
              action_required: false,
              action_data: { okr_id: targetOkr.id, new_aligned_to: newParentId }
            }]);
          }
        }
      } else {
        const created = await createOKR({ ...data, ownerId: userId, owner: currentUser?.name ?? data.owner }, userId);
        if (created?.id) log({ event_type: 'okr_created', action: 'okr_created', resource_id: created.id, metadata: { okr_id: created.id, title: data.title, type: data.type } });
        toast.success('OKR created');
        setShowOKRForm(false);
        setEditingOKR(null);
        if (created?.id) {
          if (data.keyResults && data.keyResults.length > 0) {
            await Promise.allSettled(
              data.keyResults.map((kr) => addKeyResult(created.id, kr, userId))
            );
            toast.success(`OKR created with ${data.keyResults.length} key result${data.keyResults.length !== 1 ? 's' : ''} from template`);
          } else {
            toast('OKR created!', {
              description: 'Would you like to add key results now?',
              action: { label: 'Add Key Results', onClick: () => setAddKROKR(created) },
            });
          }
          return;
        }
      }
      setShowOKRForm(false);
      setEditingOKR(null);
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to save OKR');
    }
  }, [editingOKR, updateOKR, createOKR, userId, currentUser, log]);

  const handleDeleteOKR = useCallback(async (okr: OKR) => {
    setConfirmDeleteOKR(okr);
  }, []);

  const confirmAndDeleteOKR = useCallback(async (okr: OKR) => {
    setConfirmDeleteOKR(null);
    try {
      // Capture snapshot before delete
      const [{ data: okrRow }, { data: krRows }, { data: checkinRows }] = await Promise.all([
        supabase.from('okr').select('*').eq('id', okr.id).single(),
        supabase.from('key_results').select('*').eq('okr_id', okr.id),
        supabase.from('okr_checkins').select('*').eq('okr_id', okr.id),
      ]);
      const snapshot = {
        okr: (okrRow ?? {}) as Record<string, unknown>,
        keyResults: (krRows ?? []) as Record<string, unknown>[],
        checkins: (checkinRows ?? []) as Record<string, unknown>[],
      };
      setUndoStack((prev) => [snapshot, ...prev].slice(0, 5));

      await deleteOKR(okr.id, userId);

      const toastId = toast(t('okr.deleted'), {
        description: t('okr.undoDescription'),
        action: {
          label: t('okr.undo'),
          onClick: async () => {
            try {
              const { id: _id, ...okrWithoutId } = snapshot.okr;
              await supabase.from('okr').insert([{ ...okrWithoutId, id: snapshot.okr.id }]);
              if (snapshot.keyResults.length > 0) {
                await supabase.from('key_results').insert(snapshot.keyResults);
              }
              if (snapshot.checkins.length > 0) {
                await supabase.from('okr_checkins').insert(snapshot.checkins);
              }
              await loadAll(isAdmin || isManager ? undefined : userId);
              toast.success(t('okr.undoSuccess'));
              setUndoStack((prev) => prev.filter((s) => s !== snapshot));
            } catch {
              toast.error(t('okr.undoFailed'));
            }
          },
        },
        duration: 10000,
      });
      // Auto-clear from stack after 10s
      setTimeout(() => {
        setUndoStack((prev) => prev.filter((s) => s !== snapshot));
        toast.dismiss(toastId as string);
      }, 10000);
    } catch (err) {
      toast.error((err as Error).message ?? t('common.error'));
    }
  }, [deleteOKR, userId, loadAll, isAdmin, isManager]);

  const handleCheckIn = useCallback(async (
    okr: OKR,
    note: string,
    krUpdates: { krId: string; currentValue: number }[]
  ) => {
    try {
      await Promise.allSettled([
        checkIn(okr.id, note, userId),
        ...krUpdates.map(({ krId, currentValue }) =>
          updateKRProgress(okr.id, krId, currentValue, note, userId)
        ),
      ]);
      toast.success('Check-in submitted');
      setCheckInOKR(null);
    } catch (err) {
      toast.error((err as Error).message ?? 'Check-in failed');
    }
  }, [checkIn, updateKRProgress, userId]);

  const handleOKR100Celebration = useCallback(async (okr: OKR) => {
    if ((okr.progress ?? 0) < 100) return;
    const { data: existing } = await supabase.from('communications_posts')
      .select('id').eq('metadata->okr_id', okr.id).limit(1);
    if (existing?.length) return;

    void supabase.from('communications_posts').insert([{
      title: `🎉 OKR Achievement: ${okr.title}`,
      content: `Congratulations! The OKR "${okr.title}" has been completed with 100% progress! Great work by the team.`,
      type: 'announcement',
      priority: 'normal',
      status: 'published',
      author_id: currentUser?.id,
      audience: 'all',
      metadata: { okr_id: okr.id, celebration: true }
    }]);

    const ownerId = okr.ownerId ?? (okr as OKR & { owner_id?: string }).owner_id ?? (okr as OKR & { user_id?: string }).user_id;
    if (ownerId) {
      void supabase.from('notifications').insert([{
        user_id: ownerId,
        type: 'okr_completed',
        title: '🎉 OKR Completed!',
        message: `Your OKR "${okr.title}" has reached 100% completion!`,
        severity: 'low',
        read: false,
        action_required: false,
        action_data: { okr_id: okr.id }
      }]);
    }
  }, [currentUser?.id]);

  const handleGradeOKR = useCallback(async (okr: OKR, grade: string, comment: string) => {
    try {
      await updateOKR(okr.id, { grade, grade_comment: comment } as Partial<OKR>, userId);
      // Fire okr_graded notification to OKR owner
      const ownerId = okr.ownerId ?? (okr as OKR & { user_id?: string }).user_id;
      if (ownerId) {
        void supabase.from('notifications').insert([{
          user_id: ownerId,
          type: 'okr_graded',
          title: 'OKR Graded',
          message: `Your OKR "${okr.title}" has been graded ${grade} (score: ${(okr.progress ?? 0).toFixed(0)}%).`,
          app_name: 'OKR Management',
          read: false,
        }]);
      }
      void handleOKR100Celebration(okr);
      toast.success(`OKR graded: ${grade}`);
      setGradingOKR(null);
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to save grade');
    }
  }, [updateOKR, userId, handleOKR100Celebration]);

  // Feature 1: Close All OKRs handler
  const handleCloseAllOKRs = useCallback(async () => {
    if (!selectedCycleId || selectedCycleId === 'all') { toast.error('Select a specific cycle first'); return; }
    const { error } = await supabase.from('okrs').update({ status: 'Closed', closed_at: new Date().toISOString() }).eq('cycle_id', selectedCycleId).neq('status', 'Closed');
    if (error) { toast.error(error.message); return; }
    const { error: closeAllCycleErr } = await supabase.from('okr_cycles').update({ status: 'Closed' }).eq('id', selectedCycleId);
    if (closeAllCycleErr) throw new Error(closeAllCycleErr.message);
    await loadAll(isAdmin || isManager ? undefined : userId);
    toast.success('All OKRs closed for this cycle');
    setShowCloseAllConfirm(false);
  }, [selectedCycleId, isAdmin, isManager, userId, loadAll]);

  const rootOKRs = okrs.filter((o) => !o.parentId && o.type === 'Company').concat(
    okrs.filter((o) => !o.parentId && o.type !== 'Company')
  );

  const selectedCycle = cycles.find(c => c.id === selectedCycleId);

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Target size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">{t('OKR Management')}</h1>
              <p className="text-xs text-muted-foreground">Objectives & Key Results</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Cycle selector */}
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-muted-foreground" />
              <select
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
                className="border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{t('okr.cycle.all')}</option>
                {cycles.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {isAdmin && (
                <button
                  onClick={() => setShowNewCycle(true)}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs border border-border rounded-lg hover:bg-muted text-muted-foreground"
                >
                  <Plus size={12} /> {t('okr.cycle.new')}
                </button>
              )}
            </div>
            <Badge
              label={role}
              cls={isAdmin ? 'bg-purple-100 text-purple-700' : isManager ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}
            />
            {isManager && (
              <button
                onClick={() => setShowCascade((s) => !s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${showCascade ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-border text-muted-foreground hover:bg-muted'}`}
              >
                <GitBranch size={14} />
                <span className="hidden sm:inline">Cascade</span>
              </button>
            )}
            <ReportDefectButton appName="OKR Management" />
            {secCreate && (
              <button
                onClick={() => { setEditingOKR(null); setShowOKRForm(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">New OKR</span>
              </button>
            )}
          </div>
        </div>
        {/* Cycle status badge */}
        {selectedCycle && (
          <div className="max-w-6xl mx-auto mt-2 flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CYCLE_STATUS_COLOR[selectedCycle.status]}`}>{selectedCycle.status}</span>
            <span className="text-xs text-muted-foreground">{selectedCycle.start_date} – {selectedCycle.end_date}</span>
            {selectedCycle.description && <span className="text-xs text-muted-foreground">· {selectedCycle.description}</span>}
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={<Target size={18} className="text-blue-500" />} label="Total OKRs" value={stats.total} color="blue" />
          <StatCard icon={<CheckCircle size={18} className="text-green-500" />} label="On Track" value={stats.onTrack} color="green" />
          <StatCard icon={<AlertTriangle size={18} className="text-orange-500" />} label="At Risk" value={stats.atRisk} color="orange" />
          <StatCard icon={<BarChart2 size={18} className="text-purple-500" />} label="Avg Progress" value={`${Math.round(stats.avgProgress ?? 0)}%`} color="purple" />
        </div>

        {/* View tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit flex-wrap">
          {[
            { key: 'list', icon: <Target size={14} />, label: 'OKRs' },
            { key: 'cycles', icon: <Calendar size={14} />, label: 'Cycles' },
            { key: 'history', icon: <History size={14} />, label: 'History' },
            ...(secReports ? [{ key: 'analytics', icon: <TrendingUp size={14} />, label: t('okr.analytics.tab') }] : []),
            { key: 'timeline', icon: <Columns size={14} />, label: t('okr.timeline.tab') },
            ...(isAdmin ? [{ key: 'eoq', icon: <Award size={14} />, label: t('okr.eoq.tab') }] : []),
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveView(key as typeof activeView)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeView === key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Cascade View */}
        {showCascade && isManager && (
          <DndContext
            onDragStart={(event) => setCascadeActiveDragId(String(event.active.id))}
            onDragEnd={(event: DragEndEvent) => {
              setCascadeActiveDragId(null);
              const { active, over } = event;
              if (!over || active.id === over.id) return;
              const draggedId = String(active.id);
              const newParentId = over.id === 'root' ? null : String(over.id);
              // Anti-circular: prevent dropping onto own descendants
              if (newParentId && isDescendant(okrs, draggedId, newParentId)) {
                toast.error("Cannot move an OKR under one of its own descendants.");
                return;
              }
              void supabase.from('okrs').update({ parent_okr_id: newParentId }).eq('id', draggedId);
              void supabase.from('audit_logs').insert([{
                action: 'okr_reparented',
                entity_type: 'okr',
                entity_id: draggedId,
                changes: JSON.stringify({ parent_okr_id: newParentId }),
              }]);
              loadAll(isAdmin || isManager ? undefined : userId);
              toast.success(newParentId ? "OKR moved to new parent." : "OKR moved to root level.");
            }}
            onDragCancel={() => setCascadeActiveDragId(null)}
          >
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <GitBranch size={16} /> Cascading OKR View
              <span className="ml-auto text-xs font-normal text-muted-foreground">Drag the <GripVertical size={10} className="inline" /> handle to reparent</span>
            </h2>
            <DroppableZone id="root" label="Drop here to move to root level (no parent)" />
            {rootOKRs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No OKRs to display.</p>
            ) : (
              rootOKRs.map((root) => (
                <DraggableCascadeNode key={root.id} okr={root} allOKRs={okrs} activeDragId={cascadeActiveDragId} />
              ))
            )}
          </div>
          <DragOverlay>
            {cascadeActiveDragId ? (() => {
              const draggedOkr = okrs.find((o) => o.id === cascadeActiveDragId);
              return draggedOkr ? (
                <div className="bg-card border border-indigo-300 shadow-lg rounded-lg px-3 py-2 flex items-center gap-2 text-sm font-medium text-foreground opacity-90">
                  <GripVertical size={14} className="text-indigo-400" />
                  {draggedOkr.title}
                </div>
              ) : null;
            })() : null}
          </DragOverlay>
          </DndContext>
        )}

        {/* History View */}
        {activeView === 'history' && <HistoryView okrs={okrs} />}

        {/* Analytics View */}
        {activeView === 'analytics' && <AnalyticsView okrs={okrs} />}

        {/* Timeline View */}
        {activeView === 'timeline' && (
          <TimelineView
            okrs={filtered}
            cycles={cycles}
            onOKRClick={(okr) => {
              setActiveView('list');
              setSearch(okr.title);
            }}
          />
        )}

        {/* Cycles View */}
        {activeView === 'cycles' && (
          <CyclesView
            cycles={cycles}
            okrs={okrs}
            isManager={isManager}
            onManageCycle={(cycle) => setManagingCycle(cycle)}
            onCyclesChanged={async () => {
              const { data } = await supabase.from('okr_cycles').select('*').order('start_date', { ascending: false });
              setCycles(data ?? []);
            }}
          />
        )}

        {/* EOQ / Bulk Grade View */}
        {activeView === 'eoq' && isAdmin && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Award size={16} className="text-amber-500" /> {t('okr.eoq.section')}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => { exportOKRScorecard(filtered); toast.success(t('okr.exportExcelSuccess')); }}
                  disabled={filtered.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {t('okr.exportExcel')}
                </button>
                <button
                  onClick={() => setShowBulkGrade(true)}
                  disabled={filtered.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  <Award size={14} /> {t('okr.eoq.gradeAll')}
                </button>
                {isManager && selectedCycleId !== 'all' && (
                  <button
                    onClick={() => setShowCloseAllConfirm(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Close All OKRs
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{t('okr.eoq.description')}</p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((o) => (
                <div key={o.id} className="border border-border rounded-xl p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{o.title}</p>
                    <p className="text-xs text-muted-foreground">{o.owner}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <p className="text-sm font-semibold">{o.progress ?? 0}%</p>
                    <AutoGradeBadge
                      score={(o.progress ?? 0) / 100}
                      actualGrade={(o as OKR & { grade?: string }).grade ?? undefined}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* List View */}
        {activeView === 'list' && (
          <>
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search OKRs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {(['All', ...OKR_QUARTERS] as string[]).map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuarterFilter(q)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${quarterFilter === q ? 'bg-blue-600 text-white border-blue-600' : 'border-border text-muted-foreground hover:bg-muted'}`}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="All">All Types</option>
                {OKR_TYPES.map((tp) => <option key={tp}>{tp}</option>)}
              </select>
            </div>

            {/* Content */}
            {loading && <InlineLoader />}
            {error && !loading && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}
            {!loading && !error && visibleOkrs.length === 0 && (
              <div className="flex flex-col items-center py-16 text-muted-foreground">
                <Target size={32} className="mb-3 opacity-40" />
                <p className="text-sm">No OKRs found. Create your first objective!</p>
              </div>
            )}
            {!loading && visibleOkrs.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {visibleOkrs.map((okr) => {
                  const isOwner = okr.ownerId === userId || okr.owner === currentUser?.name;
                  const canEdit = isOwner || isManager || isAdmin;
                  const canGrade = isManager && !isOwner;
                  const showDisabledGrade = isManager && isOwner;
                  return (
                    <OKRCard
                      key={okr.id}
                      okr={okr as OKR & { grade?: string; grade_comment?: string }}
                      canEdit={canEdit}
                      canDelete={isAdmin}
                      canGrade={canGrade}
                      showDisabledGrade={showDisabledGrade}
                      onView={() => setViewingOKR(okr)}
                      onEdit={() => {
                        const okrCycleId = (okr as OKR & { cycle_id?: string }).cycle_id;
                        const okrCycle = cycles.find(c => c.id === okrCycleId);
                        if (isAdmin && okrCycle?.status === 'Closed') {
                          setPendingEditOKR(okr);
                          setClosedCycleReason('');
                          setShowClosedReasonModal(true);
                        } else {
                          setEditingOKR(okr);
                          setShowOKRForm(true);
                        }
                      }}
                      onCheckIn={secUpdateProgress ? () => setCheckInOKR(okr) : () => {}}
                      onDelete={() => handleDeleteOKR(okr)}
                      onGrade={() => setGradingOKR(okr)}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {(showOKRForm || editingOKR) && (
        <OKRFormModal
          initial={editingOKR ?? undefined}
          ownerDefault={currentUser?.name ?? ''}
          onSave={handleSaveOKR}
          onClose={() => { setShowOKRForm(false); setEditingOKR(null); }}
          isAdmin={isAdmin}
          isManager={isManager}
          allOkrs={okrs}
          canAlign={secAlign}
        />
      )}

      {addKROKR && (
        <KRFormModal
          okrTitle={addKROKR.title}
          existingKRCount={(addKROKR.keyResults ?? []).length}
          onAdd={(kr) => addKeyResult(addKROKR.id, kr, userId)}
          onClose={() => setAddKROKR(null)}
        />
      )}

      {checkInOKR && (
        <CheckInSlideOver
          okr={checkInOKR}
          userId={userId}
          onClose={() => setCheckInOKR(null)}
          onSuccess={() => loadAll(isAdmin || isManager ? undefined : userId)}
        />
      )}

      {viewingOKR && (
        <OKRDetailModal
          okr={viewingOKR}
          allOKRs={okrs}
          canEdit={
            viewingOKR.ownerId === userId ||
            viewingOKR.owner === currentUser?.name ||
            isManager
          }
          onUpdateKR={(krId, val, note) =>
            updateKRProgress(viewingOKR.id, krId, val, note, userId)
          }
          onCheckIn={secUpdateProgress ? () => { setCheckInOKR(viewingOKR); setViewingOKR(null); } : () => {}}
          onClose={() => setViewingOKR(null)}
        />
      )}

      {gradingOKR && (
        <GradeModal
          okr={gradingOKR as OKR & { grade?: string; grade_comment?: string }}
          onSave={(grade, comment) => handleGradeOKR(gradingOKR, grade, comment)}
          onClose={() => setGradingOKR(null)}
        />
      )}

      {confirmDeleteOKR && (
        <ConfirmDialog
          title="Delete OKR"
          message={`Delete "${confirmDeleteOKR.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => confirmAndDeleteOKR(confirmDeleteOKR)}
          onCancel={() => setConfirmDeleteOKR(null)}
        />
      )}

      {showNewCycle && (
        <CycleModal
          onClose={() => setShowNewCycle(false)}
          onCreated={async () => {
            const { data } = await supabase.from('okr_cycles').select('*').order('start_date', { ascending: false });
            setCycles(data ?? []);
          }}
        />
      )}

      {showBulkGrade && (
        <BulkGradeModal
          okrs={filtered}
          cycleId={selectedCycleId !== 'all' ? selectedCycleId : undefined}
          userId={userId}
          isManager={isManager}
          user={currentUser}
          onClose={() => setShowBulkGrade(false)}
          onDone={() => loadAll(isAdmin || isManager ? undefined : userId)}
        />
      )}

      {showCloseAllConfirm && (
        <ConfirmDialog
          title="Close All OKRs"
          message="Are you sure you want to close all OKRs in this cycle? This will set all active OKRs to Closed status."
          confirmLabel="Close All"
          danger
          onConfirm={handleCloseAllOKRs}
          onCancel={() => setShowCloseAllConfirm(false)}
        />
      )}

      {showClosedReasonModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Override Closed Cycle</h3>
            <p className="text-sm text-gray-600 mb-3">This OKR is in a closed cycle. Provide a reason to override.</p>
            <textarea
              value={closedCycleReason}
              onChange={e => setClosedCycleReason(e.target.value)}
              placeholder="Enter reason for override (min 10 characters)"
              className="w-full border rounded px-3 py-2 text-sm h-24 resize-none"
            />
            <div className="flex gap-2 justify-end mt-3">
              <button
                onClick={() => { setShowClosedReasonModal(false); setPendingEditOKR(null); }}
                className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={closedCycleReason.trim().length < 10}
                onClick={() => { setShowClosedReasonModal(false); setEditingOKR(pendingEditOKR); setShowOKRForm(true); }}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                Override
              </button>
            </div>
          </div>
        </div>
      )}

      {managingCycle && (
        <BulkGradeModal
          okrs={okrs.filter(
            (o) =>
              (o as OKR & { cycle_id?: string }).cycle_id === managingCycle.id ||
              o.year === new Date(managingCycle.start_date).getFullYear()
          )}
          cycleId={managingCycle.id}
          userId={userId}
          isManager={isManager}
          user={currentUser}
          onClose={() => setManagingCycle(null)}
          onDone={() => loadAll(isAdmin || isManager ? undefined : userId)}
        />
      )}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  const bg: Record<string, string> = {
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    orange: 'bg-orange-50',
    purple: 'bg-purple-50',
  };
  return (
    <div className={`${bg[color] ?? 'bg-muted'} rounded-2xl p-4`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

export default OKRManagementEnhanced;
