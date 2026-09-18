/**
 * Employee Directory — Phase 8
 * Added: Skill Matrix view, Document Vault (Supabase Storage), Audit Trail tab,
 * Education/Certifications/Previous Employers tab, Quick Contact hover card,
 * Column Picker, Employee Code display, Audit log on updates.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { InlineLoader } from '../ui/PageLoader';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import {
  Users, Search, Plus, Download, Edit2, Trash2, X, Check,
  Loader2, AlertCircle, ChevronDown, ChevronRight, MapPin, Phone, Mail,
  Building2, Calendar, GitBranch, List, Filter, LayoutGrid,
  UserCircle, AlertTriangle, Shield, Upload, FileText,
  Grid3X3, Settings2, ExternalLink, Linkedin, Github, Clock,
  GraduationCap, Award, Briefcase, MessageSquare, VideoIcon, Lock, ShieldCheck,
} from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { API_BASE, publicAnonKey, safeJson, supabase } from '../../utils/constants';
import {
  useDirectoryData, DirectoryEmployee, OrgNode, EmergencyContact,
  LIFECYCLE_STATUSES, EMERGENCY_RELATIONSHIPS,
} from '../../hooks/useDirectoryData';
import { EMPLOYEE_STATUSES } from '../../../constants/apps/directory';
import { SelectOptions } from '../../context/ValueHelpsContext';
import { useDepartmentOptions, useLocationOptions } from '../../hooks/useSharedData';
import { t } from '../../../i18n/index';
import { useSectionPermission } from '../SectionGuard';

// ── Document types ─────────────────────────────────────────────────────────
const EMPLOYEE_DOCUMENT_TYPES = [
  'Aadhaar', 'PAN', 'Passport', 'Offer Letter', 'Joining Letter',
  'NDA', 'Appraisal Letter', 'Experience Letter', 'Resignation',
  'Relieving Letter', 'Salary Slip', 'Educational', 'Medical', 'Other',
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

interface EmployeeDocument {
  id: string;
  employee_id: string;
  name?: string;
  document_type?: string;
  doc_type?: string;
  file_name?: string;
  file_size_bytes?: number;
  file_size?: number;
  mime_type?: string;
  storage_path?: string;
  file_url?: string;
  expiry_date?: string;
  is_verified?: boolean;
  version_number?: number;
  notes?: string;
  uploaded_by?: string;
  created_at: string;
  status?: string;
}

interface EducationRecord {
  id?: string;
  employee_id: string;
  institution: string;
  degree: string;
  field_of_study: string;
  start_year: number | null;
  end_year: number | null;
  grade: string;
}

interface CertificationRecord {
  id?: string;
  employee_id: string;
  certification_name: string;
  issuing_organization: string;
  issue_date: string;
  expiry_date: string;
  credential_url: string;
  certificate_file_url: string;
}

interface PreviousEmployerRecord {
  id?: string;
  employee_id: string;
  company_name: string;
  job_title: string;
  start_date: string;
  end_date: string;
  last_salary: string;
  reason_for_leaving: string;
}

interface AuditLogEntry {
  id: string;
  employee_id: string;
  changed_by: string;
  change_type: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  change_reason: string | null;
  created_at: string;
  changer_name?: string;
}

// ── Default visible columns ────────────────────────────────────────────────
const ALL_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'employee_code', label: 'Emp Code' },
  { key: 'department', label: 'Department' },
  { key: 'designation', label: 'Designation' },
  { key: 'manager', label: 'Manager' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'location', label: 'Location' },
  { key: 'status', label: 'Status' },
  { key: 'join_date', label: 'Join Date' },
];
const DEFAULT_COLUMNS = ['name', 'department', 'designation', 'manager', 'location', 'status'];

// ── Proficiency colors ─────────────────────────────────────────────────────
const PROFICIENCY_COLORS: Record<string, string> = {
  beginner:     'bg-yellow-100 text-yellow-700',
  intermediate: 'bg-blue-100 text-blue-700',
  advanced:     'bg-green-100 text-green-700',
  expert:       'bg-purple-100 text-purple-700',
};

// ── Lifecycle badge ────────────────────────────────────────────────────────
const LIFECYCLE_COLORS: Record<string, string> = {
  'Active':    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'On Notice': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Resigned':  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'On Leave':  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

function LifecycleBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${LIFECYCLE_COLORS[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: 'bg-green-100 text-green-700',
    'On Leave': 'bg-yellow-100 text-yellow-700',
    Inactive: 'bg-gray-100 text-gray-500',
    Remote: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const sizeMap = { sm: 'w-7 h-7 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base', xl: 'w-16 h-16 text-lg' };
  const colors = ['bg-blue-500', 'bg-violet-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`${sizeMap[size]} ${color} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl p-6 max-w-sm w-full">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

function F({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}{required && ' *'}</label>
      {children}
    </div>
  );
}

function ManagerPicker({ value, managers, onChange }: {
  value: string | undefined;
  managers: DirectoryEmployee[];
  onChange: (id: string | undefined) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = managers.find(m => m.id === value);
  const filtered = query.trim()
    ? managers.filter(m => m.name.toLowerCase().includes(query.toLowerCase()) || (m.designation ?? '').toLowerCase().includes(query.toLowerCase()))
    : managers;
  return (
    <div className="relative">
      <input
        value={open ? query : (selected ? `${selected.name} — ${selected.designation}` : '')}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search by name or designation…"
        className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      {open && (
        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
          <button type="button" onMouseDown={() => { onChange(undefined); setOpen(false); }}
            className="w-full text-left px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted border-b border-border transition-colors italic">
            No Manager (Top Level)
          </button>
          {filtered.map(m => (
            <button key={m.id} type="button" onMouseDown={() => { onChange(m.id); setOpen(false); setQuery(''); }}
              className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted border-b border-border last:border-b-0 transition-colors ${m.id === value ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}>
              <span className="font-medium">{m.name}</span>
              {m.designation && <span className="text-xs text-muted-foreground ml-1.5">· {m.designation}</span>}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-2.5 text-xs text-muted-foreground">No match found</p>}
        </div>
      )}
    </div>
  );
}

// ── Employee form ──────────────────────────────────────────────────────────
function EmployeeForm({
  initial, managers, onSubmit, onClose,
}: {
  initial?: Partial<DirectoryEmployee>;
  managers: DirectoryEmployee[];
  onSubmit: (data: Partial<DirectoryEmployee>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<DirectoryEmployee>>({
    name: '', email: '', phone: '', department: '',
    designation: '', location: '', status: 'Active',
    lifecycleStatus: 'Active', skills: [],
    join_date: new Date().toISOString().split('T')[0],
    ...initial,
  });
  const { options: departments = [] } = useDepartmentOptions();
  const { options: locations = [] } = useLocationOptions();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const empty_ec: EmergencyContact = { name: '', relationship: 'Spouse', phone: '', alternate_phone: '', email: '' };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name?.trim()) e.name = t('validation.employee.name');
    if (!form.email?.trim()) e.email = t('validation.employee.email');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t('validation.employee.email.format');
    if (!form.designation?.trim()) e.designation = t('validation.employee.designation');
    if (form.phone?.trim() && !/^\+?[\d\s\-() ]{7,15}$/.test(form.phone.trim())) e.phone = t('validation.employee.phone.format');
    if (!form.emergencyContact?.phone?.trim()) e.emergencyPhone = t('validation.employee.emergencyPhone');
    const ecEmail = form.emergencyContact?.email;
    if (ecEmail?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ecEmail)) e.emergencyEmail = t('validation.email.format');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) { toast.error(t('common.error')); return; }
    setSaving(true);
    try {
      await onSubmit(form);
      onClose();
    } catch { } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !(form.skills ?? []).includes(s)) {
      setForm(f => ({ ...f, skills: [...(f.skills ?? []), s] }));
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) => setForm(f => ({ ...f, skills: (f.skills ?? []).filter(s => s !== skill) }));

  const inp = "w-full text-sm border border-border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-foreground">{initial?.id ? 'Edit Employee' : t('directory.addEmployee')}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <F label="Full Name" required>
              <input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={`${inp} ${errors.name ? 'border-red-400' : 'border-border focus:border-primary'}`} />
              {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
            </F>
            <F label="Email" required>
              <input type="email" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className={`${inp} ${errors.email ? 'border-red-400' : 'border-border focus:border-primary'}`} />
              {errors.email && <p className="text-xs text-red-500 mt-0.5">{errors.email}</p>}
            </F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Phone">
              <input value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className={`${inp} ${errors.phone ? 'border-red-400' : 'border-border focus:border-primary'}`} />
              {errors.phone && <p className="text-xs text-red-500 mt-0.5">{errors.phone}</p>}
            </F>
            <F label="Designation" required>
              <input value={form.designation ?? ''} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
                className={`${inp} ${errors.designation ? 'border-red-400' : 'border-border focus:border-primary'}`} />
              {errors.designation && <p className="text-xs text-red-500 mt-0.5">{errors.designation}</p>}
            </F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Department">
              <select value={form.department ?? ''} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className={inp}>
                <option value="">Select department</option>
                {departments.map(d => <option key={d.label} value={d.label}>{d.label}</option>)}
              </select>
            </F>
            <F label="Location">
              <select value={form.location ?? ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inp}>
                <option value="">Select location</option>
                {locations.map(l => <option key={l.label} value={l.label}>{l.label}</option>)}
              </select>
            </F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Join Date">
              <input type="date" value={form.join_date ?? ''} onChange={e => setForm(f => ({ ...f, join_date: e.target.value }))} className={inp} />
            </F>
            <F label="Status">
              <select value={form.status ?? 'Active'} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))} className={inp}>
                <SelectOptions entity="employee" field="status" fallback={['Active', 'Inactive', 'On Leave', 'Terminated']} />
              </select>
            </F>
          </div>
          <F label="Lifecycle Status">
            <select value={form.lifecycleStatus ?? 'Active'} onChange={e => setForm(f => ({ ...f, lifecycleStatus: e.target.value as any }))} className={inp}>
              {LIFECYCLE_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </F>
          <F label="Reporting Manager">
            <ManagerPicker
              value={form.manager_id}
              managers={managers.filter(m => m.id !== form.id)}
              onChange={id => setForm(f => ({ ...f, manager_id: id }))}
            />
          </F>
          <F label="Skills">
            <div className="flex gap-2 mb-2">
              <input value={skillInput} onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                placeholder="Type a skill and press Enter" className={`flex-1 ${inp}`} />
              <button type="button" onClick={addSkill} className="px-3 py-2 text-sm bg-muted border border-border rounded-lg hover:bg-muted/80 transition-colors">Add</button>
            </div>
            {(form.skills ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(form.skills ?? []).map(s => (
                  <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                    {s}
                    <button type="button" onClick={() => removeSkill(s)} className="hover:text-red-500 transition-colors"><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
          </F>

          {/* Emergency Contact */}
          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Shield size={12} /> Emergency Contact
            </p>
            <div className="grid grid-cols-2 gap-3">
              <F label="Contact Name">
                <input value={form.emergencyContact?.name ?? ''} onChange={e => setForm(f => ({ ...f, emergencyContact: { ...empty_ec, ...f.emergencyContact, name: e.target.value } }))}
                  className={inp} placeholder="Full name" />
              </F>
              <F label="Relationship">
                <select value={form.emergencyContact?.relationship ?? 'Spouse'} onChange={e => setForm(f => ({ ...f, emergencyContact: { ...empty_ec, ...f.emergencyContact, relationship: e.target.value } }))} className={inp}>
                  {EMERGENCY_RELATIONSHIPS.map(r => <option key={r}>{r}</option>)}
                </select>
              </F>
              <F label="Phone">
                <input value={form.emergencyContact?.phone ?? ''} onChange={e => setForm(f => ({ ...f, emergencyContact: { ...empty_ec, ...f.emergencyContact, phone: e.target.value } }))}
                  className={`${inp} ${errors.emergencyPhone ? 'border-red-400' : ''}`} placeholder="+91 98765 43210" />
                {errors.emergencyPhone && <p className="text-xs text-red-500 mt-0.5">{errors.emergencyPhone}</p>}
              </F>
              <F label="Alternate Phone">
                <input value={form.emergencyContact?.alternate_phone ?? ''} onChange={e => setForm(f => ({ ...f, emergencyContact: { ...empty_ec, ...f.emergencyContact, alternate_phone: e.target.value } }))}
                  className={inp} placeholder="Optional" />
              </F>
            </div>
            <F label="Contact Email">
              <input type="email" value={form.emergencyContact?.email ?? ''} onChange={e => setForm(f => ({ ...f, emergencyContact: { ...empty_ec, ...f.emergencyContact, email: e.target.value } }))}
                className={`${inp} mt-3 ${errors.emergencyEmail ? 'border-red-400' : ''}`} placeholder="contact@example.com (optional)" />
              {errors.emergencyEmail && <p className="text-xs text-red-500 mt-0.5">{errors.emergencyEmail}</p>}
            </F>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {initial?.id ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Emergency Contact Tab ──────────────────────────────────────────────────
function EmergencyContactTab({
  employee, canEdit, canView, onSave,
}: {
  employee: DirectoryEmployee;
  canEdit: boolean;
  canView: boolean;
  onSave: (ec: EmergencyContact) => Promise<void>;
}) {
  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
        <Shield size={32} className="text-muted-foreground/40" />
        <div>
          <p className="text-sm font-medium text-foreground">Confidential</p>
          <p className="text-xs text-muted-foreground mt-1">Emergency contact details are only visible to HR, Admin, and the employee themselves.</p>
        </div>
      </div>
    );
  }
  const empty: EmergencyContact = { name: '', relationship: 'Spouse', phone: '', alternate_phone: '', email: '' };
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EmergencyContact>(employee.emergencyContact ?? empty);
  const [saving, setSaving] = useState(false);
  const inp = "w-full text-sm border border-border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30";

  useEffect(() => {
    if (!editing) setForm(employee.emergencyContact ?? empty);
  }, [employee.emergencyContact, editing]);

  const hasContact = !!(employee.emergencyContact?.name);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Contact name is required'); return; }
    setSaving(true);
    try { await onSave(form); setEditing(false); } catch { } finally { setSaving(false); }
  };

  if (!hasContact && !editing) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
        <Shield size={32} className="text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">No emergency contact on file</p>
        {canEdit && (
          <button onClick={() => setEditing(true)} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            Add Emergency Contact
          </button>
        )}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-3 py-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Edit Emergency Contact</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs text-muted-foreground mb-1">Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Relationship</label>
            <select value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))} className={inp}>
              {EMERGENCY_RELATIONSHIPS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div><label className="block text-xs text-muted-foreground mb-1">Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inp} /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Alt Phone</label><input value={form.alternate_phone ?? ''} onChange={e => setForm(f => ({ ...f, alternate_phone: e.target.value }))} className={inp} /></div>
          <div className="col-span-2"><label className="block text-xs text-muted-foreground mb-1">Email</label><input type="email" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inp} /></div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => { setForm(employee.emergencyContact ?? empty); setEditing(false); }} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60">
            {saving && <Loader2 size={13} className="animate-spin" />}<Check size={13} /> Save
          </button>
        </div>
      </div>
    );
  }

  const ec = employee.emergencyContact!;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emergency Contact</p>
        {canEdit && <button onClick={() => { setForm(ec); setEditing(true); }} className="flex items-center gap-1 text-xs text-primary hover:underline"><Edit2 size={11} /> Edit</button>}
      </div>
      <div className="bg-muted/30 rounded-xl px-4 py-1 space-y-2">
        {[
          { label: 'Name', value: ec.name, icon: UserCircle },
          { label: 'Relationship', value: ec.relationship, icon: Users },
          { label: 'Phone', value: ec.phone, icon: Phone },
          ...(ec.alternate_phone ? [{ label: 'Alt Phone', value: ec.alternate_phone, icon: Phone }] : []),
          { label: 'Email', value: ec.email ?? '', icon: Mail },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
            <Icon size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm text-foreground font-medium">{value || <span className="text-muted-foreground italic font-normal">Not set</span>}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Document Vault Tab ─────────────────────────────────────────────────────
function expiryStatus(expiryDate: string | null | undefined): 'expired' | 'critical' | 'expiring' | 'valid' | 'none' {
  if (!expiryDate) return 'none';
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (days <= 0) return 'expired';
  if (days <= 30) return 'critical';
  if (days <= 60) return 'expiring';
  return 'valid';
}

function getDocExpiryClass(expiry?: string): string {
  const s = expiryStatus(expiry);
  if (s === 'expired' || s === 'critical') return 'bg-red-50 border-red-200';
  if (s === 'expiring') return 'bg-amber-50 border-amber-200';
  return '';
}

function getDocExpiryBadge(expiry?: string): React.ReactNode {
  if (!expiry) return null;
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  const s = expiryStatus(expiry);
  if (s === 'expired') return <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">Expired</span>;
  if (s === 'critical') return <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">Expires in {days}d</span>;
  if (s === 'expiring') return <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">Expires in {days}d</span>;
  return <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">{new Date(expiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>;
}

function DocumentVaultTab({ employee, canEdit }: { employee: DirectoryEmployee; canEdit: boolean }) {
  const { currentUser } = useUser();
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ document_type: EMPLOYEE_DOCUMENT_TYPES[0], expiry_date: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('employee_documents')
        .select('*')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false });
      setDocs(data ?? []);
    } catch { setDocs([]); } finally { setLoading(false); }
  }, [employee.id]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleUpload = async () => {
    if (!selectedFile) { toast.error('Select a file first'); return; }
    if (selectedFile.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return; }
    setUploading(true);
    try {
      const ext = selectedFile.name.split('.').pop();
      const path = `${employee.id}/${uploadForm.document_type}/${Date.now()}.${ext}`;
      const { data: upload, error: uploadErr } = await supabase.storage
        .from('employee-documents')
        .upload(path, selectedFile, { upsert: false, contentType: selectedFile.type });
      if (uploadErr) throw uploadErr;
      const { error: docInsertErr } = await supabase.from('employee_documents').insert([{
        employee_id: employee.id,
        name: selectedFile.name,
        document_type: uploadForm.document_type,
        storage_path: upload?.path ?? path,
        file_size_bytes: selectedFile.size,
        mime_type: selectedFile.type,
        expiry_date: uploadForm.expiry_date || null,
        uploaded_by: currentUser?.id,
      }]);
      if (docInsertErr) throw new Error(docInsertErr.message);
      toast.success('Document uploaded');
      setShowUpload(false);
      setSelectedFile(null);
      setTimeout(fetchDocs, 500);
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed');
    } finally { setUploading(false); }
  };

  const handleDownload = async (doc: EmployeeDocument) => {
    const storagePath = doc.storage_path ?? doc.file_url;
    if (!storagePath) { toast.error('No file path available'); return; }
    try {
      const { data } = await supabase.storage
        .from('employee-documents')
        .createSignedUrl(storagePath, 3600);
      if (data?.signedUrl) {
        const a = document.createElement('a');
        a.href = data.signedUrl;
        a.download = doc.name ?? doc.file_name ?? 'document';
        a.click();
      }
    } catch { toast.error('Failed to get download link'); }
  };

  const handleDelete = async (docId: string) => {
    await supabase.from('employee_documents').delete().eq('id', docId);
    setDocs(d => d.filter(x => x.id !== docId));
    toast.success('Document removed');
  };

  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>;

  return (
    <div>
      {canEdit && (
        <div className="flex justify-end mb-3">
          <button onClick={() => setShowUpload(s => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            <Upload size={12} /> Upload Document
          </button>
        </div>
      )}

      {showUpload && (
        <div className="mb-4 p-4 border border-border rounded-xl bg-muted/20 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Document</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Document Type</label>
              <select value={uploadForm.document_type}
                onChange={e => setUploadForm(f => ({ ...f, document_type: e.target.value }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30">
                {EMPLOYEE_DOCUMENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Expiry Date (optional)</label>
              <input type="date" value={uploadForm.expiry_date}
                onChange={e => setUploadForm(f => ({ ...f, expiry_date: e.target.value }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">File (PDF/JPG/PNG, max 10MB)</label>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-input" />
            {selectedFile && <p className="text-xs text-muted-foreground mt-1">{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</p>}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowUpload(false); setSelectedFile(null); }}
              className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button onClick={handleUpload} disabled={uploading || !selectedFile}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors">
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      )}

      {docs.length === 0 ? (
        <div className="text-center py-8">
          <FileText size={28} className="mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className={`flex items-start justify-between p-3 rounded-lg border gap-2 ${getDocExpiryClass(doc.expiry_date) || 'bg-muted/30 border-border'}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground truncate">{doc.name ?? doc.file_name ?? doc.document_type}</p>
                  {doc.is_verified && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">Verified</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {doc.document_type ?? doc.doc_type}
                  {doc.file_size_bytes && ` · ${(doc.file_size_bytes / 1024).toFixed(1)} KB`}
                  {doc.created_at && ` · ${new Date(doc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </p>
                {doc.expiry_date && <div className="mt-1">{getDocExpiryBadge(doc.expiry_date)}</div>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {(doc.storage_path || doc.file_url) && (
                  <button onClick={() => handleDownload(doc)}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors"
                    title="Download">
                    <Download size={12} className="text-muted-foreground" />
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => handleDelete(doc.id)}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 transition-colors"
                    title="Delete">
                    <Trash2 size={11} className="text-red-400" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Audit Trail Tab ────────────────────────────────────────────────────────
function AuditTrailTab({ employee }: { employee: DirectoryEmployee }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterField, setFilterField] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('employee_audit_log')
          .select('*')
          .eq('employee_id', employee.id)
          .order('created_at', { ascending: false })
          .limit(200);
        setLogs(data ?? []);
      } catch { setLogs([]); } finally { setLoading(false); }
    })();
  }, [employee.id]);

  const distinctFields = Array.from(new Set(logs.map(l => l.field_name))).sort();

  const filtered = logs.filter(l => {
    if (filterField && l.field_name !== filterField) return false;
    if (filterFrom && new Date(l.created_at) < new Date(filterFrom)) return false;
    if (filterTo && new Date(l.created_at) > new Date(filterTo + 'T23:59:59')) return false;
    return true;
  });

  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}</div>;

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={filterField} onChange={e => setFilterField(e.target.value)}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-input focus:outline-none">
          <option value="">All Fields</option>
          {distinctFields.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-input focus:outline-none" placeholder="From" />
        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-input focus:outline-none" placeholder="To" />
        {(filterField || filterFrom || filterTo) && (
          <button onClick={() => { setFilterField(''); setFilterFrom(''); setFilterTo(''); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><X size={11} /> Clear</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No audit entries found</p>
        </div>
      ) : (
        <div className="border-l-2 border-primary/20 pl-4 space-y-3">
          {filtered.map(log => {
            const isExp = expanded.has(log.id);
            return (
              <div key={log.id} className="relative">
                <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-primary/60 border-2 border-background" />
                <div className="bg-muted/30 rounded-lg p-3 border border-border">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        <span className="text-primary">{log.field_name}</span>
                        {' changed'}
                      </p>
                      {!isExp && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {log.old_value ? `"${log.old_value.slice(0, 40)}"` : '(empty)'} → {log.new_value ? `"${log.new_value.slice(0, 40)}"` : '(empty)'}
                        </p>
                      )}
                    </div>
                    <button onClick={() => setExpanded(s => { const n = new Set(s); n.has(log.id) ? n.delete(log.id) : n.add(log.id); return n; })}
                      className="text-xs text-muted-foreground hover:text-foreground flex-shrink-0 flex items-center gap-0.5">
                      {isExp ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    </button>
                  </div>
                  {isExp && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div><p className="text-xs text-muted-foreground mb-1">Old value</p><pre className="text-xs bg-muted px-2 py-1 rounded whitespace-pre-wrap break-all">{log.old_value ?? '(empty)'}</pre></div>
                      <div><p className="text-xs text-muted-foreground mb-1">New value</p><pre className="text-xs bg-muted px-2 py-1 rounded whitespace-pre-wrap break-all">{log.new_value ?? '(empty)'}</pre></div>
                    </div>
                  )}
                  {log.change_reason && <p className="text-xs text-muted-foreground mt-1.5 italic">Reason: {log.change_reason}</p>}
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {log.changed_by && ` · by ${log.changer_name ?? log.changed_by}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Professional Tab (Education / Certifications / Previous Employers) ─────
function ProfessionalTab({ employee, canEdit }: { employee: DirectoryEmployee; canEdit: boolean }) {
  const [subTab, setSubTab] = useState<'education' | 'certifications' | 'employers'>('education');
  const [education, setEducation] = useState<EducationRecord[]>([]);
  const [certs, setCerts] = useState<CertificationRecord[]>([]);
  const [employers, setEmployers] = useState<PreviousEmployerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEduForm, setShowEduForm] = useState(false);
  const [showCertForm, setShowCertForm] = useState(false);
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [editingEdu, setEditingEdu] = useState<EducationRecord | null>(null);
  const [editingCert, setEditingCert] = useState<CertificationRecord | null>(null);
  const [editingEmp, setEditingEmp] = useState<PreviousEmployerRecord | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [eduRes, certRes, empRes] = await Promise.all([
        supabase.from('employee_education').select('*').eq('employee_id', employee.id).order('end_year', { ascending: false }),
        supabase.from('employee_certifications').select('*').eq('employee_id', employee.id).order('issue_date', { ascending: false }),
        supabase.from('employee_previous_employers').select('*').eq('employee_id', employee.id).order('end_date', { ascending: false }),
      ]);
      setEducation(eduRes.data ?? []);
      setCerts(certRes.data ?? []);
      setEmployers(empRes.data ?? []);
      setLoading(false);
    })();
  }, [employee.id]);

  const saveEducation = async (rec: EducationRecord) => {
    if (rec.id) {
      const { id, ...rest } = rec;
      await supabase.from('employee_education').update(rest).eq('id', id);
      setEducation(e => e.map(x => x.id === id ? rec : x));
    } else {
      const { data } = await supabase.from('employee_education').insert([{ ...rec, employee_id: employee.id }]).select().single();
      if (data) setEducation(e => [data, ...e]);
    }
    setShowEduForm(false); setEditingEdu(null);
  };

  const saveCert = async (rec: CertificationRecord) => {
    if (rec.id) {
      const { id, ...rest } = rec;
      await supabase.from('employee_certifications').update(rest).eq('id', id);
      setCerts(e => e.map(x => x.id === id ? rec : x));
    } else {
      const { data } = await supabase.from('employee_certifications').insert([{ ...rec, employee_id: employee.id }]).select().single();
      if (data) setCerts(e => [data, ...e]);
    }
    setShowCertForm(false); setEditingCert(null);
  };

  const saveEmployer = async (rec: PreviousEmployerRecord) => {
    if (rec.id) {
      const { id, ...rest } = rec;
      await supabase.from('employee_previous_employers').update(rest).eq('id', id);
      setEmployers(e => e.map(x => x.id === id ? rec : x));
    } else {
      const { data } = await supabase.from('employee_previous_employers').insert([{ ...rec, employee_id: employee.id }]).select().single();
      if (data) setEmployers(e => [data, ...e]);
    }
    setShowEmpForm(false); setEditingEmp(null);
  };

  const deleteEducation = async (id: string) => {
    await supabase.from('employee_education').delete().eq('id', id);
    setEducation(e => e.filter(x => x.id !== id));
  };

  const deleteCert = async (id: string) => {
    await supabase.from('employee_certifications').delete().eq('id', id);
    setCerts(e => e.filter(x => x.id !== id));
  };

  const deleteEmployer = async (id: string) => {
    await supabase.from('employee_previous_employers').delete().eq('id', id);
    setEmployers(e => e.filter(x => x.id !== id));
  };

  const inp = "w-full text-sm border border-border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30";

  if (loading) return <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}</div>;

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 bg-muted/40 p-1 rounded-lg">
        {(['education', 'certifications', 'employers'] as const).map(s => (
          <button key={s} onClick={() => setSubTab(s)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${subTab === s ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {s === 'education' ? 'Education' : s === 'certifications' ? 'Certifications' : 'Work History'}
          </button>
        ))}
      </div>

      {/* Education */}
      {subTab === 'education' && (
        <div className="space-y-3">
          {canEdit && !showEduForm && (
            <button onClick={() => { setEditingEdu(null); setShowEduForm(true); }}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <Plus size={12} /> Add Education
            </button>
          )}
          {showEduForm && (
            <EduForm
              initial={editingEdu ?? { employee_id: employee.id, institution: '', degree: '', field_of_study: '', start_year: null, end_year: null, grade: '' }}
              onSave={saveEducation}
              onCancel={() => { setShowEduForm(false); setEditingEdu(null); }}
            />
          )}
          {education.length === 0 && !showEduForm && (
            <div className="text-center py-6 text-muted-foreground"><GraduationCap size={24} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No education records</p></div>
          )}
          {education.map(edu => (
            <div key={edu.id} className="p-3 bg-muted/30 border border-border rounded-lg">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{edu.degree}{edu.field_of_study ? ` in ${edu.field_of_study}` : ''}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{edu.institution}</p>
                  <p className="text-xs text-muted-foreground">{edu.start_year}–{edu.end_year ?? 'Present'}{edu.grade ? ` · ${edu.grade}` : ''}</p>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingEdu(edu); setShowEduForm(true); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition-colors"><Edit2 size={11} className="text-muted-foreground" /></button>
                    <button onClick={() => deleteEducation(edu.id!)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 transition-colors"><Trash2 size={11} className="text-red-400" /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Certifications */}
      {subTab === 'certifications' && (
        <div className="space-y-3">
          {canEdit && !showCertForm && (
            <button onClick={() => { setEditingCert(null); setShowCertForm(true); }}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <Plus size={12} /> Add Certification
            </button>
          )}
          {showCertForm && (
            <CertForm
              initial={editingCert ?? { employee_id: employee.id, certification_name: '', issuing_organization: '', issue_date: '', expiry_date: '', credential_url: '', certificate_file_url: '' }}
              onSave={saveCert}
              onCancel={() => { setShowCertForm(false); setEditingCert(null); }}
            />
          )}
          {certs.length === 0 && !showCertForm && (
            <div className="text-center py-6 text-muted-foreground"><Award size={24} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No certifications</p></div>
          )}
          {certs.map(cert => (
            <div key={cert.id} className="p-3 bg-muted/30 border border-border rounded-lg">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{cert.certification_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{cert.issuing_organization}</p>
                  <p className="text-xs text-muted-foreground">
                    Issued: {cert.issue_date ? new Date(cert.issue_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}
                    {cert.expiry_date ? ` · Expires: ${new Date(cert.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : ''}
                  </p>
                  {cert.credential_url && (
                    <a href={cert.credential_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-0.5 mt-0.5">
                      <ExternalLink size={10} /> Verify
                    </a>
                  )}
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingCert(cert); setShowCertForm(true); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition-colors"><Edit2 size={11} className="text-muted-foreground" /></button>
                    <button onClick={() => deleteCert(cert.id!)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 transition-colors"><Trash2 size={11} className="text-red-400" /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Previous Employers */}
      {subTab === 'employers' && (
        <div className="space-y-3">
          {canEdit && !showEmpForm && (
            <button onClick={() => { setEditingEmp(null); setShowEmpForm(true); }}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <Plus size={12} /> Add Work History
            </button>
          )}
          {showEmpForm && (
            <EmployerForm
              initial={editingEmp ?? { employee_id: employee.id, company_name: '', job_title: '', start_date: '', end_date: '', last_salary: '', reason_for_leaving: '' }}
              onSave={saveEmployer}
              onCancel={() => { setShowEmpForm(false); setEditingEmp(null); }}
            />
          )}
          {employers.length === 0 && !showEmpForm && (
            <div className="text-center py-6 text-muted-foreground"><Briefcase size={24} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No work history</p></div>
          )}
          {employers.map(emp => (
            <div key={emp.id} className="p-3 bg-muted/30 border border-border rounded-lg">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{emp.job_title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{emp.company_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {emp.start_date ? new Date(emp.start_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '?'}
                    {' — '}
                    {emp.end_date ? new Date(emp.end_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Present'}
                  </p>
                  {emp.reason_for_leaving && <p className="text-xs text-muted-foreground italic mt-0.5">Left: {emp.reason_for_leaving}</p>}
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingEmp(emp); setShowEmpForm(true); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition-colors"><Edit2 size={11} className="text-muted-foreground" /></button>
                    <button onClick={() => deleteEmployer(emp.id!)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 transition-colors"><Trash2 size={11} className="text-red-400" /></button>
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

function EduForm({ initial, onSave, onCancel }: { initial: EducationRecord; onSave: (r: EducationRecord) => void; onCancel: () => void }) {
  const [form, setForm] = useState<EducationRecord>(initial);
  const inp = "w-full text-sm border border-border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30";
  return (
    <div className="p-3 border border-primary/30 bg-primary/5 rounded-lg space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div><label className="block text-xs text-muted-foreground mb-1">Degree</label><input value={form.degree} onChange={e => setForm(f => ({ ...f, degree: e.target.value }))} className={inp} placeholder="B.Tech, MBA…" /></div>
        <div><label className="block text-xs text-muted-foreground mb-1">Field of Study</label><input value={form.field_of_study} onChange={e => setForm(f => ({ ...f, field_of_study: e.target.value }))} className={inp} /></div>
        <div className="col-span-2"><label className="block text-xs text-muted-foreground mb-1">Institution</label><input value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} className={inp} /></div>
        <div><label className="block text-xs text-muted-foreground mb-1">Start Year</label><input type="number" value={form.start_year ?? ''} onChange={e => setForm(f => ({ ...f, start_year: parseInt(e.target.value) || null }))} className={inp} /></div>
        <div><label className="block text-xs text-muted-foreground mb-1">End Year</label><input type="number" value={form.end_year ?? ''} onChange={e => setForm(f => ({ ...f, end_year: parseInt(e.target.value) || null }))} className={inp} /></div>
        <div><label className="block text-xs text-muted-foreground mb-1">Grade/CGPA</label><input value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} className={inp} /></div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
        <button onClick={() => onSave(form)} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">Save</button>
      </div>
    </div>
  );
}

function CertForm({ initial, onSave, onCancel }: { initial: CertificationRecord; onSave: (r: CertificationRecord) => void; onCancel: () => void }) {
  const [form, setForm] = useState<CertificationRecord>(initial);
  const inp = "w-full text-sm border border-border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30";
  return (
    <div className="p-3 border border-primary/30 bg-primary/5 rounded-lg space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2"><label className="block text-xs text-muted-foreground mb-1">Certification Name</label><input value={form.certification_name} onChange={e => setForm(f => ({ ...f, certification_name: e.target.value }))} className={inp} /></div>
        <div className="col-span-2"><label className="block text-xs text-muted-foreground mb-1">Issuing Organization</label><input value={form.issuing_organization} onChange={e => setForm(f => ({ ...f, issuing_organization: e.target.value }))} className={inp} /></div>
        <div><label className="block text-xs text-muted-foreground mb-1">Issue Date</label><input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} className={inp} /></div>
        <div><label className="block text-xs text-muted-foreground mb-1">Expiry Date</label><input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} className={inp} /></div>
        <div className="col-span-2"><label className="block text-xs text-muted-foreground mb-1">Credential URL</label><input value={form.credential_url} onChange={e => setForm(f => ({ ...f, credential_url: e.target.value }))} className={inp} placeholder="https://…" /></div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
        <button onClick={() => onSave(form)} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">Save</button>
      </div>
    </div>
  );
}

function EmployerForm({ initial, onSave, onCancel }: { initial: PreviousEmployerRecord; onSave: (r: PreviousEmployerRecord) => void; onCancel: () => void }) {
  const [form, setForm] = useState<PreviousEmployerRecord>(initial);
  const inp = "w-full text-sm border border-border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30";
  return (
    <div className="p-3 border border-primary/30 bg-primary/5 rounded-lg space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2"><label className="block text-xs text-muted-foreground mb-1">Company Name</label><input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} className={inp} /></div>
        <div className="col-span-2"><label className="block text-xs text-muted-foreground mb-1">Job Title</label><input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} className={inp} /></div>
        <div><label className="block text-xs text-muted-foreground mb-1">Start Date</label><input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={inp} /></div>
        <div><label className="block text-xs text-muted-foreground mb-1">End Date</label><input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className={inp} /></div>
        <div className="col-span-2"><label className="block text-xs text-muted-foreground mb-1">Reason for Leaving</label><input value={form.reason_for_leaving} onChange={e => setForm(f => ({ ...f, reason_for_leaving: e.target.value }))} className={inp} /></div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
        <button onClick={() => onSave(form)} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">Save</button>
      </div>
    </div>
  );
}

// ── Quick Contact Hover Card ───────────────────────────────────────────────
function QuickContactCard({
  employee, anchorRect, onClose,
}: {
  employee: DirectoryEmployee;
  anchorRect: DOMRect;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const emp = employee as any;

  // Position: try above, fall back to below
  const spaceAbove = anchorRect.top;
  const above = spaceAbove > 180;
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(anchorRect.left, window.innerWidth - 280),
    zIndex: 200,
    width: 270,
    ...(above
      ? { top: anchorRect.top - 180 }
      : { top: anchorRect.bottom + 6 }),
  };

  return createPortal(
    <div
      ref={cardRef}
      style={style}
      onMouseLeave={onClose}
      className="bg-card border border-border rounded-xl shadow-xl p-4 animate-in fade-in duration-150"
    >
      <div className="flex items-start gap-3">
        <Avatar name={employee.name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-foreground leading-tight">{employee.name}</p>
          <p className="text-xs text-muted-foreground">{employee.designation}</p>
          <p className="text-xs text-primary/80">{employee.department}</p>
        </div>
      </div>
      {employee.location && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
          <MapPin size={10} /><span>{employee.location}</span>
        </div>
      )}
      <div className="border-t border-border mt-3 pt-3 flex flex-wrap gap-2">
        <a href={`mailto:${employee.email}`} onClick={onClose}
          className="flex items-center gap-1 px-2 py-1.5 text-xs bg-muted rounded-lg hover:bg-primary/10 hover:text-primary transition-colors">
          <Mail size={12} /> Email
        </a>
        {employee.phone && (
          <a href={`tel:${employee.phone}`} onClick={onClose}
            className="flex items-center gap-1 px-2 py-1.5 text-xs bg-muted rounded-lg hover:bg-primary/10 hover:text-primary transition-colors">
            <Phone size={12} /> Call
          </a>
        )}
        {emp.linkedin_url && (
          <a href={emp.linkedin_url} target="_blank" rel="noreferrer" onClick={onClose}
            className="flex items-center gap-1 px-2 py-1.5 text-xs bg-muted rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors">
            <Linkedin size={12} /> LinkedIn
          </a>
        )}
        {emp.github_url && (
          <a href={emp.github_url} target="_blank" rel="noreferrer" onClick={onClose}
            className="flex items-center gap-1 px-2 py-1.5 text-xs bg-muted rounded-lg hover:bg-muted/80 transition-colors">
            <Github size={12} /> GitHub
          </a>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Employee Self-Edit Modal ───────────────────────────────────────────────
interface SelfEditForm {
  phone: string;
  personal_email: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  linkedin_url: string;
  bio: string;
}

function SelfEditModal({
  employee,
  onClose,
  onSaved,
}: {
  employee: DirectoryEmployee;
  onClose: () => void;
  onSaved: (updates: Partial<DirectoryEmployee>) => void;
}) {
  const emp = employee as any;
  const { currentUser } = useUser();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SelfEditForm>({
    phone: emp.phone ?? '',
    personal_email: emp.personal_email ?? '',
    address: emp.address ?? '',
    emergency_contact_name: emp.emergency_contact_name ?? emp.emergencyContact?.name ?? '',
    emergency_contact_phone: emp.emergency_contact_phone ?? emp.emergencyContact?.phone ?? '',
    emergency_contact_relationship: emp.emergency_contact_relationship ?? emp.emergencyContact?.relationship ?? '',
    linkedin_url: emp.linkedin_url ?? '',
    bio: emp.bio ?? emp.about ?? '',
  });

  const inp = "w-full text-sm border border-border rounded-lg px-3 py-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary/30";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates = {
        phone: form.phone,
        personal_email: form.personal_email,
        address: form.address,
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_phone: form.emergency_contact_phone,
        emergency_contact_relationship: form.emergency_contact_relationship,
        linkedin_url: form.linkedin_url,
        bio: form.bio,
      };
      const { error } = await supabase
        .from('employees')
        .update(updates)
        .eq('id', employee.id);
      if (error) throw new Error(error.message);
      void supabase.from('audit_logs').insert([{
        action: 'employee_self_update',
        entity_type: 'employee',
        entity_id: employee.id,
        performed_by: currentUser?.id,
        changes: JSON.stringify({ fields: Object.keys(updates) }),
      }]);
      toast.success(t('directory.profileUpdated'));
      onSaved(updates as Partial<DirectoryEmployee>);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="font-semibold text-foreground text-sm">{t('directory.selfEditTitle')}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t('directory.selfEditSubtitle')}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <F label="Phone">
            <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inp} placeholder="+91 98765 43210" />
          </F>
          <F label={t('directory.personalEmail')}>
            <input type="email" value={form.personal_email} onChange={e => setForm(f => ({ ...f, personal_email: e.target.value }))} className={inp} placeholder="personal@example.com" />
          </F>
          <F label={t('directory.address')}>
            <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={`${inp} resize-none`} rows={2} placeholder="Your home address" />
          </F>

          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Shield size={11} /> Emergency Contact
            </p>
            <div className="space-y-3">
              <F label={t('directory.emergencyContactName')}>
                <input value={form.emergency_contact_name} onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} className={inp} placeholder="Full name" />
              </F>
              <F label={t('directory.emergencyContactPhone')}>
                <input type="tel" value={form.emergency_contact_phone} onChange={e => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))} className={inp} placeholder="+91 98765 43210" />
              </F>
              <F label={t('directory.emergencyContactRelationship')}>
                <input value={form.emergency_contact_relationship} onChange={e => setForm(f => ({ ...f, emergency_contact_relationship: e.target.value }))} className={inp} placeholder="e.g. Spouse, Parent" />
              </F>
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <ExternalLink size={11} /> Online Profiles
            </p>
            <F label={t('directory.linkedinUrl')}>
              <input type="url" value={form.linkedin_url} onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))} className={inp} placeholder="https://linkedin.com/in/yourprofile" />
            </F>
          </div>

          <F label={t('directory.bio')}>
            <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} className={`${inp} resize-none`} rows={3} placeholder="A short bio about yourself..." />
          </F>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {t('directory.selfEditSave')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Employee Detail Drawer ─────────────────────────────────────────────────
type DetailTab = 'profile' | 'professional' | 'documents' | 'emergency' | 'audit';

function LabelValue({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || '—'}</p>
    </div>
  );
}

function EmployeeDetailDrawer({
  employee, canEdit, canViewEmergencyContact, canViewAudit, onEdit, onClose, onUpdateEmployee, onUpdateEmergencyContact,
}: {
  employee: DirectoryEmployee;
  canEdit: boolean;
  canViewEmergencyContact: boolean;
  canViewAudit: boolean;
  onEdit: () => void;
  onClose: () => void;
  onUpdateEmployee: (id: string, data: Partial<DirectoryEmployee>) => Promise<void>;
  onUpdateEmergencyContact: (id: string, ec: EmergencyContact) => Promise<void>;
}) {
  const [tab, setTab] = useState<DetailTab>('profile');
  const [isSelfEditing, setIsSelfEditing] = useState(false);
  const emp = employee as any;
  const { currentUser } = useUser();
  const role = (currentUser as any)?.role as string | undefined;

  const canSelfEdit = !!(currentUser && (
    currentUser.employeeId === employee.id ||
    currentUser.email === employee.email
  ));
  const canHREdit = canEdit;

  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'professional', label: 'Professional' },
    { key: 'documents', label: 'Documents' },
    { key: 'emergency', label: 'Emergency' },
    ...(canViewAudit ? [{ key: 'audit' as DetailTab, label: 'Audit Trail' }] : []),
  ];

  return (
    <div className="fixed inset-0 z-[300] flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border-l border-border w-full max-w-lg h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <h3 className="font-semibold text-foreground text-sm">Employee Profile</h3>
          <div className="flex items-center gap-1">
            {canSelfEdit && !canHREdit && (
              <button onClick={() => setIsSelfEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors">
                <Edit2 size={12} /> {t('directory.editMyProfile')}
              </button>
            )}
            {canHREdit && (
              <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors">
                <Edit2 size={12} /> Edit
              </button>
            )}
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors ml-1"><X size={16} /></button>
          </div>
        </div>

        {/* Profile hero */}
        <div className="px-5 py-6 border-b border-border">
          <div className="flex items-start gap-4">
            <Avatar name={employee.name} size="xl" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-foreground text-base leading-tight">{employee.name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{employee.designation}</p>
              <p className="text-xs text-primary mt-0.5">{employee.department}</p>
              {emp.employee_code && (
                <p className="text-xs font-mono bg-muted/60 text-muted-foreground px-2 py-0.5 rounded mt-1 inline-block">{emp.employee_code}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <StatusBadge status={employee.status} />
                {employee.lifecycleStatus && <LifecycleBadge status={employee.lifecycleStatus} />}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border overflow-x-auto scrollbar-hide">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-shrink-0 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 whitespace-nowrap ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-5 py-4">
          {tab === 'profile' && (
            <div className="space-y-4">
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Contact Information</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail size={13} className="text-muted-foreground flex-shrink-0" />
                    <a href={`mailto:${employee.email}`} className="text-primary hover:underline truncate">{employee.email}</a>
                  </div>
                  {employee.phone && (
                    <div className="flex items-center gap-2 text-sm"><Phone size={13} className="text-muted-foreground flex-shrink-0" /><span className="text-foreground">{employee.phone}</span></div>
                  )}
                  {emp.personal_email && (
                    <div className="flex items-center gap-2 text-sm"><Mail size={13} className="text-muted-foreground flex-shrink-0" /><span className="text-foreground text-xs">{emp.personal_email} <span className="text-muted-foreground">(personal)</span></span></div>
                  )}
                  <div className="flex items-center gap-2 text-sm"><MapPin size={13} className="text-muted-foreground flex-shrink-0" /><span className="text-foreground">{employee.location}</span></div>
                  {emp.linkedin_url && (
                    <div className="flex items-center gap-2 text-sm">
                      <Linkedin size={13} className="text-muted-foreground flex-shrink-0" />
                      <a href={emp.linkedin_url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs truncate">{emp.linkedin_url}</a>
                    </div>
                  )}
                  {emp.github_url && (
                    <div className="flex items-center gap-2 text-sm">
                      <Github size={13} className="text-muted-foreground flex-shrink-0" />
                      <a href={emp.github_url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs truncate">{emp.github_url}</a>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Employment Details</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm"><Building2 size={13} className="text-muted-foreground flex-shrink-0" /><span className="text-foreground">{employee.department}</span></div>
                  {employee.manager_name && (
                    <div className="flex items-center gap-2 text-sm"><Users size={13} className="text-muted-foreground flex-shrink-0" /><span className="text-foreground">Reports to: {employee.manager_name}</span></div>
                  )}
                  {employee.join_date && (
                    <div className="flex items-center gap-2 text-sm"><Calendar size={13} className="text-muted-foreground flex-shrink-0" /><span className="text-foreground">Joined {new Date(employee.join_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                  )}
                  {emp.employment_type && (
                    <div className="flex items-center gap-2 text-sm"><Briefcase size={13} className="text-muted-foreground flex-shrink-0" /><span className="text-foreground">{emp.employment_type}</span></div>
                  )}
                  {emp.blood_group && (
                    <div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground text-xs font-medium w-[13px]">BG</span><span className="text-foreground">Blood Group: {emp.blood_group}</span></div>
                  )}
                  {emp.date_of_birth && (
                    <div className="flex items-center gap-2 text-sm"><Calendar size={13} className="text-muted-foreground flex-shrink-0" /><span className="text-foreground">DOB: {new Date(emp.date_of_birth).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                  )}
                </div>
              </section>

              {(employee.skills ?? []).length > 0 && (
                <section>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {employee.skills.map(s => <span key={s} className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">{s}</span>)}
                  </div>
                </section>
              )}

              {(role === 'hr_admin' || role === 'hr_manager') ? (
                <div className="border border-red-200 rounded-lg p-4 mt-4 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">{t('directory.hrConfidential')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <LabelValue label={t('directory.probationEndDate')} value={emp.probation_end_date} />
                    <LabelValue label={t('directory.confirmationDate')} value={emp.confirmation_date} />
                    <LabelValue label="Notice Period" value={emp.notice_period_days != null ? `${emp.notice_period_days} days` : null} />
                    <LabelValue label="PF Number" value={emp.pf_number || '—'} />
                    <LabelValue label="PAN Number" value={emp.pan_number || '—'} />
                    <LabelValue label="Bank Account" value={emp.bank_account_number ? '•••• ' + String(emp.bank_account_number).slice(-4) : '—'} />
                  </div>
                  <p className="text-xs text-red-500 mt-3 italic">{t('directory.hrConfidentialNote')}</p>
                </div>
              ) : (
                <div className="border border-border rounded-lg p-4 mt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('directory.hrConfidential')}</span>
                  </div>
                  <p className="text-sm text-gray-400 italic">{t('directory.hrRestrictedPlaceholder')}</p>
                </div>
              )}

              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">System</p>
                <p className="text-xs text-muted-foreground font-mono bg-muted/40 px-2 py-1 rounded">{employee.id}</p>
              </section>
            </div>
          )}

          {tab === 'professional' && (
            <ProfessionalTab employee={employee} canEdit={canEdit} />
          )}

          {tab === 'documents' && (
            <DocumentVaultTab employee={employee} canEdit={canEdit} />
          )}

          {tab === 'emergency' && (
            <EmergencyContactTab
              employee={employee}
              canEdit={canEdit}
              canView={canViewEmergencyContact}
              onSave={ec => onUpdateEmergencyContact(employee.id, ec)}
            />
          )}

          {tab === 'audit' && canViewAudit && (
            <AuditTrailTab employee={employee} />
          )}
        </div>
      </div>

      {isSelfEditing && (
        <SelfEditModal
          employee={employee}
          onClose={() => setIsSelfEditing(false)}
          onSaved={updates => {
            onUpdateEmployee(employee.id, updates);
          }}
        />
      )}
    </div>
  );
}

// ── Org Chart Node ─────────────────────────────────────────────────────────
function OrgChartNode({ node, depth = 0, isMobile }: { node: OrgNode; depth?: number; isMobile?: boolean }) {
  const [collapsed, setCollapsed] = useState(depth > 1);

  if (isMobile) {
    return (
      <div className={`${depth > 0 ? 'ml-5 border-l-2 border-border pl-4' : ''}`}>
        <div className="flex items-center gap-2 py-2">
          <Avatar name={node.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground leading-tight">{node.name}</p>
            <p className="text-xs text-muted-foreground">{node.designation} · {node.department}</p>
          </div>
          {node.reports.length > 0 && (
            <button onClick={() => setCollapsed(c => !c)} className="w-6 h-6 flex items-center justify-center rounded-md bg-muted hover:bg-muted/80 transition-colors flex-shrink-0">
              {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
        {!collapsed && node.reports.map(child => <OrgChartNode key={child.id} node={child} depth={depth + 1} isMobile />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex flex-col items-center">
        {depth > 0 && <div className="w-px h-6 bg-border" />}
        <div className="bg-card border border-border rounded-xl px-4 py-3 text-center min-w-[140px] max-w-[180px] shadow-sm hover:shadow-md hover:border-primary/40 transition-all">
          <div className="flex justify-center"><Avatar name={node.name} size="md" /></div>
          <p className="mt-2 text-xs font-semibold text-foreground leading-tight">{node.name}</p>
          <p className="text-xs text-muted-foreground truncate">{node.designation}</p>
          <p className="text-xs text-primary/70 truncate">{node.department}</p>
          {node.reports.length > 0 && (
            <button onClick={() => setCollapsed(c => !c)} className="mt-1.5 text-xs text-primary font-medium flex items-center gap-0.5 mx-auto hover:underline">
              {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
              {collapsed ? `${node.reports.length} report${node.reports.length > 1 ? 's' : ''}` : 'collapse'}
            </button>
          )}
        </div>
      </div>
      {!collapsed && node.reports.length > 0 && (
        <div className="flex flex-col items-center">
          <div className="w-px h-4 bg-border" />
          <div className="relative flex gap-4 items-start">
            {node.reports.length > 1 && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-border" style={{ width: `calc(100% - 90px)` }} />
            )}
            {node.reports.map(child => <OrgChartNode key={child.id} node={child} depth={depth + 1} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Employee Card ──────────────────────────────────────────────────────────
function EmployeeCard({
  emp, canEdit, onView, onEdit, onDelete, onHoverStart, onHoverEnd,
  isOnLeave, isWFH,
}: {
  emp: DirectoryEmployee;
  canEdit: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onHoverStart: (e: React.MouseEvent, emp: DirectoryEmployee) => void;
  onHoverEnd: () => void;
  isOnLeave?: boolean;
  isWFH?: boolean;
}) {
  const today = new Date();
  const dob = (emp as any).date_of_birth;
  const joinDate = emp.join_date;
  const isBirthday = dob && new Date(dob).getDate() === today.getDate() && new Date(dob).getMonth() === today.getMonth();
  const isAnniversary = joinDate && new Date(joinDate).getDate() === today.getDate() && new Date(joinDate).getMonth() === today.getMonth();
  const anniversaryYears = joinDate ? today.getFullYear() - new Date(joinDate).getFullYear() : 0;

  return (
    <div
      className="bg-card border border-border rounded-xl p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group relative"
      onClick={onView}
      onMouseEnter={e => onHoverStart(e, emp)}
      onMouseLeave={onHoverEnd}
    >
      {canEdit && (
        <div className="absolute top-3 right-3 flex gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-border hover:bg-muted transition-colors shadow-sm"><Edit2 size={12} className="text-muted-foreground" /></button>
          <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded-lg bg-card border border-border hover:bg-red-50 transition-colors shadow-sm"><Trash2 size={12} className="text-red-400" /></button>
        </div>
      )}
      <div className="flex flex-col items-center text-center gap-2">
        <Avatar name={emp.name} size="lg" />
        <div>
          <p className="font-semibold text-foreground text-sm leading-tight">{emp.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{emp.designation}</p>
          <div className="flex items-center justify-center gap-1 mt-0.5 text-xs text-primary/80"><Building2 size={10} /><span>{emp.department}</span></div>
        </div>
        <div className="flex flex-wrap justify-center gap-1 mt-1">
          <StatusBadge status={emp.status} />
          {emp.lifecycleStatus && <LifecycleBadge status={emp.lifecycleStatus} />}
          {isOnLeave && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">🌴 {t('directory.onLeave')}</span>}
          {isWFH && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">🏠 {t('directory.wfhToday')}</span>}
          {isBirthday && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-pink-100 text-pink-600">🎂</span>}
          {isAnniversary && anniversaryYears > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-purple-100 text-purple-600">🎉 {anniversaryYears} yrs</span>}
        </div>
        <div className="w-full pt-2 border-t border-border mt-1 space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 justify-center truncate"><Mail size={10} className="flex-shrink-0" /><span className="truncate">{emp.email}</span></div>
          {emp.location && <div className="flex items-center gap-1.5 justify-center"><MapPin size={10} className="flex-shrink-0" /><span>{emp.location}</span></div>}
        </div>
      </div>
    </div>
  );
}

// ── Skill Matrix View ──────────────────────────────────────────────────────
function SkillMatrixView({
  employees, onViewEmployee,
}: {
  employees: DirectoryEmployee[];
  onViewEmployee: (emp: DirectoryEmployee) => void;
}) {
  const [filterDept, setFilterDept] = useState('');
  const [highlightSkill, setHighlightSkill] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ emp: string; skill: string; x: number; y: number } | null>(null);

  const filtered = filterDept ? employees.filter(e => e.department === filterDept) : employees;
  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort();

  // Collect all unique skills
  const allSkills = Array.from(new Set(
    filtered.flatMap(e => {
      const s = e.skills;
      if (!s) return [];
      if (Array.isArray(s)) return s as string[];
      if (typeof s === 'object') return Object.keys(s as Record<string, unknown>);
      return [];
    })
  )).sort();

  const getLevel = (emp: DirectoryEmployee, skill: string): string | null => {
    const s = emp.skills as any;
    if (!s) return null;
    if (Array.isArray(s)) return s.includes(skill) ? 'has' : null;
    if (typeof s === 'object' && s !== null) return s[skill] ?? null;
    return null;
  };

  const exportCSV = () => {
    const headers = ['Employee', 'Department', ...allSkills];
    const rows = filtered.map(emp => [
      emp.name, emp.department ?? '',
      ...allSkills.map(sk => getLevel(emp, sk) ? '1' : '0'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `skill_matrix_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none">
            <option value="">All Departments</option>
            {departments.map(d => <option key={d}>{d}</option>)}
          </select>
          {filterDept && (
            <button onClick={() => setFilterDept('')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><X size={11} /> Clear</button>
          )}
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors">
          <Download size={13} /> Export CSV
        </button>
      </div>

      {allSkills.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Grid3X3 size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No skills data found for filtered employees.</p>
          <p className="text-xs mt-1">Add skills to employee profiles to see the matrix.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-auto max-h-[60vh]">
            <table className="text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                <tr>
                  <th className="sticky left-0 bg-muted/90 px-3 py-2 text-left font-semibold text-muted-foreground border-b border-r border-border min-w-[160px]">
                    Employee
                  </th>
                  {allSkills.map(sk => (
                    <th key={sk}
                      className={`px-2 py-2 text-center border-b border-border cursor-pointer transition-colors ${highlightSkill === sk ? 'bg-primary/20 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
                      style={{ minWidth: 60, maxWidth: 80 }}
                      onClick={() => setHighlightSkill(h => h === sk ? null : sk)}
                      title={`Click to highlight ${sk}`}
                    >
                      <div className="transform -rotate-45 origin-bottom-left translate-y-3 translate-x-2 whitespace-nowrap overflow-hidden text-ellipsis" style={{ maxWidth: 70 }}>
                        {sk}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(emp => (
                  <tr key={emp.id} className="hover:bg-muted/20 transition-colors">
                    <td className="sticky left-0 bg-card px-3 py-2 border-r border-border">
                      <button onClick={() => onViewEmployee(emp)} className="flex items-center gap-2 text-left hover:text-primary transition-colors">
                        <Avatar name={emp.name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate max-w-[110px]">{emp.name}</p>
                          <p className="text-muted-foreground truncate max-w-[110px]">{emp.designation}</p>
                        </div>
                      </button>
                    </td>
                    {allSkills.map(sk => {
                      const level = getLevel(emp, sk);
                      const hasSkill = !!level;
                      return (
                        <td key={sk}
                          className={`px-2 py-2 text-center transition-colors ${highlightSkill === sk ? (hasSkill ? 'bg-primary/10' : 'bg-muted/30') : ''}`}
                          onMouseEnter={e => hasSkill && setTooltip({ emp: emp.name, skill: sk, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          {hasSkill ? (
                            level === 'has' ? (
                              <div className="w-3 h-3 rounded-full bg-primary mx-auto" />
                            ) : (
                              <span className={`inline-flex px-1.5 py-0.5 rounded-full text-xs font-medium ${PROFICIENCY_COLORS[level] ?? 'bg-primary/20 text-primary'}`}>
                                {(level as string).slice(0, 3)}
                              </span>
                            )
                          ) : (
                            <div className="w-3 h-3 rounded-full border border-border mx-auto opacity-40" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Identify skill gaps across teams. Use for hiring planning and L&D prioritisation.
      </p>

      {/* Tooltip */}
      {tooltip && createPortal(
        <div className="fixed z-[400] bg-foreground text-background text-xs px-2 py-1 rounded shadow-lg pointer-events-none"
          style={{ top: tooltip.y - 30, left: tooltip.x + 8 }}>
          {tooltip.emp} — {tooltip.skill}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Column Picker ──────────────────────────────────────────────────────────
function ColumnPicker({
  userId, visible, onChange, onClose,
}: {
  userId: string;
  visible: Set<string>;
  onChange: (cols: Set<string>) => void;
  onClose: () => void;
}) {
  const toggle = (key: string) => {
    const next = new Set(visible);
    next.has(key) ? next.delete(key) : next.add(key);
    onChange(next);
    localStorage.setItem(`directory_columns_${userId}`, JSON.stringify(Array.from(next)));
  };

  return (
    <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl p-3 w-56">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Columns</p>
        <button onClick={onClose} className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted transition-colors"><X size={12} /></button>
      </div>
      <div className="space-y-1">
        {ALL_COLUMNS.map(col => (
          <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1 transition-colors">
            <input type="checkbox" checked={visible.has(col.key)} onChange={() => toggle(col.key)}
              className="w-3 h-3 accent-primary" />
            <span className="text-xs text-foreground">{col.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Bulk Upload ────────────────────────────────────────────────────────────
const EMP_TEMPLATE_HEADERS = [
  'Name', 'Email', 'Phone', 'Department', 'Designation', 'Location',
  'Status', 'Lifecycle Status', 'Join Date', 'Date of Birth',
  'Manager Email', 'Skills', 'Emergency Contact Name',
  'Emergency Contact Relationship', 'Emergency Contact Phone',
];
const EMP_REQUIRED_COLS = ['Name', 'Email', 'Department', 'Designation'];
const VALID_STATUSES = ['Active', 'On Leave', 'Inactive', 'Remote'];
const VALID_LIFECYCLE = ['Active', 'On Notice', 'Resigned', 'On Leave'];

function parseEmpCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = ''; let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === ',' && !inQuote) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result.map(s => s.replace(/^"|"$/g, '').trim());
}

function parseEmpCSVText(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseEmpCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseEmpCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    return row;
  }).filter(r => Object.values(r).some(v => v.trim()));
}

interface EmpParsedRow { data: Record<string, string>; errors: string[] }

function validateEmpRow(row: Record<string, string>, index: number, seenEmails: Set<string>): EmpParsedRow {
  const errors: string[] = [];
  const rowNum = index + 2;
  EMP_REQUIRED_COLS.forEach(col => { if (!row[col]?.trim()) errors.push(`Row ${rowNum}: "${col}" is required`); });
  const email = row.Email?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(`Row ${rowNum}: Invalid email format`);
  if (email) {
    if (seenEmails.has(email.toLowerCase())) errors.push(`Row ${rowNum}: Duplicate email "${email}" in file`);
    else seenEmails.add(email.toLowerCase());
  }
  const status = row.Status?.trim();
  if (status && !VALID_STATUSES.includes(status)) errors.push(`Row ${rowNum}: Status must be one of: ${VALID_STATUSES.join(', ')}`);
  const ls = row['Lifecycle Status']?.trim();
  if (ls && !VALID_LIFECYCLE.includes(ls)) errors.push(`Row ${rowNum}: Lifecycle Status must be one of: ${VALID_LIFECYCLE.join(', ')}`);
  const joinDate = row['Join Date']?.trim();
  if (joinDate && !/^\d{4}-\d{2}-\d{2}$/.test(joinDate)) errors.push(`Row ${rowNum}: Join Date must be YYYY-MM-DD`);
  return { data: row, errors };
}

interface EmpBulkUploadResult { successCount: number; failureCount: number; failed: Array<{ row: number; name: string; error: string }> }

function EmpBulkUploadModal({ onClose, onUpload }: { onClose: () => void; onUpload: (rows: Record<string, string>[]) => Promise<EmpBulkUploadResult> }) {
  const [parsedRows, setParsedRows] = useState<EmpParsedRow[]>([]);
  const [fileError, setFileError] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<EmpBulkUploadResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const example = ['Jane Smith','jane.smith@company.com','+91-9876543210','Engineering','Senior Developer','Bangalore','Active','Active','2023-01-15','1990-05-20','manager@company.com','"React,TypeScript"','John Smith','Spouse','+91-9876543211'].join(',');
    const csv = EMP_TEMPLATE_HEADERS.join(',') + '\n' + example;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'employees_template.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    setFileError(''); setFileName(file.name); setParsedRows([]); setResult(null);
    try {
      let rows: Record<string, string>[];
      if (file.name.toLowerCase().endsWith('.csv')) {
        rows = parseEmpCSVText(await file.text());
      } else {
        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
      }
      const seenEmails = new Set<string>();
      setParsedRows(rows.map((r, i) => validateEmpRow(r, i, seenEmails)));
    } catch { setFileError('Could not parse the file. Make sure it is a valid CSV or Excel (.xlsx) file.'); }
  };

  const validRows = parsedRows.filter(r => r.errors.length === 0);
  const errorRows = parsedRows.filter(r => r.errors.length > 0);

  const handleImport = async () => {
    if (!validRows.length) return;
    setUploading(true);
    try {
      const res = await onUpload(validRows.map(r => r.data));
      setResult(res);
      if (res.successCount > 0) toast.success(`${res.successCount} employee${res.successCount !== 1 ? 's' : ''} imported`);
      if (res.failureCount > 0) toast.error(`${res.failureCount} row${res.failureCount !== 1 ? 's' : ''} failed`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-foreground">Bulk Upload Employees</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Upload Excel (.xlsx) or CSV. Download template first.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {result ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-lg p-4 text-center border border-green-100">
                  <p className="text-3xl font-bold text-green-700">{result.successCount}</p>
                  <p className="text-xs text-green-600 mt-1">Employees Imported</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center border border-red-100">
                  <p className="text-3xl font-bold text-red-700">{result.failureCount}</p>
                  <p className="text-xs text-red-600 mt-1">Rows Failed</p>
                </div>
              </div>
              <button onClick={() => { setResult(null); setParsedRows([]); setFileName(''); }}
                className="w-full py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Upload Another File</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Required: <span className="font-medium text-foreground">{EMP_REQUIRED_COLS.join(', ')}</span></p>
                <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors">
                  <Download size={12} /> Download Template
                </button>
              </div>
              <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 text-center cursor-pointer transition-colors group">
                <Upload size={28} className="mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
                {fileName ? <p className="text-sm font-medium text-foreground">{fileName}</p> : (
                  <><p className="text-sm font-medium text-foreground">Drop file here or click to browse</p><p className="text-xs text-muted-foreground mt-1">Supports .xlsx and .csv</p></>
                )}
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              </div>
              {fileError && <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2"><AlertCircle size={13} />{fileError}</div>}
              {parsedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-foreground">{parsedRows.length} rows parsed</p>
                    <div className="flex gap-3 text-xs">
                      <span className="text-green-600 font-medium">{validRows.length} valid</span>
                      {errorRows.length > 0 && <span className="text-red-600 font-medium">{errorRows.length} with errors</span>}
                    </div>
                  </div>
                  {errorRows.length > 0 && (
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {errorRows.flatMap(r => r.errors).map((err, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2.5 py-1.5">
                          <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />{err}
                        </div>
                      ))}
                    </div>
                  )}
                  {validRows.length > 0 && (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto max-h-48">
                        <table className="w-full text-xs">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              {['#', 'Name', 'Email', 'Department', 'Designation', 'Status'].map(h => (
                                <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {validRows.slice(0, 50).map((r, i) => (
                              <tr key={i} className="hover:bg-muted/50">
                                <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                                <td className="px-3 py-1.5 font-medium">{r.data.Name}</td>
                                <td className="px-3 py-1.5 text-muted-foreground">{r.data.Email}</td>
                                <td className="px-3 py-1.5 text-muted-foreground">{r.data.Department}</td>
                                <td className="px-3 py-1.5 text-muted-foreground">{r.data.Designation}</td>
                                <td className="px-3 py-1.5"><span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">{r.data.Status || 'Active'}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {!result && (
          <div className="flex items-center justify-between p-4 border-t border-border shrink-0 gap-3">
            <p className="text-xs text-muted-foreground">{validRows.length > 0 ? `${validRows.length} ready to import` : 'No valid rows'}</p>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleImport} disabled={!validRows.length || uploading}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                {uploading ? 'Importing…' : `Import ${validRows.length || ''} Employees`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CSV Export helper ──────────────────────────────────────────────────────
const SENSITIVE_CSV_FIELDS = ['pf_number', 'pan_number', 'bank_account_number', 'notice_period_days'] as const;

function exportEmployeesCSV(employees: DirectoryEmployee[], visibleCols: Set<string>, role?: string) {
  const canViewSensitive = role === 'hr_admin' || role === 'hr_manager' || role === 'super_admin';
  const fmt = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const colMap: Record<string, (e: DirectoryEmployee) => string> = {
    employee_code: e => (e as any).employee_code ?? '',
    name: e => e.name,
    department: e => e.department ?? '',
    designation: e => e.designation ?? '',
    manager: e => e.manager_name ?? '',
    email: e => e.email,
    phone: e => e.phone ?? '',
    location: e => e.location ?? '',
    status: e => e.status,
    join_date: e => fmt(e.join_date),
    ...(canViewSensitive ? {
      pf_number: e => (e as any).pf_number ?? '',
      pan_number: e => (e as any).pan_number ?? '',
      bank_account_number: e => (e as any).bank_account_number ?? '',
      notice_period_days: e => (e as any).notice_period_days != null ? String((e as any).notice_period_days) : '',
    } : {}),
  };
  const baseFields = ['employee_code', 'name', 'email', 'department', 'designation', 'location', 'join_date', 'status'];
  const sensitiveFields = canViewSensitive ? ['pf_number', 'pan_number', 'bank_account_number', 'notice_period_days'] : [];
  const exportKeys = new Set([...Array.from(visibleCols), ...sensitiveFields.filter(() => canViewSensitive)]);
  const cols = ALL_COLUMNS.filter(c => exportKeys.has(c.key));
  // Also add sensitive cols not in ALL_COLUMNS
  const extraSensitiveCols = canViewSensitive ? sensitiveFields.filter(f => !ALL_COLUMNS.find(c => c.key === f)).map(f => ({ key: f, label: f.replace(/_/g, ' ') })) : [];
  const allCols = [...cols, ...extraSensitiveCols];
  const headers = allCols.map(c => c.label);
  const rows = employees.map(e => allCols.map(c => `"${(colMap[c.key]?.(e) ?? '').replace(/"/g, '""')}"`));
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `employees_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Component ─────────────────────────────────────────────────────────
interface Props { accessToken: string; onLogout: () => void; }

export function EmployeeDirectoryEnhanced({ accessToken, onLogout }: Props) {
  const { currentUser } = useUser();
  const role = (currentUser as any)?.role as string | undefined;

  const canEdit          = useSectionPermission('directory', 'edit_profiles');
  const canCreate        = useSectionPermission('directory', 'create_employee');
  const canDelete        = useSectionPermission('directory', 'delete_employee');
  const canExport        = useSectionPermission('directory', 'export');
  const canBulkUpload    = useSectionPermission('directory', 'bulk_upload');
  const canViewEmergency = useSectionPermission('directory', 'emergency_contact');
  const canViewAudit     = useSectionPermission('directory', 'view_audit_trail') || canEdit;

  const dir = useDirectoryData();
  const { options: allDepartments } = useDepartmentOptions();
  const filterDepartments = Array.from(new Set([
    ...allDepartments.map(d => d.label),
    ...dir.departments,
  ])).sort();

  // Today's leave / WFH status
  const [onLeaveIds, setOnLeaveIds] = useState<Set<string>>(new Set());
  const [wfhIds, setWfhIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [leaveRes, wfhRes] = await Promise.all([
        supabase.from('leaves').select('employee_id').eq('status', 'approved').lte('from_date', today).gte('to_date', today),
        supabase.from('wfh_requests').select('employee_id').eq('status', 'approved').lte('start_date', today).gte('end_date', today),
      ]);
      setOnLeaveIds(new Set((leaveRes.data ?? []).map((r: any) => r.employee_id)));
      setWfhIds(new Set((wfhRes.data ?? []).map((r: any) => r.employee_id)));
    })();
  }, []);

  const [viewMode, setViewMode] = useState<'list' | 'card' | 'orgchart' | 'skillmatrix'>('list');
  const [showForm, setShowForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<DirectoryEmployee | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<DirectoryEmployee | null>(null);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);
  const [orgZoom, setOrgZoom] = useState(1);

  // Hover card state
  const [hoverEmployee, setHoverEmployee] = useState<DirectoryEmployee | null>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Column visibility
  const storedCols = currentUser?.id ? localStorage.getItem(`directory_columns_${currentUser.id}`) : null;
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    storedCols ? new Set(JSON.parse(storedCols)) : new Set(DEFAULT_COLUMNS)
  );

  const openDetail = (emp: DirectoryEmployee) => setSelectedEmployee(emp);
  const closeDetail = () => setSelectedEmployee(null);
  const handleEditFromDetail = () => {
    if (!selectedEmployee) return;
    setEditingEmployee(selectedEmployee);
    setShowForm(true);
    closeDetail();
  };

  const handleHoverStart = (e: React.MouseEvent, emp: DirectoryEmployee) => {
    hoverTimerRef.current && clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoverEmployee(emp);
      setHoverRect((e.currentTarget as HTMLElement).getBoundingClientRect());
    }, 400);
  };

  const handleHoverEnd = () => {
    hoverTimerRef.current && clearTimeout(hoverTimerRef.current);
    // Small delay to allow moving into the hover card itself
    hoverTimerRef.current = setTimeout(() => {
      setHoverEmployee(null);
      setHoverRect(null);
    }, 100);
  };

  // Write audit log helper
  const writeAuditLog = useCallback((employeeId: string, fieldName: string, oldValue: string, newValue: string) => {
    if (!currentUser?.id) return;
    void supabase.from('employee_audit_log').insert([{
      employee_id: employeeId,
      changed_by: currentUser.id,
      change_type: 'update',
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
    }]);
  }, [currentUser?.id]);

  // Enhanced update that writes audit log
  const updateEmployeeWithAudit = async (id: string, data: Partial<DirectoryEmployee>) => {
    const original = dir.employees.find(e => e.id === id);
    await dir.updateEmployee(id, data);
    if (original) {
      const fields = Object.keys(data) as (keyof DirectoryEmployee)[];
      fields.forEach(field => {
        const oldVal = String(original[field] ?? '');
        const newVal = String((data as any)[field] ?? '');
        if (oldVal !== newVal) {
          writeAuditLog(id, field, oldVal, newVal);
        }
      });
    }
  };

  if (dir.error && !dir.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle size={36} className="text-red-400 mx-auto mb-3" />
          <h2 className="font-semibold text-foreground mb-1">Failed to load directory</h2>
          <p className="text-sm text-muted-foreground mb-4">{dir.error}</p>
          <button onClick={dir.refresh} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-primary" />
            <h1 className="font-semibold text-foreground text-sm">{t('directory.title')}</h1>
            {!dir.loading && (
              <span className="text-xs text-muted-foreground">({dir.employees.length} employees)</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              {([
                { mode: 'list', icon: List, label: 'List view' },
                { mode: 'card', icon: LayoutGrid, label: 'Card view' },
                { mode: 'orgchart', icon: GitBranch, label: 'Org chart' },
                { mode: 'skillmatrix', icon: Grid3X3, label: 'Skill Matrix' },
              ] as const).map(({ mode, icon: Icon, label }) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === mode ? 'bg-card shadow-sm' : 'hover:bg-card/50'}`}
                  aria-label={label} title={label}>
                  <Icon size={14} />
                </button>
              ))}
            </div>

            {canExport && (
              <button
                onClick={() => exportEmployeesCSV(dir.filtered, visibleCols, role)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors"
              >
                <Download size={13} /> Export CSV
              </button>
            )}

            {/* Column Picker */}
            <div className="relative" ref={columnPickerRef}>
              <button
                onClick={() => setShowColumnPicker(s => !s)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors"
                title="Choose visible columns"
              >
                <Settings2 size={13} /> Columns
              </button>
              {showColumnPicker && (
                <ColumnPicker
                  userId={currentUser?.id ?? 'default'}
                  visible={visibleCols}
                  onChange={setVisibleCols}
                  onClose={() => setShowColumnPicker(false)}
                />
              )}
            </div>

            {canBulkUpload && (
              <button onClick={() => setShowBulkUpload(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors">
                <Upload size={13} /> Bulk Upload
              </button>
            )}
            {canCreate && (
              <button onClick={() => { setEditingEmployee(undefined); setShowForm(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                <Plus size={13} /> {t('directory.addEmployee')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Celebrations This Month */}
        {(() => {
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();
          const birthdays = dir.employees.filter(e => {
            if (!e.date_of_birth) return false;
            const d = new Date(e.date_of_birth);
            return d.getMonth() === currentMonth;
          }).map(e => {
            const d = new Date(e.date_of_birth!);
            return { name: e.name, type: 'birthday' as const, day: d.getDate(), label: `Birthday on ${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}` };
          });
          const anniversaries = dir.employees.filter(e => {
            if (!e.join_date) return false;
            const d = new Date(e.join_date);
            return d.getMonth() === currentMonth;
          }).map(e => {
            const d = new Date(e.join_date);
            const years = currentYear - d.getFullYear();
            if (years <= 0) return null;
            return { name: e.name, type: 'anniversary' as const, day: d.getDate(), label: `${years}-year work anniversary on ${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}` };
          }).filter(Boolean) as { name: string; type: 'anniversary'; day: number; label: string }[];
          const celebrations = [...birthdays, ...anniversaries].sort((a, b) => a.day - b.day);
          if (celebrations.length === 0 || dir.loading) return null;
          return (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-3">
                {now.toLocaleString('default', { month: 'long' })} Celebrations
              </p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {celebrations.map((c, i) => (
                  <div key={i} className="flex-shrink-0 flex items-center gap-2 bg-white/70 border border-purple-100 rounded-xl px-3 py-2 min-w-max">
                    <span className="text-lg">{c.type === 'birthday' ? '🎂' : '🎉'}</span>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: dir.employees.length, color: 'text-foreground' },
            { label: 'Active', value: dir.employees.filter(e => e.status === 'Active').length, color: 'text-green-600' },
            { label: 'On Leave', value: dir.employees.filter(e => e.status === 'On Leave').length, color: 'text-yellow-600' },
            { label: 'Departments', value: dir.departments.length, color: 'text-primary' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl px-4 py-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              {dir.loading ? <div className="h-6 w-10 bg-muted animate-pulse rounded mt-1" /> : <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>}
            </div>
          ))}
        </div>

        {/* Filters */}
        {(viewMode === 'list' || viewMode === 'card') && (
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={dir.search} onChange={e => dir.setSearch(e.target.value)}
                placeholder={t('directory.searchEmployees')}
                className="w-full pl-8 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <select value={dir.filterDept} onChange={e => dir.setFilterDept(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-1 focus:ring-primary/30">
              <option value="">All Departments</option>
              {filterDepartments.map(d => <option key={d}>{d}</option>)}
            </select>
            <select value={dir.filterStatus} onChange={e => dir.setFilterStatus(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-1 focus:ring-primary/30">
              <option value="">All Statuses</option>
              <SelectOptions entity="employee" field="status" fallback={['Active', 'Inactive', 'On Leave', 'Terminated']} />
            </select>
          </div>
        )}

        {/* ── List view ─────────────────────────────────────────────────────── */}
        {viewMode === 'list' && (
          <>
            {dir.loading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
            ) : dir.filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">{dir.search || dir.filterDept || dir.filterStatus ? 'No employees match your filters.' : 'No employees in the directory yet.'}</p>
                {canEdit && !dir.search && <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-primary hover:underline">Add the first employee</button>}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employee</th>
                        {visibleCols.has('employee_code') && <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Code</th>}
                        {visibleCols.has('department') && <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Department</th>}
                        {visibleCols.has('email') && <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Contact</th>}
                        {visibleCols.has('location') && <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Location</th>}
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                        {canEdit && <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {dir.filtered.map(emp => (
                        <tr key={emp.id}
                          className="hover:bg-muted/30 transition-colors group cursor-pointer"
                          onClick={() => openDetail(emp)}
                          onMouseEnter={e => handleHoverStart(e, emp)}
                          onMouseLeave={handleHoverEnd}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={emp.name} size="sm" />
                              <div>
                                <p className="font-medium text-foreground">{emp.name}</p>
                                <p className="text-xs text-muted-foreground">{emp.designation}</p>
                              </div>
                            </div>
                          </td>
                          {visibleCols.has('employee_code') && (
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <span className="text-xs font-mono text-muted-foreground">{(emp as any).employee_code ?? '—'}</span>
                            </td>
                          )}
                          {visibleCols.has('department') && (
                            <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                              <div className="flex items-center gap-1.5"><Building2 size={12} />{emp.department}</div>
                              {emp.manager_name && <p className="text-xs text-muted-foreground/70 mt-0.5">↳ {emp.manager_name}</p>}
                            </td>
                          )}
                          {visibleCols.has('email') && (
                            <td className="px-4 py-3 hidden md:table-cell">
                              <div className="text-xs text-muted-foreground space-y-0.5">
                                <div className="flex items-center gap-1"><Mail size={11} />{emp.email}</div>
                                {emp.phone && <div className="flex items-center gap-1"><Phone size={11} />{emp.phone}</div>}
                              </div>
                            </td>
                          )}
                          {visibleCols.has('location') && (
                            <td className="px-4 py-3 hidden lg:table-cell">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={11} />{emp.location}</div>
                              {emp.join_date && <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><Calendar size={11} />{new Date(emp.join_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</div>}
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              <StatusBadge status={emp.status} />
                              {emp.lifecycleStatus && <LifecycleBadge status={emp.lifecycleStatus} />}
                              {onLeaveIds.has(emp.id) && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">🌴 {t('directory.onLeave')}</span>}
                              {wfhIds.has(emp.id) && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">🏠 {t('directory.wfhToday')}</span>}
                              {(() => {
                                const today = new Date();
                                const dob = (emp as any).date_of_birth;
                                const jd = emp.join_date;
                                const isBday = dob && new Date(dob).getDate() === today.getDate() && new Date(dob).getMonth() === today.getMonth();
                                const isAnniv = jd && new Date(jd).getDate() === today.getDate() && new Date(jd).getMonth() === today.getMonth();
                                const yrs = jd ? today.getFullYear() - new Date(jd).getFullYear() : 0;
                                return (<>
                                  {isBday && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-pink-100 text-pink-600">🎂</span>}
                                  {isAnniv && yrs > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-purple-100 text-purple-600">🎉 {yrs} yrs</span>}
                                </>);
                              })()}
                            </div>
                          </td>
                          {canEdit && (
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <div className="flex justify-end gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingEmployee(emp); setShowForm(true); }}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
                                  <Edit2 size={13} className="text-muted-foreground" />
                                </button>
                                <button onClick={() => setDeletingId(emp.id)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors">
                                  <Trash2 size={13} className="text-red-400" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Card view ─────────────────────────────────────────────────────── */}
        {viewMode === 'card' && (
          <>
            {dir.loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-52 bg-muted animate-pulse rounded-xl" />)}
              </div>
            ) : dir.filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">{dir.search || dir.filterDept || dir.filterStatus ? 'No employees match your filters.' : 'No employees in the directory yet.'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {dir.filtered.map(emp => (
                  <EmployeeCard key={emp.id} emp={emp} canEdit={canEdit}
                    onView={() => openDetail(emp)}
                    onEdit={() => { setEditingEmployee(emp); setShowForm(true); }}
                    onDelete={() => setDeletingId(emp.id)}
                    onHoverStart={handleHoverStart}
                    onHoverEnd={handleHoverEnd}
                    isOnLeave={onLeaveIds.has(emp.id)}
                    isWFH={wfhIds.has(emp.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Org chart ─────────────────────────────────────────────────────── */}
        {viewMode === 'orgchart' && (
          <div className="bg-card border border-border rounded-xl p-6 relative">
            <p className="text-xs text-muted-foreground mb-6 text-center">Click the toggle on each node to expand or collapse reporting chains</p>
            {dir.loading ? (
              <InlineLoader />
            ) : dir.orgTree.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No hierarchy data. Assign managers to employees to build the org chart.
              </div>
            ) : (
              <>
                <div className="hidden sm:block overflow-x-auto">
                  <div style={{ transform: `scale(${orgZoom})`, transformOrigin: 'top center', transition: 'transform 0.15s ease' }}
                    className="flex flex-wrap gap-12 justify-center min-w-max">
                    {dir.orgTree.map(root => <OrgChartNode key={root.id} node={root} />)}
                  </div>
                </div>
                <div className="block sm:hidden space-y-1">
                  {dir.orgTree.map(root => <OrgChartNode key={root.id} node={root} isMobile />)}
                </div>
                {/* Zoom controls */}
                <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow p-1 hidden sm:flex">
                  <button onClick={() => setOrgZoom(z => Math.max(0.5, parseFloat((z - 0.1).toFixed(1))))} className="p-1.5 hover:bg-gray-100 rounded text-sm">−</button>
                  <span className="text-xs text-gray-600 w-10 text-center">{Math.round(orgZoom * 100)}%</span>
                  <button onClick={() => setOrgZoom(z => Math.min(2, parseFloat((z + 0.1).toFixed(1))))} className="p-1.5 hover:bg-gray-100 rounded text-sm">+</button>
                  <button onClick={() => setOrgZoom(1)} className="p-1.5 hover:bg-gray-100 rounded text-xs border-l ml-1">Fit</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Skill Matrix view ──────────────────────────────────────────────── */}
        {viewMode === 'skillmatrix' && (
          <SkillMatrixView employees={dir.employees} onViewEmployee={openDetail} />
        )}
      </div>

      {/* Quick Contact Hover Card */}
      {hoverEmployee && hoverRect && (
        <QuickContactCard
          employee={hoverEmployee}
          anchorRect={hoverRect}
          onClose={() => { setHoverEmployee(null); setHoverRect(null); }}
        />
      )}

      {/* Detail Drawer */}
      {selectedEmployee && createPortal(
        <EmployeeDetailDrawer
          employee={selectedEmployee}
          canEdit={canEdit}
          canViewEmergencyContact={canViewEmergency || selectedEmployee.email === currentUser?.email || selectedEmployee.id === currentUser?.id}
          canViewAudit={canViewAudit}
          onEdit={handleEditFromDetail}
          onClose={closeDetail}
          onUpdateEmployee={async (id, data) => {
            await updateEmployeeWithAudit(id, data);
            const updated = dir.employees.find(e => e.id === id);
            if (updated) setSelectedEmployee({ ...updated, ...data });
          }}
          onUpdateEmergencyContact={async (id, ec) => {
            await dir.updateEmergencyContact(id, ec);
            setSelectedEmployee(prev => prev ? { ...prev, emergencyContact: ec } : prev);
          }}
        />,
        document.body
      )}

      {/* Modals */}
      {showBulkUpload && createPortal(
        <EmpBulkUploadModal onClose={() => setShowBulkUpload(false)} onUpload={dir.bulkUploadEmployees} />,
        document.body
      )}
      {showForm && createPortal(
        <EmployeeForm
          initial={editingEmployee}
          managers={dir.employees}
          onSubmit={editingEmployee
            ? async (data) => {
                await updateEmployeeWithAudit(editingEmployee.id, data);
              }
            : dir.createEmployee}
          onClose={() => { setShowForm(false); setEditingEmployee(undefined); }}
        />,
        document.body
      )}
      {deletingId && createPortal(
        <ConfirmDialog
          message="Remove this employee from the directory? This will soft-delete the record."
          onConfirm={async () => { await dir.deleteEmployee(deletingId); setDeletingId(null); }}
          onCancel={() => setDeletingId(null)}
        />,
        document.body
      )}
    </div>
  );
}

export default EmployeeDirectoryEnhanced;
