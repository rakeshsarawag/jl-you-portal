/**
 * Launchpad — Persona-specific home screen
 * Standards: RBAC, i18n, constants, data isolation, error handling, loading states
 */
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  User, Clock, CheckCircle2, AlertCircle,
  TrendingUp, Users, UserPlus, GraduationCap, Laptop, FileText,
  DollarSign, Folder, Target, Library, Shield, Settings, Zap,
  Brain, BarChart3, MessageSquare, HardDrive, Share2, Database,
  ChevronRight, Calendar, CheckSquare, ArrowUpRight, Star, Inbox,
  Briefcase, Award, BookOpen, LayoutDashboard, LucideIcon,
  GitBranch, Lock, Cpu, Bug, Globe, Quote,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useUser } from '../context/UserContext';
import { useEmployeeDashboard } from '../hooks/useEmployeeDashboard';
import { API_BASE, publicAnonKey, safeJson } from '../utils/constants';
import { APP_VERSION } from '../../constants/global';
import { APP_BY_PATH } from '../../constants/appRegistry';
import { usePermissions } from '../hooks/usePermissions';
import { t } from '../../i18n/index';
import { useEmployees } from '../context/EmployeesContext';

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

// ── Strategic tile groups ──────────────────────────────────────────────────

const TILE_GROUPS: {
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  headerBg: string;
  iconColor: string;
  ids: string[];
  // optional: named sub-domains for dynamic label computation
  segments?: { label: string; ids: string[] }[];
}[] = [
  {
    label: 'People & Workforce',
    description: 'Manage your team across the full employee lifecycle',
    icon: Users,
    accent: 'border-blue-400',
    headerBg: 'bg-blue-50/60',
    iconColor: 'text-blue-500',
    ids: ['dashboard', 'directory', 'recruitment', 'onboarding', 'performance', 'training'],
  },
  {
    label: 'Work & Operations',
    description: 'Projects, services, assets, and day-to-day execution',
    icon: Briefcase,
    accent: 'border-lime-500',
    headerBg: 'bg-lime-50/60',
    iconColor: 'text-lime-600',
    ids: ['projects', 'defect-tracker', 'it-services', 'assets', 'workflow-dashboard', 'okr'],
  },
  {
    label: 'Communication, Insights & Finance',
    description: 'Engage your organisation, track performance, and manage financials',
    icon: MessageSquare,
    accent: 'border-sky-400',
    headerBg: 'bg-sky-50/60',
    iconColor: 'text-sky-500',
    ids: ['communications', 'linkedin', 'executive-dashboard', 'invoices', 'payroll'],
    segments: [
      { label: 'Communication', ids: ['communications', 'linkedin'] },
      { label: 'Insights', ids: ['executive-dashboard'] },
      { label: 'Finance', ids: ['invoices', 'payroll'] },
    ],
  },
  {
    label: 'Administration',
    description: 'System configuration, access control, and platform settings',
    icon: Shield,
    accent: 'border-rose-400',
    headerBg: 'bg-rose-50/60',
    iconColor: 'text-rose-500',
    ids: ['user-management', 'security-compliance', 'permissions', 'master-data', 'advanced-features', 'documentation'],
  },
];

function resolveGroupLabel(group: typeof TILE_GROUPS[0], visibleIds: string[]): string {
  if (!group.segments) return group.label;
  const present = group.segments
    .filter(s => s.ids.some(id => visibleIds.includes(id)))
    .map(s => s.label);
  return present.length > 0 ? present.join(' & ') : group.label;
}

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

// ── Stat tile ──────────────────────────────────────────────────────────────

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

// ── Hero background images — professional landscapes, no people ────────────
// Rotates weekly (ISO week % array length). Index 7 = week 39 (current).

const HERO_IMAGES = [
  { id: 'photo-1673970825861-3469f8fe01d3', alt: 'Aerial view of rolling green hills and forest' },
  { id: 'photo-1612729875065-1385f02852ef', alt: 'Green grass valley and mountains under clear blue sky' },
  { id: 'photo-1536048810607-3dc7f86981cb', alt: 'Aerial photography of river winding between mountains' },
  { id: 'photo-1515266591878-f93e32bc5937', alt: "Bird's eye view of mountain peaks" },
  { id: 'photo-1651149164822-210246e81f99', alt: 'Expansive green landscape at dusk' },
  { id: 'photo-1783371334593-098ce0d1721b', alt: 'Winding river path through a lush mountain valley' },
  { id: 'photo-1784965445276-b49df0f1649e', alt: 'Frozen ocean meets rugged coastline at sunset' },
  { id: 'photo-1661124280301-ca0e33ceb438', alt: 'Misty forest beside a calm lake at dawn' },
];

// Week number helper (ISO — same week = same index, changes every Monday)
function isoWeek(d: Date): number {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  return Math.floor((d.getTime() - startOfWeek1.getTime()) / (7 * 86400000)) + 1;
}

// Day-of-year helper
function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

// ── Inspirational quotes pool ─────────────────────────────────────────────

const QUOTES = [
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "In the middle of every difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { text: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
  { text: "What you get by achieving your goals is not as important as what you become by achieving your goals.", author: "Zig Ziglar" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Coming together is a beginning, staying together is progress, and working together is success.", author: "Henry Ford" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Quality means doing it right when no one is looking.", author: "Henry Ford" },
  { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { text: "Excellence is not a skill. It is an attitude.", author: "Ralph Marston" },
  { text: "The harder I work, the luckier I get.", author: "Samuel Goldwyn" },
  { text: "Do not wait to strike till the iron is hot; make it hot by striking.", author: "William Butler Yeats" },
  { text: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
  { text: "Great things in business are never done by one person.", author: "Steve Jobs" },
  { text: "Your most unhappy customers are your greatest source of learning.", author: "Bill Gates" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
];

// ── HeroSection component ─────────────────────────────────────────────────

function HeroSection({ greeting, userName, today }: { greeting: string; userName: string; today: string }) {
  const now = new Date();
  // Image rotates weekly — same image for the entire week
  const imgIdx = isoWeek(now) % HERO_IMAGES.length;
  // Quote rotates daily — same quote for the entire day
  const quoteIdx = dayOfYear(now) % QUOTES.length;

  const img = HERO_IMAGES[imgIdx];
  const quote = QUOTES[quoteIdx];
  const bgUrl = `https://images.unsplash.com/${img.id}?w=1600&h=560&fit=crop&auto=format&q=80`;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl" style={{ minHeight: 260 }}>
      {/* Background image — static, no auto-rotation timer */}
      <div
        className="absolute inset-0 bg-center bg-cover"
        style={{ backgroundImage: `url(${bgUrl})`, backgroundColor: '#1e293b' }}
        role="img"
        aria-label={img.alt}
      />
      {/* Layered overlays: heavier on left for text legibility, lighter on right */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      {/* Content grid */}
      <div
        className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 px-8 py-10 md:py-14 items-center"
        style={{ minHeight: 260 }}
      >
        {/* Left — greeting */}
        <div className="space-y-3">
          <p className="text-white/55 text-xs font-semibold tracking-widest uppercase">{today}</p>
          <h1 className="text-3xl md:text-[2.6rem] font-bold text-white leading-tight">
            {greeting},<br />
            <span className="text-white/90">{userName || 'Welcome back'}</span>
          </h1>
          <p className="text-white/50 text-sm">Your workspace is ready. Have a productive day.</p>
        </div>

        {/* Right — daily inspirational quote, fully transparent background */}
        <div className="hidden md:flex flex-col justify-center px-2 py-1 space-y-3">
          <Quote size={22} className="text-white/35" />
          <p className="text-white/85 text-base font-medium leading-relaxed italic">
            "{quote.text}"
          </p>
          <p className="text-white/50 text-sm tracking-wide">— {quote.author}</p>
        </div>
      </div>
    </div>
  );
}

// ── AppTileCard ───────────────────────────────────────────────────────────

function AppTileCard({ tile, navigate }: { tile: { id: string; title: string; subtitle: string; icon: LucideIcon; path: string; color: string; iconBg: string }; navigate: (path: string) => void }) {
  return (
    <button
      onClick={() => navigate(tile.path)}
      className="group flex flex-col items-center gap-3 p-4 pt-5 pb-4 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-md hover:bg-muted/30 transition-all duration-200 text-center min-w-0"
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${tile.iconBg} shadow-sm group-hover:scale-105 transition-transform duration-200 flex-shrink-0`}>
        <tile.icon size={26} className={tile.color} />
      </div>
      <div className="w-full space-y-0.5">
        <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">{tile.title}</p>
        <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{tile.subtitle}</p>
      </div>
    </button>
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

  // Speculatively prefetch the most-navigated route chunks once the launchpad
  // has rendered so that first navigation to those pages doesn't stall on a
  // network fetch for the JS bundle.
  useEffect(() => {
    const timer = setTimeout(() => {
      // Top routes visited by almost every user role
      import('./apps/EmployeeDashboardEnhancedV2');
      import('./apps/ITServicesEnhancedV2');
      import('./apps/LeaveManagementPage');
      // Role-specific — admin/manager
      if (primaryRole !== 'employee') {
        import('./apps/UserManagement');
        import('./apps/PayrollManagementEnhanced');
      }
    }, 2000); // defer 2s so critical render/data fetches complete first
    return () => clearTimeout(timer);
  }, [primaryRole]);

  // Load pending leaves for managers
  useEffect(() => {
    const roles = currentUser?.roles ?? [];
    if (roles.some(r => ['manager', 'hr', 'admin'].includes(r))) {
      dash.loadPendingLeaves();
    }
  }, [currentUser?.roles?.join(',')]);

  const userRoles = currentUser?.roles ?? ['employee'];
  const { canSeeApp, matrixLoaded } = usePermissions(userRoles, currentUser?.permissionOverrides ?? []);

  const ALL_TILES = useMemo<AppTile[]>(() => TILE_CONFIG.map(cfg => ({
    id: cfg.id as any,
    title: t(cfg.titleKey),
    subtitle: t(cfg.subKey),
    icon: cfg.icon,
    path: cfg.path,
    color: cfg.color,
    iconBg: cfg.iconBg,
    category: cfg.category,
  })), [t]);

  const accessibleTiles = useMemo(() => ALL_TILES.filter(tile => {
    const app = APP_BY_PATH[tile.path];
    if (!app) return false;
    if (userRoles.includes('admin')) return true;
    if (!matrixLoaded) return false;
    return canSeeApp(app.appId);
  }), [ALL_TILES, userRoles, canSeeApp, matrixLoaded]);

  const filteredTiles = useMemo(() => search
    ? accessibleTiles.filter(tile =>
        tile.title.toLowerCase().includes(search.toLowerCase()) ||
        tile.subtitle.toLowerCase().includes(search.toLowerCase())
      )
    : accessibleTiles, [accessibleTiles, search]);

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
      <main className="w-full px-6 sm:px-10 py-6">
        <div className="flex gap-6 items-start">

          {/* ── Left / main column ─────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-8">

            {/* 1. Hero */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <HeroSection greeting={greeting} userName={userName} today={today} />
            </motion.div>

            {/* 2. Persona widgets */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
              {renderPersonaWidgets()}
            </motion.div>

            {/* 3. App launcher */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="space-y-6"
            >
              {search ? (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Applications</h2>
                    <p className="text-sm text-muted-foreground">
                      Results for <span className="font-medium text-foreground">"{search}"</span>
                    </p>
                  </div>
                  {filteredTiles.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">{t('launchpad.noAppsMatch')}</div>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                      {filteredTiles.map(tile => <AppTileCard key={tile.id} tile={tile} navigate={navigate} />)}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Applications</h2>
                  {TILE_GROUPS.map(group => {
                    const tiles = group.ids
                      .map(id => accessibleTiles.find(t => t.id === id))
                      .filter(Boolean) as typeof accessibleTiles;
                    if (tiles.length === 0) return null;
                    const visibleIds = tiles.map(t => t.id);
                    const groupLabel = resolveGroupLabel(group, visibleIds);
                    return (
                      <div key={group.label} className={`rounded-xl border border-border border-l-4 ${group.accent} overflow-hidden`}>
                        <div className={`flex items-center gap-3 px-4 py-3 ${group.headerBg} border-b border-border/60`}>
                          <group.icon size={14} className={group.iconColor} />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-foreground">{groupLabel}</span>
                          </div>
                        </div>
                        <div className="p-3 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
                          {tiles.map(tile => <AppTileCard key={tile.id} tile={tile} navigate={navigate} />)}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </motion.div>

            {/* 4. Celebrations + Announcements (non-sidebar roles) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="space-y-6"
            >
              <CelebrationsWidget />
            </motion.div>

          </div>{/* end left column */}

          {/* ── Right sidebar (lg+) — shown for all roles ──────────── */}
          <aside className="hidden lg:flex flex-col gap-3 w-72 flex-shrink-0 self-start sticky top-4 max-h-[calc(100vh-5rem)] overflow-y-auto pb-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1 pt-1">At a Glance</p>
            {primaryRole === 'admin' && <AdminSidebarContent dash={dash} userId={userId} navigate={navigate} />}
            {primaryRole === 'manager' && <ManagerSidebarContent dash={dash} userId={userId} navigate={navigate} />}
            {primaryRole === 'hr' && <HRSidebarContent dash={dash} userId={userId} navigate={navigate} />}
            {primaryRole === 'employee' && <EmployeeSidebarContent dash={dash} userId={userId} navigate={navigate} />}
            {primaryRole === 'finance' && <FinanceSidebarContent userId={userId} navigate={navigate} />}
            {!['admin', 'manager', 'hr', 'employee', 'finance'].includes(primaryRole) && <EmployeeSidebarContent dash={dash} userId={userId} navigate={navigate} />}
          </aside>

        </div>
      </main>
    </div>
  );
}

// ── Employee Widgets ───────────────────────────────────────────────────────

function EmployeeWidgets(_props: { dash: ReturnType<typeof useEmployeeDashboard>; navigate: Function }) {
  return null;
}

// ── HR Widgets ─────────────────────────────────────────────────────────────

function HRWidgets({ navigate }: { dash: ReturnType<typeof useEmployeeDashboard>; navigate: Function; userId?: string }) {
  return (
    <div className="space-y-4">

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
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
            <Zap className="w-4 h-4 text-purple-600" />
          </div>
          Workflow Activity
        </h3>
        <a href="/workflow-dashboard" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
          View all <ArrowUpRight size={11} />
        </a>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-900/40">
          <div className="text-2xl font-bold text-amber-600">{data.pending}</div>
          <div className="text-xs text-muted-foreground mt-0.5 font-medium">Pending Approvals</div>
        </div>
        <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-100 dark:border-purple-900/40">
          <div className="text-2xl font-bold text-purple-600">{data.running}</div>
          <div className="text-xs text-muted-foreground mt-0.5 font-medium">Active Workflows</div>
        </div>
      </div>
      {data.pending > 0 && (
        <a href="/workflow-dashboard" className="mt-3 block text-center text-sm py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 font-medium transition-colors">
          Review {data.pending} Pending {data.pending === 1 ? 'Approval' : 'Approvals'}
        </a>
      )}
    </div>
  );
}

function ManagerWidgets({ navigate }: { dash: ReturnType<typeof useEmployeeDashboard>; navigate: Function; userId: string }) {
  return (
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
  );
}

// ── Finance Widgets ────────────────────────────────────────────────────────

function FinanceWidgets(_props: { navigate: Function }) {
  return null;
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
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-card border border-border rounded-xl p-3 col-span-2 sm:col-span-1">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-violet-500 flex-shrink-0">
          <Globe size={14} className="text-white" />
        </div>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">World Clock</span>
      </div>
      <div className="flex justify-around">
        {WORLD_CLOCKS.map(({ label, tz, flag }) => {
          const timeStr = now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
          return (
            <div key={tz} className="flex flex-col items-center gap-0.5">
              <span className="text-base leading-none">{flag}</span>
              <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
              <span className="text-xs font-bold text-foreground font-mono tabular-nums">{timeStr}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Pending Approvals Widget ───────────────────────────────────────────────

interface PendingItem {
  id: string;
  title: string;
  meta: string;
  badge: string;
  onApprove?: () => void;
  onReject?: () => void;
}

function PendingApprovalsWidget({
  dash, userId, role, navigate,
}: {
  dash: ReturnType<typeof useEmployeeDashboard>;
  userId: string;
  role: string;
  navigate: Function;
}) {
  const [wfApprovals, setWfApprovals] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`${API_BASE}/workflow/approvals/my?user_id=${userId}`, {
      cache: 'no-store',
      headers: { apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
    })
      .then(r => safeJson(r))
      .then(d => setWfApprovals(Array.isArray(d?.data) ? d.data : []))
      .catch(() => {});
  }, [userId]);

  const items: PendingItem[] = [
    ...dash.pendingLeaves.map(l => ({
      id: `leave-${l.id}`,
      title: l.employee_name,
      meta: `${l.leave_type} · ${l.days} day${l.days !== 1 ? 's' : ''} · ${l.start_date}`,
      badge: 'Leave',
      onApprove: () => dash.approveLeave(l.id, role),
      onReject: () => dash.rejectLeave(l.id, role),
    })),
    ...wfApprovals.map(w => ({
      id: `wf-${w.id}`,
      title: w.title ?? w.workflow_name ?? 'Workflow Approval',
      meta: w.requester_name ?? w.requested_by ?? '',
      badge: 'Workflow',
    })),
  ];

  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, 2);

  const badgeColors: Record<string, string> = {
    Leave: 'bg-orange-100 text-orange-700',
    Workflow: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Pending Approvals</h2>
          <span className="text-[11px] bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-semibold">{items.length}</span>
        </div>
        <button onClick={() => navigate('/dashboard')} className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
          View All <ChevronRight size={12} />
        </button>
      </div>
      <div className="space-y-3">
        {visible.map(item => (
          <div key={item.id} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2.5">
            {/* Header row: badge + name */}
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badgeColors[item.badge] ?? 'bg-muted text-muted-foreground'}`}>
                {item.badge}
              </span>
              <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
            </div>
            {/* Meta */}
            {item.meta && (
              <p className="text-xs text-muted-foreground leading-relaxed">{item.meta}</p>
            )}
            {/* Actions */}
            {(item.onApprove || item.onReject) && (
              <div className="flex gap-1.5 pt-0.5">
                {item.onApprove && (
                  <button onClick={item.onApprove} className="px-3 py-0.5 text-[11px] font-semibold bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors">
                    Approve
                  </button>
                )}
                {item.onReject && (
                  <button onClick={item.onReject} className="px-3 py-0.5 text-[11px] font-semibold text-red-600 border border-red-300 rounded-full hover:bg-red-50 transition-colors">
                    Reject
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {items.length > 2 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-2 w-full text-xs text-primary font-medium flex items-center justify-center gap-1 hover:underline"
        >
          {expanded ? 'Show less' : `Show ${items.length - 2} more`}
          <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      )}
    </div>
  );
}

// ── Admin Widgets ──────────────────────────────────────────────────────────

function AdminWidgets({ dash }: { dash: ReturnType<typeof useEmployeeDashboard>; navigate: Function; userId: string }) {
  useEffect(() => { dash.loadPendingLeaves(); }, []);
  return null;
}

// ── Sidebar: Org Announcements (compact) ──────────────────────────────────

function SidebarAnnouncementsWidget({ navigate }: { navigate: Function }) {
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

  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-semibold text-foreground">Announcements</p>
        <button onClick={() => navigate('/communications')} className="text-[10px] text-primary hover:underline font-medium">View all</button>
      </div>
      {loading ? (
        <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}</div>
      ) : announcements.length === 0 ? (
        <p className="text-[11px] text-muted-foreground py-1">No announcements.</p>
      ) : (
        <div className="space-y-2.5">
          {announcements.map(a => {
            const raw = a.published_at ?? a.created_at ?? a.date;
            const date = raw ? new Date(raw).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
            return (
              <div key={a.id} className="border-l-2 border-primary/30 pl-2.5">
                <p className="text-[11px] font-medium text-foreground leading-snug line-clamp-2">{a.title}</p>
                {date && <p className="text-[10px] text-muted-foreground mt-0.5">{date}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sidebar: Recent Activity ───────────────────────────────────────────────

function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function RecentActivityWidget({ userId }: { userId: string }) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    fetch(`${API_BASE}/notifications?userId=${userId}`, {
      cache: 'no-store',
      headers: { apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
    })
      .then(r => safeJson(r))
      .then(d => setActivities((Array.isArray(d?.data) ? d.data : []).slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const typeIcon: Record<string, string> = {
    success: '✅', warning: '⚠️', error: '🔴', info: 'ℹ️',
  };

  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-semibold text-foreground">Recent Activity</p>
        <a href="/notifications" className="text-[10px] text-primary hover:underline font-medium">See all</a>
      </div>
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-7 bg-muted animate-pulse rounded" />)}</div>
      ) : activities.length === 0 ? (
        <p className="text-[11px] text-muted-foreground py-1 text-center">No recent activity</p>
      ) : (
        <div className="space-y-2">
          {activities.map(a => (
            <div key={a.id} className="flex items-start gap-2">
              <span className="text-xs mt-0.5 flex-shrink-0">{typeIcon[a.type] ?? '🔔'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-foreground leading-snug line-clamp-1">{a.title}</p>
                <p className="text-[10px] text-muted-foreground">{formatRelativeTime(a.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Right sidebar content per role ────────────────────────────────────────

function AdminSidebarContent({ dash, userId, navigate }: { dash: ReturnType<typeof useEmployeeDashboard>; userId: string; navigate: Function }) {
  const { stats, loading } = useLatestStats(['active_users', 'it_open_tickets']);
  return (
    <>
      <StatTile label="Leave Requests" value={dash.pendingLeaves.length} icon={Inbox} color="bg-orange-500" loading={dash.loading} />
      <StatTile label="Active Users" value={stats.active_users ?? '—'} icon={Users} color="bg-blue-500" loading={loading} />
      <StatTile label="IT Tickets" value={stats.it_open_tickets ?? '—'} icon={Laptop} color="bg-cyan-500" loading={loading} />
      <WorldClockTile />
      <PendingApprovalsWidget dash={dash} userId={userId} role="admin" navigate={navigate} />
      <WorkflowActivityWidget userId={userId} />
      <SidebarAnnouncementsWidget navigate={navigate} />
      <RecentActivityWidget userId={userId} />
    </>
  );
}

function ManagerSidebarContent({ dash, userId, navigate }: { dash: ReturnType<typeof useEmployeeDashboard>; userId: string; navigate: Function }) {
  const { stats, loading } = useLatestStats(['active_okrs', 'open_projects']);
  return (
    <>
      <StatTile label="Leave Approvals" value={dash.pendingLeaves.length} icon={Inbox} color="bg-orange-500" loading={dash.loading} />
      <StatTile label="Active OKRs" value={stats.active_okrs ?? '—'} icon={Target} color="bg-yellow-500" loading={loading} />
      <StatTile label="Open Projects" value={stats.open_projects ?? '—'} icon={Folder} color="bg-lime-500" loading={loading} />
      <WorldClockTile />
      <PendingApprovalsWidget dash={dash} userId={userId} role="manager" navigate={navigate} />
      <WorkflowActivityWidget userId={userId} />
      <SidebarAnnouncementsWidget navigate={navigate} />
      <RecentActivityWidget userId={userId} />
    </>
  );
}

function HRSidebarContent({ dash, userId, navigate }: { dash: ReturnType<typeof useEmployeeDashboard>; userId: string; navigate: Function }) {
  const { stats, loading } = useLatestStats(['it_open_tickets', 'active_recruitments', 'onboarding_in_progress']);
  return (
    <>
      <StatTile label="Leave Requests" value={dash.pendingLeaves.length} icon={Inbox} color="bg-orange-500" loading={dash.loading} />
      <StatTile label="IT Tickets" value={stats.it_open_tickets ?? '—'} icon={Laptop} color="bg-cyan-500" loading={loading} />
      <StatTile label="Recruitments" value={stats.active_recruitments ?? '—'} icon={UserPlus} color="bg-violet-500" loading={loading} />
      <StatTile label="Onboarding" value={stats.onboarding_in_progress ?? '—'} icon={Star} color="bg-pink-500" loading={loading} />
      <WorldClockTile />
      <PendingApprovalsWidget dash={dash} userId={userId} role="hr" navigate={navigate} />
      <SidebarAnnouncementsWidget navigate={navigate} />
      <RecentActivityWidget userId={userId} />
    </>
  );
}

function EmployeeSidebarContent({ dash, userId, navigate }: { dash: ReturnType<typeof useEmployeeDashboard>; userId: string; navigate: Function }) {
  const { stats, todayAttendance, leaveBalance, upcomingTasks, loading } = dash;
  return (
    <>
      <StatTile label="Present Days" value={stats.presentDays} icon={CheckCircle2} color="bg-green-500" loading={loading} />
      <StatTile label="Leave Balance" value={Object.values(leaveBalance).reduce((a, b) => a + b, 0)} icon={Calendar} color="bg-blue-500" loading={loading} />
      <StatTile label="Tasks Pending" value={stats.tasksPending} icon={CheckSquare} color="bg-orange-500" loading={loading} />
      <StatTile label="Hours This Month" value={`${stats.hoursThisMonth.toFixed(0)}h`} icon={Clock} color="bg-purple-500" loading={loading} />

      {/* Compact Attendance */}
      <div className="bg-card border border-border rounded-xl p-3">
        <p className="text-xs font-semibold text-foreground mb-2">{"Today's Attendance"}</p>
        {loading ? (
          <div className="h-14 bg-muted animate-pulse rounded" />
        ) : todayAttendance ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Check-in</span>
              <span className="font-medium">{todayAttendance.check_in ? new Date(todayAttendance.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Check-out</span>
              <span className="font-medium">{todayAttendance.check_out ? new Date(todayAttendance.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Still in'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Status</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${todayAttendance.status === 'Present' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {todayAttendance.status}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">Not checked in yet.</p>
        )}
        <button onClick={() => navigate('/dashboard')} className="mt-2 w-full text-[10px] text-primary flex items-center justify-center gap-1 hover:underline font-medium">
          Go to Dashboard <ArrowUpRight size={10} />
        </button>
      </div>

      {/* Compact Leave Balance */}
      <div className="bg-card border border-border rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-foreground">Leave Balance</p>
          <button onClick={() => navigate('/dashboard')} className="text-[10px] text-primary hover:underline font-medium">Apply</button>
        </div>
        {loading ? (
          <div className="space-y-1.5">{[1,2,3].map(i => <div key={i} className="h-4 bg-muted animate-pulse rounded" />)}</div>
        ) : (
          <div className="space-y-1.5">
            {Object.entries(leaveBalance).map(([type, days]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{type}</span>
                <span className="text-xs font-semibold text-foreground">{days} <span className="text-[10px] font-normal text-muted-foreground">days</span></span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compact Upcoming Tasks */}
      <div className="bg-card border border-border rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-foreground">Upcoming Tasks</p>
          <button onClick={() => navigate('/dashboard')} className="text-[10px] text-primary hover:underline font-medium">View all</button>
        </div>
        {loading ? (
          <div className="space-y-1.5">{[1,2,3].map(i => <div key={i} className="h-6 bg-muted animate-pulse rounded" />)}</div>
        ) : upcomingTasks.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No upcoming tasks.</p>
        ) : (
          <div className="space-y-1.5">
            {upcomingTasks.slice(0, 4).map(task => (
              <div key={task.id} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.priority === 'High' ? 'bg-red-500' : task.priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                <p className="text-[11px] text-foreground truncate flex-1">{task.title}</p>
                {task.due_date && <span className="text-[10px] text-muted-foreground whitespace-nowrap">{task.due_date}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <WorldClockTile />
      <SidebarAnnouncementsWidget navigate={navigate} />
      <RecentActivityWidget userId={userId} />
    </>
  );
}

function FinanceSidebarContent({ userId, navigate }: { userId: string; navigate: Function }) {
  const { stats, loading } = useLatestStats(['outstanding_invoices_amount', 'overdue_invoices']);
  return (
    <>
      <StatTile label="Outstanding Invoices" value={stats.outstanding_invoices_amount ?? '—'} icon={FileText} color="bg-green-500" loading={loading} />
      <StatTile label="Overdue" value={stats.overdue_invoices ?? '—'} icon={AlertCircle} color="bg-red-500" loading={loading} />
      <StatTile label="Next Payroll" value="—" icon={DollarSign} color="bg-blue-500" />
      <StatTile label="Pending Approvals" value="—" icon={Inbox} color="bg-orange-500" />
      <WorldClockTile />
      <SidebarAnnouncementsWidget navigate={navigate} />
      <RecentActivityWidget userId={userId} />
    </>
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
  const { employees: empList, loading } = useEmployees();
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loading) return;
    const list = empList as any[];
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
    setLoaded(true);
  }, [empList, loading]);

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
    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-violet-500 to-pink-500 p-px">
      <div className="rounded-2xl bg-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-base shadow-sm">🎉</div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Celebrations This Week</h3>
            <p className="text-xs text-muted-foreground">{celebrations.length} upcoming celebration{celebrations.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {birthdays.map(c => (
            <div key={c.id} className="flex items-center gap-3 bg-violet-50 dark:bg-violet-950/30 rounded-xl px-3 py-2.5 border border-violet-100 dark:border-violet-800/40">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
                {initials(c.name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                <p className="text-xs text-violet-600 dark:text-violet-400">🎂 {dayLabel(c.daysFromToday)}</p>
              </div>
            </div>
          ))}
          {anniversaries.map(c => (
            <div key={c.id} className="flex items-center gap-3 bg-pink-50 dark:bg-pink-950/30 rounded-xl px-3 py-2.5 border border-pink-100 dark:border-pink-800/40">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-400 to-rose-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
                {initials(c.name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                <p className="text-xs text-pink-600 dark:text-pink-400">🏆 {c.yearsAtCompany}yr anniversary — {dayLabel(c.daysFromToday)}</p>
              </div>
            </div>
          ))}
        </div>
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
    <div className="bg-card border border-border rounded-2xl p-4">
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
