import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Bell, Check, Trash2, Clock, ChevronLeft, ChevronRight,
  Info, AlertTriangle, CheckCircle, BellRing, Search, X,
  Settings, Filter,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { supabase } from '../utils/constants';
import { useUser } from '../context/UserContext';
import { t } from '../../i18n';

// ── Types ──────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'action_required' | 'success';
  app_filter: string;
  entity_type?: string;
  entity_id?: string;
  deep_link?: string;
  is_read: boolean;
  read_at?: string;
  snoozed_until?: string;
  action_data?: Record<string, unknown>;
  created_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const APP_FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'directory', label: 'Directory' },
  { key: 'recruitment', label: 'Recruitment' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'user-mgmt', label: 'User Mgmt' },
  { key: 'performance', label: 'Performance' },
  { key: 'training', label: 'Training' },
  { key: 'communications', label: 'Comms' },
  { key: 'collaboration', label: 'Collab' },
  { key: 'workflow', label: 'Workflow' },
  { key: 'it-services', label: 'IT Services' },
  { key: 'assets', label: 'Assets' },
  { key: 'projects', label: 'Projects' },
];

const PAGE_SIZE = 50;

const SNOOZE_OPTIONS = [
  { label: '30 minutes', ms: 30 * 60 * 1000 },
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '4 hours', ms: 4 * 60 * 60 * 1000 },
  { label: '8 hours', ms: 8 * 60 * 60 * 1000 },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function typeConfig(type: Notification['type']) {
  switch (type) {
    case 'success': return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', border: 'border-l-green-500' };
    case 'warning': return { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-l-amber-500' };
    case 'action_required': return { icon: BellRing, color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-l-purple-500' };
    default: return { icon: Info, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-l-blue-500' };
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function NotificationHistoryPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [snoozeTarget, setSnoozeTarget] = useState<string | null>(null);

  // Filters
  const [appTab, setAppTab] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    let q = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .gte('created_at', `${dateFrom}T00:00:00Z`)
      .lte('created_at', `${dateTo}T23:59:59Z`)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (appTab !== 'all') q = q.eq('app_filter', appTab);
    if (typeFilter !== 'all') q = q.eq('type', typeFilter);
    if (statusFilter === 'unread') q = q.eq('is_read', false);
    if (statusFilter === 'read') q = q.eq('is_read', true);
    if (statusFilter === 'snoozed') q = q.not('snoozed_until', 'is', null).gt('snoozed_until', new Date().toISOString());
    if (search) q = q.ilike('title', `%${search}%`);

    const { data, count } = await q;
    setNotifications((data as Notification[]) ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [user?.id, appTab, typeFilter, statusFilter, search, dateFrom, dateTo, page]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Bulk actions ─────────────────────────────────────────────────────────

  const markSelected = async (ids: string[]) => {
    if (!ids.length) return;
    void supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).in('id', ids.slice(0, 500));
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n));
    setSelected(new Set());
  };

  const deleteSelected = async (ids: string[]) => {
    if (!ids.length) return;
    void supabase.from('notifications').delete().in('id', ids.slice(0, 500));
    setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
    setTotal(prev => Math.max(0, prev - ids.length));
    setSelected(new Set());
  };

  const snoozeNotification = async (id: string, ms: number) => {
    const snoozed_until = new Date(Date.now() + ms).toISOString();
    void supabase.from('notifications').update({ snoozed_until }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, snoozed_until } : n));
    setSnoozeTarget(null);
  };

  const markOneRead = (id: string) => {
    void supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const deleteOne = (id: string) => {
    void supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    setTotal(prev => Math.max(0, prev - 1));
  };

  // ── Toggle selection ─────────────────────────────────────────────────────

  const toggleAll = () => {
    if (selected.size === notifications.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(notifications.map(n => n.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Tab scroll arrows ─────────────────────────────────────────────────────

  const scrollTabs = (dir: 'left' | 'right') => {
    if (scrollRef.current) scrollRef.current.scrollLeft += dir === 'left' ? -150 : 150;
  };

  const selectedIds = Array.from(selected);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Notifications</h1>
            <p className="text-sm text-gray-400 mt-0.5">{total} notifications</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/notifications/preferences')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings size={16} />
              <span>Preferences</span>
            </button>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* App filter tabs */}
          <div className="flex items-center gap-1">
            <button onClick={() => scrollTabs('left')} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
              <ChevronLeft size={16} />
            </button>
            <div
              ref={scrollRef}
              className="flex gap-1 overflow-x-auto scrollbar-none flex-1"
              style={{ scrollbarWidth: 'none' }}
            >
              {APP_FILTER_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setAppTab(tab.key); setPage(0); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    appTab === tab.key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button onClick={() => scrollTabs('right')} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Row 2 filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700"
            >
              <option value="all">All Types</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="action_required">Action Required</option>
              <option value="success">Success</option>
            </select>

            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700"
            >
              <option value="all">All Status</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
              <option value="snoozed">Snoozed</option>
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(0); }}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700"
            />
            <span className="text-gray-400 text-sm">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(0); }}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700"
            />

            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                placeholder="Search notifications..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-4">
        {/* Bulk toolbar */}
        {selected.size > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 mb-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-indigo-700">{selected.size} selected</span>
            <button
              onClick={() => markSelected(selectedIds)}
              className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <Check size={14} /> Mark Read
            </button>
            <button
              onClick={() => deleteSelected(selectedIds)}
              className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <Trash2 size={14} /> Delete
            </button>
            <button
              onClick={() => setSnoozeTarget('bulk')}
              className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
            >
              <Clock size={14} /> Snooze
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-gray-400 ml-auto"
            >
              ✕ Clear selection
            </button>
          </div>
        )}

        {/* Snooze picker (bulk) */}
        {snoozeTarget === 'bulk' && (
          <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3 flex flex-wrap gap-2">
            <span className="text-sm text-gray-600 mr-2">Snooze for:</span>
            {SNOOZE_OPTIONS.map(opt => (
              <button
                key={opt.label}
                onClick={async () => {
                  const until = new Date(Date.now() + opt.ms).toISOString();
                  void supabase.from('notifications').update({ snoozed_until: until }).in('id', selectedIds.slice(0, 500));
                  setNotifications(prev => prev.map(n => selected.has(n.id) ? { ...n, snoozed_until: until } : n));
                  setSelected(new Set());
                  setSnoozeTarget(null);
                }}
                className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
              >
                {opt.label}
              </button>
            ))}
            <button onClick={() => setSnoozeTarget(null)} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        )}

        {/* Select all row */}
        {notifications.length > 0 && (
          <div className="flex items-center gap-3 mb-2 px-1">
            <input
              type="checkbox"
              checked={selected.size === notifications.length && notifications.length > 0}
              onChange={toggleAll}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-300"
            />
            <span className="text-xs text-gray-500">Select all on this page</span>
            {selected.size === 0 && (
              <button
                onClick={() => markSelected(notifications.filter(n => !n.is_read).map(n => n.id))}
                className="text-xs text-indigo-600 hover:text-indigo-800 ml-auto"
              >
                Mark all as read
              </button>
            )}
          </div>
        )}

        {/* Notification list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No notifications found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => {
              const cfg = typeConfig(n.type);
              const Icon = cfg.icon;
              const isSnoozed = n.snoozed_until && new Date(n.snoozed_until) > new Date();
              return (
                <div
                  key={n.id}
                  className={`group bg-white border border-gray-200 border-l-4 ${cfg.border} rounded-lg px-4 py-3 flex items-center gap-3 ${
                    !n.is_read ? 'bg-indigo-50/30' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(n.id)}
                    onChange={() => toggleOne(n.id)}
                    className="flex-shrink-0 rounded border-gray-300 text-indigo-600"
                  />
                  <div className={`flex-shrink-0 w-8 h-8 ${cfg.bg} rounded-full flex items-center justify-center`}>
                    <Icon size={16} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-semibold text-gray-900 ${!n.is_read ? 'font-bold' : ''}`}>
                        {n.title}
                      </span>
                      {n.app_filter && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full capitalize">
                          {n.app_filter}
                        </span>
                      )}
                      {isSnoozed && (
                        <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Clock size={9} /> Snoozed
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{timeAgo(n.created_at)}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{n.body}</p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      n.is_read ? 'bg-gray-100 text-gray-500' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {n.is_read ? 'Read' : 'Unread'}
                    </span>
                    {/* Action icons on hover */}
                    <div className="hidden group-hover:flex items-center gap-1 ml-1">
                      {!n.is_read && (
                        <button
                          onClick={() => markOneRead(n.id)}
                          title="Mark as read"
                          className="p-1 text-gray-400 hover:text-green-600 rounded"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => setSnoozeTarget(n.id)}
                        title="Snooze"
                        className="p-1 text-gray-400 hover:text-amber-600 rounded"
                      >
                        <Clock size={14} />
                      </button>
                      <button
                        onClick={() => deleteOne(n.id)}
                        title="Delete"
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {/* Snooze picker for single */}
                    {snoozeTarget === n.id && (
                      <div className="absolute right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-20 flex flex-col gap-1 min-w-[140px]">
                        {SNOOZE_OPTIONS.map(opt => (
                          <button
                            key={opt.label}
                            onClick={() => snoozeNotification(n.id, opt.ms)}
                            className="text-sm text-left px-2 py-1 hover:bg-gray-50 rounded text-gray-700"
                          >
                            {opt.label}
                          </button>
                        ))}
                        <button onClick={() => setSnoozeTarget(null)} className="text-xs text-gray-400 px-2 py-1 text-left">Cancel</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-1 py-6 flex-wrap">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-40 flex items-center gap-1"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i).map(i => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`px-3 py-1.5 text-sm rounded ${
                  page === i ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {i + 1}
              </button>
            ))}
            {totalPages > 10 && <span className="text-gray-400">...</span>}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-40 flex items-center gap-1"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
