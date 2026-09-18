import { useState, useEffect, useCallback } from 'react';
import { InlineLoader } from '../ui/PageLoader';
import { toast } from 'sonner';
import {
  GraduationCap, BookOpen, Users, Award, Plus, Clock, Pencil,
  Trash2, CheckCircle2, AlertCircle, X, ChevronDown,
  Download, ChevronUp, ShieldCheck, Route, Lock, ChevronRight,
  ArrowUp, ArrowDown, Search, Calendar, BarChart2, ChevronLeft,
  MapPin, Video, Globe, FileText,
} from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useTrainingData, Course, Enrollment } from '../../hooks/useTrainingData';
import { t } from '../../../i18n/index';
import { supabase, API_BASE, publicAnonKey } from '../../utils/constants';
import {
  TRAINING_STATUSES,
  COURSE_CATEGORIES,
  COURSE_LEVELS,
  COURSE_MODES,
  CERTIFICATE_VALIDITY_YEARS,
} from '../../../constants/apps/training';
import { SelectOptions } from '../../context/ValueHelpsContext';
import { ALL_ROLES } from '../../../constants/apps/user-management';

// ─── types ───────────────────────────────────────────────────────────────────

interface LearningPath {
  id: string;
  name: string;
  description: string;
  target_role?: string;
  courses: string[]; // ordered course IDs
  estimated_hours: number;
  created_by: string;
  created_at: string;
  // DB extras
  category?: string;
  level?: string;
  is_mandatory?: boolean;
  target_roles?: string[];
}

interface PathEnrollment {
  path_id: string;
  employee_id: string;
  progress: number;
  status: 'enrolled' | 'completed' | 'In Progress' | 'Completed' | 'Not Started';
  enrolled_at: string;
  completed_at?: string;
}

interface TrainingSession {
  id: string;
  course_id: string;
  title: string;
  session_type: 'in_person' | 'virtual' | 'hybrid';
  instructor_id?: string;
  start_datetime: string;
  end_datetime: string;
  location?: string;
  meeting_url?: string;
  max_participants?: number;
  registered_count?: number;
  status: string;
}

interface TrainingNeed {
  id: string;
  employee_id: string;
  course_name: string;
  category: string;
  justification: string;
  estimated_cost?: number;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  created_at?: string;
}

interface DbCertificate {
  id: string;
  employee_id: string;
  course_id: string;
  issued_at: string;
  expiry_date?: string;
  expiry_status?: string;
  renewal_course_id?: string;
  training_courses?: { title: string };
}

type TrainingStatus = (typeof TRAINING_STATUSES)[number];

// ─── helpers ─────────────────────────────────────────────────────────────────

function statusColor(status: TrainingStatus) {
  switch (status) {
    case 'Completed': return 'bg-green-100 text-green-800';
    case 'In Progress': return 'bg-blue-100 text-blue-800';
    case 'Failed': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-700';
  }
}

function categoryColor(category: string) {
  const map: Record<string, string> = {
    Technical: 'bg-blue-100 text-blue-800',
    'Soft Skills': 'bg-purple-100 text-purple-800',
    Compliance: 'bg-red-100 text-red-800',
    Leadership: 'bg-yellow-100 text-yellow-800',
    Product: 'bg-green-100 text-green-800',
    Safety: 'bg-orange-100 text-orange-800',
    Other: 'bg-gray-100 text-gray-700',
  };
  return map[category] ?? 'bg-gray-100 text-gray-700';
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

function fmtDateTime(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function isHRAdmin(roles: string[]) {
  return roles.some((r) => r === 'hr' || r === 'admin');
}
function isManager(roles: string[]) {
  return roles.some((r) => r === 'manager');
}
function canManageCourses(roles: string[]) {
  return isHRAdmin(roles);
}
function canSeeTeam(roles: string[]) {
  return isHRAdmin(roles) || isManager(roles);
}
function canSeeCompliance(roles: string[]) {
  return isHRAdmin(roles) || isManager(roles);
}

// ─── CSV export helper ────────────────────────────────────────────────────────

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: filename,
  });
  a.click();
}

// ─── Certificate expiry helpers ───────────────────────────────────────────────

const CERT_VALIDITY_MS = CERTIFICATE_VALIDITY_YEARS * 365 * 24 * 3600 * 1000;
const EXPIRY_WARN_MS = 60 * 24 * 3600 * 1000;

function certExpiresAt(issuedAt: string): number {
  return new Date(issuedAt).getTime() + CERT_VALIDITY_MS;
}

function isCertExpiringSoon(issuedAt: string): boolean {
  return certExpiresAt(issuedAt) < Date.now() + EXPIRY_WARN_MS;
}

function certExpiryColor(expiryDate: string | undefined, issuedAt?: string): string {
  const expiryMs = expiryDate
    ? new Date(expiryDate).getTime()
    : issuedAt ? certExpiresAt(issuedAt) : null;
  if (!expiryMs) return 'bg-gray-100 text-gray-600';
  const daysLeft = (expiryMs - Date.now()) / (24 * 3600 * 1000);
  if (daysLeft < 0) return 'bg-red-100 text-red-800';
  if (daysLeft < 30) return 'bg-red-100 text-red-700';
  if (daysLeft < 90) return 'bg-amber-100 text-amber-800';
  return 'bg-green-100 text-green-800';
}

function certExpiryLabel(expiryDate: string | undefined, issuedAt?: string): string {
  const expiryMs = expiryDate
    ? new Date(expiryDate).getTime()
    : issuedAt ? certExpiresAt(issuedAt) : null;
  if (!expiryMs) return '—';
  const daysLeft = Math.round((expiryMs - Date.now()) / (24 * 3600 * 1000));
  if (daysLeft < 0) return t('training.certExpiry.expired');
  if (daysLeft < 30) return t('training.certExpiry.expiresIn').replace('{n}', String(daysLeft));
  if (daysLeft < 90) return t('training.certExpiry.expiresSoon');
  return fmtDate(expiryDate ?? new Date(expiryMs).toISOString());
}

// Session type color
function sessionTypeColor(type: TrainingSession['session_type']) {
  switch (type) {
    case 'in_person': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'virtual': return 'bg-green-100 text-green-800 border-green-200';
    case 'hybrid': return 'bg-purple-100 text-purple-800 border-purple-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function sessionTypeDot(type: TrainingSession['session_type']) {
  switch (type) {
    case 'in_person': return 'bg-blue-500';
    case 'virtual': return 'bg-green-500';
    case 'hybrid': return 'bg-purple-500';
    default: return 'bg-gray-400';
  }
}

// ─── sub-components ──────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub,
}: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 flex items-center gap-4">
      <div className="flex-shrink-0 text-indigo-500">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-orange-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// ─── Update Progress Modal ────────────────────────────────────────────────────

function UpdateProgressModal({
  enrollment,
  onClose,
  onSave,
}: {
  enrollment: Enrollment;
  onClose: () => void;
  onSave: (enrollmentId: string, progress: number) => Promise<void>;
}) {
  const [progress, setProgress] = useState(enrollment.progress);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (progress < 0 || progress > 100) { toast.error(t('validation.progress.range')); return; }
    setSaving(true);
    try {
      await onSave(enrollment.id, progress);
      onClose();
    } catch {
      // error already toasted inside onSave
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">{t('training.updateProgress.title')}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{enrollment.courseName}</p>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t('training.updateProgress.progressLabel')} {progress}%</label>
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>
          <ProgressBar value={progress} />
          {progress === 100 && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg p-3 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              {t('training.updateProgress.certNote')}
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? t('training.updateProgress.saving') : t('common.save')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Course Form Modal ────────────────────────────────────────────────────────

type CourseFormData = {
  title: string;
  description: string;
  category: string;
  level: string;
  mode: string;
  duration: string;
  instructor: string;
  mandatory: boolean;
};

const emptyCourseForm = (): CourseFormData => ({
  title: '',
  description: '',
  category: COURSE_CATEGORIES[0],
  level: COURSE_LEVELS[0],
  mode: COURSE_MODES[0],
  duration: '',
  instructor: '',
  mandatory: false,
});

function CourseFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Partial<CourseFormData>;
  onClose: () => void;
  onSave: (data: CourseFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<CourseFormData>({ ...emptyCourseForm(), ...initial });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function update<K extends keyof CourseFormData>(k: K, v: CourseFormData[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = t('validation.training.title');
    if (!form.instructor.trim()) e.instructor = t('validation.training.instructor');
    if (!form.duration.trim()) e.duration = t('validation.training.duration');
    if (Object.keys(e).length > 0) { setErrors(e); toast.error(t('common.error')); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch {
      // error already toasted inside onSave
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">
            {initial ? t('training.courseForm.editTitle') : t('training.courseForm.addTitle')}
          </h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        <div className="space-y-4">
          <Field label={t('training.courseForm.labelTitle')}>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
            />
            {errors.title && <p className="text-xs text-red-500 mt-0.5">{errors.title}</p>}
          </Field>
          <Field label={t('training.courseForm.labelDescription')}>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none"
              rows={3}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('training.courseForm.labelCategory')}>
              <NativeSelect value={form.category} onChange={(v) => update('category', v)}>
                <SelectOptions entity="training" field="category" fallback={['Technical','Soft Skills','Compliance','Leadership','Product']} />
              </NativeSelect>
            </Field>
            <Field label={t('training.courseForm.labelLevel')}>
              <NativeSelect value={form.level} onChange={(v) => update('level', v)}>
                <SelectOptions entity="training" field="level" fallback={['Beginner','Intermediate','Advanced','Expert']} />
              </NativeSelect>
            </Field>
            <Field label={t('training.courseForm.labelMode')}>
              <NativeSelect value={form.mode} onChange={(v) => update('mode', v)}>
                <SelectOptions entity="training" field="mode" fallback={['Online','In-Person','Hybrid','Self-Paced']} />
              </NativeSelect>
            </Field>
            <Field label={t('training.courseForm.labelDuration')}>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                placeholder={t('training.courseForm.placeholderDuration')}
                value={form.duration}
                onChange={(e) => update('duration', e.target.value)}
              />
              {errors.duration && <p className="text-xs text-red-500 mt-0.5">{errors.duration}</p>}
            </Field>
          </div>
          <Field label={t('training.courseForm.labelInstructor')}>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              value={form.instructor}
              onChange={(e) => update('instructor', e.target.value)}
            />
            {errors.instructor && <p className="text-xs text-red-500 mt-0.5">{errors.instructor}</p>}
          </Field>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.mandatory}
              onChange={(e) => update('mandatory', e.target.checked)}
              className="accent-orange-500"
            />
            {t('training.courseForm.markMandatory')}
          </label>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? t('training.courseForm.saving') : initial ? t('training.courseForm.updateButton') : t('training.courseForm.createButton')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Enroll Team Member Modal ─────────────────────────────────────────────────

function EnrollTeamModal({
  courses,
  onClose,
  onSave,
}: {
  courses: Course[];
  onClose: () => void;
  onSave: (courseId: string, employeeName: string, mandatory: boolean, dueDate: string) => Promise<void>;
}) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [employeeName, setEmployeeName] = useState('');
  const [mandatory, setMandatory] = useState(false);
  const [enrollmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!courseId) errs.courseId = t('validation.enrollment.course');
    if (!employeeName.trim()) errs.employeeName = t('validation.enrollment.employee');
    if (dueDate && new Date(dueDate) <= new Date(enrollmentDate)) errs.dueDate = t('validation.enrollment.dateRange');
    if (Object.keys(errs).length > 0) { setErrors(errs); toast.error(t('common.error')); return; }
    setSaving(true);
    try {
      await onSave(courseId, employeeName, mandatory, dueDate);
      onClose();
    } catch {
      // error already toasted inside onSave
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">{t('training.enroll.title')}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-4">
          <Field label={t('training.enroll.labelCourse')}>
            <NativeSelect value={courseId} onChange={setCourseId}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </NativeSelect>
            {errors.courseId && <p className="text-xs text-red-500 mt-0.5">{errors.courseId}</p>}
          </Field>
          <Field label={t('training.enroll.labelEmployee')}>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
            />
            {errors.employeeName && <p className="text-xs text-red-500 mt-0.5">{errors.employeeName}</p>}
          </Field>
          <Field label={t('training.enroll.labelDueDate')}>
            <input
              type="date"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            {errors.dueDate && <p className="text-xs text-red-500 mt-0.5">{errors.dueDate}</p>}
          </Field>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={mandatory}
              onChange={(e) => setMandatory(e.target.checked)}
              className="accent-orange-500"
            />
            {t('training.enroll.mandatory')}
          </label>
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? t('training.enroll.enrolling') : t('training.enroll.button')}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── small primitives ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        className="w-full appearance-none border border-border rounded-lg px-3 py-2 pr-8 text-sm bg-card"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
    </div>
  );
}

// ─── Expiring Certificates Banner ────────────────────────────────────────────

type ExpiringCert = {
  id: string;
  employeeName: string;
  courseName: string;
  expiresAt: number;
  courseId: string;
};

function ExpiringCertsBanner({
  expiring,
  isManagerView,
  onRenew,
}: {
  expiring: ExpiringCert[];
  isManagerView: boolean;
  onRenew: (courseId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (expiring.length === 0) return null;

  const uniqueEmployees = new Set(expiring.map((c) => c.employeeName)).size;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-amber-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm font-medium">
            {isManagerView
              ? `${uniqueEmployees} team member${uniqueEmployees !== 1 ? 's' : ''} have ${expiring.length} certificate${expiring.length !== 1 ? 's' : ''} expiring within 60 days`
              : `${expiring.length} certificate${expiring.length !== 1 ? 's' : ''} expiring within 60 days`}
          </span>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-amber-700 font-medium hover:text-amber-900"
        >
          {expanded ? t('training.expiry.hide') : t('training.expiry.viewDetails')}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 divide-y divide-amber-100">
          {expiring.map((cert) => (
            <div key={cert.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <span className="font-medium text-amber-900">{cert.courseName}</span>
                {isManagerView && (
                  <span className="text-amber-700 ml-2">— {cert.employeeName}</span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-amber-700">
                  {t('training.expiry.expires')} {new Date(cert.expiresAt).toLocaleDateString()}
                </span>
                <button
                  onClick={() => onRenew(cert.courseId)}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700"
                >
                  {t('training.expiry.renew')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Compliance Report Tab ────────────────────────────────────────────────────

type ComplianceRow = {
  courseId: string;
  title: string;
  category: string;
  dueDate: string;
  enrolled: number;
  completed: number;
  notStarted: number;
  pct: number;
};

function complianceStatus(pct: number): { label: string; className: string } {
  if (pct >= 80) return { label: t('training.compliance.statusCompliant'), className: 'bg-green-100 text-green-800' };
  if (pct >= 50) return { label: t('training.compliance.statusAtRisk'), className: 'bg-amber-100 text-amber-800' };
  return { label: t('training.compliance.statusNonCompliant'), className: 'bg-red-100 text-red-800' };
}

function ComplianceReport({
  courses,
  enrollments,
}: {
  courses: Course[];
  enrollments: Enrollment[];
}) {
  const today = Date.now();

  const mandatoryCourses = courses.filter((c) => c.mandatory);
  const mandatoryIds = new Set(mandatoryCourses.map((c) => c.id));
  const mandatoryEnrollments = enrollments.filter((e) => mandatoryIds.has(e.courseId));

  const employeesEnrolled = new Set(mandatoryEnrollments.map((e) => e.employeeId)).size;
  const totalCompleted = mandatoryEnrollments.filter((e) => e.progress === 100).length;
  const completionRate =
    mandatoryEnrollments.length > 0
      ? Math.round((totalCompleted / mandatoryEnrollments.length) * 100)
      : 0;
  const overdue = mandatoryEnrollments.filter(
    (e) => e.dueDate && new Date(e.dueDate).getTime() < today && e.progress < 100,
  ).length;

  const rows: ComplianceRow[] = mandatoryCourses.map((course) => {
    const courseEnrollments = mandatoryEnrollments.filter((e) => e.courseId === course.id);
    const completed = courseEnrollments.filter((e) => e.progress === 100).length;
    const notStarted = courseEnrollments.filter((e) => e.progress === 0).length;
    const enrolled = courseEnrollments.length;
    const pct = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0;
    const dueDates = courseEnrollments.map((e) => e.dueDate).filter(Boolean) as string[];
    const dueDate = dueDates.length > 0 ? dueDates.sort()[0] : '';
    return { courseId: course.id, title: course.title, category: course.category, dueDate, enrolled, completed, notStarted, pct };
  });

  function handleExport() {
    const header = [t('training.compliance.colCourse'), t('training.compliance.colCategory'), t('training.compliance.colDueDate'), t('training.compliance.colEnrolled'), t('training.compliance.colCompleted'), t('training.compliance.colNotStarted'), t('training.compliance.colCompletionPct'), t('common.status')];
    const dataRows = rows.map((r) => [
      r.title,
      r.category,
      r.dueDate || '—',
      String(r.enrolled),
      String(r.completed),
      String(r.notStarted),
      `${r.pct}%`,
      complianceStatus(r.pct).label,
    ]);
    downloadCSV('compliance-report.csv', [header, ...dataRows]);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={<ShieldCheck className="h-8 w-8" />}
          label={t('training.compliance.mandatoryCourses')}
          value={mandatoryCourses.length}
        />
        <StatCard
          icon={<Users className="h-8 w-8" />}
          label={t('training.compliance.employeesEnrolled')}
          value={employeesEnrolled}
        />
        <StatCard
          icon={<CheckCircle2 className="h-8 w-8 text-green-500" />}
          label={t('training.compliance.completionRate')}
          value={`${completionRate}%`}
          sub={`${totalCompleted} / ${mandatoryEnrollments.length} ${t('training.compliance.colCompleted').toLowerCase()}`}
        />
        <StatCard
          icon={<AlertCircle className="h-8 w-8 text-red-500" />}
          label={t('training.compliance.overdue')}
          value={overdue}
          sub={t('training.compliance.mandatoryEnrollments')}
        />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t('training.compliance.mandatoryCourseCompliance')}</h3>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100"
        >
          <Download className="h-3.5 w-3.5" />
          {t('training.compliance.exportCSV')}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{t('training.compliance.noMandatory')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3 text-left">{t('training.compliance.colCourse')}</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">{t('training.compliance.colCategory')}</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">{t('training.compliance.colDueDate')}</th>
                <th className="px-4 py-3 text-right">{t('training.compliance.colEnrolled')}</th>
                <th className="px-4 py-3 text-right">{t('training.compliance.colCompleted')}</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">{t('training.compliance.colNotStarted')}</th>
                <th className="px-4 py-3 text-right">{t('training.compliance.colCompletionPct')}</th>
                <th className="px-4 py-3 text-left">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const { label, className } = complianceStatus(row.pct);
                return (
                  <tr key={row.courseId} className="border-b border-gray-50 hover:bg-muted">
                    <td className="px-4 py-3 font-medium text-foreground">{row.title}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge label={row.category} className={categoryColor(row.category)} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                      {fmtDate(row.dueDate || undefined)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">{row.enrolled}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-700">{row.completed}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden sm:table-cell">{row.notStarted}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">{row.pct}%</td>
                    <td className="px-4 py-3">
                      <Badge label={label} className={className} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Create Learning Path Modal ───────────────────────────────────────────────

function CreateLearningPathModal({
  courses,
  onClose,
  onSave,
}: {
  courses: Course[];
  onClose: () => void;
  onSave: (data: { name: string; description: string; category: string; level: string; estimated_hours: number; is_mandatory: boolean; target_roles: string[] }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(COURSE_CATEGORIES[0]);
  const [level, setLevel] = useState(COURSE_LEVELS[0]);
  const [estimatedHours, setEstimatedHours] = useState('');
  const [isMandatory, setIsMandatory] = useState(false);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [courseSearch, setCourseSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const filteredCourses = courses.filter(
    (c) =>
      !selectedCourseIds.includes(c.id) &&
      c.title.toLowerCase().includes(courseSearch.toLowerCase()),
  );

  function addCourse(courseId: string) {
    setSelectedCourseIds((prev) => [...prev, courseId]);
  }
  function removeCourse(courseId: string) {
    setSelectedCourseIds((prev) => prev.filter((id) => id !== courseId));
  }
  function moveUp(idx: number) {
    if (idx === 0) return;
    setSelectedCourseIds((prev) => {
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
  }
  function moveDown(idx: number) {
    setSelectedCourseIds((prev) => {
      if (idx >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
  }

  async function handleSave() {
    if (!name.trim()) { toast.error(t('validation.learningPath.name')); return; }
    if (selectedCourseIds.length < 2) { toast.error(t('training.minCoursesError')); return; }
    setSaving(true);
    try {
      await onSave({
        name,
        description,
        category,
        level,
        estimated_hours: Number(estimatedHours) || 0,
        is_mandatory: isMandatory,
        target_roles: targetRoles,
      });
      // After saving the path, also save course associations – handled in parent
      onClose();
    } catch {
      // error already toasted inside onSave
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">{t('training.learningPath.createTitle')}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-4">
          <Field label={t('training.learningPath.name') + ' *'}>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('training.learningPath.namePlaceholder')}
            />
          </Field>
          <Field label={t('training.learningPath.description')}>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('training.courseForm.labelCategory')}>
              <NativeSelect value={category} onChange={setCategory}>
                {COURSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </NativeSelect>
            </Field>
            <Field label={t('training.courseForm.labelLevel')}>
              <NativeSelect value={level} onChange={setLevel}>
                {COURSE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </NativeSelect>
            </Field>
            <Field label={t('training.learningPath.estimatedHours')}>
              <input
                type="number"
                min={0}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label={t('training.learningPath.targetRoles')}>
              <NativeSelect value={targetRoles[0] ?? ''} onChange={(v) => setTargetRoles(v ? [v] : [])}>
                <option value="">{t('training.learningPath.anyRole')}</option>
                {ALL_ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isMandatory}
              onChange={(e) => setIsMandatory(e.target.checked)}
              className="accent-orange-500"
            />
            {t('training.learningPath.mandatory')}
          </label>

          {/* Course sequence builder */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t('training.learningPath.courseSequence')} *</label>
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="border-b border-border p-2 flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <input
                  className="flex-1 text-sm focus:outline-none"
                  placeholder={t('training.learningPath.searchCourses')}
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                />
              </div>
              {courseSearch && filteredCourses.length > 0 && (
                <div className="max-h-32 overflow-y-auto divide-y divide-gray-50">
                  {filteredCourses.slice(0, 6).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { addCourse(c.id); setCourseSearch(''); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 text-foreground hover:text-indigo-700 flex items-center justify-between"
                    >
                      <span className="truncate">{c.title}</span>
                      <Plus className="h-3 w-3 flex-shrink-0 text-indigo-500" />
                    </button>
                  ))}
                </div>
              )}
              <div className="p-2 space-y-1.5">
                {selectedCourseIds.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">{t('training.learningPath.noCoursesAdded')}</p>
                ) : (
                  selectedCourseIds.map((cid, idx) => {
                    const course = courses.find((c) => c.id === cid);
                    return (
                      <div
                        key={cid}
                        draggable
                        onDragStart={() => setDragIndex(idx)}
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={() => {
                          if (dragIndex === null || dragIndex === idx) return;
                          setSelectedCourseIds((prev) => {
                            const arr = [...prev];
                            const [moved] = arr.splice(dragIndex, 1);
                            arr.splice(idx, 0, moved);
                            return arr;
                          });
                          setDragIndex(null);
                        }}
                        onDragEnd={() => setDragIndex(null)}
                        className={`flex items-center gap-2 bg-muted rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing ${dragIndex !== null && dragIndex !== idx ? 'border-t-2 border-indigo-400' : ''}`}
                      >
                        <span className="text-muted-foreground select-none" title={t('training.dragToReorder')}>⠿</span>
                        <span className="text-xs font-bold text-indigo-500 w-5 text-center">{idx + 1}</span>
                        <span className="flex-1 text-sm text-foreground truncate">{course?.title ?? cid}</span>
                        <button onClick={() => removeCourse(cid)} className="p-0.5 text-muted-foreground hover:text-red-500 flex-shrink-0">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? t('training.learningPath.creating') : t('training.learningPath.createButton')}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Path Detail Modal ────────────────────────────────────────────────────────

function PathDetailModal({
  path,
  courses,
  enrollment,
  onClose,
  onEnroll,
}: {
  path: LearningPath;
  courses: Course[];
  enrollment?: PathEnrollment;
  onClose: () => void;
  onEnroll: () => Promise<void>;
}) {
  const [enrolling, setEnrolling] = useState(false);

  async function handleEnroll() {
    setEnrolling(true);
    await onEnroll();
    setEnrolling(false);
    onClose();
  }

  const progress = enrollment?.progress ?? 0;
  const coursesInPath = path.courses;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-foreground">{path.name}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        {path.description && <p className="text-sm text-muted-foreground mb-3">{path.description}</p>}
        <div className="flex flex-wrap gap-2 mb-4 text-xs text-muted-foreground">
          {path.target_role && (
            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
              {path.target_role}
            </span>
          )}
          {path.target_roles && path.target_roles.length > 0 && !path.target_role && (
            path.target_roles.map((r) => (
              <span key={r} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{r}</span>
            ))
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {path.estimated_hours}h {t('training.learningPath.estimated')}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {coursesInPath.length} {t('training.learningPath.courses')}
          </span>
        </div>

        {enrollment && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-1">{t('training.learningPath.overallProgress')}</p>
            <ProgressBar value={progress} />
          </div>
        )}

        {/* Ordered course list */}
        <div className="space-y-2 mb-6">
          {coursesInPath.map((cid, idx) => {
            const course = courses.find((c) => c.id === cid);
            const completedCount = enrollment ? Math.round((progress / 100) * coursesInPath.length) : 0;
            const isDone = enrollment && idx < completedCount;
            const isCurrent = enrollment && idx === completedCount && progress < 100;
            const isLocked = !enrollment || (!isDone && !isCurrent);

            return (
              <div
                key={cid}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border ${
                  isDone ? 'bg-green-50 border-green-200' :
                  isCurrent ? 'bg-indigo-50 border-indigo-300' :
                  'bg-muted border-border'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  isDone ? 'bg-green-500 text-white' :
                  isCurrent ? 'bg-indigo-600 text-white' :
                  'bg-gray-200 text-muted-foreground'
                }`}>
                  {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isDone ? 'text-green-800' : isCurrent ? 'text-indigo-900' : 'text-muted-foreground'}`}>
                    {course?.title ?? cid}
                  </p>
                  {course?.duration && (
                    <p className="text-xs text-muted-foreground">{course.duration}</p>
                  )}
                </div>
                {isLocked && !enrollment && (
                  <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
                {isCurrent && (
                  <ChevronRight className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {enrollment ? (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            {enrollment.status === 'completed' || enrollment.status === 'Completed'
              ? t('training.learningPath.pathCompleted')
              : t('training.learningPath.enrolled').replace('{pct}', String(progress))}
          </div>
        ) : (
          <button
            onClick={handleEnroll}
            disabled={enrolling}
            className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {enrolling ? t('training.learningPath.enrolling') : t('training.learningPath.enrollButton')}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Learning Paths Tab (DB-backed) ──────────────────────────────────────────

function LearningPathsTab({
  courses,
  employeeId,
  canManage,
}: {
  courses: Course[];
  employeeId: string;
  canManage: boolean;
}) {
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [enrollments, setEnrollments] = useState<PathEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null);

  async function fetchPaths() {
    setLoading(true);
    const { data: pathData } = await supabase
      .from('training_paths')
      .select('*, training_path_courses(course_id, sequence_order, is_optional, training_courses(id, title, duration_hours))')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    const { data: enrData } = await supabase
      .from('training_path_enrollments')
      .select('*')
      .eq('employee_id', employeeId);

    if (pathData) {
      const converted: LearningPath[] = pathData.map((p: Record<string, unknown>) => {
        const pathCourses = (p.training_path_courses as Array<{ course_id: string; sequence_order: number }> ?? [])
          .sort((a, b) => a.sequence_order - b.sequence_order)
          .map((pc) => pc.course_id);
        return {
          id: p.id as string,
          name: p.name as string,
          description: (p.description as string) ?? '',
          category: p.category as string,
          level: p.level as string,
          estimated_hours: (p.estimated_hours as number) ?? 0,
          is_mandatory: p.is_mandatory as boolean,
          target_roles: (p.target_roles as string[]) ?? [],
          created_by: p.created_by as string,
          created_at: p.created_at as string,
          courses: pathCourses,
        };
      });
      setPaths(converted);
    }
    setEnrollments((enrData as PathEnrollment[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { if (employeeId) void fetchPaths(); }, [employeeId]);

  async function handleCreate(data: { name: string; description: string; category: string; level: string; estimated_hours: number; is_mandatory: boolean; target_roles: string[] }) {
    const { data: newPath, error } = await supabase
      .from('training_paths')
      .insert([{ ...data, created_by: employeeId, is_active: true }])
      .select()
      .single();
    if (error || !newPath) {
      toast.error(t('training.learningPath.createError'));
      return;
    }
    toast.success(t('training.learningPath.created'));
    void fetchPaths();
  }

  async function handleEnroll(path: LearningPath) {
    const existing = enrollments.find((e) => e.path_id === path.id);
    if (existing) { toast.info(t('training.learningPath.alreadyEnrolled')); return; }
    const { error: enrollErr } = await supabase.from('training_path_enrollments').upsert([{
      path_id: path.id,
      employee_id: employeeId,
      status: 'enrolled',
      progress: 0,
      enrolled_at: new Date().toISOString(),
    }]);
    if (enrollErr) throw new Error(enrollErr.message);
    toast.success(t('training.learningPath.enrolledSuccess').replace('{name}', path.name));
    // Optimistically add enrollment
    setEnrollments((prev) => [...prev, {
      path_id: path.id,
      employee_id: employeeId,
      progress: 0,
      status: 'enrolled',
      enrolled_at: new Date().toISOString(),
    }]);
  }

  const myEnrollments = enrollments.filter((e) => e.employee_id === employeeId);

  if (loading) return <InlineLoader />;

  return (
    <div className="space-y-8">
      {/* My Learning Paths */}
      {myEnrollments.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('training.learningPath.myPaths')}</h3>
          <div className="space-y-3">
            {myEnrollments.map((enr) => {
              const path = paths.find((p) => p.id === enr.path_id);
              if (!path) return null;
              return (
                <div
                  key={enr.path_id}
                  className="bg-card rounded-xl border border-border p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-medium text-foreground text-sm">{path.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {path.courses.length} {t('training.learningPath.courses')} · {path.estimated_hours}h
                      </p>
                    </div>
                    <Badge
                      label={enr.status === 'completed' ? t('training.learningPath.statusCompleted') : t('training.learningPath.statusInProgress')}
                      className={enr.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}
                    />
                  </div>
                  <ProgressBar value={enr.progress ?? 0} />
                  {enr.status !== 'completed' && (
                    <button
                      onClick={() => setSelectedPath(path)}
                      className="mt-3 text-xs font-medium text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100"
                    >
                      {t('training.learningPath.continue')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Path Library */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">{t('training.learningPath.library')}</h3>
          {canManage && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 bg-indigo-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('training.learningPath.createButton')}
            </button>
          )}
        </div>

        {paths.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Route className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>{t('training.learningPath.noPaths')}</p>
            {canManage && <p className="text-sm mt-1">{t('training.learningPath.createFirst')}</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paths.map((path) => {
              const enrolled = enrollments.find((e) => e.path_id === path.id);
              return (
                <div
                  key={path.id}
                  onClick={() => setSelectedPath(path)}
                  className="bg-card rounded-xl border border-border p-5 cursor-pointer hover:shadow-md transition-shadow flex flex-col gap-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-foreground text-sm leading-snug flex-1">{path.name}</h4>
                      {enrolled && (
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {path.category && <Badge label={path.category} className={categoryColor(path.category)} />}
                      {path.level && <Badge label={path.level} className="bg-muted text-muted-foreground" />}
                      {path.is_mandatory && <Badge label={t('training.mandatory')} className="bg-orange-100 text-orange-700" />}
                    </div>
                    {path.description && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{path.description}</p>
                    )}
                  </div>
                  <div className="mt-auto pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {path.courses.length} {t('training.learningPath.courses')}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {path.estimated_hours}h</span>
                  </div>
                  {enrolled && (
                    <div className="pt-1">
                      <ProgressBar value={enrolled.progress ?? 0} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateLearningPathModal
          courses={courses}
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
        />
      )}

      {selectedPath && (
        <PathDetailModal
          path={selectedPath}
          courses={courses}
          enrollment={enrollments.find((e) => e.path_id === selectedPath.id)}
          onClose={() => setSelectedPath(null)}
          onEnroll={() => handleEnroll(selectedPath)}
        />
      )}
    </div>
  );
}

// ─── Session Detail Modal ─────────────────────────────────────────────────────

function SessionDetailModal({
  session,
  employeeId,
  isRegistered,
  onClose,
  onRegister,
  onUnregister,
}: {
  session: TrainingSession;
  employeeId: string;
  isRegistered: boolean;
  onClose: () => void;
  onRegister: () => void;
  onUnregister: () => void;
}) {
  const typeLabel: Record<TrainingSession['session_type'], string> = {
    in_person: t('training.calendar.inPerson'),
    virtual: t('training.calendar.virtual'),
    hybrid: t('training.calendar.hybrid'),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">{session.title}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${sessionTypeColor(session.session_type)}`}>
              {typeLabel[session.session_type]}
            </span>
            {isRegistered && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                {t('training.calendar.registered')}
              </span>
            )}
          </div>
          <div className="flex items-start gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p>{fmtDateTime(session.start_datetime)}</p>
              <p className="text-xs">{t('training.calendar.to')} {fmtDateTime(session.end_datetime)}</p>
            </div>
          </div>
          {session.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span>{session.location}</span>
            </div>
          )}
          {session.meeting_url && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Video className="h-4 w-4 flex-shrink-0" />
              <a href={session.meeting_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate">
                {t('training.calendar.joinMeeting')}
              </a>
            </div>
          )}
          {session.max_participants && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4 flex-shrink-0" />
              <span>{session.registered_count ?? 0} / {session.max_participants} {t('training.calendar.spots')}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-6">
          {isRegistered ? (
            <button
              onClick={() => { onUnregister(); onClose(); }}
              className="flex-1 bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-100"
            >
              {t('training.calendar.unregister')}
            </button>
          ) : (
            <button
              onClick={() => { onRegister(); onClose(); }}
              className="flex-1 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700"
            >
              {t('training.calendar.register')}
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Training Calendar Tab ────────────────────────────────────────────────────

function TrainingCalendarTab({ employeeId }: { employeeId: string }) {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [registrations, setRegistrations] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);

  async function loadData() {
    setLoading(true);
    const { data: sessData } = await supabase
      .from('training_sessions')
      .select('*')
      .order('start_datetime', { ascending: true });
    setSessions((sessData as TrainingSession[]) ?? []);

    const { data: regData } = await supabase
      .from('training_session_registrations')
      .select('session_id')
      .eq('employee_id', employeeId);
    setRegistrations(new Set((regData ?? []).map((r: { session_id: string }) => r.session_id)));
    setLoading(false);
  }

  useEffect(() => { if (employeeId) void loadData(); }, [employeeId]);

  async function handleRegister(sessionId: string) {
    const { error: regErr } = await supabase.from('training_session_registrations').upsert([{
      session_id: sessionId,
      employee_id: employeeId,
      attended: false,
    }]);
    if (regErr) throw new Error(regErr.message);
    setRegistrations((prev) => new Set([...prev, sessionId]));
    toast.success(t('training.calendar.registerSuccess'));
  }

  async function handleUnregister(sessionId: string) {
    const { error: unregErr } = await supabase.from('training_session_registrations')
      .delete()
      .eq('session_id', sessionId)
      .eq('employee_id', employeeId);
    if (unregErr) throw new Error(unregErr.message);
    setRegistrations((prev) => { const s = new Set(prev); s.delete(sessionId); return s; });
    toast.success(t('training.calendar.unregisterSuccess'));
  }

  // Month grid helpers
  function getMonthGrid(date: Date): Date[][] {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay(); // 0=Sun
    const grid: Date[][] = [];
    let week: Date[] = [];
    // Fill leading empty days
    for (let i = 0; i < startOffset; i++) {
      const d = new Date(year, month, 1 - (startOffset - i));
      week.push(d);
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      week.push(new Date(year, month, d));
      if (week.length === 7) { grid.push(week); week = []; }
    }
    // Fill trailing
    if (week.length > 0) {
      while (week.length < 7) {
        week.push(new Date(year, month + 1, week.length - (7 - week.length) + 1));
      }
      grid.push(week);
    }
    return grid;
  }

  function sessionsOnDay(day: Date): TrainingSession[] {
    const dayStr = day.toISOString().slice(0, 10);
    return sessions.filter((s) => s.start_datetime?.slice(0, 10) === dayStr);
  }

  function getWeekDays(date: Date): Date[] {
    const day = date.getDay();
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - day);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      return d;
    });
  }

  const today = new Date();
  const monthGrid = viewMode === 'month' ? getMonthGrid(currentDate) : [];
  const weekDays = viewMode === 'week' ? getWeekDays(currentDate) : [];

  const monthLabel = currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  function navigate(delta: number) {
    if (viewMode === 'month') {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
    } else {
      setCurrentDate((d) => { const n = new Date(d); n.setDate(d.getDate() + delta * 7); return n; });
    }
  }

  if (loading) return <InlineLoader />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-muted border border-border"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="text-sm font-semibold text-foreground min-w-36 text-center">{monthLabel}</h3>
          <button
            onClick={() => navigate(1)}
            className="p-1.5 rounded-lg hover:bg-muted border border-border"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-xs text-indigo-600 hover:text-indigo-800 px-2"
          >
            {t('training.calendar.today')}
          </button>
        </div>
        <div className="flex gap-1 border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 text-xs font-medium ${viewMode === 'month' ? 'bg-indigo-600 text-white' : 'hover:bg-muted text-muted-foreground'}`}
          >
            {t('training.calendar.month')}
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 text-xs font-medium ${viewMode === 'week' ? 'bg-indigo-600 text-white' : 'hover:bg-muted text-muted-foreground'}`}
          >
            {t('training.calendar.week')}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />{t('training.calendar.inPerson')}</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />{t('training.calendar.virtual')}</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />{t('training.calendar.hybrid')}</span>
      </div>

      {/* Month view */}
      {viewMode === 'month' && (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
          </div>
          {/* Weeks */}
          {monthGrid.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
              {week.map((day, di) => {
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isToday = day.toDateString() === today.toDateString();
                const daySessions = sessionsOnDay(day);
                return (
                  <div
                    key={di}
                    className={`min-h-20 p-1.5 border-r border-border last:border-r-0 ${
                      !isCurrentMonth ? 'bg-muted/30' : ''
                    }`}
                  >
                    <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-indigo-600 text-white' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {day.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {daySessions.slice(0, 3).map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedSession(s)}
                          className={`w-full text-left px-1.5 py-0.5 rounded text-xs truncate border ${sessionTypeColor(s.session_type)} hover:opacity-80`}
                        >
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${sessionTypeDot(s.session_type)}`} />
                          {s.title}
                          {registrations.has(s.id) && ' ✓'}
                        </button>
                      ))}
                      {daySessions.length > 3 && (
                        <p className="text-xs text-muted-foreground pl-1">+{daySessions.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Week view */}
      {viewMode === 'week' && (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <div className="grid grid-cols-7 border-b border-border">
            {weekDays.map((day, i) => {
              const isToday = day.toDateString() === today.toDateString();
              return (
                <div key={i} className="py-3 text-center border-r border-border last:border-r-0">
                  <p className="text-xs text-muted-foreground">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i]}</p>
                  <p className={`text-sm font-semibold mt-0.5 mx-auto w-7 h-7 rounded-full flex items-center justify-center ${
                    isToday ? 'bg-indigo-600 text-white' : 'text-foreground'
                  }`}>{day.getDate()}</p>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7 min-h-48">
            {weekDays.map((day, i) => {
              const daySessions = sessionsOnDay(day);
              return (
                <div key={i} className="p-2 border-r border-border last:border-r-0 space-y-1.5">
                  {daySessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSession(s)}
                      className={`w-full text-left p-2 rounded-lg text-xs border ${sessionTypeColor(s.session_type)} hover:opacity-80`}
                    >
                      <p className="font-medium truncate">{s.title}</p>
                      <p className="opacity-70">{new Date(s.start_datetime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                      {registrations.has(s.id) && (
                        <span className="inline-flex items-center gap-0.5 mt-0.5">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {t('training.calendar.registered')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sessions.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{t('training.calendar.noSessions')}</p>
        </div>
      )}

      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          employeeId={employeeId}
          isRegistered={registrations.has(selectedSession.id)}
          onClose={() => setSelectedSession(null)}
          onRegister={() => handleRegister(selectedSession.id)}
          onUnregister={() => handleUnregister(selectedSession.id)}
        />
      )}
    </div>
  );
}

// ─── Gap Analysis Tab ─────────────────────────────────────────────────────────

interface GapRow {
  employeeId: string;
  employeeName: string;
  department: string;
  skills: string[];
  gaps: string[];
  recommendedCourses: string[];
}

function GapAnalysisTab({ courses }: { courses: Course[] }) {
  const [employees, setEmployees] = useState<GapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState('all');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('employees')
        .select('id, name, department, skills')
        .order('name', { ascending: true });

      if (data) {
        const rows: GapRow[] = data.map((emp: { id: string; name: string; department: string; skills: unknown }) => {
          const rawSkills = emp.skills;
          const skills: string[] = Array.isArray(rawSkills)
            ? rawSkills.map(String)
            : typeof rawSkills === 'object' && rawSkills !== null
              ? Object.values(rawSkills as Record<string, unknown>).map(String)
              : [];

          // Determine gaps: course categories not covered by existing skills
          const allCategories = [...new Set(courses.map((c) => c.category))];
          const gaps = allCategories.filter(
            (cat) => !skills.some((sk) => sk.toLowerCase().includes(cat.toLowerCase())),
          );
          const recommendedCourses = courses
            .filter((c) => gaps.includes(c.category))
            .slice(0, 3)
            .map((c) => c.title);

          return {
            employeeId: emp.id,
            employeeName: emp.name,
            department: emp.department ?? '—',
            skills,
            gaps,
            recommendedCourses,
          };
        });
        setEmployees(rows);
      }
      setLoading(false);
    }
    void load();
  }, [courses]);

  const departments = ['all', ...new Set(employees.map((e) => e.department).filter((d) => d !== '—'))];
  const filtered = deptFilter === 'all' ? employees : employees.filter((e) => e.department === deptFilter);

  function handleExport() {
    const header = [
      t('training.gapAnalysis.employee'),
      t('common.department'),
      t('training.gapAnalysis.currentSkills'),
      t('training.gapAnalysis.gap'),
      t('training.gapAnalysis.recommended'),
    ];
    const rows = filtered.map((e) => [
      e.employeeName,
      e.department,
      e.skills.join('; '),
      e.gaps.join('; '),
      e.recommendedCourses.join('; '),
    ]);
    downloadCSV('gap-analysis.csv', [header, ...rows]);
  }

  if (loading) return <InlineLoader />;

  return (
    <div className="space-y-4">
      {/* Filters + export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">{t('training.gapAnalysis.filterDept')}</label>
          <NativeSelect value={deptFilter} onChange={setDeptFilter}>
            {departments.map((d) => (
              <option key={d} value={d}>{d === 'all' ? t('common.all') : d}</option>
            ))}
          </NativeSelect>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100"
        >
          <Download className="h-3.5 w-3.5" />
          {t('training.gapAnalysis.exportCSV')}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BarChart2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{t('training.gapAnalysis.noData')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3 text-left">{t('training.gapAnalysis.employee')}</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">{t('common.department')}</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">{t('training.gapAnalysis.currentSkills')}</th>
                <th className="px-4 py-3 text-left">{t('training.gapAnalysis.gap')}</th>
                <th className="px-4 py-3 text-left">{t('training.gapAnalysis.recommended')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.employeeId} className="border-b border-gray-50 hover:bg-muted">
                  <td className="px-4 py-3 font-medium text-foreground">{row.employeeName}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">{row.department}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {row.skills.length === 0
                        ? <span className="text-xs text-muted-foreground">—</span>
                        : row.skills.slice(0, 3).map((s) => (
                            <Badge key={s} label={s} className="bg-green-50 text-green-700" />
                          ))}
                      {row.skills.length > 3 && <span className="text-xs text-muted-foreground">+{row.skills.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.gaps.length === 0
                        ? <Badge label={t('training.gapAnalysis.noGap')} className="bg-green-50 text-green-700" />
                        : row.gaps.slice(0, 3).map((g) => (
                            <Badge key={g} label={g} className="bg-red-50 text-red-700" />
                          ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      {row.recommendedCourses.length === 0
                        ? <span className="text-xs text-muted-foreground">—</span>
                        : row.recommendedCourses.map((c) => (
                            <span key={c} className="text-xs text-indigo-700">{c}</span>
                          ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Employee Compliance Tab ──────────────────────────────────────────────────

interface EmpComplianceCourseStatus {
  courseId: string;
  title: string;
  status: string;
  progress: number;
  dueDate?: string;
}

interface EmpComplianceRow {
  employeeId: string;
  name: string;
  department: string;
  authUserId: string;
  courseStatuses: EmpComplianceCourseStatus[];
  compliantCount: number;
  overdueCount: number;
  atRiskCount: number;
  totalMandatory: number;
}

type ComplianceFilterChip = 'all' | 'compliant' | 'overdue' | 'atRisk';

function EmployeeComplianceTab({
  courses,
  enrollments,
}: {
  courses: Course[];
  enrollments: Enrollment[];
}) {
  const [employees, setEmployees] = useState<{ id: string; name: string; department: string; auth_user_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [chip, setChip] = useState<ComplianceFilterChip>('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('employees')
        .select('id, name, department, auth_user_id')
        .order('name', { ascending: true });
      setEmployees((data as { id: string; name: string; department: string; auth_user_id: string }[]) ?? []);
      setLoading(false);
    }
    void load();
  }, []);

  const mandatoryCourses = courses.filter((c) => c.mandatory);
  const today = Date.now();

  const rows: EmpComplianceRow[] = employees.map((emp) => {
    const courseStatuses: EmpComplianceCourseStatus[] = mandatoryCourses.map((course) => {
      const enr = enrollments.find((e) => e.courseId === course.id && e.employeeId === emp.id);
      const daysToDeadline = enr?.dueDate ? (new Date(enr.dueDate).getTime() - today) / (24 * 3600 * 1000) : null;
      let status = 'Not Enrolled';
      if (enr) {
        if (enr.progress === 100) status = 'Completed';
        else if (enr.progress > 0) status = 'In Progress';
        else if (enr.dueDate && new Date(enr.dueDate).getTime() < today) status = 'Overdue';
        else status = 'Enrolled';
      }
      return {
        courseId: course.id,
        title: course.title,
        status,
        progress: enr?.progress ?? 0,
        dueDate: enr?.dueDate,
      };
    });

    const compliantCount = courseStatuses.filter((cs) => cs.status === 'Completed').length;
    const overdueCount = courseStatuses.filter((cs) => {
      const enr = enrollments.find((e) => e.courseId === cs.courseId && e.employeeId === emp.id);
      return enr && enr.progress < 100 && enr.dueDate && new Date(enr.dueDate).getTime() < today;
    }).length;
    const atRiskCount = courseStatuses.filter((cs) => {
      const enr = enrollments.find((e) => e.courseId === cs.courseId && e.employeeId === emp.id);
      if (!enr || enr.progress === 100 || !enr.dueDate) return false;
      const days = (new Date(enr.dueDate).getTime() - today) / (24 * 3600 * 1000);
      return days >= 0 && days < 30;
    }).length;

    return {
      employeeId: emp.id,
      name: emp.name,
      department: emp.department ?? '—',
      authUserId: emp.auth_user_id ?? emp.id,
      courseStatuses,
      compliantCount,
      overdueCount,
      atRiskCount,
      totalMandatory: mandatoryCourses.length,
    };
  });

  const departments = ['all', ...new Set(rows.map((r) => r.department).filter((d) => d !== '—'))];

  const filtered = rows.filter((row) => {
    if (deptFilter !== 'all' && row.department !== deptFilter) return false;
    if (chip === 'compliant') return row.compliantCount === row.totalMandatory && row.totalMandatory > 0;
    if (chip === 'overdue') return row.overdueCount > 0;
    if (chip === 'atRisk') return row.atRiskCount > 0;
    return true;
  });

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function sendReminder(row: EmpComplianceRow, course: EmpComplianceCourseStatus) {
    const { error: notifErr } = await supabase.from('notifications').insert([{
      user_id: row.authUserId,
      title: 'Training Reminder',
      body: `You have an overdue mandatory training: ${course.title}. Please complete it by ${course.dueDate ? fmtDate(course.dueDate) : 'the deadline'}.`,
      type: 'warning',
      app_filter: 'training',
      is_read: false,
    }]);
    if (notifErr) throw new Error(notifErr.message);
    toast.success(t('training.reminderSent').replace('{name}', row.name));
  }

  async function sendBulkReminders() {
    const selectedRows = filtered.filter((r) => checked.has(r.employeeId));
    for (const row of selectedRows) {
      const overdueCourses = row.courseStatuses.filter((cs) => cs.status === 'Overdue' || cs.progress < 100);
      for (const course of overdueCourses) {
        const { error: bulkNotifErr } = await supabase.from('notifications').insert([{
          user_id: row.authUserId,
          title: 'Training Reminder',
          body: `You have an overdue mandatory training: ${course.title}. Please complete it by ${course.dueDate ? fmtDate(course.dueDate) : 'the deadline'}.`,
          type: 'warning',
          app_filter: 'training',
          is_read: false,
        }]);
        if (bulkNotifErr) throw new Error(bulkNotifErr.message);
      }
    }
    toast.success(t('training.bulkReminderSent').replace('{n}', String(selectedRows.length)));
    setChecked(new Set());
  }

  function courseStatusColor(status: string) {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      case 'Overdue': return 'bg-red-100 text-red-800';
      case 'Enrolled': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  if (loading) return <InlineLoader />;

  const chips: { key: ComplianceFilterChip; label: string }[] = [
    { key: 'all', label: t('training.allCompliant') },
    { key: 'compliant', label: t('training.compliant') },
    { key: 'overdue', label: t('training.overdue') },
    { key: 'atRisk', label: t('training.atRisk') },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setChip(c.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                chip === c.key ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground hover:bg-gray-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {/* Department filter */}
        <div className="relative">
          <select
            className="appearance-none border border-border rounded-lg px-3 py-1.5 pr-7 text-xs bg-card"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            {departments.map((d) => (
              <option key={d} value={d}>{d === 'all' ? t('common.all') + ' Departments' : d}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>
        {/* Bulk send button */}
        {checked.size > 0 && (
          <button
            onClick={sendBulkReminders}
            className="ml-auto flex items-center gap-1.5 bg-amber-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-amber-700"
          >
            {t('training.sendBulkReminder').replace('{n}', String(checked.size))}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{t('common.noResults')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-3 py-3 text-left w-8"></th>
                <th className="px-4 py-3 text-left">{t('common.name')}</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">{t('common.department')}</th>
                <th className="px-4 py-3 text-center">Compliant</th>
                <th className="px-4 py-3 text-center hidden md:table-cell">Overdue</th>
                <th className="px-4 py-3 text-center hidden md:table-cell">At Risk</th>
                <th className="px-4 py-3 text-left">{t('common.status')}</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const isExpanded = expanded.has(row.employeeId);
                const isChecked = checked.has(row.employeeId);
                const allCompliant = row.compliantCount === row.totalMandatory && row.totalMandatory > 0;
                const statusLabel = allCompliant ? t('training.compliant') : row.overdueCount > 0 ? t('training.overdue') : row.atRiskCount > 0 ? t('training.atRisk') : 'Incomplete';
                const statusCls = allCompliant ? 'bg-green-100 text-green-800' : row.overdueCount > 0 ? 'bg-red-100 text-red-800' : row.atRiskCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600';

                return (
                  <>
                    <tr key={row.employeeId} className="border-b border-gray-50 hover:bg-muted">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCheck(row.employeeId)}
                          className="accent-indigo-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">{row.department}</td>
                      <td className="px-4 py-3 text-center text-xs tabular-nums">
                        <span className="text-green-700 font-medium">{row.compliantCount}</span>/{row.totalMandatory}
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        {row.overdueCount > 0 ? (
                          <span className="text-red-600 font-medium text-xs">{row.overdueCount}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        {row.atRiskCount > 0 ? (
                          <span className="text-amber-600 font-medium text-xs">{row.atRiskCount}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge label={statusLabel} className={statusCls} />
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => toggleExpand(row.employeeId)}
                          className="p-1 text-muted-foreground hover:text-foreground"
                          title="Expand courses"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${row.employeeId}-expand`} className="bg-indigo-50/40">
                        <td colSpan={8} className="px-6 py-3">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground uppercase tracking-wide">
                                <th className="py-1.5 text-left pr-4">Course</th>
                                <th className="py-1.5 text-left pr-4">Status</th>
                                <th className="py-1.5 text-left pr-4">Progress</th>
                                <th className="py-1.5 text-left pr-4">Due</th>
                                <th className="py-1.5 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.courseStatuses.map((cs) => (
                                <tr key={cs.courseId} className="border-t border-indigo-100">
                                  <td className="py-1.5 pr-4 font-medium text-foreground">{cs.title}</td>
                                  <td className="py-1.5 pr-4">
                                    <Badge label={cs.status} className={courseStatusColor(cs.status)} />
                                  </td>
                                  <td className="py-1.5 pr-4 w-24">
                                    <ProgressBar value={cs.progress} />
                                  </td>
                                  <td className="py-1.5 pr-4 text-muted-foreground">{cs.dueDate ? fmtDate(cs.dueDate) : '—'}</td>
                                  <td className="py-1.5 text-right">
                                    {cs.status !== 'Completed' && (
                                      <button
                                        onClick={() => sendReminder(row, cs)}
                                        className="px-2 py-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100"
                                      >
                                        {t('training.sendReminder')}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Certificates Tab ─────────────────────────────────────────────────────────

interface OrgCertRow extends DbCertificate {
  employee_name?: string;
  employee_department?: string;
  employee_auth_user_id?: string;
}

function CertificatesTab({
  employeeId,
  canEnrollInCourse,
  isManagerView,
}: {
  employeeId: string;
  canEnrollInCourse: (courseId: string) => void;
  isManagerView: boolean;
}) {
  const [certs, setCerts] = useState<OrgCertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState('all');

  useEffect(() => {
    async function load() {
      if (isManagerView) {
        const { data } = await supabase
          .from('training_certificates')
          .select('*, training_courses(title), employees(name, department, auth_user_id)')
          .order('issued_at', { ascending: false });
        const mapped = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
          ...(row as DbCertificate),
          employee_name: (row.employees as { name: string } | null)?.name,
          employee_department: (row.employees as { department: string } | null)?.department,
          employee_auth_user_id: (row.employees as { auth_user_id: string } | null)?.auth_user_id,
        }));
        setCerts(mapped);
      } else {
        const { data } = await supabase
          .from('training_certificates')
          .select('*, training_courses(title)')
          .eq('employee_id', employeeId)
          .order('issued_at', { ascending: false });
        setCerts((data as OrgCertRow[]) ?? []);
      }
      setLoading(false);
    }
    void load();
  }, [employeeId, isManagerView]);

  if (loading) return <InlineLoader />;

  if (!isManagerView) {
    // Personal view
    if (certs.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Award className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{t('training.certificates.none')}</p>
        </div>
      );
    }
    return (
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
              <th className="px-4 py-3 text-left">{t('training.certificate')}</th>
              <th className="px-4 py-3 text-left hidden sm:table-cell">{t('training.completionDate')}</th>
              <th className="px-4 py-3 text-left">{t('training.certExpiry.expiryDate')}</th>
              <th className="px-4 py-3 text-left">{t('common.status')}</th>
              <th className="px-4 py-3 text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {certs.map((cert) => {
              const color = certExpiryColor(cert.expiry_date, cert.issued_at);
              const label = certExpiryLabel(cert.expiry_date, cert.issued_at);
              const isExpiringSoon = cert.expiry_date
                ? new Date(cert.expiry_date).getTime() < Date.now() + 30 * 24 * 3600 * 1000
                : isCertExpiringSoon(cert.issued_at);
              return (
                <tr key={cert.id} className="border-b border-gray-50 hover:bg-muted">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {cert.training_courses?.title ?? cert.course_id}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">
                    {fmtDate(cert.issued_at)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <Badge label={label} className={color} />
                  </td>
                  <td className="px-4 py-3">
                    {isExpiringSoon ? (
                      <Badge label={t('training.certExpiry.expiringSoon')} className="bg-amber-100 text-amber-800" />
                    ) : (
                      <Badge label={t('training.certExpiry.valid')} className="bg-green-100 text-green-800" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {cert.renewal_course_id && (
                      <button
                        onClick={() => canEnrollInCourse(cert.renewal_course_id!)}
                        className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100"
                      >
                        {t('training.certExpiry.enrollRenewal')}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Org-wide manager view
  const departments = ['all', ...new Set(certs.map((c) => c.employee_department ?? '—').filter((d) => d !== '—'))];
  const filtered = deptFilter === 'all' ? certs : certs.filter((c) => c.employee_department === deptFilter);

  const now = Date.now();
  const totalTracked = filtered.length;
  const expiring30 = filtered.filter((c) => {
    const exp = c.expiry_date ? new Date(c.expiry_date).getTime() : certExpiresAt(c.issued_at);
    return exp > now && exp < now + 30 * 24 * 3600 * 1000;
  }).length;
  const expired = filtered.filter((c) => {
    const exp = c.expiry_date ? new Date(c.expiry_date).getTime() : certExpiresAt(c.issued_at);
    return exp < now;
  }).length;
  const compliantPct = totalTracked > 0 ? Math.round(((totalTracked - expired) / totalTracked) * 100) : 100;

  function certStatusLabel(cert: OrgCertRow): { label: string; cls: string } {
    const exp = cert.expiry_date ? new Date(cert.expiry_date).getTime() : certExpiresAt(cert.issued_at);
    const days = (exp - now) / (24 * 3600 * 1000);
    if (days < 0) return { label: 'Expired', cls: 'bg-red-100 text-red-800' };
    if (days < 30) return { label: 'Critical', cls: 'bg-red-100 text-red-700' };
    if (days < 90) return { label: 'Expiring Soon', cls: 'bg-amber-100 text-amber-800' };
    return { label: 'Valid', cls: 'bg-green-100 text-green-800' };
  }

  async function sendRenewalReminder(cert: OrgCertRow) {
    const authId = cert.employee_auth_user_id ?? cert.employee_id;
    const courseName = cert.training_courses?.title ?? cert.course_id;
    const { error: renewErr } = await supabase.from('notifications').insert([{
      user_id: authId,
      title: 'Certificate Renewal Reminder',
      body: `Your certificate for "${courseName}" is expiring soon. Please renew it.`,
      type: 'warning',
      app_filter: 'training',
      is_read: false,
    }]);
    if (renewErr) throw new Error(renewErr.message);
    toast.success(t('training.reminderSent').replace('{name}', cert.employee_name ?? 'employee'));
  }

  function handleExportCSV() {
    const header = ['Employee', 'Department', 'Certificate', 'Issued', 'Expiry', 'Status'];
    const rows = filtered.map((c) => {
      const { label } = certStatusLabel(c);
      return [
        c.employee_name ?? c.employee_id,
        c.employee_department ?? '—',
        c.training_courses?.title ?? c.course_id,
        fmtDate(c.issued_at),
        c.expiry_date ? fmtDate(c.expiry_date) : fmtDate(new Date(certExpiresAt(c.issued_at)).toISOString()),
        label,
      ];
    });
    downloadCSV('org-certificates.csv', [header, ...rows]);
  }

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<Award className="h-8 w-8" />} label="Total Tracked" value={totalTracked} />
        <StatCard icon={<AlertCircle className="h-8 w-8 text-amber-500" />} label="Expiring (30d)" value={expiring30} />
        <StatCard icon={<AlertCircle className="h-8 w-8 text-red-500" />} label="Expired" value={expired} />
        <StatCard icon={<CheckCircle2 className="h-8 w-8 text-green-500" />} label="Compliant %" value={`${compliantPct}%`} />
      </div>

      {/* Filters + export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">{t('common.department')}</label>
          <div className="relative">
            <select
              className="appearance-none border border-border rounded-lg px-3 py-1.5 pr-7 text-xs bg-card"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d} value={d}>{d === 'all' ? t('common.all') : d}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          </div>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100"
        >
          <Download className="h-3.5 w-3.5" />
          CSV Export
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Award className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{t('training.certificates.none')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">{t('training.certificate')}</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">{t('training.completionDate')}</th>
                <th className="px-4 py-3 text-left">Expiry</th>
                <th className="px-4 py-3 text-left">{t('common.status')}</th>
                <th className="px-4 py-3 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cert) => {
                const { label, cls } = certStatusLabel(cert);
                const isExpiring = label === 'Critical' || label === 'Expiring Soon' || label === 'Expired';
                return (
                  <tr key={cert.id} className="border-b border-gray-50 hover:bg-muted">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {cert.employee_name ?? cert.employee_id}
                      {cert.employee_department && (
                        <span className="ml-1 text-xs text-muted-foreground">({cert.employee_department})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">
                      {cert.training_courses?.title ?? cert.course_id}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                      {fmtDate(cert.issued_at)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {cert.expiry_date
                        ? fmtDate(cert.expiry_date)
                        : fmtDate(new Date(certExpiresAt(cert.issued_at)).toISOString())}
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={label} className={cls} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isExpiring && (
                        <button
                          onClick={() => sendRenewalReminder(cert)}
                          className="text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg hover:bg-amber-100 border border-amber-200"
                        >
                          Send Renewal Reminder
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Request Training Modal ───────────────────────────────────────────────────

function RequestTrainingModal({
  employeeId,
  onClose,
  onSubmitted,
}: {
  employeeId: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [courseName, setCourseName] = useState('');
  const [category, setCategory] = useState(COURSE_CATEGORIES[0]);
  const [justification, setJustification] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    const e: Record<string, string> = {};
    if (!courseName.trim()) e.courseName = t('training.needs.courseNameRequired');
    if (!justification.trim()) e.justification = t('training.needs.justificationRequired');
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSaving(true);
    try {
      const { error: needsErr } = await supabase.from('training_needs').insert([{
        employee_id: employeeId,
        course_name: courseName,
        category,
        justification,
        estimated_cost: estimatedCost ? Number(estimatedCost) : null,
        status: 'pending',
      }]);
      if (needsErr) throw new Error(needsErr.message);
      toast.success(t('training.needs.submitted'));
      onSubmitted();
      onClose();
    } catch {
      // error already toasted
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">{t('training.needs.requestTitle')}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-4">
          <Field label={t('training.needs.courseName') + ' *'}>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
            />
            {errors.courseName && <p className="text-xs text-red-500 mt-0.5">{errors.courseName}</p>}
          </Field>
          <Field label={t('training.needs.category')}>
            <NativeSelect value={category} onChange={setCategory}>
              {COURSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </NativeSelect>
          </Field>
          <Field label={t('training.needs.justification') + ' *'}>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none"
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
            {errors.justification && <p className="text-xs text-red-500 mt-0.5">{errors.justification}</p>}
          </Field>
          <Field label={t('training.needs.estimatedCost')}>
            <input
              type="number"
              min={0}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? t('common.loading') : t('common.submit')}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Training Needs Queue ─────────────────────────────────────────────────────

function TrainingNeedsQueue({ managerId, isManager: isMgr }: { managerId: string; isManager: boolean }) {
  const [needs, setNeeds] = useState<TrainingNeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  async function loadNeeds() {
    const query = supabase.from('training_needs').select('*').order('created_at', { ascending: false });
    if (!isMgr) query.eq('employee_id', managerId);
    const { data } = await query;
    setNeeds((data as TrainingNeed[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void loadNeeds(); }, [managerId, isMgr]);

  async function handleApprove(id: string) {
    const { error: approveErr } = await supabase.from('training_needs').update({ status: 'approved', approved_by: managerId }).eq('id', id);
    if (approveErr) throw new Error(approveErr.message);
    setNeeds((prev) => prev.map((n) => n.id === id ? { ...n, status: 'approved', approved_by: managerId } : n));
    toast.success(t('training.needs.approvedSuccess'));
  }

  async function handleReject(id: string) {
    const { error: rejectErr } = await supabase.from('training_needs').update({ status: 'rejected', approved_by: managerId }).eq('id', id);
    if (rejectErr) throw new Error(rejectErr.message);
    setNeeds((prev) => prev.map((n) => n.id === id ? { ...n, status: 'rejected' } : n));
    toast.success(t('training.needs.rejectedSuccess'));
  }

  const filtered = statusFilter === 'all' ? needs : needs.filter((n) => n.status === statusFilter);

  const needStatusColor: Record<TrainingNeed['status'], string> = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };

  if (loading) return <InlineLoader />;

  return (
    <div className="space-y-4 mt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {isMgr ? t('training.needs.managerQueue') : t('training.needs.myRequests')}
        </h3>
        <div className="flex gap-1 border border-border rounded-lg overflow-hidden">
          {(['pending','approved','rejected','all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 text-xs font-medium ${statusFilter === s ? 'bg-indigo-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
            >
              {s === 'all' ? t('common.all') : t(`training.needs.${s}`)}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
          {t('training.needs.noRequests')}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((need) => (
            <div key={need.id} className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-foreground text-sm truncate">{need.course_name}</p>
                    <Badge label={need.status} className={needStatusColor[need.status]} />
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge label={need.category} className={categoryColor(need.category)} />
                    {need.estimated_cost && (
                      <span className="flex items-center gap-1">
                        {t('training.needs.estimatedCost')}: ${need.estimated_cost.toLocaleString()}
                      </span>
                    )}
                    {need.created_at && <span>{fmtDate(need.created_at)}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{need.justification}</p>
                </div>
                {isMgr && need.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(need.id)}
                      className="px-2.5 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100"
                    >
                      {t('training.needs.approve')}
                    </button>
                    <button
                      onClick={() => handleReject(need.id)}
                      className="px-2.5 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100"
                    >
                      {t('training.needs.reject')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function TrainingTrackerEnhanced({
  accessToken,
  onLogout,
}: {
  accessToken: string;
  onLogout: () => void;
}) {
  const { currentUser } = useUser();
  const roles: string[] = currentUser?.roles ?? [];
  const userId = currentUser?.id ?? '';
  const employeeId = currentUser?.employeeId ?? userId;
  const isEmployee = !isHRAdmin(roles) && !isManager(roles);

  const {
    courses,
    enrollments,
    certificates,
    loading,
    error,
    loadAll,
    createCourse,
    updateCourse,
    deleteCourse,
    enrollEmployee,
    updateProgress,
    unenroll,
    issueCertificate,
  } = useTrainingData();

  type TabKey = 'my-training' | 'catalogue' | 'learning-paths' | 'certificates' | 'calendar' | 'gap-analysis' | 'team' | 'compliance' | 'training-needs';

  const [activeTab, setActiveTab] = useState<TabKey>('my-training');
  const [showRequestTraining, setShowRequestTraining] = useState(false);
  const [_needsRefreshTick, setNeedsRefreshTick] = useState(0);

  // Catalogue filters
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');

  // Team filters
  const [teamEmpFilter, setTeamEmpFilter] = useState('');
  const [teamCatFilter, setTeamCatFilter] = useState('all');
  const [teamStatusFilter, setTeamStatusFilter] = useState('all');

  // Modals
  const [progressEnrollment, setProgressEnrollment] = useState<Enrollment | null>(null);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [showEnrollTeam, setShowEnrollTeam] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmUnenroll, setConfirmUnenroll] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    loadAll(isEmployee ? userId : undefined);
  }, [userId]);

  const myEnrollments = enrollments.filter((e) =>
    isEmployee ? e.employeeId === userId : true,
  );
  const myCompleted = myEnrollments.filter((e) => e.status === 'Completed');
  const myCerts = certificates.filter((c) =>
    isEmployee ? c.employeeId === userId : true,
  );

  const filteredCourses = courses.filter((c) => {
    const matchSearch =
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.instructor.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'all' || c.category === catFilter;
    return matchSearch && matchCat;
  });

  const teamEnrollments = enrollments.filter((e) => {
    const matchEmp = !teamEmpFilter || e.employeeName.toLowerCase().includes(teamEmpFilter.toLowerCase());
    const matchStatus = teamStatusFilter === 'all' || e.status === teamStatusFilter;
    const course = courses.find((c) => c.id === e.courseId);
    const matchCat = teamCatFilter === 'all' || course?.category === teamCatFilter;
    return matchEmp && matchStatus && matchCat;
  });

  const handleUpdateProgress = useCallback(
    async (enrollmentId: string, progress: number) => {
      try {
        const updated = await updateProgress(enrollmentId, progress);
        toast.success(t('common.success'));
        if (progress === 100) {
          try {
            await issueCertificate(enrollmentId);
            toast.success(t('training.certificate') + ' issued!');
          } catch {
            // certificate issuance might already be done server-side
          }
        }
        return updated;
      } catch (err: unknown) {
        toast.error((err as Error).message ?? t('common.error'));
        throw err;
      }
    },
    [updateProgress, issueCertificate],
  );

  const handleUnenroll = useCallback(
    async (enrollmentId: string) => {
      try {
        await unenroll(enrollmentId);
        toast.success(t('training.unenroll'));
      } catch (err: unknown) {
        toast.error((err as Error).message ?? t('common.error'));
      }
    },
    [unenroll],
  );

  const handleDeleteCourse = useCallback(
    async (courseId: string) => {
      try {
        const deletedCourse = courses.find(c => c.id === courseId);
        await deleteCourse(courseId);
        if (deletedCourse) {
          const { id: _id, ...restCourse } = deletedCourse;
          toast(t('training.confirmDelete'), {
            action: {
              label: 'Undo',
              onClick: async () => {
                try {
                  await fetch(`${API_BASE}/training/courses`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(restCourse),
                  });
                  await loadAll();
                  toast.success(t('common.success'));
                } catch {
                  toast.error(t('common.error'));
                }
              },
            },
            duration: 5000,
          });
        }
      } catch (err: unknown) {
        toast.error((err as Error).message ?? t('common.error'));
      }
    },
    [deleteCourse, courses, loadAll],
  );

  const handleEnroll = useCallback(
    async (courseId: string) => {
      if (!currentUser) return;
      try {
        await enrollEmployee(courseId, userId, currentUser.name);
        toast.success(t('training.enroll'));
      } catch (err: unknown) {
        toast.error((err as Error).message ?? t('common.error'));
      }
    },
    [enrollEmployee, userId, currentUser],
  );

  const handleEnrollTeam = useCallback(
    async (courseId: string, employeeName: string, _mandatory: boolean, _dueDate: string) => {
      try {
        await enrollEmployee(courseId, `team-${Date.now()}`, employeeName);
        toast.success(`${employeeName} ${t('training.enroll').toLowerCase()}`);
      } catch (err: unknown) {
        toast.error((err as Error).message ?? t('common.error'));
      }
    },
    [enrollEmployee],
  );

  const isEnrolled = (courseId: string) =>
    enrollments.some((e) => e.courseId === courseId && e.employeeId === userId);

  // Expiring certificates
  const expiringCerts: ExpiringCert[] = (isEmployee ? myCerts : certificates)
    .filter((c) => isCertExpiringSoon(c.createdAt))
    .map((c) => ({
      id: c.id,
      employeeName: c.employeeName,
      courseName: c.courseName,
      courseId: c.courseId,
      expiresAt: certExpiresAt(c.createdAt),
    }));

  function handleRenew(courseId: string) {
    setActiveTab('catalogue');
    toast.info(t('training.expiry.renew'));
  }

  const completionByCourse = courses.map((c) => {
    const enrolled = enrollments.filter((e) => e.courseId === c.id);
    const completed = enrolled.filter((e) => e.status === 'Completed');
    return { course: c, enrolled: enrolled.length, completed: completed.length };
  }).filter((r) => r.enrolled > 0);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'my-training', label: t('training.myTraining') },
    { key: 'catalogue', label: t('training.catalogue') },
    { key: 'learning-paths', label: t('training.learningPath.tab') },
    { key: 'certificates', label: t('training.certificates.tab') },
    { key: 'calendar', label: t('training.calendar.tab') },
    ...(canSeeCompliance(roles) ? [{ key: 'gap-analysis' as TabKey, label: t('training.gapAnalysis.tab') }] : []),
    ...(canSeeTeam(roles) ? [{ key: 'team' as TabKey, label: t('training.teamOverview') }] : []),
    ...(canSeeCompliance(roles) ? [{ key: 'compliance' as TabKey, label: t('training.compliance.tab') }] : []),
    { key: 'training-needs', label: t('training.needs.tab') },
  ];

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-6 w-6 text-indigo-600" />
            <span className="font-semibold text-foreground">{t('training.title')}</span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
              {currentUser?.primaryRole ?? 'Employee'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRequestTraining(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 border border-indigo-200"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('training.needs.request')}</span>
            </button>
            {canManageCourses(roles) && (
              <button
                onClick={() => { setEditCourse(null); setShowCourseForm(true); }}
                className="flex items-center gap-1.5 bg-indigo-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-indigo-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('training.addCourse')}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            icon={<BookOpen className="h-8 w-8" />}
            label={t('training.catalogue')}
            value={courses.length}
          />
          <StatCard
            icon={<Users className="h-8 w-8" />}
            label={t('training.myTraining')}
            value={myEnrollments.length}
            sub={`${myCompleted.length} ${t('training.completionDate').toLowerCase()}`}
          />
          <StatCard
            icon={<CheckCircle2 className="h-8 w-8 text-green-500" />}
            label={t('training.completionDate')}
            value={myCompleted.length}
          />
          <StatCard
            icon={<Award className="h-8 w-8 text-yellow-500" />}
            label={t('training.certificate')}
            value={myCerts.length}
          />
        </div>

        {/* Tabs */}
        <div className="border-b border-border flex gap-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── My Training ── */}
        {activeTab === 'my-training' && (
          <div className="space-y-4">
            <ExpiringCertsBanner
              expiring={expiringCerts}
              isManagerView={false}
              onRenew={handleRenew}
            />
            {loading ? (
              <InlineLoader />
            ) : myEnrollments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>{t('training.noEnrollments')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">{t('training.courseForm.labelTitle')}</th>
                      <th className="px-4 py-3 text-left hidden sm:table-cell">{t('training.courseForm.labelCategory')}</th>
                      <th className="px-4 py-3 text-left">{t('training.progress')}</th>
                      <th className="px-4 py-3 text-left">{t('common.status')}</th>
                      <th className="px-4 py-3 text-left hidden md:table-cell">{t('common.date')}</th>
                      <th className="px-4 py-3 text-right">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myEnrollments.map((e) => {
                      const course = courses.find((c) => c.id === e.courseId);
                      return (
                        <tr key={e.id} className="group border-b border-gray-50 hover:bg-muted">
                          <td className="px-4 py-3 font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              {e.mandatory && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" title={t('training.mandatory')} />
                              )}
                              {e.courseName}
                              {e.mandatory && (
                                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700">
                                  {t('training.mandatory')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            {course && (
                              <Badge label={course.category} className={categoryColor(course.category)} />
                            )}
                          </td>
                          <td className="px-4 py-3 w-36">
                            <ProgressBar value={e.progress} />
                          </td>
                          <td className="px-4 py-3">
                            <Badge label={e.status} className={statusColor(e.status)} />
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                            {fmtDate(e.dueDate)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                title={t('training.updateProgress')}
                                onClick={() => setProgressEnrollment(e)}
                                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-indigo-600"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              {e.status === 'Completed' && (
                                <button
                                  title={t('training.certificate')}
                                  onClick={() => {
                                    const cert = certificates.find(
                                      (c) => c.courseId === e.courseId && c.employeeId === e.employeeId,
                                    );
                                    if (cert?.certificateUrl) {
                                      window.open(cert.certificateUrl, '_blank');
                                    } else {
                                      toast.info(t('training.certificate'));
                                    }
                                  }}
                                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-green-600"
                                >
                                  <Award className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                title={t('training.unenroll')}
                                onClick={() => setConfirmUnenroll(e.id)}
                                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Course Catalogue ── */}
        {activeTab === 'catalogue' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="border border-border rounded-lg px-3 py-2 text-sm w-56"
                placeholder={t('common.search') + '…'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setCatFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    catFilter === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-gray-200'
                  }`}
                >
                  {t('common.all')}
                </button>
                {COURSE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCatFilter(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      catFilter === cat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <InlineLoader />
            ) : filteredCourses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">{t('training.noCourses')}</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCourses.map((course) => {
                  const enrolled = isEnrolled(course.id);
                  return (
                    <div
                      key={course.id}
                      className="group bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow flex flex-col gap-3"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-foreground text-sm leading-snug flex-1">
                            {course.title}
                          </h3>
                          {course.mandatory && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700 whitespace-nowrap">
                              {t('training.mandatory')}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          <Badge label={course.category} className={categoryColor(course.category)} />
                          <Badge label={course.level} className="bg-muted text-muted-foreground" />
                          <Badge label={course.mode} className="bg-slate-100 text-slate-600" />
                        </div>
                        {course.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{course.description}</p>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {course.duration}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3 w-3" />
                          {course.instructor} · {course.enrolledCount ?? 0} {t('training.enroll').toLowerCase()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border">
                        {enrolled ? (
                          <span className="flex items-center gap-1 text-green-700 text-xs font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t('training.enroll')}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleEnroll(course.id)}
                            className="text-xs font-medium bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                          >
                            {t('training.enroll')}
                          </button>
                        )}
                        {canManageCourses(roles) && (
                          <div className="ml-auto flex gap-1 sm:opacity-0 group-hover:opacity-100">
                            <button
                              onClick={() => { setEditCourse(course); setShowCourseForm(true); }}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-indigo-600"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(course.id)}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Learning Paths ── */}
        {activeTab === 'learning-paths' && (
          <LearningPathsTab
            courses={courses}
            employeeId={employeeId}
            canManage={canManageCourses(roles) || isManager(roles)}
          />
        )}

        {/* ── Certificates ── */}
        {activeTab === 'certificates' && (
          <CertificatesTab
            employeeId={employeeId}
            isManagerView={!isEmployee}
            canEnrollInCourse={(courseId) => {
              void handleEnroll(courseId);
              toast.info(t('training.enroll'));
            }}
          />
        )}

        {/* ── Training Calendar ── */}
        {activeTab === 'calendar' && (
          <TrainingCalendarTab employeeId={employeeId} />
        )}

        {/* ── Gap Analysis ── */}
        {activeTab === 'gap-analysis' && canSeeCompliance(roles) && (
          <GapAnalysisTab courses={courses} />
        )}

        {/* ── Team Overview ── */}
        {activeTab === 'team' && canSeeTeam(roles) && (
          <div className="space-y-6">
            <ExpiringCertsBanner
              expiring={expiringCerts}
              isManagerView={true}
              onRenew={handleRenew}
            />
            <div className="flex flex-wrap gap-2 items-center">
              <input
                className="border border-border rounded-lg px-3 py-2 text-sm w-44"
                placeholder={t('training.teamOverview') + '…'}
                value={teamEmpFilter}
                onChange={(e) => setTeamEmpFilter(e.target.value)}
              />
              <div className="relative">
                <select
                  className="appearance-none border border-border rounded-lg px-3 py-2 pr-8 text-sm bg-card"
                  value={teamCatFilter}
                  onChange={(e) => setTeamCatFilter(e.target.value)}
                >
                  <option value="all">{t('common.all')} {t('training.courseForm.labelCategory')}</option>
                  <SelectOptions entity="training" field="category" fallback={['Technical','Soft Skills','Compliance','Leadership','Product']} />
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  className="appearance-none border border-border rounded-lg px-3 py-2 pr-8 text-sm bg-card"
                  value={teamStatusFilter}
                  onChange={(e) => setTeamStatusFilter(e.target.value)}
                >
                  <option value="all">{t('common.all')} {t('common.status')}</option>
                  <SelectOptions entity="training" field="status" fallback={['Not Started','In Progress','Completed','Failed']} />
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              </div>
              <button
                onClick={() => setShowEnrollTeam(true)}
                className="ml-auto flex items-center gap-1.5 bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-indigo-700"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('training.enrollTeam')}
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">{t('training.enroll.labelEmployee')}</th>
                    <th className="px-4 py-3 text-left">{t('training.courseForm.labelTitle')}</th>
                    <th className="px-4 py-3 text-left">{t('training.progress')}</th>
                    <th className="px-4 py-3 text-left">{t('common.status')}</th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">{t('training.mandatory')}</th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">{t('common.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {teamEnrollments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        {t('common.noResults')}
                      </td>
                    </tr>
                  ) : (
                    teamEnrollments.map((e) => (
                      <tr key={e.id} className="border-b border-gray-50 hover:bg-muted">
                        <td className="px-4 py-3 font-medium text-foreground">{e.employeeName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{e.courseName}</td>
                        <td className="px-4 py-3 w-36"><ProgressBar value={e.progress} /></td>
                        <td className="px-4 py-3">
                          <Badge label={e.status} className={statusColor(e.status)} />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {e.mandatory ? (
                            <span className="text-orange-600 font-medium text-xs">{t('common.yes')}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">{t('common.no')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                          {fmtDate(e.dueDate)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {completionByCourse.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">{t('training.compliance.completionRate')}</h3>
                <div className="space-y-2">
                  {completionByCourse.map(({ course, enrolled: total, completed }) => {
                    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                    return (
                      <div key={course.id} className="flex items-center gap-3">
                        <span className="text-sm text-foreground w-48 truncate">{course.title}</span>
                        <div className="flex-1">
                          <ProgressBar value={pct} />
                        </div>
                        <span className="text-xs text-muted-foreground w-20 text-right">
                          {completed}/{total}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Compliance Report ── */}
        {activeTab === 'compliance' && canSeeCompliance(roles) && (
          <div className="space-y-8">
            <EmployeeComplianceTab courses={courses} enrollments={enrollments} />
            <ComplianceReport courses={courses} enrollments={enrollments} />
          </div>
        )}

        {/* ── Training Needs ── */}
        {activeTab === 'training-needs' && (
          <TrainingNeedsQueue
            managerId={employeeId}
            isManager={canSeeTeam(roles)}
          />
        )}
      </main>

      {/* ── Modals ── */}
      {progressEnrollment && (
        <UpdateProgressModal
          enrollment={progressEnrollment}
          onClose={() => setProgressEnrollment(null)}
          onSave={handleUpdateProgress}
        />
      )}

      {showCourseForm && (
        <CourseFormModal
          initial={editCourse ? {
            title: editCourse.title,
            description: editCourse.description,
            category: editCourse.category,
            level: editCourse.level,
            mode: editCourse.mode,
            duration: editCourse.duration,
            instructor: editCourse.instructor,
            mandatory: editCourse.mandatory,
          } : undefined}
          onClose={() => { setShowCourseForm(false); setEditCourse(null); }}
          onSave={async (data) => {
            if (editCourse) {
              await updateCourse(editCourse.id, data);
              toast.success(t('common.success'));
            } else {
              await createCourse(data);
              toast.success(t('common.success'));
            }
          }}
        />
      )}

      {showEnrollTeam && (
        <EnrollTeamModal
          courses={courses}
          onClose={() => setShowEnrollTeam(false)}
          onSave={handleEnrollTeam}
        />
      )}

      {showRequestTraining && (
        <RequestTrainingModal
          employeeId={employeeId}
          onClose={() => setShowRequestTraining(false)}
          onSubmitted={() => setNeedsRefreshTick((n) => n + 1)}
        />
      )}

      {/* Confirm delete course */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-foreground mb-2">{t('training.addCourse')}</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {t('training.confirmDelete')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await handleDeleteCourse(confirmDelete);
                  setConfirmDelete(null);
                }}
                className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700"
              >
                {t('common.delete')}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm unenroll */}
      {confirmUnenroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-foreground mb-2">{t('training.unenroll')}</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {t('training.confirmUnenroll')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await handleUnenroll(confirmUnenroll);
                  setConfirmUnenroll(null);
                }}
                className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700"
              >
                {t('training.unenroll')}
              </button>
              <button
                onClick={() => setConfirmUnenroll(null)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TrainingTrackerEnhanced;
