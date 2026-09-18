/**
 * User Management — Phase 3
 * Tabs: Users | Sessions | Login History | Access Review | Audit Log
 * Standards: RBAC (admin-only), i18n, Supabase direct (no Edge Functions),
 * confirm dialogs, form validation, soft-delete, MFA panel, invitation flow
 */
import { useState, useEffect, useCallback } from 'react';
import { usePagination } from '../../hooks/usePagination';
import Pagination from '../ui/Pagination';
import { toast } from 'sonner';
import {
  Users, Shield, Plus, Search, Edit2, Trash2, X, Check, Loader2,
  AlertCircle, Lock, Power, Mail, ChevronDown, User, Eye, EyeOff, Download,
  ClipboardList, RefreshCw, Filter, UserCheck, Link2, CheckSquare, Square,
  Monitor, Smartphone, Tablet, MapPin, Clock, Activity, RotateCcw,
  ShieldCheck, ShieldOff, ShieldAlert, Calendar, BarChart2, Send,
} from 'lucide-react';
import { API_BASE, publicAnonKey, safeJson, supabase } from '../../utils/constants';
import { useNavigate } from 'react-router';
import { useUser } from '../../context/UserContext';
import { UserWithRole, UserRole } from '../../../types/rbac';
import { useUserManagement } from '../../hooks/useUserManagement';
import { ALL_ROLES, ROLE_LABELS, ROLE_COLORS, USER_STATUS_LABELS } from '../../../constants/apps/user-management';
import { SelectOptions } from '../../context/ValueHelpsContext';
import { t } from '../../../i18n/index';

// ── Types ──────────────────────────────────────────────────────────────────
interface AppUserSession {
  id: string;
  user_id: string;
  session_token?: string;
  ip_address?: string;
  user_agent?: string;
  device_type?: string;
  location?: string;
  started_at?: string;
  last_seen_at?: string;
  ended_at?: string;
  revoked?: boolean;
  revoked_by?: string;
  // joined
  user_name?: string;
  user_email?: string;
}

interface LoginHistoryEntry {
  id: string;
  user_id?: string;
  email?: string;
  ip_address?: string;
  user_agent?: string;
  device_type?: string;
  location?: string;
  success?: boolean;
  failure_reason?: string;
  mfa_used?: boolean;
  logged_in_at?: string;
  // joined
  user_name?: string;
}

interface ReviewCycle {
  id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  created_by?: string;
}

interface UserAccessReview {
  id: string;
  cycle_id: string;
  user_id: string;
  reviewer_id?: string;
  current_roles?: string[];
  current_permissions?: string[];
  decision?: 'certify' | 'revoke' | 'modify';
  decision_reason?: string;
  status?: string;
  // joined
  user_name?: string;
  user_email?: string;
  last_login?: string;
}

// ── Role Permissions Map ───────────────────────────────────────────────────
const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['manage_users', 'manage_roles', 'view_all', 'delete_users', 'manage_billing', 'manage_integrations'],
  admin: ['manage_users', 'manage_roles', 'view_all', 'delete_users', 'manage_settings'],
  hr_admin: ['manage_employees', 'view_payroll', 'manage_leaves', 'manage_onboarding', 'manage_recruitment'],
  hr_manager: ['view_employees', 'approve_leaves', 'manage_onboarding', 'view_recruitment'],
  manager: ['view_employees', 'approve_leaves', 'view_reports', 'manage_team'],
  finance: ['view_payroll', 'manage_invoices', 'view_reports', 'manage_expenses'],
  recruiter: ['manage_recruitment', 'view_candidates', 'schedule_interviews'],
  employee: ['view_own_profile', 'submit_leaves', 'view_payslips'],
  contractor: ['view_own_profile', 'submit_timesheets'],
  viewer: ['view_employees', 'view_reports'],
};

const ROLE_PERMISSION_LEVEL: Record<string, number> = {
  super_admin: 100, admin: 90, hr_admin: 70, hr_manager: 60,
  manager: 50, finance: 50, recruiter: 40, employee: 20, contractor: 15, viewer: 10,
};

// ── Badge helpers ─────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[role] ?? 'bg-muted text-muted-foreground'}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-green-500',
    inactive: 'bg-gray-400',
    suspended: 'bg-red-500',
    invited: 'bg-blue-400',
    pending: 'bg-blue-400',
    deleted: 'bg-red-500',
  };
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${map[status] ?? 'bg-gray-400'}`} />
      <span className="text-xs capitalize">{USER_STATUS_LABELS[status] ?? status}</span>
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-500',
    invited: 'bg-blue-100 text-blue-700',
    pending: 'bg-blue-100 text-blue-700',
    deleted: 'bg-red-100 text-red-700',
    suspended: 'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = {
    active: 'Active',
    inactive: 'Inactive',
    invited: 'Invited',
    pending: 'Awaiting Setup',
    deleted: 'Deleted',
    suspended: 'Suspended',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-muted text-muted-foreground'}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['bg-blue-500', 'bg-violet-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ── Confirm dialog ─────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl p-6 max-w-sm w-full">
        <div className="flex items-start gap-3 mb-3">
          <AlertCircle size={20} className={`flex-shrink-0 mt-0.5 ${danger ? 'text-red-500' : 'text-orange-500'}`} />
          <div>
            <h3 className="font-semibold text-foreground text-sm mb-1">{title}</h3>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`px-3 py-1.5 text-sm text-white rounded-lg transition-colors ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Two-Step Delete Dialog ─────────────────────────────────────────────────
function TwoStepDeleteDialog({ user, onConfirm, onCancel }: {
  user: UserWithRole & { last_sign_in_at?: string; lastLogin?: string };
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [emailInput, setEmailInput] = useState('');
  const [activeOverride, setActiveOverride] = useState(false);

  const recentlyActive = (() => {
    const lastSeen = user.last_sign_in_at ?? user.lastLogin;
    if (!lastSeen) return false;
    return Date.now() - new Date(lastSeen).getTime() < 30 * 24 * 60 * 60 * 1000;
  })();

  const canProceedStep1 = !recentlyActive || activeOverride;
  const canConfirm = emailInput === user.email;

  if (step === 1) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-card border border-border rounded-xl shadow-xl p-6 max-w-sm w-full">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5 text-red-500" />
            <div>
              <h3 className="font-semibold text-foreground text-sm mb-1">{t('userMgmt.twoStepDeleteTitle')}</h3>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete <strong>{user.name}</strong>? This will schedule purge in 30 days.
              </p>
            </div>
          </div>
          {recentlyActive && (
            <div className="mb-4 p-3 rounded-lg bg-orange-50 border border-orange-200">
              <p className="text-xs text-orange-700 mb-2">{t('userMgmt.recentlyActiveWarning')}</p>
              <label className="flex items-center gap-2 text-xs text-orange-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeOverride}
                  onChange={e => setActiveOverride(e.target.checked)}
                  className="w-4 h-4 rounded border-orange-300 text-orange-600 focus:ring-orange-300"
                />
                I acknowledge this user was recently active
              </label>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={onCancel} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button
              onClick={() => canProceedStep1 && setStep(2)}
              disabled={!canProceedStep1}
              className="px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-40"
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl p-6 max-w-sm w-full">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5 text-red-500" />
          <div>
            <h3 className="font-semibold text-foreground text-sm mb-1">Final confirmation</h3>
            <p className="text-sm text-muted-foreground">
              Type <strong className="font-mono text-foreground">{user.email}</strong> to confirm deletion.
            </p>
          </div>
        </div>
        <input
          value={emailInput}
          onChange={e => setEmailInput(e.target.value)}
          placeholder={user.email}
          className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-red-300 mb-4 font-mono"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-40"
          >
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Role Change Modal ──────────────────────────────────────────────────────
function RoleChangeModal({ user, currentAdminRole, onClose, onDone }: {
  user: UserWithRole;
  currentAdminRole: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [selectedRole, setSelectedRole] = useState(user.primaryRole ?? user.roles[0] ?? 'employee');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const currentRole = user.primaryRole ?? user.roles[0] ?? 'employee';
  const currentPerms = ROLE_PERMISSIONS[currentRole] ?? [];
  const newPerms = ROLE_PERMISSIONS[selectedRole] ?? [];
  const gaining = newPerms.filter(p => !currentPerms.includes(p));
  const losing = currentPerms.filter(p => !newPerms.includes(p));
  const unchanged = currentRole === selectedRole;

  const adminLevel = ROLE_PERMISSION_LEVEL[currentAdminRole] ?? 0;
  const newLevel = ROLE_PERMISSION_LEVEL[selectedRole] ?? 0;
  const exceedsAdmin = newLevel > adminLevel;

  const handleConfirm = async () => {
    if (exceedsAdmin) { setError('You cannot assign a role with higher permissions than your own.'); return; }
    if (reason.trim().length < 10) { setError('Please provide a reason (at least 10 characters).'); return; }
    if (unchanged) { onClose(); return; }
    setSaving(true);
    try {
      void supabase.from('app_users').update({ role: selectedRole, primary_role: selectedRole, roles: [selectedRole] }).eq('id', user.id);
      void (supabase as any).from('audit_logs').insert([{
        action: 'role_change',
        user_email: user.email,
        details: { from: currentRole, to: selectedRole, reason },
        created_at: new Date().toISOString(),
      }]);
      void (supabase as any).from('notifications').insert([{
        user_id: user.id,
        title: 'Role Updated',
        message: `Your role has been changed from ${currentRole} to ${selectedRole}.`,
        type: 'info',
        app_filter: 'user-mgmt',
        is_read: false,
      }]);
      toast.success(`Role changed to ${selectedRole} for ${user.name}`);
      onDone();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to change role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-primary" />
            <h3 className="font-semibold text-foreground">{t('userMgmt.roleChangeTitle')}</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-muted/40 rounded-lg px-4 py-3">
            <p className="text-sm font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Current role</label>
            <RoleBadge role={currentRole} />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">New role</label>
            <select
              value={selectedRole}
              onChange={e => { setSelectedRole(e.target.value); setError(''); }}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {ALL_ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
              ))}
            </select>
          </div>

          {!unchanged && (
            <div className="space-y-2">
              {gaining.length > 0 && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-xs font-semibold text-green-700 mb-1.5">{t('userMgmt.gainingAccess')}</p>
                  <ul className="space-y-0.5">
                    {gaining.map(p => (
                      <li key={p} className="flex items-center gap-1.5 text-xs text-green-700">
                        <Check size={11} className="shrink-0" />
                        {p.replace(/_/g, ' ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {losing.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1.5">{t('userMgmt.losingAccess')}</p>
                  <ul className="space-y-0.5">
                    {losing.map(p => (
                      <li key={p} className="flex items-center gap-1.5 text-xs text-red-700">
                        <X size={11} className="shrink-0" />
                        {p.replace(/_/g, ' ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t('userMgmt.changeReason')} *</label>
            <textarea
              value={reason}
              onChange={e => { setReason(e.target.value); setError(''); }}
              placeholder="Explain why this role change is being made…"
              rows={2}
              className={`w-full text-sm border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none ${error ? 'border-red-400' : 'border-border'}`}
            />
            {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={saving || unchanged}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Confirm Change
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Role picker ────────────────────────────────────────────────────────────
function RolePicker({ selected, onChange }: { selected: UserRole[]; onChange: (roles: UserRole[]) => void }) {
  const toggle = (role: UserRole) => {
    if (selected.includes(role)) {
      if (selected.length === 1) return;
      onChange(selected.filter(r => r !== role));
    } else {
      onChange([...selected, role]);
    }
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_ROLES.map(role => (
        <button
          key={role}
          type="button"
          onClick={() => toggle(role as UserRole)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            selected.includes(role as UserRole)
              ? `${ROLE_COLORS[role]} border-transparent`
              : 'bg-background text-muted-foreground border-border hover:border-primary/40'
          }`}
        >
          {selected.includes(role as UserRole) && <Check size={10} />}
          {ROLE_LABELS[role]}
        </button>
      ))}
    </div>
  );
}

// ── Invite User Modal ──────────────────────────────────────────────────────
function InviteUserModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { currentUser } = useUser();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roles, setRoles] = useState<UserRole[]>(['employee']);
  const [department, setDepartment] = useState('');
  const [personalNote, setPersonalNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email address.';
    if (!name.trim()) e.name = 'Name is required.';
    if (roles.length === 0) e.roles = t('validation.user.roles');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleInvite = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('app_users').insert([{
        email: email.toLowerCase().trim(),
        name: name.trim(),
        roles,
        primary_role: roles[0],
        department: department || null,
        status: 'invited',
        invitation_sent_at: now.toISOString(),
        invitation_expires_at: expiresAt,
        resend_count: 0,
        personal_note: personalNote.trim() || null,
        invited_by: currentUser?.id ?? null,
        created_at: now.toISOString(),
      }]);
      if (error) throw error;
      toast.success(`Invitation sent to ${email}`);
      onDone();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to send invitation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Send size={15} className="text-primary" />
            <h3 className="font-semibold text-foreground">Invite User</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Email *</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@company.com"
              className={`w-full text-sm border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.email ? 'border-red-400' : 'border-border'}`}
            />
            {errors.email && <p className="text-xs text-red-500 mt-0.5">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Full Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="John Smith"
              className={`w-full text-sm border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.name ? 'border-red-400' : 'border-border'}`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Department</label>
            <input
              value={department}
              onChange={e => setDepartment(e.target.value)}
              placeholder="e.g. Engineering"
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Roles *</label>
            <RolePicker selected={roles} onChange={setRoles} />
            {errors.roles && <p className="text-xs text-red-500 mt-1">{errors.roles}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t('userMgmt.personalNote')}</label>
            <textarea
              value={personalNote}
              onChange={e => setPersonalNote(e.target.value)}
              placeholder="Optional message included with the invitation…"
              rows={2}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <p className="text-xs text-muted-foreground">Invitation link expires in 7 days.</p>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
          <button onClick={handleInvite} disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send Invite
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MFA Modal ──────────────────────────────────────────────────────────────
function MFAModal({ user, onClose, onDone }: { user: UserWithRole & { mfa_enrolled?: boolean; force_mfa?: boolean }; onClose: () => void; onDone: () => void }) {
  const [forceMfa, setForceMfa] = useState(user.force_mfa ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('app_users').update({ force_mfa: forceMfa }).eq('id', user.id);
      if (error) throw error;
      toast.success('MFA settings updated');
      onDone();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update MFA settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            {user.mfa_enrolled ? <ShieldCheck size={15} className="text-green-500" /> : <ShieldOff size={15} className="text-red-400" />}
            <h3 className="font-semibold text-foreground">MFA Settings — {user.name}</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
            {user.mfa_enrolled
              ? <ShieldCheck size={20} className="text-green-500 shrink-0" />
              : <ShieldOff size={20} className="text-red-400 shrink-0" />}
            <div>
              <p className="text-sm font-medium text-foreground">MFA Status</p>
              <p className={`text-xs ${user.mfa_enrolled ? 'text-green-600' : 'text-red-500'}`}>
                {user.mfa_enrolled ? 'Enrolled — MFA is active' : 'Not enrolled'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Force MFA</p>
              <p className="text-xs text-muted-foreground">Require MFA on next login</p>
            </div>
            <button
              type="button"
              onClick={() => setForceMfa(v => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none ${forceMfa ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              aria-label="Toggle force MFA"
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${forceMfa ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Provision Access form ──────────────────────────────────────────────────
function ProvisionForm({ onClose, onDone, existingUserEmails }: {
  onClose: () => void;
  onDone: () => void;
  existingUserEmails: Set<string>;
}) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [roles, setRoles] = useState<UserRole[]>(['employee']);
  const [useCustomPassword, setUseCustomPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [results, setResults] = useState<{ email: string; name: string; ok: boolean; password?: string; msg?: string }[]>([]);
  const [resetting, setResetting] = useState<Set<string>>(new Set());
  const [resetDone, setResetDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`${API_BASE}/directory/employees`, { headers: { Authorization: `Bearer ${publicAnonKey}` } })
      .then(r => r.json())
      .then(json => {
        const list: any[] = Array.isArray(json) ? json : (json?.data ?? []);
        setEmployees(list.filter((e: any) => e.status === 'Active'));
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmps(false));
  }, []);

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    return !q || e.name?.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q) || e.department?.toLowerCase().includes(q);
  });

  const alreadyProvisioned = (email: string) => existingUserEmails.has(email?.toLowerCase());

  const toggleAll = () => {
    const eligible = filtered.filter(e => !alreadyProvisioned(e.email));
    if (eligible.every(e => selected.has(e.email))) {
      setSelected(prev => { const s = new Set(prev); eligible.forEach(e => s.delete(e.email)); return s; });
    } else {
      setSelected(prev => { const s = new Set(prev); eligible.forEach(e => s.add(e.email)); return s; });
    }
  };

  const toggle = (email: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(email) ? s.delete(email) : s.add(email); return s; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (selected.size === 0) e.select = 'Select at least one employee.';
    if (roles.length === 0) e.roles = t('validation.user.roles');
    if (useCustomPassword) {
      if (!password) e.password = 'Enter a password or switch to auto-generate.';
      else if (password.length < 6) e.password = 'Password must be at least 6 characters.';
      if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleResetPassword = async (email: string) => {
    setResetting(prev => new Set([...prev, email]));
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetDone(prev => new Set([...prev, email]));
      toast.success(`Password reset email sent to ${email}`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to send reset email');
    } finally {
      setResetting(prev => { const s = new Set(prev); s.delete(email); return s; });
    }
  };

  const handleGrant = async () => {
    if (!validate()) return;
    setSaving(true);
    const outcomes: typeof results = [];

    for (const email of Array.from(selected)) {
      const emp = employees.find(e => e.email === email);
      const empName = emp?.name ?? email.split('@')[0];

      try {
        let resolvedPassword: string | undefined;

        if (useCustomPassword) {
          const { error: authErr } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name: empName, roles } },
          });
          if (authErr && !authErr.message.toLowerCase().includes('already registered')) {
            throw new Error(authErr.message);
          }
          resolvedPassword = password;

          const res = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name: empName, roles, provision: true }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j?.error ?? `HTTP ${res.status}`);
          }
        } else {
          const res = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name: empName, roles, provision: true }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j?.error ?? `HTTP ${res.status}`);
          }
          const j = await res.json().catch(() => ({}));
          resolvedPassword = j?.tempPassword ?? undefined;
        }

        outcomes.push({ email, name: empName, ok: true, password: resolvedPassword });
      } catch (err: any) {
        outcomes.push({ email, name: empName, ok: false, msg: err?.message ?? 'Network error' });
      }
    }

    setResults(outcomes);
    setSaving(false);
    const succeeded = outcomes.filter(o => o.ok).length;
    if (succeeded > 0) { toast.success(`Portal access granted to ${succeeded} employee${succeeded > 1 ? 's' : ''}`); onDone(); }
  };

  const eligibleCount = filtered.filter(e => !alreadyProvisioned(e.email)).length;
  const allVisibleSelected = eligibleCount > 0 && filtered.filter(e => !alreadyProvisioned(e.email)).every(e => selected.has(e.email));

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <UserCheck size={16} className="text-primary" />
            <h3 className="font-semibold text-foreground">Grant Portal Access</h3>
            {selected.size > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">{selected.size} selected</span>
            )}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label="Close"><X size={16} /></button>
        </div>

        {results.length > 0 && (
          <div className="px-6 pt-4 shrink-0 space-y-1.5 max-h-60 overflow-y-auto">
            {results.map(r => (
              <div key={r.email} className={`text-xs rounded-lg overflow-hidden border ${r.ok ? 'border-green-200' : 'border-red-200'}`}>
                <div className={`flex items-start gap-2 px-3 py-2 ${r.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {r.ok ? <Check size={11} className="mt-0.5 shrink-0" /> : <AlertCircle size={11} className="mt-0.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{r.name}</span>
                    <span className="ml-1 opacity-70">{r.email}</span>
                    {r.ok && !r.password && <p className="opacity-70 mt-0.5">Access updated — account already existed</p>}
                    {!r.ok && r.msg && <p className="opacity-80 mt-0.5">{r.msg}</p>}
                  </div>
                  <span className="shrink-0 font-medium">{r.ok ? (r.password ? 'Created' : 'Updated') : 'Failed'}</span>
                </div>
                {r.ok && r.password && (
                  <div className="px-3 py-2.5 bg-amber-50 border-t border-amber-200 space-y-1">
                    <p className="font-semibold text-amber-800 text-[11px] uppercase tracking-wide mb-1.5">Login Credentials — share securely</p>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-700 w-16 shrink-0">Email</span>
                      <code className="flex-1 bg-white border border-amber-200 rounded px-2 py-0.5 font-mono select-all">{r.email}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-700 w-16 shrink-0">Password</span>
                      <code className="flex-1 bg-white border border-amber-200 rounded px-2 py-0.5 font-mono select-all tracking-wider">{r.password}</code>
                    </div>
                    <p className="text-amber-600 opacity-80 mt-1">Ask the user to reset their password after first login.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search employees by name, email or department…"
              className="w-full text-sm border border-border rounded-lg pl-8 pr-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 px-3 py-2 bg-muted/40 border-b border-border">
              <button type="button" onClick={toggleAll} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                {allVisibleSelected ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
                {allVisibleSelected ? 'Deselect all' : `Select all (${eligibleCount})`}
              </button>
              <span className="ml-auto text-xs text-muted-foreground">{filtered.length} employees</span>
            </div>

            {loadingEmps ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}</div>
            ) : filtered.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">No employees match your search.</p>
            ) : (
              <div className="divide-y divide-border max-h-52 overflow-y-auto">
                {filtered.map(emp => {
                  const provisioned = alreadyProvisioned(emp.email);
                  const isSelected = selected.has(emp.email);
                  return (
                    <div key={emp.email} className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${provisioned ? 'bg-muted/20' : isSelected ? 'bg-primary/5' : 'hover:bg-muted/40'}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={provisioned}
                        onChange={() => !provisioned && toggle(emp.email)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30 cursor-pointer disabled:cursor-default"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{emp.name}</p>
                          {provisioned && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-medium shrink-0">
                              <Link2 size={8} /> Access
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{emp.email}{emp.department ? ` · ${emp.department}` : ''}</p>
                      </div>
                      {provisioned && (
                        <button
                          type="button"
                          onClick={() => !resetting.has(emp.email) && !resetDone.has(emp.email) && handleResetPassword(emp.email)}
                          disabled={resetting.has(emp.email) || resetDone.has(emp.email)}
                          className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors disabled:cursor-default ${
                            resetDone.has(emp.email)
                              ? 'border-green-200 bg-green-50 text-green-600'
                              : 'border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100'
                          }`}
                        >
                          {resetting.has(emp.email)
                            ? <Loader2 size={11} className="animate-spin" />
                            : resetDone.has(emp.email)
                            ? <><Check size={11} /> Sent</>
                            : <><Lock size={11} /> Reset PW</>
                          }
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {errors.select && <p className="text-xs text-red-500 -mt-2">{errors.select}</p>}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Roles *</label>
            <RolePicker selected={roles} onChange={setRoles} />
            {errors.roles && <p className="text-xs text-red-500 mt-1">{errors.roles}</p>}
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">Initial Password</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {useCustomPassword ? 'Set a specific password for the selected employee(s)' : 'A secure password will be auto-generated and shown after granting access'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setUseCustomPassword(v => !v); setPassword(''); setConfirmPassword(''); setErrors({}); }}
                className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none ${useCustomPassword ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                aria-label="Toggle custom password"
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${useCustomPassword ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {useCustomPassword && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className={`w-full text-sm border rounded-lg px-3 py-2 pr-8 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.password ? 'border-red-400' : 'border-border focus:border-primary'}`}
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-500 mt-0.5">{errors.password}</p>}
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Confirm Password *</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className={`w-full text-sm border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.confirmPassword ? 'border-red-400' : 'border-border focus:border-primary'}`}
                  />
                  {errors.confirmPassword && <p className="text-xs text-red-500 mt-0.5">{errors.confirmPassword}</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-border shrink-0">
          <p className="text-xs text-muted-foreground">
            {selected.size === 0 ? 'Select employees to grant access' : `${selected.size} employee${selected.size > 1 ? 's' : ''} selected`}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button type="button" onClick={handleGrant} disabled={saving || selected.size === 0}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
              Grant Access{selected.size > 1 ? ` (${selected.size})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edit User form ─────────────────────────────────────────────────────────
function UserForm({ initial, onSubmit, onClose }: {
  initial?: Partial<UserWithRole>;
  onSubmit: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [roles, setRoles] = useState<UserRole[]>((initial?.roles ?? ['employee']) as UserRole[]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (roles.length === 0) { setErrors({ roles: t('validation.user.roles') }); return; }
    setErrors({});
    setSaving(true);
    try {
      await onSubmit({ roles, primaryRole: roles[0] });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Edit Roles</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label="Close"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
          <div className="bg-muted/40 rounded-lg px-4 py-3 space-y-1">
            <p className="text-sm font-medium text-foreground">{initial?.name}</p>
            <p className="text-xs text-muted-foreground">{initial?.email}</p>
            {initial?.department && <p className="text-xs text-muted-foreground">{initial.department}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Roles * <span className="normal-case font-normal">(select one or more)</span></label>
            <RolePicker selected={roles} onChange={setRoles} />
            {errors.roles && <p className="text-xs text-red-500 mt-1">{errors.roles}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Role assignment modal ──────────────────────────────────────────────────
function RoleModal({ user, onSave, onClose }: {
  user: UserWithRole;
  onSave: (roles: UserRole[]) => Promise<void>;
  onClose: () => void;
}) {
  const [roles, setRoles] = useState<UserRole[]>(user.roles);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (roles.length === 0) { toast.error('At least one role is required'); return; }
    setSaving(true);
    try { await onSave(roles); onClose(); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">{t('userMgmt.assignRoles')}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label="Close"><X size={16} /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Editing roles for <strong>{user.name}</strong></p>
        <RolePicker selected={roles} onChange={setRoles} />
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save Roles
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reset password modal ───────────────────────────────────────────────────
function ResetPasswordModal({ user, onClose }: { user: UserWithRole; onClose: () => void }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json.error ?? 'Failed to send reset email');
      setSent(true);
      toast.success(`Password reset email sent to ${user.email}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2"><Lock size={16} /> Reset Password</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label="Close"><X size={16} /></button>
        </div>
        {!sent ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              A password reset link will be sent to <strong>{user.email}</strong>. The link expires in 24 hours.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleSend} disabled={loading} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60">
                {loading && <Loader2 size={14} className="animate-spin" />}
                <Mail size={14} /> Send Reset Link
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-green-600 mb-4">
              <Check size={16} />
              <p className="text-sm font-medium">Reset link sent successfully</p>
            </div>
            <button onClick={onClose} className="w-full px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Close</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── CSV export ─────────────────────────────────────────────────────────────
function exportUsersCSV(users: UserWithRole[]) {
  const headers = ['Name', 'Email', 'Primary Role', 'Status', 'Department', 'Created At', 'Last Login'];
  const rows = users.map(u => [
    u.name ?? '',
    u.email ?? '',
    u.primaryRole ?? '',
    u.status ?? '',
    u.department ?? '',
    u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '',
    u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never',
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: `users-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
}

function exportLoginHistoryCSV(entries: LoginHistoryEntry[]) {
  const headers = ['Timestamp', 'User', 'Email', 'IP Address', 'Device', 'Location', 'Result', 'MFA Used', 'Failure Reason'];
  const rows = entries.map(e => [
    e.logged_in_at ? new Date(e.logged_in_at).toLocaleString() : '',
    e.user_name ?? '',
    e.email ?? '',
    e.ip_address ?? '',
    e.device_type ?? '',
    e.location ?? '',
    e.success ? 'Success' : 'Failed',
    e.mfa_used ? 'Yes' : 'No',
    e.failure_reason ?? '',
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: `login-history-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
}

function timeAgo(dateStr: string | undefined): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function daysUntil(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function parseDevice(userAgent?: string, deviceType?: string): string {
  if (deviceType) return deviceType;
  if (!userAgent) return 'Unknown';
  if (/mobile/i.test(userAgent)) return 'Mobile';
  if (/tablet/i.test(userAgent)) return 'Tablet';
  return 'Desktop';
}

function DeviceIcon({ deviceType, userAgent }: { deviceType?: string; userAgent?: string }) {
  const d = parseDevice(userAgent, deviceType).toLowerCase();
  if (d.includes('mobile')) return <Smartphone size={13} className="text-muted-foreground" />;
  if (d.includes('tablet')) return <Tablet size={13} className="text-muted-foreground" />;
  return <Monitor size={13} className="text-muted-foreground" />;
}

// ── Audit Log Tab ──────────────────────────────────────────────────────────
interface AuditLogEntry {
  id: string;
  user_email: string;
  action: string;
  details?: string | Record<string, any>;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  login: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  reset: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  assign: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

function actionColor(action: string): string {
  const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k));
  return key ? ACTION_COLORS[key] : 'bg-muted text-muted-foreground';
}

function AuditLogTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users/audit/logs`, {
        headers: { apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
      });
      const json = await safeJson(res);
      setLogs(json?.logs ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const uniqueActions = Array.from(new Set(logs.map(l => l.action))).sort();

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.user_email?.toLowerCase().includes(q) || l.action?.toLowerCase().includes(q) || String(l.details ?? '').toLowerCase().includes(q);
    const matchAction = !actionFilter || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  const formatDetails = (d: AuditLogEntry['details']): string => {
    if (!d) return '—';
    if (typeof d === 'string') return d;
    try { return JSON.stringify(d, null, 2); } catch { return String(d); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by user, action, details…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Filter size={13} />
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            <option value="">All Actions</option>
            {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          title="Refresh"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
        <span className="text-xs text-muted-foreground">{filtered.length} of {logs.length} entries</span>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <ClipboardList size={40} className="opacity-30" />
          <p className="text-sm">{search || actionFilter ? 'No entries match your filters.' : 'No audit log entries yet.'}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Timestamp</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(log => (
                  <>
                    <tr
                      key={log.id}
                      className="hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        <div>{new Date(log.created_at).toLocaleDateString()}</div>
                        <div className="text-[10px] opacity-70">{new Date(log.created_at).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-foreground">{log.user_email ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${actionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground max-w-xs truncate">
                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details) ?? '—'}
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr key={`${log.id}-detail`} className="bg-muted/30">
                        <td colSpan={4} className="px-6 py-4">
                          <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Details</p>
                          <pre className="text-xs text-foreground bg-card border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                            {formatDetails(log.details)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sessions Tab ───────────────────────────────────────────────────────────
function SessionsTab({ currentUserId }: { currentUserId?: string }) {
  const [sessions, setSessions] = useState<AppUserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [revoking, setRevoking] = useState<Set<string>>(new Set());
  const { currentUser } = useUser();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('app_user_sessions')
        .select('*, app_users(name, email)')
        .order('started_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const mapped = (data ?? []).map((s: any) => ({
        ...s,
        user_name: s.app_users?.name ?? '',
        user_email: s.app_users?.email ?? '',
      }));
      setSessions(mapped);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getSessionStatus = (s: AppUserSession) => {
    if (s.revoked) return 'revoked';
    if (s.ended_at) return 'ended';
    return 'active';
  };

  const filtered = sessions.filter(s => {
    const q = userFilter.toLowerCase();
    const matchUser = !q || s.user_name?.toLowerCase().includes(q) || s.user_email?.toLowerCase().includes(q);
    const matchStatus = !statusFilter || getSessionStatus(s) === statusFilter;
    return matchUser && matchStatus;
  });

  const handleRevoke = async (sessionId: string) => {
    setRevoking(prev => new Set([...prev, sessionId]));
    try {
      void (supabase as any).from('app_user_sessions').update({
        revoked: true,
        revoked_by: currentUser?.id ?? null,
        revoked_at: new Date().toISOString(),
      }).eq('id', sessionId);
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, revoked: true } : s));
      toast.success('Session revoked');
    } catch {
      toast.error('Failed to revoke session');
    } finally {
      setRevoking(prev => { const s = new Set(prev); s.delete(sessionId); return s; });
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      ended: 'bg-gray-100 text-gray-500',
      revoked: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-muted text-muted-foreground'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={userFilter}
            onChange={e => setUserFilter(e.target.value)}
            placeholder="Filter by user name or email…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-1 focus:ring-primary/30"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="ended">Ended</option>
          <option value="revoked">Revoked</option>
        </select>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
        <span className="text-xs text-muted-foreground">{filtered.length} sessions</span>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <Activity size={40} className="opacity-30" />
          <p className="text-sm">No sessions found.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Device</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">IP Address</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Location</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Started</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Last Seen</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(session => {
                  const status = getSessionStatus(session);
                  const isCurrent = session.user_id === currentUserId;
                  return (
                    <tr key={session.id} className={`transition-colors ${isCurrent ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={session.user_name || 'U'} />
                          <div>
                            <p className="text-xs font-medium text-foreground flex items-center gap-1">
                              {session.user_name || '—'}
                              {isCurrent && <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">You</span>}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{session.user_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <DeviceIcon deviceType={session.device_type} userAgent={session.user_agent} />
                          {parseDevice(session.user_agent, session.device_type)}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <button
                          onClick={() => { navigator.clipboard.writeText(session.ip_address ?? ''); toast.success('IP copied'); }}
                          className="text-xs text-muted-foreground font-mono hover:text-foreground transition-colors"
                          title="Click to copy"
                        >
                          {session.ip_address ?? '—'}
                        </button>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {session.location && <MapPin size={11} />}
                          {session.location ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {session.started_at ? new Date(session.started_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                        {session.last_seen_at ? timeAgo(session.last_seen_at) : '—'}
                      </td>
                      <td className="px-4 py-3">{statusBadge(status)}</td>
                      <td className="px-4 py-3 text-right">
                        {status === 'active' && (
                          <button
                            onClick={() => handleRevoke(session.id)}
                            disabled={revoking.has(session.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 ml-auto"
                          >
                            {revoking.has(session.id) ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                            Revoke
                          </button>
                        )}
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

// ── Login History Tab ──────────────────────────────────────────────────────
function LoginHistoryTab() {
  const [entries, setEntries] = useState<LoginHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('login_history')
        .select('*, app_users(name)')
        .order('logged_in_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      const mapped = (data ?? []).map((e: any) => ({
        ...e,
        user_name: e.app_users?.name ?? '',
      }));
      setEntries(mapped);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = entries.filter(e => {
    const q = userFilter.toLowerCase();
    const matchUser = !q || e.user_name?.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q);
    const matchResult = !resultFilter || (resultFilter === 'success' ? e.success : !e.success);
    const matchFrom = !dateFrom || new Date(e.logged_in_at ?? '') >= new Date(dateFrom);
    const matchTo = !dateTo || new Date(e.logged_in_at ?? '') <= new Date(dateTo + 'T23:59:59');
    return matchUser && matchResult && matchFrom && matchTo;
  });

  // Suspicious detection — brute force: 5+ failed in same 60-min window
  const bruteForceKeys = new Set<string>();
  const windowCounts = entries.reduce((acc, log) => {
    if (!log.success && log.user_id) {
      const windowHour = Math.floor(new Date(log.logged_in_at ?? 0).getTime() / (60 * 60 * 1000));
      const key = `${log.user_id}_${windowHour}`;
      acc[key] = (acc[key] ?? 0) + 1;
      if (acc[key] >= 5) bruteForceKeys.add(key);
    }
    return acc;
  }, {} as Record<string, number>);

  // New location: detect different country from previous login for same user
  const newLocationEntries = new Set<string>();
  const lastCountry: Record<string, string> = {};
  const sortedByTime = [...entries].sort((a, b) =>
    new Date(a.logged_in_at ?? 0).getTime() - new Date(b.logged_in_at ?? 0).getTime()
  );
  for (const log of sortedByTime) {
    if (!log.user_id || !log.location) continue;
    const country = log.location.split(',').pop()?.trim() ?? log.location;
    if (lastCountry[log.user_id] && lastCountry[log.user_id] !== country) {
      newLocationEntries.add(log.id);
    }
    lastCountry[log.user_id] = country;
  }

  const isBruteForce = (entry: LoginHistoryEntry) => {
    if (!entry.user_id || entry.success) return false;
    const windowHour = Math.floor(new Date(entry.logged_in_at ?? 0).getTime() / (60 * 60 * 1000));
    return bruteForceKeys.has(`${entry.user_id}_${windowHour}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={userFilter}
            onChange={e => setUserFilter(e.target.value)}
            placeholder="Filter by user or email…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={resultFilter}
          onChange={e => setResultFilter(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-1 focus:ring-primary/30"
        >
          <option value="">All Results</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-1 focus:ring-primary/30"
            title="From date"
          />
          <span className="text-muted-foreground text-xs">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-1 focus:ring-primary/30"
            title="To date"
          />
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
        <button
          onClick={() => exportLoginHistoryCSV(filtered)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        >
          <Download size={13} /> Export CSV
        </button>
        <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <Clock size={40} className="opacity-30" />
          <p className="text-sm">No login history found.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">User / Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Timestamp</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">IP</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Device</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Location</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Result</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">MFA</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(entry => {
                  const suspicious = isBruteForce(entry);
                  const newLocation = newLocationEntries.has(entry.id);
                  return (
                  <tr key={entry.id} className={`transition-colors ${suspicious || newLocation ? 'bg-orange-50/60 dark:bg-orange-900/10' : entry.success === false ? 'bg-red-50/60 dark:bg-red-900/10' : 'hover:bg-muted/30'}`}>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-foreground">{entry.user_name || entry.email || '—'}</p>
                      {entry.user_name && <p className="text-[11px] text-muted-foreground">{entry.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {entry.logged_in_at ? new Date(entry.logged_in_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground font-mono">{entry.ip_address ?? '—'}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <DeviceIcon deviceType={entry.device_type} userAgent={entry.user_agent} />
                        {parseDevice(entry.user_agent, entry.device_type)}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {entry.location && <MapPin size={11} />}
                        {entry.location ?? '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {entry.success
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700"><Check size={12} /> Success</span>
                        : <div>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><X size={12} /> Failed</span>
                            {entry.failure_reason && <p className="text-[10px] text-red-400 mt-0.5">{entry.failure_reason}</p>}
                          </div>
                      }
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {entry.mfa_used
                        ? <span className="inline-flex items-center gap-1 text-xs text-green-700"><ShieldCheck size={11} /> Yes</span>
                        : <span className="text-xs text-muted-foreground">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {suspicious && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-medium whitespace-nowrap">
                            {t('userMgmt.suspiciousBruteForce')}
                          </span>
                        )}
                        {newLocation && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-medium whitespace-nowrap">
                            {t('userMgmt.suspiciousNewLocation')}
                          </span>
                        )}
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
    </div>
  );
}

// ── Create Review Cycle Modal ──────────────────────────────────────────────
function CreateCycleModal({ onClose, onDone, currentUserId }: { onClose: () => void; onDone: () => void; currentUserId?: string }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Cycle name is required.';
    if (!startDate) e.startDate = 'Start date is required.';
    if (!endDate) e.endDate = 'End date is required.';
    if (startDate && endDate && endDate <= startDate) e.endDate = 'End date must be after start date.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // Insert cycle
      const { data: cycle, error: cycleErr } = await (supabase as any)
        .from('access_review_cycles')
        .insert([{
          name: name.trim(),
          start_date: startDate,
          end_date: endDate,
          status: 'active',
          created_by: currentUserId ?? null,
        }])
        .select()
        .single();
      if (cycleErr) throw cycleErr;

      // Fetch all active users
      const { data: activeUsers } = await (supabase as any)
        .from('app_users')
        .select('id, roles, status')
        .eq('status', 'active')
        .is('deleted_at', null);

      // Create review rows for all active users
      if (activeUsers && activeUsers.length > 0) {
        const reviews = activeUsers.map((u: any) => ({
          cycle_id: cycle.id,
          user_id: u.id,
          reviewer_id: currentUserId ?? null,
          current_roles: u.roles ?? [],
          status: 'pending',
        }));
        void (supabase as any).from('user_access_reviews').insert(reviews);
      }

      toast.success(`Review cycle "${name}" created with ${activeUsers?.length ?? 0} users`);
      onDone();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create review cycle');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BarChart2 size={15} className="text-primary" />
            <h3 className="font-semibold text-foreground">Create Review Cycle</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Cycle Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Q3 2026 Access Review"
              className={`w-full text-sm border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.name ? 'border-red-400' : 'border-border'}`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className={`w-full text-sm border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.startDate ? 'border-red-400' : 'border-border'}`}
              />
              {errors.startDate && <p className="text-xs text-red-500 mt-0.5">{errors.startDate}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">End Date *</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className={`w-full text-sm border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.endDate ? 'border-red-400' : 'border-border'}`}
              />
              {errors.endDate && <p className="text-xs text-red-500 mt-0.5">{errors.endDate}</p>}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
          <button onClick={handleCreate} disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create Cycle
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Access Review Tab ──────────────────────────────────────────────────────
function AccessReviewTab({ currentUserId }: { currentUserId?: string }) {
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [reviews, setReviews] = useState<UserAccessReview[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<ReviewCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deciding, setDeciding] = useState<Set<string>>(new Set());
  const [decisionReasons, setDecisionReasons] = useState<Record<string, string>>({});

  const loadCycles = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('access_review_cycles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCycles(data ?? []);
    } catch {
      setCycles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReviews = useCallback(async (cycleId: string) => {
    setReviewsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('user_access_reviews')
        .select('*, app_users(name, email, last_sign_in_at)')
        .eq('cycle_id', cycleId);
      if (error) throw error;
      const mapped = (data ?? []).map((r: any) => ({
        ...r,
        user_name: r.app_users?.name ?? '',
        user_email: r.app_users?.email ?? '',
        last_login: r.app_users?.last_sign_in_at ?? '',
      }));
      setReviews(mapped);
    } catch {
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  useEffect(() => { loadCycles(); }, [loadCycles]);

  useEffect(() => {
    if (selectedCycle) loadReviews(selectedCycle.id);
  }, [selectedCycle, loadReviews]);

  const handleDecision = async (reviewId: string, decision: 'certify' | 'revoke' | 'modify') => {
    setDeciding(prev => new Set([...prev, reviewId]));
    try {
      void (supabase as any).from('user_access_reviews').update({
        decision,
        decision_reason: decisionReasons[reviewId] ?? null,
        decided_at: new Date().toISOString(),
        status: 'reviewed',
      }).eq('id', reviewId);
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, decision, status: 'reviewed' } : r));
      toast.success(`Decision recorded: ${decision}`);
    } catch {
      toast.error('Failed to record decision');
    } finally {
      setDeciding(prev => { const s = new Set(prev); s.delete(reviewId); return s; });
    }
  };

  const reviewed = reviews.filter(r => r.status === 'reviewed').length;
  const total = reviews.length;
  const progress = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  const cycleBadge = (status?: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      completed: 'bg-blue-100 text-blue-700',
      closed: 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status ?? ''] ?? 'bg-muted text-muted-foreground'}`}>
        {status ?? 'Unknown'}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {showCreateModal && (
        <CreateCycleModal
          currentUserId={currentUserId}
          onClose={() => setShowCreateModal(false)}
          onDone={loadCycles}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Access Review Cycles</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={13} /> Create Cycle
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : cycles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2 border border-dashed border-border rounded-xl">
          <Calendar size={36} className="opacity-30" />
          <p className="text-sm">No review cycles yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {cycles.map(cycle => (
            <button
              key={cycle.id}
              onClick={() => setSelectedCycle(selectedCycle?.id === cycle.id ? null : cycle)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                selectedCycle?.id === cycle.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:bg-muted/40'
              }`}
            >
              <div>
                <p className="text-sm font-medium text-foreground">{cycle.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {cycle.start_date && `${cycle.start_date} → ${cycle.end_date ?? '—'}`}
                </p>
              </div>
              {cycleBadge(cycle.status)}
            </button>
          ))}
        </div>
      )}

      {selectedCycle && (
        <div className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">{selectedCycle.name} — User Reviews</h3>
            <span className="text-xs text-muted-foreground">{reviewed}/{total} reviewed</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {reviewsLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No users in this review cycle.</p>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Roles</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Last Login</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Decision</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reviews.map(review => (
                      <tr key={review.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar name={review.user_name || 'U'} />
                            <div>
                              <p className="text-xs font-medium text-foreground">{review.user_name || '—'}</p>
                              <p className="text-[11px] text-muted-foreground">{review.user_email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {(review.current_roles ?? []).map((r: string) => <RoleBadge key={r} role={r} />)}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                          {timeAgo(review.last_login)}
                        </td>
                        <td className="px-4 py-3">
                          {review.decision ? (
                            <div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                review.decision === 'certify' ? 'bg-green-100 text-green-700'
                                : review.decision === 'revoke' ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {review.decision === 'certify' ? 'Certified' : review.decision === 'revoke' ? 'Revoked' : 'Modify'}
                              </span>
                              {review.decision_reason && <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[120px] truncate">{review.decision_reason}</p>}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {review.status !== 'reviewed' ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                value={decisionReasons[review.id] ?? ''}
                                onChange={e => setDecisionReasons(prev => ({ ...prev, [review.id]: e.target.value }))}
                                placeholder="Reason (optional)"
                                className="text-xs border border-border rounded-md px-2 py-1 bg-input focus:outline-none focus:ring-1 focus:ring-primary/30 w-28 hidden lg:block"
                              />
                              <button
                                onClick={() => handleDecision(review.id, 'certify')}
                                disabled={deciding.has(review.id)}
                                className="flex items-center gap-0.5 px-2 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                                title="Certify"
                              >
                                {deciding.has(review.id) ? <Loader2 size={10} className="animate-spin" /> : <Check size={11} />}
                                <span className="hidden sm:inline">Certify</span>
                              </button>
                              <button
                                onClick={() => handleDecision(review.id, 'modify')}
                                disabled={deciding.has(review.id)}
                                className="flex items-center gap-0.5 px-2 py-1.5 text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors disabled:opacity-50"
                                title="Modify"
                              >
                                <Edit2 size={11} />
                                <span className="hidden sm:inline">Modify</span>
                              </button>
                              <button
                                onClick={() => handleDecision(review.id, 'revoke')}
                                disabled={deciding.has(review.id)}
                                className="flex items-center gap-0.5 px-2 py-1.5 text-xs font-medium bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                                title="Revoke"
                              >
                                <X size={11} />
                                <span className="hidden sm:inline">Revoke</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end">
                              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                <Check size={11} /> Done
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
type ActiveTab = 'users' | 'sessions' | 'login-history' | 'access-review' | 'audit';
interface Props { accessToken: string; onLogout: () => void; }

export function UserManagement({ accessToken, onLogout }: Props) {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const primaryRole = currentUser?.primaryRole ?? 'employee';
  const [activeTab, setActiveTab] = useState<ActiveTab>('users');

  if (primaryRole !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Shield size={40} className="text-muted-foreground mx-auto mb-3 opacity-40" />
          <h2 className="font-semibold text-foreground mb-1">Access Denied</h2>
          <p className="text-sm text-muted-foreground mb-4">{t('userMgmt.accessDenied')}</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">Go to Home</button>
        </div>
      </div>
    );
  }

  const um = useUserManagement();
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showDeletedUsers, setShowDeletedUsers] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | undefined>();
  const [roleModalUser, setRoleModalUser] = useState<UserWithRole | undefined>();
  const [roleChangeUser, setRoleChangeUser] = useState<UserWithRole | undefined>();
  const [resetPwUser, setResetPwUser] = useState<UserWithRole | undefined>();
  const [mfaUser, setMfaUser] = useState<(UserWithRole & { mfa_enrolled?: boolean; force_mfa?: boolean }) | undefined>();
  const [confirmAction, setConfirmAction] = useState<{
    type: 'deactivate' | 'delete' | 'restore' | 'resend-invite';
    user: UserWithRole & { invitation_sent_at?: string; deleted_at?: string };
  } | null>(null);
  const [deletedUsers, setDeletedUsers] = useState<(UserWithRole & { deleted_at?: string; purge_scheduled_at?: string })[]>([]);
  const [deletedLoading, setDeletedLoading] = useState(false);

  // Bulk role assignment state
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkRole, setBulkRole] = useState('employee');
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Load deleted users when toggled on
  useEffect(() => {
    if (!showDeletedUsers) return;
    setDeletedLoading(true);
    (supabase as any)
      .from('app_users')
      .select('*')
      .eq('status', 'deleted')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .then(({ data }: any) => setDeletedUsers(data ?? []))
      .finally(() => setDeletedLoading(false));
  }, [showDeletedUsers]);

  // Active users (exclude deleted)
  const activeUsers = um.users.filter(u => u.status !== 'deleted' && !(u as any).deleted_at);

  const filtered = activeUsers.filter(u => {
    const matchSearch = !search || [u.name, u.email, u.department ?? ''].some(f => f.toLowerCase().includes(search.toLowerCase()));
    const matchRole = !filterRole || u.roles.includes(filterRole as UserRole);
    const matchStatus = !filterStatus || u.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const pagination = usePagination(filtered, 20);
  const { paginatedItems: paginatedUsers, reset: resetPagination } = pagination;

  useEffect(() => { resetPagination(); }, [search, filterRole, filterStatus]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(u => selectedUsers.includes(u.id));
  const someSelected = selectedUsers.length > 0;

  const BULK_CAP = 100;

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedUsers(prev => prev.filter(id => !filtered.some(u => u.id === id)));
    } else {
      if (filtered.length > BULK_CAP) {
        toast.warning(t('userMgmt.bulkActionCap'));
        const capped = filtered.slice(0, BULK_CAP).map(u => u.id);
        setSelectedUsers(prev => [...new Set([...prev, ...capped])].slice(0, BULK_CAP));
      } else {
        const combined = [...new Set([...selectedUsers, ...filtered.map(u => u.id)])];
        if (combined.length > BULK_CAP) {
          toast.warning(t('userMgmt.bulkActionCap'));
          setSelectedUsers(combined.slice(0, BULK_CAP));
        } else {
          setSelectedUsers(combined);
        }
      }
    }
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUsers(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= BULK_CAP) {
        toast.warning(t('userMgmt.bulkActionCap'));
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleBulkAssign = async () => {
    if (!selectedUsers.length) { toast.error(t('validation.user.bulkSelection')); return; }
    if (!bulkRole) { toast.error(t('validation.user.bulkRole')); return; }
    setBulkAssigning(true);
    try {
      const results = await Promise.allSettled(
        selectedUsers.map(id =>
          fetch(`${API_BASE}/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
            body: JSON.stringify({ role: bulkRole }),
          })
        )
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      toast.success(`Assigned role to ${succeeded} user${succeeded !== 1 ? 's' : ''}`);
      setSelectedUsers([]);
      um.refreshUsers?.();
    } catch {
      toast.error('Bulk assignment failed');
    } finally {
      setBulkAssigning(false);
    }
  };

  // Enhanced deactivate: set status=inactive + send notification
  const handleDeactivate = async (user: UserWithRole) => {
    try {
      const { error } = await (supabase as any)
        .from('app_users')
        .update({ status: 'inactive' })
        .eq('id', user.id);
      if (error) throw error;
      void (supabase as any).from('notifications').insert([{
        user_id: user.id,
        title: 'Account Deactivated',
        message: 'Your account has been deactivated by an administrator.',
        type: 'warning',
        app_filter: 'user-mgmt',
        is_read: false,
      }]);
      toast.success(`${user.name} deactivated`);
      um.refreshUsers?.();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to deactivate user');
    }
  };

  // Enhanced delete: soft-delete
  const handleSoftDelete = async (user: UserWithRole) => {
    try {
      const now = new Date();
      const purge = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const { error } = await (supabase as any)
        .from('app_users')
        .update({
          deleted_at: now.toISOString(),
          purge_scheduled_at: purge.toISOString(),
          status: 'deleted',
        })
        .eq('id', user.id);
      if (error) throw error;
      toast.success(`${user.name} soft-deleted. Purge in 30 days.`);
      um.refreshUsers?.();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete user');
    }
  };

  // Restore deleted user
  const handleRestore = async (user: UserWithRole) => {
    try {
      void (supabase as any)
        .from('app_users')
        .update({ deleted_at: null, purge_scheduled_at: null, status: 'active' })
        .eq('id', user.id);
      toast.success(`${user.name} restored`);
      setDeletedUsers(prev => prev.filter(u => u.id !== user.id));
      um.refreshUsers?.();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to restore user');
    }
  };

  // Resend invite
  const handleResendInvite = async (user: UserWithRole & { resend_count?: number }) => {
    const currentCount = user.resend_count ?? 0;
    if (currentCount >= 3) {
      toast.error(t('userMgmt.maxResendsReached'));
      return;
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      void (supabase as any)
        .from('app_users')
        .update({
          invitation_sent_at: now.toISOString(),
          invitation_expires_at: expiresAt,
          resend_count: currentCount + 1,
        })
        .eq('id', user.id);
      toast.success(`Invitation resent to ${user.email}`);
      um.refreshUsers?.();
    } catch {
      toast.error('Failed to resend invite');
    }
  };

  // Cancel invite
  const handleCancelInvite = async (user: UserWithRole) => {
    try {
      void (supabase as any)
        .from('app_users')
        .update({ status: 'cancelled', invitation_token: null })
        .eq('id', user.id);
      toast.success(`Invitation cancelled for ${user.email}`);
      um.refreshUsers?.();
    } catch {
      toast.error('Failed to cancel invite');
    }
  };

  const stats = {
    total: um.users.length,
    active: um.users.filter(u => u.status === 'active').length,
    inactive: um.users.filter(u => u.status !== 'active' && u.status !== 'deleted').length,
    admins: um.users.filter(u => u.roles.includes('admin')).length,
  };

  const inviteDaysOld = (invitedAt?: string) => {
    if (!invitedAt) return 0;
    return Math.floor((Date.now() - new Date(invitedAt).getTime()) / 86400000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-primary" />
            <h1 className="font-semibold text-foreground text-sm">{t('userMgmt.title')}</h1>
            {!um.loading && <span className="text-xs text-muted-foreground">({um.users.length} users)</span>}
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'users' && (
              <>
                <button
                  onClick={() => exportUsersCSV(filtered)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors"
                  title="Export filtered users as CSV"
                >
                  <Download size={13} /> Export CSV
                </button>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <Send size={13} /> Invite User
                </button>
                <button
                  onClick={() => { setEditingUser(undefined); setShowCreateForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <UserCheck size={13} /> Grant Access
                </button>
              </>
            )}
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1 border-t border-border overflow-x-auto">
          {([
            { key: 'users' as const, label: 'Users', icon: Users },
            { key: 'sessions' as const, label: 'Sessions', icon: Activity },
            { key: 'login-history' as const, label: 'Login History', icon: Clock },
            { key: 'access-review' as const, label: 'Access Review', icon: ShieldCheck },
            { key: 'audit' as const, label: 'Audit Log', icon: ClipboardList },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                activeTab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Audit Log Tab */}
        {activeTab === 'audit' && <AuditLogTab />}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && <SessionsTab currentUserId={currentUser?.id} />}

        {/* Login History Tab */}
        {activeTab === 'login-history' && <LoginHistoryTab />}

        {/* Access Review Tab */}
        {activeTab === 'access-review' && <AccessReviewTab currentUserId={currentUser?.id} />}

        {/* Users Tab */}
        {activeTab === 'users' && <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Users', value: stats.total },
              { label: 'Active', value: stats.active },
              { label: 'Inactive', value: stats.inactive },
              { label: 'Admins', value: stats.admins },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl px-4 py-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                {um.loading ? <div className="h-6 w-8 bg-muted animate-pulse rounded mt-1" /> : <p className="text-xl font-bold text-foreground">{s.value}</p>}
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, email, department…"
                className="w-full pl-8 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-1 focus:ring-primary/30"
              aria-label="Filter by role"
            >
              <option value="">All Roles</option>
              <SelectOptions entity="user" field="role" fallback={['Admin', 'Manager', 'Employee', 'HR', 'Finance']} />
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-1 focus:ring-primary/30"
              aria-label="Filter by status"
            >
              <option value="">All Statuses</option>
              <SelectOptions entity="user" field="status" fallback={['active','inactive','suspended','invited']} />
            </select>
            <button
              onClick={() => setShowDeletedUsers(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs border rounded-lg transition-colors ${showDeletedUsers ? 'border-red-300 bg-red-50 text-red-600' : 'border-border hover:bg-muted text-muted-foreground'}`}
            >
              <Trash2 size={12} /> {showDeletedUsers ? 'Hide Deleted' : 'Show Deleted'}
            </button>
          </div>

          {/* User table */}
          {um.loading ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search || filterRole || filterStatus ? 'No users match your filters.' : 'No users found.'}</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table" aria-label="Users list">
                  <thead>
                    <tr role="row" className="border-b border-border bg-muted/40">
                      <th role="columnheader" scope="col" className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-border cursor-pointer"
                          title="Select all"
                        />
                      </th>
                      <th role="columnheader" scope="col" className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                      <th role="columnheader" scope="col" className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Roles</th>
                      <th role="columnheader" scope="col" className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Department</th>
                      <th role="columnheader" scope="col" className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                      <th role="columnheader" scope="col" className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Last Login</th>
                      <th role="columnheader" scope="col" className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden xl:table-cell">MFA</th>
                      <th role="columnheader" scope="col" className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedUsers.map(user => {
                      const u = user as UserWithRole & { mfa_enrolled?: boolean; force_mfa?: boolean; invitation_sent_at?: string; invitation_expires_at?: string; resend_count?: number };
                      const isInactive = u.status === 'inactive';
                      const isInvited = u.status === 'invited' || u.status === 'pending';
                      const canResend = isInvited;
                      const resendCount = u.resend_count ?? 0;
                      const resendExhausted = resendCount >= 3;
                      const expiryDays = u.invitation_expires_at ? daysUntil(u.invitation_expires_at) : (u.invitation_sent_at ? daysUntil(new Date(new Date(u.invitation_sent_at).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()) : null);
                      const _ = inviteDaysOld; // keep used
                      return (
                        <tr key={u.id} role="row" className={`hover:bg-muted/30 transition-colors group ${selectedUsers.includes(u.id) ? 'bg-primary/5' : ''} ${isInactive ? 'opacity-60' : ''}`}>
                          <td className="px-4 py-3 w-10">
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(u.id)}
                              onChange={() => toggleSelectUser(u.id)}
                              className="w-4 h-4 rounded border-border cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={u.name} />
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className={`font-medium text-foreground ${isInactive ? 'italic text-muted-foreground' : ''}`}>{u.name}</p>
                                  {(u as any).employeeId && (
                                    <span title="Linked to employee profile" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-[10px] font-medium">
                                      <Link2 size={9} /> HR
                                    </span>
                                  )}
                                  {isInvited && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                                      Invited
                                      {expiryDays !== null && expiryDays > 0 && (
                                        <span className="opacity-75">· {t('userMgmt.inviteExpiry').replace('{days}', String(expiryDays))}</span>
                                      )}
                                      {expiryDays !== null && expiryDays <= 0 && (
                                        <span className="opacity-75">· Expired</span>
                                      )}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                                {u.invitation_sent_at && isInvited && (
                                  <p className="text-[10px] text-muted-foreground">Invited {timeAgo(u.invitation_sent_at)}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {u.roles.map(r => <RoleBadge key={r} role={r} />)}
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">{u.department ?? '—'}</td>
                          <td className="px-4 py-3"><StatusDot status={u.status} /></td>
                          <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">{timeAgo(u.lastLogin)}</td>
                          <td className="px-4 py-3 hidden xl:table-cell">
                            {u.mfa_enrolled
                              ? <span title="MFA enrolled" className="inline-flex items-center gap-1 text-xs text-green-700"><ShieldCheck size={13} /> On</span>
                              : <span title="MFA not enrolled" className="inline-flex items-center gap-1 text-xs text-muted-foreground"><ShieldOff size={13} /> Off</span>
                            }
                            {u.force_mfa && <span className="ml-1 text-[10px] text-orange-600 font-medium">Forced</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              {/* Edit */}
                              <button
                                onClick={() => { setEditingUser(u); setShowCreateForm(true); }}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors sm:opacity-0 group-hover:opacity-100"
                                aria-label={`Edit ${u.name}`}
                                title="Edit user"
                              >
                                <Edit2 size={13} className="text-muted-foreground" />
                              </button>
                              {/* Roles */}
                              <button
                                onClick={() => setRoleChangeUser(u)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 transition-colors sm:opacity-0 group-hover:opacity-100"
                                aria-label={`Manage roles for ${u.name}`}
                                title="Change role"
                              >
                                <Shield size={13} className="text-blue-500" />
                              </button>
                              {/* MFA */}
                              <button
                                onClick={() => setMfaUser(u)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-violet-50 transition-colors sm:opacity-0 group-hover:opacity-100"
                                aria-label={`MFA settings for ${u.name}`}
                                title="MFA settings"
                              >
                                <ShieldAlert size={13} className="text-violet-500" />
                              </button>
                              {/* Reset password */}
                              <button
                                onClick={() => setResetPwUser(u)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-orange-50 transition-colors sm:opacity-0 group-hover:opacity-100"
                                aria-label={`Reset password for ${u.name}`}
                                title="Reset password"
                              >
                                <Lock size={13} className="text-orange-500" />
                              </button>
                              {/* Resend invite */}
                              {canResend && (
                                <button
                                  onClick={() => !resendExhausted && handleResendInvite(u)}
                                  disabled={resendExhausted}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 transition-colors sm:opacity-0 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                                  aria-label={`Resend invite to ${u.name}`}
                                  title={resendExhausted ? t('userMgmt.maxResendsReached') : `Resend invite (${resendCount}/3)`}
                                >
                                  <Send size={13} className="text-blue-500" />
                                </button>
                              )}
                              {/* Cancel invite */}
                              {canResend && (
                                <button
                                  onClick={() => handleCancelInvite(u)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors sm:opacity-0 group-hover:opacity-100"
                                  aria-label={`Cancel invite for ${u.name}`}
                                  title={t('userMgmt.cancelInvite')}
                                >
                                  <X size={13} className="text-red-400" />
                                </button>
                              )}
                              {/* Deactivate/Activate */}
                              {u.id !== currentUser?.id && (
                                <button
                                  onClick={() => setConfirmAction({ type: 'deactivate', user: u })}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-yellow-50 transition-colors sm:opacity-0 group-hover:opacity-100"
                                  aria-label={u.status === 'active' ? `Deactivate ${u.name}` : `Activate ${u.name}`}
                                  title={u.status === 'active' ? 'Deactivate' : 'Activate'}
                                >
                                  <Power size={13} className={u.status === 'active' ? 'text-yellow-500' : 'text-green-500'} />
                                </button>
                              )}
                              {/* Soft delete */}
                              {u.id !== currentUser?.id && (
                                <button
                                  onClick={() => setConfirmAction({ type: 'delete', user: u })}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors sm:opacity-0 group-hover:opacity-100"
                                  aria-label={`Delete ${u.name}`}
                                  title="Delete user (soft)"
                                >
                                  <Trash2 size={13} className="text-red-400" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={pagination.currentPage}
                totalItems={pagination.totalItems}
                pageSize={pagination.pageSize}
                onPageChange={pagination.onPageChange}
                onPageSizeChange={pagination.onPageSizeChange}
              />
            </div>
          )}

          {/* Deleted Users Section */}
          {showDeletedUsers && (
            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-semibold text-red-600 flex items-center gap-2">
                <Trash2 size={14} /> Deleted Users
              </h3>
              {deletedLoading ? (
                <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}</div>
              ) : deletedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No deleted users.</p>
              ) : (
                <div className="bg-card border border-red-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-red-100 bg-red-50/50">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Deleted</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Purge In</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100">
                        {deletedUsers.map(u => {
                          const purgeIn = daysUntil((u as any).purge_scheduled_at);
                          return (
                            <tr key={u.id} className="bg-red-50/30 hover:bg-red-50/60 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <Avatar name={u.name} />
                                  <div>
                                    <p className="text-sm font-medium text-foreground line-through opacity-60">{u.name}</p>
                                    <p className="text-xs text-muted-foreground">{u.email}</p>
                                  </div>
                                  <StatusBadge status="deleted" />
                                </div>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                                {(u as any).deleted_at ? new Date((u as any).deleted_at).toLocaleDateString() : '—'}
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <span className={`text-xs font-medium ${purgeIn <= 7 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                  {purgeIn > 0 ? `${purgeIn} day${purgeIn !== 1 ? 's' : ''}` : 'Scheduled'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex justify-end">
                                  <button
                                    onClick={() => setConfirmAction({ type: 'restore', user: u })}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                                  >
                                    <RotateCcw size={11} /> Restore
                                  </button>
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
            </div>
          )}
        </>}
      </div>

      {/* Bulk action bar */}
      {someSelected && activeTab === 'users' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-card border border-border rounded-xl shadow-xl px-4 py-3">
          <span className="text-sm font-medium text-foreground">{selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected</span>
          <span className="text-muted-foreground">|</span>
          <label className="text-xs text-muted-foreground">Role:</label>
          <select
            value={bulkRole}
            onChange={e => setBulkRole(e.target.value)}
            className="text-sm border border-border rounded-lg px-2 py-1.5 bg-input focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {ALL_ROLES.map(r => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
          <button
            onClick={handleBulkAssign}
            disabled={bulkAssigning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {bulkAssigning && <Loader2 size={12} className="animate-spin" />}
            Assign Role
          </button>
          <button
            onClick={() => setSelectedUsers([])}
            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <X size={12} /> Cancel
          </button>
        </div>
      )}

      {/* Modals */}
      {showInviteModal && (
        <InviteUserModal
          onClose={() => setShowInviteModal(false)}
          onDone={() => um.refreshUsers?.()}
        />
      )}
      {showCreateForm && !editingUser && (
        <ProvisionForm
          onClose={() => setShowCreateForm(false)}
          onDone={() => um.refreshUsers()}
          existingUserEmails={new Set(um.users.map((u: any) => u.email?.toLowerCase()).filter(Boolean))}
        />
      )}
      {showCreateForm && editingUser && (
        <UserForm
          initial={editingUser}
          onSubmit={(data) => um.updateUser(editingUser.id, data).then(() => {})}
          onClose={() => { setShowCreateForm(false); setEditingUser(undefined); }}
        />
      )}
      {roleModalUser && (
        <RoleModal
          user={roleModalUser}
          onSave={(roles) => um.assignRoles(roleModalUser.id, roles).then(() => {})}
          onClose={() => setRoleModalUser(undefined)}
        />
      )}
      {roleChangeUser && (
        <RoleChangeModal
          user={roleChangeUser}
          currentAdminRole={primaryRole}
          onClose={() => setRoleChangeUser(undefined)}
          onDone={() => { um.refreshUsers?.(); setRoleChangeUser(undefined); }}
        />
      )}
      {mfaUser && (
        <MFAModal
          user={mfaUser}
          onClose={() => setMfaUser(undefined)}
          onDone={() => um.refreshUsers?.()}
        />
      )}
      {resetPwUser && (
        <ResetPasswordModal user={resetPwUser} onClose={() => setResetPwUser(undefined)} />
      )}

      {/* Deactivate confirm */}
      {confirmAction?.type === 'deactivate' && (
        <ConfirmDialog
          title={confirmAction.user.status === 'active' ? 'Deactivate User' : 'Activate User'}
          message={confirmAction.user.status === 'active'
            ? `Deactivate ${confirmAction.user.name}? They will lose access but their data is retained. You can reactivate them at any time.`
            : `This will restore access for ${confirmAction.user.name}. Continue?`}
          confirmLabel={confirmAction.user.status === 'active' ? t('userMgmt.deactivate') : 'Activate'}
          danger={confirmAction.user.status === 'active'}
          onConfirm={async () => {
            if (confirmAction.user.status === 'active') {
              await handleDeactivate(confirmAction.user);
            } else {
              await um.toggleUserStatus(confirmAction.user.id);
            }
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Delete confirm — two-step */}
      {confirmAction?.type === 'delete' && (
        <TwoStepDeleteDialog
          user={confirmAction.user as any}
          onConfirm={async () => { await handleSoftDelete(confirmAction.user); setConfirmAction(null); }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Restore confirm */}
      {confirmAction?.type === 'restore' && (
        <ConfirmDialog
          title="Restore User"
          message={`Restore ${confirmAction.user.name}? Their account will be reactivated and removed from the deletion queue.`}
          confirmLabel="Restore"
          onConfirm={async () => { await handleRestore(confirmAction.user); setConfirmAction(null); }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Resend invite confirm */}
      {confirmAction?.type === 'resend-invite' && (
        <ConfirmDialog
          title="Resend Invitation"
          message={`Resend invitation email to ${confirmAction.user.email}?`}
          confirmLabel="Resend"
          onConfirm={async () => { await handleResendInvite(confirmAction.user); setConfirmAction(null); }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

export default UserManagement;
