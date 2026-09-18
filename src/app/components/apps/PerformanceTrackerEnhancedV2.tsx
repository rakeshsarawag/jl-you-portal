import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { InlineLoader } from '../ui/PageLoader';
import { useNavigate } from 'react-router';
import { useUnsavedChanges } from '../../context/UnsavedChangesContext';
import {
  Star, Plus, Edit, Trash2, Eye, CheckCircle2, Clock, Users,
  TrendingUp, AlertTriangle, X, ChevronDown, ChevronRight,
  MessageSquare, Flag, Target, Lock, Send,
} from 'lucide-react';
import ConfirmDialog from '../ui/ConfirmDialog';
import { toast } from 'sonner';
import { useUser } from '../../context/UserContext';
import { useSectionPermission } from '../SectionGuard';
import { API_BASE, publicAnonKey, safeJson, supabase } from '../../utils/constants';
import {
  usePerformanceData,
  type PerformanceReview,
  type Goal,
  type Feedback360,
  type PIP,
} from '../../hooks/usePerformanceData';
import { t } from '../../../i18n/index';
import {
  PERFORMANCE_RATINGS,
  RATING_LABELS,
  REVIEW_PERIODS,
  REVIEW_STATUSES,
  GOAL_STATUSES,
  PIP_STATUSES,
  FEEDBACK_TYPES,
  COMPETENCIES,
} from '../../../constants/apps/performance';
import { SelectOptions } from '../../context/ValueHelpsContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OKR {
  id: string;
  title: string;
  level: 'company' | 'team' | 'individual';
  owner_id?: string;
  cycle_id?: string;
  parent_okr_id?: string;
  progress: number;
  status: 'on_track' | 'at_risk' | 'behind' | 'completed';
  description?: string;
}

interface KeyResult {
  id: string;
  okr_id: string;
  title: string;
  target_value: number;
  current_value: number;
  unit?: string;
  progress: number;
  status: 'on_track' | 'at_risk' | 'behind' | 'completed';
}

interface FeedbackRequest {
  id: string;
  review_id: string;
  reviewee_id: string;
  reviewee_name?: string;
  reviewer_id: string;
  relationship: string;
  is_anonymous: boolean;
  status: 'pending' | 'in_progress' | 'submitted' | 'declined';
  due_date: string;
  submitted_at?: string;
  decline_reason?: string;
}

interface ContinuousFeedback {
  id: string;
  from_employee_id: string;
  to_employee_id: string;
  feedback_text: string;
  feedback_type: string;
  is_anonymous: boolean;
  acknowledged: boolean;
  created_at?: string;
  from_name?: string;
}

interface PIPMilestone {
  title: string;
  due_date: string;
  status: 'pending' | 'met' | 'missed';
}

interface PIPCheckin {
  date: string;
  notes: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StarDisplay({ rating, max = 5, size = 14 }: { rating: number; max?: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={i < Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
        />
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="inline-flex gap-1">
      {PERFORMANCE_RATINGS.map(r => (
        <button
          key={r}
          type="button"
          onMouseEnter={() => setHover(r)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(r)}
        >
          <Star
            size={20}
            className={(hover || value) >= r ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
          />
        </button>
      ))}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-700',
    'In Progress': 'bg-blue-100 text-blue-700',
    Submitted: 'bg-blue-100 text-blue-700',
    Approved: 'bg-green-100 text-green-700',
    Completed: 'bg-green-100 text-green-700',
    Active: 'bg-orange-100 text-orange-700',
    Extended: 'bg-yellow-100 text-yellow-700',
    Closed: 'bg-gray-100 text-gray-600',
    Cancelled: 'bg-red-100 text-red-700',
    'Not Started': 'bg-gray-100 text-gray-600',
    on_track: 'bg-green-100 text-green-700',
    at_risk: 'bg-amber-100 text-amber-700',
    behind: 'bg-red-100 text-red-700',
    completed: 'bg-blue-100 text-blue-700',
    pending: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-blue-100 text-blue-700',
    submitted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
    met: 'bg-green-100 text-green-700',
    missed: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className={`bg-card rounded-xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground"><X size={20} /></button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';
const selectCls = inputCls;

function ProgressBar({ value, color = 'bg-indigo-500' }: { value: number; color?: string }) {
  return (
    <div className="h-2 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { label: string; value: React.ReactNode; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-card rounded-xl border p-4 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

// ── Competency slider ─────────────────────────────────────────────────────────

function CompetencySliders({
  value,
  onChange,
}: {
  value: { name: string; rating: number; comments: string }[];
  onChange: (v: { name: string; rating: number; comments: string }[]) => void;
}) {
  const ensured = COMPETENCIES.map(name => value.find(c => c.name === name) ?? { name, rating: 3, comments: '' });

  return (
    <div className="space-y-3">
      {ensured.map((c, i) => (
        <div key={c.name}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-foreground">{c.name}</span>
            <span className="text-sm font-medium text-indigo-600">{c.rating}/5</span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            value={c.rating}
            onChange={e => {
              const next = [...ensured];
              next[i] = { ...c, rating: Number(e.target.value) };
              onChange(next);
            }}
            className="w-full accent-indigo-500"
          />
        </div>
      ))}
    </div>
  );
}

// ── Rating Trend Chart ────────────────────────────────────────────────────────

function RatingTrendChart({ reviews }: { reviews: PerformanceReview[] }) {
  const data = useMemo(() => {
    return [...reviews]
      .sort((a, b) => new Date(a.reviewDate).getTime() - new Date(b.reviewDate).getTime())
      .map(r => ({
        name: r.reviewPeriod,
        manager_rating: r.overallRating,
        self_rating: (r as any).self_assessment_data?.overall_rating ?? null,
        calibrated_rating: (r as any).calibrated_rating ?? null,
      }));
  }, [reviews]);

  if (data.length < 2) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">{t('Rating Trend')}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number | null) => v != null ? v.toFixed(1) : '—'} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="self_rating" stroke="#6366f1" strokeDasharray="5 5" strokeWidth={2} dot={{ r: 3 }} name="Self" connectNulls />
          <Line type="monotone" dataKey="manager_rating" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Manager" connectNulls />
          <Line type="monotone" dataKey="calibrated_rating" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Calibrated" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── ReviewForm ────────────────────────────────────────────────────────────────

function ReviewForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<PerformanceReview>;
  onSave: (data: Partial<PerformanceReview>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<PerformanceReview>>({
    employeeName: '',
    reviewPeriod: 'Q1',
    reviewDate: new Date().toISOString().slice(0, 10),
    reviewer: '',
    overallRating: 3,
    status: 'Draft',
    strengths: [],
    areasOfImprovement: [],
    competencies: COMPETENCIES.map(name => ({ name, rating: 3, comments: '' })),
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [strengthsText, setStrengthsText] = useState((initial?.strengths ?? []).join('\n'));
  const [areasText, setAreasText] = useState((initial?.areasOfImprovement ?? []).join('\n'));

  const set = (k: keyof PerformanceReview, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.employeeName?.trim()) errs.employeeName = t('validation.review.employee');
    if (!form.reviewer?.trim()) errs.reviewer = t('validation.review.reviewer');
    if (!form.reviewDate?.trim()) errs.reviewDate = t('validation.review.date');
    const rating = form.overallRating ?? 3;
    if (rating < 1 || rating > 5) errs.overallRating = t('validation.review.rating');
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error(t('common.error'));
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...form,
        strengths: strengthsText.split('\n').map(s => s.trim()).filter(Boolean),
        areasOfImprovement: areasText.split('\n').map(s => s.trim()).filter(Boolean),
      });
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('Employee Name')}>
          <input className={inputCls} value={form.employeeName ?? ''} onChange={e => set('employeeName', e.target.value)} />
          {errors.employeeName && <p className="text-xs text-red-500 mt-0.5">{errors.employeeName}</p>}
        </Field>
        <Field label={t('Reviewer')}>
          <input className={inputCls} value={form.reviewer ?? ''} onChange={e => set('reviewer', e.target.value)} />
          {errors.reviewer && <p className="text-xs text-red-500 mt-0.5">{errors.reviewer}</p>}
        </Field>
        <Field label={t('Review Period')}>
          <select className={selectCls} value={form.reviewPeriod ?? 'Q1'} onChange={e => set('reviewPeriod', e.target.value)}>
            <SelectOptions entity="performance" field="review_period" fallback={['Q1','Q2','Q3','Q4','Annual','Mid-Year']} />
          </select>
        </Field>
        <Field label={t('Review Date')}>
          <input type="date" className={inputCls} value={form.reviewDate ?? ''} onChange={e => set('reviewDate', e.target.value)} />
          {errors.reviewDate && <p className="text-xs text-red-500 mt-0.5">{errors.reviewDate}</p>}
        </Field>
        <Field label={t('Status')}>
          <select className={selectCls} value={form.status ?? 'Draft'} onChange={e => set('status', e.target.value as PerformanceReview['status'])}>
            <SelectOptions entity="performance" field="status" fallback={['Pending','In Progress','Completed','Cancelled']} />
          </select>
        </Field>
        <Field label={t('Overall Rating')}>
          <div className="pt-1">
            <StarPicker value={form.overallRating ?? 3} onChange={v => set('overallRating', v)} />
            <p className="text-xs text-muted-foreground mt-1">{RATING_LABELS[form.overallRating ?? 3]}</p>
            {errors.overallRating && <p className="text-xs text-red-500 mt-0.5">{errors.overallRating}</p>}
          </div>
        </Field>
      </div>

      <Field label={t('Competency Ratings')}>
        <CompetencySliders
          value={form.competencies ?? []}
          onChange={v => set('competencies', v)}
        />
      </Field>

      <Field label={t('Strengths (one per line)')}>
        <textarea className={inputCls} rows={3} value={strengthsText} onChange={e => setStrengthsText(e.target.value)} />
      </Field>
      <Field label={t('Areas of Improvement (one per line)')}>
        <textarea className={inputCls} rows={3} value={areasText} onChange={e => setAreasText(e.target.value)} />
      </Field>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border text-sm text-foreground hover:bg-muted">{t('Cancel')}</button>
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
          {saving ? t('Saving...') : t('Save Review')}
        </button>
      </div>
    </form>
  );
}

// ── ReviewDetail (with structured self-assessment) ────────────────────────────

function ReviewDetail({
  review,
  canSelfAssess,
  onSelfAssessment,
  onClose,
  employeeReviews,
}: {
  review: PerformanceReview;
  canSelfAssess: boolean;
  onSelfAssessment: (id: string, text: string) => Promise<void>;
  onClose: () => void;
  employeeReviews?: PerformanceReview[];
}) {
  const navigate = useNavigate();
  const [assessText, setAssessText] = useState(review.selfAssessment ?? '');
  const [saving, setSaving] = useState(false);
  const [savingLock, setSavingLock] = useState(false);

  // Competency-based self-assessment
  const existingData = (review as any).self_assessment_data ?? {};
  const isLocked = !!(review as any).self_assessment_locked;
  const [competencyFramework, setCompetencyFramework] = useState<{ id: string; value: string; description?: string }[]>([]);
  const [competencyRatings, setCompetencyRatings] = useState<Record<string, number>>(existingData.competency_ratings ?? {});
  const [competencyEvidence, setCompetencyEvidence] = useState<Record<string, string>>(existingData.competency_evidence ?? {});
  const [savingSA, setSavingSA] = useState(false);
  const [showStructured, setShowStructured] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const initialAssessText = useRef(review.selfAssessment ?? '');
  const initialRatings = useRef(existingData.competency_ratings ?? {});
  const initialEvidence = useRef(existingData.competency_evidence ?? {});
  const isDirty =
    assessText !== initialAssessText.current ||
    JSON.stringify(competencyRatings) !== JSON.stringify(initialRatings.current) ||
    JSON.stringify(competencyEvidence) !== JSON.stringify(initialEvidence.current);
  useUnsavedChanges(isDirty);

  // Check if review cycle is past end_date
  const reviewCycleExpired = useMemo(() => {
    const endDate = (review as any).cycle_end_date;
    if (!endDate) return false;
    return new Date(endDate) < new Date();
  }, [review]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('master_value_helps')
        .select('*')
        .eq('category', 'competency_frameworks')
        .limit(10);
      if (data && data.length > 0) setCompetencyFramework(data as any);
    };
    void load();
  }, []);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!canSelfAssess || isLocked) return;
    const interval = setInterval(() => {
      const data = { competency_ratings: competencyRatings, competency_evidence: competencyEvidence, overall_rating: existingData.overall_rating };
      void supabase.from('performance_reviews').update({ self_assessment_data: data }).eq('id', review.id).then(() => {
        initialRatings.current = { ...competencyRatings };
        initialEvidence.current = { ...competencyEvidence };
      });
    }, 30000);
    autoSaveRef.current && clearInterval(autoSaveRef.current);
    autoSaveRef.current = interval;
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencyRatings, competencyEvidence, canSelfAssess, isLocked, review.id]);

  const competencyList = competencyFramework.length > 0
    ? competencyFramework.map(c => ({ key: c.id, label: c.value }))
    : COMPETENCIES.map(name => ({ key: name, label: name }));

  const period = review.reviewPeriod;
  const quarter = period.startsWith('Q') ? period : null;

  const handleAssessSubmit = async () => {
    setSaving(true);
    try {
      await onSelfAssessment(review.id, assessText);
      initialAssessText.current = assessText;
      toast.success(t('Self-assessment saved'));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStructuredSA = async () => {
    // Validate evidence min 50 chars
    for (const { key } of competencyList) {
      if ((competencyEvidence[key] ?? '').trim().length > 0 && (competencyEvidence[key] ?? '').trim().length < 50) {
        toast.error(`Evidence for "${key}" must be at least 50 characters`);
        return;
      }
    }
    setSavingSA(true);
    try {
      const data = { competency_ratings: competencyRatings, competency_evidence: competencyEvidence, overall_rating: existingData.overall_rating };
      void supabase.from('performance_reviews').update({ self_assessment_data: data }).eq('id', review.id);
      initialRatings.current = { ...competencyRatings };
      initialEvidence.current = { ...competencyEvidence };
      toast.success(t('Structured self-assessment saved'));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingSA(false);
    }
  };

  const handleLockSA = async () => {
    setSavingLock(true);
    try {
      void supabase.from('performance_reviews').update({ self_assessment_locked: true }).eq('id', review.id);
      toast.success(t('Self-assessment locked'));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingLock(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div><span className="text-muted-foreground">{t('Employee')}: </span><strong>{review.employeeName}</strong></div>
        <div><span className="text-muted-foreground">{t('Reviewer')}: </span><strong>{review.reviewer}</strong></div>
        <div><span className="text-muted-foreground">{t('Period')}: </span><strong>{review.reviewPeriod}</strong></div>
        <div><span className="text-muted-foreground">{t('Date')}: </span><strong>{review.reviewDate}</strong></div>
        <div><span className="text-muted-foreground">{t('Status')}: </span><StatusBadge status={review.status} /></div>
        <div className="flex items-center gap-1"><span className="text-muted-foreground">{t('Rating')}: </span><StarDisplay rating={review.overallRating} /></div>
      </div>

      {quarter && (
        <div className="bg-indigo-50 rounded-lg px-4 py-2 text-sm text-indigo-700">
          {t('Review linked to')} {quarter} {t('OKR period')}
        </div>
      )}

      {(review.competencies ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">{t('Competency Ratings')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {review.competencies.map(c => (
              <div key={c.name} className="flex items-center justify-between bg-muted rounded-lg px-3 py-2">
                <span className="text-sm text-foreground">{c.name}</span>
                <StarDisplay rating={c.rating} size={13} />
              </div>
            ))}
          </div>
          {/* A14: Skill gap → Training suggestion */}
          {review.competencies.filter(c => c.rating <= 2).length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800 mb-1">Skill gaps detected</p>
                <p className="text-xs text-amber-700 mb-2">
                  Low ratings in: <strong>{review.competencies.filter(c => c.rating <= 2).map(c => c.name).join(', ')}</strong>
                </p>
                <button
                  onClick={() => navigate('/training')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
                >
                  Browse training courses to address these gaps →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {(review.strengths ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">{t('Strengths')}</h3>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
            {review.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {(review.areasOfImprovement ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">{t('Areas of Improvement')}</h3>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
            {review.areasOfImprovement.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      {(review.goals ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">{t('Goals')}</h3>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
            {review.goals.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </div>
      )}

      {/* Structured Self-Assessment */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">{t('Self-Assessment')}</h3>
          <div className="flex items-center gap-2">
            {isLocked && <span className="flex items-center gap-1 text-xs text-amber-600"><Lock size={12} /> {t('Locked')}</span>}
            <button
              type="button"
              onClick={() => setShowStructured(v => !v)}
              className="text-xs text-indigo-600 hover:underline"
            >
              {showStructured ? t('Simple view') : t('Structured view')}
            </button>
          </div>
        </div>

        {showStructured ? (
          <div className="space-y-4">
            {reviewCycleExpired && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2 text-xs">
                The review cycle deadline has passed. You may still save but the cycle is closed.
              </div>
            )}
            {competencyList.map(({ key, label }) => (
              <div key={key} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  <span className="inline-flex gap-1">
                    {[1,2,3,4,5].map(star => (
                      <button
                        key={star}
                        type="button"
                        disabled={isLocked}
                        onClick={() => setCompetencyRatings(r => ({ ...r, [key]: star }))}
                      >
                        <Star
                          size={18}
                          className={(competencyRatings[key] ?? 0) >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
                        />
                      </button>
                    ))}
                  </span>
                </div>
                <textarea
                  className={inputCls}
                  rows={2}
                  placeholder="Provide evidence (min 50 chars)..."
                  disabled={isLocked}
                  value={competencyEvidence[key] ?? ''}
                  onChange={e => setCompetencyEvidence(v => ({ ...v, [key]: e.target.value }))}
                />
                {(competencyEvidence[key] ?? '').length > 0 && (competencyEvidence[key] ?? '').length < 50 && (
                  <p className="text-xs text-red-500">{50 - (competencyEvidence[key] ?? '').length} more chars needed</p>
                )}
              </div>
            ))}
            {!isLocked && canSelfAssess && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveStructuredSA}
                  disabled={savingSA}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingSA ? t('Saving...') : t('Save Self-Assessment')}
                </button>
                <button
                  type="button"
                  onClick={handleLockSA}
                  disabled={savingLock}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm hover:bg-amber-600 disabled:opacity-50"
                >
                  <Lock size={14} /> {savingLock ? t('Locking...') : t('Lock Self-Assessment')}
                </button>
              </div>
            )}
          </div>
        ) : (
          canSelfAssess && review.status === 'Draft' && !isLocked ? (
            <div className="space-y-2">
              <textarea
                className={inputCls}
                rows={4}
                value={assessText}
                onChange={e => setAssessText(e.target.value)}
                placeholder={t('Write your self-assessment here...')}
              />
              <button
                onClick={handleAssessSubmit}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? t('Saving...') : t('Save Self-Assessment')}
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground bg-muted rounded-lg px-3 py-2 min-h-[60px]">
              {review.selfAssessment || <span className="italic text-muted-foreground">{t('No self-assessment provided.')}</span>}
            </p>
          )
        )}
      </div>

      {/* Rating Trend */}
      {employeeReviews && employeeReviews.length >= 2 && (
        <RatingTrendChart reviews={employeeReviews} />
      )}

      <div className="flex justify-end">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm text-foreground hover:bg-muted">{t('Close')}</button>
      </div>
    </div>
  );
}

// ── GoalForm ──────────────────────────────────────────────────────────────────

function GoalForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<Goal>;
  onSave: (data: Partial<Goal>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<Goal>>({
    title: '',
    description: '',
    targetDate: '',
    status: 'Not Started',
    progress: 0,
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof Goal, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.title?.trim()) errs.title = t('validation.goal.title');
    if (!form.targetDate?.trim()) errs.targetDate = t('validation.goal.targetDate');
    else if (new Date(form.targetDate) < new Date(new Date().toDateString())) errs.targetDate = t('validation.goal.targetDate.future');
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error(t('common.error'));
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label={t('Title')}>
        <input className={inputCls} value={form.title ?? ''} onChange={e => set('title', e.target.value)} />
        {errors.title && <p className="text-xs text-red-500 mt-0.5">{errors.title}</p>}
      </Field>
      <Field label={t('Description')}>
        <textarea className={inputCls} rows={3} value={form.description ?? ''} onChange={e => set('description', e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('Target Date')}>
          <input type="date" className={inputCls} value={form.targetDate ?? ''} onChange={e => set('targetDate', e.target.value)} />
          {errors.targetDate && <p className="text-xs text-red-500 mt-0.5">{errors.targetDate}</p>}
        </Field>
        <Field label={t('Status')}>
          <select className={selectCls} value={form.status ?? 'Not Started'} onChange={e => set('status', e.target.value as Goal['status'])}>
            <SelectOptions entity="performance" field="goal_status" fallback={['Not Started','In Progress','Completed','Cancelled']} />
          </select>
        </Field>
      </div>
      <Field label={`${t('Progress')}: ${form.progress ?? 0}%`}>
        <input
          type="range"
          min={0}
          max={100}
          value={form.progress ?? 0}
          onChange={e => set('progress', Number(e.target.value))}
          className="w-full accent-indigo-500"
        />
      </Field>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border text-sm text-foreground hover:bg-muted">{t('Cancel')}</button>
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
          {saving ? t('Saving...') : t('Save Goal')}
        </button>
      </div>
    </form>
  );
}

// ── FeedbackForm ──────────────────────────────────────────────────────────────

function FeedbackForm({
  onSave,
  onClose,
}: {
  onSave: (data: Partial<Feedback360>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<Feedback360>>({
    feedbackType: 'Peer',
    reviewer: '',
    comments: '',
    ratings: { leadership: 3, communication: 3, teamwork: 3, innovation: 3, technical: 3 },
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof Feedback360, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const setRating = (k: keyof Feedback360['ratings'], v: number) =>
    setForm(f => ({ ...f, ratings: { ...(f.ratings as Feedback360['ratings']), [k]: v } }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.reviewer?.trim()) errs.reviewer = t('validation.feedback.employee');
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error(t('common.error'));
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...form, date: new Date().toISOString() });
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const ratingKeys: (keyof Feedback360['ratings'])[] = ['leadership', 'communication', 'teamwork', 'innovation', 'technical'];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('Feedback Type')}>
          <select className={selectCls} value={form.feedbackType ?? 'Peer'} onChange={e => set('feedbackType', e.target.value as Feedback360['feedbackType'])}>
            <SelectOptions entity="performance" field="feedback_type" fallback={['Positive','Constructive','Peer','Manager']} />
          </select>
        </Field>
        <Field label={t('Reviewer Name')}>
          <input className={inputCls} value={form.reviewer ?? ''} onChange={e => set('reviewer', e.target.value)} />
          {errors.reviewer && <p className="text-xs text-red-500 mt-0.5">{errors.reviewer}</p>}
        </Field>
      </div>
      <Field label={t('Ratings (1-5)')}>
        <div className="space-y-2 bg-muted rounded-lg p-3">
          {ratingKeys.map(k => (
            <div key={k} className="flex items-center gap-3">
              <span className="text-sm text-foreground w-28 capitalize">{k}</span>
              <input
                type="range"
                min={1}
                max={5}
                value={(form.ratings as Feedback360['ratings'])[k]}
                onChange={e => setRating(k, Number(e.target.value))}
                className="flex-1 accent-indigo-500"
              />
              <span className="text-sm font-medium w-4">{(form.ratings as Feedback360['ratings'])[k]}</span>
            </div>
          ))}
        </div>
      </Field>
      <Field label={t('Comments')}>
        <textarea className={inputCls} rows={3} value={form.comments ?? ''} onChange={e => set('comments', e.target.value)} />
      </Field>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border text-sm text-foreground hover:bg-muted">{t('Cancel')}</button>
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
          {saving ? t('Saving...') : t('Submit Feedback')}
        </button>
      </div>
    </form>
  );
}

// ── PIPForm ───────────────────────────────────────────────────────────────────

function PIPForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<PIP>;
  onSave: (data: Partial<PIP>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<PIP>>({
    employeeName: '',
    manager: '',
    reason: '',
    startDate: '',
    endDate: '',
    goals: '',
    reviewFrequency: 'Weekly',
    status: 'Active',
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof PIP, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate)) errs.endDate = t('validation.pip.dateRange');
    if (!form.goals?.trim()) errs.goals = t('validation.pip.objectives');
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error(t('common.error'));
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={t('Employee Name')}>
          <input className={inputCls} value={form.employeeName ?? ''} onChange={e => set('employeeName', e.target.value)} required />
        </Field>
        <Field label={t('Manager')}>
          <input className={inputCls} value={form.manager ?? ''} onChange={e => set('manager', e.target.value)} required />
        </Field>
        <Field label={t('Start Date')}>
          <input type="date" className={inputCls} value={form.startDate ?? ''} onChange={e => set('startDate', e.target.value)} required />
        </Field>
        <Field label={t('End Date')}>
          <input type="date" className={inputCls} value={form.endDate ?? ''} onChange={e => set('endDate', e.target.value)} />
          {errors.endDate && <p className="text-xs text-red-500 mt-0.5">{errors.endDate}</p>}
        </Field>
        <Field label={t('Review Frequency')}>
          <select className={selectCls} value={form.reviewFrequency ?? 'Weekly'} onChange={e => set('reviewFrequency', e.target.value as PIP['reviewFrequency'])}>
            <SelectOptions entity="performance" field="pip_review_frequency" fallback={['Weekly','Biweekly','Monthly']} />
          </select>
        </Field>
        <Field label={t('Status')}>
          <select className={selectCls} value={form.status ?? 'Active'} onChange={e => set('status', e.target.value as PIP['status'])}>
            {PIP_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label={t('Reason')}>
        <textarea className={inputCls} rows={2} value={form.reason ?? ''} onChange={e => set('reason', e.target.value)} />
      </Field>
      <Field label={t('Goals / Improvement Areas')}>
        <textarea className={inputCls} rows={4} value={form.goals ?? ''} onChange={e => set('goals', e.target.value)} />
        {errors.goals && <p className="text-xs text-red-500 mt-0.5">{errors.goals}</p>}
      </Field>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border text-sm text-foreground hover:bg-muted">{t('Cancel')}</button>
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
          {saving ? t('Saving...') : t('Save PIP')}
        </button>
      </div>
    </form>
  );
}

// ── PIPDetailPanel (milestones + check-ins + escalation + outcome) ────────────

function PIPDetailPanel({ pip, isManager, isHR, isAdmin, onUpdate }: {
  pip: PIP;
  isManager: boolean;
  isHR: boolean;
  isAdmin: boolean;
  onUpdate: (id: string, data: Partial<PIP>) => Promise<void>;
}) {
  const rawPip = pip as any;
  const milestones: PIPMilestone[] = rawPip.milestones ?? [];
  const checkins: PIPCheckin[] = rawPip.weekly_checkins ?? [];
  const [localMilestones, setLocalMilestones] = useState<PIPMilestone[]>(milestones);
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({ title: '', description: '', due_date: '' });
  const [savingMilestone, setSavingMilestone] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinForm, setCheckinForm] = useState({ date: new Date().toISOString().slice(0, 10), notes: '' });
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [savingEscalate, setSavingEscalate] = useState(false);
  const [outcome, setOutcome] = useState<string>(rawPip.outcome ?? '');
  const [savingOutcome, setSavingOutcome] = useState(false);

  const milestoneStatusColor = (s: string) => s === 'met' ? 'bg-green-500' : s === 'missed' ? 'bg-red-500' : 'bg-gray-300';

  const handleAddMilestone = async () => {
    if (!milestoneForm.title.trim() || !milestoneForm.due_date) { toast.error(t('Title and due date required')); return; }
    setSavingMilestone(true);
    try {
      const newM: PIPMilestone = { title: milestoneForm.title, due_date: milestoneForm.due_date, status: 'pending' };
      const updated = [...localMilestones, newM];
      void supabase.from('performance_pips').update({ milestones: updated }).eq('id', pip.id);
      setLocalMilestones(updated);
      setMilestoneForm({ title: '', description: '', due_date: '' });
      setAddMilestoneOpen(false);
      toast.success(t('Milestone added'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSavingMilestone(false);
    }
  };

  const handleMilestoneStatus = async (idx: number, status: 'met' | 'missed') => {
    const updated = localMilestones.map((m, i) => i === idx ? { ...m, status } : m);
    void supabase.from('performance_pips').update({ milestones: updated }).eq('id', pip.id);
    setLocalMilestones(updated);
    toast.success(status === 'met' ? t('performance.markMet') : t('performance.markMissed'));
  };

  const handleAddCheckin = async () => {
    if (!checkinForm.notes.trim()) { toast.error(t('Notes required')); return; }
    setSavingCheckin(true);
    try {
      const updated = [...checkins, { date: checkinForm.date, notes: checkinForm.notes }];
      void supabase.from('performance_pips').update({ weekly_checkins: updated }).eq('id', pip.id);
      toast.success(t('Check-in added'));
      setCheckinOpen(false);
      setCheckinForm({ date: new Date().toISOString().slice(0, 10), notes: '' });
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSavingCheckin(false);
    }
  };

  const handleEscalate = async () => {
    setSavingEscalate(true);
    try {
      void supabase.from('performance_pips').update({ escalated: true }).eq('id', pip.id);
      toast.success(t('PIP escalated to HR'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSavingEscalate(false);
    }
  };

  const handleSaveOutcome = async () => {
    if (!outcome) return;
    setSavingOutcome(true);
    try {
      void supabase.from('performance_pips').update({ outcome, closed_at: new Date().toISOString() }).eq('id', pip.id);
      await onUpdate(pip.id, { status: 'Closed' });
      toast.success(t('Outcome recorded'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSavingOutcome(false);
    }
  };

  return (
    <div className="space-y-5 mt-3 border-t pt-3">
      {/* Milestones */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">{t('Milestones')}</h4>
          {(isManager || isHR || isAdmin) && (
            <button onClick={() => setAddMilestoneOpen(v => !v)} className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
              <Plus size={12} /> {t('performance.addMilestone')}
            </button>
          )}
        </div>
        {addMilestoneOpen && (
          <div className="bg-muted rounded-lg p-3 space-y-2 mb-3">
            <Field label={t('Title')}>
              <input className={inputCls} value={milestoneForm.title} onChange={e => setMilestoneForm(f => ({ ...f, title: e.target.value }))} />
            </Field>
            <Field label={t('Due Date')}>
              <input type="date" className={inputCls} value={milestoneForm.due_date} onChange={e => setMilestoneForm(f => ({ ...f, due_date: e.target.value }))} />
            </Field>
            <div className="flex gap-2">
              <button onClick={handleAddMilestone} disabled={savingMilestone} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700 disabled:opacity-50">
                {savingMilestone ? t('Saving...') : t('Add')}
              </button>
              <button onClick={() => setAddMilestoneOpen(false)} className="px-3 py-1.5 rounded-lg border text-xs text-foreground hover:bg-muted">{t('Cancel')}</button>
            </div>
          </div>
        )}
        {localMilestones.length > 0 ? (
          <div className="relative pl-4">
            <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-border" />
            <div className="space-y-3">
              {localMilestones.map((m, i) => (
                <div key={i} className="relative flex items-start gap-3">
                  <div className={`absolute -left-3 mt-1 w-3 h-3 rounded-full border-2 border-card ${milestoneStatusColor(m.status)}`} />
                  <div className="pl-2 flex-1">
                    <p className="text-sm font-medium text-foreground">{m.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{m.due_date}</span>
                      <StatusBadge status={m.status} />
                      {m.status === 'pending' && (isManager || isHR || isAdmin) && (
                        <>
                          <button onClick={() => void handleMilestoneStatus(i, 'met')} className="text-xs text-green-600 hover:underline font-medium">{t('performance.markMet')}</button>
                          <button onClick={() => void handleMilestoneStatus(i, 'missed')} className="text-xs text-red-500 hover:underline font-medium">{t('performance.markMissed')}</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">{t('No milestones defined')}</p>
        )}
      </div>

      {/* Check-ins */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">{t('Weekly Check-ins')}</h4>
          {(isManager || isHR || isAdmin) && (
            <button onClick={() => setCheckinOpen(v => !v)} className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
              <Plus size={12} /> {t('Add Check-in')}
            </button>
          )}
        </div>
        {checkinOpen && (
          <div className="bg-muted rounded-lg p-3 space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label={t('Date')}>
                <input type="date" className={inputCls} value={checkinForm.date} onChange={e => setCheckinForm(f => ({ ...f, date: e.target.value }))} />
              </Field>
            </div>
            <Field label={t('Notes')}>
              <textarea className={inputCls} rows={2} value={checkinForm.notes} onChange={e => setCheckinForm(f => ({ ...f, notes: e.target.value }))} />
            </Field>
            <div className="flex gap-2">
              <button onClick={handleAddCheckin} disabled={savingCheckin} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700 disabled:opacity-50">
                {savingCheckin ? t('Saving...') : t('Save Check-in')}
              </button>
              <button onClick={() => setCheckinOpen(false)} className="px-3 py-1.5 rounded-lg border text-xs text-foreground hover:bg-muted">
                {t('Cancel')}
              </button>
            </div>
          </div>
        )}
        {checkins.length > 0 ? (
          <div className="space-y-2">
            {[...checkins].reverse().map((c, i) => (
              <div key={i} className="bg-muted rounded-lg px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">{c.date}</p>
                <p className="text-sm text-foreground mt-0.5">{c.notes}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">{t('No check-ins recorded')}</p>
        )}
      </div>

      {/* Escalation + Outcome */}
      {(isManager || isHR || isAdmin) && pip.status === 'Active' && (
        <div className="flex flex-wrap gap-3 items-end">
          {!rawPip.escalated && isManager && (
            <button
              onClick={handleEscalate}
              disabled={savingEscalate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 border border-amber-200"
            >
              <Flag size={13} /> {savingEscalate ? t('Escalating...') : t('Escalate to HR')}
            </button>
          )}
          {rawPip.escalated && <span className="text-xs text-amber-600 font-medium flex items-center gap-1"><Flag size={12} /> {t('Escalated')}</span>}

          <div className="flex items-center gap-2">
            <select
              className={`${selectCls} w-auto`}
              value={outcome}
              onChange={e => setOutcome(e.target.value)}
            >
              <option value="">{t('Set outcome...')}</option>
              {['completed','extended','terminated','resigned'].map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
            </select>
            {outcome && (
              <button
                onClick={handleSaveOutcome}
                disabled={savingOutcome}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingOutcome ? t('Saving...') : t('Record Outcome')}
              </button>
            )}
          </div>
        </div>
      )}
      {rawPip.outcome && (
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">{t('Outcome')}: </span>{rawPip.outcome}
          {rawPip.closed_at && <span className="ml-2 text-xs">({rawPip.closed_at.slice(0, 10)})</span>}
        </div>
      )}
    </div>
  );
}

// ── Review Cycle types ────────────────────────────────────────────────────────

interface ReviewCycle {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  status: 'Draft' | 'Active' | 'Closed';
  employee_count?: number;
  created_at?: string;
}

// ── CyclesPanel ───────────────────────────────────────────────────────────────

function CyclesPanel({ cycles, loading, onCreate, onActivate, onClose: onCloseCycle, onDelete, onFinalize }: {
  cycles: ReviewCycle[];
  loading: boolean;
  onCreate: (data: Partial<ReviewCycle>) => Promise<void>;
  onActivate: (id: string) => Promise<void>;
  onClose: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onFinalize: (cycle: ReviewCycle) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', period_start: '', period_end: '' });
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('validation.cycle.name');
    if (form.period_start && form.period_end && new Date(form.period_end) <= new Date(form.period_start)) errs.period_end = t('validation.cycle.dateRange');
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      toast.error(t('common.error'));
      return;
    }
    setSaving(true);
    try {
      await onCreate({ ...form, status: 'Draft' });
      setForm({ name: '', period_start: '', period_end: '' });
      setFormErrors({});
      setCreateOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <InlineLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Review Cycles</h2>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
        >
          <Plus size={15} /> Create Cycle
        </button>
      </div>

      {cycles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No review cycles yet. Create one to get started.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cycles.map(cycle => (
            <div key={cycle.id} className="border rounded-xl p-5 bg-card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground">{cycle.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {cycle.period_start} {cycle.period_end ? `→ ${cycle.period_end}` : ''}
                  </p>
                  {cycle.employee_count !== undefined && (
                    <p className="text-xs text-muted-foreground mt-0.5">{cycle.employee_count} employee reviews</p>
                  )}
                </div>
                <StatusBadge status={cycle.status} />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {cycle.status === 'Draft' && (
                  <>
                    <button
                      onClick={() => onActivate(cycle.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100"
                    >
                      <CheckCircle2 size={13} /> Activate
                    </button>
                    <button
                      onClick={() => onDelete(cycle.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </>
                )}
                {cycle.status === 'Active' && (
                  <>
                    <button
                      onClick={() => onCloseCycle(cycle.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-gray-200"
                    >
                      <X size={13} /> Close Cycle
                    </button>
                    <button
                      onClick={() => onFinalize(cycle)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 border border-green-200"
                    >
                      <Lock size={13} /> Finalize Cycle
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <Modal title="Create Review Cycle" onClose={() => setCreateOpen(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <Field label="Cycle Name">
              <input
                className={inputCls}
                placeholder="e.g. Q3 2026 Review"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
              {formErrors.name && <p className="text-xs text-red-500 mt-0.5">{formErrors.name}</p>}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Period Start">
                <input
                  type="date"
                  className={inputCls}
                  value={form.period_start}
                  onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Period End">
                <input
                  type="date"
                  className={inputCls}
                  value={form.period_end}
                  onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))}
                />
                {formErrors.period_end && <p className="text-xs text-red-500 mt-0.5">{formErrors.period_end}</p>}
              </Field>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-lg border text-sm text-foreground hover:bg-muted">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Cycle'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── OKRs Panel ────────────────────────────────────────────────────────────────

function OKRsPanel({ canCreate, currentUserId }: { canCreate: boolean; currentUserId?: string }) {
  const [okrs, setOkrs] = useState<OKR[]>([]);
  const [keyResults, setKeyResults] = useState<Record<string, KeyResult[]>>({});
  const [cycles, setCycles] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOkr, setExpandedOkr] = useState<string | null>(null);
  const [addOkrOpen, setAddOkrOpen] = useState(false);
  const [addKrOkrId, setAddKrOkrId] = useState<string | null>(null);
  const [updateKrId, setUpdateKrId] = useState<string | null>(null);
  const [newCurrentValue, setNewCurrentValue] = useState('');
  const [saving, setSaving] = useState(false);

  const [okrForm, setOkrForm] = useState({ title: '', level: 'individual' as OKR['level'], cycle_id: '', description: '' });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [okrRes, cycleRes] = await Promise.all([
          supabase.from('performance_okrs').select('*').order('created_at', { ascending: false }),
          supabase.from('performance_cycles').select('id, name').eq('status', 'Active'),
        ]);
        setOkrs((okrRes.data as OKR[]) ?? []);
        setCycles((cycleRes.data as { id: string; name: string }[]) ?? []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const loadKeyResults = async (okrId: string) => {
    if (keyResults[okrId]) return;
    const { data } = await supabase.from('performance_key_results').select('*').eq('okr_id', okrId);
    setKeyResults(prev => ({ ...prev, [okrId]: (data as KeyResult[]) ?? [] }));
  };

  const handleToggleOkr = (id: string) => {
    if (expandedOkr === id) {
      setExpandedOkr(null);
    } else {
      setExpandedOkr(id);
      void loadKeyResults(id);
    }
  };

  const handleAddOkr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!okrForm.title.trim()) { toast.error(t('Title required')); return; }
    setSaving(true);
    try {
      const row = { title: okrForm.title, level: okrForm.level, cycle_id: okrForm.cycle_id || null, description: okrForm.description, progress: 0, status: 'on_track', owner_id: currentUserId };
      const { data, error } = await supabase.from('performance_okrs').insert([row]).select().single();
      if (error) throw error;
      setOkrs(prev => [data as OKR, ...prev]);
      setOkrForm({ title: '', level: 'individual', cycle_id: '', description: '' });
      setAddOkrOpen(false);
      toast.success(t('OKR created'));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddKr = async (e: React.FormEvent, okrId: string, krTitle: string, target: string, unit: string) => {
    e.preventDefault();
    if (!krTitle.trim()) { toast.error(t('Title required')); return; }
    setSaving(true);
    try {
      const row = { okr_id: okrId, title: krTitle, target_value: Number(target) || 100, current_value: 0, unit, progress: 0, status: 'on_track' };
      const { data, error } = await supabase.from('performance_key_results').insert([row]).select().single();
      if (error) throw error;
      setKeyResults(prev => ({ ...prev, [okrId]: [...(prev[okrId] ?? []), data as KeyResult] }));
      setAddKrOkrId(null);
      toast.success(t('Key result added'));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProgress = async (kr: KeyResult) => {
    const val = Number(newCurrentValue);
    if (isNaN(val)) { toast.error(t('Invalid value')); return; }
    const progress = kr.target_value > 0 ? Math.round((val / kr.target_value) * 100) : 0;
    setSaving(true);
    try {
      const { error } = await supabase.from('performance_key_results').update({ current_value: val, progress }).eq('id', kr.id);
      if (error) throw error;
      setKeyResults(prev => ({
        ...prev,
        [kr.okr_id]: (prev[kr.okr_id] ?? []).map(k => k.id === kr.id ? { ...k, current_value: val, progress } : k),
      }));
      setUpdateKrId(null);
      setNewCurrentValue('');
      toast.success(t('Progress updated'));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const okrStatusColor = (s: string) => ({ on_track: 'bg-green-500', at_risk: 'bg-amber-500', behind: 'bg-red-500', completed: 'bg-blue-500' }[s] ?? 'bg-gray-400');

  const grouped = useMemo(() => ({
    company: okrs.filter(o => o.level === 'company'),
    team: okrs.filter(o => o.level === 'team'),
    individual: okrs.filter(o => o.level === 'individual' && o.owner_id === currentUserId),
  }), [okrs, currentUserId]);

  if (loading) return <InlineLoader />;

  const renderOkrColumn = (title: string, list: OKR[], icon: React.ReactNode) => (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">({list.length})</span>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{t('No OKRs')}</p>
      ) : (
        <div className="space-y-2">
          {list.map(okr => (
            <div key={okr.id} className="border rounded-xl bg-card">
              <button
                type="button"
                className="w-full text-left p-3 flex items-start gap-2"
                onClick={() => handleToggleOkr(okr.id)}
              >
                <span className="mt-0.5 text-muted-foreground">
                  {expandedOkr === okr.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{okr.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={okr.status} />
                    <span className="text-xs text-muted-foreground">{okr.progress}%</span>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar value={okr.progress} color={okrStatusColor(okr.status)} />
                  </div>
                </div>
              </button>

              {expandedOkr === okr.id && (
                <div className="px-3 pb-3 border-t pt-2 space-y-2">
                  {okr.description && <p className="text-xs text-muted-foreground">{okr.description}</p>}
                  <p className="text-xs font-semibold text-foreground uppercase">{t('Key Results')}</p>
                  {(keyResults[okr.id] ?? []).map(kr => (
                    <div key={kr.id} className="bg-muted rounded-lg p-2 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-foreground">{kr.title}</p>
                        <StatusBadge status={kr.status} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{kr.current_value} / {kr.target_value}{kr.unit ? ` ${kr.unit}` : ''}</span>
                        <span>({kr.progress}%)</span>
                      </div>
                      <ProgressBar value={kr.progress} color={okrStatusColor(kr.status)} />
                      {updateKrId === kr.id ? (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            className={inputCls}
                            type="number"
                            placeholder={t('Current value')}
                            value={newCurrentValue}
                            onChange={e => setNewCurrentValue(e.target.value)}
                          />
                          <button onClick={() => void handleUpdateProgress(kr)} disabled={saving} className="px-2 py-1 rounded bg-indigo-600 text-white text-xs">
                            {saving ? '...' : t('Save')}
                          </button>
                          <button onClick={() => setUpdateKrId(null)} className="px-2 py-1 rounded border text-xs">{t('Cancel')}</button>
                        </div>
                      ) : (
                        <button onClick={() => { setUpdateKrId(kr.id); setNewCurrentValue(String(kr.current_value)); }} className="text-xs text-indigo-600 hover:underline">
                          {t('Update Progress')}
                        </button>
                      )}
                    </div>
                  ))}

                  {canCreate && (
                    addKrOkrId === okr.id ? (
                      <KRInlineForm okrId={okr.id} onAdd={handleAddKr} onCancel={() => setAddKrOkrId(null)} saving={saving} />
                    ) : (
                      <button onClick={() => setAddKrOkrId(okr.id)} className="flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-1">
                        <Plus size={12} /> {t('Add Key Result')}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{t('OKRs')}</h2>
        {canCreate && (
          <button onClick={() => setAddOkrOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">
            <Plus size={15} /> {t('Add OKR')}
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {renderOkrColumn(t('Company OKRs'), grouped.company, <Target size={14} className="text-blue-500" />)}
        {renderOkrColumn(t('Team OKRs'), grouped.team, <Users size={14} className="text-purple-500" />)}
        {renderOkrColumn(t('My OKRs'), grouped.individual, <Star size={14} className="text-indigo-500" />)}
      </div>

      {addOkrOpen && (
        <Modal title={t('Add OKR')} onClose={() => setAddOkrOpen(false)}>
          <form onSubmit={handleAddOkr} className="space-y-4">
            <Field label={t('Title')}>
              <input className={inputCls} value={okrForm.title} onChange={e => setOkrForm(f => ({ ...f, title: e.target.value }))} required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('Level')}>
                <select className={selectCls} value={okrForm.level} onChange={e => setOkrForm(f => ({ ...f, level: e.target.value as OKR['level'] }))}>
                  <option value="company">{t('Company')}</option>
                  <option value="team">{t('Team')}</option>
                  <option value="individual">{t('Individual')}</option>
                </select>
              </Field>
              <Field label={t('Cycle')}>
                <select className={selectCls} value={okrForm.cycle_id} onChange={e => setOkrForm(f => ({ ...f, cycle_id: e.target.value }))}>
                  <option value="">{t('None')}</option>
                  {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label={t('Description')}>
              <textarea className={inputCls} rows={2} value={okrForm.description} onChange={e => setOkrForm(f => ({ ...f, description: e.target.value }))} />
            </Field>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setAddOkrOpen(false)} className="px-4 py-2 rounded-lg border text-sm text-foreground hover:bg-muted">{t('Cancel')}</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
                {saving ? t('Saving...') : t('Create OKR')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function KRInlineForm({ okrId, onAdd, onCancel, saving }: {
  okrId: string;
  onAdd: (e: React.FormEvent, okrId: string, title: string, target: string, unit: string) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('100');
  const [unit, setUnit] = useState('');

  return (
    <form onSubmit={e => void onAdd(e, okrId, title, target, unit)} className="bg-indigo-50 rounded-lg p-2 space-y-2">
      <input className={inputCls} placeholder={t('Key result title')} value={title} onChange={e => setTitle(e.target.value)} required />
      <div className="grid grid-cols-2 gap-2">
        <input className={inputCls} type="number" placeholder={t('Target value')} value={target} onChange={e => setTarget(e.target.value)} />
        <input className={inputCls} placeholder={t('Unit (%, tasks...)')} value={unit} onChange={e => setUnit(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700 disabled:opacity-50">
          {saving ? '...' : t('Add')}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1 rounded-lg border text-xs text-foreground hover:bg-muted">{t('Cancel')}</button>
      </div>
    </form>
  );
}

// ── My Feedback Queue Panel ───────────────────────────────────────────────────

function FeedbackQueuePanel({ currentUserId, canCreate }: { currentUserId?: string; canCreate?: boolean }) {
  const [requests, setRequests] = useState<FeedbackRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [feedbackForm, setFeedbackForm] = useState({
    strengths: '',
    improvements: '',
    competency_ratings: {} as Record<string, number>,
  });
  const [saving, setSaving] = useState(false);

  // Request 360 feedback state
  const [show360Form, setShow360Form] = useState(false);
  const [req360Form, setReq360Form] = useState({
    reviewee_id: '',
    reviewer_ids: '',
    due_date: '',
    relationship: 'peer',
    is_anonymous: false,
  });
  const [saving360, setSaving360] = useState(false);
  const minDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, []);

  const handleSubmit360 = async (e: React.FormEvent) => {
    e.preventDefault();
    const reviewerList = req360Form.reviewer_ids.split(',').map(s => s.trim()).filter(Boolean);
    if (reviewerList.length < 3 || reviewerList.length > 5) { toast.error('Select between 3 and 5 peer reviewers (comma-separated IDs)'); return; }
    if (!req360Form.reviewee_id.trim()) { toast.error('Reviewee required'); return; }
    if (!req360Form.due_date || req360Form.due_date < minDueDate) { toast.error('Due date must be at least 7 days from today'); return; }
    setSaving360(true);
    try {
      const rows = reviewerList.map(reviewer_id => ({
        reviewee_id: req360Form.reviewee_id,
        reviewer_id,
        relationship: req360Form.relationship,
        is_anonymous: req360Form.is_anonymous,
        due_date: req360Form.due_date,
        status: 'pending',
        review_id: '',
      }));
      void supabase.from('performance_feedback_requests').insert(rows);
      toast.success(t('performance.request360') + ' sent');
      setShow360Form(false);
      setReq360Form({ reviewee_id: '', reviewer_ids: '', due_date: '', relationship: 'peer', is_anonymous: false });
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving360(false);
    }
  };

  useEffect(() => {
    if (!currentUserId) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('performance_feedback_requests')
          .select('*')
          .eq('reviewer_id', currentUserId)
          .in('status', ['pending', 'in_progress']);
        setRequests((data as FeedbackRequest[]) ?? []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [currentUserId]);

  const isOverdue = (req: FeedbackRequest) => new Date(req.due_date) < new Date();

  const handleSubmitFeedback = async (req: FeedbackRequest) => {
    setSaving(true);
    try {
      void supabase.from('performance_feedback_requests').update({ status: 'submitted', submitted_at: new Date().toISOString() }).eq('id', req.id);
      void supabase.from('performance_feedback').insert([{
        review_id: req.review_id,
        employee_id: req.reviewee_id,
        reviewer: req.is_anonymous ? 'Anonymous' : currentUserId,
        feedback_type: req.relationship,
        comments: `Strengths: ${feedbackForm.strengths}\n\nAreas for improvement: ${feedbackForm.improvements}`,
        ratings: feedbackForm.competency_ratings,
        date: new Date().toISOString(),
      }]);
      setRequests(prev => prev.filter(r => r.id !== req.id));
      setSubmittingId(null);
      setFeedbackForm({ strengths: '', improvements: '', competency_ratings: {} });
      toast.success(t('Feedback submitted'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDecline = async (req: FeedbackRequest) => {
    setSaving(true);
    try {
      void supabase.from('performance_feedback_requests').update({ status: 'declined', decline_reason: declineReason }).eq('id', req.id);
      setRequests(prev => prev.filter(r => r.id !== req.id));
      setDecliningId(null);
      setDeclineReason('');
      toast.success(t('Feedback request declined'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <InlineLoader />;

  return (
    <div className="space-y-6">
      {/* Request 360 Feedback (manager/HR only) */}
      {canCreate && (
        <div className="border rounded-xl p-4 bg-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">{t('performance.request360')}</h3>
            <button onClick={() => setShow360Form(v => !v)} className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
              <Plus size={12} /> {show360Form ? t('Cancel') : t('New Request')}
            </button>
          </div>
          {show360Form && (
            <form onSubmit={handleSubmit360} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Reviewee Employee ID">
                  <input className={inputCls} value={req360Form.reviewee_id} onChange={e => setReq360Form(f => ({ ...f, reviewee_id: e.target.value }))} required placeholder="Employee ID..." />
                </Field>
                <Field label="Relationship">
                  <select className={selectCls} value={req360Form.relationship} onChange={e => setReq360Form(f => ({ ...f, relationship: e.target.value }))}>
                    <option value="peer">Peer</option>
                    <option value="direct_report">Direct Report</option>
                    <option value="stakeholder">Stakeholder</option>
                  </select>
                </Field>
                <Field label="Peer Reviewer IDs (3-5, comma-separated)">
                  <input className={inputCls} value={req360Form.reviewer_ids} onChange={e => setReq360Form(f => ({ ...f, reviewer_ids: e.target.value }))} required placeholder="id1, id2, id3..." />
                </Field>
                <Field label={`Due Date (min ${minDueDate})`}>
                  <input type="date" className={inputCls} min={minDueDate} value={req360Form.due_date} onChange={e => setReq360Form(f => ({ ...f, due_date: e.target.value }))} required />
                </Field>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={req360Form.is_anonymous} onChange={e => setReq360Form(f => ({ ...f, is_anonymous: e.target.checked }))} className="rounded" />
                <span className="text-sm text-foreground">Anonymous feedback</span>
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={saving360} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
                  {saving360 ? t('Saving...') : 'Send Requests'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <h2 className="text-sm font-semibold text-foreground">{t('My Feedback Queue')}</h2>

      {requests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 size={32} className="mx-auto mb-2 text-green-400" />
          <p>{t('All caught up! No pending feedback requests.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const overdue = isOverdue(req);
            return (
              <div key={req.id} className={`border rounded-xl p-4 bg-card ${overdue ? 'border-red-300' : ''}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {req.reviewee_name ?? req.reviewee_id}
                      </p>
                      <StatusBadge status={req.status} />
                      {req.is_anonymous && (
                        <span className="text-xs text-muted-foreground italic">{t('Anonymous')}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('Relationship')}: {req.relationship}
                    </p>
                    <p className={`text-xs mt-0.5 ${overdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                      {t('Due')}: {req.due_date} {overdue && `(${t('Overdue')})`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSubmittingId(req.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700"
                    >
                      <Send size={12} /> {t('Submit Feedback')}
                    </button>
                    <button
                      onClick={() => setDecliningId(req.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-300 text-red-600 text-xs hover:bg-red-50"
                    >
                      <X size={12} /> {t('Decline')}
                    </button>
                  </div>
                </div>

                {/* Submit feedback form */}
                {submittingId === req.id && (
                  <div className="mt-4 border-t pt-4 space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">{t('Feedback for')} {req.reviewee_name ?? req.reviewee_id}</h4>
                    {req.is_anonymous && (
                      <div className="bg-amber-50 text-amber-700 rounded-lg px-3 py-2 text-xs">
                        {t('Your identity will not be disclosed.')}
                      </div>
                    )}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground uppercase">{t('Competency Ratings')}</p>
                      {COMPETENCIES.map(comp => (
                        <div key={comp} className="flex items-center gap-3">
                          <span className="text-sm text-foreground w-36 truncate">{comp}</span>
                          <input
                            type="range"
                            min={1}
                            max={5}
                            value={feedbackForm.competency_ratings[comp] ?? 3}
                            onChange={e => setFeedbackForm(f => ({ ...f, competency_ratings: { ...f.competency_ratings, [comp]: Number(e.target.value) } }))}
                            className="flex-1 accent-indigo-500"
                          />
                          <span className="text-sm font-medium w-4">{feedbackForm.competency_ratings[comp] ?? 3}</span>
                        </div>
                      ))}
                    </div>
                    <Field label={t('Strengths')}>
                      <textarea className={inputCls} rows={2} value={feedbackForm.strengths} onChange={e => setFeedbackForm(f => ({ ...f, strengths: e.target.value }))} placeholder={t('What does this person do well?')} />
                    </Field>
                    <Field label={t('Areas for Improvement')}>
                      <textarea className={inputCls} rows={2} value={feedbackForm.improvements} onChange={e => setFeedbackForm(f => ({ ...f, improvements: e.target.value }))} placeholder={t('Where can they grow?')} />
                    </Field>
                    <div className="flex gap-2">
                      <button onClick={() => void handleSubmitFeedback(req)} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
                        {saving ? t('Submitting...') : t('Submit')}
                      </button>
                      <button onClick={() => setSubmittingId(null)} className="px-4 py-2 rounded-lg border text-sm text-foreground hover:bg-muted">{t('Cancel')}</button>
                    </div>
                  </div>
                )}

                {/* Decline form */}
                {decliningId === req.id && (
                  <div className="mt-4 border-t pt-4 space-y-2">
                    <Field label={t('Reason for declining')}>
                      <textarea className={inputCls} rows={2} value={declineReason} onChange={e => setDeclineReason(e.target.value)} placeholder={t('Please provide a reason...')} />
                    </Field>
                    <div className="flex gap-2">
                      <button onClick={() => void handleDecline(req)} disabled={saving} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs hover:bg-red-700 disabled:opacity-50">
                        {saving ? t('Declining...') : t('Confirm Decline')}
                      </button>
                      <button onClick={() => setDecliningId(null)} className="px-3 py-1.5 rounded-lg border text-xs text-foreground hover:bg-muted">{t('Cancel')}</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Continuous Feedback Widget ────────────────────────────────────────────────

function ContinuousFeedbackWidget({ currentUserId }: { currentUserId?: string }) {
  const [open, setOpen] = useState(false);
  const [receivedOpen, setReceivedOpen] = useState(false);
  const [received, setReceived] = useState<ContinuousFeedback[]>([]);
  const [loadingReceived, setLoadingReceived] = useState(false);
  const [form, setForm] = useState({
    to_employee_id: '',
    situation: '',
    behavior: '',
    impact: '',
    feedback_type: 'positive',
    is_anonymous: false,
  });
  const [saving, setSaving] = useState(false);
  const isSelfFeedback = !!currentUserId && form.to_employee_id.trim() === currentUserId;

  const loadReceived = useCallback(async () => {
    if (!currentUserId) return;
    setLoadingReceived(true);
    try {
      const { data } = await supabase
        .from('performance_continuous_feedback')
        .select('*')
        .eq('to_employee_id', currentUserId)
        .order('created_at', { ascending: false });
      setReceived((data as ContinuousFeedback[]) ?? []);
    } catch {
      // silent
    } finally {
      setLoadingReceived(false);
    }
  }, [currentUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSelfFeedback) { toast.error(t('performance.selfFeedbackBlocked')); return; }
    if (!form.situation.trim() || !form.behavior.trim() || !form.impact.trim()) { toast.error(t('All SBI fields required')); return; }
    if (form.situation.trim().length < 20) { toast.error('Situation must be at least 20 characters'); return; }
    if (form.behavior.trim().length < 20) { toast.error('Behavior must be at least 20 characters'); return; }
    if (form.impact.trim().length < 20) { toast.error('Impact must be at least 20 characters'); return; }
    setSaving(true);
    const feedback_text = `Situation: ${form.situation}\n\nBehavior: ${form.behavior}\n\nImpact: ${form.impact}`;
    try {
      void supabase.from('performance_continuous_feedback').insert([{
        from_employee_id: form.is_anonymous ? null : currentUserId,
        to_employee_id: form.to_employee_id,
        feedback_text,
        feedback_type: form.feedback_type,
        is_anonymous: form.is_anonymous,
        acknowledged: false,
      }]);
      toast.success(t('Feedback sent'));
      setForm({ to_employee_id: '', situation: '', behavior: '', impact: '', feedback_type: 'positive', is_anonymous: false });
      setOpen(false);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleAcknowledge = (id: string) => {
    void supabase.from('performance_continuous_feedback').update({ acknowledged: true }).eq('id', id);
    setReceived(prev => prev.map(f => f.id === id ? { ...f, acknowledged: true } : f));
  };

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        <button
          onClick={() => { setReceivedOpen(v => !v); if (!receivedOpen) void loadReceived(); }}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border shadow-md text-sm text-foreground hover:bg-muted"
        >
          <MessageSquare size={16} className="text-indigo-500" /> {t('My Feedback')}
        </button>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600 text-white shadow-md text-sm hover:bg-indigo-700"
        >
          <MessageSquare size={16} /> {t('Give Feedback')}
        </button>
      </div>

      {/* Give Feedback popover */}
      {open && (
        <Modal title={t('Give Feedback')} onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label={t('To Employee (ID or name)')}>
              <input className={inputCls} value={form.to_employee_id} onChange={e => setForm(f => ({ ...f, to_employee_id: e.target.value }))} required />
              {isSelfFeedback && (
                <p className="text-xs text-red-500 mt-0.5">{t('performance.selfFeedbackBlocked')}</p>
              )}
            </Field>
            <Field label={t('Feedback Type')}>
              <select className={selectCls} value={form.feedback_type} onChange={e => setForm(f => ({ ...f, feedback_type: e.target.value }))}>
                <option value="positive">{t('Positive')}</option>
                <option value="constructive">{t('Constructive')}</option>
                <option value="recognition">{t('Recognition')}</option>
              </select>
            </Field>
            <div className="bg-indigo-50 rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">SBI Model</p>
              <Field label={t('performance.situationLabel') + ' (min 20 chars)'}>
                <textarea
                  className={inputCls}
                  rows={2}
                  value={form.situation}
                  onChange={e => setForm(f => ({ ...f, situation: e.target.value }))}
                  placeholder="Describe the situation..."
                  required
                />
              </Field>
              <Field label={t('performance.behaviorLabel') + ' (min 20 chars)'}>
                <textarea
                  className={inputCls}
                  rows={2}
                  value={form.behavior}
                  onChange={e => setForm(f => ({ ...f, behavior: e.target.value }))}
                  placeholder="What specific behavior did you observe..."
                  required
                />
              </Field>
              <Field label={t('performance.impactLabel') + ' (min 20 chars)'}>
                <textarea
                  className={inputCls}
                  rows={2}
                  value={form.impact}
                  onChange={e => setForm(f => ({ ...f, impact: e.target.value }))}
                  placeholder="What was the impact..."
                  required
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_anonymous}
                onChange={e => setForm(f => ({ ...f, is_anonymous: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm text-foreground">{t('Submit anonymously')}</span>
            </label>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border text-sm text-foreground hover:bg-muted">{t('Cancel')}</button>
              <button type="submit" disabled={saving || isSelfFeedback} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50" title={isSelfFeedback ? t('performance.selfFeedbackBlocked') : undefined}>
                {saving ? t('Sending...') : t('Send Feedback')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Feedback I've received panel */}
      {receivedOpen && (
        <Modal title={t("Feedback I've Received")} onClose={() => setReceivedOpen(false)}>
          {loadingReceived ? (
            <div className="text-center py-8 text-muted-foreground">{t('Loading...')}</div>
          ) : received.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{t('No feedback received yet.')}</div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {received.map(f => (
                <div key={f.id} className={`border rounded-lg p-3 ${f.acknowledged ? 'opacity-60' : 'border-indigo-200 bg-indigo-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium capitalize bg-muted px-2 py-0.5 rounded-full">{f.feedback_type}</span>
                        <span className="text-xs text-muted-foreground">
                          {f.is_anonymous ? t('Anonymous') : (f.from_name ?? f.from_employee_id)}
                        </span>
                        {f.created_at && <span className="text-xs text-muted-foreground">{f.created_at.slice(0, 10)}</span>}
                      </div>
                      <p className="text-sm text-foreground">{f.feedback_text}</p>
                    </div>
                    {!f.acknowledged && (
                      <button
                        onClick={() => handleAcknowledge(f.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-50 text-green-700 hover:bg-green-100 shrink-0"
                      >
                        <CheckCircle2 size={12} /> {t('Acknowledge')}
                      </button>
                    )}
                    {f.acknowledged && <span className="text-xs text-green-600 shrink-0">{t('Acknowledged')}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

// ── Calibration section (HR/Admin only, rendered inside Analytics tab) ─────────

const CALIBRATION_RATINGS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

function CalibrationSection({ reviews, userId }: { reviews: PerformanceReview[]; userId: string | undefined }) {
  const [calibrations, setCalibrations] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<'employeeName' | 'overallRating'>('overallRating');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    return [...reviews].sort((a, b) => {
      const va = sortField === 'employeeName' ? a.employeeName : a.overallRating;
      const vb = sortField === 'employeeName' ? b.employeeName : b.overallRating;
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [reviews, sortField, sortDir]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const handleSaveCalibration = async () => {
    const entries = Object.entries(calibrations);
    if (entries.length === 0) { toast.info('No calibrations to save.'); return; }
    setSaving(true);
    try {
      await Promise.all(entries.map(([id, rating]) =>
        fetch(`${API_BASE}/performance/reviews/${id}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ calibrated_rating: rating, calibrated_by: userId, calibrated_at: new Date().toISOString() }),
        })
      ));
      toast.success('Calibration saved successfully.');
    } catch {
      toast.error('Failed to save calibration.');
    } finally {
      setSaving(false);
    }
  };

  if (reviews.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Calibration Session</h3>
        <button
          onClick={handleSaveCalibration}
          disabled={saving || Object.keys(calibrations).length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save Calibration'}
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th
                className="text-left px-4 py-2 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground"
                onClick={() => toggleSort('employeeName')}
              >
                Employee {sortField === 'employeeName' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th
                className="text-center px-4 py-2 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground"
                onClick={() => toggleSort('overallRating')}
              >
                Original Rating {sortField === 'overallRating' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="text-center px-4 py-2 font-medium text-muted-foreground">Calibrated Rating</th>
              <th className="text-center px-4 py-2 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map(r => {
              const calibrated = calibrations[r.id];
              const isCalibratedRecord = !!(r as any).calibrated_rating;
              return (
                <tr key={r.id} className="hover:bg-muted">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {r.employeeName}
                    {isCalibratedRecord && (
                      <span className="ml-2 text-xs text-indigo-600 font-normal">Calibrated</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                      r.overallRating >= 4 ? 'bg-green-100 text-green-700' :
                      r.overallRating >= 3 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {r.overallRating.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="relative inline-block">
                      <select
                        value={calibrated ?? ''}
                        onChange={e => {
                          const v = e.target.value;
                          setCalibrations(prev => {
                            const next = { ...prev };
                            if (v === '') { delete next[r.id]; return next; }
                            next[r.id] = Number(v);
                            return next;
                          });
                        }}
                        className="appearance-none pl-2 pr-6 py-1 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-card"
                      >
                        <option value="">adjust</option>
                        {CALIBRATION_RATINGS.map(v => (
                          <option key={v} value={v}>{v.toFixed(1)}</option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {calibrated !== undefined ? (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        calibrated >= 4 ? 'bg-green-100 text-green-700' :
                        calibrated >= 3 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>{calibrated.toFixed(1)}</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Analytics Panel ───────────────────────────────────────────────────────────

function AnalyticsPanel({ reviews }: { reviews: PerformanceReview[] }) {
  const buckets = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      const b = Math.min(5, Math.max(1, Math.round(r.overallRating)));
      counts[b] = (counts[b] || 0) + 1;
    }
    const total = reviews.length || 1;
    return [1, 2, 3, 4, 5].map(b => ({
      label: String(b),
      count: counts[b],
      pct: Math.round((counts[b] / total) * 100),
    }));
  }, [reviews]);

  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  const barColor = (label: string) => {
    const n = Number(label);
    if (n <= 2) return 'bg-red-400';
    if (n === 3) return 'bg-amber-400';
    return 'bg-green-500';
  };

  const deptRows = useMemo(() => {
    const map = new Map<string, PerformanceReview[]>();
    for (const r of reviews) {
      const dept = (r as any).department || r.reviewer || 'Unknown';
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(r);
    }
    return [...map.entries()]
      .map(([dept, list]) => {
        const avg = list.reduce((s, r) => s + r.overallRating, 0) / list.length;
        const sorted = [...list].sort((a, b) => b.overallRating - a.overallRating);
        return {
          dept,
          avg: Math.round(avg * 10) / 10,
          count: list.length,
          top: sorted[0]?.employeeName ?? '—',
          atRisk: sorted[sorted.length - 1]?.employeeName ?? '—',
        };
      })
      .sort((a, b) => b.avg - a.avg);
  }, [reviews]);

  const completionStats = useMemo(() => {
    const total = reviews.length;
    const submitted = reviews.filter(r => r.status === 'Submitted' || r.status === 'Approved' || r.status === 'Completed').length;
    const approved = reviews.filter(r => r.status === 'Approved').length;
    const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
    return { total, submitted, approved, pct };
  }, [reviews]);

  if (reviews.length === 0) {
    return <div className="text-center py-16 text-muted-foreground">No reviews available to analyze.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Rating Distribution</h3>
        <div className="flex items-end gap-4 h-40">
          {buckets.map(b => (
            <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-muted-foreground">{b.count}</span>
              <div className="w-full flex items-end justify-center" style={{ height: '96px' }}>
                <div
                  className={`w-full rounded-t-lg transition-all ${barColor(b.label)}`}
                  style={{ height: `${Math.max(4, (b.count / maxCount) * 96)}px` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">⭐ {b.label}</span>
              <span className="text-xs text-muted-foreground">{b.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Department Performance</h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Dept / Group</th>
                <th className="text-center px-4 py-2 font-medium text-muted-foreground">Avg Rating</th>
                <th className="text-center px-4 py-2 font-medium text-muted-foreground">Reviews</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Top Performer</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">At Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {deptRows.map(row => (
                <tr key={row.dept} className="hover:bg-muted">
                  <td className="px-4 py-3 font-medium text-foreground">{row.dept}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                      row.avg >= 4 ? 'bg-green-100 text-green-700' :
                      row.avg >= 3 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {row.avg.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{row.count}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{row.top}</td>
                  <td className="px-4 py-3 text-red-500 hidden sm:table-cell">{row.atRisk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Review Completion Rate</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Submitted / Total</span>
            <span className="font-medium text-foreground">{completionStats.submitted} / {completionStats.total} ({completionStats.pct}%)</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${completionStats.pct}%` }}
            />
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Draft: {completionStats.total - completionStats.submitted}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" /> Submitted/Completed: {completionStats.submitted - completionStats.approved}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Approved: {completionStats.approved}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard Panel ───────────────────────────────────────────────────────────

function DashboardPanel({ currentUserId, goals }: { currentUserId?: string; goals: Goal[] }) {
  const [reviewStatus, setReviewStatus] = useState<string>('Not Started');
  const [okrData, setOkrData] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 });
  const [feedbackQueue, setFeedbackQueue] = useState<FeedbackRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUserId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [reviewRes, okrRes, feedbackRes] = await Promise.all([
          supabase.from('performance_reviews').select('status').eq('employee_id', currentUserId).order('created_at', { ascending: false }).limit(1),
          supabase.from('performance_okrs').select('status').eq('owner_id', currentUserId),
          supabase.from('performance_feedback_requests').select('*').eq('reviewer_id', currentUserId).in('status', ['pending', 'in_progress']).order('due_date', { ascending: true }).limit(3),
        ]);
        if (reviewRes.data && reviewRes.data.length > 0) {
          const s = (reviewRes.data[0] as any).status ?? 'Not Started';
          setReviewStatus(s);
        }
        const okrs = (okrRes.data as any[]) ?? [];
        setOkrData({ completed: okrs.filter(o => o.status === 'completed').length, total: okrs.length });
        setFeedbackQueue((feedbackRes.data as FeedbackRequest[]) ?? []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [currentUserId]);

  const myGoals = goals.filter(g => g.employeeId === currentUserId);
  const completedGoals = myGoals.filter(g => g.status === 'Completed').length;
  const totalGoals = myGoals.length;

  const okrPct = okrData.total > 0 ? Math.round((okrData.completed / okrData.total) * 100) : 0;
  const goalPct = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

  const donutColors = ['#6366f1', '#e5e7eb'];

  if (loading) return <InlineLoader />;

  const reviewStatusColor: Record<string, string> = {
    'Not Started': 'bg-gray-100 text-gray-600',
    'Draft': 'bg-blue-100 text-blue-700',
    'Submitted': 'bg-indigo-100 text-indigo-700',
    'Calibrated': 'bg-green-100 text-green-700',
    'Approved': 'bg-green-100 text-green-700',
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* My Review Status */}
        <div className="border rounded-xl p-5 bg-card space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">{t('performance.myReviewStatus')}</p>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${reviewStatusColor[reviewStatus] ?? 'bg-gray-100 text-gray-700'}`}>
            {reviewStatus}
          </span>
          <p className="text-xs text-muted-foreground">Latest review cycle status</p>
        </div>

        {/* OKR Progress donut */}
        <div className="border rounded-xl p-5 bg-card space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase">{t('performance.okrProgress')}</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={90} height={90}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Completed', value: okrData.completed || (okrData.total === 0 ? 0 : 0) },
                    { name: 'Remaining', value: Math.max(0, okrData.total - okrData.completed) || (okrData.total === 0 ? 1 : 0) },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={40}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  strokeWidth={0}
                >
                  <Cell fill={donutColors[0]} />
                  <Cell fill={donutColors[1]} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div>
              <p className="text-2xl font-bold text-foreground">{okrPct}%</p>
              <p className="text-xs text-muted-foreground">{okrData.completed}/{okrData.total} OKRs completed</p>
            </div>
          </div>
        </div>

        {/* Feedback Queue */}
        <div className="border rounded-xl p-5 bg-card space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">{t('performance.feedbackQueue')}</p>
          <p className="text-2xl font-bold text-foreground">{feedbackQueue.length}</p>
          <p className="text-xs text-muted-foreground">pending requests</p>
          {feedbackQueue.length > 0 && (
            <div className="space-y-1 mt-2">
              {feedbackQueue.slice(0, 3).map(req => (
                <div key={req.id} className="flex items-center justify-between text-xs">
                  <span className="text-foreground truncate max-w-[140px]">{req.reviewee_name ?? req.reviewee_id}</span>
                  <span className={`text-muted-foreground ${new Date(req.due_date) < new Date() ? 'text-red-500' : ''}`}>{req.due_date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Goals donut */}
        <div className="border rounded-xl p-5 bg-card space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase">{t('performance.myGoals')}</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={90} height={90}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Completed', value: completedGoals },
                    { name: 'Remaining', value: Math.max(0, totalGoals - completedGoals) || (totalGoals === 0 ? 1 : 0) },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={40}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  strokeWidth={0}
                >
                  <Cell fill="#22c55e" />
                  <Cell fill={donutColors[1]} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div>
              <p className="text-2xl font-bold text-foreground">{goalPct}%</p>
              <p className="text-xs text-muted-foreground">{completedGoals}/{totalGoals} goals completed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PerformanceTrackerEnhancedV2({
  accessToken: _accessToken,
  onLogout,
}: {
  accessToken: string;
  onLogout: () => void;
}) {
  const { currentUser } = useUser();
  const role = currentUser?.primaryRole ?? 'employee';
  const isEmployee = role === 'employee';
  const isManager = role === 'manager';
  const isHR = role === 'hr';
  const isAdmin = role === 'admin';
  const canCreate = isManager || isHR || isAdmin;
  const canApprove = isHR || isAdmin;
  const canDelete = isAdmin;
  const permConductReviews = useSectionPermission('performance', 'conduct_reviews');
  const permGoals = useSectionPermission('performance', 'goals');
  const permTeamPerformance = useSectionPermission('performance', 'team_performance');
  const permReports = useSectionPermission('performance', 'reports');

  const {
    reviews, goals, feedback, pips,
    loading, error,
    loadAll, refresh,
    createReview, updateReview, deleteReview, approveReview, submitSelfAssessment,
    createGoal, updateGoal, deleteGoal,
    addFeedback,
    createPIP, updatePIP,
  } = usePerformanceData();

  type TabKey = 'dashboard' | 'reviews' | 'goals' | 'feedback' | 'pips' | 'analytics' | 'cycles' | 'okrs' | 'feedbackQueue';
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [periodFilter, setPeriodFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedPipId, setExpandedPipId] = useState<string | null>(null);

  // Modal state
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<PerformanceReview | undefined>();
  const [viewingReview, setViewingReview] = useState<PerformanceReview | undefined>();
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();
  const [feedbackFormOpen, setFeedbackFormOpen] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState('');
  const [pipFormOpen, setPipFormOpen] = useState(false);
  const [editingPIP, setEditingPIP] = useState<PIP | undefined>();
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; danger?: boolean; action: () => void } | null>(null);
  const [finalizingCycle, setFinalizingCycle] = useState<ReviewCycle | null>(null);

  // Cycles state
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [cyclesLoading, setCyclesLoading] = useState(false);

  useEffect(() => {
    if (!canApprove) return;
    setCyclesLoading(true);
    fetch(`${API_BASE}/performance/cycles`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
    })
      .then(r => safeJson(r))
      .then(j => { if (j?.success) setCycles(j?.data ?? []); })
      .catch(() => setCycles([]))
      .finally(() => setCyclesLoading(false));
  }, [canApprove]);

  const handleCreateCycle = async (data: Partial<ReviewCycle>) => {
    const res = await fetch(`${API_BASE}/performance/cycles`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const j = await safeJson(res);
    if (!j?.success) throw new Error(j?.error || 'Failed to create cycle');
    setCycles(prev => [j.data, ...prev]);
    toast.success('Review cycle created');
  };

  const handleActivateCycle = async (id: string) => {
    const res = await fetch(`${API_BASE}/performance/cycles/${id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Active' }),
    });
    const j = await safeJson(res);
    if (!j?.success) { toast.error(j?.error || 'Failed to activate cycle'); return; }
    setCycles(prev => prev.map(c => c.id === id ? { ...c, status: 'Active' } : c));
    toast.success('Review cycle activated');
  };

  const handleCloseCycle = async (id: string) => {
    const res = await fetch(`${API_BASE}/performance/cycles/${id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Closed' }),
    });
    const j = await safeJson(res);
    if (!j?.success) { toast.error(j?.error || 'Failed to close cycle'); return; }
    setCycles(prev => prev.map(c => c.id === id ? { ...c, status: 'Closed' } : c));
    toast.success('Review cycle closed');
  };

  const handleDeleteCycle = (id: string) => {
    setConfirmState({
      title: 'Delete Cycle',
      message: 'Delete this draft cycle? This cannot be undone.',
      danger: true,
      action: async () => {
        setConfirmState(null);
        const res = await fetch(`${API_BASE}/performance/cycles/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        });
        const j = await safeJson(res);
        if (!j?.success) { toast.error(j?.error || 'Failed to delete cycle'); return; }
        setCycles(prev => prev.filter(c => c.id !== id));
        toast.success('Cycle deleted');
      },
    });
  };

  const handleFinalizeCycle = async (cycle: ReviewCycle) => {
    // Update all reviews in the cycle to finalized
    void supabase
      .from('performance_reviews')
      .update({ status: 'finalized', finalized_at: new Date().toISOString() })
      .eq('cycle_id', cycle.id);
    setCycles(prev => prev.map(c => c.id === cycle.id ? { ...c, status: 'Closed' } : c));
    setFinalizingCycle(null);
    toast.success(`Cycle "${cycle.name}" finalized`);
  };

  useEffect(() => {
    if (isEmployee) {
      loadAll(currentUser?.id);
    } else {
      loadAll();
    }
  }, [loadAll, isEmployee, currentUser?.id]);

  // Data isolation
  const visibleReviews = useMemo(() => {
    let list = reviews;
    if (isEmployee) list = list.filter(r => r.employeeId === currentUser?.id);
    if (periodFilter) list = list.filter(r => r.reviewPeriod === periodFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.employeeName.toLowerCase().includes(q) ||
        r.reviewer.toLowerCase().includes(q)
      );
    }
    return list;
  }, [reviews, isEmployee, currentUser?.id, periodFilter, search]);

  const visibleGoals = useMemo(() => {
    if (isEmployee) return goals.filter(g => g.employeeId === currentUser?.id);
    return goals;
  }, [goals, isEmployee, currentUser?.id]);

  const visibleFeedback = useMemo(() => {
    if (isEmployee) return feedback.filter(f => f.employeeId === currentUser?.id);
    return feedback;
  }, [feedback, isEmployee, currentUser?.id]);

  const visiblePIPs = useMemo(() => {
    if (isEmployee) return pips.filter(p => p.employeeId === currentUser?.id);
    return pips;
  }, [pips, isEmployee, currentUser?.id]);

  // Stats
  const totalReviews = visibleReviews.length;
  const pendingReviews = visibleReviews.filter(r => r.status === 'Draft' || r.status === 'Submitted').length;
  const avgRating = visibleReviews.length
    ? visibleReviews.reduce((s, r) => s + r.overallRating, 0) / visibleReviews.length
    : 0;
  const activePIPs = visiblePIPs.filter(p => p.status === 'Active').length;

  // Handlers
  const handleSaveReview = async (data: Partial<PerformanceReview>) => {
    if (editingReview) {
      await updateReview(editingReview.id, data);
      toast.success(t('Review updated'));
    } else {
      await createReview(data);
      toast.success(t('Review created'));
    }
    setEditingReview(undefined);
    setReviewFormOpen(false);
  };

  const handleApprove = (r: PerformanceReview) => {
    setConfirmState({ title: t('Approve Review'), message: t('Approve this review?'), action: async () => { setConfirmState(null); try { await approveReview(r.id); toast.success(t('Review approved')); } catch (err) { toast.error((err as Error).message); } } });
  };

  const handleDeleteReview = (r: PerformanceReview) => {
    setConfirmState({ title: t('Delete Review'), message: t('Delete this review? This cannot be undone.'), danger: true, action: async () => { setConfirmState(null); try { await deleteReview(r.id); toast.success(t('Review deleted')); } catch (err) { toast.error((err as Error).message); } } });
  };

  const handleSaveGoal = async (data: Partial<Goal>) => {
    if (editingGoal) {
      await updateGoal(editingGoal.id, data);
      toast.success(t('Goal updated'));
    } else {
      await createGoal({ ...data, employeeId: currentUser?.id });
      toast.success(t('Goal created'));
    }
    setEditingGoal(undefined);
    setGoalFormOpen(false);
  };

  const handleCompleteGoal = (g: Goal) => {
    setConfirmState({ title: t('Complete Goal'), message: t('Mark this goal as completed?'), action: async () => { setConfirmState(null); try { await updateGoal(g.id, { status: 'Completed', progress: 100 }); toast.success(t('Goal completed')); } catch (err) { toast.error((err as Error).message); } } });
  };

  const handleDeleteGoal = (g: Goal) => {
    setConfirmState({ title: t('Delete Goal'), message: t('Delete this goal?'), danger: true, action: async () => { setConfirmState(null); try { await deleteGoal(g.id); toast.success(t('Goal deleted')); } catch (err) { toast.error((err as Error).message); } } });
  };

  const handleAddFeedback = async (data: Partial<Feedback360>) => {
    await addFeedback({ ...data, employeeId: feedbackTarget || currentUser?.id });
    toast.success(t('Feedback submitted'));
    setFeedbackFormOpen(false);
  };

  const handleSavePIP = async (data: Partial<PIP>) => {
    if (editingPIP) {
      await updatePIP(editingPIP.id, data);
      toast.success(t('PIP updated'));
    } else {
      await createPIP(data);
      toast.success(t('PIP created'));
    }
    setEditingPIP(undefined);
    setPipFormOpen(false);
  };

  const handleClosePIP = (p: PIP) => {
    setConfirmState({ title: t('Close PIP'), message: t('Close this PIP?'), action: async () => { setConfirmState(null); try { await updatePIP(p.id, { status: 'Closed' }); toast.success(t('PIP closed')); } catch (err) { toast.error((err as Error).message); } } });
  };

  // Grouped feedback
  const feedbackByEmployee = useMemo(() => {
    const map = new Map<string, { employeeId: string; items: Feedback360[] }>();
    for (const f of visibleFeedback) {
      if (!map.has(f.employeeId)) map.set(f.employeeId, { employeeId: f.employeeId, items: [] });
      map.get(f.employeeId)!.items.push(f);
    }
    return [...map.values()];
  }, [visibleFeedback]);

  // Employee-specific reviews for trend chart
  const revieweeReviews = useMemo(() => {
    if (!viewingReview) return [];
    return reviews.filter(r => r.employeeId === viewingReview.employeeId);
  }, [reviews, viewingReview]);

  const tabs: { key: TabKey; label: string; show: boolean }[] = [
    { key: 'dashboard', label: t('performance.dashboardTab'), show: true },
    { key: 'reviews', label: t('Reviews'), show: true },
    { key: 'goals', label: t('Goals'), show: permGoals || isEmployee || isManager || isHR || isAdmin },
    { key: 'feedback', label: t('360° Feedback'), show: true },
    { key: 'pips', label: t('PIPs'), show: true },
    { key: 'okrs', label: t('OKRs'), show: true },
    { key: 'feedbackQueue', label: t('Feedback Queue'), show: true },
    { key: 'analytics', label: t('Analytics'), show: permReports || isHR || isAdmin || isManager },
    { key: 'cycles', label: t('Cycles'), show: isHR || isAdmin },
  ].filter(t => t.show);

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="bg-card border-b px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <TrendingUp size={24} className="text-indigo-600" />
            <div>
              <h1 className="text-lg font-bold text-foreground">{t('Performance Tracker')}</h1>
              <p className="text-xs text-muted-foreground">{currentUser?.name}</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 capitalize">{role}</span>
          </div>
          <div className="flex items-center gap-3">
            {(canCreate || permConductReviews) && (
              <button
                onClick={() => { setEditingReview(undefined); setReviewFormOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
              >
                <Plus size={16} /> {t('Add Review')}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label={t('Total Reviews')} value={totalReviews} icon={TrendingUp} color="bg-indigo-500" />
          <StatCard label={t('Pending')} value={pendingReviews} icon={Clock} color="bg-yellow-500" />
          <StatCard
            label={t('Avg Rating')}
            value={avgRating > 0 ? <StarDisplay rating={avgRating} size={16} /> : '—'}
            icon={Star}
            color="bg-amber-500"
          />
          <StatCard label={t('PIPs Active')} value={activePIPs} icon={AlertTriangle} color="bg-red-500" />
        </div>

        {/* Tabs */}
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="flex border-b overflow-x-auto">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  tab === key
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-6">
            {loading && <InlineLoader />}

            {/* ── Dashboard tab ───────────────────────────────────── */}
            {!loading && tab === 'dashboard' && (
              <DashboardPanel currentUserId={currentUser?.id} goals={goals} />
            )}

            {/* ── Reviews tab ─────────────────────────────────────── */}
            {!loading && tab === 'reviews' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    className={`${selectCls} sm:w-48`}
                    value={periodFilter}
                    onChange={e => setPeriodFilter(e.target.value)}
                  >
                    <option value="">{t('All Periods')}</option>
                    <SelectOptions entity="performance" field="review_period" fallback={['Q1','Q2','Q3','Q4','Annual','Mid-Year']} />
                  </select>
                  <input
                    className={`${inputCls} flex-1`}
                    placeholder={t('Search by employee or reviewer...')}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>

                {visibleReviews.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">{t('No reviews found.')}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-3 pr-4 font-medium">{t('Employee')}</th>
                          <th className="pb-3 pr-4 font-medium">{t('Period')}</th>
                          <th className="pb-3 pr-4 font-medium hidden sm:table-cell">{t('Reviewer')}</th>
                          <th className="pb-3 pr-4 font-medium">{t('Rating')}</th>
                          <th className="pb-3 pr-4 font-medium">{t('Status')}</th>
                          <th className="pb-3 pr-4 font-medium hidden md:table-cell">{t('Date')}</th>
                          <th className="pb-3 font-medium">{t('Actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {visibleReviews.map(r => (
                          <tr key={r.id} className="group hover:bg-muted">
                            <td className="py-3 pr-4 font-medium text-foreground">{r.employeeName}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{r.reviewPeriod}</td>
                            <td className="py-3 pr-4 text-muted-foreground hidden sm:table-cell">{r.reviewer}</td>
                            <td className="py-3 pr-4"><StarDisplay rating={r.overallRating} size={13} /></td>
                            <td className="py-3 pr-4"><StatusBadge status={r.status} /></td>
                            <td className="py-3 pr-4 text-muted-foreground hidden md:table-cell">{r.reviewDate}</td>
                            <td className="py-3">
                              <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => setViewingReview(r)}
                                  className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600"
                                  title={t('View')}
                                >
                                  <Eye size={15} />
                                </button>
                                {canCreate && (
                                  <button
                                    onClick={() => { setEditingReview(r); setReviewFormOpen(true); }}
                                    className="p-1.5 rounded hover:bg-blue-50 text-blue-600"
                                    title={t('Edit')}
                                  >
                                    <Edit size={15} />
                                  </button>
                                )}
                                {canApprove && r.status !== 'Approved' && (
                                  <button
                                    onClick={() => handleApprove(r)}
                                    className="p-1.5 rounded hover:bg-green-50 text-green-600"
                                    title={t('Approve')}
                                  >
                                    <CheckCircle2 size={15} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={() => handleDeleteReview(r)}
                                    className="p-1.5 rounded hover:bg-red-50 text-red-600"
                                    title={t('Delete')}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Goals tab ───────────────────────────────────────── */}
            {!loading && tab === 'goals' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={() => { setEditingGoal(undefined); setGoalFormOpen(true); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                  >
                    <Plus size={16} /> {t('Add Goal')}
                  </button>
                </div>

                {visibleGoals.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">{t('No goals found.')}</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {visibleGoals.map(g => (
                      <div key={g.id} className="group border rounded-xl p-4 hover:shadow-sm transition-shadow bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground truncate">{g.title}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{g.description}</p>
                          </div>
                          <StatusBadge status={g.status} />
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>{t('Progress')}</span>
                            <span>{g.progress}%</span>
                          </div>
                          <ProgressBar value={g.progress} />
                        </div>
                        {g.targetDate && (
                          <p className="text-xs text-muted-foreground mt-2">{t('Target')}: {g.targetDate}</p>
                        )}
                        <div className="flex gap-2 mt-3 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingGoal(g); setGoalFormOpen(true); }}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-50 text-blue-600 hover:bg-blue-100"
                          >
                            <Edit size={12} /> {t('Edit')}
                          </button>
                          {g.status !== 'Completed' && (
                            <button
                              onClick={() => handleCompleteGoal(g)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-50 text-green-600 hover:bg-green-100"
                            >
                              <CheckCircle2 size={12} /> {t('Complete')}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteGoal(g)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100"
                          >
                            <Trash2 size={12} /> {t('Delete')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 360 Feedback tab ────────────────────────────────── */}
            {!loading && tab === 'feedback' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={() => setFeedbackFormOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                  >
                    <Plus size={16} /> {t('Add Feedback')}
                  </button>
                </div>

                {feedbackByEmployee.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">{t('No feedback found.')}</div>
                ) : (
                  <div className="space-y-6">
                    {feedbackByEmployee.map(group => (
                      <div key={group.employeeId}>
                        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                          <Users size={14} className="text-indigo-500" />
                          {t('Employee ID')}: {group.employeeId}
                        </h3>
                        <div className="space-y-3">
                          {group.items.map(f => (
                            <div key={f.id} className="border rounded-lg p-4 bg-muted">
                              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                                <span className="text-sm font-medium text-foreground">{f.reviewer}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">{f.feedbackType}</span>
                                  <span className="text-xs text-muted-foreground">{f.date?.slice(0, 10)}</span>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2">
                                {Object.entries(f.ratings).map(([k, v]) => (
                                  <div key={k} className="text-center">
                                    <p className="text-xs text-muted-foreground capitalize">{k}</p>
                                    <StarDisplay rating={v} size={11} />
                                  </div>
                                ))}
                              </div>
                              {f.comments && (
                                <p className="text-xs text-muted-foreground italic">{f.comments}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── PIPs tab ─────────────────────────────────────────── */}
            {!loading && tab === 'pips' && (
              <div className="space-y-4">
                {(isHR || isAdmin) && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => { setEditingPIP(undefined); setPipFormOpen(true); }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                    >
                      <Plus size={16} /> {t('Create PIP')}
                    </button>
                  </div>
                )}

                {visiblePIPs.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">{t('No PIPs found.')}</div>
                ) : (
                  <div className="space-y-3">
                    {visiblePIPs.map(p => (
                      <div key={p.id} className="border rounded-xl bg-card">
                        <div
                          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedPipId(expandedPipId === p.id ? null : p.id)}
                        >
                          <span className="text-muted-foreground">
                            {expandedPipId === p.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </span>
                          <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                            <span className="font-medium text-foreground truncate">{p.employeeName}</span>
                            <span className="text-muted-foreground hidden sm:block">{p.manager}</span>
                            <span className="text-muted-foreground hidden sm:block">{p.startDate} → {p.endDate}</span>
                            <StatusBadge status={p.status} />
                          </div>
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            {(isHR || isAdmin) && (
                              <button
                                onClick={() => { setEditingPIP(p); setPipFormOpen(true); }}
                                className="p-1.5 rounded hover:bg-blue-50 text-blue-600"
                                title={t('Edit')}
                              >
                                <Edit size={15} />
                              </button>
                            )}
                            {(isHR || isAdmin) && p.status === 'Active' && (
                              <button
                                onClick={() => handleClosePIP(p)}
                                className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                                title={t('Close PIP')}
                              >
                                <CheckCircle2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                        {expandedPipId === p.id && (
                          <div className="px-4 pb-4">
                            {p.reason && <p className="text-sm text-muted-foreground mb-2"><strong>{t('Reason')}: </strong>{p.reason}</p>}
                            {p.goals && <p className="text-sm text-muted-foreground mb-2"><strong>{t('Goals')}: </strong>{p.goals}</p>}
                            <PIPDetailPanel
                              pip={p}
                              isManager={isManager}
                              isHR={isHR}
                              isAdmin={isAdmin}
                              onUpdate={updatePIP}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── OKRs tab ─────────────────────────────────────────── */}
            {!loading && tab === 'okrs' && (
              <OKRsPanel canCreate={canCreate} currentUserId={currentUser?.id} />
            )}

            {/* ── Feedback Queue tab ───────────────────────────────── */}
            {!loading && tab === 'feedbackQueue' && (
              <FeedbackQueuePanel currentUserId={currentUser?.id} canCreate={canCreate} />
            )}

            {/* ── Analytics tab ───────────────────────────────────── */}
            {!loading && tab === 'analytics' && (
              <div className="space-y-10">
                <AnalyticsPanel reviews={visibleReviews} />
                {(isHR || isAdmin || permTeamPerformance) && (
                  <div className="border-t pt-8">
                    <CalibrationSection reviews={visibleReviews} userId={currentUser?.id} />
                  </div>
                )}
              </div>
            )}

            {/* ── Cycles tab ──────────────────────────────────────── */}
            {!loading && tab === 'cycles' && (
              <CyclesPanel
                cycles={cycles}
                loading={cyclesLoading}
                onCreate={handleCreateCycle}
                onActivate={handleActivateCycle}
                onClose={handleCloseCycle}
                onDelete={handleDeleteCycle}
                onFinalize={setFinalizingCycle}
              />
            )}
          </div>
        </div>
      </main>

      {/* ── Continuous Feedback Widget (floating) ─────────────── */}
      <ContinuousFeedbackWidget currentUserId={currentUser?.id} />

      {/* ── Modals ──────────────────────────────────────────────── */}

      {reviewFormOpen && (
        <Modal
          title={editingReview ? t('Edit Review') : t('New Review')}
          onClose={() => { setReviewFormOpen(false); setEditingReview(undefined); }}
        >
          <ReviewForm
            initial={editingReview}
            onSave={handleSaveReview}
            onClose={() => { setReviewFormOpen(false); setEditingReview(undefined); }}
          />
        </Modal>
      )}

      {viewingReview && (
        <Modal title={t('Review Detail')} onClose={() => setViewingReview(undefined)} wide>
          <ReviewDetail
            review={viewingReview}
            canSelfAssess={isEmployee && viewingReview.employeeId === currentUser?.id}
            onSelfAssessment={submitSelfAssessment}
            onClose={() => setViewingReview(undefined)}
            employeeReviews={revieweeReviews}
          />
        </Modal>
      )}

      {goalFormOpen && (
        <Modal
          title={editingGoal ? t('Edit Goal') : t('New Goal')}
          onClose={() => { setGoalFormOpen(false); setEditingGoal(undefined); }}
        >
          <GoalForm
            initial={editingGoal}
            onSave={handleSaveGoal}
            onClose={() => { setGoalFormOpen(false); setEditingGoal(undefined); }}
          />
        </Modal>
      )}

      {feedbackFormOpen && (
        <Modal title={t('Add 360° Feedback')} onClose={() => setFeedbackFormOpen(false)}>
          <FeedbackForm onSave={handleAddFeedback} onClose={() => setFeedbackFormOpen(false)} />
        </Modal>
      )}

      {pipFormOpen && (
        <Modal
          title={editingPIP ? t('Edit PIP') : t('Create PIP')}
          onClose={() => { setPipFormOpen(false); setEditingPIP(undefined); }}
        >
          <PIPForm
            initial={editingPIP}
            onSave={handleSavePIP}
            onClose={() => { setPipFormOpen(false); setEditingPIP(undefined); }}
          />
        </Modal>
      )}

      {/* Finalize Cycle confirmation */}
      {finalizingCycle && (
        <Modal title={t('Finalize Cycle')} onClose={() => setFinalizingCycle(null)}>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              {t('This will lock all reviews in')} <strong>{finalizingCycle.name}</strong>. {t('Continue?')}
              {finalizingCycle.employee_count !== undefined && (
                <span> ({finalizingCycle.employee_count} {t('reviews')})</span>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setFinalizingCycle(null)} className="px-4 py-2 rounded-lg border text-sm text-foreground hover:bg-muted">{t('Cancel')}</button>
              <button
                onClick={() => void handleFinalizeCycle(finalizingCycle)}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700"
              >
                <Lock size={14} className="inline mr-1" />{t('Finalize')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          danger={confirmState.danger}
          onConfirm={confirmState.action}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}

export default PerformanceTrackerEnhancedV2;
