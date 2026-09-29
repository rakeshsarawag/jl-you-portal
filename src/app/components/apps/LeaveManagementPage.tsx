import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Calendar, CheckCircle, Clock, XCircle, Download, Search,
  Filter, ChevronLeft, ChevronRight, RefreshCw, Users, BarChart2,
} from "lucide-react";

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/make-server-1fe2c468`;

interface Leave {
  id: string;
  user_id: string;
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected" | "Cancelled";
  approver?: string;
  approved_date?: string;
  created_at: string;
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalDays: number;
  byType: Record<string, number>;
}

interface Props {
  accessToken: string;
  onLogout?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800",
  Approved: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  Cancelled: "bg-gray-100 text-gray-500",
};

const LEAVE_TYPES = ["Annual Leave", "Sick Leave", "Casual Leave", "Maternity Leave", "Paternity Leave", "LOP", "Compensatory Off", "Unpaid"];
const STATUSES = ["Pending", "Approved", "Rejected", "Cancelled"];

export function LeaveManagementPage({ accessToken }: Props) {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<"requests" | "reports">("requests");

  const PER_PAGE = 50;
  const totalPages = Math.ceil(total / PER_PAGE);

  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  const fetchStats = useCallback(async () => {
    const res = await fetch(`${API}/employee-dashboard/leaves-stats`, { headers });
    if (res.ok) setStats(await res.json());
  }, [accessToken]);

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
    if (filterStatus) params.set("status", filterStatus);
    if (filterType) params.set("leave_type", filterType);
    if (filterFrom) params.set("from_date", filterFrom);
    if (filterTo) params.set("to_date", filterTo);
    if (search) params.set("search", search);

    const res = await fetch(`${API}/employee-dashboard/leaves-all?${params}`, { headers });
    if (res.ok) {
      const json = await res.json();
      setLeaves(json.data || []);
      setTotal(json.total || 0);
    }
    setLoading(false);
  }, [accessToken, page, filterStatus, filterType, filterFrom, filterTo, search]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  const handleAction = async (leaveId: string, action: "approve" | "reject") => {
    setActionLoading(leaveId + action);
    const endpoint = action === "approve" ? "/employee-dashboard/leaves/approve" : "/employee-dashboard/leaves/reject";
    await fetch(`${API}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ leaveId, approverName: "HR Admin" }),
    });
    await Promise.all([fetchLeaves(), fetchStats()]);
    setActionLoading(null);
  };

  const exportCSV = () => {
    const rows = [
      ["Employee", "Leave Type", "Start Date", "End Date", "Days", "Status", "Reason", "Approver"],
      ...leaves.map(l => [l.employee_name, l.leave_type, l.start_date, l.end_date, String(l.days), l.status, l.reason, l.approver || ""]),
    ];
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `leave-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const StatTile = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) => (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${color}`}>
      <div className="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs font-medium opacity-70">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Calendar size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Leave Management</h1>
            <p className="text-xs text-gray-500">Org-wide leave requests and approvals</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { fetchLeaves(); fetchStats(); }} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw size={15} />
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700">
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6 flex gap-4">
        {[{ id: "requests", label: "Leave Requests", icon: <Calendar size={14} /> }, { id: "reports", label: "Reports & Analytics", icon: <BarChart2 size={14} /> }].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 py-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Stat tiles — always shown */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile icon={<Users size={18} className="text-indigo-600" />} label="Total Requests" value={stats.total} color="bg-indigo-50 border-indigo-100 text-indigo-900" />
            <StatTile icon={<Clock size={18} className="text-yellow-600" />} label="Pending" value={stats.pending} color="bg-yellow-50 border-yellow-100 text-yellow-900" />
            <StatTile icon={<CheckCircle size={18} className="text-green-600" />} label="Approved" value={stats.approved} color="bg-green-50 border-green-100 text-green-900" />
            <StatTile icon={<XCircle size={18} className="text-red-600" />} label="Rejected" value={stats.rejected} color="bg-red-50 border-red-100 text-red-900" />
          </div>
        )}

        {/* ── Reports Tab ── */}
        {activeTab === "reports" && stats && (
          <div className="space-y-5">
            {/* Approval rate */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Approval Rate</h3>
              {(() => {
                const rate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;
                const rejectRate = stats.total > 0 ? Math.round((stats.rejected / stats.total) * 100) : 0;
                const pendingRate = 100 - rate - rejectRate;
                return (
                  <div className="space-y-3">
                    {[
                      { label: "Approved", count: stats.approved, rate, color: "bg-green-500" },
                      { label: "Pending", count: stats.pending, rate: pendingRate, color: "bg-yellow-400" },
                      { label: "Rejected", count: stats.rejected, rate: rejectRate, color: "bg-red-400" },
                    ].map(({ label, count, rate: r, color }) => (
                      <div key={label}>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>{label}</span>
                          <span className="font-semibold">{count} ({r}%)</span>
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${r}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Leave type distribution */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Leave Requests by Type</h3>
              {Object.keys(stats.byType).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No leave data yet</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                    const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                    return (
                      <div key={type}>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span className="font-medium">{type}</span>
                          <span>{count} requests ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Summary Metrics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: "Total Leave Days", value: stats.totalDays, unit: "days" },
                  { label: "Avg per Request", value: stats.total > 0 ? (stats.totalDays / stats.total).toFixed(1) : "0", unit: "days" },
                  { label: "Approval Rate", value: stats.total > 0 ? `${Math.round((stats.approved / stats.total) * 100)}%` : "—", unit: "" },
                ].map(m => (
                  <div key={m.label} className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-indigo-600">{m.value}<span className="text-sm font-normal text-gray-400 ml-1">{m.unit}</span></p>
                    <p className="text-xs text-gray-500 mt-1">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                <Download size={14} /> Export Full Report CSV
              </button>
            </div>
          </div>
        )}

        {/* ── Requests Tab ── */}
        {activeTab === "requests" && (
        <>
        {/* Year-End Rules info card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">📅 Year-End Leave Rules</h3>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Maximum <strong>12 Earned Leaves (EL)</strong> can be carried forward to the next year</li>
            <li>• Carried forward leaves go into <strong>Accumulated Earned Leave (AEL)</strong> pool</li>
            <li>• AEL pool has a maximum cap of <strong>60 leaves</strong></li>
            <li>• All remaining balances (beyond carry forward limits) <strong>lapse on December 31st</strong></li>
            <li>• Maternity/Paternity leave: limited to <strong>2 times in career</strong>, first 2 children only</li>
            <li>• Maternity/Paternity leave is <strong>not counted</strong> in regular leave balance calculations</li>
          </ul>
        </div>

        {/* Leave type breakdown */}
        {stats && Object.keys(stats.byType).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Leave Distribution by Type</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <div key={type} className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 rounded-full border border-gray-100">
                  <span className="text-xs font-medium text-gray-600">{type}</span>
                  <span className="text-xs font-bold text-gray-900 bg-white border border-gray-200 rounded-full px-1.5">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search + Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by employee name…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              />
            </div>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${showFilters ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              <Filter size={14} /> Filters
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1 border-t border-gray-100">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Status</label>
                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  <option value="">All</option>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Leave Type</label>
                <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  <option value="">All</option>
                  {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">From Date</label>
                <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1); }} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">To Date</label>
                <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1); }} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Leave Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Days</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">Loading…</td></tr>
                ) : leaves.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">No leave requests found.</td></tr>
                ) : leaves.map(leave => (
                  <tr key={leave.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{leave.employee_name || "—"}</p>
                      <p className="text-xs text-gray-400 font-mono">{`JL-LVE-${leave.id.slice(0, 6).toUpperCase()}`}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{leave.leave_type}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {leave.start_date} → {leave.end_date}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{leave.days}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate" title={leave.reason}>{leave.reason || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[leave.status] || "bg-gray-100 text-gray-600"}`}>
                        {leave.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {leave.status === "Pending" ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleAction(leave.id, "approve")}
                            disabled={actionLoading === leave.id + "approve"}
                            className="px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === leave.id + "approve" ? "…" : "Approve"}
                          </button>
                          <button
                            onClick={() => handleAction(leave.id, "reject")}
                            disabled={actionLoading === leave.id + "reject"}
                            className="px-2.5 py-1 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === leave.id + "reject" ? "…" : "Reject"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {leave.approver ? `By ${leave.approver}` : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-xs text-gray-500">
                Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-gray-600 px-2">Page {page} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}

export default LeaveManagementPage;
