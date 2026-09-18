/**
 * OnboardingPortalDB — full rewrite with RBAC, Kanban/List views, modals.
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Users, Plus, CheckSquare, Edit2, Trash2, Eye,
  UserCheck, RefreshCw, LayoutList, Columns, AlertTriangle,
  X, Check, ChevronRight, Upload, FileText, Gift, ShieldCheck,
  ChevronDown, Briefcase, Loader2, Search,
  LogOut, Calendar, DollarSign, ClipboardList, UserMinus,
  Kanban, MessageSquare, Clock, Download, Table2, CheckCircle2, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '../../context/UserContext';
import { useSectionPermission } from '../SectionGuard';
import {
  useOnboardingData,
  OnboardingCandidate,
  ChecklistItem,
  DocumentItem,
} from '../../hooks/useOnboardingData';
import { t } from '../../../i18n/index';
import {
  ONBOARDING_STATUSES,
  ONBOARDING_DEFAULT_TASKS,
  DOCUMENT_TYPES,
  WELCOME_KIT_ITEMS,
} from '../../../constants/apps/onboarding';
import { SelectOptions, useVH } from '../../context/ValueHelpsContext';
import { useDepartmentOptions, useLocationOptions, useJobTitleOptions, useEmployeeOptions } from '../../hooks/useSharedData';
import { API_BASE, publicAnonKey, safeJson } from '../../utils/constants';
import { NATIONALITIES } from '../../../constants/apps/recruitment';

// ==================== SIGNATURE TYPES ====================

interface SignatureRequest {
  id: string;
  document_id?: string;
  document_name: string;
  employee_id: string;
  requested_by: string;
  status: 'Pending' | 'Signed' | 'Declined';
  signed_at?: string;
  created_at: string;
}

// ==================== HELPERS ====================

const PROBATION_DAYS = 90;

function getProbationInfo(joiningDate: string) {
  const start = new Date(joiningDate);
  const end = new Date(start);
  end.setDate(end.getDate() + PROBATION_DAYS);
  const today = new Date();
  const daysElapsed = Math.floor((today.getTime() - start.getTime()) / 86400000);
  const daysRemaining = Math.floor((end.getTime() - today.getTime()) / 86400000);
  const isComplete = today >= end;
  const progress = Math.min(100, Math.max(0, Math.round((daysElapsed / PROBATION_DAYS) * 100)));
  return { end, daysElapsed, daysRemaining, isComplete, progress };
}

function fmtProbDate(date: Date) {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

type StatusType = 'Pending' | 'In Progress' | 'Completed' | 'On Hold';

const STATUS_COLORS: Record<StatusType, string> = {
  'Pending': 'bg-gray-100 text-gray-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Completed': 'bg-green-100 text-green-700',
  'On Hold': 'bg-orange-100 text-orange-700',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status as StatusType] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{value}%</span>
    </div>
  );
}

// ==================== COMBOBOX ====================

function ComboBox({ value, onChange, options, placeholder = 'Select or type…', error = false }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q ? options.filter(o => o.toLowerCase().includes(q)) : options;
  }, [options, query]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className={`flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 ${error ? 'border-red-400' : 'border-border'}`}>
        <input
          type="text"
          className="flex-1 text-sm px-3 py-2 bg-transparent outline-none"
          placeholder={placeholder}
          value={open ? query : value}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        <button type="button" onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }}
          className="px-2 py-2 text-muted-foreground hover:text-foreground">
          <ChevronDown size={14} />
        </button>
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(opt => (
            <button key={opt} type="button" onMouseDown={() => { onChange(opt); setQuery(''); setOpen(false); }}
              className={`w-full text-left text-sm px-3 py-2.5 hover:bg-muted border-b border-border last:border-b-0 truncate transition-colors ${opt === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-foreground'}`}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== SIGNATURE PAD ====================

function SignaturePad({ onSign }: { onSign: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    e.preventDefault();
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    e.preventDefault();
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDraw = () => setDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSign = () => {
    if (!hasDrawn) { toast.error('Please draw your signature'); return; }
    if (!agreed) { toast.error('Please agree to sign electronically'); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSign(canvas.toDataURL());
  };

  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-border rounded-lg bg-muted relative">
        <canvas
          ref={canvasRef}
          width={480}
          height={160}
          className="w-full touch-none cursor-crosshair rounded-lg"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
        {!hasDrawn && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none">
            Draw your signature here
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={clear} className="text-xs text-muted-foreground underline">Clear</button>
      </div>
      <label className="flex items-start gap-2 cursor-pointer">
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 rounded" />
        <span className="text-xs text-muted-foreground">I agree to sign this document electronically and confirm this is my legal signature.</span>
      </label>
      <button
        type="button"
        onClick={handleSign}
        className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
      >
        <Check size={14} /> Submit Signature
      </button>
    </div>
  );
}

// ==================== SIGNATURE MODAL ====================

function SignatureModal({
  request,
  onSigned,
  onClose,
}: {
  request: SignatureRequest;
  onSigned: () => void;
  onClose: () => void;
}) {
  const [signing, setSigning] = useState(false);

  const handleSign = async (dataUrl: string) => {
    setSigning(true);
    try {
      const res = await fetch(`${API_BASE}/onboarding/signature-requests/${request.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Signed',
          signed_at: new Date().toISOString(),
          signature_data: dataUrl,
        }),
      });
      const data = await safeJson(res);
      if (!data.success) throw new Error(data.error ?? 'Failed to submit signature');
      toast.success('Document signed successfully');
      onSigned();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">Sign Document</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{request.document_name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground"><X size={20} /></button>
        </div>
        <div className="p-5">
          {signing ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Submitting signature…
            </div>
          ) : (
            <SignaturePad onSign={handleSign} />
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== CONFIRM DIALOG ====================

interface ConfirmProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }: ConfirmProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className={`mt-0.5 shrink-0 ${danger ? 'text-red-500' : 'text-orange-500'}`} size={20} />
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm text-white rounded-lg ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== ASSIGN BUDDY MODAL ====================

interface AssignBuddyModalProps {
  employees: OnboardingCandidate[];
  currentBuddy: string;
  onAssign: (buddyName: string, buddyEmail: string) => Promise<void>;
  onClose: () => void;
}
function AssignBuddyModal({ employees, currentBuddy, onAssign, onClose }: AssignBuddyModalProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<OnboardingCandidate | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.department.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleAssign() {
    if (!selected) return;
    setSaving(true);
    try {
      await onAssign(selected.name, selected.email);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="font-semibold text-foreground">Assign Buddy</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-3">
          <input
            type="text"
            placeholder="Search by name or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="max-h-56 overflow-y-auto space-y-1">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No employees found</p>
            )}
            {filtered.map((emp) => (
              <button
                key={emp.id}
                onClick={() => setSelected(emp)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                  selected?.id === emp.id
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold flex-shrink-0">
                    {emp.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.department} &bull; {emp.position}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selected || saving}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            {saving ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== JOINER FORM MODAL ====================

function FormField({ label, required, children, error, className = '' }: {
  label: string; required?: boolean; children: React.ReactNode; error?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}{required && ' *'}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

function inputCls(err?: string) {
  return `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${err ? 'border-red-400' : 'border-border'}`;
}

interface JoinerFormProps {
  initial?: Partial<OnboardingCandidate>;
  onSave: (data: Partial<OnboardingCandidate>) => Promise<void>;
  onClose: () => void;
}

function JoinerFormModal({ initial, onSave, onClose }: JoinerFormProps) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<Partial<OnboardingCandidate>>({
    name: '',
    email: '',
    phone: '',
    personalEmail: '',
    position: '',
    department: '',
    location: '',
    manager: '',
    employmentType: 'Full-time',
    workMode: 'On-site',
    joiningDate: '',
    gender: '',
    nationality: '',
    offeredCTC: '',
    probationDays: 90,
    buddy: '',
    source: 'Direct',
    notes: '',
    status: 'Pending',
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { options: departments = [] } = useDepartmentOptions();
  const { options: locations = [] } = useLocationOptions();
  const { options: jobTitles = [] } = useJobTitleOptions();
  const { options: employees = [] } = useEmployeeOptions();

  const deptLabels = departments.map(d => d.label);
  const locationLabels = locations.map(l => l.label);
  const jobTitleLabels = jobTitles.map(j => j.label);
  const employeeNames = employees.map(e => e.label);
  const dbNationalities = useVH('employee', 'nationality');
  const nationalityList = dbNationalities.length > 0
    ? dbNationalities.map(o => o.value)
    : (NATIONALITIES as unknown as string[]);

  const set = <K extends keyof OnboardingCandidate>(k: K, v: OnboardingCandidate[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name?.trim()) e.name = 'Full name is required';
    if (!form.email?.trim()) e.email = 'Work email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format';
    if (form.personalEmail?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.personalEmail)) e.personalEmail = 'Invalid email format';
    if (form.phone?.trim() && !/^\+?[\d\s\-() ]{7,20}$/.test(form.phone)) e.phone = 'Invalid phone format';
    if (!form.position?.trim()) e.position = 'Position / Designation is required';
    if (!form.department?.trim()) e.department = 'Department is required';
    if (!form.joiningDate?.trim()) e.joiningDate = 'Joining date is required';
    if (form.dateOfBirth && form.joiningDate && form.dateOfBirth >= form.joiningDate) e.dateOfBirth = 'Date of birth must be before joining date';
    if (form.probationDays !== undefined && form.probationDays < 0) e.probationDays = 'Must be 0 or more days';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error('Please fix the errors before saving');
      return;
    }
    setErrors({});
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

  const F = FormField;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Briefcase size={18} className="text-blue-600" />
            <h2 className="text-base font-semibold text-foreground">{isEdit ? 'Edit Joiner' : 'Add New Joiner'}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">

            {/* Section: Personal Information */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Personal Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <F label="Full Name" required error={errors.name}>
                  <input value={form.name ?? ''} onChange={e => set('name', e.target.value)}
                    className={inputCls(errors.name)} placeholder="Jane Smith" />
                </F>
                <F label="Gender" error={errors.gender}>
                  <select value={form.gender ?? ''} onChange={e => set('gender', e.target.value)}
                    className={inputCls(errors.gender)}>
                    <option value="">Select…</option>
                    <SelectOptions entity="employee" field="gender" fallback={['Male','Female','Non-binary','Prefer not to say']} />
                  </select>
                </F>
                <F label="Date of Birth" error={errors.dateOfBirth}>
                  <input type="date" value={form.dateOfBirth ?? ''} onChange={e => set('dateOfBirth', e.target.value)}
                    className={inputCls(errors.dateOfBirth)} />
                </F>
                <F label="Nationality" error={errors.nationality}>
                  <ComboBox value={form.nationality ?? ''} onChange={v => set('nationality', v)}
                    options={nationalityList} placeholder="Select nationality…" error={!!errors.nationality} />
                </F>
              </div>
            </div>

            {/* Section: Contact */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contact</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <F label="Work Email" required error={errors.email}>
                  <input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)}
                    className={inputCls(errors.email)} placeholder="jane@company.com" />
                </F>
                <F label="Personal Email" error={errors.personalEmail}>
                  <input type="email" value={form.personalEmail ?? ''} onChange={e => set('personalEmail', e.target.value)}
                    className={inputCls(errors.personalEmail)} placeholder="jane@gmail.com" />
                </F>
                <F label="Phone" error={errors.phone}>
                  <input type="tel" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)}
                    className={inputCls(errors.phone)} placeholder="+91 98765 43210" />
                </F>
              </div>
            </div>

            {/* Section: Job Details */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Job Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <F label="Position / Designation" required error={errors.position}>
                  <ComboBox value={form.position ?? ''} onChange={v => set('position', v)}
                    options={jobTitleLabels} placeholder="e.g. Software Engineer" error={!!errors.position} />
                </F>
                <F label="Department" required error={errors.department}>
                  <ComboBox value={form.department ?? ''} onChange={v => set('department', v)}
                    options={deptLabels} placeholder="Select department…" error={!!errors.department} />
                </F>
                <F label="Location" error={errors.location}>
                  <ComboBox value={form.location ?? ''} onChange={v => set('location', v)}
                    options={locationLabels} placeholder="Select office location…" />
                </F>
                <F label="Reporting Manager" error={errors.manager}>
                  <ComboBox value={form.manager ?? ''} onChange={v => set('manager', v)}
                    options={employeeNames} placeholder="Search manager…" />
                </F>
                <F label="Employment Type" error={errors.employmentType}>
                  <select value={form.employmentType ?? 'Full-time'} onChange={e => set('employmentType', e.target.value)}
                    className={inputCls(errors.employmentType)}>
                    <SelectOptions entity="employee" field="employment_type" fallback={['Full-time','Part-time','Contract','Internship']} />
                  </select>
                </F>
                <F label="Work Mode" error={errors.workMode}>
                  <select value={form.workMode ?? 'On-site'} onChange={e => set('workMode', e.target.value)}
                    className={inputCls(errors.workMode)}>
                    <SelectOptions entity="employee" field="work_mode" fallback={['On-site','Remote','Hybrid']} />
                  </select>
                </F>
                <F label="Offered CTC / Salary" error={errors.offeredCTC}>
                  <input value={form.offeredCTC ?? ''} onChange={e => set('offeredCTC', e.target.value)}
                    className={inputCls(errors.offeredCTC)} placeholder="e.g. ₹12,00,000 per annum" />
                </F>
                <F label="Source" error={errors.source}>
                  <select value={form.source ?? 'Direct'} onChange={e => set('source', e.target.value as any)}
                    className={inputCls()}>
                    <SelectOptions entity="onboarding" field="source" fallback={['Direct','Recruitment','Referral','Bulk Upload','Other']} />
                  </select>
                </F>
              </div>
            </div>

            {/* Section: Onboarding Schedule */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Onboarding Schedule</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <F label="Joining Date" required error={errors.joiningDate}>
                  <input type="date" value={form.joiningDate ?? ''} onChange={e => set('joiningDate', e.target.value)}
                    className={inputCls(errors.joiningDate)} />
                </F>
                <F label="Probation Period (days)" error={errors.probationDays}>
                  <input type="number" min={0} max={365} value={form.probationDays ?? 90}
                    onChange={e => set('probationDays', Number(e.target.value))}
                    className={inputCls(errors.probationDays)} />
                </F>
                <F label="Assigned Buddy">
                  <ComboBox value={form.buddy ?? ''} onChange={v => set('buddy', v)}
                    options={employeeNames} placeholder="Search buddy…" />
                </F>
                <F label="Status">
                  <select value={form.status ?? 'Pending'} onChange={e => set('status', e.target.value as any)}
                    className={inputCls()}>
                    {(['Pending', 'In Progress', 'Completed', 'On Hold'] as const).map(s =>
                      <option key={s} value={s}>{s}</option>)}
                  </select>
                </F>
              </div>
            </div>

            {/* Notes */}
            <F label="Onboarding Notes / Special Instructions" className="sm:col-span-2">
              <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={3}
                className={`${inputCls()} resize-none`} placeholder="Any special requirements, equipment, or instructions for the onboarding team…" />
            </F>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60 transition-colors">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Joiner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== DETAIL MODAL ====================

type DetailTab = 'checklist' | 'documents' | 'welcome-kit';

interface DetailModalProps {
  employee: OnboardingCandidate;
  canManage: boolean;
  allEmployees: OnboardingCandidate[];
  onUpdateTask: (taskId: string, completed: boolean) => Promise<void>;
  onSyncToDirectory: () => Promise<void>;
  onEnableAccess: () => Promise<{ loginEmail?: string; tempPassword?: string }>;
  onConfirmProbation: () => Promise<void>;
  onAssignBuddy: (buddyName: string, buddyEmail: string) => Promise<void>;
  onClose: () => void;
}

function DetailModal({ employee, canManage, currentUserName, currentUserId, allEmployees, onUpdateTask, onSyncToDirectory, onEnableAccess, onConfirmProbation, onAssignBuddy, onClose }: DetailModalProps & { currentUserName?: string; currentUserId?: string }) {
  const [tab, setTab] = useState<DetailTab>('checklist');
  const [confirmSync, setConfirmSync] = useState(false);
  const [confirmAccess, setConfirmAccess] = useState(false);
  const [accessResult, setAccessResult] = useState<{ loginEmail?: string; tempPassword?: string } | null>(null);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [confirmingProbation, setConfirmingProbation] = useState(false);
  const [showAssignBuddy, setShowAssignBuddy] = useState(false);
  const [sigRequests, setSigRequests] = useState<SignatureRequest[]>([]);
  const [sigRequestsLoaded, setSigRequestsLoaded] = useState(false);
  const [signingRequest, setSigningRequest] = useState<SignatureRequest | null>(null);
  const [requestingDocId, setRequestingDocId] = useState<string | null>(null);

  const fetchSigRequests = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/onboarding/signature-requests?employee_id=${employee.id}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await safeJson(res);
      setSigRequests(Array.isArray(data.data) ? data.data : []);
    } catch { setSigRequests([]); } finally {
      setSigRequestsLoaded(true);
    }
  }, [employee.id]);

  useEffect(() => { if (tab === 'documents') fetchSigRequests(); }, [tab]);

  const handleRequestSignature = async (doc: DocumentItem) => {
    setRequestingDocId(doc.id);
    try {
      const res = await fetch(`${API_BASE}/onboarding/signature-requests`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: doc.id,
          employee_id: employee.id,
          requested_by: currentUserName ?? 'HR',
          document_name: doc.name,
        }),
      });
      const data = await safeJson(res);
      if (!data.success) throw new Error(data.error ?? 'Failed to create signature request');
      toast.success(`Signature request sent to ${employee.name}`);
      fetchSigRequests();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRequestingDocId(null);
    }
  };

  const getSigStatus = (docId: string, docName: string) => {
    return sigRequests.find(r => r.document_id === docId || r.document_name === docName);
  };

  const completedTasks = employee.checklist?.filter(t => t.status === 'Completed').length ?? 0;
  const totalTasks = employee.checklist?.length ?? 0;

  const handleToggleTask = async (task: ChecklistItem) => {
    setBusyTask(task.id);
    try {
      await onUpdateTask(task.id, task.status !== 'Completed');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyTask(null);
    }
  };

  const handleEnableAccess = async () => {
    setConfirmAccess(false);
    try {
      const result = await onEnableAccess();
      setAccessResult(result);
      toast.success('Access enabled successfully');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleSync = async () => {
    setConfirmSync(false);
    try {
      await onSyncToDirectory();
      toast.success('Synced to directory');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleConfirmProbation = async () => {
    setConfirmingProbation(true);
    try {
      await onConfirmProbation();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setConfirmingProbation(false);
    }
  };

  const probation = employee.joiningDate ? getProbationInfo(employee.joiningDate) : null;
  const showProbationConfirm = canManage && probation?.isComplete && (employee as any).status !== 'Confirmed' && !(employee as any).probation_confirmed;

  const tabs: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
    { id: 'checklist', label: 'Checklist', icon: <CheckSquare size={14} /> },
    { id: 'documents', label: 'Documents', icon: <FileText size={14} /> },
    { id: 'welcome-kit', label: 'Welcome Kit', icon: <Gift size={14} /> },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-border">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{employee.name}</h2>
              <p className="text-sm text-muted-foreground">{employee.position} &bull; {employee.department}</p>
              <div className="flex items-center gap-3 mt-2">
                <StatusBadge status={employee.status} />
                <span className="text-xs text-muted-foreground">Joining: {employee.joiningDate}</span>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground mt-1"><X size={20} /></button>
          </div>

          {/* Progress */}
          <div className="px-6 py-3 border-b border-border">
            <ProgressBar value={employee.progress} />
          </div>

          {/* Probation */}
          {probation && (
            <div className="px-6 py-3 border-b border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Probation Period</span>
                {probation.isComplete ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    <ShieldCheck size={11} /> Probation Complete
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                    In Probation
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${probation.isComplete ? 'bg-green-500' : 'bg-amber-400'}`}
                    style={{ width: `${probation.progress}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8 text-right">{probation.progress}%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Probation ends: <span className="font-medium text-foreground">{fmtProbDate(probation.end)}</span>
                {!probation.isComplete && (
                  <span className="ml-2 text-amber-600">({probation.daysRemaining} days remaining)</span>
                )}
              </p>
              {showProbationConfirm && (
                <button
                  onClick={handleConfirmProbation}
                  disabled={confirmingProbation}
                  className="mt-1 flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-60"
                >
                  <ShieldCheck size={13} />
                  {confirmingProbation ? 'Confirming...' : 'Confirm Probation Passed'}
                </button>
              )}
            </div>
          )}

          {/* Buddy Assignment */}
          <div className="px-6 py-3 border-b border-border">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Onboarding Buddy</span>
              {canManage && (
                <button
                  onClick={() => setShowAssignBuddy(true)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <Users size={12} /> {employee.buddy ? 'Change Buddy' : 'Assign Buddy'}
                </button>
              )}
            </div>
            {employee.buddy ? (
              <div className="flex items-center gap-3 mt-2">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-semibold flex-shrink-0">
                  {employee.buddy[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{employee.buddy}</p>
                </div>
                <button
                  onClick={() => {
                    toast.success(`Email sent to ${employee.buddy} and ${employee.name}`, {
                      description: 'Introduction email delivered (simulated).',
                    });
                  }}
                  className="text-xs text-muted-foreground border border-border px-2 py-1 rounded-lg hover:bg-muted whitespace-nowrap"
                >
                  Send Intro Email
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">No buddy assigned yet</p>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border px-6">
            {tabs.map(tab_ => (
              <button
                key={tab_.id}
                onClick={() => setTab(tab_.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors ${
                  tab === tab_.id
                    ? 'border-blue-500 text-blue-600 font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab_.icon} {tab_.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-6">
            {tab === 'checklist' && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground mb-3">{completedTasks}/{totalTasks} tasks completed</div>
                {(employee.checklist ?? []).map(task => (
                  <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted">
                    <button
                      disabled={busyTask === task.id}
                      onClick={() => handleToggleTask(task)}
                      className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        task.status === 'Completed'
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-border hover:border-blue-400'
                      }`}
                    >
                      {task.status === 'Completed' && <Check size={12} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${task.status === 'Completed' ? 'line-through text-gray-400' : 'text-foreground'}`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>Assigned: {task.assignedTo}</span>
                        {task.dueDate && <span>Due: {task.dueDate}</span>}
                      </div>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                ))}
                {(employee.checklist ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No tasks yet</p>
                )}
              </div>
            )}

            {tab === 'documents' && (
              <div className="space-y-2">
                {(employee.documents ?? []).map(doc => {
                  const sigReq = getSigStatus(doc.id, doc.name);
                  const needsSig = ['Offer Letter', 'NDA'].includes(doc.type ?? '');
                  return (
                    <div key={doc.id} className="flex items-start justify-between p-3 rounded-lg border border-border gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.type} &bull; {doc.uploadedDate}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {sigReq ? (
                          sigReq.status === 'Signed' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                              <Check size={10} /> Signed {sigReq.signed_at ? new Date(sigReq.signed_at).toLocaleDateString() : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full font-medium">
                              Pending Signature
                            </span>
                          )
                        ) : null}
                        {canManage && needsSig && !sigReq && (
                          <button
                            onClick={() => handleRequestSignature(doc)}
                            disabled={requestingDocId === doc.id}
                            className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50 disabled:opacity-60 whitespace-nowrap"
                          >
                            {requestingDocId === doc.id ? 'Sending…' : 'Request Signature'}
                          </button>
                        )}
                        {!canManage && sigReq?.status === 'Pending' && (
                          <button
                            onClick={() => setSigningRequest(sigReq)}
                            className="text-xs text-white bg-blue-600 px-2 py-1 rounded-lg hover:bg-blue-700 whitespace-nowrap"
                          >
                            Sign
                          </button>
                        )}
                        <StatusBadge status={doc.status} />
                      </div>
                    </div>
                  );
                })}
                {(employee.documents ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No documents</p>
                )}
              </div>
            )}
            {signingRequest && (
              <SignatureModal
                request={signingRequest}
                onSigned={fetchSigRequests}
                onClose={() => setSigningRequest(null)}
              />
            )}

            {tab === 'welcome-kit' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-foreground">Kit Status</span>
                  <StatusBadge status={employee.welcomeKit?.status ?? 'Not Ordered'} />
                </div>
                {employee.welcomeKit?.trackingNumber && (
                  <p className="text-xs text-muted-foreground mb-3">Tracking: {employee.welcomeKit.trackingNumber}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {(employee.welcomeKit?.items ?? []).map((item, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted text-sm text-foreground">
                      <Check size={14} className="text-green-500 shrink-0" /> {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer actions for HR/Admin */}
          {canManage && (
            <div className="flex flex-wrap gap-2 px-6 pb-6">
              <button
                onClick={() => setConfirmSync(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-foreground border border-border rounded-lg hover:bg-muted"
              >
                <RefreshCw size={14} /> Sync to Directory
              </button>
              <button
                onClick={() => setConfirmAccess(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                <UserCheck size={14} /> Enable Access
              </button>
            </div>
          )}

          {/* Access result card */}
          {accessResult && (
            <div className="mx-6 mb-6 p-4 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm font-medium text-green-800 mb-2">Access enabled!</p>
              {accessResult.loginEmail && <p className="text-xs text-green-700">Login: {accessResult.loginEmail}</p>}
              {accessResult.tempPassword && <p className="text-xs text-green-700">Temp password: {accessResult.tempPassword}</p>}
            </div>
          )}
        </div>
      </div>

      {confirmSync && (
        <ConfirmDialog
          title="Sync to Directory"
          message={`Sync ${employee.name}'s data to the company directory?`}
          confirmLabel="Sync"
          onConfirm={handleSync}
          onCancel={() => setConfirmSync(false)}
        />
      )}
      {confirmAccess && (
        <ConfirmDialog
          title="Enable System Access"
          message={`Enable login credentials for ${employee.name}? They will receive an email with login details.`}
          confirmLabel="Enable Access"
          onConfirm={handleEnableAccess}
          onCancel={() => setConfirmAccess(false)}
        />
      )}
      {showAssignBuddy && (
        <AssignBuddyModal
          employees={allEmployees.filter((e) => e.id !== employee.id)}
          currentBuddy={employee.buddy}
          onAssign={onAssignBuddy}
          onClose={() => setShowAssignBuddy(false)}
        />
      )}
    </>
  );
}

// ==================== KANBAN CARD ====================

interface KanbanCardProps {
  employee: OnboardingCandidate;
  canManage: boolean;
  onView: () => void;
  onEnableAccess: () => void;
}
function KanbanCard({ employee, canManage, onView, onEnableAccess }: KanbanCardProps) {
  const completedTasks = employee.checklist?.filter(t => t.status === 'Completed').length ?? 0;
  const totalTasks = employee.checklist?.length ?? 0;
  return (
    <div
      onClick={onView}
      className="bg-card rounded-lg border border-border p-3 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-1 mb-0.5">
        <p className="font-medium text-foreground text-sm truncate">{employee.name}</p>
        {employee.source === 'Recruitment' && (
          <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold bg-violet-100 text-violet-700 rounded px-1.5 py-0.5">
            <Briefcase size={9} /> Hired
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground truncate">{employee.position}</p>
      <p className="text-xs text-muted-foreground mt-1">Joins: {employee.joiningDate}</p>
      <div className="mt-2">
        <ProgressBar value={employee.progress} />
      </div>
      <p className="text-xs text-muted-foreground mt-1">{completedTasks}/{totalTasks} tasks</p>
      {canManage && employee.status === 'Completed' && (
        <button
          onClick={e => { e.stopPropagation(); onEnableAccess(); }}
          className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-md"
        >
          <UserCheck size={12} /> Enable Access
        </button>
      )}
    </div>
  );
}

// ==================== OFFBOARDING TYPES ====================

interface OffboardingRecord {
  id: string;
  employee_id: string;
  employee_name?: string;
  resignation_date?: string;
  last_working_date?: string;
  exit_type: 'Resignation' | 'Termination' | 'Retirement' | 'Contract End';
  exit_interview_date?: string;
  exit_feedback?: Record<string, string>;
  fnf_status: 'pending' | 'in_progress' | 'completed';
  fnf_amount?: number;
  fnf_paid_at?: string;
  status: 'active' | 'completed';
  created_at: string;
}

interface OffboardingTask {
  id: string;
  offboarding_id: string;
  task_name: string;
  task_category: 'IT' | 'Finance' | 'HR' | 'Manager';
  assigned_to?: string;
  due_date?: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  notes?: string;
  completed_at?: string;
}

// ==================== OFFBOARDING HELPERS ====================

const EXIT_TASK_TEMPLATES: Record<string, { task_name: string; task_category: OffboardingTask['task_category'] }[]> = {
  common: [
    { task_name: 'Exit Interview', task_category: 'HR' },
    { task_name: 'PF Transfer Initiation', task_category: 'HR' },
    { task_name: 'Experience & Relieving Letter', task_category: 'HR' },
    { task_name: 'F&F Settlement', task_category: 'Finance' },
    { task_name: 'Expense Claims Clearance', task_category: 'Finance' },
    { task_name: 'Laptop Return', task_category: 'IT' },
    { task_name: 'Access Revocation', task_category: 'IT' },
    { task_name: 'Email Forward Setup', task_category: 'IT' },
    { task_name: 'Knowledge Transfer Documentation', task_category: 'Manager' },
    { task_name: 'Handover of Ongoing Work', task_category: 'Manager' },
  ],
  Termination: [
    { task_name: 'Legal Documentation Review', task_category: 'HR' },
    { task_name: 'Immediate Access Revoke', task_category: 'IT' },
  ],
  Retirement: [
    { task_name: 'Gratuity Processing', task_category: 'Finance' },
    { task_name: 'Pension Documentation', task_category: 'HR' },
  ],
};

const CATEGORY_COLORS: Record<string, string> = {
  IT: 'bg-blue-100 text-blue-700',
  Finance: 'bg-green-100 text-green-700',
  HR: 'bg-purple-100 text-purple-700',
  Manager: 'bg-orange-100 text-orange-700',
};

const TASK_STATUS_COLS: OffboardingTask['status'][] = ['Not Started', 'In Progress', 'Completed'];

// ==================== INITIATE OFFBOARDING MODAL ====================

interface InitiateOffboardingModalProps {
  employees: { id: string; name: string; department: string; position?: string }[];
  onCreated: () => void;
  onClose: () => void;
}

function InitiateOffboardingModal({ employees, onCreated, onClose }: InitiateOffboardingModalProps) {
  const { supabase: _sb } = { supabase: null }; // use imported supabase directly below
  const [employeeId, setEmployeeId] = useState('');
  const [exitType, setExitType] = useState<OffboardingRecord['exit_type']>('Resignation');
  const [resignationDate, setResignationDate] = useState('');
  const [lastWorkingDate, setLastWorkingDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [empSearch, setEmpSearch] = useState('');

  // Import supabase from constants
  const { supabase: sbClient } = { supabase: (window as any).__sbClient };

  const filteredEmps = employees.filter(e =>
    e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
    e.department.toLowerCase().includes(empSearch.toLowerCase()),
  );
  const selectedEmp = employees.find(e => e.id === employeeId);

  const handleSubmit = async () => {
    if (!employeeId || !lastWorkingDate) {
      toast.error('Please select employee and last working date');
      return;
    }
    setSaving(true);
    try {
      // Create offboarding record
      const { data: record, error: recErr } = await import('../../utils/constants').then(m =>
        m.supabase.from('offboarding_records').insert([{
          employee_id: employeeId,
          exit_type: exitType,
          resignation_date: resignationDate || null,
          last_working_date: lastWorkingDate,
          fnf_status: 'pending',
          status: 'active',
        }]).select().single()
      );
      if (recErr) throw recErr;

      // Auto-generate tasks
      const taskTemplates = [
        ...EXIT_TASK_TEMPLATES.common,
        ...(EXIT_TASK_TEMPLATES[exitType] ?? []),
      ];
      const tasks = taskTemplates.map(t => ({
        offboarding_id: record.id,
        task_name: t.task_name,
        task_category: t.task_category,
        status: 'Not Started' as const,
        due_date: lastWorkingDate,
      }));
      await import('../../utils/constants').then(m =>
        m.supabase.from('offboarding_tasks').insert(tasks)
      );

      toast.success(`Offboarding initiated for ${selectedEmp?.name ?? 'employee'}`);
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to initiate offboarding');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <UserMinus size={18} className="text-red-500" />
            <h3 className="font-semibold text-foreground">Initiate Offboarding</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Employee search */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Employee *</label>
            {selectedEmp ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-foreground">{selectedEmp.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedEmp.department}</p>
                </div>
                <button type="button" onClick={() => setEmployeeId('')} className="text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search employee..."
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="max-h-40 overflow-y-auto border border-border rounded-lg">
                  {filteredEmps.slice(0, 8).map(e => (
                    <button key={e.id} type="button"
                      onClick={() => { setEmployeeId(e.id); setEmpSearch(''); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between border-b border-border last:border-0">
                      <span>{e.name}</span>
                      <span className="text-xs text-muted-foreground">{e.department}</span>
                    </button>
                  ))}
                  {filteredEmps.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No employees found</p>}
                </div>
              </div>
            )}
          </div>

          {/* Exit type */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Exit Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {(['Resignation', 'Termination', 'Retirement', 'Contract End'] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => setExitType(t)}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors ${exitType === t ? 'bg-blue-600 text-white border-blue-600' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            {exitType === 'Resignation' && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Resignation Date</label>
                <input type="date" value={resignationDate} onChange={e => setResignationDate(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
            <div className={exitType === 'Resignation' ? '' : 'col-span-2'}>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Last Working Date *</label>
              <input type="date" value={lastWorkingDate} onChange={e => setLastWorkingDate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-60">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? 'Initiating…' : 'Initiate Offboarding'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== TASK EDIT MODAL ====================

function OffboardingTaskModal({
  task,
  onSave,
  onClose,
}: {
  task: OffboardingTask;
  onSave: (updates: Partial<OffboardingTask>) => Promise<void>;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState(task.notes ?? '');
  const [status, setStatus] = useState<OffboardingTask['status']>(task.status);
  const [assignedTo, setAssignedTo] = useState(task.assigned_to ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        notes,
        status,
        assigned_to: assignedTo,
        completed_at: status === 'Completed' ? new Date().toISOString() : undefined,
      });
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground text-sm">{task.task_name}</h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${CATEGORY_COLORS[task.task_category]}`}>
              {task.task_category}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
            <div className="flex gap-2">
              {TASK_STATUS_COLS.map(s => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs border transition-colors ${status === s ? 'bg-blue-600 text-white border-blue-600' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Assigned To</label>
            <input type="text" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
              placeholder="Assignee name or email"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Add any notes or instructions…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60">
            {saving && <Loader2 size={13} className="animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== EXIT INTERVIEW MODAL ====================

function ExitInterviewModal({
  record,
  onSave,
  onClose,
}: {
  record: OffboardingRecord;
  onSave: () => void;
  onClose: () => void;
}) {
  const [interviewDate, setInterviewDate] = useState(record.exit_interview_date ?? '');
  const [feedback, setFeedback] = useState<Record<string, string>>(record.exit_feedback ?? {});
  const [saving, setSaving] = useState(false);

  const questions = [
    { key: 'reason_for_leaving', label: 'Primary reason for leaving' },
    { key: 'experience', label: 'How was your overall experience at the company?' },
    { key: 'suggestions', label: 'Any suggestions for improvement?' },
    { key: 'recommend', label: 'Would you recommend the company to others?' },
    { key: 'additional', label: 'Any additional comments?' },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await import('../../utils/constants').then(m =>
        m.supabase.from('offboarding_records').update({
          exit_interview_date: interviewDate || null,
          exit_feedback: feedback,
        }).eq('id', record.id)
      );
      if (error) throw error;
      toast.success('Exit interview saved');
      onSave();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-purple-500" />
            <h3 className="font-semibold text-foreground">Exit Interview</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Interview Date</label>
            <input type="date" value={interviewDate} onChange={e => setInterviewDate(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Interview Questions</p>
            {questions.map(q => (
              <div key={q.key}>
                <label className="block text-sm font-medium text-foreground mb-1">{q.label}</label>
                <textarea
                  value={feedback[q.key] ?? ''}
                  onChange={e => setFeedback(prev => ({ ...prev, [q.key]: e.target.value }))}
                  rows={2}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Enter response…"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-60">
            {saving && <Loader2 size={13} className="animate-spin" />}
            Save Interview
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== FNF TRACKER ====================

function FnFTracker({
  record,
  onUpdated,
}: {
  record: OffboardingRecord;
  onUpdated: () => void;
}) {
  const [amount, setAmount] = useState(record.fnf_amount?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  const markPaid = async () => {
    setSaving(true);
    try {
      const { error } = await import('../../utils/constants').then(m =>
        m.supabase.from('offboarding_records').update({
          fnf_status: 'completed',
          fnf_amount: parseFloat(amount) || 0,
          fnf_paid_at: new Date().toISOString(),
        }).eq('id', record.id)
      );
      if (error) throw error;
      toast.success('F&F marked as paid');
      onUpdated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fnfColors: Record<string, string> = {
    pending: 'bg-orange-100 text-orange-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
  };

  return (
    <div className="border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-green-600" />
          <span className="text-sm font-semibold text-foreground">F&amp;F Settlement</span>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${fnfColors[record.fnf_status]}`}>
          {record.fnf_status === 'completed' ? 'Paid' : record.fnf_status === 'in_progress' ? 'In Progress' : 'Pending'}
        </span>
      </div>
      {record.fnf_status !== 'completed' ? (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Enter F&F amount"
              className="w-full pl-7 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={markPaid}
            disabled={saving || !amount}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-60 whitespace-nowrap"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Mark as Paid
          </button>
        </div>
      ) : (
        <div className="text-sm text-green-700">
          <p>Amount: <span className="font-semibold">₹{record.fnf_amount?.toLocaleString()}</span></p>
          {record.fnf_paid_at && <p className="text-xs text-muted-foreground mt-0.5">Paid on: {new Date(record.fnf_paid_at).toLocaleDateString()}</p>}
        </div>
      )}
    </div>
  );
}

// ==================== OFFBOARDING BOARD (KANBAN) ====================

function OffboardingBoard({
  record,
  tasks,
  onTaskUpdated,
}: {
  record: OffboardingRecord;
  tasks: OffboardingTask[];
  onTaskUpdated: () => void;
}) {
  const [editingTask, setEditingTask] = useState<OffboardingTask | null>(null);
  const [showExitInterview, setShowExitInterview] = useState(false);

  const handleDrop = async (taskId: string, newStatus: OffboardingTask['status']) => {
    try {
      const { error } = await import('../../utils/constants').then(m =>
        m.supabase.from('offboarding_tasks').update({
          status: newStatus,
          completed_at: newStatus === 'Completed' ? new Date().toISOString() : null,
        }).eq('id', taskId)
      );
      if (error) throw error;
      onTaskUpdated();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTaskSave = async (taskId: string, updates: Partial<OffboardingTask>) => {
    const { error } = await import('../../utils/constants').then(m =>
      m.supabase.from('offboarding_tasks').update(updates).eq('id', taskId)
    );
    if (error) throw error;
    onTaskUpdated();
  };

  const colColors: Record<string, string> = {
    'Not Started': 'border-gray-300',
    'In Progress': 'border-blue-400',
    'Completed': 'border-green-400',
  };

  return (
    <div className="space-y-5">
      {/* Record summary */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Exit Type</p>
          <p className="font-medium text-foreground mt-0.5">{record.exit_type}</p>
        </div>
        {record.last_working_date && (
          <div>
            <p className="text-xs text-muted-foreground">Last Working Day</p>
            <p className="font-medium text-foreground mt-0.5">{record.last_working_date}</p>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowExitInterview(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100"
          >
            <MessageSquare size={14} /> Exit Interview
          </button>
        </div>
      </div>

      {/* F&F Tracker */}
      <FnFTracker record={record} onUpdated={onTaskUpdated} />

      {/* Kanban board */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {TASK_STATUS_COLS.map(col => {
          const colTasks = tasks.filter(t => t.status === col);
          return (
            <div
              key={col}
              className={`rounded-xl border-t-4 ${colColors[col]} bg-muted p-3`}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                const taskId = e.dataTransfer.getData('taskId');
                if (taskId) handleDrop(taskId, col);
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-foreground">{col}</h4>
                <span className="text-xs bg-card border border-border rounded-full px-2 py-0.5 text-muted-foreground">
                  {colTasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {colTasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
                    onClick={() => setEditingTask(task)}
                    className="bg-card rounded-lg border border-border p-3 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <p className="text-xs font-medium text-foreground">{task.task_name}</p>
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${CATEGORY_COLORS[task.task_category]}`}>
                        {task.task_category}
                      </span>
                      {task.assigned_to && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{task.assigned_to}</span>
                      )}
                    </div>
                    {task.due_date && (
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock size={9} /> {task.due_date}
                      </p>
                    )}
                  </div>
                ))}
                {colTasks.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No tasks</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {editingTask && (
        <OffboardingTaskModal
          task={editingTask}
          onSave={async (updates) => handleTaskSave(editingTask.id, updates)}
          onClose={() => setEditingTask(null)}
        />
      )}
      {showExitInterview && (
        <ExitInterviewModal
          record={record}
          onSave={onTaskUpdated}
          onClose={() => setShowExitInterview(false)}
        />
      )}
    </div>
  );
}

// ==================== OFFBOARDING TAB ====================

interface OffboardingTabProps {
  isHRAdmin: boolean;
  isManager: boolean;
  employees: { id: string; name: string; department: string; position?: string }[];
}

function OffboardingTab({ isHRAdmin, isManager, employees }: OffboardingTabProps) {
  const [records, setRecords] = useState<OffboardingRecord[]>([]);
  const [tasks, setTasks] = useState<Record<string, OffboardingTask[]>>({});
  const [loading, setLoading] = useState(true);
  const [showInitiate, setShowInitiate] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<OffboardingRecord | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { supabase: sb } = await import('../../utils/constants');
      const { data: recs, error } = await sb
        .from('offboarding_records')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Enrich with employee names
      const enriched = (recs ?? []).map((r: OffboardingRecord) => {
        const emp = employees.find(e => e.id === r.employee_id);
        return { ...r, employee_name: emp?.name ?? r.employee_id };
      });
      setRecords(enriched);

      // Fetch tasks for all records
      if (enriched.length > 0) {
        const ids = enriched.map((r: OffboardingRecord) => r.id);
        const { data: taskData } = await sb
          .from('offboarding_tasks')
          .select('*')
          .in('offboarding_id', ids);
        const taskMap: Record<string, OffboardingTask[]> = {};
        (taskData ?? []).forEach((t: OffboardingTask) => {
          if (!taskMap[t.offboarding_id]) taskMap[t.offboarding_id] = [];
          taskMap[t.offboarding_id].push(t);
        });
        setTasks(taskMap);
      }
    } catch (err: any) {
      toast.error(`Failed to load offboarding data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [employees]);

  useEffect(() => { void fetchRecords(); }, [fetchRecords]);

  const fnfColors: Record<string, string> = {
    pending: 'bg-orange-100 text-orange-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
  };

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Offboarding Management</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{records.length} active offboarding{records.length !== 1 ? 's' : ''}</p>
        </div>
        {(isHRAdmin || isManager) && (
          <button
            onClick={() => setShowInitiate(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg"
          >
            <UserMinus size={15} /> Initiate Offboarding
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
      )}

      {/* Record detail (expanded board) */}
      {!loading && selectedRecord && (
        <div className="space-y-4">
          <button onClick={() => setSelectedRecord(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            ← Back to list
          </button>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <UserMinus size={18} className="text-red-500" />
              <h3 className="font-semibold text-foreground">{selectedRecord.employee_name}</h3>
              <StatusBadge status={selectedRecord.status === 'active' ? 'In Progress' : 'Completed'} />
            </div>
            <OffboardingBoard
              record={selectedRecord}
              tasks={tasks[selectedRecord.id] ?? []}
              onTaskUpdated={fetchRecords}
            />
          </div>
        </div>
      )}

      {/* Records list */}
      {!loading && !selectedRecord && (
        <>
          {records.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <LogOut size={36} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-muted-foreground">No offboarding records yet</p>
              {(isHRAdmin || isManager) && (
                <button onClick={() => setShowInitiate(true)}
                  className="mt-3 text-sm text-blue-600 hover:underline">
                  Initiate first offboarding
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {records.map(rec => {
                const recTasks = tasks[rec.id] ?? [];
                const completed = recTasks.filter(t => t.status === 'Completed').length;
                const progress = recTasks.length > 0 ? Math.round((completed / recTasks.length) * 100) : 0;
                return (
                  <div key={rec.id}
                    className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedRecord(rec)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground text-sm">{rec.employee_name}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                            {rec.exit_type}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${fnfColors[rec.fnf_status]}`}>
                            F&amp;F: {rec.fnf_status}
                          </span>
                        </div>
                        {rec.last_working_date && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar size={11} /> Last day: {rec.last_working_date}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{completed}/{recTasks.length} tasks</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Initiate modal */}
      {showInitiate && (
        <InitiateOffboardingModal
          employees={employees}
          onCreated={fetchRecords}
          onClose={() => setShowInitiate(false)}
        />
      )}
    </div>
  );
}

// ==================== BULK IMPORT MODAL ====================

const BULK_COLUMNS = [
  { key: 'name',            label: 'Name',            required: true,  example: 'John Smith' },
  { key: 'email',           label: 'Email',           required: true,  example: 'john.smith@company.com' },
  { key: 'position',        label: 'Position',        required: true,  example: 'Software Engineer' },
  { key: 'department',      label: 'Department',      required: true,  example: 'Engineering' },
  { key: 'joining_date',    label: 'Joining Date',    required: true,  example: '2024-06-01' },
  { key: 'phone',           label: 'Phone',           required: false, example: '+91-9876543210' },
  { key: 'location',        label: 'Location',        required: false, example: 'Mumbai' },
  { key: 'manager',         label: 'Manager',         required: false, example: 'Jane Doe' },
  { key: 'employment_type', label: 'Employment Type', required: false, example: 'Full-time' },
  { key: 'work_mode',       label: 'Work Mode',       required: false, example: 'Hybrid' },
  { key: 'gender',          label: 'Gender',          required: false, example: 'Male' },
  { key: 'nationality',     label: 'Nationality',     required: false, example: 'Indian' },
  { key: 'date_of_birth',   label: 'Date of Birth',   required: false, example: '1995-03-15' },
  { key: 'personal_email',  label: 'Personal Email',  required: false, example: 'john@gmail.com' },
  { key: 'offered_ctc',     label: 'Offered CTC',     required: false, example: '800000' },
  { key: 'source',          label: 'Source',          required: false, example: 'Recruitment' },
  { key: 'notes',           label: 'Notes',           required: false, example: 'Referred by CEO' },
];

const VALID_EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Intern', 'Consultant'];
const VALID_WORK_MODES = ['On-site', 'Remote', 'Hybrid'];
const VALID_GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const VALID_SOURCES = ['Recruitment', 'Direct', 'Referral', 'Bulk Upload', 'Other'];

interface BulkRow {
  rowNum: number;
  raw: Record<string, string>;
  errors: string[];
  parsed?: Partial<OnboardingCandidate>;
}

function validateBulkRow(raw: Record<string, string>, rowNum: number, existingEmails: Set<string>, seenEmails: Set<string>): BulkRow {
  const errors: string[] = [];

  // Required fields
  const name = raw['name']?.trim();
  const email = raw['email']?.trim().toLowerCase();
  const position = raw['position']?.trim();
  const department = raw['department']?.trim();
  const joiningDate = raw['joining_date']?.trim();

  if (!name) errors.push('Name is required');
  else if (name.length < 2) errors.push('Name must be at least 2 characters');

  if (!email) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Invalid email format');
  } else if (existingEmails.has(email)) {
    errors.push('Email already exists in the system');
  } else if (seenEmails.has(email)) {
    errors.push('Duplicate email in this import file');
  }

  if (!position) errors.push('Position is required');
  if (!department) errors.push('Department is required');

  if (!joiningDate) {
    errors.push('Joining Date is required');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(joiningDate)) {
    errors.push('Joining Date must be in YYYY-MM-DD format');
  } else {
    const d = new Date(joiningDate);
    if (isNaN(d.getTime())) errors.push('Joining Date is not a valid date');
  }

  // Optional field validations
  const phone = raw['phone']?.trim();
  if (phone && !/^[\d\s+\-().]{7,20}$/.test(phone)) errors.push('Phone number format is invalid');

  const personalEmail = raw['personal_email']?.trim();
  if (personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) errors.push('Personal email format is invalid');

  const dob = raw['date_of_birth']?.trim();
  if (dob) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      errors.push('Date of Birth must be in YYYY-MM-DD format');
    } else {
      const d = new Date(dob);
      if (isNaN(d.getTime())) errors.push('Date of Birth is not valid');
      else if (d > new Date()) errors.push('Date of Birth cannot be in the future');
    }
  }

  const empType = raw['employment_type']?.trim();
  if (empType && !VALID_EMPLOYMENT_TYPES.map(s => s.toLowerCase()).includes(empType.toLowerCase())) {
    errors.push(`Employment Type must be one of: ${VALID_EMPLOYMENT_TYPES.join(', ')}`);
  }

  const workMode = raw['work_mode']?.trim();
  if (workMode && !VALID_WORK_MODES.map(s => s.toLowerCase()).includes(workMode.toLowerCase())) {
    errors.push(`Work Mode must be one of: ${VALID_WORK_MODES.join(', ')}`);
  }

  const gender = raw['gender']?.trim();
  if (gender && !VALID_GENDERS.map(s => s.toLowerCase()).includes(gender.toLowerCase())) {
    errors.push(`Gender must be one of: ${VALID_GENDERS.join(', ')}`);
  }

  const source = raw['source']?.trim();
  if (source && !VALID_SOURCES.map(s => s.toLowerCase()).includes(source.toLowerCase())) {
    errors.push(`Source must be one of: ${VALID_SOURCES.join(', ')}`);
  }

  const offeredCtc = raw['offered_ctc']?.trim();
  if (offeredCtc && isNaN(Number(offeredCtc))) errors.push('Offered CTC must be a numeric value');

  if (errors.length === 0 && email) seenEmails.add(email);

  const parsed: Partial<OnboardingCandidate> = errors.length === 0 ? {
    name: name!,
    email: email!,
    position: position!,
    department: department!,
    joiningDate: joiningDate!,
    phone: phone || '',
    location: raw['location']?.trim() || '',
    manager: raw['manager']?.trim() || '',
    employmentType: empType || 'Full-time',
    workMode: workMode || 'On-site',
    gender: gender || '',
    nationality: raw['nationality']?.trim() || '',
    dateOfBirth: dob || '',
    personalEmail: personalEmail || '',
    offeredCTC: offeredCtc || '',
    source: (source as OnboardingCandidate['source']) || 'Bulk Upload',
    notes: raw['notes']?.trim() || '',
    status: 'Pending',
    progress: 0,
  } : undefined;

  return { rowNum, raw, errors, parsed };
}

function BulkImportModal({ onClose, onImported, existingEmails }: {
  onClose: () => void;
  onImported: (rows: Partial<OnboardingCandidate>[]) => Promise<void>;
  existingEmails: Set<string>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'review' | 'importing' | 'done'>('upload');
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
  const [dragging, setDragging] = useState(false);

  const validRows = rows.filter(r => r.errors.length === 0);
  const invalidRows = rows.filter(r => r.errors.length > 0);

  async function parseFile(file: File) {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Please upload an Excel (.xlsx, .xls) or CSV file');
      return;
    }
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (json.length === 0) { toast.error('The file contains no data rows'); return; }
      if (json.length > 500) { toast.error('Maximum 500 rows per import'); return; }

      // Normalize header keys: lowercase + replace spaces/special chars with underscore
      const normalize = (k: string) => k.toLowerCase().replace(/[\s\-/]+/g, '_').trim();
      const seenEmails = new Set<string>();
      const parsed = json.map((rawRow, i) => {
        const normalized: Record<string, string> = {};
        for (const [k, v] of Object.entries(rawRow)) {
          normalized[normalize(k)] = v instanceof Date
            ? v.toISOString().split('T')[0]
            : String(v ?? '').trim();
        }
        return validateBulkRow(normalized, i + 2, existingEmails, seenEmails);
      });

      setRows(parsed);
      setStep('review');
    } catch (err: unknown) {
      toast.error(`Failed to parse file: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  }

  async function handleImport() {
    if (validRows.length === 0) return;
    setStep('importing');
    let success = 0; let failed = 0;
    for (let i = 0; i < validRows.length; i++) {
      try {
        await onImported([validRows[i].parsed!]);
        success++;
      } catch {
        failed++;
      }
      setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
    }
    setImportResults({ success, failed });
    setStep('done');
  }

  async function downloadTemplate() {
    const XLSX = await import('xlsx');
    const headers = BULK_COLUMNS.map(c => c.label);
    const example = BULK_COLUMNS.map(c => c.example);
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    // Set column widths
    ws['!cols'] = BULK_COLUMNS.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bulk Onboarding');
    XLSX.writeFile(wb, 'bulk_onboarding_template.xlsx');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Table2 size={16} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Bulk Import Joiners</h2>
              <p className="text-xs text-muted-foreground">Upload an Excel or CSV file to onboard multiple employees at once</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Template download */}
              <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-blue-900">Download Template</p>
                  <p className="text-xs text-blue-700 mt-0.5">Use the provided template to ensure correct column format</p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-700 border border-blue-300 bg-white rounded-lg hover:bg-blue-50"
                >
                  <Download size={14} /> Download Template
                </button>
              </div>

              {/* Column reference */}
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">Column Reference</p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Column Name</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Required</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Example Value</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Allowed Values</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {BULK_COLUMNS.map(col => (
                        <tr key={col.key} className="hover:bg-muted/50">
                          <td className="px-3 py-1.5 font-mono text-foreground">{col.label}</td>
                          <td className="px-3 py-1.5">
                            {col.required
                              ? <span className="text-red-600 font-medium">Required</span>
                              : <span className="text-muted-foreground">Optional</span>}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">{col.example}</td>
                          <td className="px-3 py-1.5 text-muted-foreground text-[11px]">
                            {col.key === 'employment_type' ? VALID_EMPLOYMENT_TYPES.join(', ') :
                             col.key === 'work_mode' ? VALID_WORK_MODES.join(', ') :
                             col.key === 'gender' ? VALID_GENDERS.join(', ') :
                             col.key === 'source' ? VALID_SOURCES.join(', ') :
                             col.key === 'joining_date' || col.key === 'date_of_birth' ? 'YYYY-MM-DD' :
                             '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`cursor-pointer border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 transition-colors ${dragging ? 'border-blue-500 bg-blue-50' : 'border-border hover:border-blue-400 hover:bg-muted/50'}`}
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Upload size={22} className="text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Drop your file here or <span className="text-blue-600 underline">browse</span></p>
                  <p className="text-xs text-muted-foreground mt-1">Supports .xlsx, .xls, .csv — max 500 rows</p>
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
              </div>
            </div>
          )}

          {/* Step: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold text-foreground">{rows.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total Rows</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-700">{validRows.length}</p>
                  <p className="text-xs text-green-700 mt-0.5">Ready to Import</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600">{invalidRows.length}</p>
                  <p className="text-xs text-red-600 mt-0.5">Rows with Errors</p>
                </div>
              </div>

              {invalidRows.length > 0 && (
                <div className="rounded-lg border border-red-200 overflow-hidden">
                  <div className="px-3 py-2 bg-red-50 border-b border-red-200">
                    <p className="text-sm font-medium text-red-700">Rows with Validation Errors (will be skipped)</p>
                  </div>
                  <div className="divide-y divide-border max-h-56 overflow-y-auto">
                    {invalidRows.map(row => (
                      <div key={row.rowNum} className="px-3 py-2 flex items-start gap-3">
                        <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground">Row {row.rowNum}: {row.raw['name'] || '(no name)'} — {row.raw['email'] || '(no email)'}</p>
                          <ul className="mt-0.5 space-y-0.5">
                            {row.errors.map((e, i) => (
                              <li key={i} className="text-xs text-red-600">• {e}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validRows.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="px-3 py-2 bg-green-50 border-b border-green-200">
                    <p className="text-sm font-medium text-green-700">Valid Rows — Preview</p>
                  </div>
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          {['Row', 'Name', 'Email', 'Position', 'Department', 'Joining Date', 'Location', 'Employment Type'].map(h => (
                            <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {validRows.map(row => (
                          <tr key={row.rowNum} className="hover:bg-muted/50">
                            <td className="px-3 py-1.5 text-muted-foreground">{row.rowNum}</td>
                            <td className="px-3 py-1.5 font-medium text-foreground whitespace-nowrap">{row.parsed?.name}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{row.parsed?.email}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{row.parsed?.position}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{row.parsed?.department}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{row.parsed?.joiningDate}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{row.parsed?.location || '—'}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{row.parsed?.employmentType || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {validRows.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground bg-muted rounded-lg">
                  No valid rows to import. Please fix the errors above and upload again.
                </div>
              )}
            </div>
          )}

          {/* Step: Importing */}
          {step === 'importing' && (
            <div className="py-12 flex flex-col items-center gap-6">
              <Loader2 size={40} className="animate-spin text-blue-600" />
              <div className="w-full max-w-sm">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Importing employees…</span>
                  <span className="font-medium text-foreground">{importProgress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Please wait — do not close this window</p>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <div className="py-10 flex flex-col items-center gap-4 text-center">
              <CheckCircle2 size={48} className="text-green-500" />
              <h3 className="text-lg font-semibold text-foreground">Import Complete</h3>
              <div className="flex gap-6">
                <div>
                  <p className="text-3xl font-bold text-green-600">{importResults.success}</p>
                  <p className="text-sm text-muted-foreground">Imported Successfully</p>
                </div>
                {importResults.failed > 0 && (
                  <div>
                    <p className="text-3xl font-bold text-red-500">{importResults.failed}</p>
                    <p className="text-sm text-muted-foreground">Failed</p>
                  </div>
                )}
              </div>
              {importResults.failed > 0 && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                  Some rows failed during import. They may already exist or have server-side validation errors.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30 rounded-b-xl gap-3">
          <div className="text-xs text-muted-foreground">
            {step === 'upload' && 'Supported formats: .xlsx, .xls, .csv'}
            {step === 'review' && `${validRows.length} of ${rows.length} rows will be imported`}
            {step === 'importing' && 'Import in progress…'}
            {step === 'done' && `Import finished — ${importResults.success} employees added`}
          </div>
          <div className="flex gap-2">
            {(step === 'upload' || step === 'review') && (
              <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted text-foreground">
                Cancel
              </button>
            )}
            {step === 'review' && (
              <button onClick={() => { setRows([]); setStep('upload'); }} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted text-foreground">
                Upload Different File
              </button>
            )}
            {step === 'review' && validRows.length > 0 && (
              <button onClick={handleImport} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">
                Import {validRows.length} Joiner{validRows.length !== 1 ? 's' : ''}
              </button>
            )}
            {step === 'done' && (
              <button onClick={onClose} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export function OnboardingPortalDB({ accessToken, onLogout }: { accessToken: string; onLogout: () => void }) {
  const { currentUser } = useUser();
  const { employees, loading, error, refresh, createEmployee, updateEmployee, deleteEmployee, updateTask, enableAccess, syncToDirectory } = useOnboardingData();

  const isHRAdmin = currentUser?.primaryRole === 'hr' || currentUser?.primaryRole === 'admin';
  const isManager = currentUser?.primaryRole === 'manager';
  const permManageOnboarding = useSectionPermission('onboarding', 'manage_onboarding');
  const permViewOnboarding = useSectionPermission('onboarding', 'view_onboarding');

  // Filter by role
  const visibleEmployees = useMemo(() => {
    if (isManager && currentUser?.department) {
      return employees.filter(e => e.department === currentUser.department);
    }
    if (!isHRAdmin && !isManager) {
      return employees.filter(e => e.email === currentUser?.email);
    }
    return employees;
  }, [employees, isHRAdmin, isManager, currentUser]);

  // Stats
  const stats = useMemo(() => {
    const total = visibleEmployees.length;
    const inProgress = visibleEmployees.filter(e => e.status === 'In Progress').length;
    const completed = visibleEmployees.filter(e => e.status === 'Completed').length;
    const avgProgress = total > 0
      ? Math.round(visibleEmployees.reduce((a, e) => a + (e.progress ?? 0), 0) / total)
      : 0;
    return { total, inProgress, completed, avgProgress };
  }, [visibleEmployees]);

  // Top-level tab
  const [mainTab, setMainTab] = useState<'onboarding' | 'offboarding'>('onboarding');

  // UI state
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<OnboardingCandidate | null>(null);
  const [detailEmployee, setDetailEmployee] = useState<OnboardingCandidate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OnboardingCandidate | null>(null);
  const [enableTarget, setEnableTarget] = useState<OnboardingCandidate | null>(null);
  const [enableTargetRoles, setEnableTargetRoles] = useState<string[]>(['employee']);
  const [enablingAccess, setEnablingAccess] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'Recruitment'>('all');
  const [showBulkImport, setShowBulkImport] = useState(false);

  const existingEmails = useMemo(
    () => new Set(employees.map(e => e.email?.toLowerCase()).filter(Boolean)),
    [employees]
  );

  const handleBulkImport = async (rows: Partial<OnboardingCandidate>[]) => {
    for (const row of rows) {
      await createEmployee(row);
    }
  };

  const handleSaveJoiner = async (data: Partial<OnboardingCandidate>) => {
    if (editingEmployee) {
      await updateEmployee(editingEmployee.id, data);
      toast.success('Joiner updated');
    } else {
      await createEmployee(data);
      toast.success('Joiner added');
    }
    setEditingEmployee(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEmployee(deleteTarget.id);
      toast.success('Joiner removed');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleEnableAccess = async (employee: OnboardingCandidate, roles?: string[]) => {
    setEnablingAccess(true);
    try {
      const result = await enableAccess(employee.id, roles ?? enableTargetRoles);
      if (result?.success) {
        const { tempPassword, email } = result.data ?? {};
        toast.success(
          `Access enabled for ${employee.name}. Temp password: ${tempPassword ?? '(see email)'}`,
          { duration: 10000 }
        );
        // Also notify the employee via notification
        void supabase.from('notifications').insert([{
          user_id: result.data?.userId ?? null,
          title: 'Your account has been created',
          message: `Welcome ${employee.name}! Your login email is ${email}. Please check your inbox or contact HR for your temporary password.`,
          type: 'success',
          app_filter: 'dashboard',
        }]);
        refresh();
      } else if (result?.alreadyExists) {
        toast.info(`Account already exists for ${employee.name}`);
      }
      return result;
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to enable access');
      return {};
    } finally {
      setEnablingAccess(false);
    }
  };

  const handleConfirmProbation = async (employee: OnboardingCandidate) => {
    await fetch(`${API_BASE}/onboarding/${employee.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ probation_confirmed: true, probation_confirmed_at: new Date().toISOString() }),
    });
    toast.success(`Probation confirmed for ${employee.name}`);
    refresh();
  };

  const handleUpdateTask = async (employee: OnboardingCandidate, taskId: string, completed: boolean) => {
    const updated = await updateTask(employee.id, taskId, completed);
    if (updated?.status === 'completed') {
      toast.success('Onboarding completed — employee record created in Directory');
      // Integration A2: Onboarding → Employee Directory
      void supabase.from('employees').upsert([{
        name: employee.name,
        email: employee.email,
        department: employee.department,
        job_title: employee.position,
        join_date: employee.joinDate,
        status: 'Active',
        onboarding_id: employee.id,
      }], { onConflict: 'email' });

      // Integration A13: Onboarding → Training (auto-enroll in mandatory courses)
      void (async () => {
        const { data: mandatoryCourses } = await supabase
          .from('training_courses')
          .select('id, title')
          .eq('status', 'Active')
          .eq('is_mandatory', true)
          .limit(10);

        if (mandatoryCourses && mandatoryCourses.length > 0) {
          // Find the employee record to get their id
          const { data: empRow } = await supabase
            .from('employees')
            .select('id')
            .eq('email', employee.email)
            .single();

          if (empRow) {
            const enrollments = mandatoryCourses.map(course => ({
              employee_id: empRow.id,
              course_id: course.id,
              status: 'enrolled',
              enrolled_at: new Date().toISOString(),
            }));
            await supabase.from('training_enrollments').upsert(enrollments, { onConflict: 'employee_id,course_id' });
            toast.success(`Auto-enrolled in ${mandatoryCourses.length} mandatory training course(s)`);
          }
        }
      })();

      // Notify manager
      if ((updated as any).manager_id) {
        void supabase.from('notifications').insert([{
          user_id: (updated as any).manager_id,
          title: 'Direct Report Added to Your Team',
          body: `${employee.name} has completed onboarding and is now active in the Employee Directory.`,
          type: 'info',
          app_filter: 'onboarding',
          is_read: false,
        }]);
      }
    }
  };

  // Apply search + source filter for display
  const displayEmployees = useMemo(() => {
    let list = visibleEmployees;
    if (sourceFilter === 'Recruitment') list = list.filter(e => e.source === 'Recruitment');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.position?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [visibleEmployees, search, sourceFilter]);

  // Kanban columns
  const kanbanColumns: { status: StatusType; label: string; color: string }[] = [
    { status: 'Pending', label: 'Pending', color: 'border-gray-300' },
    { status: 'In Progress', label: 'In Progress', color: 'border-blue-400' },
    { status: 'Completed', label: 'Completed', color: 'border-green-400' },
    { status: 'On Hold', label: 'On Hold', color: 'border-orange-400' },
  ];

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Users size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Onboarding Portal</h1>
            </div>
            {currentUser?.primaryRole && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 capitalize">
                {currentUser.primaryRole}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Tab switcher */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
              <button
                onClick={() => setMainTab('onboarding')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${mainTab === 'onboarding' ? 'bg-card shadow text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Users size={14} /> <span className="hidden sm:inline">Onboarding</span>
              </button>
              <button
                onClick={() => setMainTab('offboarding')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${mainTab === 'offboarding' ? 'bg-card shadow text-red-600 font-medium' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <LogOut size={14} /> <span className="hidden sm:inline">Offboarding</span>
              </button>
            </div>
            {mainTab === 'onboarding' && (isHRAdmin || permManageOnboarding) && (
              <>
                <button
                  onClick={() => setShowBulkImport(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border bg-card hover:bg-muted rounded-lg text-foreground"
                >
                  <Upload size={15} /> <span className="hidden sm:inline">Bulk Import</span>
                </button>
                <button
                  onClick={() => { setEditingEmployee(null); setShowForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  <Plus size={15} /> <span className="hidden sm:inline">Add New Joiner</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Offboarding tab */}
        {mainTab === 'offboarding' && (
          <OffboardingTab
            isHRAdmin={isHRAdmin}
            isManager={isManager}
            employees={employees.map(e => ({ id: e.id, name: e.name, department: e.department, position: e.position }))}
          />
        )}

        {/* Onboarding tab (default) — hidden when offboarding active */}
        {mainTab === 'onboarding' && <>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle size={16} /> {error}
            <button onClick={refresh} className="ml-auto underline">Retry</button>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Joiners', value: stats.total, color: 'text-blue-600' },
            { label: 'In Progress', value: stats.inProgress, color: 'text-blue-500' },
            { label: 'Completed', value: stats.completed, color: 'text-green-600' },
            { label: 'Avg Progress', value: `${stats.avgProgress}%`, color: 'text-purple-600' },
          ].map(card => (
            <div key={card.label} className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Pipeline stage funnel */}
        {(() => {
          const stages = [
            { label: 'Pre-boarding', statuses: ['Pre-boarding', 'Pending'] },
            { label: 'In Progress', statuses: ['In Progress'] },
            { label: 'Access Enabled', statuses: [] as string[], check: (e: OnboardingCandidate) => !!(e as any).portalAccessEnabled },
            { label: 'Completed', statuses: ['Completed'] },
          ];
          const total = visibleEmployees.length || 1;
          return (
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Onboarding Pipeline</p>
              <div className="flex items-stretch gap-1">
                {stages.map((stage, i) => {
                  const count = stage.check
                    ? visibleEmployees.filter(stage.check).length
                    : visibleEmployees.filter(e => stage.statuses.includes(e.status)).length;
                  const pct = Math.round((count / total) * 100);
                  const colors = ['bg-violet-100 text-violet-700', 'bg-blue-100 text-blue-700', 'bg-amber-100 text-amber-700', 'bg-green-100 text-green-700'];
                  return (
                    <div key={stage.label} className="flex-1 flex flex-col items-center gap-1">
                      <div className={`w-full rounded py-2 text-center text-xs font-semibold ${colors[i]}`}>
                        {count}
                      </div>
                      <div className="w-full h-1 rounded-full bg-gray-100 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${['bg-violet-400', 'bg-blue-400', 'bg-amber-400', 'bg-green-500'][i]}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center leading-tight">{stage.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Probation Due This Month — HR/Admin only */}
        {isHRAdmin && (() => {
          const probDue = visibleEmployees.filter(e => {
            if (!e.joiningDate) return false;
            const info = getProbationInfo(e.joiningDate);
            return !info.isComplete && info.daysRemaining >= 0 && info.daysRemaining <= 30;
          });
          if (probDue.length === 0) return null;
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-amber-600" />
                <p className="text-sm font-medium text-amber-800">
                  {probDue.length} employee{probDue.length > 1 ? 's' : ''} completing probation this month
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-amber-700 border-b border-amber-200">
                      <th className="pb-1 pr-4 font-medium">Name</th>
                      <th className="pb-1 pr-4 font-medium">Start Date</th>
                      <th className="pb-1 pr-4 font-medium">Probation End</th>
                      <th className="pb-1 font-medium">Days Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {probDue.map(e => {
                      const info = getProbationInfo(e.joiningDate!);
                      return (
                        <tr key={e.id} className="text-amber-900">
                          <td className="py-1 pr-4 font-medium">{e.name}</td>
                          <td className="py-1 pr-4">{e.joiningDate}</td>
                          <td className="py-1 pr-4">{fmtProbDate(info.end)}</td>
                          <td className="py-1 font-semibold">{info.daysRemaining}d</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Search + filter bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, position, or department…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg shrink-0">
            <button
              onClick={() => setSourceFilter('all')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${sourceFilter === 'all' ? 'bg-card shadow text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              All
            </button>
            <button
              onClick={() => setSourceFilter('Recruitment')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-colors ${sourceFilter === 'Recruitment' ? 'bg-violet-100 text-violet-700 shadow font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Briefcase size={11} /> From Recruitment
            </button>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${view === 'list' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <LayoutList size={15} /> List
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${view === 'kanban' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Columns size={15} /> Kanban
            </button>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {/* List view */}
        {!loading && view === 'list' && (
          <div className="bg-card rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Name / Position</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Dept</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Joining Date</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase min-w-[120px]">Progress</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="hidden md:table-cell px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Buddy</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-muted group cursor-pointer" onClick={() => setDetailEmployee(emp)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{emp.name}</p>
                        {emp.source === 'Recruitment' && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold bg-violet-100 text-violet-700 rounded px-1.5 py-0.5 whitespace-nowrap">
                            <Briefcase size={9} /> From Recruitment
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{emp.position}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{emp.department}</td>
                    <td className="px-4 py-3 text-muted-foreground">{emp.joiningDate}</td>
                    <td className="px-4 py-3 min-w-[120px]">
                      <ProgressBar value={emp.progress} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={emp.status} />
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">{emp.buddy || '—'}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setDetailEmployee(emp)}
                          title="View Checklist"
                          className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Eye size={14} />
                        </button>
                        {(isHRAdmin || isManager || permManageOnboarding) && (
                          <button
                            onClick={() => { setEditingEmployee(emp); setShowForm(true); }}
                            title="Edit"
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        {(isHRAdmin || permManageOnboarding) && (
                          <>
                            <button
                              onClick={() => { setEnableTarget(emp); setEnableTargetRoles(['employee']); }}
                              title="Enable Access"
                              className="p-1.5 text-muted-foreground hover:text-green-600 hover:bg-green-50 rounded"
                            >
                              <UserCheck size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(emp)}
                              title="Delete"
                              className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleEmployees.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      {search || sourceFilter !== 'all' ? 'No joiners match the current filters' : 'No joiners found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Kanban view */}
        {!loading && view === 'kanban' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kanbanColumns.map(col => {
              const colEmployees = displayEmployees.filter(e => e.status === col.status);
              return (
                <div key={col.status} className={`rounded-xl border-t-4 ${col.color} bg-muted p-3`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                    <span className="text-xs bg-card border border-border rounded-full px-2 py-0.5 text-muted-foreground">
                      {colEmployees.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {colEmployees.map(emp => (
                      <KanbanCard
                        key={emp.id}
                        employee={emp}
                        canManage={isHRAdmin}
                        onView={() => setDetailEmployee(emp)}
                        onEnableAccess={() => { setEnableTarget(emp); setEnableTargetRoles(['employee']); }}
                      />
                    ))}
                    {colEmployees.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">No joiners</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        </>}
      </main>

      {/* Bulk Import modal */}
      {showBulkImport && (
        <BulkImportModal
          existingEmails={existingEmails}
          onClose={() => { setShowBulkImport(false); refresh(); }}
          onImported={handleBulkImport}
        />
      )}

      {/* Joiner form modal */}
      {showForm && (
        <JoinerFormModal
          initial={editingEmployee ?? undefined}
          onSave={handleSaveJoiner}
          onClose={() => { setShowForm(false); setEditingEmployee(null); }}
        />
      )}

      {/* Detail modal */}
      {detailEmployee && (
        <DetailModal
          employee={detailEmployee}
          canManage={isHRAdmin}
          currentUserName={currentUser?.name}
          currentUserId={currentUser?.id}
          allEmployees={employees}
          onUpdateTask={(taskId, completed) => handleUpdateTask(detailEmployee, taskId, completed)}
          onSyncToDirectory={() => syncToDirectory(detailEmployee.id)}
          onEnableAccess={() => handleEnableAccess(detailEmployee)}
          onConfirmProbation={() => handleConfirmProbation(detailEmployee)}
          onAssignBuddy={async (buddyName, buddyEmail) => {
            await fetch(`${API_BASE}/onboarding/employees/${detailEmployee.id}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ buddy: buddyName, buddy_email: buddyEmail }),
            });
            toast.success(`Buddy assigned: ${buddyName}`);
            // notify buddy
            try {
              await fetch(`${API_BASE}/notifications`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: 'Buddy Assignment',
                  message: `You've been assigned as onboarding buddy to ${detailEmployee.name}. Please reach out to welcome them!`,
                  type: 'onboarding',
                  link: '/onboarding',
                }),
              });
            } catch { /* non-critical */ }
            refresh();
          }}
          onClose={() => setDetailEmployee(null)}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Joiner"
          message={`Are you sure you want to remove ${deleteTarget.name} from onboarding?`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Enable access confirm */}
      {enableTarget && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-foreground mb-1">Enable System Access</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Creates a login account for <span className="font-medium text-foreground">{enableTarget.name}</span> ({enableTarget.email}) and links them in the Employee Directory.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-muted-foreground mb-2">Assign Role</label>
              <div className="flex flex-wrap gap-2">
                {['employee', 'manager', 'hr', 'finance', 'it'].map(role => (
                  <button
                    key={role}
                    onClick={() => setEnableTargetRoles(prev =>
                      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
                    )}
                    className={`px-3 py-1.5 text-xs rounded-full border capitalize transition-colors ${
                      enableTargetRoles.includes(role)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:border-primary'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Selected: {enableTargetRoles.join(', ') || 'none (defaults to employee)'}</p>
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mb-4">
              A temporary password will be shown after creation. Share it securely with the employee.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => !enablingAccess && setEnableTarget(null)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
                disabled={enablingAccess}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const target = enableTarget;
                  setEnableTarget(null);
                  await handleEnableAccess(target);
                }}
                disabled={enablingAccess}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {enablingAccess && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {enablingAccess ? 'Enabling…' : 'Enable Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OnboardingPortalDB;
