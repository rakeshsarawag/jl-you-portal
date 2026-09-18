import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Bell,
  BellOff,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Settings,
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  Info,
  BellRing,
  Check,
  Moon,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { supabase } from '../utils/constants';
import { useUser } from '../context/UserContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { t } from '../../i18n';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'action_required' | 'success';
  app_filter: string;
  is_read: boolean;
  read_at?: string | null;
  snoozed_until?: string | null;
  deep_link?: string | null;
  action_data?: { approval_id?: string; approve_url?: string; reject_url?: string } | null;
  created_at: string;
  severity?: string | null;
}

type AppFilterKey =
  | 'all'
  | 'dashboard'
  | 'directory'
  | 'recruitment'
  | 'onboarding'
  | 'user-mgmt'
  | 'performance'
  | 'training'
  | 'communications'
  | 'collaboration'
  | 'workflow'
  | 'it-services'
  | 'assets'
  | 'projects'
  | 'okr'
  | 'executive'
  | 'analytics'
  | 'security'
  | 'invoices'
  | 'payroll';

const APP_FILTER_TABS: { key: AppFilterKey; label: string }[] = [
  { key: 'all', label: t('notificationBell.tabAll') },
  { key: 'workflow', label: t('notificationBell.tabWorkflow') },
  { key: 'dashboard', label: t('notificationBell.tabDashboard') },
  { key: 'okr', label: t('notificationBell.tabOkr') },
  { key: 'performance', label: t('notificationBell.tabPerformance') },
  { key: 'collaboration', label: t('notificationBell.tabCollaboration') },
  { key: 'recruitment', label: t('notificationBell.tabRecruitment') },
  { key: 'onboarding', label: t('notificationBell.tabOnboarding') },
  { key: 'training', label: t('notificationBell.tabTraining') },
  { key: 'directory', label: t('notificationBell.tabDirectory') },
  { key: 'communications', label: t('notificationBell.tabCommunications') },
  { key: 'user-mgmt', label: t('notificationBell.tabUserMgmt') },
  { key: 'it-services', label: t('notificationBell.tabItServices') },
  { key: 'assets', label: t('notificationBell.tabAssets') },
  { key: 'projects', label: t('notificationBell.tabProjects') },
  { key: 'executive', label: t('notificationBell.tabExecutive') },
  { key: 'analytics', label: t('notificationBell.tabAnalytics') },
  { key: 'security', label: t('notificationBell.tabSecurity') },
  { key: 'invoices', label: t('notificationBell.tabInvoices') },
  { key: 'payroll', label: t('notificationBell.tabPayroll') },
];

const SNOOZE_OPTIONS = [
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '4 hours', minutes: 240 },
  { label: '8 hours', minutes: 480 },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function isSnoozed(n: Notification): boolean {
  return !!n.snoozed_until && new Date(n.snoozed_until) > new Date();
}

// ── Sub-components ─────────────────────────────────────────────────────────

function TypeIcon({ type, read }: { type: Notification['type']; read: boolean }) {
  const dim = read ? 'opacity-60' : '';
  if (type === 'action_required')
    return (
      <span className={`flex items-center justify-center w-8 h-8 rounded-full bg-red-100 ${dim}`}>
        <BellRing className="h-4 w-4 text-red-500" />
      </span>
    );
  if (type === 'warning')
    return (
      <span className={`flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 ${dim}`}>
        <AlertTriangle className="h-4 w-4 text-amber-500" />
      </span>
    );
  if (type === 'success')
    return (
      <span className={`flex items-center justify-center w-8 h-8 rounded-full bg-green-100 ${dim}`}>
        <CheckCircle className="h-4 w-4 text-green-500" />
      </span>
    );
  return (
    <span className={`flex items-center justify-center w-8 h-8 rounded-full ${read ? 'bg-gray-100' : 'bg-blue-100'} ${dim}`}>
      <Info className={`h-4 w-4 ${read ? 'text-gray-400' : 'text-blue-500'}`} />
    </span>
  );
}

function rowBg(n: Notification) {
  if (n.type === 'action_required') return 'bg-red-50';
  if (n.type === 'warning') return 'bg-amber-50';
  if (n.type === 'success') return 'bg-green-50';
  if (!n.is_read) return 'bg-indigo-50';
  return 'bg-white';
}

function leftBorder(n: Notification) {
  if (!n.is_read || n.type === 'action_required') {
    if (n.type === 'action_required') return 'border-l-[3px] border-l-red-500';
    if (n.type === 'warning') return 'border-l-[3px] border-l-amber-500';
    if (n.type === 'success') return 'border-l-[3px] border-l-green-500';
    return 'border-l-[3px] border-l-blue-400';
  }
  return '';
}

function SkeletonItem() {
  return (
    <div className="px-4 py-3 border-b border-gray-100 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-full mb-1" />
      <div className="h-3 bg-gray-100 rounded w-1/3" />
    </div>
  );
}

function SnoozeDropdown({
  onSnooze,
  onClose,
}: {
  onSnooze: (minutes: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-8 top-0 z-[60] bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
      {SNOOZE_OPTIONS.map((opt) => (
        <button
          key={opt.minutes}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          onClick={(e) => {
            e.stopPropagation();
            onSnooze(opt.minutes);
            onClose();
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
  onSnooze,
  onApprove,
  onReject,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  onApprove: (notification: Notification) => void;
  onReject: (notification: Notification) => void;
}) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
  const [actionStatus, setActionStatus] = useState<'idle' | 'approved' | 'rejected'>('idle');

  function handleClick() {
    if (!notification.is_read) onMarkRead(notification.id);
    if (notification.deep_link) navigate(notification.deep_link);
  }

  const approvalId = notification.action_data?.approval_id;
  const hasApproval = notification.type === 'action_required' && !!approvalId;

  return (
    <div
      role="listitem"
      className={`relative px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors group ${rowBg(notification)} ${leftBorder(notification)}`}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowSnooze(false); }}
    >
      <div className="flex items-start gap-3">
        {/* Unread dot */}
        {!notification.is_read && (
          <button
            className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-indigo-500 hover:bg-indigo-700 flex-shrink-0 focus:outline-none"
            title={t('notificationBell.markRead')}
            onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
          />
        )}

        {(notification.severity === 'critical' || ['critical_audit_event', 'login_failure_spike', 'sla_breach_spike'].includes(notification.type)) && (
          <span className="relative flex h-2 w-2 mr-2 flex-shrink-0 mt-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
        )}
        <TypeIcon type={notification.type} read={notification.is_read} />

        <div className="flex-1 min-w-0">
          {/* Row 1: title + app chip + time */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={`text-sm truncate ${notification.is_read ? 'font-normal text-gray-700' : 'font-semibold text-gray-900'}`}>
              {notification.title}
            </p>
            {notification.app_filter && notification.app_filter !== 'all' && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded whitespace-nowrap">
                {notification.app_filter}
              </span>
            )}
            <span className="text-xs text-gray-400 ml-auto whitespace-nowrap flex-shrink-0">
              {timeAgo(notification.created_at)}
            </span>
          </div>

          {/* Row 2: body */}
          <p className="text-xs text-gray-500 mt-0.5 truncate">{notification.body}</p>

          {/* Row 3: approve/reject */}
          {hasApproval && actionStatus === 'idle' && (
            <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
              <button
                className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1 rounded transition-colors"
                onClick={() => { onApprove(notification); setActionStatus('approved'); }}
              >
                <Check className="h-3 w-3" />
                {t('notificationBell.approve')}
              </button>
              <button
                className="flex items-center gap-1 border border-red-400 text-red-500 hover:bg-red-50 text-xs px-3 py-1 rounded transition-colors"
                onClick={() => { onReject(notification); setActionStatus('rejected'); }}
              >
                <X className="h-3 w-3" />
                {t('notificationBell.reject')}
              </button>
            </div>
          )}
          {actionStatus === 'approved' && (
            <span className="inline-block mt-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              {t('notificationBell.approved')}
            </span>
          )}
          {actionStatus === 'rejected' && (
            <span className="inline-block mt-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {t('notificationBell.rejected')}
            </span>
          )}
        </div>

        {/* Hover actions */}
        {hovered && (
          <div className="relative flex flex-col gap-1 flex-shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
            <button
              className="text-gray-400 hover:text-gray-600 p-0.5"
              title={t('notificationBell.snooze')}
              onClick={() => setShowSnooze((v) => !v)}
            >
              <Clock className="h-3.5 w-3.5" />
            </button>
            <button
              className="text-gray-400 hover:text-red-500 p-0.5"
              title={t('notificationBell.delete')}
              onClick={() => onDelete(notification.id)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {showSnooze && (
              <SnoozeDropdown
                onSnooze={(mins) => onSnooze(notification.id, mins)}
                onClose={() => setShowSnooze(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PushToggle() {
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } = usePushNotifications();
  if (!supported) return null;
  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-2">
        <BellOff className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-xs text-gray-400">{t('notificationBell.pushBlocked')}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        <Bell className="h-3.5 w-3.5 text-gray-500" />
        <span className="text-xs text-gray-600 font-medium">{t('notificationBell.pushLabel')}</span>
      </div>
      <button
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={loading}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:opacity-60 ${subscribed ? 'bg-indigo-600' : 'bg-gray-200'}`}
        aria-label={subscribed ? t('notificationBell.pushDisable') : t('notificationBell.pushEnable')}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 text-white mx-auto animate-spin" />
        ) : (
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform ${subscribed ? 'translate-x-4' : 'translate-x-0.5'}`} />
        )}
      </button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function NotificationBell() {
  const { currentUser } = useUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<AppFilterKey>('all');
  const [quietHours, setQuietHours] = useState<{ enabled: boolean; start: string; end: string }>({
    enabled: false, start: '22:00', end: '07:00'
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission | 'unknown'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unknown'
  );
  const { subscribe: subscribeToPush } = usePushNotifications();

  // ── Fetch initial notifications ────────────────────────────────────────

  const normalizeNotification = (row: Record<string, unknown>): Notification => ({
    ...row,
    // body and message are both used across different inserts — normalise to body
    body: (row.body ?? row.message ?? '') as string,
    // read and is_read are both present — normalise to is_read
    is_read: Boolean(row.is_read ?? row.read ?? false),
    app_filter: (row.app_filter ?? row.app ?? 'all') as string,
  } as Notification);

  const fetchNotifications = useCallback(async () => {
    console.log('[NotifBell] currentUser:', currentUser?.id, 'appUserId:', currentUser?.appUserId);
    if (!currentUser?.id) { setLoading(false); return; }
    const ids = [...new Set([
      currentUser.id,
      currentUser.appUserId,
      currentUser.employeeId,
    ].filter(Boolean))] as string[];
    console.log('[NotifBell] querying with ids:', ids);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .in('user_id', ids)
      .order('created_at', { ascending: false })
      .limit(100);
    console.log('[NotifBell] result — rows:', data?.length ?? 0, 'error:', error?.message ?? null, 'sample user_id:', data?.[0]?.user_id ?? 'none');
    if (data) setNotifications(data.map(normalizeNotification));
    setLoading(false);
  }, [currentUser?.id, currentUser?.appUserId, currentUser?.employeeId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ── Load quiet hours settings ───────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser?.id) return;
    supabase.from('notification_preferences')
      .select('quiet_hours_enabled, quiet_hours_start, quiet_hours_end')
      .eq('user_id', currentUser.id)
      .single()
      .then(({ data }) => {
        if (data) setQuietHours({
          enabled: data.quiet_hours_enabled ?? false,
          start: data.quiet_hours_start ?? '22:00',
          end: data.quiet_hours_end ?? '07:00'
        });
      });
  }, [currentUser?.id]);

  const isQuietHoursActive = (): boolean => {
    if (!quietHours.enabled) return false;
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const { start, end } = quietHours;
    if (start <= end) return currentTime >= start && currentTime < end;
    return currentTime >= start || currentTime < end; // overnight range
  };

  // ── Realtime subscription ───────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser?.id) return;
    // Use appUserId for realtime filter (most inserts use app_users.id as target)
    const notifUserId = currentUser.appUserId ?? currentUser.id;

    const channel = supabase
      .channel('user-notifications-bell')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${notifUserId}`,
        },
        (payload) => {
          const incoming = normalizeNotification(payload.new as Record<string, unknown>);
          const suppress = isQuietHoursActive() && incoming.severity !== 'critical';
          setNotifications((prev) => [suppress ? { ...incoming, is_read: true } : incoming, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${notifUserId}`,
        },
        (payload) => {
          const updated = normalizeNotification(payload.new as Record<string, unknown>);
          setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[NotificationBell] Realtime subscription failed, falling back to polling');
          const fallback = setInterval(fetchNotifications, 60000);
          return () => clearInterval(fallback);
        }
      });

    return () => { void supabase.removeChannel(channel); };
  }, [currentUser?.id, currentUser?.appUserId, fetchNotifications]);

  // ── Outside click ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowDeleteConfirm(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  // ── Tab bar scroll detection ────────────────────────────────────────────

  function checkScroll() {
    const el = tabBarRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }

  useEffect(() => {
    const el = tabBarRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll);
    return () => el.removeEventListener('scroll', checkScroll);
  });

  // ── Derived state ───────────────────────────────────────────────────────

  const visibleNotifications = notifications.filter((n) => !isSnoozed(n));

  const unreadCount = visibleNotifications.filter((n) => !n.is_read).length;
  const hasActionRequired = visibleNotifications.some((n) => n.type === 'action_required' && !n.is_read);

  function tabCount(key: AppFilterKey): number {
    if (key === 'all') return unreadCount;
    return visibleNotifications.filter((n) => n.app_filter === key && !n.is_read).length;
  }

  function tabHasActionRequired(key: AppFilterKey): boolean {
    if (key === 'all') return hasActionRequired;
    return visibleNotifications.some((n) => n.app_filter === key && n.type === 'action_required' && !n.is_read);
  }

  const filteredNotifications =
    selectedTab === 'all'
      ? visibleNotifications
      : visibleNotifications.filter((n) => n.app_filter === selectedTab);

  const readCount = visibleNotifications.filter((n) => n.is_read).length;

  // ── Mutation helpers ────────────────────────────────────────────────────

  function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
    );
    void supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);
  }

  function markAllRead() {
    const unreadIds = visibleNotifications.filter((n) => !n.is_read).map((n) => n.id);
    if (!unreadIds.length) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at ?? new Date().toISOString() })));
    void supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', unreadIds);
  }

  function deleteNotification(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    void supabase.from('notifications').delete().eq('id', id);
  }

  function deleteAllRead() {
    const ids = visibleNotifications.filter((n) => n.is_read).map((n) => n.id);
    if (!ids.length) return;
    setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
    void supabase.from('notifications').delete().in('id', ids);
    setShowDeleteConfirm(false);
  }

  function snoozeNotification(id: string, minutes: number) {
    const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, snoozed_until: until } : n)));
    void supabase.from('notifications').update({ snoozed_until: until }).eq('id', id);
  }

  function handleApprove(notification: Notification) {
    markRead(notification.id);
    // Fire-and-forget approval via supabase if approval_id available
    const approvalId = notification.action_data?.approval_id;
    if (approvalId) {
      void supabase
        .from('workflow_approvals')
        .update({ status: 'approved', actioned_at: new Date().toISOString() })
        .eq('id', approvalId);
    }
  }

  function handleReject(notification: Notification) {
    markRead(notification.id);
    const approvalId = notification.action_data?.approval_id;
    if (approvalId) {
      void supabase
        .from('workflow_approvals')
        .update({ status: 'rejected', actioned_at: new Date().toISOString() })
        .eq('id', approvalId);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell button */}
      <button
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${t('notificationBell.title')}${unreadCount > 0 ? ` (${unreadCount} ${t('notificationBell.unread')})` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell className={`h-5 w-5 ${hasActionRequired ? 'text-red-500 animate-pulse' : 'text-gray-600'}`} />
        {unreadCount > 0 && (
          <span className={`absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-white text-[10px] font-bold leading-none ${hasActionRequired ? 'bg-red-500' : 'bg-indigo-600'}`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {isQuietHoursActive() && (
          <Moon className="w-3 h-3 text-gray-400 absolute -top-1 -right-1" />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden w-[380px] max-h-[520px] flex flex-col" role="dialog" aria-label="Notifications panel">

          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
            <span className="font-bold text-base text-gray-900">{t('notificationBell.title')}</span>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                {unreadCount} {t('notificationBell.unread')}
              </span>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {unreadCount > 0 && (
                <button
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                  onClick={markAllRead}
                >
                  {t('notificationBell.markAllRead')}
                </button>
              )}
              <button
                className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
                title={t('notificationBell.preferences')}
                onClick={() => { setOpen(false); navigate('/notifications/preferences'); }}
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Filter tab bar */}
          <div className="relative flex-shrink-0 border-b border-gray-200">
            {canScrollLeft && (
              <button
                className="absolute left-0 top-0 bottom-0 z-10 px-1 bg-gradient-to-r from-white to-transparent text-gray-400 hover:text-gray-600"
                onClick={() => { tabBarRef.current?.scrollBy({ left: -120, behavior: 'smooth' }); }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {canScrollRight && (
              <button
                className="absolute right-0 top-0 bottom-0 z-10 px-1 bg-gradient-to-l from-white to-transparent text-gray-400 hover:text-gray-600"
                onClick={() => { tabBarRef.current?.scrollBy({ left: 120, behavior: 'smooth' }); }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
            <div
              ref={tabBarRef}
              className="flex overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {APP_FILTER_TABS.map(({ key, label }) => {
                const count = tabCount(key);
                const isActive = selectedTab === key;
                const badgeDanger = tabHasActionRequired(key);
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedTab(key)}
                    className={`flex items-center gap-1 py-2 px-3 text-sm whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                      isActive
                        ? 'text-indigo-600 font-medium border-indigo-600'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    {label}
                    {count > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${badgeDanger ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-700'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop notification permission banner */}
          {typeof Notification !== 'undefined' && desktopPermission === 'default' && (
            <div className="mx-3 mb-2 mt-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2.5 flex items-center gap-2.5 flex-shrink-0">
              <Bell size={16} className="text-indigo-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-indigo-900">{t('notificationBell.enableDesktopTitle')}</p>
                <p className="text-[11px] text-indigo-600 mt-0.5">{t('notificationBell.enableDesktopBody')}</p>
              </div>
              <button
                onClick={async () => {
                  const permission = await Notification.requestPermission();
                  if (permission === 'granted') {
                    subscribeToPush?.();
                  }
                  setDesktopPermission(permission);
                }}
                className="flex-shrink-0 text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-md hover:bg-indigo-700 whitespace-nowrap"
              >
                {t('notificationBell.enableDesktopBtn')}
              </button>
              <button
                onClick={() => setDesktopPermission('denied')}
                className="flex-shrink-0 p-0.5 text-indigo-400 hover:text-indigo-600"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Notification list */}
          <div className="overflow-y-auto flex-1 max-h-[350px]" role="list" aria-label="Notifications">
            {loading ? (
              <>
                <SkeletonItem />
                <SkeletonItem />
                <SkeletonItem />
              </>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="h-12 w-12 text-gray-200 mb-3" />
                <p className="text-sm font-medium text-gray-500">{t('notificationBell.allCaughtUp')}</p>
                <p className="text-xs text-gray-400 mt-1">{t('notificationBell.noNotifications')}</p>
              </div>
            ) : (
              filteredNotifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onMarkRead={markRead}
                  onDelete={deleteNotification}
                  onSnooze={snoozeNotification}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              {readCount > 0 ? (
                showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">
                      {t('notificationBell.deleteReadConfirm').replace('{count}', String(readCount))}
                    </span>
                    <button
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                      onClick={deleteAllRead}
                    >
                      {t('common.delete')}
                    </button>
                    <button
                      className="text-xs text-gray-500 hover:text-gray-700"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('notificationBell.deleteAllRead')}
                  </button>
                )
              ) : (
                <span />
              )}
              <button
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                onClick={() => { setOpen(false); navigate('/notifications'); }}
              >
                {t('notificationBell.viewAll')} →
              </button>
            </div>
            <PushToggle />
            {desktopPermission === 'denied' && (
              <p className="text-[10px] text-gray-400 text-center px-3 mt-1">
                {t('notificationBell.desktopBlocked')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
