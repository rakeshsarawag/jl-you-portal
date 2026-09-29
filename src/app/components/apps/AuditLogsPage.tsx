import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Search, Download, RefreshCw, AlertTriangle,
  CheckCircle, XCircle, Info, AlertCircle, Filter, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { API_BASE, apiHeaders, safeJson } from '../utils/constants';
import { useUser } from '../context/UserContext';

const AUDIT_URL = `${API_BASE}/audit-logs`;

interface AuditLog {
  id: string;
  created_at: string;
  user_email: string | null;
  user_role: string | null;
  event_type: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  status: 'success' | 'failure';
  ip_address: string | null;
  metadata: Record<string, any>;
}

interface Stats {
  total: number;
  today: number;
  failures_7d: number;
  severityCounts: Record<string, number>;
  typeCounts: Record<string, number>;
}

const SEVERITY_CONFIG: Record<string, { color: string; icon: React.FC<any>; label: string }> = {
  info:     { color: 'bg-blue-100 text-blue-700',    icon: Info,          label: 'Info' },
  low:      { color: 'bg-green-100 text-green-700',  icon: CheckCircle,   label: 'Low' },
  medium:   { color: 'bg-yellow-100 text-yellow-700',icon: AlertCircle,   label: 'Medium' },
  high:     { color: 'bg-orange-100 text-orange-700',icon: AlertTriangle, label: 'High' },
  critical: { color: 'bg-red-100 text-red-700',      icon: XCircle,       label: 'Critical' },
};

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.info;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return status === 'success'
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle size={11} />Success</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle size={11} />Failure</span>;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function AuditLogsPage({ accessToken }: { accessToken: string }) {
  const { currentUser } = useUser();
  const userEmail = currentUser?.email ?? '';

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [exporting, setExporting] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    user_email: '',
    event_type: '',
    resource_type: '',
    severity: '',
    status: '',
    from_date: '',
    to_date: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const loadStats = useCallback(async () => {
    const res = await fetch(`${AUDIT_URL}/stats`, { headers: apiHeaders(userEmail) });
    const data = await safeJson(res);
    if (data?.success) setStats(data.data);
  }, [userEmail]);

  const loadLogs = useCallback(async (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: '50' });
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    const res = await fetch(`${AUDIT_URL}?${params}`, { headers: apiHeaders(userEmail) });
    const data = await safeJson(res);
    if (data?.success) {
      setLogs(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    }
    setLoading(false);
  }, [filters, userEmail]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { setPage(1); loadLogs(1); }, [filters]);
  useEffect(() => { loadLogs(page); }, [page]);

  const handleExport = async () => {
    setExporting(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    const res = await fetch(`${AUDIT_URL}/export?${params}`, { headers: apiHeaders(userEmail) });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const StatCard = ({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) => (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Audit Logs</h1>
              <p className="text-xs text-muted-foreground">Immutable record of all system activity</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { loadStats(); loadLogs(page); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Download size={14} />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        </div>

        {/* Stat tiles */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Events" value={stats.total?.toLocaleString() ?? '—'} color="text-foreground" />
            <StatCard label="Today" value={stats.today ?? 0} sub="events logged" color="text-blue-600" />
            <StatCard label="Failures (7d)" value={stats.failures_7d ?? 0} sub="needs review" color={stats.failures_7d > 0 ? 'text-red-600' : 'text-green-600'} />
            <StatCard label="Critical (30d)" value={stats.severityCounts?.critical ?? 0} sub="high severity" color={stats.severityCounts?.critical > 0 ? 'text-red-600' : 'text-green-600'} />
          </div>
        )}

        {/* Search + filter bar */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search action, user, resource ID…"
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${showFilters ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
            >
              <Filter size={14} />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-border">
              <input
                type="text"
                placeholder="User email"
                value={filters.user_email}
                onChange={e => setFilters(f => ({ ...f, user_email: e.target.value }))}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <select
                value={filters.severity}
                onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Severities</option>
                {['info', 'low', 'medium', 'high', 'critical'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={filters.status}
                onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Statuses</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
              <input
                type="text"
                placeholder="Event type"
                value={filters.event_type}
                onChange={e => setFilters(f => ({ ...f, event_type: e.target.value }))}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                type="date"
                value={filters.from_date}
                onChange={e => setFilters(f => ({ ...f, from_date: e.target.value }))}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                type="date"
                value={filters.to_date}
                onChange={e => setFilters(f => ({ ...f, to_date: e.target.value }))}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={() => setFilters({ search: '', user_email: '', event_type: '', resource_type: '', severity: '', status: '', from_date: '', to_date: '' })}
                className="col-span-2 sm:col-span-1 text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{total.toLocaleString()} events found</span>
          <span>Page {page} of {totalPages}</span>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Timestamp</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resource</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Severity</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-muted animate-pulse rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No audit events found matching your filters.
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap font-mono">
                        {fmtDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-foreground truncate max-w-[160px]">{log.user_email ?? '—'}</div>
                        {log.user_role && <div className="text-xs text-muted-foreground capitalize">{log.user_role}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-foreground">{log.action}</div>
                        <div className="text-xs text-muted-foreground">{log.event_type}</div>
                      </td>
                      <td className="px-4 py-3">
                        {log.resource_type && (
                          <div className="text-xs">
                            <span className="font-medium text-foreground">{log.resource_type}</span>
                            {log.resource_id && <span className="text-muted-foreground"> #{log.resource_id.slice(0, 8)}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3"><SeverityBadge severity={log.severity} /></td>
                      <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{log.ip_address ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default AuditLogsPage;
