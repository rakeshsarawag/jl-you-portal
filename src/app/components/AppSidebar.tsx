import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useUser } from '../context/UserContext';
import { APP_REGISTRY } from '../../constants/appRegistry';
import { usePermissions } from '../hooks/usePermissions';
import { UserMenu } from './AppHeader';
import {
  LayoutDashboard, Users, UserPlus, ClipboardList, TrendingUp, BookOpen,
  DollarSign, FileText, Database, Kanban, Bug, Target, Monitor, Wrench,
  FolderOpen, MessageSquare, Linkedin, BarChart3, GitBranch, ShieldCheck,
  Cog, UserCog, Lock, ChevronLeft, ChevronRight, Home, CalendarCheck, Pin, PinOff,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  LayoutDashboard, Users, UserPlus, ClipboardList, TrendingUp, BookOpen,
  DollarSign, FileText, Database, Kanban, Bug, Target, Monitor, Wrench,
  FolderOpen, MessageSquare, Linkedin, BarChart3, GitBranch, ShieldCheck,
  Cog, UserCog, Lock, Home, CalendarCheck,
};

const PANEL_BG = 'rgb(14,23,42)';
const ACTIVE_BG = 'rgb(30,78,216)';

const CATEGORY_ORDER = ['core', 'hr', 'finance', 'analytics', 'collaboration', 'admin'];
const CATEGORY_LABELS: Record<string, string> = {
  core: 'Core',
  hr: 'People & HR',
  finance: 'Finance',
  analytics: 'Analytics',
  collaboration: 'Collaboration',
  admin: 'Administration',
};

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (email ?? 'U')[0].toUpperCase();
}

interface AppSidebarProps {
  onLogout: () => void;
}

export function AppSidebar({ onLogout }: AppSidebarProps) {
  const { currentUser } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef<HTMLElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [pinned, setPinned] = useState(() => localStorage.getItem('jl-sidebar-pinned') === 'true');
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isExpanded = pinned || hoverExpanded;

  const isLaunchpad = location.pathname === '/';

  // Collapse hover on navigation when not pinned
  useEffect(() => {
    if (!pinned) setHoverExpanded(false);
    setUserMenuOpen(false);
  }, [location.pathname, pinned]);

  // Update the global sidebar width CSS variable
  useLayoutEffect(() => {
    const w = isLaunchpad ? 0 : isExpanded ? 220 : 56;
    document.documentElement.style.setProperty('--global-sidebar-w', `${w}px`);
  }, [isExpanded, isLaunchpad]);

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  const userRoles = currentUser?.roles ?? (currentUser?.primaryRole ? [currentUser.primaryRole] : []);
  const isAdmin = userRoles.includes('admin');
  const { canSeeApp, matrixLoaded } = usePermissions(userRoles, currentUser?.permissionOverrides ?? []);

  const accessibleApps = APP_REGISTRY.filter(app => {
    if (isAdmin) return true;
    if (!matrixLoaded) return false;
    return canSeeApp(app.appId);
  });

  const grouped = CATEGORY_ORDER.reduce<Record<string, typeof APP_REGISTRY>>((acc, cat) => {
    const apps = accessibleApps.filter(a => a.category === cat);
    if (apps.length > 0) acc[cat] = apps;
    return acc;
  }, {});

  function togglePin() {
    const next = !pinned;
    setPinned(next);
    localStorage.setItem('jl-sidebar-pinned', String(next));
    if (!next) setHoverExpanded(false);
  }

  function handleAppClick(path: string) {
    navigate(path);
    if (!pinned) setHoverExpanded(false);
  }

  if (isLaunchpad) return null;

  const initials = getInitials(currentUser?.name, currentUser?.email);

  return (
    <>
      {/* User menu dropdown — rendered outside aside so it can overflow */}
      {userMenuOpen && currentUser && (
        <div
          ref={userMenuRef}
          className="fixed bottom-16 left-2 z-[60] bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          style={{ minWidth: '260px' }}
        >
          <UserMenu currentUser={currentUser} onLogout={onLogout} />
        </div>
      )}

      <aside
        ref={sidebarRef}
        onMouseEnter={() => { if (!pinned) setHoverExpanded(true); }}
        onMouseLeave={() => { if (!pinned) setHoverExpanded(false); }}
        style={{
          backgroundColor: PANEL_BG,
          width: isExpanded ? '220px' : '56px',
          transition: 'width 180ms ease-in-out',
        }}
        className="fixed top-12 left-0 bottom-0 z-40 flex flex-col overflow-hidden border-r border-white/5"
      >
        {/* Header row: Navigation label + pin button */}
        <div
          className={`flex items-center h-11 shrink-0 border-b border-white/5 ${isExpanded ? 'justify-between px-3' : 'justify-center'}`}
        >
          {isExpanded && (
            <span className="text-[10px] font-semibold tracking-widest uppercase text-white/30 select-none">
              Navigation
            </span>
          )}
          <button
            onClick={togglePin}
            title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
            className="h-7 w-7 rounded-md flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            {pinned
              ? <PinOff className="h-3.5 w-3.5" strokeWidth={1.5} />
              : <Pin className="h-3.5 w-3.5" strokeWidth={1.5} />
            }
          </button>
        </div>

        {/* App list */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-none">
          {/* Home */}
          <div className="px-2 mb-1">
            <SidebarItem
              icon={<Home className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />}
              label="Home"
              active={location.pathname === '/'}
              expanded={isExpanded}
              onClick={() => { navigate('/'); if (!pinned) setHoverExpanded(false); }}
            />
          </div>

          {Object.entries(grouped).map(([cat, apps]) => (
            <div key={cat} className="mb-1">
              {isExpanded && (
                <p className="px-3 pt-3 pb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/25 select-none">
                  {CATEGORY_LABELS[cat]}
                </p>
              )}
              {!isExpanded && (
                <div className="mx-3 my-2 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
              )}
              <div className="px-2 space-y-0.5">
                {apps.map(app => {
                  const Icon = ICON_MAP[app.icon] ?? Monitor;
                  const isActive = location.pathname === app.path ||
                    (app.path !== '/' && location.pathname.startsWith(app.path));
                  return (
                    <SidebarItem
                      key={app.appId}
                      icon={<Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />}
                      label={app.label}
                      active={isActive}
                      expanded={isExpanded}
                      onClick={() => handleAppClick(app.path)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: user avatar */}
        <div className="px-2 pb-3 pt-2 shrink-0 border-t border-white/5">
          <button
            onClick={() => setUserMenuOpen(o => !o)}
            title={!isExpanded ? (currentUser?.name ?? 'User') : undefined}
            className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5 ${!isExpanded ? 'justify-center' : ''}`}
          >
            {/* Avatar circle */}
            <div
              className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center"
              style={{ backgroundColor: ACTIVE_BG }}
            >
              <span className="text-[11px] font-bold text-white leading-none">{initials}</span>
            </div>
            {isExpanded && (
              <div className="min-w-0 text-left">
                <p className="text-[12px] font-semibold text-white/80 truncate leading-tight">
                  {currentUser?.name ?? currentUser?.email ?? 'User'}
                </p>
                <p className="text-[10px] text-white/35 truncate leading-tight">
                  {currentUser?.primaryRole ?? 'Member'}
                </p>
              </div>
            )}
            {isExpanded && (
              <ChevronRight className="ml-auto h-3.5 w-3.5 text-white/25 shrink-0" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

function SidebarItem({
  icon, label, active, expanded, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={!expanded ? label : undefined}
      style={active ? { backgroundColor: ACTIVE_BG } : undefined}
      className={`
        w-full flex items-center gap-2.5 rounded-lg px-2 py-[7px] text-sm font-medium
        transition-all duration-100 cursor-pointer group
        ${active ? 'text-white shadow-sm' : 'text-white/45 hover:bg-white/6 hover:text-white/80'}
        ${!expanded ? 'justify-center' : ''}
      `}
    >
      <span className={`flex items-center justify-center transition-colors ${active ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`}>
        {icon}
      </span>
      {expanded && (
        <span className="truncate leading-tight text-[13px]">{label}</span>
      )}
      {active && expanded && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/70 shrink-0" />
      )}
    </button>
  );
}
