/**
 * Master Data Management
 * Shows only entities that have real backend endpoints.
 * Value Helps panel uses a 3-level hierarchy: Entity → Field → Values.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Building2, MapPin, Briefcase, Users, FileText,
  GraduationCap, DollarSign, Plus, Pencil, Trash2,
  Download, Loader2, RefreshCw, X, Search,
  CheckCircle2, XCircle, Sliders, Monitor,
  BookOpen, Workflow, Tag, CreditCard, Calendar,
  ChevronDown, ChevronRight, Settings2, Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '../../context/UserContext';
import { useMasterDataDirect } from '../../hooks/useSharedData';
import { AppLayout } from './AppLayout';
import { API_BASE, publicAnonKey, safeJson } from '../../utils/constants';
import { t } from '../../../i18n/index';

const MASTER_URL = `${API_BASE}/master-data`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface EntityDef {
  id: string;
  name: string;
  endpoint: string;
  icon: React.ElementType;
  category: string;
  /** Override display name column (defaults to 'name') */
  primaryKey?: string;
  /** Seed data for local-state-only entities (no backend required) */
  localSeed?: Record<string, unknown>[];
  /** Render a special UI instead of the generic table panel */
  specialPanel?: 'story-point-scale' | 'sprint-duration';
}

interface CategoryDef {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

// ── Categories ────────────────────────────────────────────────────────────────

const CATEGORIES: CategoryDef[] = [
  { id: 'hr',          label: 'masterData.catHR',        icon: Users,      color: 'text-blue-600'   },
  { id: 'finance',     label: 'masterData.catFinance',   icon: DollarSign, color: 'text-green-600'  },
  { id: 'content',     label: 'masterData.catContent',   icon: BookOpen,   color: 'text-rose-600'   },
  { id: 'workflows',   label: 'masterData.catWorkflows', icon: Workflow,   color: 'text-indigo-600' },
  { id: 'it-services', label: 'IT Services',             icon: Monitor,    color: 'text-orange-600' },
  { id: 'asset-mgmt',  label: 'Asset Management',        icon: Tag,        color: 'text-amber-600'  },
  { id: 'project-mgmt',label: 'Project Management',      icon: Settings2,  color: 'text-violet-600' },
];

// ── Entities (only those with real backend tables/endpoints) ──────────────────

const ENTITIES: EntityDef[] = [
  // HR & People
  { id: 'departments',      name: 'Departments',      endpoint: 'departments',      icon: Building2,     category: 'hr'        },
  { id: 'locations',        name: 'Locations',        endpoint: 'locations',        icon: MapPin,        category: 'hr'        },
  { id: 'job-titles',       name: 'Job Titles',       endpoint: 'job-titles',       icon: Briefcase,     category: 'hr'        },
  { id: 'employment-types', name: 'Employment Types', endpoint: 'employment-types', icon: FileText,      category: 'hr'        },
  { id: 'skills',           name: 'Skills',           endpoint: 'skills',           icon: GraduationCap, category: 'hr'        },
  { id: 'leave-policies',   name: 'Leave Policies',   endpoint: 'leave-policies',   icon: Calendar,      category: 'hr',       primaryKey: 'leave_type' },
  { id: 'holidays',         name: 'Holidays',         endpoint: 'holidays',         icon: Calendar,      category: 'hr'        },
  // Finance
  { id: 'currencies',       name: 'Currencies',       endpoint: 'currencies',       icon: CreditCard,    category: 'finance',  primaryKey: 'code' },
  { id: 'clients',          name: 'Clients',          endpoint: 'clients',          icon: Users,         category: 'finance'   },
  // Content
  { id: 'training-courses', name: 'Training Courses', endpoint: 'training-courses', icon: BookOpen,      category: 'content',  primaryKey: 'title' },
  { id: 'email-templates',  name: 'Email Templates',  endpoint: 'email-templates',  icon: Mail,          category: 'content'   },
  // Workflows
  { id: 'workflow-templates', name: 'Workflow Templates', endpoint: 'workflow-templates', icon: Workflow, category: 'workflows' },

  // ── IT Services ──────────────────────────────────────────────────────────────
  { id: 'ticket-categories', name: 'Ticket Categories', endpoint: 'it/ticket-categories', icon: Tag, category: 'it-services',
    localSeed: [
      { id: '1', name: 'Hardware',             description: 'Hardware-related issues',               defaultSla: 'P3-Medium',  sortOrder: 1, isActive: true },
      { id: '2', name: 'Software / App',        description: 'Software and application issues',       defaultSla: 'P3-Medium',  sortOrder: 2, isActive: true },
      { id: '3', name: 'Network / VPN',         description: 'Connectivity and VPN problems',         defaultSla: 'P2-High',    sortOrder: 3, isActive: true },
      { id: '4', name: 'Access & Permissions',  description: 'Account access and permission requests', defaultSla: 'P3-Medium', sortOrder: 4, isActive: true },
      { id: '5', name: 'Email & Calendar',      description: 'Email and calendar issues',             defaultSla: 'P3-Medium',  sortOrder: 5, isActive: true },
      { id: '6', name: 'Security',              description: 'Security incidents and concerns',       defaultSla: 'P1-Critical', sortOrder: 6, isActive: true },
      { id: '7', name: 'General / Other',       description: 'Miscellaneous IT requests',             defaultSla: 'P4-Low',     sortOrder: 7, isActive: true },
    ],
  },
  { id: 'sla-policies', name: 'SLA Policies', endpoint: 'it/sla-policies', icon: FileText, category: 'it-services',
    localSeed: [
      { id: '1', name: 'P1-Critical', priority: 'P1', firstResponseHrs: 4,  resolutionHrs: 8,  businessHours: '24x7',           isActive: true },
      { id: '2', name: 'P2-High',     priority: 'P2', firstResponseHrs: 8,  resolutionHrs: 24, businessHours: 'Business Hours', isActive: true },
      { id: '3', name: 'P3-Medium',   priority: 'P3', firstResponseHrs: 16, resolutionHrs: 48, businessHours: 'Business Hours', isActive: true },
      { id: '4', name: 'P4-Low',      priority: 'P4', firstResponseHrs: 24, resolutionHrs: 72, businessHours: 'Business Hours', isActive: true },
    ],
  },
  { id: 'resolution-codes', name: 'Resolution Codes', endpoint: 'it/resolution-codes', icon: CheckCircle2, category: 'it-services',
    localSeed: [
      { id: '1', name: 'Fixed',              isActive: true },
      { id: '2', name: 'Workaround',         isActive: true },
      { id: '3', name: 'Duplicate',          isActive: true },
      { id: '4', name: 'Cannot Reproduce',   isActive: true },
      { id: '5', name: 'User Error',         isActive: true },
      { id: '6', name: 'No Action Required', isActive: true },
      { id: '7', name: 'Known Issue',        isActive: true },
    ],
  },
  { id: 'ticket-impact', name: 'Ticket Impact Levels', endpoint: 'it/ticket-impact', icon: Users, category: 'it-services',
    localSeed: [
      { id: '1', name: 'Individual' },
      { id: '2', name: 'Team' },
      { id: '3', name: 'Department' },
      { id: '4', name: 'Organization' },
    ],
  },

  // ── Asset Management ─────────────────────────────────────────────────────────
  { id: 'asset-categories', name: 'Asset Categories', endpoint: 'assets/categories', icon: Tag, category: 'asset-mgmt',
    localSeed: [
      { id: '1', name: 'Laptop',            depreciationYears: 3, warrantyMonths: 12, isActive: true },
      { id: '2', name: 'Desktop',           depreciationYears: 4, warrantyMonths: 12, isActive: true },
      { id: '3', name: 'Server',            depreciationYears: 5, warrantyMonths: 36, isActive: true },
      { id: '4', name: 'Network Equipment', depreciationYears: 5, warrantyMonths: 24, isActive: true },
      { id: '5', name: 'Mobile Phone',      depreciationYears: 2, warrantyMonths: 12, isActive: true },
      { id: '6', name: 'Monitor',           depreciationYears: 4, warrantyMonths: 12, isActive: true },
      { id: '7', name: 'Printer',           depreciationYears: 4, warrantyMonths: 12, isActive: true },
    ],
  },
  { id: 'maintenance-types', name: 'Maintenance Types', endpoint: 'assets/maintenance-types', icon: Settings2, category: 'asset-mgmt',
    localSeed: [
      { id: '1', name: 'Preventive' },
      { id: '2', name: 'Corrective' },
      { id: '3', name: 'Inspection' },
      { id: '4', name: 'Upgrade' },
      { id: '5', name: 'Cleaning' },
      { id: '6', name: 'Calibration' },
    ],
  },
  { id: 'asset-status-values', name: 'Asset Status Values', endpoint: 'assets/status-values', icon: CheckCircle2, category: 'asset-mgmt',
    primaryKey: 'name',
    localSeed: [
      { id: '1', name: 'Active' },
      { id: '2', name: 'Inactive' },
      { id: '3', name: 'Under Maintenance' },
      { id: '4', name: 'Decommissioned' },
      { id: '5', name: 'Lost' },
      { id: '6', name: 'Stolen' },
      { id: '7', name: 'Disposed' },
      { id: '8', name: 'Reserved' },
    ],
  },
  { id: 'vendors', name: 'Vendors', endpoint: 'assets/vendors', icon: Building2, category: 'asset-mgmt',
    localSeed: [
      { id: '1', name: 'Dell Technologies', code: 'DELL', email: 'enterprise@dell.com',     country: 'USA',         isActive: true },
      { id: '2', name: 'Apple Inc.',         code: 'AAPL', email: 'business@apple.com',      country: 'USA',         isActive: true },
      { id: '3', name: 'HP Inc.',            code: 'HP',   email: 'hp@hp.com',               country: 'USA',         isActive: true },
      { id: '4', name: 'Lenovo',             code: 'LEN',  email: 'business@lenovo.com',     country: 'China',       isActive: true },
      { id: '5', name: 'Cisco Systems',      code: 'CSCO', email: 'enterprise@cisco.com',    country: 'USA',         isActive: true },
      { id: '6', name: 'Microsoft',          code: 'MSFT', email: 'enterprise@microsoft.com',country: 'USA',         isActive: true },
      { id: '7', name: 'Samsung',            code: 'SAM',  email: 'b2b@samsung.com',         country: 'South Korea', isActive: true },
      { id: '8', name: 'LG Electronics',     code: 'LGE',  email: 'b2b@lge.com',             country: 'South Korea', isActive: true },
    ],
  },

  // ── Project Management ───────────────────────────────────────────────────────
  { id: 'project-methodologies', name: 'Project Methodologies', endpoint: 'projects/methodologies', icon: Workflow, category: 'project-mgmt',
    localSeed: [
      { id: '1', name: 'Scrum' },
      { id: '2', name: 'Kanban' },
      { id: '3', name: 'Waterfall' },
      { id: '4', name: 'Hybrid' },
    ],
  },
  { id: 'backlog-item-types', name: 'Backlog Item Types', endpoint: 'projects/backlog-item-types', icon: FileText, category: 'project-mgmt',
    localSeed: [
      { id: '1', name: 'Story',    description: 'A user-facing feature or requirement' },
      { id: '2', name: 'Epic',     description: 'A large body of work that spans multiple stories' },
      { id: '3', name: 'Spike',    description: 'A time-boxed research or investigation task' },
      { id: '4', name: 'Research', description: 'Discovery or analysis work' },
      { id: '5', name: 'Feature',  description: 'A distinct piece of product functionality' },
      { id: '6', name: 'Bug',      description: 'A defect found during development' },
    ],
  },
  { id: 'defect-severities', name: 'Defect Severities', endpoint: 'projects/defect-severities', icon: XCircle, category: 'project-mgmt',
    primaryKey: 'code',
    localSeed: [
      { id: '1', code: 'S1', name: 'Blocker',  description: 'System unusable / core function completely broken' },
      { id: '2', code: 'S2', name: 'Critical', description: 'Major feature broken, no workaround' },
      { id: '3', code: 'S3', name: 'Major',    description: 'Feature partially broken, workaround exists' },
      { id: '4', code: 'S4', name: 'Minor',    description: 'Cosmetic or minor impact' },
    ],
  },
  { id: 'story-point-scale', name: 'Story Point Scale', endpoint: 'projects/story-point-scale', icon: Sliders, category: 'project-mgmt', specialPanel: 'story-point-scale' },
  { id: 'sprint-duration',   name: 'Sprint Duration',   endpoint: 'projects/sprint-duration',   icon: Calendar, category: 'project-mgmt', specialPanel: 'sprint-duration' },
];

// ── API helper ────────────────────────────────────────────────────────────────

async function apiCall(method: string, path: string, body?: unknown) {
  const res = await fetch(`${MASTER_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return safeJson(res);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <CheckCircle2 size={11} /> {t('common.active')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      <XCircle size={11} /> {t('common.inactive')}
    </span>
  );
}

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Field definitions ─────────────────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'checkbox' | 'textarea';
  required?: boolean;
  placeholder?: string;
}

const FIELD_MAP: Record<string, FieldDef[]> = {
  departments: [
    { key: 'name', label: 'Name', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'is_active', label: 'Active', type: 'checkbox' },
  ],
  locations: [
    { key: 'name', label: 'Name', required: true },
    { key: 'city', label: 'City' },
    { key: 'country', label: 'Country' },
    { key: 'address', label: 'Address', type: 'textarea' },
    { key: 'is_active', label: 'Active', type: 'checkbox' },
  ],
  'job-titles': [
    { key: 'name', label: 'Name', required: true },
    { key: 'department', label: 'Department' },
    { key: 'level', label: 'Level', placeholder: 'e.g. Junior, Senior, Lead' },
    { key: 'is_active', label: 'Active', type: 'checkbox' },
  ],
  'employment-types': [
    { key: 'name', label: 'Name', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'is_active', label: 'Active', type: 'checkbox' },
  ],
  skills: [
    { key: 'name', label: 'Name', required: true },
    { key: 'category', label: 'Category', placeholder: 'e.g. Engineering, Soft Skills' },
    { key: 'is_active', label: 'Active', type: 'checkbox' },
  ],
  'leave-policies': [
    { key: 'leave_type', label: 'Leave Type', required: true },
    { key: 'annual_days', label: 'Annual Days', type: 'number', required: true },
    { key: 'carry_forward', label: 'Carry Forward', type: 'checkbox' },
    { key: 'max_carry_forward', label: 'Max Carry Forward (days)', type: 'number' },
    { key: 'applicable_to', label: 'Applicable To', placeholder: 'e.g. all, full-time' },
    { key: 'is_active', label: 'Active', type: 'checkbox' },
  ],
  holidays: [
    { key: 'name', label: 'Name', required: true },
    { key: 'date', label: 'Date', required: true, placeholder: 'YYYY-MM-DD' },
    { key: 'type', label: 'Type', placeholder: 'e.g. public, national' },
    { key: 'location', label: 'Location', placeholder: 'e.g. India (leave blank for all)' },
    { key: 'is_active', label: 'Active', type: 'checkbox' },
  ],
  currencies: [
    { key: 'code', label: 'Code', required: true, placeholder: 'e.g. USD' },
    { key: 'name', label: 'Name', required: true },
    { key: 'symbol', label: 'Symbol', placeholder: 'e.g. $' },
    { key: 'is_active', label: 'Active', type: 'checkbox' },
  ],
  clients: [
    { key: 'name', label: 'Name', required: true },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'industry', label: 'Industry' },
    { key: 'is_active', label: 'Active', type: 'checkbox' },
  ],
  'training-courses': [
    { key: 'title', label: 'Title', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'category', label: 'Category' },
    { key: 'instructor', label: 'Instructor' },
    { key: 'duration_hours', label: 'Duration (hrs)', type: 'number' },
    { key: 'type', label: 'Format', placeholder: 'e.g. Online, In-Person, Blended' },
    { key: 'passing_score', label: 'Passing Score (%)', type: 'number' },
    { key: 'status', label: 'Status', placeholder: 'e.g. Active, Draft, Inactive' },
  ],
  'email-templates': [
    { key: 'name', label: 'Name', required: true },
    { key: 'subject', label: 'Subject', required: true },
    { key: 'category', label: 'Category', placeholder: 'e.g. HR, IT, Finance' },
    { key: 'body', label: 'Body', type: 'textarea' },
  ],
  'workflow-templates': [
    { key: 'name', label: 'Name', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'category', label: 'Category', placeholder: 'e.g. HR, Finance, IT' },
    { key: 'trigger_type', label: 'Trigger Type', placeholder: 'e.g. leave.submitted' },
    { key: 'status', label: 'Status', placeholder: 'active / inactive / draft' },
  ],
};

// ── Column definitions ────────────────────────────────────────────────────────

interface ColDef {
  key: string;
  label: string;
  render?: (row: Record<string, unknown>) => React.ReactNode;
}

function activeCol(): ColDef {
  return {
    key: 'is_active',
    label: 'Status',
    render: (row) => <ActiveBadge active={Boolean(row.is_active ?? row.active ?? true)} />,
  };
}

function columnsFor(id: string): ColDef[] {
  switch (id) {
    case 'departments':        return [{ key: 'name', label: 'Name' }, { key: 'description', label: 'Description' }, activeCol()];
    case 'locations':          return [{ key: 'name', label: 'Name' }, { key: 'city', label: 'City' }, { key: 'country', label: 'Country' }, activeCol()];
    case 'job-titles':         return [{ key: 'name', label: 'Name' }, { key: 'department', label: 'Department' }, { key: 'level', label: 'Level' }, activeCol()];
    case 'employment-types':   return [{ key: 'name', label: 'Name' }, { key: 'description', label: 'Description' }, activeCol()];
    case 'skills':             return [{ key: 'name', label: 'Name' }, { key: 'category', label: 'Category' }, activeCol()];
    case 'leave-policies':     return [{ key: 'leave_type', label: 'Leave Type' }, { key: 'annual_days', label: 'Days/Year' }, { key: 'carry_forward', label: 'Carry Fwd', render: r => r.carry_forward ? '✓' : '—' }, { key: 'applicable_to', label: 'Applicable To' }, activeCol()];
    case 'holidays':           return [{ key: 'name', label: 'Name' }, { key: 'date', label: 'Date' }, { key: 'type', label: 'Type' }, { key: 'location', label: 'Location' }, activeCol()];
    case 'currencies':         return [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'symbol', label: 'Symbol' }, activeCol()];
    case 'clients':            return [{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'industry', label: 'Industry' }, activeCol()];
    case 'training-courses':   return [{ key: 'title', label: 'Title' }, { key: 'category', label: 'Category' }, { key: 'instructor', label: 'Instructor' }, { key: 'duration_hours', label: 'Hours' }, { key: 'status', label: 'Status' }];
    case 'email-templates':    return [{ key: 'name', label: 'Name' }, { key: 'subject', label: 'Subject' }, { key: 'category', label: 'Category' }];
    case 'workflow-templates': return [{ key: 'name', label: 'Name' }, { key: 'category', label: 'Category' }, { key: 'trigger_type', label: 'Trigger' }, { key: 'status', label: 'Status' }];
    default:                   return [{ key: 'name', label: 'Name' }, activeCol()];
  }
}

// ── Value Helps (hierarchical) ────────────────────────────────────────────────

interface VHRow {
  id: string;
  entity: string;
  field: string;
  label: string;
  value: string;
  sort_order: number;
  is_active: boolean;
}

// Human-readable names for entity keys
const ENTITY_LABELS: Record<string, string> = {
  attendance: 'Attendance', leave: 'Leave', payroll: 'Payroll',
  recruitment: 'Recruitment', performance: 'Performance', training: 'Training',
  it_ticket: 'IT Ticket', asset: 'Asset', project: 'Project', okr: 'OKR',
  invoice: 'Invoice', communication: 'Communication', knowledge: 'Knowledge',
  notification: 'Notification', workflow: 'Workflow', linkedin: 'LinkedIn',
  onboarding: 'Onboarding', employee: 'Employee', document: 'Document',
  permission: 'Permission', security: 'Security & Compliance', master: 'Master / General',
  analytics: 'Analytics', ai: 'AI Intelligence', collaboration: 'Collaboration',
  advanced: 'Advanced Features', survey: 'Survey', expense: 'Expense',
};

function useValueHelpsData() {
  const [rows, setRows] = useState<VHRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${MASTER_URL}/value-helps`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      if (!res.ok) { setRows([]); return; }
      const json = await safeJson(res);
      const raw = (json?.data ?? json) as VHRow[];
      setRows(raw.sort((a, b) => a.entity.localeCompare(b.entity) || a.field.localeCompare(b.field) || (a.sort_order - b.sort_order)));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('masterDataUpdated', handler);
    return () => window.removeEventListener('masterDataUpdated', handler);
  }, [load]);

  return { rows, loading, refresh: load };
}

// ── Value Help row add/edit modal ─────────────────────────────────────────────

function VHRowModal({ initial, defaultEntity, defaultField, onClose, onSaved }: {
  initial: VHRow | null;
  defaultEntity?: string;
  defaultField?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(initial?.id);
  const [entity, setEntity] = useState(initial?.entity ?? defaultEntity ?? '');
  const [field, setField] = useState(initial?.field ?? defaultField ?? '');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [value, setValue] = useState(initial?.value ?? '');
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 1));
  const [active, setActive] = useState(initial?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entity.trim() || !field.trim() || !value.trim()) {
      toast.error(t('masterData.entityFieldValueRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload = { entity: entity.trim(), field: field.trim(), label: label.trim() || value.trim(), value: value.trim(), sort_order: Number(sortOrder), is_active: active };
      if (isEdit && initial?.id) {
        await apiCall('PUT', `/value-helps/${initial.id}`, payload);
        toast.success(t('masterData.rowUpdated'));
      } else {
        await apiCall('POST', '/value-helps', payload);
        toast.success(t('masterData.rowAdded'));
      }
      window.dispatchEvent(new Event('masterDataUpdated'));
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('masterData.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">{isEdit ? t('masterData.editValue') : t('masterData.addValue')}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">{t('masterData.entityLabel')} <span className="text-red-500">*</span></label>
              <input value={entity} onChange={e => setEntity(e.target.value)} placeholder="e.g. leave"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">{t('masterData.fieldLabel')} <span className="text-red-500">*</span></label>
              <input value={field} onChange={e => setField(e.target.value)} placeholder="e.g. type"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">{t('masterData.labelShown')}</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Annual Leave"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">{t('masterData.valueKey')} <span className="text-red-500">*</span></label>
            <input value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. Annual Leave"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">{t('masterData.sortOrder')}</label>
              <input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} min={1}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <label className="flex items-center gap-3 cursor-pointer pt-6">
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500" />
              <span className="text-sm font-medium text-foreground">{t('common.active')}</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted transition-colors">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? t('masterData.saveChanges') : t('masterData.addValue')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Value Helps Panel ─────────────────────────────────────────────────────────

function ValueHelpsPanel({ canMutate }: { canMutate: boolean }) {
  const { rows, loading, refresh } = useValueHelpsData();
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>({});
  const [entitySearch, setEntitySearch] = useState('');
  const [valueSearch, setValueSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VHRow | null>(null);
  const [addDefaults, setAddDefaults] = useState<{ entity?: string; field?: string }>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Distinct entities sorted
  const entities = useMemo(() => {
    const set = new Set(rows.map(r => r.entity));
    return [...set].sort();
  }, [rows]);

  const filteredEntities = useMemo(() => {
    const q = entitySearch.toLowerCase();
    if (!q) return entities;
    return entities.filter(e => e.toLowerCase().includes(q) || (ENTITY_LABELS[e] ?? '').toLowerCase().includes(q));
  }, [entities, entitySearch]);

  // Rows for selected entity, grouped by field
  const entityRows = useMemo(() => {
    if (!selectedEntity) return {};
    const q = valueSearch.toLowerCase();
    const relevant = rows.filter(r => r.entity === selectedEntity &&
      (!q || r.label.toLowerCase().includes(q) || r.value.toLowerCase().includes(q) || r.field.toLowerCase().includes(q)));
    const grouped: Record<string, VHRow[]> = {};
    for (const r of relevant) {
      (grouped[r.field] = grouped[r.field] ?? []).push(r);
    }
    return grouped;
  }, [rows, selectedEntity, valueSearch]);

  const fields = Object.keys(entityRows).sort();

  function toggleField(f: string) {
    setExpandedFields(p => ({ ...p, [f]: !p[f] }));
  }

  function openAdd(entity?: string, field?: string) {
    setEditing(null);
    setAddDefaults({ entity, field });
    setModalOpen(true);
  }

  function openEdit(row: VHRow) {
    setEditing(row);
    setAddDefaults({});
    setModalOpen(true);
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await apiCall('DELETE', `/value-helps/${id}`);
      toast.success(t('masterData.valueDeleted'));
      window.dispatchEvent(new Event('masterDataUpdated'));
      setDeletingId(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('masterData.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }

  const totalForEntity = selectedEntity ? rows.filter(r => r.entity === selectedEntity).length : 0;

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Sliders size={20} className="text-blue-600" />
            {t('masterData.valueHelpsConfig')}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? t('common.loading') : `${rows.length} values across ${entities.length} entities`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {canMutate && (
            <button onClick={() => openAdd(selectedEntity ?? undefined)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
              <Plus size={14} /> {t('masterData.addValue')}
            </button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4 min-h-[600px]">
        {/* Left — entity list */}
        <div className="w-52 shrink-0 bg-card rounded-xl border border-border flex flex-col overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={entitySearch} onChange={e => setEntitySearch(e.target.value)} placeholder={t('masterData.filterEntities')}
                className="w-full border border-border rounded-lg pl-8 pr-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {loading ? (
              <div className="flex items-center justify-center h-20 text-muted-foreground"><Loader2 size={16} className="animate-spin" /></div>
            ) : filteredEntities.map(entity => {
              const count = rows.filter(r => r.entity === entity).length;
              const isSelected = selectedEntity === entity;
              return (
                <button key={entity} onClick={() => { setSelectedEntity(entity); setValueSearch(''); setExpandedFields({}); }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-foreground'}`}>
                  <span className="text-sm truncate">{ENTITY_LABELS[entity] ?? entity}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right — fields + values */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {!selectedEntity ? (
            <div className="flex-1 bg-card rounded-xl border border-border flex flex-col items-center justify-center text-muted-foreground gap-2 p-8">
              <Sliders size={32} className="opacity-30" />
              <p className="text-sm font-medium">{t('masterData.selectEntity')}</p>
              <p className="text-xs text-center">{t('masterData.entityHint')}</p>
            </div>
          ) : (
            <>
              {/* Entity header */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {ENTITY_LABELS[selectedEntity] ?? selectedEntity}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">{selectedEntity} · {totalForEntity} values in {fields.length} fields</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input value={valueSearch} onChange={e => setValueSearch(e.target.value)} placeholder={t('masterData.searchValues')}
                      className="border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44" />
                  </div>
                  {canMutate && (
                    <button onClick={() => openAdd(selectedEntity)} className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                      <Plus size={13} /> Add to {ENTITY_LABELS[selectedEntity] ?? selectedEntity}
                    </button>
                  )}
                </div>
              </div>

              {/* Fields accordion */}
              {fields.length === 0 ? (
                <div className="bg-card rounded-xl border border-border flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                  <Tag size={24} className="opacity-30" />
                  <p className="text-sm">{valueSearch ? 'No values match your search.' : 'No values found for this entity.'}</p>
                </div>
              ) : (
                <div className="space-y-2 overflow-y-auto flex-1">
                  {fields.map(field => {
                    const fieldRows = entityRows[field] ?? [];
                    const isOpen = expandedFields[field] !== false; // default open
                    return (
                      <div key={field} className="bg-card rounded-xl border border-border overflow-hidden">
                        {/* Field header */}
                        <button onClick={() => toggleField(field)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors">
                          <div className="flex items-center gap-2">
                            {isOpen ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                            <span className="text-sm font-semibold text-foreground">{field}</span>
                            <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{fieldRows.length}</span>
                          </div>
                          {canMutate && (
                            <span onClick={e => { e.stopPropagation(); openAdd(selectedEntity, field); }}
                              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5 px-2 py-1 rounded hover:bg-blue-50 transition-colors">
                              <Plus size={11} /> Add
                            </span>
                          )}
                        </button>

                        {/* Values table */}
                        {isOpen && (
                          <div className="border-t border-border overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-muted/50">
                                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-8">#</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Label</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Value (key)</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                  {canMutate && <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {fieldRows.map((row, i) => (
                                  <tr key={row.id} className="group hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-2 text-xs text-muted-foreground">{row.sort_order ?? i + 1}</td>
                                    <td className="px-4 py-2 text-foreground">{row.label}</td>
                                    <td className="px-4 py-2">
                                      <span className="font-mono text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{row.value}</span>
                                    </td>
                                    <td className="px-4 py-2"><ActiveBadge active={row.is_active} /></td>
                                    {canMutate && (
                                      <td className="px-4 py-2 text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => openEdit(row)} className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Pencil size={12} /></button>
                                          <button onClick={() => setDeletingId(row.id)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={12} /></button>
                                        </div>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {modalOpen && (
        <VHRowModal
          initial={editing}
          defaultEntity={addDefaults.entity}
          defaultField={addDefaults.field}
          onClose={() => { setModalOpen(false); setEditing(null); setAddDefaults({}); }}
          onSaved={() => { setModalOpen(false); setEditing(null); setAddDefaults({}); refresh(); }}
        />
      )}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-foreground mb-2">Delete Value</h3>
            <p className="text-sm text-muted-foreground mb-6">This will permanently remove this dropdown option. Dropdowns referencing this value may break.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingId(null)} className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-lg">Cancel</button>
              <button onClick={() => handleDelete(deletingId)} disabled={deleting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center gap-2">
                {deleting && <Loader2 size={14} className="animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Form modal (generic entity) ───────────────────────────────────────────────

function FormModal({ entity, initial, onClose, onSaved }: {
  entity: EntityDef;
  initial: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fields = FIELD_MAP[entity.id] ?? [{ key: 'name', label: 'Name', required: true }];
  const isEdit = Boolean(initial && (initial.id || initial._id));

  const defaultValues = useMemo(() => {
    const d: Record<string, unknown> = {};
    fields.forEach(f => { d[f.key] = initial?.[f.key] ?? (f.type === 'checkbox' ? true : f.type === 'number' ? '' : ''); });
    return d;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [form, setForm] = useState<Record<string, unknown>>(defaultValues);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    for (const f of fields.filter(f => f.required)) {
      if (!String(form[f.key] ?? '').trim()) { toast.error(`${f.label} is required`); return; }
    }
    setSaving(true);
    try {
      const id = initial?.id ?? initial?._id;
      if (isEdit && id) {
        await apiCall('PUT', `/${entity.endpoint}/${id}`, form);
        toast.success(`${entity.name.replace(/s$/, '')} updated`);
      } else {
        await apiCall('POST', `/${entity.endpoint}`, form);
        toast.success(`${entity.name.replace(/s$/, '')} created`);
      }
      window.dispatchEvent(new Event('masterDataUpdated'));
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">{isEdit ? `Edit ${entity.name.replace(/s$/, '')}` : `Add ${entity.name.replace(/s$/, '')}`}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {fields.map(f => {
            if (f.type === 'checkbox') {
              return (
                <label key={f.key} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={Boolean(form[f.key])} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.checked }))} className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-medium text-foreground">{f.label}</span>
                </label>
              );
            }
            if (f.type === 'textarea') {
              return (
                <div key={f.key} className="space-y-1">
                  <label className="block text-sm font-medium text-foreground">{f.label}{f.required && <span className="text-red-500 ml-1">*</span>}</label>
                  <textarea value={String(form[f.key] ?? '')} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} rows={3}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              );
            }
            return (
              <div key={f.key} className="space-y-1">
                <label className="block text-sm font-medium text-foreground">{f.label}{f.required && <span className="text-red-500 ml-1">*</span>}</label>
                <input type={f.type === 'number' ? 'number' : 'text'} value={String(form[f.key] ?? '')} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            );
          })}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted transition-colors">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? t('masterData.saveChanges') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteDialog({ entityName, recordName, onConfirm, onCancel, deleting }: {
  entityName: string; recordName: string; onConfirm: () => void; onCancel: () => void; deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-foreground mb-2">Delete {entityName}</h3>
        <p className="text-sm text-muted-foreground mb-6">Are you sure you want to delete <span className="font-medium text-foreground">"{recordName}"</span>? This cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted transition-colors">{t('Cancel')}</button>
          <button onClick={onConfirm} disabled={deleting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center gap-2">
            {deleting && <Loader2 size={14} className="animate-spin" />}
            {t('Delete')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Entity panel ──────────────────────────────────────────────────────────────

function EntityPanel({ entity, canMutate, isAdmin }: { entity: EntityDef; canMutate: boolean; isAdmin: boolean; }) {
  const { data, loading, refresh } = useMasterDataDirect(entity.endpoint);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [deletingRow, setDeletingRow] = useState<Record<string, unknown> | null>(null);
  const [deleting, setDeleting] = useState(false);

  const columns = useMemo(() => columnsFor(entity.id), [entity.id]);

  const filtered = useMemo(() => {
    let rows = data as Record<string, unknown>[];
    if (statusFilter !== 'all') {
      const wantActive = statusFilter === 'active';
      rows = rows.filter(r => {
        const active = r.is_active !== false && r.active !== false;
        return wantActive ? active : !active;
      });
    }
    const q = search.toLowerCase();
    if (q) rows = rows.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q)));
    return rows;
  }, [data, search, statusFilter]);

  const activeCount = useMemo(() =>
    (data as Record<string, unknown>[]).filter(r => r.is_active !== false && r.active !== false).length,
  [data]);

  async function handleDelete() {
    if (!deletingRow) return;
    const id = deletingRow.id ?? deletingRow._id;
    setDeleting(true);
    try {
      await apiCall('DELETE', `/${entity.endpoint}/${id}`);
      toast.success(`${entity.name.replace(/s$/, '')} deleted`);
      window.dispatchEvent(new Event('masterDataUpdated'));
      setDeletingRow(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  const singularName = entity.name.replace(/s$/, '');
  const primaryKey = entity.primaryKey ?? 'name';

  return (
    <div className="flex-1 min-w-0 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <entity.icon size={20} className="text-blue-600" />
          {entity.name}
          <span className="text-sm font-normal text-muted-foreground ml-1">
            {loading ? '…' : `${data.length} record${data.length !== 1 ? 's' : ''}`}
          </span>
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button onClick={() => { downloadCSV(`${entity.endpoint}-${new Date().toISOString().slice(0, 10)}.csv`, filtered as Record<string, unknown>[]); toast.success('CSV downloaded'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
              <Download size={14} /> Export CSV
            </button>
          )}
          <button onClick={refresh} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {canMutate && (
            <button onClick={() => { setEditing(null); setFormOpen(true); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
              <Plus size={14} /> Add {singularName}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border px-4 py-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('Total')}</p>
          <p className="text-2xl font-bold text-foreground mt-0.5">{loading ? '—' : data.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border px-4 py-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('Active')}</p>
          <p className="text-2xl font-bold text-green-600 mt-0.5">{loading ? '—' : activeCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border px-4 py-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Showing</p>
          <p className="text-2xl font-bold text-blue-600 mt-0.5">{loading ? '—' : filtered.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${entity.name.toLowerCase()}…`}
            className="border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-60" />
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statusFilter === s ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        {(search || statusFilter !== 'all') && (
          <button onClick={() => { setSearch(''); setStatusFilter('all'); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 size={24} className="animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <entity.icon size={28} />
            <p className="text-sm">{search || statusFilter !== 'all' ? 'No results match your filters.' : `No ${entity.name.toLowerCase()} yet.`}</p>
            {canMutate && !search && statusFilter === 'all' && (
              <button onClick={() => { setEditing(null); setFormOpen(true); }} className="mt-1 text-sm text-blue-600 hover:underline flex items-center gap-1">
                <Plus size={13} /> Add first {singularName.toLowerCase()}
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted first:rounded-tl-xl">{col.label}</th>
                ))}
                {canMutate && <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted rounded-tr-xl">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(filtered as Record<string, unknown>[]).map((row, i) => {
                const id = String(row.id ?? row._id ?? i);
                return (
                  <tr key={id} className="group hover:bg-muted transition-colors">
                    {columns.map(col => (
                      <td key={col.key} className="px-4 py-3 text-foreground">
                        {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                      </td>
                    ))}
                    {canMutate && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditing(row); setFormOpen(true); }} className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Pencil size={14} /></button>
                          <button onClick={() => setDeletingRow(row)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && (
        <FormModal entity={entity} initial={editing} onClose={() => { setFormOpen(false); setEditing(null); }} onSaved={() => { setFormOpen(false); setEditing(null); refresh(); }} />
      )}
      {deletingRow && (
        <DeleteDialog entityName={singularName} recordName={String(deletingRow[primaryKey] ?? deletingRow.name ?? deletingRow.id ?? 'this record')}
          onConfirm={handleDelete} onCancel={() => setDeletingRow(null)} deleting={deleting} />
      )}
    </div>
  );
}

// ── Local-state entity tables (IT / Asset / Project sections) ────────────────

const LOCAL_COLUMNS: Record<string, ColDef[]> = {
  'ticket-categories': [
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'defaultSla', label: 'Default SLA' },
    { key: 'sortOrder', label: 'Sort' },
    { key: 'isActive', label: 'Status', render: r => <ActiveBadge active={Boolean(r.isActive)} /> },
  ],
  'sla-policies': [
    { key: 'name', label: 'Policy Name' },
    { key: 'priority', label: 'Priority' },
    { key: 'firstResponseHrs', label: '1st Response (hrs)' },
    { key: 'resolutionHrs', label: 'Resolution (hrs)' },
    { key: 'businessHours', label: 'Business Hours' },
    { key: 'isActive', label: 'Status', render: r => <ActiveBadge active={Boolean(r.isActive)} /> },
  ],
  'resolution-codes': [
    { key: 'name', label: 'Name' },
    { key: 'isActive', label: 'Status', render: r => <ActiveBadge active={Boolean(r.isActive)} /> },
  ],
  'ticket-impact': [
    { key: 'name', label: 'Impact Level' },
  ],
  'asset-categories': [
    { key: 'name', label: 'Name' },
    { key: 'depreciationYears', label: 'Depreciation (yrs)' },
    { key: 'warrantyMonths', label: 'Warranty (mo)' },
    { key: 'isActive', label: 'Status', render: r => <ActiveBadge active={Boolean(r.isActive)} /> },
  ],
  'maintenance-types': [
    { key: 'name', label: 'Name' },
  ],
  'asset-status-values': [
    { key: 'name', label: 'Status Value' },
  ],
  'vendors': [
    { key: 'name', label: 'Name' },
    { key: 'code', label: 'Code' },
    { key: 'email', label: 'Email' },
    { key: 'country', label: 'Country' },
    { key: 'isActive', label: 'Status', render: r => <ActiveBadge active={Boolean(r.isActive)} /> },
  ],
  'project-methodologies': [
    { key: 'name', label: 'Methodology' },
  ],
  'backlog-item-types': [
    { key: 'name', label: 'Type' },
    { key: 'description', label: 'Description' },
  ],
  'defect-severities': [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
  ],
};

const LOCAL_FIELDS: Record<string, FieldDef[]> = {
  'ticket-categories': [
    { key: 'name', label: 'Name', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'defaultSla', label: 'Default SLA', placeholder: 'e.g. P3-Medium' },
    { key: 'sortOrder', label: 'Sort Order', type: 'number' },
    { key: 'isActive', label: 'Active', type: 'checkbox' },
  ],
  'sla-policies': [
    { key: 'name', label: 'Policy Name', required: true },
    { key: 'priority', label: 'Priority', placeholder: 'e.g. P1-Critical' },
    { key: 'firstResponseHrs', label: '1st Response (hrs)', type: 'number' },
    { key: 'resolutionHrs', label: 'Resolution (hrs)', type: 'number' },
    { key: 'businessHours', label: 'Business Hours', placeholder: 'e.g. 24x7 or Business Hours' },
    { key: 'isActive', label: 'Active', type: 'checkbox' },
  ],
  'resolution-codes': [
    { key: 'name', label: 'Name', required: true },
    { key: 'isActive', label: 'Active', type: 'checkbox' },
  ],
  'ticket-impact': [
    { key: 'name', label: 'Impact Level', required: true },
  ],
  'asset-categories': [
    { key: 'name', label: 'Name', required: true },
    { key: 'depreciationYears', label: 'Depreciation Years', type: 'number' },
    { key: 'warrantyMonths', label: 'Warranty Months', type: 'number' },
    { key: 'isActive', label: 'Active', type: 'checkbox' },
  ],
  'maintenance-types': [
    { key: 'name', label: 'Name', required: true },
  ],
  'vendors': [
    { key: 'name', label: 'Name', required: true },
    { key: 'code', label: 'Code', placeholder: 'e.g. DELL' },
    { key: 'email', label: 'Email' },
    { key: 'country', label: 'Country' },
    { key: 'isActive', label: 'Active', type: 'checkbox' },
  ],
  'project-methodologies': [
    { key: 'name', label: 'Methodology Name', required: true },
  ],
  'backlog-item-types': [
    { key: 'name', label: 'Type Name', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
  ],
  'defect-severities': [
    { key: 'code', label: 'Code', required: true, placeholder: 'e.g. S1' },
    { key: 'name', label: 'Name', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
  ],
};

// ── Inline form modal (local state, no API) ───────────────────────────────────

function LocalFormModal({ title, fields, initial, onClose, onSave }: {
  title: string;
  fields: FieldDef[];
  initial: Record<string, unknown> | null;
  onClose: () => void;
  onSave: (form: Record<string, unknown>) => void;
}) {
  const defaultValues = useMemo(() => {
    const d: Record<string, unknown> = {};
    fields.forEach(f => { d[f.key] = initial?.[f.key] ?? (f.type === 'checkbox' ? true : f.type === 'number' ? '' : ''); });
    return d;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [form, setForm] = useState<Record<string, unknown>>(defaultValues);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    for (const f of fields.filter(f => f.required)) {
      if (!String(form[f.key] ?? '').trim()) { toast.error(`${f.label} is required`); return; }
    }
    onSave(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {fields.map(f => {
            if (f.type === 'checkbox') {
              return (
                <label key={f.key} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={Boolean(form[f.key])} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.checked }))} className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-medium text-foreground">{f.label}</span>
                </label>
              );
            }
            if (f.type === 'textarea') {
              return (
                <div key={f.key} className="space-y-1">
                  <label className="block text-sm font-medium text-foreground">{f.label}{f.required && <span className="text-red-500 ml-1">*</span>}</label>
                  <textarea value={String(form[f.key] ?? '')} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} rows={3}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              );
            }
            return (
              <div key={f.key} className="space-y-1">
                <label className="block text-sm font-medium text-foreground">{f.label}{f.required && <span className="text-red-500 ml-1">*</span>}</label>
                <input type={f.type === 'number' ? 'number' : 'text'} value={String(form[f.key] ?? '')} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            );
          })}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Local entity panel (seeds from EntityDef.localSeed, no API) ───────────────

function LocalEntityPanel({ entity, canMutate }: {
  entity: EntityDef & { localSeed: Record<string, unknown>[] };
  canMutate: boolean;
}) {
  const [data, setData] = useState<Record<string, unknown>[]>(() =>
    entity.localSeed.map((r, i) => ({ ...r, id: r.id ?? String(i + 1) }))
  );
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [deletingRow, setDeletingRow] = useState<Record<string, unknown> | null>(null);

  const isReadOnly = entity.id === 'asset-status-values';
  const columns = LOCAL_COLUMNS[entity.id] ?? [{ key: 'name', label: 'Name' }];
  const fields = LOCAL_FIELDS[entity.id] ?? [{ key: 'name', label: 'Name', required: true }];
  const primaryKey = entity.primaryKey ?? 'name';
  const singularName = entity.name.replace(/s$/, '');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return data;
    return data.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q)));
  }, [data, search]);

  function handleSave(form: Record<string, unknown>) {
    if (editing) {
      setData(prev => prev.map(r => r.id === editing.id ? { ...r, ...form } : r));
      toast.success(`${singularName} updated`);
    } else {
      setData(prev => [...prev, { ...form, id: String(Date.now()) }]);
      toast.success(`${singularName} added`);
    }
    setFormOpen(false);
    setEditing(null);
  }

  function handleDelete() {
    if (!deletingRow) return;
    setData(prev => prev.filter(r => r.id !== deletingRow.id));
    toast.success(`${singularName} deleted`);
    setDeletingRow(null);
  }

  return (
    <div className="flex-1 min-w-0 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <entity.icon size={20} className="text-blue-600" />
          {entity.name}
          <span className="text-sm font-normal text-muted-foreground ml-1">{data.length} record{data.length !== 1 ? 's' : ''}</span>
        </h2>
        {canMutate && !isReadOnly && (
          <button onClick={() => { setEditing(null); setFormOpen(true); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={14} /> Add {singularName}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${entity.name.toLowerCase()}…`}
            className="border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-60" />
        </div>
        {search && (
          <button onClick={() => setSearch('')} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
            <X size={12} /> Clear
          </button>
        )}
        {isReadOnly && (
          <span className="text-xs text-muted-foreground italic ml-2">Read-only reference values</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <entity.icon size={28} />
            <p className="text-sm">{search ? 'No results match your search.' : `No ${entity.name.toLowerCase()} yet.`}</p>
            {canMutate && !isReadOnly && !search && (
              <button onClick={() => { setEditing(null); setFormOpen(true); }} className="mt-1 text-sm text-blue-600 hover:underline flex items-center gap-1">
                <Plus size={13} /> Add first {singularName.toLowerCase()}
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted first:rounded-tl-xl">{col.label}</th>
                ))}
                {canMutate && !isReadOnly && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted rounded-tr-xl">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((row, i) => {
                const id = String(row.id ?? i);
                return (
                  <tr key={id} className="group hover:bg-muted transition-colors">
                    {columns.map(col => (
                      <td key={col.key} className="px-4 py-3 text-foreground">
                        {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                      </td>
                    ))}
                    {canMutate && !isReadOnly && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditing(row); setFormOpen(true); }} className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Pencil size={14} /></button>
                          <button onClick={() => setDeletingRow(row)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && (
        <LocalFormModal
          title={editing ? `Edit ${singularName}` : `Add ${singularName}`}
          fields={fields}
          initial={editing}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
      {deletingRow && (
        <DeleteDialog
          entityName={singularName}
          recordName={String(deletingRow[primaryKey] ?? deletingRow.name ?? deletingRow.id ?? 'this record')}
          onConfirm={handleDelete}
          onCancel={() => setDeletingRow(null)}
          deleting={false}
        />
      )}
    </div>
  );
}

// ── Story Point Scale panel ───────────────────────────────────────────────────

const STORY_POINT_SCALES = [
  { id: 'fibonacci', label: 'Fibonacci', values: '1, 2, 3, 5, 8, 13, 21, 34' },
  { id: 'tshirt',    label: 'T-Shirt',   values: 'XS, S, M, L, XL' },
  { id: 'custom',    label: 'Custom',    values: '' },
] as const;

function StoryPointScalePanel({ canMutate }: { canMutate: boolean }) {
  const [activeScale, setActiveScale] = useState<string>('fibonacci');
  const [customValues, setCustomValues] = useState('');

  const current = STORY_POINT_SCALES.find(s => s.id === activeScale)!;
  const chips = (activeScale === 'custom' ? customValues : current.values)
    .split(',').map(s => s.trim()).filter(Boolean);

  return (
    <div className="flex-1 min-w-0 space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Sliders size={20} className="text-blue-600" />
        Story Point Scale
      </h2>
      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <p className="text-sm text-muted-foreground">Select the estimation scale used for story points across all projects.</p>
        <div className="space-y-3">
          {STORY_POINT_SCALES.map(scale => (
            <label key={scale.id} className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition-colors ${activeScale === scale.id ? 'border-blue-300 bg-blue-50/40' : 'border-border hover:bg-muted'}`}>
              <input
                type="radio"
                name="storyPointScale"
                value={scale.id}
                checked={activeScale === scale.id}
                onChange={() => setActiveScale(scale.id)}
                disabled={!canMutate}
                className="mt-0.5 w-4 h-4 text-blue-600 border-border focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-foreground">{scale.label}</p>
                {scale.values && <p className="text-xs text-muted-foreground font-mono mt-0.5">{scale.values}</p>}
              </div>
            </label>
          ))}
        </div>
        {activeScale === 'custom' && canMutate && (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">Custom values <span className="text-muted-foreground font-normal">(comma-separated)</span></label>
            <input value={customValues} onChange={e => setCustomValues(e.target.value)} placeholder="e.g. 1, 2, 4, 8, 16"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
        {chips.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Current scale values</p>
            <div className="flex flex-wrap gap-2">
              {chips.map(chip => (
                <span key={chip} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-card border border-border text-foreground">
                  {chip}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sprint Duration panel ─────────────────────────────────────────────────────

const SPRINT_DURATIONS = [
  { id: '1w', label: '1 week' },
  { id: '2w', label: '2 weeks' },
  { id: '3w', label: '3 weeks' },
  { id: '4w', label: '4 weeks' },
];

function SprintDurationPanel({ canMutate }: { canMutate: boolean }) {
  const [activeDuration, setActiveDuration] = useState('2w');

  return (
    <div className="flex-1 min-w-0 space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Calendar size={20} className="text-blue-600" />
        Sprint Duration Defaults
      </h2>
      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <p className="text-sm text-muted-foreground">Set the default sprint duration for new projects. Individual projects can override this per-project.</p>
        <div className="space-y-3">
          {SPRINT_DURATIONS.map(duration => (
            <label key={duration.id} className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-colors ${activeDuration === duration.id ? 'border-blue-300 bg-blue-50/40' : 'border-border hover:bg-muted'}`}>
              <input
                type="radio"
                name="sprintDuration"
                value={duration.id}
                checked={activeDuration === duration.id}
                onChange={() => setActiveDuration(duration.id)}
                disabled={!canMutate}
                className="w-4 h-4 text-blue-600 border-border focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-foreground">
                {duration.label}
                {duration.id === '2w' && <span className="ml-2 text-xs text-muted-foreground font-normal">(default)</span>}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ activeId, onSelect }: { activeId: string; onSelect: (id: string) => void; }) {
  // Default: HR open, others closed
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CATEGORIES.map(c => [c.id, c.id !== 'hr']))
  );

  function toggle(catId: string) {
    setCollapsed(prev => ({ ...prev, [catId]: !prev[catId] }));
  }

  // Auto-expand category when a sub-item is selected
  useEffect(() => {
    const entity = ENTITIES.find(e => e.id === activeId);
    if (entity) {
      setCollapsed(prev => ({ ...prev, [entity.category]: false }));
    }
  }, [activeId]);

  return (
    <aside className="hidden md:block w-56 shrink-0 bg-card rounded-xl border border-border p-3 h-fit sticky top-24">
      {CATEGORIES.map(cat => {
        const catEntities = ENTITIES.filter(e => e.category === cat.id);
        const isCollapsed = collapsed[cat.id];
        const hasActive = catEntities.some(e => e.id === activeId);
        return (
          <div key={cat.id} className="mb-1">
            <button onClick={() => toggle(cat.id)} className={`w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-muted transition-colors ${hasActive ? 'bg-blue-50/50' : ''}`}>
              <div className="flex items-center gap-2">
                <cat.icon size={13} className={cat.color} />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cat.label}</span>
                <span className="text-xs text-muted-foreground">{catEntities.length}</span>
              </div>
              {isCollapsed ? <ChevronRight size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
            </button>
            {!isCollapsed && (
              <div className="ml-1 space-y-0.5">
                {catEntities.map(e => (
                  <button key={e.id} onClick={() => onSelect(e.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeId === e.id ? 'bg-blue-50 text-blue-700' : 'text-muted-foreground hover:bg-muted'}`}>
                    <e.icon size={13} />
                    <span className="truncate">{e.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="mt-2 pt-2 border-t border-border">
        <button onClick={() => onSelect('value-helps')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeId === 'value-helps' ? 'bg-blue-50 text-blue-700' : 'text-muted-foreground hover:bg-muted'}`}>
          <Sliders size={13} />
          Value Helps
          <span className="text-xs text-muted-foreground ml-auto">Config</span>
        </button>
      </div>
    </aside>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface MasterDataManagementExpandedProps {
  accessToken?: string;
  onLogout?: () => void;
}

export function MasterDataManagementExpanded({ onLogout }: MasterDataManagementExpandedProps) {
  const { currentUser } = useUser();
  const [activeId, setActiveId] = useState(ENTITIES[0].id);
  const [mobileCat, setMobileCat] = useState('hr');

  const role = (currentUser?.primaryRole ?? '').toLowerCase();
  const canMutate = ['admin', 'hr', 'finance'].includes(role);
  const isAdmin = role === 'admin';

  const activeEntity = ENTITIES.find(e => e.id === activeId);
  const mobileCatEntities = ENTITIES.filter(e => e.category === mobileCat);

  return (
    <AppLayout title="Master Data Management" icon={<Building2 className="h-6 w-6" />} onLogout={onLogout ?? (() => {})}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* Mobile: category pills → entity pills */}
        <div className="md:hidden mb-4 space-y-2">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => { setMobileCat(cat.id); const first = ENTITIES.find(e => e.category === cat.id); if (first) setActiveId(first.id); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${mobileCat === cat.id && activeId !== 'value-helps' ? 'bg-blue-600 text-white' : 'bg-card border border-border text-muted-foreground'}`}>
                <cat.icon size={12} /> {cat.label}
              </button>
            ))}
            <button onClick={() => setActiveId('value-helps')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${activeId === 'value-helps' ? 'bg-blue-600 text-white' : 'bg-card border border-border text-muted-foreground'}`}>
              <Sliders size={12} /> Value Helps
            </button>
          </div>
          {activeId !== 'value-helps' && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {mobileCatEntities.map(e => (
                <button key={e.id} onClick={() => setActiveId(e.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${activeId === e.id ? 'bg-card shadow-sm border border-border text-foreground' : 'text-muted-foreground'}`}>
                  <e.icon size={11} /> {e.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-6 items-start">
          <Sidebar activeId={activeId} onSelect={setActiveId} />
          {activeId === 'value-helps' ? (
            <ValueHelpsPanel canMutate={canMutate} />
          ) : activeEntity?.specialPanel === 'story-point-scale' ? (
            <StoryPointScalePanel key={activeEntity.id} canMutate={canMutate} />
          ) : activeEntity?.specialPanel === 'sprint-duration' ? (
            <SprintDurationPanel key={activeEntity.id} canMutate={canMutate} />
          ) : activeEntity?.localSeed ? (
            <LocalEntityPanel key={activeEntity.id} entity={activeEntity as EntityDef & { localSeed: Record<string, unknown>[] }} canMutate={canMutate} />
          ) : activeEntity ? (
            <EntityPanel key={activeEntity.id} entity={activeEntity} canMutate={canMutate} isAdmin={isAdmin} />
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}

export default MasterDataManagementExpanded;
