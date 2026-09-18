import { useState, useCallback, useRef, useEffect } from 'react';
import { useDisplaySettings } from '../context/DisplaySettingsContext';
import { useNavigate, useLocation } from 'react-router';
import { ArrowLeft, ChevronRight, Bell, BellDot, Sun, Moon, Monitor, LogOut, ChevronDown, CalendarOff, CheckSquare, Ticket, GitBranch, Info, HelpCircle, X } from 'lucide-react';
import { useUnsavedChangesContext } from '../context/UnsavedChangesContext';
import { useUser } from '../context/UserContext';
import { useNotifications } from '../hooks/useNotificationsData';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useLocale } from '../../i18n/LocaleContext';
import type { Locale } from '../../i18n';

function JeshanLogo({ size = 28 }: { size?: number }) {
  const id = 'jl-header-grad';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-label="Jeshan Labs">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <pattern id="jl-grid" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M 8 0 L 0 0 0 8" fill="none" stroke="white" strokeWidth="0.5" opacity="0.2" />
        </pattern>
      </defs>
      <rect width="48" height="48" rx="9" fill={`url(#${id})`} />
      <rect width="48" height="48" rx="9" fill="url(#jl-grid)" />
      <text x="24" y="32" fontFamily="Arial, sans-serif" fontSize="22" fontWeight="900" fill="white" textAnchor="middle" letterSpacing="-1">JL</text>
      <circle cx="42" cy="6" r="3" fill="#34d399">
        <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function UnsavedDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6" role="dialog" aria-modal="true">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-foreground">Unsaved changes</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          You have unsaved changes on this page. If you leave now, those changes will be lost.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors text-foreground">Stay on page</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors">Leave anyway</button>
        </div>
      </div>
    </div>
  );
}

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Employee Dashboard',
  '/directory': 'Employee Directory',
  '/recruitment': 'Recruitment',
  '/onboarding': 'Onboarding Portal',
  '/performance': 'Performance Tracker',
  '/training': 'Training Tracker',
  '/it-services': 'IT Services',
  '/payroll': 'Payroll Management',
  '/invoices': 'Invoice Generation',
  '/assets': 'Asset Management',
  '/okr': 'OKR Management',
  '/projects': 'Project Management',
  '/communications': 'Communications Hub',
  '/knowledge': 'Knowledge Base',
  '/user-management': 'User Management',
  '/permissions': 'Permission Manager',
  '/executive-dashboard': 'Analytics Dashboard',
  '/workflow-dashboard': 'Workflow Automation',
  '/ai-intelligence-dashboard': 'AI Intelligence',
  '/advanced-analytics': 'Analytics Dashboard',
  '/collaboration-hub': 'Collaboration Hub',
  '/security-compliance': 'Security & Compliance',
  '/advanced-features': 'Advanced Features',
  '/master-data': 'Master Data',
  '/documentation': 'Documentation',
  '/linkedin': 'LinkedIn Manager',
};

type Theme = 'light' | 'dark' | 'system';

const LANGUAGES: { value: Locale; label: string; flag: string }[] = [
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
];

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark));
  localStorage.setItem('jl-theme', theme);
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; dot: string; bg: string }> = {
  leave:    { icon: <CalendarOff size={12} />, dot: 'bg-emerald-500', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  task:     { icon: <CheckSquare size={12} />, dot: 'bg-blue-500',    bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  ticket:   { icon: <Ticket size={12} />,      dot: 'bg-orange-500',  bg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  workflow: { icon: <GitBranch size={12} />,   dot: 'bg-purple-500',  bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  payroll:  { icon: <Info size={12} />,        dot: 'bg-yellow-500',  bg: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  info:     { icon: <Info size={12} />,        dot: 'bg-primary',     bg: 'bg-primary/10 text-primary' },
};
function typeConfig(type: string) { return TYPE_CONFIG[type] ?? TYPE_CONFIG.info; }

function PushToggleCompact() {
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } = usePushNotifications();
  if (!supported || permission === 'denied') return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">Push alerts</span>
      <button
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={loading}
        className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${subscribed ? 'bg-primary' : 'bg-muted-foreground/30'}`}
        title={subscribed ? 'Disable push notifications' : 'Enable push notifications'}
      >
        <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform ${subscribed ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function NotificationPanel({ onClose, navigate }: { onClose: () => void; navigate: ReturnType<typeof useNavigate> }) {
  const { notifications, unreadCount, loading, markRead, markAllRead, deleteNotification } = useNotifications();
  return (
    <div className="absolute right-0 top-11 z-50 w-84 bg-card border border-border rounded-xl shadow-xl overflow-hidden" style={{ width: 336 }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <BellDot size={14} className="text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={() => markAllRead()} className="text-xs text-primary hover:underline">Mark all read</button>
        )}
      </div>
      <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Bell size={28} className="text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">All caught up!</p>
          </div>
        ) : (
          notifications.slice(0, 25).map(n => {
            const tc = typeConfig(n.type);
            return (
              <div key={n.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group ${!n.read ? 'bg-primary/5' : ''}`}>
                <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${tc.bg}`}>
                  {tc.icon}
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { markRead(n.id); if (n.link) navigate(n.link); onClose(); }}>
                  <p className={`text-xs font-semibold leading-snug ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.body}</p>}
                  <p className="text-[10px] text-muted-foreground/50 mt-1">
                    {new Date(n.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {!n.read && <span className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${tc.dot}`} />}
                <button onClick={() => deleteNotification(n.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground mt-0.5 shrink-0" aria-label="Dismiss">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="border-t border-border px-4 py-2.5 flex items-center justify-between gap-3 bg-muted/20">
        <PushToggleCompact />
        <button onClick={() => { onClose(); navigate('/communications'); }} className="text-xs text-primary hover:underline ml-auto">
          View all
        </button>
      </div>
    </div>
  );
}

function UserMenu({ currentUser, onLogout }: { currentUser: any; onLogout: () => void }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('jl-theme') as Theme) ?? 'light');
  const { locale, setLocale } = useLocale();
  const [langOpen, setLangOpen] = useState(false);
  const { fontScale, density, setFontScale, setDensity } = useDisplaySettings();

  const handleTheme = (t: Theme) => { setTheme(t); applyTheme(t); };
  const currentLang = LANGUAGES.find(l => l.value === locale) ?? LANGUAGES[0];
  const initials = currentUser?.name ? currentUser.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : 'U';

  return (
    <div className="py-1 w-64">
      {/* User info */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{currentUser?.name ?? 'User'}</p>
            <p className="text-xs text-muted-foreground truncate">{currentUser?.email ?? ''}</p>
          </div>
        </div>
      </div>

      {/* Theme */}
      <div className="px-4 pt-3 pb-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Theme</p>
        <div className="flex gap-1">
          {[
            { value: 'light' as Theme, icon: Sun, label: 'Light' },
            { value: 'dark' as Theme, icon: Moon, label: 'Dark' },
            { value: 'system' as Theme, icon: Monitor, label: 'Auto' },
          ].map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => handleTheme(value)}
              className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                theme === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="px-4 pb-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Language</p>
        <div className="relative">
          <button
            onClick={() => setLangOpen(o => !o)}
            className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <span className="flex items-center gap-2 text-xs text-foreground">
              <span>{currentLang.flag}</span>
              <span>{currentLang.label}</span>
            </span>
            <ChevronDown size={12} className={`text-muted-foreground transition-transform ${langOpen ? 'rotate-180' : ''}`} />
          </button>
          {langOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-10 overflow-hidden">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.value}
                  onClick={() => { setLocale(lang.value); setLangOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors ${locale === lang.value ? 'text-primary font-medium' : 'text-foreground'}`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Display: Text Size + Density */}
      <div className="px-4 pb-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Text Size</p>
        <div className="flex gap-1">
          {(['sm', 'md', 'lg'] as const).map(scale => (
            <button
              key={scale}
              onClick={() => setFontScale(scale)}
              className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${fontScale === scale ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {scale === 'sm' ? 'S' : scale === 'md' ? 'M' : 'L'}
            </button>
          ))}
        </div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-3 mb-2">Density</p>
        <div className="flex gap-1">
          {(['compact', 'comfortable', 'spacious'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDensity(d)}
              className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${density === d ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {d === 'compact' ? 'Compact' : d === 'comfortable' ? 'Default' : 'Spacious'}
            </button>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div className="border-t border-border mt-1 pt-1">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        >
          <LogOut size={14} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}

interface AppHeaderProps {
  onLogout: () => void;
}

export function AppHeader({ onLogout }: AppHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasUnsaved } = useUnsavedChangesContext();
  const { currentUser } = useUser();
  const { unreadCount } = useNotifications();

  const [showDialog, setShowDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<() => void>(() => () => {});
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [search, setSearch] = useState('');

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);

  const isHome = location.pathname === '/';
  const pageLabel = ROUTE_LABELS[location.pathname] ?? '';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const saved = (localStorage.getItem('jl-theme') as Theme) ?? 'light';
    applyTheme(saved);
  }, []);

  const guardedAction = useCallback((action: () => void) => {
    if (hasUnsaved()) {
      setPendingAction(() => action);
      setShowDialog(true);
    } else {
      action();
    }
  }, [hasUnsaved]);

  const initials = currentUser?.name
    ? currentUser.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-12 bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center gap-2">

          {/* Back button */}
          {!isHome && (
            <>
              <button
                onClick={() => guardedAction(() => navigate(-1))}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-muted shrink-0"
                aria-label="Go back"
              >
                <ArrowLeft size={14} />
                <span className="font-medium">Back</span>
              </button>
              <div className="h-4 w-px bg-border shrink-0" />
            </>
          )}

          {/* Logo + brand */}
          <button
            onClick={() => guardedAction(() => navigate('/'))}
            className="flex items-center gap-2 hover:opacity-80 active:scale-95 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg pr-1 shrink-0"
            aria-label="Jeshan Labs — Go to home"
          >
            <JeshanLogo size={26} />
            <span className="text-sm font-bold text-foreground tracking-tight select-none hidden sm:block">Jeshan Labs</span>
          </button>

          {/* Breadcrumb on inner pages */}
          {!isHome && pageLabel && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
              <ChevronRight size={13} className="opacity-40 shrink-0" />
              <span className="font-medium text-foreground/70 truncate">{pageLabel}</span>
            </div>
          )}

          {/* Search — only on home, grows to fill space */}
          {isHome && (
            <div className="flex-1 flex justify-center px-4">
              <div className="relative w-full max-w-xs">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search apps…"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    window.dispatchEvent(new CustomEvent('jl-search', { detail: e.target.value }));
                  }}
                  className="w-full pl-8 pr-3 py-1 text-xs bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>
            </div>
          )}

          {/* Spacer on inner pages */}
          {!isHome && <div className="flex-1" />}

          {/* Keyboard shortcuts button */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('show-shortcuts'))}
            className="relative w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors shrink-0"
            title="Keyboard shortcuts (?)"
            aria-label="Show keyboard shortcuts"
          >
            <span className="font-mono text-sm font-bold text-muted-foreground">?</span>
          </button>

          {/* Help button */}
          <div className="relative shrink-0" ref={helpRef}>
            <button
              onClick={() => { setHelpOpen(o => !o); setNotifOpen(false); setUserMenuOpen(false); }}
              className="relative w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
              aria-label="Help"
            >
              <HelpCircle size={16} className="text-muted-foreground" />
            </button>
          </div>

          {/* Notification bell */}
          <div className="relative shrink-0" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen(o => !o); setUserMenuOpen(false); setHelpOpen(false); }}
              className="relative w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            >
              <Bell size={16} className="text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-0.5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-[8px] font-bold text-white leading-none">{unreadCount > 99 ? '99+' : unreadCount}</span>
                </span>
              )}
            </button>
            {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} navigate={navigate} />}
          </div>

          {/* User avatar + settings */}
          <div className="relative pl-2 border-l border-border ml-1 shrink-0" ref={userMenuRef}>
            <button
              onClick={() => { setUserMenuOpen(o => !o); setNotifOpen(false); }}
              className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="User settings"
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-primary leading-none">{initials}</span>
              </div>
              <span className="text-xs font-medium text-foreground hidden md:block max-w-[90px] truncate">
                {currentUser?.name?.split(' ')[0] ?? 'User'}
              </span>
              <ChevronDown size={11} className={`text-muted-foreground transition-transform hidden md:block ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+4px)] z-[100] bg-card border border-border rounded-xl shadow-2xl">
                <UserMenu currentUser={currentUser} onLogout={onLogout} />
              </div>
            )}
          </div>
        </div>
      </header>

      {showDialog && (
        <UnsavedDialog
          onConfirm={() => { setShowDialog(false); pendingAction(); }}
          onCancel={() => setShowDialog(false)}
        />
      )}

      {/* Help slide-over */}
      {helpOpen && (
        <div className="fixed inset-0 z-[150] flex justify-end" onClick={() => setHelpOpen(false)}>
          <div
            className="w-[360px] h-full bg-card border-l border-border shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-indigo-600 px-5 py-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Help: {pageLabel || 'Jeshan Labs'}</h2>
              <button
                onClick={() => setHelpOpen(false)}
                className="text-indigo-200 hover:text-white transition-colors"
                aria-label="Close help panel"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Getting Started */}
              <div>
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Getting Started</h3>
                <ol className="space-y-3">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">1</span>
                    <span className="text-sm text-muted-foreground">Navigate to the feature you need using the home screen or back button.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">2</span>
                    <span className="text-sm text-muted-foreground">Click the action button to perform the operation you need.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">3</span>
                    <span className="text-sm text-muted-foreground">Check the notifications bell for updates and confirmations.</span>
                  </li>
                </ol>
              </div>

              {/* Common Questions */}
              <div>
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Common Questions</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">How do I export data?</p>
                    <p className="text-sm text-muted-foreground mt-1">Use the Export button on the top right of any list view to download data in CSV format.</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">How do I filter results?</p>
                    <p className="text-sm text-muted-foreground mt-1">Use the filter chips or search bar at the top of each view to narrow down results.</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">How do I change my role or permissions?</p>
                    <p className="text-sm text-muted-foreground mt-1">Contact your administrator to update your role. Admins can manage permissions in User Management.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border">
              <button
                onClick={() => { navigate('/documentation'); setHelpOpen(false); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                View Full Documentation →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
