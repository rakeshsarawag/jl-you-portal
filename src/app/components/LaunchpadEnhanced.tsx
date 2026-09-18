/**
 * Launchpad — Persona-specific home screen
 * Standards: RBAC, i18n, constants, data isolation, error handling, loading states
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  User, Clock, CheckCircle2, AlertCircle,
  TrendingUp, Users, UserPlus, GraduationCap, Laptop, FileText,
  DollarSign, Folder, Target, Library, Shield, Settings, Zap,
  Brain, BarChart3, MessageSquare, HardDrive, Share2, Database,
  ChevronRight, Calendar, CheckSquare, ArrowUpRight, Star, Inbox,
  Briefcase, Award, BookOpen, LayoutDashboard, LucideIcon,
  GitBranch, UsersRound, Lock, Cpu, Bug, Globe,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useUser } from '../context/UserContext';
import { useEmployeeDashboard } from '../hooks/useEmployeeDashboard';
import { API_BASE, publicAnonKey, safeJson } from '../utils/constants';
import { APP_VERSION } from '../../constants/global';
import { APP_BY_PATH } from '../../constants/appRegistry';
import { usePermissions } from '../hooks/usePermissions';
import { t } from '../../i18n/index';

// ── App tile definitions ───────────────────────────────────────────────────

interface AppTile {
  id: ApplicationId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  path: string;
  color: string;
  iconBg: string;
  category: 'people' | 'operations' | 'finance' | 'intelligence' | 'admin';
}

// Tile config — order: Dashboard → Directory → Recruitment → Onboarding → Comms → Collaboration →
//   Projects → Defect Tracker → IT Services → Assets → Workflow → Security →
//   Performance → Training → OKR → Finance → Marketing → Intelligence → Admin
const TILE_CONFIG = [
  { id: 'dashboard',           titleKey: 'tile.dashboard',          subKey: 'tile.sub.dashboard',          icon: LayoutDashboard, path: '/dashboard',           color: 'text-blue-600',    iconBg: 'bg-blue-50',    category: 'people' },
  { id: 'directory',           titleKey: 'tile.directory',          subKey: 'tile.sub.directory',          icon: Users,           path: '/directory',           color: 'text-indigo-600',  iconBg: 'bg-indigo-50',  category: 'people' },
  { id: 'recruitment',         titleKey: 'tile.recruitment',        subKey: 'tile.sub.recruitment',        icon: UserPlus,        path: '/recruitment',         color: 'text-violet-600',  iconBg: 'bg-violet-50',  category: 'people' },
  { id: 'onboarding',          titleKey: 'tile.onboarding',         subKey: 'tile.sub.onboarding',         icon: Star,            path: '/onboarding',          color: 'text-pink-600',    iconBg: 'bg-pink-50',    category: 'people' },
  { id: 'communications',      titleKey: 'tile.communications',     subKey: 'tile.sub.communications',     icon: MessageSquare,   path: '/communications',      color: 'text-blue-500',    iconBg: 'bg-blue-50',    category: 'operations' },
  { id: 'collaboration-hub',   titleKey: 'tile.collaboration',      subKey: 'tile.sub.collaboration',      icon: UsersRound,      path: '/collaboration-hub',   color: 'text-sky-600',     iconBg: 'bg-sky-50',     category: 'operations' },
  { id: 'projects',            titleKey: 'tile.projects',           subKey: 'tile.sub.projects',           icon: Folder,          path: '/projects',            color: 'text-lime-600',    iconBg: 'bg-lime-50',    category: 'operations' },
  { id: 'defect-tracker',      titleKey: 'tile.defectTracker',      subKey: 'tile.sub.defectTracker',      icon: Bug,             path: '/defect-tracker',      color: 'text-red-600',     iconBg: 'bg-red-50',     category: 'operations' },
  { id: 'it-services',         titleKey: 'tile.itServices',         subKey: 'tile.sub.itServices',         icon: Laptop,          path: '/it-services',         color: 'text-cyan-600',    iconBg: 'bg-cyan-50',    category: 'operations' },
  { id: 'assets',              titleKey: 'tile.assets',             subKey: 'tile.sub.assets',             icon: HardDrive,       path: '/assets',              color: 'text-gray-600',    iconBg: 'bg-gray-50',    category: 'operations' },
  { id: 'workflow-dashboard',  titleKey: 'tile.workflow',           subKey: 'tile.sub.workflow',           icon: GitBranch,       path: '/workflow-dashboard',  color: 'text-amber-600',   iconBg: 'bg-amber-50',   category: 'intelligence' },
  { id: 'security-compliance', titleKey: 'tile.security',           subKey: 'tile.sub.security',           icon: Lock,            path: '/security-compliance', color: 'text-rose-600',    iconBg: 'bg-rose-50',    category: 'admin' },
  { id: 'performance',         titleKey: 'tile.performance',        subKey: 'tile.sub.performance',        icon: TrendingUp,      path: '/performance',         color: 'text-orange-600',  iconBg: 'bg-orange-50',  category: 'people' },
  { id: 'training',            titleKey: 'tile.training',           subKey: 'tile.sub.training',           icon: GraduationCap,   path: '/training',            color: 'text-teal-600',    iconBg: 'bg-teal-50',    category: 'people' },
  { id: 'okr',                 titleKey: 'tile.okr',                subKey: 'tile.sub.okr',                icon: Target,          path: '/okr',                 color: 'text-yellow-600',  iconBg: 'bg-yellow-50',  category: 'operations' },
  { id: 'invoices',            titleKey: 'tile.invoices',           subKey: 'tile.sub.invoices',           icon: FileText,        path: '/invoices',            color: 'text-green-600',   iconBg: 'bg-green-50',   category: 'finance' },
  { id: 'payroll',             titleKey: 'tile.payroll',            subKey: 'tile.sub.payroll',            icon: DollarSign,      path: '/payroll',             color: 'text-green-700',   iconBg: 'bg-green-50',   category: 'finance' },
  { id: 'linkedin',            titleKey: 'tile.linkedin',           subKey: 'tile.sub.linkedin',           icon: Share2,          path: '/linkedin',            color: 'text-blue-700',    iconBg: 'bg-blue-50',    category: 'operations' },
  { id: 'executive-dashboard', titleKey: 'tile.executiveDashboard', subKey: 'tile.sub.executiveDashboard', icon: BarChart3,       path: '/executive-dashboard', color: 'text-purple-600',  iconBg: 'bg-purple-50',  category: 'intelligence' },
  { id: 'user-management',     titleKey: 'tile.userManagement',     subKey: 'tile.sub.userManagement',     icon: Shield,          path: '/user-management',     color: 'text-red-600',     iconBg: 'bg-red-50',     category: 'admin' },
  { id: 'permissions',         titleKey: 'tile.permissions',        subKey: 'tile.sub.permissions',        icon: Settings,        path: '/permissions',         color: 'text-red-700',     iconBg: 'bg-red-50',     category: 'admin' },
  { id: 'master-data',         titleKey: 'tile.masterData',         subKey: 'tile.sub.masterData',         icon: Database,        path: '/master-data',         color: 'text-slate-600',   iconBg: 'bg-slate-50',   category: 'admin' },
  { id: 'advanced-features',   titleKey: 'tile.advancedFeatures',   subKey: 'tile.sub.advancedFeatures',   icon: Zap,             path: '/advanced-features',   color: 'text-fuchsia-600', iconBg: 'bg-fuchsia-50', category: 'admin' },
  { id: 'documentation',       titleKey: 'tile.documentation',      subKey: 'tile.sub.documentation',      icon: BookOpen,        path: '/documentation',       color: 'text-sky-600',     iconBg: 'bg-sky-50',     category: 'admin' },
] as const;

// ── Quick action definitions per role ──────────────────────────────────────

// Quick-action config — label keys resolved at render time
const QA_CONFIG: Record<string, { labelKey: string; path: string; icon: LucideIcon; variant?: 'primary' | 'secondary' }[]> = {
  employee: [
    { labelKey: 'qa.myDashboard',    path: '/dashboard',   icon: LayoutDashboard, variant: 'primary' },
    { labelKey: 'qa.applyLeave',     path: '/dashboard',   icon: Calendar,        variant: 'secondary' },
    { labelKey: 'qa.raiseTicket',    path: '/it-services', icon: Laptop,          variant: 'secondary' },
    { labelKey: 'qa.browseTraining', path: '/training',    icon: GraduationCap,   variant: 'secondary' },
  ],
  hr: [
    { labelKey: 'qa.newRecruitment',    path: '/recruitment', icon: UserPlus,   variant: 'primary' },
    { labelKey: 'qa.onboarding',        path: '/onboarding',  icon: Star,       variant: 'secondary' },
    { labelKey: 'qa.employeeDirectory', path: '/directory',   icon: Users,      variant: 'secondary' },
    { labelKey: 'qa.payroll',           path: '/payroll',     icon: DollarSign, variant: 'secondary' },
  ],
  manager: [
    { labelKey: 'qa.teamPerformance', path: '/performance', icon: TrendingUp,  variant: 'primary' },
    { labelKey: 'qa.okrTracking',     path: '/okr',         icon: Target,      variant: 'secondary' },
    { labelKey: 'qa.projects',        path: '/projects',    icon: Folder,      variant: 'secondary' },
    { labelKey: 'qa.training',        path: '/training',    icon: GraduationCap, variant: 'secondary' },
  ],
  finance: [
    { labelKey: 'qa.newInvoice',  path: '/invoices',           icon: FileText,  variant: 'primary' },
    { labelKey: 'qa.payrollRun',  path: '/payroll',            icon: DollarSign,variant: 'secondary' },
    { labelKey: 'qa.dashboard',   path: '/executive-dashboard',icon: BarChart3, variant: 'secondary' },
  ],
  admin: [
    { labelKey: 'qa.userManagement', path: '/user-management',    icon: Shield,    variant: 'primary' },
    { labelKey: 'qa.masterData',     path: '/master-data',         icon: Database,  variant: 'secondary' },
    { labelKey: 'qa.permissions',    path: '/permissions',         icon: Settings,  variant: 'secondary' },
    { labelKey: 'qa.analytics',      path: '/executive-dashboard', icon: BarChart3, variant: 'secondary' },
  ],
  it: [
    { labelKey: 'qa.itTickets',      path: '/it-services', icon: Laptop,    variant: 'primary' },
    { labelKey: 'qa.assetInventory', path: '/assets',      icon: HardDrive, variant: 'secondary' },
  ],
  marketing: [
    { labelKey: 'qa.linkedInPosts',  path: '/linkedin',       icon: Share2,        variant: 'primary' },
    { labelKey: 'qa.communications', path: '/communications', icon: MessageSquare, variant: 'secondary' },
  ],
};

// ── useLatestStats hook ────────────────────────────────────────────────────

type StatKey =
  | 'it_open_tickets'
  | 'active_recruitments'
  | 'onboarding_in_progress'
  | 'active_okrs'
  | 'open_projects'
  | 'outstanding_invoices_amount'
  | 'overdue_invoices'
  | 'active_users'
  | 'system_version';

async function fetchStat(url: string, transform: (data: any) => number | string): Promise<number | string> {
  const res = await fetch(url, { cache: 'no-store', headers: { Authorization: `Bearer ${publicAnonKey}` } });
  if (!res.ok) throw new Error('fetch error');
  const data = await safeJson(res);
  return transform(data);
}

function useLatestStats(keys: StatKey[]) {
  const [stats, setStats] = useState<Record<string, number | string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchers: Record<StatKey, () => Promise<number | string>> = {
      it_open_tickets: () =>
        fetchStat(`${API_BASE}/it-services/stats`, d => {
          const open = d?.data?.openTickets ?? d?.openTickets ?? 0;
          const inProg = d?.data?.inProgressTickets ?? d?.inProgressTickets ?? 0;
          const total = Number(open) + Number(inProg);
          return total;
        }),
      active_recruitments: () =>
        fetchStat(`${API_BASE}/recruitment/candidates`, d =>
          Array.isArray(d) ? d.filter((c: any) => c.stage !== 'Hired' && c.stage !== 'Rejected').length : '—'),
      onboarding_in_progress: () =>
        fetchStat(`${API_BASE}/onboarding`, d =>
          Array.isArray(d) ? d.filter((o: any) => o.status !== 'Completed').length : '—'),
      active_okrs: () =>
        fetchStat(`${API_BASE}/okr`, d => Array.isArray(d) ? d.length : (d?.total ?? '—')),
      open_projects: () =>
        fetchStat(`${API_BASE}/projects`, d =>
          Array.isArray(d) ? d.filter((p: any) => p.status === 'Active').length : '—'),
      outstanding_invoices_amount: () =>
        fetchStat(`${API_BASE}/invoices`, d => {
          if (!Array.isArray(d)) return '—';
          const total = d
            .filter((inv: any) => inv.status === 'Sent' || inv.status === 'Draft')
            .reduce((sum: number, inv: any) => sum + (parseFloat(inv.amount) || 0), 0);
          return total >= 1000 ? `$${(total / 1000).toFixed(1)}k` : `$${total.toFixed(0)}`;
        }),
      overdue_invoices: () =>
        fetchStat(`${API_BASE}/invoices`, d => {
          if (!Array.isArray(d)) return '—';
          const today = new Date().toISOString().slice(0, 10);
          return d.filter((inv: any) =>
            inv.due_date && inv.due_date < today && inv.status !== 'Paid' && inv.status !== 'Cancelled'
          ).length;
        }),
      active_users: () =>
        fetchStat(`${API_BASE}/users`, d => {
          const arr = Array.isArray(d) ? d : (d?.users ?? []);
          return arr.filter((u: any) => u.status === 'active' || u.is_active === true || u.active === true).length;
        }),
      system_version: () =>
        fetchStat(`${API_BASE}/health`, d => d?.version ?? APP_VERSION),
    };

    const selected = keys.filter(k => k in fetchers);
    Promise.allSettled(selected.map(k => fetchers[k]().then(val => ({ k, val })))).then(results => {
      const map: Record<string, number | string> = {};
      results.forEach((r, i) => {
        map[selected[i]] = r.status === 'fulfilled' ? r.value.val : '—';
      });
      setStats(map);
      setLoading(false);
    });
  }, []);

  return { stats, loading };
}

// ── Stat tile helper ───────────────────────────────────────────────────────

function StatTile({ label, value, icon: Icon, color, loading }: {
  label: string; value: string | number; icon: LucideIcon; color: string; loading?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        {loading ? (
          <div className="h-5 w-12 bg-muted animate-pulse rounded mt-0.5" />
        ) : (
          <p className="text-lg font-semibold text-foreground">{value}</p>
        )}
      </div>
    </div>
  );
}

// ── Section heading ────────────────────────────────────────────────────────

function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
          {action} <ChevronRight size={12} />
        </button>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface LaunchpadProps {
  accessToken: string;
  onLogout: () => void;
}

export function Launchpad({ accessToken, onLogout }: LaunchpadProps) {
  const navigate = useNavigate();
  const { currentUser, loading: userLoading } = useUser();
  const [search, setSearch] = useState('');
  const [greeting, setGreeting] = useState(() => {
    const h = new Date().getHours();
    return h < 12 ? t('greeting.morning') : h < 17 ? t('greeting.afternoon') : t('greeting.evening');
  });

  // Sync search from the global header input
  useEffect(() => {
    const handler = (e: Event) => setSearch((e as CustomEvent<string>).detail);
    window.addEventListener('jl-search', handler);
    return () => window.removeEventListener('jl-search', handler);
  }, []);

  const primaryRole = currentUser?.primaryRole ?? 'employee';
  const userId = currentUser?.id ?? '';
  const userName = currentUser?.name ?? '';

  // Live dashboard data for employee widgets
  const dash = useEmployeeDashboard(userId, userName);

  // Set greeting based on time of day
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? t('greeting.morning') : h < 17 ? t('greeting.afternoon') : t('greeting.evening'));
  }, []);

  // Load pending leaves for managers
  useEffect(() => {
    const roles = currentUser?.roles ?? [];
    if (roles.some(r => ['manager', 'hr', 'admin'].includes(r))) {
      dash.loadPendingLeaves();
    }
  }, [currentUser?.roles?.join(',')]);

  const userRoles = currentUser?.roles ?? ['employee'];
  const { canSeeApp, matrixLoaded } = usePermissions(userRoles, currentUser?.permissionOverrides ?? []);

  // Translate tile titles and subtitles at render time (re-evaluated on each remount = locale change)
  const ALL_TILES: AppTile[] = TILE_CONFIG.map(cfg => ({
    id: cfg.id as any,
    title: t(cfg.titleKey),
    subtitle: t(cfg.subKey),
    icon: cfg.icon,
    path: cfg.path,
    color: cfg.color,
    iconBg: cfg.iconBg,
    category: cfg.category,
  }));

  const accessibleTiles = ALL_TILES.filter(tile => {
    const app = APP_BY_PATH[tile.path];
    if (!app) return false;
    if (userRoles.includes('admin')) return true;
    // Show nothing until DB matrix is loaded — prevents flash of wrong tiles
    if (!matrixLoaded) return false;
    return canSeeApp(app.appId);
  });

  const filteredTiles = search
    ? accessibleTiles.filter(tile =>
        tile.title.toLowerCase().includes(search.toLowerCase()) ||
        tile.subtitle.toLowerCase().includes(search.toLowerCase())
      )
    : accessibleTiles;

  // Translate quick action labels at render time
  const qaConfig = QA_CONFIG[primaryRole] ?? QA_CONFIG.employee;
  const quickActions = qaConfig.map(qa => ({ ...qa, label: t(qa.labelKey) }));

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ── Persona widgets ──────────────────────────────────────────────────────

  const renderPersonaWidgets = () => {
    switch (primaryRole) {
      case 'employee': return <EmployeeWidgets dash={dash} navigate={navigate} />;
      case 'hr': return <HRWidgets dash={dash} navigate={navigate} />;
      case 'manager': return <ManagerWidgets dash={dash} navigate={navigate} userId={userId} />;
      case 'finance': return <FinanceWidgets navigate={navigate} />;
      case 'admin': return <AdminWidgets dash={dash} navigate={navigate} userId={userId} />;
      default: return <EmployeeWidgets dash={dash} navigate={navigate} />;
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* ── Hero greeting ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {greeting}, {userName || 'there'} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => navigate(action.path)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  action.variant === 'primary'
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-foreground hover:bg-muted/80 border border-border'
                }`}
              >
                <action.icon size={13} />
                {action.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Persona widgets ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
        >
          {renderPersonaWidgets()}
        </motion.div>

        {/* ── Celebrations ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.09 }}
        >
          <CelebrationsWidget />
        </motion.div>

        {/* ── App launcher ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <SectionHeading title={search ? `Results for "${search}"` : t('launchpad.allApplications')} />
          {filteredTiles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">{t('launchpad.noAppsMatch')}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredTiles.map(tile => (
                <button
                  key={tile.id}
                  onClick={() => navigate(tile.path)}
                  className="group bg-card border border-border rounded-xl p-4 text-left flex flex-col gap-2.5 hover:border-primary/40 hover:shadow-sm transition-all duration-200"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tile.iconBg}`}>
                    <tile.icon size={18} className={tile.color} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-tight">{tile.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{tile.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

// ── Employee Widgets ───────────────────────────────────────────────────────

function EmployeeWidgets({ dash, navigate }: { dash: ReturnType<typeof useEmployeeDashboard>; navigate: Function }) {
  const { stats, todayAttendance, isCheckedIn, leaveBalance, upcomingTasks, loading } = dash;

  return (
    <div className="space-y-6">
      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Present Days" value={stats.presentDays} icon={CheckCircle2} color="bg-green-500" loading={loading} />
        <StatTile label="Leave Balance" value={Object.values(leaveBalance).reduce((a, b) => a + b, 0)} icon={Calendar} color="bg-blue-500" loading={loading} />
        <StatTile label="Tasks Pending" value={stats.tasksPending} icon={CheckSquare} color="bg-orange-500" loading={loading} />
        <StatTile label="Hours This Month" value={`${stats.hoursThisMonth.toFixed(0)}h`} icon={Clock} color="bg-purple-500" loading={loading} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Attendance card */}
        <div className="bg-card border border-border rounded-xl p-4">
          <SectionHeading title="Today's Attendance" />
          {loading ? (
            <div className="h-20 bg-muted animate-pulse rounded-lg" />
          ) : todayAttendance ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Check-in</span>
                <span className="font-medium">{todayAttendance.check_in ? new Date(todayAttendance.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Check-out</span>
                <span className="font-medium">{todayAttendance.check_out ? new Date(todayAttendance.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Still in'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${todayAttendance.status === 'Present' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {todayAttendance.status}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not checked in yet today.</p>
          )}
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-3 w-full text-xs font-medium text-primary flex items-center justify-center gap-1 hover:underline"
          >
            Go to Dashboard <ArrowUpRight size={12} />
          </button>
        </div>

        {/* Leave balance */}
        <div className="bg-card border border-border rounded-xl p-4">
          <SectionHeading title="Leave Balance" action="Apply Leave" onAction={() => navigate('/dashboard')} />
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-5 bg-muted animate-pulse rounded" />)}</div>
          ) : (
            <div className="space-y-2">
              {Object.entries(leaveBalance).map(([type, days]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{type}</span>
                  <span className="text-sm font-semibold text-foreground">{days} <span className="text-xs font-normal text-muted-foreground">days</span></span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming tasks */}
        <div className="bg-card border border-border rounded-xl p-4">
          <SectionHeading title="Upcoming Tasks" action="View All" onAction={() => navigate('/dashboard')} />
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}</div>
          ) : upcomingTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming tasks. 🎉</p>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.slice(0, 4).map(task => (
                <div key={task.id} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.priority === 'High' ? 'bg-red-500' : task.priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                  <p className="text-xs text-foreground truncate flex-1">{task.title}</p>
                  {task.due_date && <span className="text-xs text-muted-foreground whitespace-nowrap">{task.due_date}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── HR Widgets ─────────────────────────────────────────────────────────────

function HRWidgets({ dash, navigate }: { dash: ReturnType<typeof useEmployeeDashboard>; navigate: Function }) {
  const pendingCount = dash.pendingLeaves.length;
  const { stats, loading: statsLoading } = useLatestStats(['it_open_tickets', 'active_recruitments', 'onboarding_in_progress']);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Pending Leave Requests" value={pendingCount} icon={Inbox} color="bg-orange-500" loading={dash.loading} />
        <StatTile label="Open IT Tickets" value={stats.it_open_tickets ?? '—'} icon={Laptop} color="bg-cyan-500" loading={statsLoading} />
        <StatTile label="Active Recruitments" value={stats.active_recruitments ?? '—'} icon={UserPlus} color="bg-violet-500" loading={statsLoading} />
        <StatTile label="Onboarding In Progress" value={stats.onboarding_in_progress ?? '—'} icon={Star} color="bg-pink-500" loading={statsLoading} />
      </div>

      {pendingCount > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <SectionHeading title="Pending Leave Approvals" action="View All" onAction={() => navigate('/dashboard')} />
          <div className="divide-y divide-border">
            {dash.pendingLeaves.slice(0, 4).map(leave => (
              <div key={leave.id} className="py-2.5 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{leave.employee_name}</p>
                  <p className="text-xs text-muted-foreground">{leave.leave_type} · {leave.days} day{leave.days !== 1 ? 's' : ''} · {leave.start_date}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => dash.approveLeave(leave.id, 'hr')}
                    className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-md font-medium hover:bg-green-200 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => dash.rejectLeave(leave.id, 'hr')}
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-md font-medium hover:bg-red-200 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Recruitment', path: '/recruitment', icon: UserPlus },
          { label: 'Onboarding', path: '/onboarding', icon: Star },
          { label: 'Directory', path: '/directory', icon: Users },
          { label: 'Payroll', path: '/payroll', icon: DollarSign },
        ].map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 hover:shadow-sm transition-all text-left"
          >
            <item.icon size={18} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{item.label}</span>
            <ChevronRight size={14} className="text-muted-foreground ml-auto" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Manager Widgets ────────────────────────────────────────────────────────

// ── Workflow Activity Widget ───────────────────────────────────────────────

function WorkflowActivityWidget({ userId }: { userId: string }) {
  const [data, setData] = useState({ pending: 0, running: 0 });

  useEffect(() => {
    Promise.allSettled([
      fetch(`${API_BASE}/workflow/approvals/my?user_id=${userId}`, {
        cache: 'no-store', headers: { apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
      }).then(r => safeJson(r)),
      fetch(`${API_BASE}/workflow/stats`, {
        cache: 'no-store', headers: { apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
      }).then(r => safeJson(r)),
    ]).then(([appRes, statsRes]) => {
      setData({
        pending: appRes.status === 'fulfilled' ? (appRes.value?.data?.length ?? 0) : 0,
        running: statsRes.status === 'fulfilled' ? (statsRes.value?.data?.running_instances ?? 0) : 0,
      });
    });
  }, [userId]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-500" /> Workflow Activity
        </h3>
        <a href="/workflow-dashboard" className="text-xs text-blue-600 hover:underline">View all →</a>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-2 bg-amber-50 rounded-lg">
          <div className="text-2xl font-bold text-amber-600">{data.pending}</div>
          <div className="text-xs text-gray-500">Pending Approvals</div>
        </div>
        <div className="text-center p-2 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">{data.running}</div>
          <div className="text-xs text-gray-500">Active Workflows</div>
        </div>
      </div>
      {data.pending > 0 && (
        <a href="/workflow-dashboard" className="mt-3 block text-center text-sm py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600">
          Review {data.pending} Pending {data.pending === 1 ? 'Approval' : 'Approvals'}
        </a>
      )}
    </div>
  );
}

function ManagerWidgets({ dash, navigate, userId }: { dash: ReturnType<typeof useEmployeeDashboard>; navigate: Function; userId: string }) {
  const { stats, loading: statsLoading } = useLatestStats(['active_okrs', 'open_projects']);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Leave Approvals Pending" value={dash.pendingLeaves.length} icon={Inbox} color="bg-orange-500" loading={dash.loading} />
        <StatTile label="Active OKRs" value={stats.active_okrs ?? '—'} icon={Target} color="bg-yellow-500" loading={statsLoading} />
        <StatTile label="Open Projects" value={stats.open_projects ?? '—'} icon={Folder} color="bg-lime-500" loading={statsLoading} />
        <StatTile label="Team Training %" value="—" icon={GraduationCap} color="bg-teal-500" />
      </div>

      <WorkflowActivityWidget userId={userId} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Performance', path: '/performance', icon: TrendingUp },
          { label: 'OKR', path: '/okr', icon: Target },
          { label: 'Projects', path: '/projects', icon: Folder },
          { label: 'Training', path: '/training', icon: GraduationCap },
        ].map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 hover:shadow-sm transition-all text-left"
          >
            <item.icon size={18} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{item.label}</span>
            <ChevronRight size={14} className="text-muted-foreground ml-auto" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Finance Widgets ────────────────────────────────────────────────────────

function FinanceWidgets({ navigate }: { navigate: Function }) {
  const { stats, loading: statsLoading } = useLatestStats(['outstanding_invoices_amount', 'overdue_invoices']);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Outstanding Invoices" value={stats.outstanding_invoices_amount ?? '—'} icon={FileText} color="bg-green-500" loading={statsLoading} />
        <StatTile label="Overdue" value={stats.overdue_invoices ?? '—'} icon={AlertCircle} color="bg-red-500" loading={statsLoading} />
        <StatTile label="Next Payroll" value="—" icon={DollarSign} color="bg-blue-500" />
        <StatTile label="Pending Approvals" value="—" icon={Inbox} color="bg-orange-500" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Invoices', path: '/invoices', icon: FileText },
          { label: 'Payroll', path: '/payroll', icon: DollarSign },
        ].map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 transition-all text-left"
          >
            <item.icon size={18} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{item.label}</span>
            <ChevronRight size={14} className="text-muted-foreground ml-auto" />
          </button>
        ))}
      </div>
    </div>
  );
}


// ── World Clock widget ─────────────────────────────────────────────────────

const WORLD_CLOCKS = [
  { label: 'India',  tz: 'Asia/Kolkata',    flag: '🇮🇳' },
  { label: 'Canada', tz: 'America/Toronto', flag: '🇨🇦' },
  { label: 'Europe', tz: 'Europe/London',   flag: '🇬🇧' },
];

function WorldClockTile() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-card border border-border rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 col-span-2 sm:col-span-1">
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center bg-violet-500 flex-shrink-0">
        <Globe size={16} className="text-white" />
      </div>
      <div className="flex flex-1 items-center justify-between sm:justify-around w-full flex-wrap gap-2 sm:gap-0">
        {WORLD_CLOCKS.map(({ label, tz, flag }) => {
          const timeStr = now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
          return (
            <div key={tz} className="flex flex-col items-center gap-0.5 min-w-[3.5rem]">
              <span className="text-sm sm:text-base leading-none">{flag}</span>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium">{label}</span>
              <span className="text-[10px] sm:text-xs font-bold text-foreground font-mono tabular-nums">{timeStr}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Admin Widgets ──────────────────────────────────────────────────────────

function AdminWidgets({ dash, navigate, userId }: { dash: ReturnType<typeof useEmployeeDashboard>; navigate: Function; userId: string }) {
  const { stats, loading: statsLoading } = useLatestStats(['active_users', 'it_open_tickets']);

  useEffect(() => {
    dash.loadPendingLeaves();
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Pending Leave Requests" value={dash.pendingLeaves.length} icon={Inbox} color="bg-orange-500" loading={dash.loading} />
        <StatTile label="Active Users" value={stats.active_users ?? '—'} icon={Users} color="bg-blue-500" loading={statsLoading} />
        <StatTile label="Active IT Tickets" value={stats.it_open_tickets ?? '—'} icon={Laptop} color="bg-cyan-500" loading={statsLoading} />
        <WorldClockTile />
      </div>
      {/* WorldClockTile spans full row on mobile via col-span-2, handled inside the tile */}

      <WorkflowActivityWidget userId={userId} />
    </div>
  );
}

// ── Org Announcements Widget ───────────────────────────────────────────────

interface Announcement {
  id: string | number;
  title: string;
  body?: string;
  content?: string;
  created_at?: string;
  published_at?: string;
  date?: string;
}

// ── Celebrations Widget ────────────────────────────────────────────────────────

interface Employee {
  id: string;
  name?: string;
  full_name?: string;
  date_of_birth?: string;
  joined_at?: string;
  hire_date?: string;
  start_date?: string;
  department?: string;
  avatar?: string;
}

interface Celebration {
  id: string;
  name: string;
  type: 'birthday' | 'anniversary';
  daysFromToday: number;
  yearsAtCompany?: number;
}

function getDaysFromToday(dateStr: string): number | null {
  // dateStr can be a full ISO date like "1990-06-15" or "MM-DD"
  const parts = dateStr.split(/[-T]/);
  let month: number;
  let day: number;
  if (parts.length >= 3) {
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else if (parts.length === 2) {
    month = parseInt(parts[0], 10);
    day = parseInt(parts[1], 10);
  } else {
    return null;
  }
  if (isNaN(month) || isNaN(day)) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisYear = today.getFullYear();
  const candidateDate = new Date(thisYear, month - 1, day);
  const diffMs = candidateDate.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function CelebrationsWidget() {
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/directory/employees?limit=200`, {
      cache: 'no-store', headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then(r => safeJson(r))
      .then(data => {
        const list: Employee[] = Array.isArray(data) ? data : (data?.data ?? data?.employees ?? []);
        const today = new Date();
        const currentYear = today.getFullYear();
        const results: Celebration[] = [];

        for (const emp of list) {
          const name = emp.full_name ?? emp.name ?? 'Unknown';
          const dob = emp.date_of_birth;
          const joinDate = emp.joined_at ?? emp.hire_date ?? emp.start_date;

          if (dob) {
            const diff = getDaysFromToday(dob);
            if (diff !== null && diff >= -3 && diff <= 3) {
              results.push({ id: `b-${emp.id}`, name, type: 'birthday', daysFromToday: diff });
            }
          }

          if (joinDate) {
            const diff = getDaysFromToday(joinDate);
            const joinYear = parseInt(joinDate.split(/[-T]/)[0], 10);
            if (!isNaN(joinYear) && joinYear < currentYear && diff !== null && diff >= -3 && diff <= 3) {
              results.push({ id: `a-${emp.id}`, name, type: 'anniversary', daysFromToday: diff, yearsAtCompany: currentYear - joinYear });
            }
          }
        }

        results.sort((a, b) => Math.abs(a.daysFromToday) - Math.abs(b.daysFromToday));
        setCelebrations(results);
      })
      .catch(() => setCelebrations([]))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || celebrations.length === 0) return null;

  const birthdays = celebrations.filter(c => c.type === 'birthday');
  const anniversaries = celebrations.filter(c => c.type === 'anniversary');

  function dayLabel(diff: number): string {
    if (diff === 0) return 'Today!';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 0) return `In ${diff} days`;
    return `${Math.abs(diff)} days ago`;
  }

  function initials(name: string): string {
    return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  }

  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🎉</span>
        <h3 className="text-sm font-semibold text-purple-900">Celebrations This Week</h3>
      </div>

      <div className="space-y-4">
        {birthdays.length > 0 && (
          <div>
            <p className="text-xs font-medium text-purple-700 mb-2 uppercase tracking-wide">Birthdays</p>
            <div className="space-y-2">
              {birthdays.map(c => (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-200 text-purple-800 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                    {initials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-purple-600">🎂 {dayLabel(c.daysFromToday)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {anniversaries.length > 0 && (
          <div>
            <p className="text-xs font-medium text-pink-700 mb-2 uppercase tracking-wide">Work Anniversaries</p>
            <div className="space-y-2">
              {anniversaries.map(c => (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-pink-200 text-pink-800 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                    {initials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-pink-600">🏆 {c.yearsAtCompany} year{c.yearsAtCompany !== 1 ? 's' : ''} at company — {dayLabel(c.daysFromToday)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OrgAnnouncementsWidget({ navigate }: { navigate: Function }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/communications/announcements`, {
      cache: 'no-store', headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then(r => safeJson(r))
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.data ?? data?.announcements ?? []);
        setAnnouncements(list.slice(0, 3));
      })
      .catch(() => setAnnouncements([]))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (a: Announcement) => {
    const raw = a.published_at ?? a.created_at ?? a.date;
    if (!raw) return '';
    return new Date(raw).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const truncate = (text: string | undefined, max = 80) => {
    if (!text) return '';
    return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <SectionHeading
        title="Org Announcements"
        action="View All"
        onAction={() => navigate('/communications')}
      />
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-1.5">
              <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
              <div className="h-3 w-full bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No announcements yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {announcements.map(a => (
            <div key={a.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground leading-snug">{a.title}</p>
                {formatDate(a) && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">{formatDate(a)}</span>
                )}
              </div>
              {(a.body ?? a.content) && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {truncate(a.body ?? a.content)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => navigate('/communications')}
        className="mt-3 w-full text-xs font-medium text-primary flex items-center justify-center gap-1 hover:underline"
      >
        View all announcements <ArrowUpRight size={12} />
      </button>
    </div>
  );
}
