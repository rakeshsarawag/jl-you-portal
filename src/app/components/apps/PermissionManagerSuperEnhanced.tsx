/**
 * Permission Manager
 * Role-based access control editor — persists to role_permissions table.
 * Three panels: App Visibility, Section Permissions, Audit Log.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Shield, Lock, Eye, EyeOff, Check, X, Loader2, ChevronDown, ChevronRight,
  Save, RotateCcw, Search, AlertCircle, Info, Users, LayoutGrid, List,
  CheckSquare, Square, Minus, RefreshCw, History,
} from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { API_BASE, publicAnonKey, apiHeaders } from '../../utils/constants';
import {
  SECTION_CONFIG, ALL_ROLES, DEFAULT_APP_VISIBILITY, DEFAULT_SECTION_VISIBILITY,
  buildDefaultPermissions, UserRole,
} from '../../../constants/permissionSections';
import { APP_REGISTRY } from '../../../constants/appRegistry';
import { invalidatePermissionsCache } from '../../hooks/usePermissions';

// ── Constants ──────────────────────────────────────────────────────────────

const PERM_URL = `${API_BASE}/permissions`;

const ROLE_META: Record<UserRole, { label: string; color: string; bg: string }> = {
  admin:     { label: 'Admin',     color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' },
  hr:        { label: 'HR',        color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800' },
  manager:   { label: 'Manager',   color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' },
  finance:   { label: 'Finance',   color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' },
  employee:  { label: 'Employee',  color: 'text-gray-600 dark:text-gray-400',   bg: 'bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800' },
  it:        { label: 'IT',        color: 'text-cyan-600 dark:text-cyan-400',   bg: 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800' },
  marketing: { label: 'Marketing', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800' },
};

// ── Types ──────────────────────────────────────────────────────────────────

type PermBlob = {
  app_visibility: Record<string, boolean>;
  sections: Record<string, Record<string, boolean>>;
};

type Matrix = Record<UserRole, PermBlob>;

type PanelTab = 'apps' | 'sections' | 'audit';

// ── Helpers ────────────────────────────────────────────────────────────────

function emptyMatrix(): Matrix {
  const m = {} as Matrix;
  for (const role of ALL_ROLES) {
    m[role] = { app_visibility: {}, sections: {} };
  }
  return m;
}

function defaultsMatrix(): Matrix {
  const m = {} as Matrix;
  for (const role of ALL_ROLES) {
    m[role] = buildDefaultPermissions(role) as PermBlob;
  }
  return m;
}

async function loadMatrix(): Promise<{ matrix: Matrix; tableMissing: boolean; dbEmpty: boolean }> {
  const res = await fetch(PERM_URL, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
  const json = await res.json();

  if (res.status === 503 && json?.table_missing) {
    return { matrix: emptyMatrix(), tableMissing: true, dbEmpty: false };
  }
  if (!res.ok) throw new Error(json?.error ?? 'Failed to load permissions');

  const raw: Record<string, any> = json?.permissionMatrix ?? {};

  // If nothing is stored yet, return empty — do not fall back to hardcoded defaults
  if (Object.keys(raw).length === 0) {
    return { matrix: emptyMatrix(), tableMissing: false, dbEmpty: true };
  }

  const matrix = emptyMatrix();
  for (const [role, data] of Object.entries(raw)) {
    if (ALL_ROLES.includes(role as UserRole) && data && typeof data === 'object') {
      if ('app_visibility' in data || 'sections' in data) {
        matrix[role as UserRole] = {
          app_visibility: data.app_visibility ?? {},
          sections: data.sections ?? {},
        };
      }
    }
  }
  return { matrix, tableMissing: false, dbEmpty: false };
}

async function setupTable(): Promise<{ ok: boolean; sql?: string }> {
  const res = await fetch(`${PERM_URL}/setup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${publicAnonKey}` },
  });
  const json = await res.json();
  if (res.ok && json?.success) return { ok: true };
  return { ok: false, sql: json?.sql };
}

async function saveMatrix(matrix: Matrix, updatedBy: string): Promise<void> {
  const res = await fetch(PERM_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissionMatrix: matrix, updatedBy }),
  });
  if (!res.ok) throw new Error('Failed to save');
  invalidatePermissionsCache();
}

// ── Toggle Component ───────────────────────────────────────────────────────

function Toggle({ value, onChange, size = 'sm' }: {
  value: boolean; onChange: (v: boolean) => void; size?: 'sm' | 'xs';
}) {
  const h = size === 'xs' ? 'h-3.5 w-6' : 'h-4 w-7';
  const dot = size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3';
  const translate = size === 'xs' ? 'translate-x-2.5' : 'translate-x-3.5';
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex ${h} items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${value ? 'bg-emerald-500' : 'bg-muted-foreground/25'}`}
    >
      <span className={`inline-block ${dot} rounded-full bg-white shadow transform transition-transform ${value ? translate : 'translate-x-0.5'}`} />
    </button>
  );
}

// ── Tristate for column header ─────────────────────────────────────────────

function TriState({ state, onChange }: { state: 'all' | 'none' | 'mixed'; onChange: (v: boolean) => void }) {
  if (state === 'all') return <button onClick={() => onChange(false)} className="w-4 h-4 flex items-center justify-center text-primary"><CheckSquare size={14} /></button>;
  if (state === 'none') return <button onClick={() => onChange(true)} className="w-4 h-4 flex items-center justify-center text-muted-foreground"><Square size={14} /></button>;
  return <button onClick={() => onChange(true)} className="w-4 h-4 flex items-center justify-center text-amber-500"><Minus size={14} /></button>;
}

// ── App Visibility Panel ───────────────────────────────────────────────────

function AppVisibilityPanel({ matrix, onChange }: {
  matrix: Matrix; onChange: (m: Matrix) => void;
}) {
  const [search, setSearch] = useState('');
  const apps = APP_REGISTRY.filter(a =>
    !search || a.label.toLowerCase().includes(search.toLowerCase())
  );

  const setAppVisible = (role: UserRole, appId: string, val: boolean) => {
    onChange({ ...matrix, [role]: { ...matrix[role], app_visibility: { ...matrix[role].app_visibility, [appId]: val } } });
  };

  const setAllForRole = (role: UserRole, val: boolean) => {
    const vis: Record<string, boolean> = {};
    APP_REGISTRY.forEach(a => { vis[a.appId] = val; });
    onChange({ ...matrix, [role]: { ...matrix[role], app_visibility: vis } });
  };

  const roleState = (role: UserRole): 'all' | 'none' | 'mixed' => {
    const vals = APP_REGISTRY.map(a => matrix[role].app_visibility[a.appId] ?? false);
    if (vals.every(Boolean)) return 'all';
    if (vals.every(v => !v)) return 'none';
    return 'mixed';
  };

  return (
    <div className="flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-border">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter apps…"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-auto flex-1">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-muted/60 backdrop-blur z-10">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs w-52">Application</th>
              {ALL_ROLES.map(role => (
                <th key={role} className="px-3 py-2.5 text-center min-w-[90px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`text-xs font-semibold ${ROLE_META[role].color}`}>{ROLE_META[role].label}</span>
                    <TriState state={roleState(role)} onChange={v => setAllForRole(role, v)} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {apps.map(app => (
              <tr key={app.appId} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-foreground text-xs leading-tight">{app.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 capitalize">{app.category}</div>
                </td>
                {ALL_ROLES.map(role => {
                  const isAdmin = role === 'admin';
                  const val = isAdmin ? true : (matrix[role].app_visibility[app.appId] ?? false);
                  return (
                    <td key={role} className="px-3 py-2.5 text-center">
                      {isAdmin
                        ? <span title="Admin always has access"><Lock size={12} className="mx-auto text-muted-foreground/50" /></span>
                        : <Toggle value={val} onChange={v => setAppVisible(role, app.appId, v)} size="xs" />
                      }
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Section Permissions Panel ─────────────────────────────────────────────

function SectionPermissionsPanel({ matrix, onChange }: {
  matrix: Matrix; onChange: (m: Matrix) => void;
}) {
  const [selectedRole, setSelectedRole] = useState<UserRole>('employee');
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set(['dashboard', 'directory']));
  const [search, setSearch] = useState('');

  const setSectionVal = (appId: string, sectionId: string, val: boolean) => {
    onChange({
      ...matrix,
      [selectedRole]: {
        ...matrix[selectedRole],
        sections: {
          ...matrix[selectedRole].sections,
          [appId]: { ...matrix[selectedRole].sections[appId], [sectionId]: val },
        },
      },
    });
  };

  const setAllSectionsForApp = (appId: string, val: boolean) => {
    const cfg = SECTION_CONFIG.find(a => a.appId === appId);
    if (!cfg) return;
    const sections: Record<string, boolean> = {};
    cfg.sections.forEach(s => { sections[s.id] = val; });
    onChange({
      ...matrix,
      [selectedRole]: {
        ...matrix[selectedRole],
        sections: { ...matrix[selectedRole].sections, [appId]: sections },
      },
    });
  };

  const toggleApp = (appId: string) => {
    setExpandedApps(prev => { const s = new Set(prev); s.has(appId) ? s.delete(appId) : s.add(appId); return s; });
  };

  const blob = matrix[selectedRole];
  const filteredApps = SECTION_CONFIG.filter(a =>
    !search || a.label.toLowerCase().includes(search.toLowerCase()) ||
    a.sections.some(s => s.label.toLowerCase().includes(search.toLowerCase()))
  );

  const appSectionState = (appId: string): 'all' | 'none' | 'mixed' => {
    const cfg = SECTION_CONFIG.find(a => a.appId === appId);
    if (!cfg) return 'none';
    const vals = cfg.sections.map(s => blob.sections[appId]?.[s.id] ?? false);
    if (vals.every(Boolean)) return 'all';
    if (vals.every(v => !v)) return 'none';
    return 'mixed';
  };

  return (
    <div className="flex min-h-0 h-full gap-0">
      {/* Role sidebar */}
      <div className="w-36 shrink-0 border-r border-border bg-muted/20 overflow-y-auto">
        <div className="px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Role</div>
        {ALL_ROLES.map(role => (
          <button
            key={role}
            onClick={() => setSelectedRole(role)}
            className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
              selectedRole === role
                ? `${ROLE_META[role].bg} ${ROLE_META[role].color} border-r-2 border-primary`
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            {ROLE_META[role].label}
          </button>
        ))}
      </div>

      {/* Section editor */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="px-4 py-2.5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Filter sections…"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <span className={`text-xs font-semibold ${ROLE_META[selectedRole].color}`}>{ROLE_META[selectedRole].label}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {filteredApps.map(app => {
            const expanded = expandedApps.has(app.appId) || !!search;
            const appVisible = selectedRole === 'admin' ? true : (blob.app_visibility[app.appId] ?? false);
            const state = appSectionState(app.appId);
            return (
              <div key={app.appId}>
                {/* App header row */}
                <div
                  className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors ${!appVisible ? 'opacity-50' : ''}`}
                  onClick={() => toggleApp(app.appId)}
                >
                  {expanded ? <ChevronDown size={13} className="text-muted-foreground shrink-0" /> : <ChevronRight size={13} className="text-muted-foreground shrink-0" />}
                  <span className="text-xs font-semibold text-foreground flex-1">{app.label}</span>
                  {!appVisible && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">App hidden</span>
                  )}
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-[10px] text-muted-foreground">
                      {state === 'all' ? 'All on' : state === 'none' ? 'All off' : 'Partial'}
                    </span>
                    <TriState state={state} onChange={v => setAllSectionsForApp(app.appId, v)} />
                  </div>
                </div>

                {/* Section rows */}
                {expanded && (
                  <div className="bg-muted/10 divide-y divide-border/50">
                    {app.sections.map(section => {
                      const val = selectedRole === 'admin' ? true : (blob.sections[app.appId]?.[section.id] ?? false);
                      return (
                        <div key={section.id} className="flex items-center gap-3 px-8 py-2 hover:bg-muted/20 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-foreground font-medium">{section.label}</div>
                            <div className="text-[10px] text-muted-foreground">{section.description}</div>
                          </div>
                          {selectedRole === 'admin'
                            ? <Lock size={11} className="text-muted-foreground/50 shrink-0" />
                            : <Toggle value={val} onChange={v => setSectionVal(app.appId, section.id, v)} size="xs" />
                          }
                          <span className={`text-[10px] w-8 text-right font-medium ${val ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                            {val ? 'On' : 'Off'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Audit Log Panel ────────────────────────────────────────────────────────

function AuditPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${PERM_URL}/audit-log`, { headers: { Authorization: `Bearer ${publicAnonKey}` } })
      .then(r => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
      })
      .then(j => setLogs(j.data ?? j.logs ?? (Array.isArray(j) ? j : [])))
      .catch(err => setError(err?.message ?? 'Failed to load audit log'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground text-sm"><Loader2 size={18} className="animate-spin mr-2" />Loading…</div>;
  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <AlertCircle size={32} className="text-red-400 opacity-60" />
      <p className="text-sm text-muted-foreground">Failed to load audit log</p>
      <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-1.5 rounded">{error}</p>
    </div>
  );
  if (!logs.length) return (
    <div className="flex flex-col items-center justify-center py-20 gap-2">
      <History size={32} className="text-muted-foreground opacity-40" />
      <p className="text-sm text-muted-foreground">No audit records yet</p>
    </div>
  );

  return (
    <div className="overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted/60 backdrop-blur">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Time</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Changed By</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Target</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {logs.map((log, i) => (
            <tr key={i} className="hover:bg-muted/30">
              <td className="px-4 py-2 text-muted-foreground">
                {new Date(log.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className="px-4 py-2 font-medium text-foreground">{log.changed_by ?? 'system'}</td>
              <td className="px-4 py-2">{log.target_user ?? '—'}</td>
              <td className="px-4 py-2 capitalize text-muted-foreground">{log.action?.replace(/_/g, ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function PermissionManagerSuperEnhanced() {
  const { currentUser } = useUser();
  const [matrix, setMatrix] = useState<Matrix>(emptyMatrix());
  const [savedMatrix, setSavedMatrix] = useState<Matrix>(emptyMatrix());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [tab, setTab] = useState<PanelTab>('apps');
  const [hasChanges, setHasChanges] = useState(false);
  const [pendingDefaultsReset, setPendingDefaultsReset] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [dbEmpty, setDbEmpty] = useState(false);
  const [setupSql, setSetupSql] = useState<string | undefined>();
  const [settingUp, setSettingUp] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { matrix: m, tableMissing: missing, dbEmpty: empty } = await loadMatrix();
      setTableMissing(missing);
      setDbEmpty(empty);
      setMatrix(m);
      setSavedMatrix(m);
      setHasChanges(false);
    } catch {
      toast.error('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSetup = async () => {
    setSettingUp(true);
    try {
      const result = await setupTable();
      if (result.ok) {
        toast.success('Database table created successfully');
        setTableMissing(false);
        setSetupSql(undefined);
        await load();
      } else {
        setSetupSql(result.sql);
        toast.error('Auto-creation failed — run the SQL shown below in Supabase');
      }
    } finally {
      setSettingUp(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  const handleChange = (m: Matrix) => {
    setMatrix(m);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveMatrix(matrix, currentUser?.email ?? 'admin');
      setSavedMatrix(matrix);
      setDbEmpty(false);
      setHasChanges(false);
      setPendingDefaultsReset(false);
      toast.success('Permissions saved and applied');
    } catch {
      toast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  // Seeds the compiled defaults into the DB. Only intended for first-time setup;
  // after seeding, all further changes are made through the editor and saved to DB.
  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const defaults = defaultsMatrix();
      await saveMatrix(defaults, currentUser?.email ?? 'system');
      setMatrix(defaults);
      setSavedMatrix(defaults);
      setDbEmpty(false);
      setHasChanges(false);
      toast.success('Default permissions seeded to database');
    } catch {
      toast.error('Failed to seed default permissions');
    } finally {
      setSeeding(false);
    }
  };

  const handleRevertToSaved = () => {
    setMatrix(savedMatrix);
    setHasChanges(false);
    setPendingDefaultsReset(false);
  };

  const TABS: { id: PanelTab; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'apps', label: 'App Visibility', icon: <LayoutGrid size={14} />, desc: 'Which apps each role can see in the launchpad' },
    { id: 'sections', label: 'Section Permissions', icon: <List size={14} />, desc: 'Which features and sections each role can access within apps' },
    { id: 'audit', label: 'Audit Log', icon: <History size={14} />, desc: 'History of permission changes' },
  ];

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
    <div className="flex flex-col flex-1 max-w-7xl w-full mx-auto min-h-0">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">Permission Manager</h1>
              <p className="text-xs text-muted-foreground">Role-based access control — changes persist to the database</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle size={12} />
                {pendingDefaultsReset ? 'Defaults loaded — click Save & Apply to persist' : 'Unsaved changes'}
              </span>
            )}
            <button onClick={load} disabled={loading} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground" title="Reload from DB">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => { setMatrix(defaultsMatrix()); setHasChanges(true); setPendingDefaultsReset(true); }}
              title="Fills the editor with built-in default values. Nothing is saved until you click Save & Apply."
              className="px-3 py-1.5 text-xs border border-amber-400 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw size={12} /> Reset to Defaults
            </button>
            {hasChanges && (
              <button onClick={handleRevertToSaved} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors">
                Revert
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-4 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save & Apply
            </button>
          </div>
        </div>

        {/* Role legend */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {ALL_ROLES.map(role => (
            <span key={role} className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${ROLE_META[role].bg} ${ROLE_META[role].color}`}>
              {ROLE_META[role].label}
            </span>
          ))}
        </div>
      </div>

      {/* Table-missing banner */}
      {tableMissing && (
        <div className="shrink-0 px-6 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Database table not found</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              The <code className="font-mono">role_permissions</code> table does not exist yet. Click "Create Table" to auto-create it, or run the SQL migration manually in Supabase.
            </p>
            {setupSql && (
              <pre className="mt-2 text-xs bg-amber-100 dark:bg-amber-900/40 rounded p-2 overflow-x-auto font-mono text-amber-900 dark:text-amber-200">{setupSql}</pre>
            )}
          </div>
          <button
            onClick={handleSetup}
            disabled={settingUp}
            className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {settingUp ? 'Creating…' : 'Create Table'}
          </button>
        </div>
      )}

      {/* DB-empty banner — table exists but no permissions seeded yet */}
      {!tableMissing && dbEmpty && (
        <div className="shrink-0 px-6 py-3 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800 flex items-start gap-3">
          <Info size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">No permissions in database</p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
              The <code className="font-mono">role_permissions</code> table is empty. Seed the compiled defaults now, or run{' '}
              <code className="font-mono">npm run seed:permissions</code> from the terminal.
              All roles currently have <strong>no access</strong> until permissions are seeded.
            </p>
          </div>
          <button
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {seeding ? <><Loader2 size={12} className="animate-spin" /> Seeding…</> : 'Seed Defaults'}
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="shrink-0 border-b border-border bg-card px-6">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Info bar */}
      <div className="shrink-0 px-6 py-2 bg-muted/30 border-b border-border text-xs text-muted-foreground flex items-center gap-1.5">
        <Info size={12} />
        {TABS.find(t_ => t_.id === tab)?.desc}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : tab === 'apps' ? (
          <AppVisibilityPanel matrix={matrix} onChange={handleChange} />
        ) : tab === 'sections' ? (
          <SectionPermissionsPanel matrix={matrix} onChange={handleChange} />
        ) : (
          <AuditPanel />
        )}
      </div>
    </div>
    </div>
  );
}

export { PermissionManagerSuperEnhanced as PermissionManager };
