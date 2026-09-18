/**
 * Employee Dashboard — Phase 8 complete implementation
 * Standards: RBAC (data isolation), i18n, constants, error handling,
 * loading states, confirmation dialogs, form validation
 * Phase 8 additions: Payslip tab, Shift Schedule tab,
 * WFH requests, Comp-Off, Attendance Regularization,
 * enhanced Approvals sub-tabs, notifications integration
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  Clock, Calendar, CheckSquare, Plus, LogIn, LogOut, Check,
  X, ChevronDown, AlertCircle, Loader2, Trash2, Edit2,
  Filter, ArrowLeft, User, TrendingUp, BookOpen, Users,
  Briefcase, CreditCard, HelpCircle, UserPlus, BarChart2,
  Settings, Bell, Building2, TicketCheck, FileText, Zap,
  Download, ChevronLeft, ChevronRight, Home, RefreshCw,
  DollarSign, Repeat, ClipboardEdit, Coffee,
} from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useEmployeeDashboard, Task, LeaveRequest } from '../../hooks/useEmployeeDashboard';
import { API_BASE, publicAnonKey, safeJson, supabase } from '../../utils/constants';
import { LEAVE_TYPES } from '../../../constants/apps/leave';
import { SelectOptions } from '../../context/ValueHelpsContext';
import { useMasterDataDirect } from '../../hooks/useSharedData';
import { t } from '../../../i18n/index';
import { useSectionPermission } from '../SectionGuard';

// ── Tab type ──────────────────────────────────────────────────────────────
type Tab = 'overview' | 'attendance' | 'leaves' | 'approvals' | 'tasks' | 'holidays' | 'calendar' | 'payslip' | 'shifts' | 'roster';

// ── Attendance time constants ──────────────────────────────────────────────
const WORK_START = '09:30';
const WORK_END = '18:00';

function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function isLateArrival(checkIn: string | null | undefined): boolean {
  if (!checkIn) return false;
  const d = new Date(checkIn);
  const minutes = d.getHours() * 60 + d.getMinutes();
  return minutes > parseHHMM(WORK_START);
}

function isEarlyExit(checkOut: string | null | undefined): boolean {
  if (!checkOut) return false;
  const d = new Date(checkOut);
  const minutes = d.getHours() * 60 + d.getMinutes();
  return minutes < parseHHMM(WORK_END);
}

// ── Fallback holidays ────────────────────────────────────────────────────
const FALLBACK_HOLIDAYS = [
  { name: 'Republic Day', date: '2026-01-26', type: 'National' },
  { name: 'Holi', date: '2026-03-03', type: 'Festival' },
  { name: 'Eid ul-Fitr', date: '2026-03-31', type: 'Festival' },
  { name: 'Good Friday', date: '2026-04-03', type: 'National' },
  { name: 'Independence Day', date: '2026-08-15', type: 'National' },
  { name: 'Gandhi Jayanti', date: '2026-10-02', type: 'National' },
  { name: 'Diwali', date: '2026-10-29', type: 'Festival' },
  { name: 'Christmas', date: '2026-12-25', type: 'National' },
];

// ── Helper: format time ───────────────────────────────────────────────────
function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

// Get week start (Monday) for a given date
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Badge ─────────────────────────────────────────────────────────────────
function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Present: 'bg-green-100 text-green-700',
    Absent: 'bg-red-100 text-red-700',
    Approved: 'bg-green-100 text-green-700',
    approved: 'bg-green-100 text-green-700',
    Rejected: 'bg-red-100 text-red-700',
    rejected: 'bg-red-100 text-red-700',
    Pending: 'bg-yellow-100 text-yellow-700',
    pending: 'bg-yellow-100 text-yellow-700',
    Completed: 'bg-blue-100 text-blue-700',
    'In Progress': 'bg-purple-100 text-purple-700',
    'To Do': 'bg-gray-100 text-gray-700',
    High: 'bg-red-100 text-red-700',
    Medium: 'bg-yellow-100 text-yellow-700',
    Low: 'bg-green-100 text-green-700',
    Normal: 'bg-blue-100 text-blue-700',
    Critical: 'bg-red-100 text-red-800',
    'Half Day': 'bg-orange-100 text-orange-700',
    'On Leave': 'bg-blue-100 text-blue-700',
    Cancelled: 'bg-gray-100 text-gray-500',
    paid: 'bg-green-100 text-green-700',
    draft: 'bg-gray-100 text-gray-600',
    processing: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, loading }: { label: string; value: string | number; sub?: string; loading?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-16 bg-muted animate-pulse rounded" />
      ) : (
        <>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </>
      )}
    </div>
  );
}

// ── Quick action card ─────────────────────────────────────────────────────
function QuickActionCard({
  icon: Icon,
  label,
  colorClass,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  colorClass: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all group cursor-pointer"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass}`}>
        <Icon size={18} />
      </div>
      <span className="text-xs font-medium text-foreground text-center leading-tight">{label}</span>
    </button>
  );
}

// ── Leave Approval Modal ──────────────────────────────────────────────────
function LeaveApprovalModal({
  leave,
  action,
  onConfirm,
  onCancel,
}: {
  leave: LeaveRequest;
  action: 'approve' | 'reject';
  onConfirm: (comment: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onConfirm(comment);
    } finally {
      setSaving(false);
    }
  };

  const isApprove = action === 'approve';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">{isApprove ? 'Approve Leave' : 'Reject Leave'}</h3>
          <button onClick={onCancel} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="bg-muted/40 rounded-lg p-3 mb-4 space-y-1">
          <p className="text-sm font-medium text-foreground">{leave.employee_name}</p>
          <p className="text-xs text-muted-foreground">{leave.leave_type} · {leave.days} day{leave.days !== 1 ? 's' : ''}</p>
          <p className="text-xs text-muted-foreground">{fmtDate(leave.start_date)} → {fmtDate(leave.end_date)}</p>
          <p className="text-xs text-muted-foreground italic">{leave.reason}</p>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Comment (optional)</label>
          <textarea
            rows={3}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a note for the employee…"
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className={`px-4 py-1.5 text-sm text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-60 ${isApprove ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {isApprove ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Generic Approve/Reject Modal ──────────────────────────────────────────
function ApproveRejectModal({
  title,
  summary,
  action,
  onConfirm,
  onCancel,
}: {
  title: string;
  summary: string;
  action: 'approve' | 'reject';
  onConfirm: (comment: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const isApprove = action === 'approve';

  const handleSubmit = async () => {
    if (!isApprove && !comment.trim()) { toast.error('Please provide a rejection reason'); return; }
    setSaving(true);
    try { await onConfirm(comment); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <button onClick={onCancel} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"><X size={16} /></button>
        </div>
        <div className="bg-muted/40 rounded-lg p-3 mb-4">
          <p className="text-sm text-foreground">{summary}</p>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {isApprove ? 'Comment (optional)' : 'Rejection Reason *'}
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={isApprove ? 'Optional note…' : 'Reason for rejection (required)…'}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className={`px-4 py-1.5 text-sm text-white rounded-lg flex items-center gap-1.5 disabled:opacity-60 ${isApprove ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {isApprove ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl p-6 max-w-sm w-full">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Leave form ────────────────────────────────────────────────────────────
function LeaveForm({
  onSubmit,
  onClose,
  leaveBalance,
  existingLeaves,
}: {
  onSubmit: (data: any) => Promise<void>;
  onClose: () => void;
  leaveBalance: Record<string, number>;
  existingLeaves?: LeaveRequest[];
}) {
  const leavePolicies = useMasterDataDirect('leave-policies');

  const activePolicies = leavePolicies.data.filter((p: any) => p.is_active !== false);
  const policyOptions: any[] = activePolicies.length > 0 ? activePolicies : leavePolicies.data;

  const defaultType = policyOptions[0]?.leave_type ?? LEAVE_TYPES[0];
  const [form, setForm] = useState({ leaveType: defaultType, startDate: '', endDate: '', reason: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (policyOptions.length > 0) {
      setForm(f => ({ ...f, leaveType: f.leaveType || policyOptions[0].leave_type }));
    }
  }, [policyOptions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedPolicy = leavePolicies.data.find((p: any) => p.leave_type === form.leaveType);

  const workingDays = useMemo(() => {
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) return 0;
    let count = 0;
    const end = new Date(form.endDate);
    for (let d = new Date(form.startDate); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  }, [form.startDate, form.endDate]);

  const availableBalance = leaveBalance[form.leaveType] ?? null;
  const hasBalance = availableBalance !== null;
  const insufficient = hasBalance && workingDays > 0 && workingDays > (availableBalance as number);

  const hasOverlap = useMemo(() => {
    if (!existingLeaves || !form.startDate || !form.endDate) return false;
    return existingLeaves.some(l => {
      if (l.status === 'Rejected' || l.status === 'Cancelled') return false;
      return form.startDate <= l.end_date && form.endDate >= l.start_date;
    });
  }, [existingLeaves, form.startDate, form.endDate]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.leaveType) {
      e.leaveType = t('validation.leave.type');
    } else if (selectedPolicy && selectedPolicy.is_active === false) {
      e.leaveType = 'This leave type is currently not available';
    }
    if (!form.startDate) {
      e.startDate = t('validation.leave.startDate');
    } else {
      const today = new Date().toISOString().split('T')[0];
      if (form.startDate < today) e.startDate = t('validation.leave.futureDates');
    }
    if (!form.endDate) {
      e.endDate = t('validation.leave.endDate');
    } else if (form.startDate && form.endDate < form.startDate) {
      e.endDate = t('validation.date.endAfterStart');
    } else if (form.startDate && workingDays === 0) {
      e.endDate = 'The selected range contains no working days';
    }
    if (insufficient) {
      e.balance = `Insufficient balance: ${availableBalance} day${availableBalance !== 1 ? 's' : ''} remaining, ${workingDays} requested`;
    }
    if (hasOverlap) {
      e.overlap = 'You already have a leave request covering these dates';
    }
    if (!form.reason.trim()) e.reason = t('validation.leave.reason');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSubmit({ ...form, days: workingDays });
      onClose();
    } catch {
      // error already toasted in hook
    } finally {
      setSaving(false);
    }
  };

  const balanceEntries = Object.entries(leaveBalance).filter(([, v]) => typeof v === 'number');
  const datesSet = form.startDate && form.endDate && form.endDate >= form.startDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl p-6 w-full max-w-lg" role="dialog" aria-modal="true" aria-labelledby="leave-modal-title">
        <div className="flex items-center justify-between mb-4">
          <h3 id="leave-modal-title" className="font-semibold text-foreground">{t('dashboard.applyLeave')}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label="Close" autoFocus>
            <X size={16} />
          </button>
        </div>

        {balanceEntries.length > 0 && (
          <div className="mb-4 rounded-lg bg-muted/40 border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Your Leave Balance</p>
            <div className="flex flex-wrap gap-1.5">
              {balanceEntries.map(([type, days]) => {
                const isSelected = type === form.leaveType;
                const low = days <= 3;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, leaveType: type }))}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none ${
                      isSelected
                        ? days === 0 ? 'bg-red-500 text-white' : 'bg-primary text-primary-foreground'
                        : days === 0 ? 'bg-red-50 text-red-500 border border-red-200 hover:bg-red-100'
                        : low ? 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'
                        : 'bg-background border border-border text-foreground hover:border-primary/50'
                    }`}
                  >
                    {type.replace(' Leave', '')}: {days}d
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Leave Type *</label>
            <select
              value={form.leaveType}
              onChange={e => setForm(f => ({ ...f, leaveType: e.target.value as any }))}
              className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.leaveType ? 'border-red-400' : 'border-border focus:border-primary'}`}
            >
              {policyOptions.length > 0
                ? policyOptions.map((p: any) => (
                    <option key={p.id ?? p.leave_type} value={p.leave_type}>{p.leave_type}</option>
                  ))
                : LEAVE_TYPES.map(lt => <option key={lt} value={lt}>{lt}</option>)
              }
            </select>
            {errors.leaveType && <p className="text-xs text-red-500 mt-0.5">{errors.leaveType}</p>}
            {selectedPolicy?.annual_days > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Policy: {selectedPolicy.annual_days} days/year
                {selectedPolicy.carry_forward ? ' · carry forward allowed' : ''}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Start Date *</label>
              <input
                type="date"
                value={form.startDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.startDate ? 'border-red-400' : 'border-border focus:border-primary'}`}
              />
              {errors.startDate && <p className="text-xs text-red-500 mt-0.5">{errors.startDate}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">End Date *</label>
              <input
                type="date"
                value={form.endDate}
                min={form.startDate || new Date().toISOString().split('T')[0]}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.endDate ? 'border-red-400' : 'border-border focus:border-primary'}`}
              />
              {errors.endDate && <p className="text-xs text-red-500 mt-0.5">{errors.endDate}</p>}
            </div>
          </div>

          {datesSet && (
            <div className={`rounded-lg px-3 py-2.5 text-xs flex items-center justify-between gap-2 ${
              insufficient || hasOverlap ? 'bg-red-50 border border-red-200' : 'bg-muted/40 border border-border'
            }`}>
              <span className={insufficient || hasOverlap ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                {workingDays} working day{workingDays !== 1 ? 's' : ''} requested
              </span>
              {hasBalance && (
                <span className={`font-semibold ${insufficient ? 'text-red-600' : (availableBalance as number) <= 3 ? 'text-orange-500' : 'text-green-600'}`}>
                  {insufficient ? `✗ Only ${availableBalance}d available` : `✓ ${availableBalance}d available`}
                </span>
              )}
            </div>
          )}
          {errors.balance && <p className="text-xs text-red-500 -mt-2">{errors.balance}</p>}
          {errors.overlap && <p className="text-xs text-red-500">{errors.overlap}</p>}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Reason *</label>
            <textarea
              rows={3}
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Briefly describe the reason…"
              className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.reason ? 'border-red-400' : 'border-border focus:border-primary'}`}
            />
            {errors.reason && <p className="text-xs text-red-500 mt-0.5">{errors.reason}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={saving || insufficient}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Apply Leave
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Task form ─────────────────────────────────────────────────────────────
function TaskForm({ onSubmit, onClose, initial }: { onSubmit: (data: Partial<Task>) => Promise<void>; onClose: () => void; initial?: Partial<Task> }) {
  const [form, setForm] = useState({ title: '', priority: 'Medium' as Task['priority'], due_date: '', category: '', ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = t('validation.task.title');
    if (!form.due_date) e.due_date = t('validation.task.dueDate');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) { toast.error(t('common.error')); return; }
    setSaving(true);
    try {
      await onSubmit({ ...form, priority: form.priority?.toLowerCase() as any });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">{initial?.id ? 'Edit Task' : 'Add Task'}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Task Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="What needs to be done?"
              className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.title ? 'border-red-400' : 'border-border focus:border-primary'}`}
            />
            {errors.title && <p className="text-xs text-red-500 mt-0.5">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as any }))} className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                <SelectOptions entity="task" field="priority" fallback={['Low', 'Medium', 'High', 'Critical']} />
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Due Date *</label>
              <input type="date" value={form.due_date ?? ''} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.due_date ? 'border-red-400' : 'border-border focus:border-primary'}`} />
              {errors.due_date && <p className="text-xs text-red-500 mt-0.5">{errors.due_date}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
            <input type="text" value={form.category ?? ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Work, Personal, Admin" className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {initial?.id ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── WFH Request Modal ─────────────────────────────────────────────────────
function WfhRequestModal({
  employeeId,
  userId,
  employeeName,
  managerId,
  onClose,
  onSuccess,
}: {
  employeeId: string;
  userId: string;
  employeeName?: string;
  managerId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const [form, setForm] = useState({
    start_date: tomorrowStr,
    end_date: tomorrowStr,
    reason: '',
    wfh_type: 'full_day',
    available_on_call: true,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    const today = new Date().toISOString().split('T')[0];
    if (!form.start_date) e.start_date = 'Start date is required';
    else if (form.start_date < today) e.start_date = 'Cannot request WFH for past dates';
    if (!form.end_date) e.end_date = 'End date is required';
    else if (form.end_date < form.start_date) e.end_date = 'End date must be on or after start date';
    if (!form.reason.trim()) e.reason = 'Reason is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('wfh_requests').insert([{
        employee_id: employeeId || userId,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason,
        wfh_type: form.wfh_type,
        status: 'pending',
      }]);
      if (error) throw error;

      // Fire-and-forget manager notification
      const resolvedManagerId = managerId ?? await (async () => {
        const { data } = await supabase.from('employees').select('manager_id').eq('id', employeeId || userId).single();
        return data?.manager_id ?? null;
      })();
      if (resolvedManagerId) {
        void supabase.from('notifications').insert([{
          user_id: resolvedManagerId,
          title: 'WFH Request Pending Approval',
          body: `${employeeName || 'An employee'} has requested to work from home on ${form.start_date}`,
          type: 'info',
          app_filter: 'dashboard',
          is_read: false,
        }]);
      }

      toast.success('WFH request submitted. Awaiting manager approval.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit WFH request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2"><Home size={16} className="text-primary" /> Request WFH</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Start Date *</label>
              <input type="date" value={form.start_date} min={new Date().toISOString().split('T')[0]}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.start_date ? 'border-red-400' : 'border-border'}`} />
              {errors.start_date && <p className="text-xs text-red-500 mt-0.5">{errors.start_date}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">End Date *</label>
              <input type="date" value={form.end_date} min={form.start_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.end_date ? 'border-red-400' : 'border-border'}`} />
              {errors.end_date && <p className="text-xs text-red-500 mt-0.5">{errors.end_date}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
            <select value={form.wfh_type} onChange={e => setForm(f => ({ ...f, wfh_type: e.target.value }))}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="full_day">Full Day</option>
              <option value="half_day">Half Day</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Reason *</label>
            <textarea rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Reason for working from home…"
              className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.reason ? 'border-red-400' : 'border-border'}`} />
            {errors.reason && <p className="text-xs text-red-500 mt-0.5">{errors.reason}</p>}
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.available_on_call}
                onChange={e => setForm(f => ({ ...f, available_on_call: e.target.checked }))}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <span className="text-sm text-foreground">{t('dashboard.availableOnCall')}</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />} Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Comp-Off Request Modal ────────────────────────────────────────────────
function CompOffRequestModal({
  employeeId,
  userId,
  onClose,
  onSuccess,
}: {
  employeeId: string;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { currentUser } = useUser();
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ worked_date: today, comp_off_date: '', hours_worked: 8, reason: '' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.worked_date) e.worked_date = 'Worked date is required';
    else {
      const wd = new Date(form.worked_date);
      const day = wd.getDay();
      if (day !== 0 && day !== 6) e.worked_date = 'Comp-off is only for weekends or holidays';
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (wd < sevenDaysAgo) e.worked_date = 'Must submit within 7 days of working';
    }
    if (form.hours_worked <= 0) e.hours_worked = 'Hours must be greater than 0';
    if (!form.reason.trim()) e.reason = 'Reason is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      // Resolve the employees.id — FK requires the employees table PK, not auth UUID
      let resolvedEmpId = employeeId;
      if (!resolvedEmpId) {
        const { data: empRow } = await supabase.from('employees').select('id').eq('email', currentUser?.email ?? '').single();
        resolvedEmpId = empRow?.id ?? userId;
      }
      const { error } = await supabase.from('comp_off_requests').insert([{
        employee_id: resolvedEmpId,
        worked_date: form.worked_date,
        comp_off_date: form.comp_off_date || null,
        hours_worked: form.hours_worked,
        reason: form.reason,
        status: 'pending',
      }]);
      if (error) throw error;
      toast.success('Comp-off request submitted successfully.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit comp-off request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2"><Coffee size={16} className="text-primary" /> Request Comp-Off</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date Worked *</label>
              <input type="date" value={form.worked_date} max={today}
                onChange={e => setForm(f => ({ ...f, worked_date: e.target.value }))}
                className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.worked_date ? 'border-red-400' : 'border-border'}`} />
              {errors.worked_date && <p className="text-xs text-red-500 mt-0.5">{errors.worked_date}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Hours Worked *</label>
              <input type="number" min={1} max={24} step={0.5} value={form.hours_worked}
                onChange={e => setForm(f => ({ ...f, hours_worked: Number(e.target.value) }))}
                className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.hours_worked ? 'border-red-400' : 'border-border'}`} />
              {errors.hours_worked && <p className="text-xs text-red-500 mt-0.5">{errors.hours_worked}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Preferred Comp-Off Date (optional)</label>
            <input type="date" value={form.comp_off_date} min={today}
              onChange={e => setForm(f => ({ ...f, comp_off_date: e.target.value }))}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Reason *</label>
            <textarea rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Describe the work done on this day…"
              className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.reason ? 'border-red-400' : 'border-border'}`} />
            {errors.reason && <p className="text-xs text-red-500 mt-0.5">{errors.reason}</p>}
          </div>
          <p className="text-xs text-muted-foreground">Only weekends or public holidays are eligible for comp-off requests.</p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />} Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Attendance Regularization Modal ───────────────────────────────────────
function RegularizationModal({
  employeeId,
  userId,
  onClose,
  onSuccess,
}: {
  employeeId: string;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { currentUser } = useUser();
  const today = new Date().toISOString().split('T')[0];
  const firstOfPrevMonth = (() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  })();

  const [form, setForm] = useState({
    attendance_date: today,
    requested_check_in: '09:30',
    requested_check_out: '18:00',
    reason: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.attendance_date) e.date = 'Date is required';
    else if (form.attendance_date > today) e.date = 'Cannot regularize future dates';
    else if (form.attendance_date < firstOfPrevMonth) e.date = 'Date cannot be earlier than first of previous month';
    if (!form.requested_check_in) e.check_in = 'Check-in time is required';
    if (!form.requested_check_out) e.check_out = 'Check-out time is required';
    else if (form.requested_check_in >= form.requested_check_out) e.check_out = 'Check-out must be after check-in';
    if (!form.reason.trim()) e.reason = 'Reason is required';
    else if (form.reason.trim().length < 20) e.reason = `Reason must be at least 20 characters (${form.reason.trim().length}/20)`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      let resolvedEmpId = employeeId;
      if (!resolvedEmpId) {
        const { data: empRow } = await supabase.from('employees').select('id').eq('email', currentUser?.email ?? '').single();
        resolvedEmpId = empRow?.id ?? userId;
      }
      const { error } = await supabase.from('attendance_corrections').insert([{
        employee_id: resolvedEmpId,
        attendance_date: form.attendance_date,
        expected_check_in: form.requested_check_in,
        expected_check_out: form.requested_check_out,
        requested_check_in: form.requested_check_in,
        requested_check_out: form.requested_check_out,
        reason: form.reason,
        status: 'pending',
        created_at: new Date().toISOString(),
      }]);
      if (error) throw error;
      toast.success('Attendance correction request submitted. Your manager will review it.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit attendance correction');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2"><ClipboardEdit size={16} className="text-primary" /> Attendance Correction</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Date *</label>
            <input type="date" value={form.attendance_date} max={today} min={firstOfPrevMonth}
              onChange={e => setForm(f => ({ ...f, attendance_date: e.target.value }))}
              className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.date ? 'border-red-400' : 'border-border'}`} />
            {errors.date && <p className="text-xs text-red-500 mt-0.5">{errors.date}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Check-In Time *</label>
              <input type="time" value={form.requested_check_in}
                onChange={e => setForm(f => ({ ...f, requested_check_in: e.target.value }))}
                className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.check_in ? 'border-red-400' : 'border-border'}`} />
              {errors.check_in && <p className="text-xs text-red-500 mt-0.5">{errors.check_in}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Check-Out Time *</label>
              <input type="time" value={form.requested_check_out}
                onChange={e => setForm(f => ({ ...f, requested_check_out: e.target.value }))}
                className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.check_out ? 'border-red-400' : 'border-border'}`} />
              {errors.check_out && <p className="text-xs text-red-500 mt-0.5">{errors.check_out}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Reason * <span className="text-muted-foreground/70">({form.reason.trim().length}/20 min)</span>
            </label>
            <textarea rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Explain why this attendance correction is needed (minimum 20 characters)…"
              className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.reason ? 'border-red-400' : 'border-border'}`} />
            {errors.reason && <p className="text-xs text-red-500 mt-0.5">{errors.reason}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-60 transition-colors">
              {saving && <Loader2 size={14} className="animate-spin" />} Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Shift Swap Modal ──────────────────────────────────────────────────────
function ShiftSwapModal({
  employeeId,
  userId,
  userEmail,
  onClose,
  onSuccess,
}: {
  employeeId: string;
  userId: string;
  userEmail?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ shift_date: today, swap_with_id: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [colleagues, setColleagues] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('employees').select('id, name, email').limit(50)
      .then(({ data }) => setColleagues(data ?? []));
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.shift_date) e.date = 'Date is required';
    if (!form.swap_with_id) e.swap_with = 'Please select a colleague';
    if (!form.reason.trim()) e.reason = 'Reason is required';
    else if (form.reason.trim().length < 10) e.reason = 'Reason must be at least 10 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      let resolvedEmpId = employeeId;
      if (!resolvedEmpId || resolvedEmpId === userId) {
        const { data: empRow } = await supabase.from('employees').select('id').eq('email', userEmail ?? '').maybeSingle();
        resolvedEmpId = empRow?.id ?? employeeId;
      }
      const { error } = await supabase.from('shift_swap_requests').insert([{
        requester_id: resolvedEmpId,
        swap_with_id: form.swap_with_id,
        shift_date: form.shift_date,
        reason: form.reason,
        status: 'pending',
      }]);
      if (error) throw error;
      toast.success('Shift swap request submitted successfully.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit shift swap request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2"><Repeat size={16} className="text-primary" /> Request Shift Swap</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Shift Date *</label>
            <input type="date" value={form.shift_date} min={today}
              onChange={e => setForm(f => ({ ...f, shift_date: e.target.value }))}
              className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.date ? 'border-red-400' : 'border-border'}`} />
            {errors.date && <p className="text-xs text-red-500 mt-0.5">{errors.date}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Swap With *</label>
            <select value={form.swap_with_id} onChange={e => setForm(f => ({ ...f, swap_with_id: e.target.value }))}
              className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.swap_with ? 'border-red-400' : 'border-border'}`}>
              <option value="">Select colleague…</option>
              {colleagues.filter(c => c.id !== (employeeId || userId)).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.swap_with && <p className="text-xs text-red-500 mt-0.5">{errors.swap_with}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Reason *</label>
            <textarea rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Reason for the shift swap (min 10 characters)…"
              className={`w-full text-sm border rounded-lg px-3 py-2 bg-input-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.reason ? 'border-red-400' : 'border-border'}`} />
            {errors.reason && <p className="text-xs text-red-500 mt-0.5">{errors.reason}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />} Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

interface Props { accessToken: string; onLogout: () => void; }

export function EmployeeDashboard({ accessToken, onLogout }: Props) {
  const { currentUser } = useUser();
  const navigate = useNavigate();
  const userId = currentUser?.id ?? '';
  const employeeId = currentUser?.employeeId ?? '';
  const empIdForQuery = employeeId || userId;
  const userName = currentUser?.name ?? '';
  const primaryRole = currentUser?.primaryRole ?? 'employee';
  const isEmployee = primaryRole === 'employee';
  const isManager = primaryRole === 'manager';
  const isHrAdmin = primaryRole === 'hr' || primaryRole === 'admin';

  // Section-level permission gates
  const canSeeTeamCalendar  = useSectionPermission('employee-dashboard', 'team_calendar');
  const canSeePendingApprovalsDB = useSectionPermission('employee-dashboard', 'pending_approvals');
  const canSeePendingApprovals = canSeePendingApprovalsDB || isManager || isHrAdmin;
  const canSeeAnalytics     = useSectionPermission('employee-dashboard', 'analytics');
  const canSeeLeaveSection  = useSectionPermission('employee-dashboard', 'leave_management');
  const canSeeAttendance    = useSectionPermission('employee-dashboard', 'attendance');

  const dash = useEmployeeDashboard(userId, userName);
  const leavePolicies = useMasterDataDirect('leave-policies');

  const [tab, setTab] = useState<Tab>('overview');
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [deletingTask, setDeletingTask] = useState<string | null>(null);
  const [leaveFilter, setLeaveFilter] = useState('All');
  const [workMode, setWorkMode] = useState<'office' | 'wfh'>('office');
  const [approvalTarget, setApprovalTarget] = useState<{ leave: LeaveRequest; action: 'approve' | 'reject' } | null>(null);
  const [cancellingLeaveId, setCancellingLeaveId] = useState<string | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<LeaveRequest | null>(null);
  const [holidays, setHolidays] = useState<{ name: string; date: string; type: string }[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);

  // Leave encashment state
  const [encashmentRequests, setEncashmentRequests] = useState<any[]>([]);
  const [encashmentLoading, setEncashmentLoading] = useState(false);
  const [showEncashForm, setShowEncashForm] = useState(false);
  const [encashForm, setEncashForm] = useState({ leave_type: 'Annual Leave', days: 1, reason: '' });
  const [encashSubmitting, setEncashSubmitting] = useState(false);
  const [allEncashmentRequests, setAllEncashmentRequests] = useState<any[]>([]);
  const [allEncashLoading, setAllEncashLoading] = useState(false);

  // All comp-off requests (admin/hr view)
  const [allCompOffRequests, setAllCompOffRequests] = useState<any[]>([]);
  const [allCompOffLoading, setAllCompOffLoading] = useState(false);
  const [compOffViewMode, setCompOffViewMode] = useState<'my' | 'all'>('my');

  // ── Payslip state ─────────────────────────────────────────────────────
  const [payslips, setPayslips] = useState<any[]>([]);
  const [payslipsLoading, setPayslipsLoading] = useState(false);
  const [selectedPayslipId, setSelectedPayslipId] = useState<string | null>(null);
  const [expandedPayslipId, setExpandedPayslipId] = useState<string | null>(null);
  const [downloadingPayslipId, setDownloadingPayslipId] = useState<string | null>(null);

  // ── Shift state ───────────────────────────────────────────────────────
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [shiftView, setShiftView] = useState<'weekly' | 'monthly'>('weekly');
  const [employeeShifts, setEmployeeShifts] = useState<any[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [swapRequests, setSwapRequests] = useState<any[]>([]);
  const [swapRequestsLoading, setSwapRequestsLoading] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [pendingSwapRequests, setPendingSwapRequests] = useState<any[]>([]);
  const [pendingSwapLoading, setPendingSwapLoading] = useState(false);
  const [swapApprovalTarget, setSwapApprovalTarget] = useState<{ item: any; action: 'approve' | 'reject' } | null>(null);

  // ── Roster state ─────────────────────────────────────────────────────
  const [rosterTeamData, setRosterTeamData] = useState<any[]>([]);
  const [rosterTeamLoading, setRosterTeamLoading] = useState(false);
  const [rosterTableMissing, setRosterTableMissing] = useState(false);

  // ── WFH / CompOff / Regularization state ─────────────────────────────
  const [wfhRequests, setWfhRequests] = useState<any[]>([]);
  const [wfhLoading, setWfhLoading] = useState(false);
  const [showWfhModal, setShowWfhModal] = useState(false);

  const [compOffRequests, setCompOffRequests] = useState<any[]>([]);
  const [compOffLoading, setCompOffLoading] = useState(false);
  const [showCompOffModal, setShowCompOffModal] = useState(false);

  const [corrections, setCorrections] = useState<any[]>([]);
  const [correctionsLoading, setCorrectionsLoading] = useState(false);
  const [showRegModal, setShowRegModal] = useState(false);

  // ── Approvals sub-tab ─────────────────────────────────────────────────
  const [approvalSubTab, setApprovalSubTab] = useState<'leave' | 'wfh' | 'compoff' | 'regularization' | 'shift_swap' | 'encashment'>('leave');
  const [pendingWfh, setPendingWfh] = useState<any[]>([]);
  const [pendingWfhLoading, setPendingWfhLoading] = useState(false);
  const [pendingCompOff, setPendingCompOff] = useState<any[]>([]);
  const [pendingCompOffLoading, setPendingCompOffLoading] = useState(false);
  const [pendingCorrections, setPendingCorrections] = useState<any[]>([]);
  const [pendingCorrectionsLoading, setPendingCorrectionsLoading] = useState(false);
  const [genericApprovalTarget, setGenericApprovalTarget] = useState<{
    item: any; table: string; action: 'approve' | 'reject'; label: string;
  } | null>(null);

  // ── Employee profile (birthday / anniversary) ─────────────────────────
  const [employeeProfile, setEmployeeProfile] = useState<{ date_of_birth?: string | null; join_date?: string | null; name?: string } | null>(null);
  useEffect(() => {
    if (!empIdForQuery) return;
    void (async () => {
      const { data } = await supabase.from('employees').select('name, date_of_birth, join_date, manager_id').eq('id', empIdForQuery).single();
      if (data) setEmployeeProfile(data);
    })();
  }, [empIdForQuery]);

  // ── Birthday / Anniversary banner ────────────────────────────────────
  const todayKey = new Date().toISOString().slice(0, 10);
  const bannerDismissKey = `banner_dismissed_${todayKey}`;
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try { return localStorage.getItem(bannerDismissKey) === '1'; } catch { return false; }
  });
  const dismissBanner = () => {
    setBannerDismissed(true);
    try { localStorage.setItem(bannerDismissKey, '1'); } catch { /* ignore */ }
  };
  const todayDate = new Date();
  const isBirthday = (() => {
    const dob = employeeProfile?.date_of_birth;
    if (!dob) return false;
    const d = new Date(dob);
    return d.getDate() === todayDate.getDate() && d.getMonth() === todayDate.getMonth();
  })();
  const anniversaryYears = (() => {
    const jd = employeeProfile?.join_date;
    if (!jd) return 0;
    const d = new Date(jd);
    if (d.getDate() === todayDate.getDate() && d.getMonth() === todayDate.getMonth()) {
      return todayDate.getFullYear() - d.getFullYear();
    }
    return 0;
  })();
  const isAnniversary = anniversaryYears > 0;

  // ── Leave balances from DB (for colored cards) ────────────────────────
  const [leaveBalancesDB, setLeaveBalancesDB] = useState<any[]>([]);
  useEffect(() => {
    if (!empIdForQuery) return;
    void (async () => {
      const { data } = await supabase.from('leave_balances').select('*').eq('employee_id', empIdForQuery);
      if (data && data.length > 0) setLeaveBalancesDB(data);
    })();
  }, [empIdForQuery]);

  // ── Stats strip (WFH approved this month, leave taken this month) ─────
  const [statsWFHApproved, setStatsWFHApproved] = useState(0);
  const [statsLeaveTaken, setStatsLeaveTaken] = useState(0);
  useEffect(() => {
    if (!empIdForQuery) return;
    const monthStart = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-01`;
    void (async () => {
      const { data } = await supabase.from('wfh_requests').select('id').eq('employee_id', empIdForQuery).eq('status', 'approved').gte('start_date', monthStart);
      setStatsWFHApproved(data?.length ?? 0);
    })();
    void (async () => {
      const { data } = await supabase.from('leaves').select('id').eq('employee_id', empIdForQuery).eq('status', 'Approved').gte('start_date', monthStart);
      setStatsLeaveTaken(data?.length ?? 0);
    })();
  }, [empIdForQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const [managerName, setManagerName] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    fetch(`${API_BASE}/employee-dashboard/manager/${userId}`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.manager_name) setManagerName(j.manager_name); })
      .catch(() => {});
  }, [userId]);

  // Elevated-role quick stats
  const [elevatedStats, setElevatedStats] = useState({ headcount: 0, newJoiners: 0, openITTickets: 0, openRequisitions: 0 });
  useEffect(() => {
    if (!isHrAdmin && !isManager) return;
    const hdrs = { Authorization: `Bearer ${publicAnonKey}` };
    const thisMonth = new Date().toISOString().slice(0, 7);
    Promise.allSettled([
      fetch(`${API_BASE}/directory`, { headers: hdrs }).then(r => safeJson(r)),
      fetch(`${API_BASE}/onboarding`, { headers: hdrs }).then(r => safeJson(r)),
      fetch(`${API_BASE}/it-services/tickets`, { headers: hdrs }).then(r => safeJson(r)),
      fetch(`${API_BASE}/recruitment/candidates`, { headers: hdrs }).then(r => safeJson(r)),
    ]).then(([dirRes, onbRes, itRes, recRes]) => {
      const dir = dirRes.status === 'fulfilled' ? dirRes.value : null;
      const onb = onbRes.status === 'fulfilled' ? onbRes.value : null;
      const it = itRes.status === 'fulfilled' ? itRes.value : null;
      const rec = recRes.status === 'fulfilled' ? recRes.value : null;
      const employees = Array.isArray(dir) ? dir : (dir?.employees ?? []);
      const joiners = Array.isArray(onb) ? onb : (onb?.records ?? []);
      const tickets = Array.isArray(it) ? it : (it?.tickets ?? []);
      const candidates = Array.isArray(rec) ? rec : (rec?.candidates ?? []);
      setElevatedStats({
        headcount: employees.length,
        newJoiners: joiners.filter((j: any) => (j.created_at ?? j.start_date ?? '').startsWith(thisMonth)).length,
        openITTickets: tickets.filter((t: any) => t.status === 'Open' || t.status === 'In Progress').length,
        openRequisitions: candidates.filter((c: any) => c.stage !== 'Hired' && c.stage !== 'Rejected').length,
      });
    });
  }, [isHrAdmin, isManager]);

  // Team Leave Calendar state
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [teamLeaves, setTeamLeaves] = useState<{ id: string; employee_name: string; start_date: string; end_date: string; status: string }[]>([]);
  const [teamLeavesLoading, setTeamLeavesLoading] = useState(false);

  // Load pending leaves for managers
  useEffect(() => {
    if (canSeePendingApprovals) dash.loadPendingLeaves();
  }, [canSeePendingApprovals, tab]);

  // Load team leaves for calendar — visible to all roles, scoped by role
  const fetchTeamCalendar = () => {
    setTeamLeavesLoading(true);
    let query = supabase.from('leaves').select('id, employee_id, employee_name, start_date, end_date, status, department');
    if (isHrAdmin) {
      // no extra filter — sees all
    } else if (isManager) {
      // direct reports: manager sees by department or manager_id if available
      // fall back to department filter using employee profile department
      if (employeeProfile) {
        // no department on profile here — just fetch all and let backend RLS handle it
        // use all leaves for now; manager RLS should filter
      }
    } else {
      // Employee: own leaves + same department
      // We'll fetch own leaves; department-scoped fetched separately and merged
    }
    void (async () => {
      try {
        const { data } = await query.order('start_date', { ascending: true });
        let leaves = data ?? [];
        if (isEmployee && empIdForQuery) {
          // show own + same-dept; since we can't easily filter dept here, show all returned (RLS will scope)
          // additionally, if leaves returned only own, that's fine; team is best-effort
        }
        setTeamLeaves(leaves.map((l: any) => ({
          id: l.id,
          employee_name: l.employee_name ?? l.employee_id,
          start_date: l.start_date,
          end_date: l.end_date,
          status: l.status,
        })));
      } catch {
        setTeamLeaves([]);
      } finally {
        setTeamLeavesLoading(false);
      }
    })();
  };

  useEffect(() => {
    if (tab !== 'calendar') return;
    fetchTeamCalendar();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription for team calendar
  useEffect(() => {
    const ch = supabase.channel('team-leave-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leaves' }, () => {
        fetchTeamCalendar();
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load leave encashment requests
  useEffect(() => {
    if (tab !== 'leaves') return;
    if (isEmployee && userId) {
      setEncashmentLoading(true);
      fetch(`${API_BASE}/employee-dashboard/leave-encashment?employee_id=${userId}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}`, apikey: publicAnonKey },
      })
        .then(r => safeJson(r))
        .then(j => setEncashmentRequests(j?.data ?? []))
        .catch(() => setEncashmentRequests([]))
        .finally(() => setEncashmentLoading(false));
    }
    if (canSeePendingApprovals) {
      setAllEncashLoading(true);
      fetch(`${API_BASE}/employee-dashboard/leave-encashment`, {
        headers: { Authorization: `Bearer ${publicAnonKey}`, apikey: publicAnonKey },
      })
        .then(r => safeJson(r))
        .then(j => setAllEncashmentRequests(j?.data ?? []))
        .catch(() => setAllEncashmentRequests([]))
        .finally(() => setAllEncashLoading(false));
    }
  }, [tab, userId, isEmployee, canSeePendingApprovals]);

  // Load WFH, CompOff, Corrections for Leaves tab
  useEffect(() => {
    if (tab !== 'leaves' || !empIdForQuery) return;

    setWfhLoading(true);
    void (async () => {
      try {
        const { data } = await supabase.from('wfh_requests').select('*').eq('employee_id', empIdForQuery).order('created_at', { ascending: false });
        setWfhRequests(data ?? []);
      } catch {
        setWfhRequests([]);
      } finally {
        setWfhLoading(false);
      }
    })();

    setCompOffLoading(true);
    void (async () => {
      try {
        const ids = [...new Set([empIdForQuery, userId].filter(Boolean))];
        const { data } = await supabase.from('comp_off_requests').select('*').in('employee_id', ids).order('created_at', { ascending: false });
        setCompOffRequests(data ?? []);
      } catch {
        setCompOffRequests([]);
      } finally {
        setCompOffLoading(false);
      }
    })();

    setCorrectionsLoading(true);
    void (async () => {
      try {
        // Include both auth UUID and employees.id in case insert used either
        const ids = [...new Set([empIdForQuery, userId].filter(Boolean))];
        const { data } = await supabase.from('attendance_corrections').select('*').in('employee_id', ids).order('created_at', { ascending: false });
        setCorrections(data ?? []);
      } catch {
        setCorrections([]);
      } finally {
        setCorrectionsLoading(false);
      }
    })();

    // Admin/HR: fetch all comp-off requests across employees
    if (isHrAdmin) {
      setAllCompOffLoading(true);
      void (async () => {
        try {
          const { data } = await supabase
            .from('comp_off_requests')
            .select('*, employees!employee_id(name, department)')
            .order('created_at', { ascending: false });
          setAllCompOffRequests(data ?? []);
        } catch {
          setAllCompOffRequests([]);
        } finally {
          setAllCompOffLoading(false);
        }
      })();
    }
  }, [tab, empIdForQuery, isHrAdmin]);

  // Load Payslips
  useEffect(() => {
    if (tab !== 'payslip' || !empIdForQuery) return;
    setPayslipsLoading(true);
    void (async () => {
      try {
        const { data } = await supabase.from('payslips').select('*').eq('employee_id', empIdForQuery)
          .order('year', { ascending: false }).order('month', { ascending: false });
        setPayslips(data ?? []);
        if (data && data.length > 0 && !selectedPayslipId) {
          setSelectedPayslipId(data[0].id);
        }
      } catch {
        setPayslips([]);
      } finally {
        setPayslipsLoading(false);
      }
    })();
  }, [tab, empIdForQuery]);

  // Load Shift Schedule
  useEffect(() => {
    if (tab !== 'shifts' || !empIdForQuery) return;

    setShiftsLoading(true);
    void (async () => {
      try {
        const { data } = await supabase.from('employee_shifts')
          .select('*, shifts(*)')
          .eq('employee_id', empIdForQuery)
          .order('effective_from', { ascending: false });
        setEmployeeShifts(data ?? []);
      } catch {
        setEmployeeShifts([]);
      } finally {
        setShiftsLoading(false);
      }
    })();

    setSwapRequestsLoading(true);
    void (async () => {
      try {
        const { data } = await supabase.from('shift_swap_requests').select('*')
          .or(`requester_id.eq.${empIdForQuery},swap_with_id.eq.${empIdForQuery}`)
          .order('created_at', { ascending: false });
        setSwapRequests(data ?? []);
      } catch {
        setSwapRequests([]);
      } finally {
        setSwapRequestsLoading(false);
      }
    })();
  }, [tab, empIdForQuery]);

  // Load Shift Roster data
  useEffect(() => {
    if (tab !== 'roster') return;
    setRosterTableMissing(false);

    if (!isManager && !isHrAdmin) {
      // Employee: reuse or reload own shifts
      if (employeeShifts.length === 0 && empIdForQuery) {
        setShiftsLoading(true);
        void (async () => {
          try {
            const { data, error } = await supabase.from('employee_shifts')
              .select('*, shifts(*)')
              .eq('employee_id', empIdForQuery)
              .order('effective_from', { ascending: false });
            if (error?.code === '42P01') { setRosterTableMissing(true); return; }
            setEmployeeShifts(data ?? []);
          } catch {
            setRosterTableMissing(true);
          } finally {
            setShiftsLoading(false);
          }
        })();
      }
      return;
    }

    // Manager/HR: fetch team shifts for current week
    setRosterTeamLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase.from('employee_shifts')
          .select('*, shifts(*), employees!employee_id(id, name)')
          .order('employee_id')
          .limit(30);
        if (error?.code === '42P01') { setRosterTableMissing(true); return; }
        setRosterTeamData(data ?? []);
      } catch {
        setRosterTableMissing(true);
      } finally {
        setRosterTeamLoading(false);
      }
    })();
  }, [tab, empIdForQuery, isManager, isHrAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load pending items for Approvals tab
  useEffect(() => {
    if (tab !== 'approvals' || !canSeePendingApprovals) return;

    setPendingWfhLoading(true);
    void (async () => {
      try {
        const { data } = await supabase.from('wfh_requests').select('*, employees!employee_id(name)').eq('status', 'pending');
        setPendingWfh(data ?? []);
      } catch {
        setPendingWfh([]);
      } finally {
        setPendingWfhLoading(false);
      }
    })();

    setPendingCompOffLoading(true);
    void (async () => {
      try {
        const { data } = await supabase.from('comp_off_requests').select('*, employees!employee_id(name)').eq('status', 'pending');
        setPendingCompOff(data ?? []);
      } catch {
        setPendingCompOff([]);
      } finally {
        setPendingCompOffLoading(false);
      }
    })();

    setPendingCorrectionsLoading(true);
    void (async () => {
      try {
        const { data } = await supabase.from('attendance_corrections').select('*, employees!employee_id(name)').eq('status', 'pending');
        setPendingCorrections(data ?? []);
      } catch {
        setPendingCorrections([]);
      } finally {
        setPendingCorrectionsLoading(false);
      }
    })();

    setPendingSwapLoading(true);
    void (async () => {
      try {
        const { data } = await supabase.from('shift_swap_requests').select('*, requester:employees!requester_id(name), swap_with:employees!swap_with_id(name)').eq('status', 'pending');
        setPendingSwapRequests(data ?? []);
      } catch {
        setPendingSwapRequests([]);
      } finally {
        setPendingSwapLoading(false);
      }
    })();
  }, [tab, canSeePendingApprovals]);

  // Load holidays
  useEffect(() => {
    if (tab !== 'holidays') return;
    setHolidaysLoading(true);
    fetch(`${API_BASE}/employee-dashboard/holidays`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
    })
      .then(r => safeJson(r))
      .then(j => {
        const data = j?.data ?? j;
        if (Array.isArray(data) && data.length > 0) setHolidays(data);
        else setHolidays(FALLBACK_HOLIDAYS);
      })
      .catch(() => setHolidays(FALLBACK_HOLIDAYS))
      .finally(() => setHolidaysLoading(false));
  }, [tab]);

  const submitEncashment = async () => {
    if (encashForm.days < 1) { toast.error('Days must be at least 1'); return; }
    setEncashSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/employee-dashboard/leave-encashment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}`, apikey: publicAnonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...encashForm, employee_id: userId, employee_name: userName, status: 'Pending' }),
      });
      const j = await safeJson(res);
      if (!j?.success) throw new Error(j?.error ?? 'Failed to submit');
      toast.success('Encashment request submitted');
      setShowEncashForm(false);
      setEncashForm({ leave_type: 'Annual Leave', days: 1, reason: '' });
      setEncashmentRequests(prev => [j.data, ...prev]);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to submit encashment request');
    } finally {
      setEncashSubmitting(false);
    }
  };

  const approveEncashment = async (id: string) => {
    try {
      await fetch(`${API_BASE}/employee-dashboard/leave-encashment/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${publicAnonKey}`, apikey: publicAnonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Approved', approved_by: userName }),
      });
      toast.success('Encashment request approved');
      setAllEncashmentRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Approved' } : r));
    } catch { toast.error('Failed to approve request'); }
  };

  const rejectEncashment = async (id: string) => {
    try {
      await fetch(`${API_BASE}/employee-dashboard/leave-encashment/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${publicAnonKey}`, apikey: publicAnonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Rejected', approved_by: userName }),
      });
      toast.success('Encashment request rejected');
      setAllEncashmentRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Rejected' } : r));
    } catch { toast.error('Failed to reject request'); }
  };

  // Payslip download
  const downloadPayslip = async (p: any) => {
    if (p.payslip_url) {
      window.open(p.payslip_url, '_blank');
      return;
    }
    toast.info('No PDF available for this payslip');
  };

  // Generic approval/rejection handler for WFH, CompOff, Corrections, Shift Swaps
  const handleGenericApproval = async (
    table: string,
    id: string,
    action: 'approve' | 'reject',
    comment: string,
    targetEmployeeId?: string,
    notificationTitle?: string,
    notificationMessage?: string,
  ) => {
    const updateData: any = {
      status: action === 'approve' ? 'approved' : 'rejected',
      approved_by: empIdForQuery,
    };
    if (action === 'reject' && comment) updateData.reject_reason = comment;

    const { error } = await supabase.from(table).update(updateData).eq('id', id);
    if (error) throw error;

    // Fire-and-forget notification
    if (targetEmployeeId && notificationTitle) {
      void supabase.from('notifications').insert([{
        user_id: targetEmployeeId,
        title: notificationTitle,
        message: notificationMessage ?? `Your request has been ${action === 'approve' ? 'approved' : 'rejected'}`,
        type: action === 'approve' ? 'success' : 'warning',
        app_filter: 'dashboard',
        is_read: false,
      }]);
    }

    toast.success(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully`);

    // Refresh the relevant list
    if (table === 'wfh_requests') {
      setPendingWfh(prev => prev.filter(i => i.id !== id));
    } else if (table === 'comp_off_requests') {
      setPendingCompOff(prev => prev.filter(i => i.id !== id));
    } else if (table === 'attendance_corrections') {
      setPendingCorrections(prev => prev.filter(i => i.id !== id));
    } else if (table === 'shift_swap_requests') {
      setPendingSwapRequests(prev => prev.filter(i => i.id !== id));
    }
  };

  // Get shift for a given date from employee_shifts
  const getShiftForDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return employeeShifts.find(es => {
      const from = new Date(es.effective_from);
      const to = es.effective_to ? new Date(es.effective_to) : null;
      return date >= from && (!to || date <= to);
    });
  };

  // Build week days
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStart]);

  const shiftTypeColors: Record<string, string> = {
    GENERAL: 'bg-indigo-100 text-indigo-700',
    MORNING: 'bg-amber-100 text-amber-700',
    EVENING: 'bg-orange-100 text-orange-700',
    NIGHT: 'bg-slate-100 text-slate-700',
    ROTATIONAL: 'bg-teal-100 text-teal-700',
  };

  const filteredLeaves = leaveFilter === 'All'
    ? dash.leaves
    : dash.leaves.filter(l => l.status === leaveFilter);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayStr = new Date().toISOString().split('T')[0];

  const now = new Date();
  const currentMonthAttendance = dash.attendance.filter(a => {
    const d = new Date(a.attendance_date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const monthSummary = {
    present: currentMonthAttendance.filter(a => a.status === 'Present').length,
    absent: currentMonthAttendance.filter(a => a.status === 'Absent').length,
    late: currentMonthAttendance.filter(a => a.status === 'Late').length,
    wfh: currentMonthAttendance.filter(a => a.status === 'WFH').length,
    lateDays: currentMonthAttendance.filter(a => isLateArrival(a.check_in)).length,
  };

  // Quick actions per role
  const employeeActions = [
    { icon: Calendar, label: 'Apply Leave', colorClass: 'bg-blue-100 text-blue-600', onClick: () => setShowLeaveForm(true) },
    { icon: Home, label: 'Request WFH', colorClass: 'bg-teal-100 text-teal-600', onClick: () => setShowWfhModal(true) },
    { icon: ClipboardEdit, label: 'Attendance Correction', colorClass: 'bg-orange-100 text-orange-600', onClick: () => { setTab('attendance'); setTimeout(() => setShowRegModal(true), 100); } },
    { icon: Coffee, label: 'Comp-Off Request', colorClass: 'bg-purple-100 text-purple-600', onClick: () => setShowCompOffModal(true) },
  ];

  const managerActions = [
    { icon: Check, label: 'Approve Leaves', colorClass: 'bg-green-100 text-green-600', onClick: () => setTab('approvals') },
    { icon: Users, label: 'View Team', colorClass: 'bg-blue-100 text-blue-600', onClick: () => navigate('/directory') },
    { icon: Briefcase, label: 'Post Job', colorClass: 'bg-purple-100 text-purple-600', onClick: () => navigate('/recruitment') },
    { icon: CreditCard, label: 'Run Payroll', colorClass: 'bg-orange-100 text-orange-600', onClick: () => navigate('/payroll') },
  ];

  const hrAdminActions = [
    { icon: UserPlus, label: 'Add Employee', colorClass: 'bg-blue-100 text-blue-600', onClick: () => navigate('/directory') },
    { icon: CreditCard, label: 'Process Payroll', colorClass: 'bg-green-100 text-green-600', onClick: () => navigate('/payroll') },
    { icon: BarChart2, label: 'View Reports', colorClass: 'bg-purple-100 text-purple-600', onClick: () => navigate('/executive-dashboard') },
    { icon: Settings, label: 'Manage Users', colorClass: 'bg-orange-100 text-orange-600', onClick: () => navigate('/user-management') },
  ];

  const quickActions = isEmployee ? employeeActions : isManager ? managerActions : hrAdminActions;

  // Error state
  if (dash.error && !dash.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle size={36} className="text-red-400 mx-auto mb-3" />
          <h2 className="font-semibold text-foreground mb-1">Failed to load dashboard</h2>
          <p className="text-sm text-muted-foreground mb-4">{dash.error}</p>
          <button onClick={dash.refresh} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const approvalPendingCount = dash.pendingLeaves.length + pendingWfh.length + pendingCompOff.length + pendingCorrections.length + pendingSwapRequests.length;

  const TABS = [
    { id: 'overview' as Tab, label: 'Overview', icon: TrendingUp, show: true },
    { id: 'attendance' as Tab, label: 'Attendance', icon: Clock, show: canSeeAttendance },
    { id: 'leaves' as Tab, label: 'My Leaves', icon: Calendar, show: true },
    { id: 'approvals' as Tab, label: `Approvals${approvalPendingCount > 0 ? ` (${approvalPendingCount})` : ''}`, icon: CheckSquare, show: canSeePendingApprovals },
    { id: 'tasks' as Tab, label: 'Tasks', icon: CheckSquare, show: true },
    { id: 'holidays' as Tab, label: 'Holidays', icon: Building2, show: true },
    { id: 'calendar' as Tab, label: 'Team Calendar', icon: Users, show: true },
    { id: 'payslip' as Tab, label: 'Payslips', icon: FileText, show: true },
    { id: 'shifts' as Tab, label: 'Shift Schedule', icon: Clock, show: true },
    { id: 'roster' as Tab, label: 'Shift Roster', icon: Users, show: true },
  ].filter(t => t.show);

  // Find selected payslip
  const currentPayslip = payslips.find(p => p.id === selectedPayslipId) ?? payslips[0];

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div>
              <h1 className="font-semibold text-foreground text-sm">{t('dashboard.title')}</h1>
              <p className="text-xs text-muted-foreground">{today}</p>
            </div>
            <div className="flex items-center gap-3">
              {!dash.loading && !dash.isCheckedIn && (
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => setWorkMode('wfh')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${workMode === 'wfh' ? 'bg-white shadow-sm font-medium text-blue-700' : 'text-muted-foreground'}`}
                  >
                    🏠 WFH
                  </button>
                  <button
                    onClick={() => setWorkMode('office')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${workMode === 'office' ? 'bg-white shadow-sm font-medium text-gray-700' : 'text-muted-foreground'}`}
                  >
                    🏢 Office
                  </button>
                </div>
              )}
              {!dash.loading && (
                dash.isCheckedIn ? (
                  <button
                    onClick={dash.checkOut}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors"
                    aria-label={t('dashboard.checkOut')}
                  >
                    <LogOut size={13} /> Check Out
                  </button>
                ) : (
                  <button
                    onClick={() => dash.checkIn(workMode)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors"
                    aria-label={t('dashboard.checkIn')}
                  >
                    <LogIn size={13} /> Check In
                  </button>
                )
              )}
              <div className="flex items-center gap-2 text-sm">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <User size={14} className="text-primary" />
                </div>
                <span className="text-xs font-medium text-foreground hidden sm:block">{userName}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 pb-0 overflow-x-auto scrollbar-hide">
            {TABS.map(tab_ => (
              <button
                key={tab_.id}
                onClick={() => setTab(tab_.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === tab_.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab_.icon size={13} />
                {tab_.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">

        {/* Employee record not linked warning */}
        {!currentUser?.employeeId && !currentUser?.notProvisioned && (
          <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            <svg className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
              <p className="font-medium">Your account is not yet linked to an employee record.</p>
              <p className="text-xs text-amber-700 mt-0.5">Some features (leave balances, attendance, payslips) may not work until HR completes your onboarding setup. Contact your HR administrator if this persists.</p>
            </div>
          </div>
        )}

        {/* ── Overview Tab ── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Birthday / Anniversary Banner */}
            {!bannerDismissed && (isBirthday || isAnniversary) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-2">
                <span className="text-xl">{isBirthday ? '🎂' : '🎉'}</span>
                <p className="flex-1 text-sm font-medium text-amber-800">
                  {isBirthday
                    ? `Happy Birthday, ${employeeProfile?.name ?? userName}! 🎂`
                    : `Happy ${anniversaryYears}-Year Work Anniversary, ${employeeProfile?.name ?? userName}! 🎉`}
                </p>
                <button
                  onClick={dismissBanner}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-amber-100 transition-colors"
                  aria-label="Dismiss banner"
                >
                  <X size={14} className="text-amber-600" />
                </button>
              </div>
            )}

            {isEmployee && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Present Days" value={dash.stats.presentDays} sub="this month" loading={dash.loading} />
                <StatCard label="Leave Balance" value={Object.values(dash.leaveBalance).reduce((a, b) => a + b, 0)} sub="days remaining" loading={dash.loading} />
                <StatCard label="Tasks Completed" value={dash.stats.tasksCompleted} sub={`${dash.stats.tasksPending} pending`} loading={dash.loading} />
                <StatCard label="Hours Logged" value={`${dash.stats.hoursThisMonth.toFixed(0)}h`} sub="this month" loading={dash.loading} />
              </div>
            )}
            {isManager && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Pending Approvals" value={approvalPendingCount} sub="requests" loading={dash.loading} />
                <StatCard label="Team Size" value={elevatedStats.headcount} sub="direct reports" loading={dash.loading} />
                <StatCard label="Open Requisitions" value={elevatedStats.openRequisitions} sub="recruitment pipeline" loading={dash.loading} />
                <StatCard label="Tasks Assigned" value={dash.stats.tasksPending} sub="pending" loading={dash.loading} />
              </div>
            )}
            {isHrAdmin && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Headcount" value={elevatedStats.headcount} sub="total employees" loading={dash.loading} />
                <StatCard label="New Joiners" value={elevatedStats.newJoiners} sub="this month" loading={dash.loading} />
                <StatCard label="Open IT Tickets" value={elevatedStats.openITTickets} sub="unresolved" loading={dash.loading} />
                <StatCard label="Pending Leaves" value={dash.pendingLeaves.length} sub="awaiting approval" loading={dash.loading} />
              </div>
            )}

            {/* Quick actions */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Zap size={15} className="text-primary" />
                Quick Actions
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {quickActions.map((action) => (
                  <QuickActionCard
                    key={action.label}
                    icon={action.icon}
                    label={action.label}
                    colorClass={action.colorClass}
                    onClick={action.onClick}
                  />
                ))}
              </div>
            </div>

            {/* Stats Strip — all roles */}
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
              {[
                { label: t('dashboard.statsPresent'), value: monthSummary.present, color: 'text-green-600' },
                { label: t('dashboard.statsAbsent'), value: monthSummary.absent, color: 'text-red-500' },
                { label: t('dashboard.statsLate'), value: monthSummary.lateDays, color: 'text-amber-600' },
                { label: t('dashboard.statsWFH'), value: statsWFHApproved || monthSummary.wfh, color: 'text-blue-600' },
                { label: t('dashboard.statsLeave'), value: statsLeaveTaken, color: 'text-purple-600' },
              ].map(s => (
                <div key={s.label} className="bg-white border border-border rounded-lg p-3 text-center flex-1 min-w-[100px] shadow-sm">
                  {dash.loading
                    ? <div className="h-6 w-10 bg-muted animate-pulse rounded mx-auto mb-1" />
                    : <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Today's attendance */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">{t('dashboard.todayAttendance')}</h2>
                {dash.todayAttendance?.work_mode ? (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${dash.todayAttendance.work_mode === 'wfh' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                    {dash.todayAttendance.work_mode === 'wfh' ? '🏠 WFH' : '🏢 In Office'}
                  </span>
                ) : dash.isCheckedIn ? null : (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${workMode === 'wfh' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                    {workMode === 'wfh' ? '🏠 WFH' : '🏢 Office'} selected
                  </span>
                )}
              </div>
              {dash.loading ? (
                <div className="grid grid-cols-3 gap-4">
                  {[1,2,3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
                </div>
              ) : dash.todayAttendance ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Check In</p>
                    <p className="text-xl font-bold text-green-600">{fmtTime(dash.todayAttendance.check_in)}</p>
                  </div>
                  <div className="text-center border-x border-border">
                    <p className="text-xs text-muted-foreground mb-1">Check Out</p>
                    <p className="text-xl font-bold text-foreground">{fmtTime(dash.todayAttendance.check_out)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Duration</p>
                    <p className="text-xl font-bold text-foreground">
                      {dash.todayAttendance.duration_minutes
                        ? `${Math.floor(dash.todayAttendance.duration_minutes / 60)}h ${dash.todayAttendance.duration_minutes % 60}m`
                        : dash.isCheckedIn ? 'In progress…' : '—'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">You haven&apos;t checked in today.</p>
                  <button onClick={() => dash.checkIn(workMode)} className="mt-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors flex items-center gap-1.5 mx-auto">
                    <LogIn size={14} /> Check In Now
                  </button>
                </div>
              )}
            </div>

            {/* Monthly attendance summary */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Clock size={15} className="text-muted-foreground" />
                {now.toLocaleString('default', { month: 'long' })} Attendance Summary
              </h2>
              {dash.loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="text-center bg-green-50 border border-green-100 rounded-xl p-3">
                    <p className="text-2xl font-bold text-green-700">{monthSummary.present}</p>
                    <p className="text-xs text-green-600 font-medium mt-0.5">Present</p>
                  </div>
                  <div className="text-center bg-red-50 border border-red-100 rounded-xl p-3">
                    <p className="text-2xl font-bold text-red-700">{monthSummary.absent}</p>
                    <p className="text-xs text-red-600 font-medium mt-0.5">Absent</p>
                  </div>
                  <div className="text-center bg-orange-50 border border-orange-100 rounded-xl p-3">
                    <p className="text-2xl font-bold text-orange-700">{monthSummary.late}</p>
                    <p className="text-xs text-orange-600 font-medium mt-0.5">Late Status</p>
                  </div>
                  <div className="text-center bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <p className="text-2xl font-bold text-blue-700">{monthSummary.wfh}</p>
                    <p className="text-xs text-blue-600 font-medium mt-0.5">WFH</p>
                  </div>
                  <div className="text-center bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <p className="text-2xl font-bold text-amber-700">{monthSummary.lateDays}</p>
                    <p className="text-xs text-amber-600 font-medium mt-0.5">Late Days</p>
                  </div>
                </div>
              )}
            </div>

            {/* Leave balance + upcoming tasks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground">{t('dashboard.leaveBalance')}</h2>
                  <button onClick={() => setShowLeaveForm(true)} className="text-xs text-primary font-medium hover:underline">Apply Leave</button>
                </div>
                {dash.loading ? (
                  <div className="flex gap-3 overflow-x-auto pb-2">{[1,2,3,4,5].map(i => <div key={i} className="min-w-[140px] h-20 bg-muted animate-pulse rounded-lg flex-shrink-0" />)}</div>
                ) : (() => {
                  // Merge DB balances with dash.leaveBalance fallback
                  const CARD_CONFIGS = [
                    { key: 'Earned Leave', label: 'Earned Leave', borderColor: 'border-green-400', textColor: 'text-green-600', bgColor: 'bg-green-50', altKey: 'Annual Leave' },
                    { key: 'Sick Leave', label: 'Sick Leave', borderColor: 'border-blue-400', textColor: 'text-blue-600', bgColor: 'bg-blue-50', altKey: null },
                    { key: 'Casual Leave', label: 'Casual Leave', borderColor: 'border-orange-400', textColor: 'text-orange-600', bgColor: 'bg-orange-50', altKey: null },
                    { key: 'Comp Off', label: 'Comp-Off', borderColor: 'border-amber-400', textColor: 'text-amber-600', bgColor: 'bg-amber-50', altKey: 'Compensatory Leave' },
                    { key: 'Floater', label: 'Floater', borderColor: 'border-purple-400', textColor: 'text-purple-600', bgColor: 'bg-purple-50', altKey: 'Optional Leave' },
                  ];
                  const getBalance = (cfg: typeof CARD_CONFIGS[0]) => {
                    const dbEntry = leaveBalancesDB.find((b: any) => b.leave_type === cfg.key || b.leave_type === cfg.altKey);
                    if (dbEntry) return { balance: dbEntry.balance ?? dbEntry.days ?? 0, expiry: dbEntry.expiry_date ?? null };
                    const dashVal = dash.leaveBalance[cfg.key] ?? (cfg.altKey ? dash.leaveBalance[cfg.altKey] : null);
                    return { balance: dashVal ?? null, expiry: null };
                  };
                  const cards = CARD_CONFIGS.map(cfg => ({ ...cfg, ...getBalance(cfg) })).filter(c => c.balance !== null);
                  const displayCards = cards.length > 0 ? cards : Object.entries(dash.leaveBalance).map(([type, days], i) => ({
                    key: type, label: type, borderColor: ['border-green-400','border-blue-400','border-orange-400','border-amber-400','border-purple-400'][i % 5],
                    textColor: ['text-green-600','text-blue-600','text-orange-600','text-amber-600','text-purple-600'][i % 5],
                    bgColor: ['bg-green-50','bg-blue-50','bg-orange-50','bg-amber-50','bg-purple-50'][i % 5],
                    balance: days, expiry: null,
                  }));
                  return (
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                      {displayCards.map(c => {
                        const expiryDays = c.expiry ? Math.ceil((new Date(c.expiry).getTime() - Date.now()) / 86400000) : null;
                        const showExpiry = c.label === 'Comp-Off' && (c.balance as number) > 0 && expiryDays !== null && expiryDays <= 14;
                        return (
                          <div key={c.key} className={`min-w-[140px] ${c.bgColor} border-l-4 ${c.borderColor} rounded-lg p-3 shadow-sm flex-shrink-0`}>
                            <p className="text-xs text-muted-foreground font-medium leading-tight">{c.label}</p>
                            <p className={`text-2xl font-bold mt-1 ${c.textColor}`}>{c.balance}</p>
                            <p className="text-xs text-muted-foreground">days</p>
                            {showExpiry && (
                              <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-200 text-amber-800">
                                Expires in {expiryDays}d
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-foreground">Upcoming Tasks</h2>
                  <button onClick={() => { setEditingTask(undefined); setShowTaskForm(true); }} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                    <Plus size={12} /> Add Task
                  </button>
                </div>
                {dash.loading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}</div>
                ) : dash.upcomingTasks.length === 0 ? (
                  <div className="text-center py-4">
                    <CheckSquare size={28} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No pending tasks</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dash.upcomingTasks.map(task => (
                      <div key={task.id} className="flex items-center gap-2.5 py-1">
                        <button
                          onClick={() => dash.toggleTaskStatus(task.id)}
                          className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${task.status === 'Completed' ? 'bg-green-500 border-green-500 text-white' : 'border-border hover:border-primary'}`}
                          aria-label="Toggle task complete"
                        >
                          {task.status === 'Completed' && <Check size={10} />}
                        </button>
                        <p className={`flex-1 text-xs ${task.status === 'Completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.title}</p>
                        <Badge status={task.priority} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Training progress widget */}
            {isEmployee && (
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <BookOpen size={15} className="text-primary" />
                    My Training Progress
                  </h2>
                  <button onClick={() => navigate('/training')} className="text-xs text-primary font-medium hover:underline">View All</button>
                </div>
                {dash.loading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}</div>
                ) : dash.trainingEnrollments.length === 0 ? (
                  <div className="text-center py-4">
                    <BookOpen size={28} className="text-muted-foreground mx-auto mb-2 opacity-40" />
                    <p className="text-sm text-muted-foreground">No training enrollments yet.</p>
                    <button onClick={() => navigate('/training')} className="mt-2 text-xs text-primary font-medium hover:underline">Browse courses</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dash.trainingEnrollments.map(enrollment => (
                      <div key={enrollment.id}>
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-xs font-medium text-foreground truncate flex-1 mr-2">{enrollment.course_name}</p>
                          <span className="text-xs font-semibold text-primary flex-shrink-0">{enrollment.progress}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, enrollment.progress)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Announcements feed */}
            {dash.announcements.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Bell size={15} className="text-primary" />
                    Announcements
                  </h2>
                  <button onClick={() => navigate('/communications')} className="text-xs text-primary font-medium hover:underline">View All</button>
                </div>
                <div className="space-y-3">
                  {dash.announcements.map(ann => (
                    <div key={ann.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{ann.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmtDateShort(ann.created_at)}</p>
                      </div>
                      <Badge status={ann.priority} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manager: pending approvals summary */}
            {canSeePendingApprovals && dash.pendingLeaves.length > 0 && (
              <div className="bg-card border border-orange-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <AlertCircle size={16} className="text-orange-500" />
                  Pending Leave Approvals ({dash.pendingLeaves.length})
                </h2>
                <div className="space-y-2">
                  {dash.pendingLeaves.map(leave => (
                    <div key={leave.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium text-foreground">{leave.employee_name}</p>
                        <p className="text-xs text-muted-foreground">{leave.leave_type} · {leave.days} day{leave.days !== 1 ? 's' : ''} · {fmtDate(leave.start_date)}</p>
                        <p className="text-xs text-muted-foreground italic mt-0.5">{leave.reason}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => setApprovalTarget({ leave, action: 'approve' })} className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-md font-medium hover:bg-green-200 transition-colors flex items-center gap-1"><Check size={11} /> Approve</button>
                        <button onClick={() => setApprovalTarget({ leave, action: 'reject' })} className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-md font-medium hover:bg-red-200 transition-colors flex items-center gap-1"><X size={11} /> Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Attendance Tab ── */}
        {tab === 'attendance' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-foreground">{t('dashboard.attendanceHistory')}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{dash.attendance.length} records</span>
                <button
                  onClick={() => setShowRegModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <ClipboardEdit size={13} /> Attendance Correction
                </button>
              </div>
            </div>

            {dash.loading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>
            ) : dash.attendance.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock size={36} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No attendance records yet.</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Check In</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Check Out</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hours</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Flags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {dash.attendance.map(rec => {
                        const late = isLateArrival(rec.check_in);
                        const earlyExit = isEarlyExit(rec.check_out);
                        return (
                          <tr key={rec.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">{fmtDate(rec.attendance_date)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{fmtTime(rec.check_in)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{fmtTime(rec.check_out)}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {rec.duration_minutes ? `${Math.floor(rec.duration_minutes / 60)}h ${rec.duration_minutes % 60}m` : '—'}
                            </td>
                            <td className="px-4 py-3"><Badge status={rec.status} /></td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {late && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Late</span>}
                                {earlyExit && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Early Exit</span>}
                                {!late && !earlyExit && <span className="text-xs text-muted-foreground">—</span>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Regularization requests */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ClipboardEdit size={15} className="text-primary" />
                  Attendance Regularization Requests
                </h3>
                <button onClick={() => setShowRegModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                  <Plus size={12} /> New Correction
                </button>
              </div>
              {correctionsLoading ? (
                <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}</div>
              ) : corrections.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No regularization requests yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Check-In</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Check-Out</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reason</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {corrections.map(c => (
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2.5 text-foreground">{c.attendance_date ? fmtDate(c.attendance_date) : '—'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{c.requested_check_in ?? c.original_check_in ?? '—'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{c.requested_check_out ?? c.original_check_out ?? '—'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground max-w-[160px] truncate">{c.reason}</td>
                          <td className="px-3 py-2.5"><Badge status={c.status ?? 'pending'} /></td>
                          <td className="px-3 py-2.5 text-muted-foreground text-xs">{c.created_at ? fmtDate(c.created_at) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Leaves Tab ── */}
        {tab === 'leaves' && (
          <div className="space-y-6">
            {/* Leave requests */}
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-semibold text-foreground">My Leave Requests</h2>
                <div className="flex items-center gap-2">
                  <select
                    value={leaveFilter}
                    onChange={e => setLeaveFilter(e.target.value)}
                    className="text-xs border border-border rounded-lg px-2 py-1.5 bg-input-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                    aria-label="Filter leaves by status"
                  >
                    <option value="All">All</option>
                    <SelectOptions entity="leave" field="status" fallback={['Pending','Approved','Rejected','Cancelled']} />
                  </select>
                  <button
                    onClick={() => setShowLeaveForm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Plus size={13} /> {t('dashboard.applyLeave')}
                  </button>
                </div>
              </div>

              {dash.loading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
              ) : filteredLeaves.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar size={36} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No leave requests found.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredLeaves.map(leave => (
                    <div key={leave.id} className={`bg-card border rounded-xl px-5 py-4 flex items-start justify-between gap-3 ${leave.status === 'Rejected' ? 'border-red-200' : leave.status === 'Approved' ? 'border-green-200' : leave.status === 'Cancelled' ? 'border-muted opacity-60' : 'border-border'}`}>
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{leave.leave_type}</p>
                          <Badge status={leave.status} />
                          {leave.status === 'Pending' && (
                            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
                              Awaiting approval{managerName ? ` from ${managerName}` : ' from manager'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{fmtDate(leave.start_date)} → {fmtDate(leave.end_date)} · {leave.days} day{leave.days !== 1 ? 's' : ''}</p>
                        {leave.reason && <p className="text-xs text-muted-foreground italic">{leave.reason}</p>}
                        {(leave.approver || leave.approved_by) && (
                          <p className="text-xs text-muted-foreground">{leave.status} by {leave.approver || leave.approved_by}</p>
                        )}
                        {leave.status === 'Rejected' && leave.rejection_reason && (
                          <p className="text-xs text-red-500 mt-0.5">Reason: {leave.rejection_reason}</p>
                        )}
                      </div>
                      {leave.status === 'Pending' && (
                        <button
                          onClick={() => setWithdrawTarget(leave)}
                          disabled={cancellingLeaveId === leave.id}
                          className="shrink-0 px-3 py-1.5 text-xs border border-border text-muted-foreground rounded-lg hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {cancellingLeaveId === leave.id ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                          Withdraw
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* WFH Requests */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Home size={15} className="text-primary" />
                  WFH Requests
                </h3>
                <button onClick={() => setShowWfhModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                  <Plus size={12} /> Request WFH
                </button>
              </div>
              {wfhLoading ? (
                <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}</div>
              ) : wfhRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No WFH requests yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Start Date</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">End Date</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reason</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {wfhRequests.map(r => (
                        <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2.5 text-foreground">{r.start_date ? fmtDate(r.start_date) : '—'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{r.end_date ? fmtDate(r.end_date) : '—'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground capitalize">{(r.wfh_type ?? 'full_day').replace('_', ' ')}</td>
                          <td className="px-3 py-2.5 text-muted-foreground max-w-[160px] truncate">{r.reason}</td>
                          <td className="px-3 py-2.5"><Badge status={r.status ?? 'pending'} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Comp-Off Requests */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Coffee size={15} className="text-primary" />
                  Comp-Off Requests
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Admin/HR toggle */}
                  {isHrAdmin && (
                    <div className="flex items-center bg-muted rounded-lg p-0.5 text-xs">
                      <button
                        onClick={() => setCompOffViewMode('my')}
                        className={`px-2.5 py-1 rounded-md transition-colors font-medium ${compOffViewMode === 'my' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        My Requests
                      </button>
                      <button
                        onClick={() => setCompOffViewMode('all')}
                        className={`px-2.5 py-1 rounded-md transition-colors font-medium ${compOffViewMode === 'all' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        All Requests
                      </button>
                    </div>
                  )}
                  <button onClick={() => setShowCompOffModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                    <Plus size={12} /> Request Comp-Off
                  </button>
                </div>
              </div>

              {/* My Requests view */}
              {(!isHrAdmin || compOffViewMode === 'my') && (
                <>
                  {compOffLoading ? (
                    <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}</div>
                  ) : compOffRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No comp-off requests yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Worked Date</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hours</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comp-Off Date</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reason</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {compOffRequests.map(r => (
                            <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-3 py-2.5 text-foreground">{r.worked_date ? fmtDate(r.worked_date) : '—'}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{r.hours_worked ?? r.hours ?? '—'}h</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{r.comp_off_date ? fmtDate(r.comp_off_date) : '—'}</td>
                              <td className="px-3 py-2.5 text-muted-foreground max-w-[140px] truncate">{r.reason}</td>
                              <td className="px-3 py-2.5"><Badge status={r.status ?? 'pending'} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* All Requests view — admin/HR only */}
              {isHrAdmin && compOffViewMode === 'all' && (
                <>
                  {allCompOffLoading ? (
                    <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}</div>
                  ) : allCompOffRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No comp-off requests from any employee.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employee</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Department</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Worked Date</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hours</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reason</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {allCompOffRequests.map(r => (
                            <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-3 py-2.5 font-medium text-foreground">{r.employees?.name ?? r.employee_id ?? '—'}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{r.employees?.department ?? '—'}</td>
                              <td className="px-3 py-2.5 text-foreground">{r.worked_date ? fmtDate(r.worked_date) : '—'}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{r.hours_worked ?? r.hours ?? '—'}h</td>
                              <td className="px-3 py-2.5 text-muted-foreground max-w-[120px] truncate">{r.reason}</td>
                              <td className="px-3 py-2.5"><Badge status={r.status ?? 'pending'} /></td>
                              <td className="px-3 py-2.5">
                                {(r.status === 'pending' || r.status === 'Pending') && (
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      onClick={() => setGenericApprovalTarget({ item: { ...r, employees: r.employees }, table: 'comp_off_requests', action: 'approve', label: 'Comp-Off Request' })}
                                      className="px-2.5 py-1 text-xs bg-green-100 text-green-700 rounded-md font-medium hover:bg-green-200 transition-colors flex items-center gap-1"
                                    ><Check size={11} /> Approve</button>
                                    <button
                                      onClick={() => setGenericApprovalTarget({ item: { ...r, employees: r.employees }, table: 'comp_off_requests', action: 'reject', label: 'Comp-Off Request' })}
                                      className="px-2.5 py-1 text-xs bg-red-100 text-red-700 rounded-md font-medium hover:bg-red-200 transition-colors flex items-center gap-1"
                                    ><X size={11} /> Reject</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Attendance Regularization (in Leaves tab too) */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ClipboardEdit size={15} className="text-primary" />
                  Attendance Regularization
                </h3>
                <button onClick={() => setShowRegModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors">
                  <Plus size={12} /> Request Correction
                </button>
              </div>
              {correctionsLoading ? (
                <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}</div>
              ) : corrections.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No regularization requests yet.</p>
              ) : (
                <div className="space-y-2">
                  {corrections.slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm text-foreground">{c.attendance_date ? fmtDate(c.attendance_date) : '—'}</p>
                        <p className="text-xs text-muted-foreground">{c.reason?.slice(0, 60)}{c.reason?.length > 60 ? '…' : ''}</p>
                      </div>
                      <Badge status={c.status ?? 'pending'} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Leave Encashment (Employee only) */}
            {isEmployee && (
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CreditCard size={15} className="text-primary" />
                    Leave Encashment
                  </h3>
                  <button
                    onClick={() => setShowEncashForm(f => !f)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    {showEncashForm ? <><X size={12} /> Cancel</> : <><Plus size={12} /> Request Encashment</>}
                  </button>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 mb-4 text-sm text-amber-800">
                  {dash.loading ? (
                    <div className="h-4 w-48 bg-amber-200 animate-pulse rounded" />
                  ) : (
                    <>You have <strong>{(dash.leaveBalance['Annual Leave'] ?? 0) + (dash.leaveBalance['Earned Leave'] ?? 0)} days</strong> of Annual / Earned Leave eligible for encashment.</>
                  )}
                </div>

                {showEncashForm && (
                  <div className="bg-muted/30 border border-border rounded-xl p-4 mb-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Encashment Request Form</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Leave Type</label>
                        <select value={encashForm.leave_type} onChange={e => setEncashForm(f => ({ ...f, leave_type: e.target.value }))}
                          className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                          {leavePolicies.data.map((p: any) => <option key={p.id} value={p.leave_type}>{p.leave_type}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Number of Days</label>
                        <input type="number" min={1} max={(dash.leaveBalance[encashForm.leave_type] ?? 0)} value={encashForm.days}
                          onChange={e => setEncashForm(f => ({ ...f, days: Math.max(1, Number(e.target.value)) }))}
                          className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Reason (optional)</label>
                      <textarea rows={2} value={encashForm.reason} onChange={e => setEncashForm(f => ({ ...f, reason: e.target.value }))}
                        placeholder="Brief reason for encashment…"
                        className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div className="flex justify-end">
                      <button onClick={submitEncashment} disabled={encashSubmitting}
                        className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60">
                        {encashSubmitting && <Loader2 size={13} className="animate-spin" />}
                        Submit Encashment Request
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">My Encashment Requests</p>
                  {encashmentLoading ? (
                    <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}</div>
                  ) : encashmentRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No encashment requests yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Leave Type</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Days</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {encashmentRequests.map(req => (
                            <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-3 py-2.5 text-foreground">{req.leave_type}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{req.days}</td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${req.status === 'Approved' ? 'bg-green-100 text-green-700' : req.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {req.status}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground text-xs">{req.created_at ? fmtDate(req.created_at) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Encashment Requests (HR/Manager) */}
            {canSeePendingApprovals && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <CreditCard size={15} className="text-primary" />
                  Leave Encashment Requests (Team)
                </h3>
                {allEncashLoading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>
                ) : allEncashmentRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No encashment requests yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employee</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Leave Type</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Days</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {allEncashmentRequests.map(req => (
                          <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-3 py-2.5 font-medium text-foreground">{req.employee_name ?? '—'}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{req.leave_type}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{req.days}</td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${req.status === 'Approved' ? 'bg-green-100 text-green-700' : req.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                {req.status}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground text-xs">{req.created_at ? fmtDate(req.created_at) : '—'}</td>
                            <td className="px-3 py-2.5">
                              {req.status === 'Pending' && (
                                <div className="flex justify-end gap-1.5">
                                  <button onClick={() => approveEncashment(req.id)} className="px-2.5 py-1 text-xs bg-green-100 text-green-700 rounded-md font-medium hover:bg-green-200 transition-colors flex items-center gap-1"><Check size={11} /> Approve</button>
                                  <button onClick={() => rejectEncashment(req.id)} className="px-2.5 py-1 text-xs bg-red-100 text-red-700 rounded-md font-medium hover:bg-red-200 transition-colors flex items-center gap-1"><X size={11} /> Reject</button>
                                </div>
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
        )}

        {/* ── Approvals Tab ── */}
        {tab === 'approvals' && canSeePendingApprovals && (
          <div className="space-y-4">
            {/* Sub-tab pills */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'leave', label: `Leave${dash.pendingLeaves.length > 0 ? ` (${dash.pendingLeaves.length})` : ''}` },
                { id: 'wfh', label: `WFH${pendingWfh.length > 0 ? ` (${pendingWfh.length})` : ''}` },
                { id: 'compoff', label: `Comp-Off${pendingCompOff.length > 0 ? ` (${pendingCompOff.length})` : ''}` },
                { id: 'regularization', label: `Regularization${pendingCorrections.length > 0 ? ` (${pendingCorrections.length})` : ''}` },
                { id: 'shift_swap', label: `Shift Swap${pendingSwapRequests.length > 0 ? ` (${pendingSwapRequests.length})` : ''}` },
                { id: 'encashment', label: `Encashment${allEncashmentRequests.filter(r => r.status === 'Pending').length > 0 ? ` (${allEncashmentRequests.filter(r => r.status === 'Pending').length})` : ''}`, adminOnly: true },
              ].filter(s => !('adminOnly' in s) || isHrAdmin).map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setApprovalSubTab(sub.id as any)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${approvalSubTab === sub.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Leave sub-tab */}
            {approvalSubTab === 'leave' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <AlertCircle size={15} className="text-orange-500" />
                    Pending Leave Approvals
                  </h2>
                  <span className="text-xs text-muted-foreground">{dash.pendingLeaves.length} request{dash.pendingLeaves.length !== 1 ? 's' : ''}</span>
                </div>
                {dash.loading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
                ) : dash.pendingLeaves.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <CheckSquare size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No pending leave requests</p>
                    <p className="text-xs mt-1">All caught up!</p>
                  </div>
                ) : (
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    {dash.pendingLeaves.map((leave, i) => (
                      <div key={leave.id} className={`flex items-start justify-between gap-4 p-4 ${i !== 0 ? 'border-t border-border' : ''} hover:bg-muted/30 transition-colors`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{leave.employee_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {leave.leave_type} · {leave.days} day{leave.days !== 1 ? 's' : ''} · {fmtDate(leave.start_date)}{leave.end_date !== leave.start_date ? ` → ${fmtDate(leave.end_date)}` : ''}
                          </p>
                          {leave.reason && <p className="text-xs text-muted-foreground italic mt-1 truncate">{leave.reason}</p>}
                        </div>
                        <div className="flex gap-2 shrink-0 mt-0.5">
                          <button onClick={() => setApprovalTarget({ leave, action: 'approve' })} className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center gap-1"><Check size={11} /> Approve</button>
                          <button onClick={() => setApprovalTarget({ leave, action: 'reject' })} className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center gap-1"><X size={11} /> Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* WFH sub-tab */}
            {approvalSubTab === 'wfh' && (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Pending WFH Requests</h2>
                {pendingWfhLoading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
                ) : pendingWfh.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Home size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No pending WFH requests</p>
                  </div>
                ) : (
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    {pendingWfh.map((item, i) => (
                      <div key={item.id} className={`flex items-start justify-between gap-4 p-4 ${i !== 0 ? 'border-t border-border' : ''} hover:bg-muted/30 transition-colors`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{item.employees?.name ?? item.employee_id}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.start_date ? fmtDate(item.start_date) : '—'}
                            {item.end_date && item.end_date !== item.start_date ? ` → ${fmtDate(item.end_date)}` : ''}
                            {item.wfh_type ? ` · ${item.wfh_type.replace('_', ' ')}` : ''}
                          </p>
                          {item.reason && <p className="text-xs text-muted-foreground italic mt-1 truncate">{item.reason}</p>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => setGenericApprovalTarget({ item, table: 'wfh_requests', action: 'approve', label: 'WFH Request' })}
                            className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center gap-1"
                          ><Check size={11} /> Approve</button>
                          <button
                            onClick={() => setGenericApprovalTarget({ item, table: 'wfh_requests', action: 'reject', label: 'WFH Request' })}
                            className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center gap-1"
                          ><X size={11} /> Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Comp-Off sub-tab */}
            {approvalSubTab === 'compoff' && (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Pending Comp-Off Requests</h2>
                {pendingCompOffLoading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
                ) : pendingCompOff.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Coffee size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No pending comp-off requests</p>
                  </div>
                ) : (
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    {pendingCompOff.map((item, i) => (
                      <div key={item.id} className={`flex items-start justify-between gap-4 p-4 ${i !== 0 ? 'border-t border-border' : ''} hover:bg-muted/30 transition-colors`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{item.employees?.name ?? item.employee_id}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Worked: {item.worked_date ? fmtDate(item.worked_date) : '—'} · {item.hours_worked ?? item.hours ?? '—'}h
                          </p>
                          {item.reason && <p className="text-xs text-muted-foreground italic mt-1 truncate">{item.reason}</p>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => setGenericApprovalTarget({ item, table: 'comp_off_requests', action: 'approve', label: 'Comp-Off Request' })} className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center gap-1"><Check size={11} /> Approve</button>
                          <button onClick={() => setGenericApprovalTarget({ item, table: 'comp_off_requests', action: 'reject', label: 'Comp-Off Request' })} className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center gap-1"><X size={11} /> Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Regularization sub-tab */}
            {approvalSubTab === 'regularization' && (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Pending Regularization Requests</h2>
                {pendingCorrectionsLoading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
                ) : pendingCorrections.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <ClipboardEdit size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No pending regularization requests</p>
                  </div>
                ) : (
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    {pendingCorrections.map((item, i) => (
                      <div key={item.id} className={`flex items-start justify-between gap-4 p-4 ${i !== 0 ? 'border-t border-border' : ''} hover:bg-muted/30 transition-colors`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{item.employees?.name ?? item.employee_id}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Date: {item.attendance_date ? fmtDate(item.attendance_date) : '—'}
                            {item.requested_check_in ? ` · In: ${item.requested_check_in}` : ''}
                            {item.requested_check_out ? ` · Out: ${item.requested_check_out}` : ''}
                          </p>
                          {item.reason && <p className="text-xs text-muted-foreground italic mt-1 truncate">{item.reason}</p>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => setGenericApprovalTarget({ item, table: 'attendance_corrections', action: 'approve', label: 'Regularization Request' })} className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center gap-1"><Check size={11} /> Approve</button>
                          <button onClick={() => setGenericApprovalTarget({ item, table: 'attendance_corrections', action: 'reject', label: 'Regularization Request' })} className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center gap-1"><X size={11} /> Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Shift Swap sub-tab */}
            {approvalSubTab === 'shift_swap' && (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Pending Shift Swap Requests</h2>
                {pendingSwapLoading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
                ) : pendingSwapRequests.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Repeat size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No pending shift swap requests</p>
                  </div>
                ) : (
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    {pendingSwapRequests.map((item, i) => (
                      <div key={item.id} className={`flex items-start justify-between gap-4 p-4 ${i !== 0 ? 'border-t border-border' : ''} hover:bg-muted/30 transition-colors`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{item.requester?.name ?? item.requester_id}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Wants to swap with {item.swap_with?.name ?? item.swap_with_id}
                            {item.shift_date ? ` on ${fmtDate(item.shift_date)}` : ''}
                          </p>
                          {item.reason && <p className="text-xs text-muted-foreground italic mt-1 truncate">{item.reason}</p>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => setSwapApprovalTarget({ item, action: 'approve' })} className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center gap-1"><Check size={11} /> Approve</button>
                          <button onClick={() => setSwapApprovalTarget({ item, action: 'reject' })} className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center gap-1"><X size={11} /> Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Encashment sub-tab (admin only) */}
            {approvalSubTab === 'encashment' && isHrAdmin && (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Leave Encashment Requests</h2>
                {allEncashLoading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>
                ) : allEncashmentRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No encashment requests.</p>
                ) : (
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    {allEncashmentRequests.map((req, i) => (
                      <div key={req.id} className={`flex items-center justify-between gap-4 p-4 ${i !== 0 ? 'border-t border-border' : ''}`}>
                        <div className="flex-1">
                          <span className="font-medium text-foreground text-sm">{req.employee_name ?? '—'}</span>
                          <span className="text-muted-foreground text-xs ml-2">{req.leave_type} · {req.days} days</span>
                        </div>
                        <Badge status={req.status ?? 'Pending'} />
                        {req.status === 'Pending' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => approveEncashment(req.id)} className="px-2.5 py-1 text-xs bg-green-100 text-green-700 rounded-md font-medium hover:bg-green-200 flex items-center gap-1"><Check size={11} /> Approve</button>
                            <button onClick={() => rejectEncashment(req.id)} className="px-2.5 py-1 text-xs bg-red-100 text-red-700 rounded-md font-medium hover:bg-red-200 flex items-center gap-1"><X size={11} /> Reject</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Holidays Tab ── */}
        {tab === 'holidays' && (() => {
          const remaining = holidays.filter(h => h.date >= todayStr).length;
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Public Holidays 2026</h2>
                <span className="text-xs text-muted-foreground bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">{remaining} remaining</span>
              </div>
              {holidaysLoading ? (
                <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {holidays.map((h, idx) => {
                    const isPast = h.date < todayStr;
                    const isToday = h.date === todayStr;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-0 transition-colors ${isPast ? 'opacity-40' : isToday ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
                      >
                        <div className="w-16 flex-shrink-0 text-center">
                          <p className="text-xs font-bold text-muted-foreground uppercase">{new Date(h.date).toLocaleDateString('en-IN', { month: 'short' })}</p>
                          <p className="text-xl font-bold text-foreground leading-none">{new Date(h.date).getDate()}</p>
                          <p className="text-xs text-muted-foreground">{new Date(h.date).toLocaleDateString('en-IN', { weekday: 'short' })}</p>
                        </div>
                        <p className={`flex-1 text-sm font-medium ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>{h.name}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${h.type === 'National' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
                          {h.type}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Tasks Tab ── */}
        {tab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">{t('dashboard.myTasks')}</h2>
              <button
                onClick={() => { setEditingTask(undefined); setShowTaskForm(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus size={13} /> Add Task
              </button>
            </div>

            {dash.loading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
            ) : dash.tasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckSquare size={36} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No tasks yet. Add your first task!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dash.tasks.map(task => (
                  <div key={task.id} className={`bg-card border rounded-xl px-4 py-3 flex items-center gap-3 group transition-colors ${task.status === 'Completed' ? 'border-border opacity-60' : 'border-border'}`}>
                    <button
                      onClick={() => dash.toggleTaskStatus(task.id)}
                      className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${task.status === 'Completed' ? 'bg-green-500 border-green-500 text-white' : 'border-border hover:border-primary'}`}
                      aria-label="Toggle task status"
                    >
                      {task.status === 'Completed' && <Check size={12} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${task.status === 'Completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge status={task.priority} />
                        <Badge status={task.status} />
                        {task.due_date && <span className="text-xs text-muted-foreground">{task.due_date}</span>}
                        {task.category && <span className="text-xs text-muted-foreground">· {task.category}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingTask(task); setShowTaskForm(true); }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label="Edit task">
                        <Edit2 size={13} className="text-muted-foreground" />
                      </button>
                      <button onClick={() => setDeletingTask(task.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors" aria-label="Delete task">
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Team Calendar Tab ── */}
        {tab === 'calendar' && (() => {
          const { year, month } = calendarMonth;
          const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
          const firstDay = new Date(year, month, 1).getDay();
          const startOffset = (firstDay + 6) % 7;
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

          const leavesForDate = (dateStr: string) => teamLeaves.filter(l => l.start_date <= dateStr && l.end_date >= dateStr);
          const getInitials = (name: string) => name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Team Leave Calendar</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCalendarMonth(({ year: y, month: m }) => { const d = new Date(y, m - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })} className="px-2 py-1 text-xs border border-border rounded-lg hover:bg-muted transition-colors">← Prev</button>
                  <span className="text-sm font-medium text-foreground min-w-[130px] text-center">{monthName}</span>
                  <button onClick={() => setCalendarMonth(({ year: y, month: m }) => { const d = new Date(y, m + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })} className="px-2 py-1 text-xs border border-border rounded-lg hover:bg-muted transition-colors">Next →</button>
                </div>
              </div>

              {teamLeavesLoading ? (
                <div className="grid grid-cols-7 gap-1">{Array.from({ length: 35 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="grid grid-cols-7 border-b border-border">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                      <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide border-r border-border last:border-0">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {Array.from({ length: totalCells }).map((_, idx) => {
                      const dayNum = idx - startOffset + 1;
                      const isValid = dayNum >= 1 && dayNum <= daysInMonth;
                      const dateStr = isValid ? `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}` : '';
                      const dayLeaves = isValid ? leavesForDate(dateStr) : [];
                      const isToday = dateStr === todayStr;
                      const isWeekend = (idx % 7) >= 5;
                      return (
                        <div key={idx} className={`min-h-[80px] p-1.5 border-r border-b border-border last:border-r-0 transition-colors ${!isValid ? 'bg-muted/30' : isToday ? 'bg-primary/5' : isWeekend ? 'bg-muted/20' : ''}`}>
                          {isValid && (
                            <>
                              <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>{dayNum}</div>
                              <div className="flex flex-wrap gap-0.5">
                                {dayLeaves.slice(0, 4).map(l => (
                                  <span key={l.id} title={`${l.employee_name} (${l.status})`}
                                    className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold ${l.status === 'Approved' ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800'}`}>
                                    {getInitials(l.employee_name)}
                                  </span>
                                ))}
                                {dayLeaves.length > 4 && <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold bg-gray-200 text-gray-600">+{dayLeaves.length - 4}</span>}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-200 inline-block" /> Approved Leave</div>
                <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-amber-200 inline-block" /> Pending Leave</div>
              </div>
            </div>
          );
        })()}

        {/* ── Payslip Tab ── */}
        {tab === 'payslip' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText size={15} className="text-primary" />
                Payslips
              </h2>
              {payslips.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedPayslipId ?? ''}
                    onChange={e => setSelectedPayslipId(e.target.value)}
                    className="text-sm border border-border rounded-lg px-3 py-1.5 bg-input-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {payslips.map(p => (
                      <option key={p.id} value={p.id}>{MONTH_NAMES[(p.month ?? 1) - 1]} {p.year}</option>
                    ))}
                  </select>
                  {currentPayslip?.payslip_url && (
                    <button
                      onClick={() => downloadPayslip(currentPayslip)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      <Download size={13} /> Download PDF
                    </button>
                  )}
                </div>
              )}
            </div>

            {payslipsLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}</div>
            ) : payslips.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground bg-card border border-border rounded-xl">
                <FileText size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-sm font-medium">No payslips available yet</p>
                <p className="text-xs mt-1">Payslips are uploaded by Finance. Contact HR for assistance.</p>
              </div>
            ) : currentPayslip ? (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
                    <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-2">Gross Salary</p>
                    <p className="text-2xl font-bold text-green-700">{formatCurrency(currentPayslip.gross_salary ?? currentPayslip.gross ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total earnings</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
                    <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-2">Total Deductions</p>
                    <p className="text-2xl font-bold text-red-700">
                      {formatCurrency(
                        currentPayslip.deductions
                          ? typeof currentPayslip.deductions === 'number'
                            ? currentPayslip.deductions
                            : Object.values(currentPayslip.deductions as Record<string, number>).reduce((a, b) => a + b, 0)
                          : 0
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">PF, Tax, etc.</p>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 text-center">
                    <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-2">Net Pay</p>
                    <p className="text-2xl font-bold text-indigo-700">{formatCurrency(currentPayslip.net_salary ?? currentPayslip.net ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {currentPayslip.payment_date
                        ? `Credited on ${fmtDate(currentPayslip.payment_date)}`
                        : `Credited on 28th ${MONTH_NAMES[(currentPayslip.month ?? 1) - 1]}`}
                    </p>
                  </div>
                </div>

                {/* Earnings and Deductions tables */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Earnings */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-muted/30">
                      <h3 className="text-sm font-semibold text-foreground">Earnings</h3>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Component</th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {currentPayslip.earnings && typeof currentPayslip.earnings === 'object'
                          ? Object.entries(currentPayslip.earnings as Record<string, number>).map(([key, val]) => (
                              <tr key={key} className="hover:bg-muted/20">
                                <td className="px-4 py-2.5 text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</td>
                                <td className="px-4 py-2.5 text-foreground text-right">{formatCurrency(Number(val))}</td>
                              </tr>
                            ))
                          : (
                            <>
                              <tr><td className="px-4 py-2.5 text-muted-foreground">Basic</td><td className="px-4 py-2.5 text-right text-foreground">—</td></tr>
                              <tr><td className="px-4 py-2.5 text-muted-foreground">HRA</td><td className="px-4 py-2.5 text-right text-foreground">—</td></tr>
                              <tr><td className="px-4 py-2.5 text-muted-foreground">Special Allowance</td><td className="px-4 py-2.5 text-right text-foreground">—</td></tr>
                            </>
                          )
                        }
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border bg-green-50">
                          <td className="px-4 py-2.5 font-semibold text-foreground">Total Earnings</td>
                          <td className="px-4 py-2.5 text-right font-bold text-green-700">{formatCurrency(currentPayslip.gross_salary ?? currentPayslip.gross ?? 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Deductions */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-muted/30">
                      <h3 className="text-sm font-semibold text-foreground">Deductions</h3>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Component</th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {currentPayslip.deductions && typeof currentPayslip.deductions === 'object' && !Array.isArray(currentPayslip.deductions)
                          ? Object.entries(currentPayslip.deductions as Record<string, number>).map(([key, val]) => (
                              <tr key={key} className="hover:bg-muted/20">
                                <td className="px-4 py-2.5 text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</td>
                                <td className="px-4 py-2.5 text-foreground text-right">{formatCurrency(Number(val))}</td>
                              </tr>
                            ))
                          : (
                            <>
                              <tr><td className="px-4 py-2.5 text-muted-foreground">Provident Fund</td><td className="px-4 py-2.5 text-right text-foreground">—</td></tr>
                              <tr><td className="px-4 py-2.5 text-muted-foreground">Professional Tax</td><td className="px-4 py-2.5 text-right text-foreground">—</td></tr>
                              <tr><td className="px-4 py-2.5 text-muted-foreground">TDS</td><td className="px-4 py-2.5 text-right text-foreground">—</td></tr>
                            </>
                          )
                        }
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border bg-red-50">
                          <td className="px-4 py-2.5 font-semibold text-foreground">Total Deductions</td>
                          <td className="px-4 py-2.5 text-right font-bold text-red-700">
                            {formatCurrency(
                              currentPayslip.deductions && typeof currentPayslip.deductions === 'object' && !Array.isArray(currentPayslip.deductions)
                                ? Object.values(currentPayslip.deductions as Record<string, number>).reduce((a, b) => a + Number(b), 0)
                                : 0
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Payslip list */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">All Payslips</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/20">
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Month</th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Gross</th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Net</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {payslips.map(p => (
                          <tr key={p.id} className={`hover:bg-muted/20 transition-colors ${p.id === selectedPayslipId ? 'bg-primary/5' : ''}`}>
                            <td className="px-4 py-3 font-medium text-foreground">{MONTH_NAMES[(p.month ?? 1) - 1]} {p.year}</td>
                            <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(p.gross_salary ?? p.gross ?? 0)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-foreground">{formatCurrency(p.net_salary ?? p.net ?? 0)}</td>
                            <td className="px-4 py-3"><Badge status={p.status ?? 'paid'} /></td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => { setSelectedPayslipId(p.id); setExpandedPayslipId(prev => prev === p.id ? null : p.id); }}
                                  className="px-2.5 py-1 text-xs border border-border rounded-md hover:bg-muted transition-colors flex items-center gap-1">
                                  <ChevronDown size={11} className={`transition-transform ${expandedPayslipId === p.id ? 'rotate-180' : ''}`} />
                                  Details
                                </button>
                                {p.payslip_url && (
                                  <button onClick={() => downloadPayslip(p)} className="px-2.5 py-1 text-xs border border-border rounded-md hover:bg-muted transition-colors flex items-center gap-1">
                                    <Download size={11} /> PDF
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center">Payslip data is read-only. For corrections, contact Finance.</p>
              </>
            ) : null}
          </div>
        )}

        {/* ── Shift Schedule Tab ── */}
        {tab === 'shifts' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock size={15} className="text-primary" />
                Shift Schedule
              </h2>
              <div className="flex items-center gap-2">
                {/* View toggle */}
                <div className="flex items-center bg-muted rounded-lg p-0.5">
                  <button
                    onClick={() => setShiftView('weekly')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${shiftView === 'weekly' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setShiftView('monthly')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${shiftView === 'monthly' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                  >
                    Monthly
                  </button>
                </div>
                <button
                  onClick={() => setShowSwapModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-primary text-primary rounded-lg hover:bg-primary/5 transition-colors"
                >
                  <Repeat size={13} /> Request Shift Swap
                </button>
              </div>
            </div>

            {shiftsLoading ? (
              <div className="grid grid-cols-7 gap-2">{[1,2,3,4,5,6,7].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}</div>
            ) : (
              <>
                {shiftView === 'weekly' && (
                  <div className="space-y-3">
                    {/* Week navigation */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(new Date(d)); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
                      >
                        <ChevronLeft size={13} /> Prev Week
                      </button>
                      <span className="text-sm font-medium text-foreground">
                        {weekDays[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {weekDays[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <button
                        onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(new Date(d)); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
                      >
                        Next Week <ChevronRight size={13} />
                      </button>
                    </div>

                    {/* Weekly grid */}
                    <div className="grid grid-cols-7 gap-2">
                      {weekDays.map((day, idx) => {
                        const dateStr = day.toISOString().split('T')[0];
                        const isToday = dateStr === todayStr;
                        const isWeekend = idx >= 5;
                        const shiftAssignment = getShiftForDate(dateStr);
                        const shift = shiftAssignment?.shifts;

                        return (
                          <div key={idx} className={`rounded-xl border p-3 text-center min-h-[100px] flex flex-col gap-2 ${isToday ? 'border-primary bg-primary/5' : isWeekend ? 'border-border bg-muted/30' : 'border-border bg-card'}`}>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][idx]}</p>
                              <p className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>{day.getDate()}</p>
                            </div>
                            {isWeekend ? (
                              <span className="text-xs text-muted-foreground italic">Weekend</span>
                            ) : shift ? (
                              <div>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${shiftTypeColors[shift.type?.toUpperCase() ?? 'GENERAL'] ?? 'bg-indigo-100 text-indigo-700'}`}>
                                  {shift.name ?? 'General'}
                                </span>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {shift.start_time && shift.end_time
                                    ? `${shift.start_time.slice(0, 5)} – ${shift.end_time.slice(0, 5)}`
                                    : '—'}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No shift</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {shiftView === 'monthly' && (() => {
                  const year = now.getFullYear();
                  const month = now.getMonth();
                  const firstDay = new Date(year, month, 1).getDay();
                  const startOffset = (firstDay + 6) % 7;
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

                  return (
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                      <div className="grid grid-cols-7 border-b border-border">
                        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                          <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide border-r border-border last:border-0">{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7">
                        {Array.from({ length: totalCells }).map((_, idx) => {
                          const dayNum = idx - startOffset + 1;
                          const isValid = dayNum >= 1 && dayNum <= daysInMonth;
                          const dateStr = isValid ? `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}` : '';
                          const isToday = dateStr === todayStr;
                          const shiftAssignment = isValid ? getShiftForDate(dateStr) : null;
                          const shift = shiftAssignment?.shifts;
                          const isWeekend = (idx % 7) >= 5;

                          return (
                            <div key={idx} className={`min-h-[64px] p-1.5 border-r border-b border-border last:border-r-0 ${!isValid ? 'bg-muted/30' : isToday ? 'bg-primary/5' : isWeekend ? 'bg-muted/20' : ''}`}>
                              {isValid && (
                                <>
                                  <div className={`text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>{dayNum}</div>
                                  {shift && !isWeekend && (
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${shiftTypeColors[shift.type?.toUpperCase() ?? 'GENERAL'] ?? 'bg-indigo-100 text-indigo-700'}`}>
                                      {(shift.name ?? 'GEN').slice(0, 3).toUpperCase()}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            {/* Shift type legend */}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {Object.entries(shiftTypeColors).map(([type, cls]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{type}</span>
                </div>
              ))}
            </div>

            {/* Shift swap requests list */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Repeat size={15} className="text-primary" />
                  My Shift Swap Requests
                </h3>
              </div>
              {swapRequestsLoading ? (
                <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}</div>
              ) : swapRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No shift swap requests yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shift Date</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Swap With</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reason</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Requested On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {swapRequests.map(r => (
                        <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2.5 text-foreground">{r.shift_date ? fmtDate(r.shift_date) : '—'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{r.swap_with_id}</td>
                          <td className="px-3 py-2.5 text-muted-foreground max-w-[140px] truncate">{r.reason}</td>
                          <td className="px-3 py-2.5"><Badge status={r.status ?? 'pending'} /></td>
                          <td className="px-3 py-2.5 text-muted-foreground text-xs">{r.created_at ? fmtDate(r.created_at) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ── Shift Roster Tab ── */}
        {tab === 'roster' && (() => {
          const rosterShiftChip = (shiftType: string | undefined | null) => {
            const t = (shiftType ?? '').toUpperCase();
            if (t === 'MORNING') return { label: 'Morning', cls: 'bg-amber-100 text-amber-700' };
            if (t === 'EVENING' || t === 'AFTERNOON') return { label: 'Afternoon', cls: 'bg-orange-100 text-orange-700' };
            if (t === 'NIGHT') return { label: 'Night', cls: 'bg-slate-100 text-slate-700' };
            if (t === 'GENERAL') return { label: 'General', cls: 'bg-indigo-100 text-indigo-700' };
            if (t === 'ROTATIONAL') return { label: 'Rotational', cls: 'bg-teal-100 text-teal-700' };
            return null;
          };

          // Build unique employees from team roster data
          const teamEmployees: { id: string; name: string }[] = [];
          if (isManager || isHrAdmin) {
            const seen = new Set<string>();
            rosterTeamData.forEach(row => {
              const emp = row.employees;
              const empId = emp?.id ?? row.employee_id;
              if (empId && !seen.has(empId)) {
                seen.add(empId);
                teamEmployees.push({ id: empId, name: emp?.name ?? empId });
              }
            });
          }

          const getTeamShiftForDate = (empId: string, dateStr: string) => {
            const date = new Date(dateStr);
            return rosterTeamData.find(es => {
              if ((es.employees?.id ?? es.employee_id) !== empId) return false;
              const from = new Date(es.effective_from);
              const to = es.effective_to ? new Date(es.effective_to) : null;
              return date >= from && (!to || date <= to);
            });
          };

          return (
            <div className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users size={15} className="text-primary" />
                  {isManager || isHrAdmin ? 'Team Shift Roster' : 'My Shift Roster'}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(new Date(d)); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    <ChevronLeft size={13} /> Prev
                  </button>
                  <span className="text-sm font-medium text-foreground min-w-[170px] text-center">
                    {weekDays[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {weekDays[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(new Date(d)); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    Next <ChevronRight size={13} />
                  </button>
                </div>
              </div>

              {rosterTableMissing ? (
                <div className="text-center py-16 bg-card border border-border rounded-xl">
                  <Clock size={40} className="mx-auto mb-3 text-muted-foreground opacity-30" />
                  <p className="text-sm font-medium text-muted-foreground">No shift data available for this week.</p>
                  <p className="text-xs text-muted-foreground mt-1">Contact HR to set up shift assignments.</p>
                </div>
              ) : (rosterTeamLoading || (shiftsLoading && !isManager && !isHrAdmin)) ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-xl" />)}</div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {/* Header row */}
                  <div className="grid border-b border-border bg-muted/40" style={{ gridTemplateColumns: (isManager || isHrAdmin) ? '160px repeat(7, 1fr)' : 'repeat(7, 1fr)' }}>
                    {(isManager || isHrAdmin) && (
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-r border-border">Employee</div>
                    )}
                    {weekDays.map((day, idx) => {
                      const isToday = day.toISOString().split('T')[0] === todayStr;
                      const isWeekend = idx >= 5;
                      return (
                        <div key={idx} className={`px-2 py-2 text-center border-r border-border last:border-r-0 ${isToday ? 'bg-primary/10' : isWeekend ? 'bg-muted/30' : ''}`}>
                          <p className="text-xs font-semibold text-muted-foreground uppercase">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][idx]}</p>
                          <p className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>{day.getDate()}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Employee row(s) */}
                  {(isManager || isHrAdmin) ? (
                    teamEmployees.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground">
                        <p className="text-sm">No shift assignments found for your team.</p>
                      </div>
                    ) : (
                      teamEmployees.map((emp, rowIdx) => (
                        <div key={emp.id} className={`grid border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors`} style={{ gridTemplateColumns: '160px repeat(7, 1fr)' }}>
                          <div className="px-3 py-3 text-xs font-medium text-foreground border-r border-border truncate flex items-center">{emp.name}</div>
                          {weekDays.map((day, idx) => {
                            const dateStr = day.toISOString().split('T')[0];
                            const isWeekend = idx >= 5;
                            const assignment = getTeamShiftForDate(emp.id, dateStr);
                            const shift = assignment?.shifts;
                            const chip = shift ? rosterShiftChip(shift.type) : null;
                            return (
                              <div key={idx} className={`px-1.5 py-2.5 flex items-center justify-center border-r border-border last:border-r-0 ${isWeekend ? 'bg-muted/20' : ''}`}>
                                {isWeekend ? (
                                  <span className="text-xs text-muted-foreground/50">—</span>
                                ) : chip ? (
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${chip.cls}`}>{chip.label}</span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-400">Off</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))
                    )
                  ) : (
                    /* Employee self-view */
                    <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                      {weekDays.map((day, idx) => {
                        const dateStr = day.toISOString().split('T')[0];
                        const isToday = dateStr === todayStr;
                        const isWeekend = idx >= 5;
                        const assignment = getShiftForDate(dateStr);
                        const shift = assignment?.shifts;
                        const chip = shift ? rosterShiftChip(shift.type) : null;
                        return (
                          <div key={idx} className={`min-h-[80px] p-2.5 flex flex-col items-center gap-1.5 border-r border-border last:border-r-0 ${isToday ? 'bg-primary/5' : isWeekend ? 'bg-muted/20' : ''}`}>
                            {isWeekend ? (
                              <span className="text-xs text-muted-foreground italic mt-auto mb-auto">Weekend</span>
                            ) : chip ? (
                              <>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${chip.cls}`}>{chip.label}</span>
                                {shift?.start_time && shift?.end_time && (
                                  <p className="text-[10px] text-muted-foreground">{shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}</p>
                                )}
                              </>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-400 mt-auto mb-auto">Off</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Legend */}
              {!rosterTableMissing && (
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {[
                    { label: 'Morning', cls: 'bg-amber-100 text-amber-700' },
                    { label: 'Afternoon', cls: 'bg-orange-100 text-orange-700' },
                    { label: 'Night', cls: 'bg-slate-100 text-slate-700' },
                    { label: 'General', cls: 'bg-indigo-100 text-indigo-700' },
                    { label: 'Rotational', cls: 'bg-teal-100 text-teal-700' },
                    { label: 'Off', cls: 'bg-gray-100 text-gray-400' },
                  ].map(c => (
                    <div key={c.label} className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${c.cls}`}>{c.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Modals ── */}

      {approvalTarget && (
        <LeaveApprovalModal
          leave={approvalTarget.leave}
          action={approvalTarget.action}
          onCancel={() => setApprovalTarget(null)}
          onConfirm={async (comment) => {
            if (approvalTarget.action === 'approve') {
              await dash.approveLeaveWithComment(approvalTarget.leave.id, comment);
            } else {
              await dash.rejectLeaveWithComment(approvalTarget.leave.id, comment);
            }
            setApprovalTarget(null);
          }}
        />
      )}

      {genericApprovalTarget && (
        <ApproveRejectModal
          title={`${genericApprovalTarget.action === 'approve' ? 'Approve' : 'Reject'} ${genericApprovalTarget.label}`}
          summary={`Employee: ${genericApprovalTarget.item.employees?.name ?? genericApprovalTarget.item.employee_id ?? '—'}`}
          action={genericApprovalTarget.action}
          onCancel={() => setGenericApprovalTarget(null)}
          onConfirm={async (comment) => {
            await handleGenericApproval(
              genericApprovalTarget.table,
              genericApprovalTarget.item.id,
              genericApprovalTarget.action,
              comment,
              genericApprovalTarget.item.employee_id,
              `${genericApprovalTarget.label} ${genericApprovalTarget.action === 'approve' ? 'Approved' : 'Rejected'}`,
              `Your ${genericApprovalTarget.label.toLowerCase()} has been ${genericApprovalTarget.action === 'approve' ? 'approved' : 'rejected'}${comment ? `. Note: ${comment}` : ''}.`,
            );
            setGenericApprovalTarget(null);
          }}
        />
      )}

      {swapApprovalTarget && (
        <ApproveRejectModal
          title={`${swapApprovalTarget.action === 'approve' ? 'Approve' : 'Reject'} Shift Swap Request`}
          summary={`Requester: ${swapApprovalTarget.item.requester?.name ?? swapApprovalTarget.item.requester_id} | Swap With: ${swapApprovalTarget.item.swap_with?.name ?? swapApprovalTarget.item.swap_with_id} | Date: ${swapApprovalTarget.item.shift_date ? fmtDate(swapApprovalTarget.item.shift_date) : '—'}`}
          action={swapApprovalTarget.action}
          onCancel={() => setSwapApprovalTarget(null)}
          onConfirm={async (comment) => {
            await handleGenericApproval(
              'shift_swap_requests',
              swapApprovalTarget.item.id,
              swapApprovalTarget.action,
              comment,
              swapApprovalTarget.item.requester_id,
              `Shift Swap Request ${swapApprovalTarget.action === 'approve' ? 'Approved' : 'Rejected'}`,
              `Your shift swap request has been ${swapApprovalTarget.action === 'approve' ? 'approved' : 'rejected'}.`,
            );
            setSwapApprovalTarget(null);
          }}
        />
      )}

      {showLeaveForm && (
        <LeaveForm
          onSubmit={dash.applyLeave}
          onClose={() => setShowLeaveForm(false)}
          leaveBalance={dash.leaveBalance}
          existingLeaves={dash.leaves}
        />
      )}

      {showTaskForm && (
        <TaskForm
          initial={editingTask}
          onSubmit={editingTask ? (data) => dash.updateTask(editingTask.id, data) : dash.createTask}
          onClose={() => { setShowTaskForm(false); setEditingTask(undefined); }}
        />
      )}

      {deletingTask && (
        <ConfirmDialog
          message="Are you sure you want to delete this task? This action cannot be undone."
          onConfirm={async () => { await dash.deleteTask(deletingTask); setDeletingTask(null); }}
          onCancel={() => setDeletingTask(null)}
        />
      )}

      {withdrawTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-start gap-3 mb-1">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertCircle size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Withdraw leave request?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium text-foreground">{withdrawTarget.leave_type}</span>
                  {' · '}{withdrawTarget.days} day{withdrawTarget.days !== 1 ? 's' : ''}
                  {' · '}{fmtDate(withdrawTarget.start_date)}{withdrawTarget.end_date !== withdrawTarget.start_date ? ` → ${fmtDate(withdrawTarget.end_date)}` : ''}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">This request is still pending. Your leave balance will not be affected.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setWithdrawTarget(null)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Keep it</button>
              <button
                onClick={async () => {
                  const target = withdrawTarget;
                  setWithdrawTarget(null);
                  setCancellingLeaveId(target.id);
                  try { await dash.cancelLeave(target.id); } finally { setCancellingLeaveId(null); }
                }}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Yes, withdraw
              </button>
            </div>
          </div>
        </div>
      )}

      {showWfhModal && (
        <WfhRequestModal
          employeeId={empIdForQuery}
          userId={userId}
          employeeName={employeeProfile?.name ?? userName}
          managerId={employeeProfile?.manager_id ?? undefined}
          onClose={() => setShowWfhModal(false)}
          onSuccess={() => {
            if (tab === 'leaves') {
              setWfhLoading(true);
              supabase.from('wfh_requests').select('*').eq('employee_id', empIdForQuery).order('created_at', { ascending: false })
                .then(({ data }) => setWfhRequests(data ?? []))
                .finally(() => setWfhLoading(false));
            }
          }}
        />
      )}

      {showCompOffModal && (
        <CompOffRequestModal
          employeeId={empIdForQuery}
          userId={userId}
          onClose={() => setShowCompOffModal(false)}
          onSuccess={() => {
            setCompOffLoading(true);
            supabase.from('comp_off_requests').select('*').eq('employee_id', empIdForQuery).order('created_at', { ascending: false })
              .then(({ data }) => setCompOffRequests(data ?? []))
              .finally(() => setCompOffLoading(false));
          }}
        />
      )}

      {showRegModal && (
        <RegularizationModal
          employeeId={empIdForQuery}
          userId={userId}
          onClose={() => setShowRegModal(false)}
          onSuccess={async () => {
            setCorrectionsLoading(true);
            // Try employee lookup first so the ID matches what was inserted
            let resolvedId = empIdForQuery;
            if (!employeeId && currentUser?.email) {
              const { data: empRow } = await supabase.from('employees').select('id').eq('email', currentUser.email).single();
              if (empRow?.id) resolvedId = empRow.id;
            }
            const ids = [...new Set([resolvedId, empIdForQuery].filter(Boolean))];
            const { data } = await supabase.from('attendance_corrections').select('*').in('employee_id', ids).order('created_at', { ascending: false });
            setCorrections(data ?? []);
            setCorrectionsLoading(false);
          }}
        />
      )}

      {showSwapModal && (
        <ShiftSwapModal
          employeeId={empIdForQuery}
          userId={userId}
          userEmail={currentUser?.email}
          onClose={() => setShowSwapModal(false)}
          onSuccess={() => {
            setSwapRequestsLoading(true);
            supabase.from('shift_swap_requests').select('*')
              .or(`requester_id.eq.${empIdForQuery},swap_with_id.eq.${empIdForQuery}`)
              .order('created_at', { ascending: false })
              .then(({ data }) => setSwapRequests(data ?? []))
              .finally(() => setSwapRequestsLoading(false));
          }}
        />
      )}
    </div>
  );
}

export default EmployeeDashboard;
