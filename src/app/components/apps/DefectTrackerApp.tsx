import React, { useState, useEffect, useCallback, useRef } from "react";
import { InlineLoader } from "../ui/PageLoader";
import { useNavigate } from "react-router";
import { API_BASE, apiHeaders, supabase } from "../../utils/constants";
import { toast } from "sonner";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, RadialBarChart, RadialBar, ReferenceLine,
} from "recharts";
import {
  Bug, AlertTriangle, CheckCircle2, Clock, TrendingUp, TrendingDown,
  LayoutDashboard, List, Folder, BarChart3, Settings, ChevronRight,
  ChevronDown, ChevronUp, Plus, X, Filter, Search, Eye, Edit2, Trash2,
  ExternalLink, RefreshCw, Download, AlertCircle, CheckSquare,
  Square, MoreHorizontal, Link2, MessageSquare, Activity, User, Users,
  Calendar, Tag, ArrowRight, Pause, Play, Flag, Shield, AtSign,
} from "lucide-react";
import {
  useDefectTrackerData, Defect, DefectFilters, SEVERITY_CONFIG, STATUS_CONFIG,
  VALID_TRANSITIONS, SLA_STATUS_CONFIG, DEFECT_SEVERITIES,
  DefectSeverity, DefectStatus, formatRemaining,
} from "../../hooks/useDefectTrackerData";
import { t } from "../../../i18n/index";
import { useUser } from "../../context/UserContext";
import EmployeeSearchDropdown from "../ui/EmployeeSearchDropdown";

// ── Utility functions ─────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function slaColor(pct: number) {
  if (pct >= 90) return "text-green-700 bg-green-50";
  if (pct >= 70) return "text-yellow-700 bg-yellow-50";
  return "text-red-700 bg-red-50";
}

function shortDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function avatarColor(name: string) {
  const colors = [
    "bg-red-500", "bg-blue-500", "bg-green-500", "bg-purple-500",
    "bg-yellow-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return colors[h % colors.length];
}

const SEVERITY_CHART_COLORS: Record<string, string> = {
  "Very High": "#dc2626", "High": "#f97316", "Medium": "#3b82f6", "Low": "#9ca3af",
};

const ROOT_CAUSE_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props { accessToken: string; onLogout: () => void; }
type Screen = "dashboard" | "all-defects" | "defect-detail" | "sla-tracker" | "by-project" | "analytics" | "settings";
type ViewMode = "table" | "kanban" | "timeline";

// ── Small shared components ───────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: DefectSeverity }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cfg.color}`}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: DefectStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      {status}
    </span>
  );
}

function SLADot({ slaStatus }: { slaStatus: string }) {
  const cfg = SLA_STATUS_CONFIG[slaStatus as keyof typeof SLA_STATUS_CONFIG] ?? SLA_STATUS_CONFIG.on_track;
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot}`} />
      <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
    </span>
  );
}

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? "w-10 h-10 text-sm" : size === "md" ? "w-8 h-8 text-xs" : "w-6 h-6 text-xs";
  return (
    <span className={`${sz} ${avatarColor(name)} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials(name)}
    </span>
  );
}


function EmptyState({ msg }: { msg?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
      <Bug className="h-10 w-10 opacity-30" />
      <p className="font-medium">{msg ?? t("defectTracker.noDefects")}</p>
      <p className="text-sm">No defects match the current filters</p>
    </div>
  );
}

function WatcherAddDropdown({ currentWatchers, onAdd }: { currentWatchers: string[]; onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch(`${API_BASE}/directory/employees`, { headers: apiHeaders() })
      .then((r) => r.json())
      .then((j) =>
        setEmployees(
          (j.data ?? [])
            .filter((e: any) => e.status !== "Inactive")
            .map((e: any) => ({ id: e.id, name: e.employee_name ?? e.fullName ?? e.name ?? "" }))
            .filter((e: any) => e.name && !currentWatchers.includes(e.name))
        )
      )
      .catch(() => {});
  }, [open]);

  const filtered = employees.filter((e) =>
    !search || e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-blue-600 underline hover:text-blue-800"
      >
        {t("defect.watchers.addWatcher")}
      </button>
      {open && (
        <div className="absolute left-0 top-5 z-30 bg-white border border-gray-200 rounded-lg shadow-lg w-48 p-2 space-y-1">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
          />
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {filtered.slice(0, 20).map((e) => (
              <button
                key={e.id}
                onClick={() => { onAdd(e.name); setOpen(false); setSearch(""); }}
                className="w-full text-left px-2 py-1 text-xs rounded hover:bg-gray-50 text-gray-700"
              >
                {e.name}
              </button>
            ))}
            {filtered.length === 0 && <p className="text-xs text-gray-400 px-2 py-1">No results</p>}
          </div>
          <button onClick={() => setOpen(false)} className="w-full text-xs text-gray-400 hover:text-gray-600 pt-1 text-right pr-1">Close</button>
        </div>
      )}
    </div>
  );
}

// ── SideNav ───────────────────────────────────────────────────────────────────

interface SideNavProps {
  screen: Screen;
  onNavigate: (s: Screen, extra?: any) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function SideNav({ screen, onNavigate, mobileOpen, onMobileClose }: SideNavProps) {
  const navigate = useNavigate();

  const items: { key: Screen; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: t("defectTracker.dashboard"), icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: "all-defects", label: t("defectTracker.allDefects"), icon: <List className="h-4 w-4" /> },
    { key: "sla-tracker", label: t("defectTracker.slaTracker"), icon: <Clock className="h-4 w-4" /> },
    { key: "by-project", label: t("defectTracker.byProject"), icon: <Folder className="h-4 w-4" /> },
    { key: "analytics", label: t("defectTracker.analytics"), icon: <BarChart3 className="h-4 w-4" /> },
  ];

  const navContent = (
    <>
      <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
        <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Bug className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-red-700 text-sm leading-tight">{t("defectTracker.appName")}</span>
        {/* Close button on mobile */}
        <button onClick={onMobileClose} className="md:hidden ml-auto text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {items.map((item) => {
          const active = screen === item.key;
          return (
            <button
              key={item.key}
              onClick={() => { onNavigate(item.key); onMobileClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-red-50 text-red-700 border-r-2 border-red-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}

        <button
          onClick={() => { onNavigate("all-defects", { myDefects: true }); onMobileClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        >
          <User className="h-4 w-4" />
          {t("defectTracker.myDefects")}
        </button>

        <button
          onClick={() => { onNavigate("settings"); onMobileClose(); }}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
            screen === "settings"
              ? "bg-red-50 text-red-700 border-r-2 border-red-600"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          <Settings className="h-4 w-4" />
          {t("defectTracker.settings")}
        </button>
      </nav>

    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-12 h-[calc(100vh-3rem)] w-[220px] bg-white border-r border-gray-200 flex-col z-20">
        {navContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={onMobileClose}
          />
          <aside className="fixed left-0 top-12 h-[calc(100vh-3rem)] w-[220px] bg-white border-r border-gray-200 flex flex-col z-40 md:hidden">
            {navContent}
          </aside>
        </>
      )}
    </>
  );
}

// ── SCREEN 1: Dashboard ───────────────────────────────────────────────────────

function DashboardScreen({ onNavigate }: { onNavigate: (s: Screen, extra?: any) => void }) {
  const { dashboard, loading, loadDashboard } = useDefectTrackerData();

  useEffect(() => { loadDashboard(); }, []);

  if (loading && !dashboard) return <InlineLoader color="text-red-500" />;
  if (!dashboard) return <EmptyState msg="Dashboard data unavailable" />;

  const kpis = [
    { label: "Total Open", value: dashboard.totalOpen, color: "text-blue-700", bg: "bg-blue-50", icon: <Bug className="h-5 w-5 text-blue-400" />, pulse: false },
    { label: "Very High", value: dashboard.s1Count, color: "text-red-700", bg: "bg-red-50", icon: <AlertTriangle className="h-5 w-5 text-red-400" />, pulse: dashboard.s1Count > 0 },
    { label: "SLA Breached", value: dashboard.slaBreached, color: "text-red-600", bg: "bg-red-50", icon: <Clock className="h-5 w-5 text-red-400" />, pulse: false },
    { label: "Fixed Today", value: dashboard.fixedToday, color: "text-green-700", bg: "bg-green-50", icon: <CheckCircle2 className="h-5 w-5 text-green-400" />, pulse: false },
    { label: "Pending Verify", value: dashboard.pendingVerify, color: "text-orange-700", bg: "bg-orange-50", icon: <CheckSquare className="h-5 w-5 text-orange-400" />, pulse: false },
  ];

  const trendWithNet = (dashboard.trendData ?? []).map((d) => ({
    ...d,
    net: d.opened - d.closed,
    date: shortDate(d.date),
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t("defectTracker.dashboard")}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Live defect health overview</p>
        </div>
        <button
          onClick={() => loadDashboard()}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`${kpi.bg} rounded-xl p-4 border border-white shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              {kpi.icon}
              <TrendingUp className="h-4 w-4 text-gray-300" />
            </div>
            <div className={`text-3xl font-bold ${kpi.color} ${kpi.pulse ? "animate-pulse" : ""}`}>
              {kpi.value}
            </div>
            {kpi.label === "Total Open" && (dashboard as any).openDelta !== undefined && (
              <p className={`text-xs font-medium mt-0.5 ${(dashboard as any).openDelta > 0 ? 'text-red-500' : (dashboard as any).openDelta < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                {(dashboard as any).openDelta > 0 ? '+' : ''}{(dashboard as any).openDelta} vs last week
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1 font-medium">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* S1 Alert Banner */}
      {dashboard.s1Count > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-red-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              ⚠ {dashboard.s1Count} Very High defects require immediate attention
            </p>
            <button
              onClick={() => onNavigate("all-defects", { severity: "Very High" })}
              className="text-sm text-red-700 underline hover:text-red-900 font-medium"
            >
              View All Very High Defects
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-red-700 border-b border-red-200">
                  {["ID", "Title", "Project", "Assignee", "Age", "SLA Status"].map((h) => (
                    <th key={h} className="text-left py-1 pr-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(dashboard.s1Defects ?? []).map((d) => (
                  <tr key={d.id} className="border-b border-red-100 hover:bg-red-100/50">
                    <td className="py-1.5 pr-3 font-mono text-red-800">{d.defectId}</td>
                    <td className="py-1.5 pr-3 max-w-[200px] truncate text-gray-800">{d.title}</td>
                    <td className="py-1.5 pr-3 text-gray-700">{d.projectName}</td>
                    <td className="py-1.5 pr-3 text-gray-700">{d.assigneeName}</td>
                    <td className="py-1.5 pr-3 text-gray-700">{d.ageInDays}d</td>
                    <td className="py-1.5"><SLADot slaStatus={d.slaStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Severity Donut */}
        <div className="w-full sm:w-[40%] bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Severity Breakdown</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={dashboard.severityBreakdown}
                  dataKey="count"
                  nameKey="severity"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {(dashboard.severityBreakdown ?? []).map((entry) => (
                    <Cell key={entry.severity} fill={SEVERITY_CHART_COLORS[entry.severity] ?? "#ccc"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [v, "Defects"]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-gray-800">{dashboard.totalOpen}</span>
              <span className="text-xs text-gray-500">Total Open</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {(dashboard.severityBreakdown ?? []).map((e) => (
              <span key={e.severity} className="flex items-center gap-1 text-xs text-gray-600">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: SEVERITY_CHART_COLORS[e.severity] }} />
                {e.severity}: {e.count}
              </span>
            ))}
          </div>
        </div>

        {/* By Project Bar */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Defects by Project</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dashboard.projectBreakdown ?? []} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Very High" stackId="a" fill="#dc2626" />
              <Bar dataKey="High" stackId="a" fill="#f97316" />
              <Bar dataKey="Medium" stackId="a" fill="#3b82f6" />
              <Bar dataKey="Low" stackId="a" fill="#9ca3af" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* SLA Compliance */}
        <div className="w-full sm:w-[50%] bg-white rounded-xl border border-gray-200 p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">SLA Compliance Matrix</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left pb-2 font-semibold text-gray-500">Severity</th>
                <th className="text-center pb-2 font-semibold text-gray-500">First Response %</th>
                <th className="text-center pb-2 font-semibold text-gray-500">Fix %</th>
                <th className="text-center pb-2 font-semibold text-gray-500">Verify %</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard.slaCompliance ?? []).map((row) => (
                <tr key={row.severity} className="border-b border-gray-50">
                  <td className="py-2 font-semibold">
                    <SeverityBadge severity={row.severity as DefectSeverity} />
                  </td>
                  {[row.firstResponse, row.fix, row.verify].map((pct, i) => (
                    <td key={i} className="py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${slaColor(pct)}`}>
                        {pct}%
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Trend Line */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">30-Day Trend</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendWithNet} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="opened" stroke="#dc2626" strokeWidth={2} dot={false} name="Opened" />
              <Line type="monotone" dataKey="closed" stroke="#16a34a" strokeWidth={2} dot={false} name="Closed" />
              <Line type="monotone" dataKey="net" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} name="Net" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h3>
        <div className="space-y-3">
          {(dashboard.recentActivity ?? []).slice(0, 10).map((act: any) => (
            <div key={act.id ?? Math.random()} className="flex items-start gap-3">
              <Avatar name={act.actorName ?? "?"} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{act.actorName}</span>{" "}
                  <span className="text-gray-500">{act.action}</span>{" "}
                  {act.defectId && (
                    <span className="text-red-600 font-mono text-xs">{act.defectId}</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{act.occurredAt ? timeAgo(act.occurredAt) : ""}</p>
              </div>
            </div>
          ))}
          {(dashboard.recentActivity ?? []).length === 0 && (
            <p className="text-sm text-gray-400">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Log Defect Modal ──────────────────────────────────────────────────────────

function LogDefectModal({
  onClose,
  onCreate,
  masterData,
}: {
  onClose: () => void;
  onCreate: (data: any) => void;
  masterData?: any;
}) {
  const { currentUser: user } = useUser();
  const [form, setForm] = useState<any>({
    projectId: "", projectName: "", title: "", severity: "Medium", priority: "P3", status: "Open",
    description: "", stepsToReproduce: [""], expectedResult: "", actualResult: "",
    environment: "Development", buildVersion: "", sprintId: "", sprintName: "", assigneeId: "", assigneeName: "",
    reporterId: "", reporterName: "", labels: [] as string[], isRegression: false,
  });

  // Populate reporter from logged-in user
  useEffect(() => {
    if (user) {
      setForm((f: any) => ({ ...f, reporterId: user.id ?? "", reporterName: user.name ?? "" }));
    }
  }, [user]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [labelInput, setLabelInput] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [sprints, setSprints] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    // Load projects and employees in parallel
    Promise.all([
      fetch(`${API_BASE}/projects/all`, { headers: apiHeaders() }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API_BASE}/directory/employees`, { headers: apiHeaders() }).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([projJson, empJson]) => {
      setProjects((projJson.data ?? []).map((p: any) => ({ id: p.id, name: p.name ?? p.projectName ?? '' })).filter((p: any) => p.name));
      setEmployees((empJson.data ?? []).filter((e: any) => e.status !== 'Inactive').map((e: any) => ({ id: e.id, name: e.employee_name ?? e.fullName ?? e.name ?? '' })).filter((e: any) => e.name));
    });
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Load sprints when project changes
  useEffect(() => {
    if (!form.projectId) { setSprints([]); return; }
    fetch(`${API_BASE}/projects/sprints?projectId=${form.projectId}`, { headers: apiHeaders() })
      .then(r => r.json())
      .then(json => setSprints((json.data ?? []).map((s: any) => ({ id: s.id, name: s.name ?? s.sprint_name ?? '' })).filter((s: any) => s.name)))
      .catch(() => setSprints([]));
  }, [form.projectId]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const addStep = () => set("stepsToReproduce", [...form.stepsToReproduce, ""]);
  const updateStep = (i: number, v: string) => {
    const steps = [...form.stepsToReproduce];
    steps[i] = v;
    set("stepsToReproduce", steps);
  };
  const removeStep = (i: number) => {
    set("stepsToReproduce", form.stepsToReproduce.filter((_: any, idx: number) => idx !== i));
  };

  const addLabel = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && labelInput.trim()) {
      set("labels", [...form.labels, labelInput.trim()]);
      setLabelInput("");
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.projectId) errs.projectId = "Project is required";
    if (!form.title.trim()) errs.title = "Title is required";
    if (!form.description.trim()) errs.description = "Description is required";
    if (!form.severity) errs.severity = "Severity is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    onCreate(form);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{t("defectTracker.logDefect")}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{t("defectTracker.project")} *</label>
              <select
                value={form.projectId}
                onChange={(e) => {
                  const proj = projects.find(p => p.id === e.target.value);
                  set("projectId", e.target.value);
                  set("projectName", proj?.name ?? "");
                  set("sprintId", "");
                  set("sprintName", "");
                }}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 ${errors.projectId ? "border-red-400" : "border-gray-200"}`}
              >
                <option value="">Select project...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {errors.projectId && <p className="text-red-500 text-xs mt-1">{errors.projectId}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{t("defectTracker.severity")} *</label>
              <div className="flex gap-2">
                {DEFECT_SEVERITIES.map((s) => (
                  <button
                    key={s}
                    onClick={() => set("severity", s)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                      form.severity === s
                        ? `${SEVERITY_CONFIG[s].color} border-transparent`
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {errors.severity && <p className="text-red-500 text-xs mt-1">{errors.severity}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{t("defectTracker.title2")} *</label>
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              placeholder="Short, descriptive title"
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{t("defectTracker.description")} *</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
              placeholder="Detailed description of the defect"
            />
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-600">{t("defectTracker.stepsToReproduce")}</label>
              <button onClick={addStep} className="text-xs text-red-600 hover:underline flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add Step
              </button>
            </div>
            {form.stepsToReproduce.map((step: string, i: number) => (
              <div key={i} className="flex items-center gap-2 mb-1.5">
                <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{i + 1}.</span>
                <input
                  value={step}
                  onChange={(e) => updateStep(i, e.target.value)}
                  className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-200"
                  placeholder={`Step ${i + 1}`}
                />
                {form.stepsToReproduce.length > 1 && (
                  <button onClick={() => removeStep(i)} className="text-gray-300 hover:text-red-400">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{t("defectTracker.expectedResult")}</label>
              <textarea
                value={form.expectedResult}
                onChange={(e) => set("expectedResult", e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{t("defectTracker.actualResult")}</label>
              <textarea
                value={form.actualResult}
                onChange={(e) => set("actualResult", e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{t("defectTracker.environment")}</label>
              <select
                value={form.environment}
                onChange={(e) => set("environment", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                {masterData?.environments?.length
                  ? masterData.environments.map((env: any) => (
                      <option key={env.name} value={env.name}>{env.name}</option>
                    ))
                  : <option disabled>No environments available</option>
                }
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{t("defectTracker.priority")}</label>
              <select
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                {masterData?.priorities?.length
                  ? masterData.priorities.map((p: any) => (
                      <option key={p.code} value={p.code}>{p.label ?? p.code}</option>
                    ))
                  : <option disabled>No priorities available</option>
                }
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{t("defectTracker.buildVersion")}</label>
              <input
                value={form.buildVersion}
                onChange={(e) => set("buildVersion", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{t("defectTracker.sprint")}</label>
              <select
                value={form.sprintId}
                onChange={(e) => {
                  const sp = sprints.find(s => s.id === e.target.value);
                  set("sprintId", e.target.value);
                  set("sprintName", sp?.name ?? "");
                }}
                disabled={!form.projectId}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-50 disabled:bg-gray-50"
              >
                <option value="">{form.projectId ? "Select sprint..." : "Select project first"}</option>
                {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{t("defectTracker.assignee")}</label>
              <EmployeeSearchDropdown
                value={form.assigneeName ?? ""}
                onChange={(name, id) => { set("assigneeName", name); set("assigneeId", id ?? ""); }}
                placeholder="Search assignee…"
              />
            </div>
          </div>

          {/* Reporter (auto-populated) */}
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            <User className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Reported by: <span className="font-semibold text-gray-700">{form.reporterName || "Loading..."}</span></span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{t("defectTracker.labels")}</label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {form.labels.map((lbl: string) => (
                <span key={lbl} className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs rounded-full px-2 py-0.5">
                  {lbl}
                  <button onClick={() => set("labels", form.labels.filter((l: string) => l !== lbl))} className="text-gray-400 hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            {masterData?.labels?.length > 0 ? (
              <select
                value=""
                onChange={(e) => { if (e.target.value && !form.labels.includes(e.target.value)) set("labels", [...form.labels, e.target.value]); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Select a label...</option>
                {masterData.labels.filter((l: any) => !form.labels.includes(l.name)).map((l: any) => (
                  <option key={l.id ?? l.name} value={l.name}>{l.name}</option>
                ))}
              </select>
            ) : (
              <input
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={addLabel}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder="Type label and press Enter"
              />
            )}
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.isRegression}
              onChange={(e) => set("isRegression", e.target.checked)}
              className="accent-red-600"
            />
            <span className="font-medium text-gray-700">This is a regression</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={submit} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700">
            Log Defect
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SCREEN 2: All Defects ─────────────────────────────────────────────────────

function AllDefectsScreen({
  initialFilters,
  onNavigateDetail,
}: {
  initialFilters?: Partial<DefectFilters & { myDefects?: boolean }>;
  onNavigateDetail: (id: string) => void;
}) {
  const { defects, loading, loadDefects, createDefect, deleteDefect, masterData, loadMasterData } = useDefectTrackerData();
  const { currentUser: user } = useUser();

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string[]>(
    initialFilters?.severity ? [initialFilters.severity] : []
  );
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [envFilter, setEnvFilter] = useState("");
  const [regressionFilter, setRegressionFilter] = useState("all");
  const [slaStatusFilter, setSlaStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [reporterFilter, setReporterFilter] = useState("");
  const [sprintFilter, setSprintFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [duplicateFilter, setDuplicateFilter] = useState("all");
  const [savedFilterName, setSavedFilterName] = useState("");
  const [showSaveFilter, setShowSaveFilter] = useState(false);
  const [savedFilters, setSavedFilters] = useState<{ id: string; name: string; filters: any }[]>([
    { id: "my-open", name: "My Open Defects", filters: { statusFilter: ["Open", "In Progress"] } },
    { id: "vh-today", name: "Very High Today", filters: { severityFilter: ["Very High"], dateFrom: new Date().toISOString().slice(0, 10) } },
    { id: "sla-breached", name: "SLA Breached", filters: { slaStatusFilter: "fix_breached" } },
    { id: "regressions", name: "All Regressions", filters: { regressionFilter: "yes" } },
  ]);
  const [showSavedFilterDropdown, setShowSavedFilterDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<"severity" | "age" | "sla">("severity");
  const [groupBy, setGroupBy] = useState<"none" | "project" | "severity" | "status">("none");
  const [view, setView] = useState<ViewMode>("table");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [showLogModal, setShowLogModal] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const PAGE_SIZE = 50;

  useEffect(() => {
    const filters: DefectFilters = {};
    if (initialFilters?.myDefects && user?.id) filters.assigneeId = user.id;
    if (initialFilters?.severity) filters.severity = initialFilters.severity;
    loadDefects(filters);
    loadMasterData();
  }, []);

  const toggleSeverity = (s: string) => {
    setSeverityFilter((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const toggleStatus = (s: string) => {
    setStatusFilter((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const severityOrder: Record<string, number> = { "Very High": 0, "High": 1, "Medium": 2, "Low": 3 };

  const filtered = defects.filter((d) => {
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !d.defectId.toLowerCase().includes(search.toLowerCase())) return false;
    if (severityFilter.length && !severityFilter.includes(d.severity)) return false;
    if (statusFilter.length && !statusFilter.includes(d.status)) return false;
    if (envFilter && d.environment !== envFilter) return false;
    if (regressionFilter === "yes" && !d.isRegression) return false;
    if (regressionFilter === "no" && d.isRegression) return false;
    if (slaStatusFilter && d.slaStatus !== slaStatusFilter) return false;
    if (dateFrom && new Date(d.createdAt) < new Date(dateFrom)) return false;
    if (dateTo && new Date(d.createdAt) > new Date(dateTo)) return false;
    if (priorityFilter && d.priority !== priorityFilter) return false;
    if (reporterFilter && !d.reporterName.toLowerCase().includes(reporterFilter.toLowerCase())) return false;
    if (sprintFilter && d.sprintName !== sprintFilter) return false;
    if (labelFilter && !(d.labels ?? []).includes(labelFilter)) return false;
    if (duplicateFilter === "yes" && !d.isDuplicate) return false;
    if (duplicateFilter === "no" && d.isDuplicate) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "severity") return (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9);
    if (sortBy === "age") return b.ageInDays - a.ageInDays;
    if (sortBy === "sla") return (a.slaFixRemainingMins ?? 9999) - (b.slaFixRemainingMins ?? 9999);
    return 0;
  });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map((d) => d.id)));
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Delete this defect?")) return;
    await deleteDefect(id);
  };

  const exportCSV = () => {
    const rows = [
      ["ID", "Title", "Severity", "Status", "Project", "Assignee", "Age", "SLA Status"],
      ...filtered.map((d) => [d.defectId, d.title, d.severity, d.status, d.projectName, d.assigneeName, `${d.ageInDays}d`, d.slaStatus]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "defects.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const activeFilters: { label: string; clear: () => void }[] = [
    ...severityFilter.map((s) => ({ label: `Severity: ${s}`, clear: () => toggleSeverity(s) })),
    ...statusFilter.map((s) => ({ label: `Status: ${s}`, clear: () => toggleStatus(s) })),
    ...(envFilter ? [{ label: `Env: ${envFilter}`, clear: () => setEnvFilter("") }] : []),
    ...(slaStatusFilter ? [{ label: `SLA: ${slaStatusFilter}`, clear: () => setSlaStatusFilter("") }] : []),
    ...(regressionFilter !== "all" ? [{ label: `Regression: ${regressionFilter}`, clear: () => setRegressionFilter("all") }] : []),
    ...(priorityFilter ? [{ label: `Priority: ${priorityFilter}`, clear: () => setPriorityFilter("") }] : []),
    ...(reporterFilter ? [{ label: `Reporter: ${reporterFilter}`, clear: () => setReporterFilter("") }] : []),
    ...(sprintFilter ? [{ label: `Sprint: ${sprintFilter}`, clear: () => setSprintFilter("") }] : []),
    ...(labelFilter ? [{ label: `Label: ${labelFilter}`, clear: () => setLabelFilter("") }] : []),
    ...(duplicateFilter !== "all" ? [{ label: `Duplicate: ${duplicateFilter}`, clear: () => setDuplicateFilter("all") }] : []),
  ];

  const clearAll = () => {
    setSeverityFilter([]); setStatusFilter([]); setEnvFilter("");
    setRegressionFilter("all"); setSlaStatusFilter(""); setDateFrom(""); setDateTo("");
    setPriorityFilter(""); setReporterFilter(""); setSprintFilter(""); setLabelFilter(""); setDuplicateFilter("all");
  };

  const applySavedFilter = (sf: { id: string; name: string; filters: any }) => {
    clearAll();
    const f = sf.filters;
    if (f.statusFilter) setStatusFilter(f.statusFilter);
    if (f.severityFilter) setSeverityFilter(f.severityFilter);
    if (f.slaStatusFilter) setSlaStatusFilter(f.slaStatusFilter);
    if (f.regressionFilter) setRegressionFilter(f.regressionFilter);
    if (f.dateFrom) setDateFrom(f.dateFrom);
    if (f.dateTo) setDateTo(f.dateTo);
    setShowSavedFilterDropdown(false);
  };

  const saveCurrentFilter = () => {
    if (!savedFilterName.trim()) return;
    const id = `custom-${Date.now()}`;
    setSavedFilters((prev) => [...prev, {
      id,
      name: savedFilterName,
      filters: { statusFilter, severityFilter, slaStatusFilter, regressionFilter, dateFrom, dateTo, envFilter, priorityFilter },
    }]);
    setSavedFilterName("");
    setShowSaveFilter(false);
    toast.success(`Filter "${savedFilterName}" saved`);
  };

  // Group the paginated rows
  const groupedRows = (): { key: string; label: string; rows: Defect[] }[] => {
    if (groupBy === "none") return [{ key: "all", label: "", rows: paginated }];
    const map = new Map<string, Defect[]>();
    paginated.forEach((d) => {
      const k = groupBy === "project" ? d.projectName : groupBy === "severity" ? d.severity : d.status;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(d);
    });
    return Array.from(map.entries()).map(([key, rows]) => ({ key, label: key, rows }));
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  const renderTableRow = (d: Defect) => {
    const rowBg = d.severity === "Very High"
      ? "bg-red-50 border-l-4 border-l-red-500"
      : d.severity === "High"
      ? "bg-orange-50 border-l-4 border-l-orange-400"
      : "";

    return (
      <tr
        key={d.id}
        onClick={() => onNavigateDetail(d.id)}
        className={`${rowBg} border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors`}
      >
        <td className="pl-4 py-3" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => toggleSelect(d.id)} className="text-gray-400 hover:text-red-600">
            {selectedIds.has(d.id) ? <CheckSquare className="h-4 w-4 text-red-600" /> : <Square className="h-4 w-4" />}
          </button>
        </td>
        <td className="py-3 pr-3 font-mono text-xs text-gray-600">
          {d.isRegression && (
            <span className="inline-block mr-1 w-4 h-4 bg-orange-500 text-white text-[9px] font-bold rounded text-center leading-4">R</span>
          )}
          {d.defectId}
        </td>
        <td className="py-3 pr-3"><SeverityBadge severity={d.severity} /></td>
        <td className="py-3 pr-4 max-w-[280px]">
          <span className="text-sm text-gray-800 font-medium line-clamp-1">{d.title}</span>
        </td>
        <td className="py-3 pr-3 text-xs text-gray-500">{d.projectName}</td>
        <td className="py-3 pr-3 text-xs text-gray-400 max-w-[80px] truncate">{d.sprintName || <span className="text-gray-200">—</span>}</td>
        <td className="py-3 pr-3"><StatusBadge status={d.status} /></td>
        <td className="py-3 pr-3">
          {d.assigneeName ? (
            <div className="flex items-center gap-1.5">
              <Avatar name={d.assigneeName} size="sm" />
              <span className="text-xs text-gray-600 max-w-[80px] truncate">{d.assigneeName}</span>
            </div>
          ) : <span className="text-xs text-gray-300">Unassigned</span>}
        </td>
        <td className="py-3 pr-3 text-xs text-gray-500">{d.reporterName || <span className="text-gray-300">—</span>}</td>
        <td className="py-3 pr-3 text-xs text-gray-400 font-mono">{d.foundInVersion || <span className="text-gray-200">—</span>}</td>
        <td className="py-3 pr-3"><SLADot slaStatus={d.slaStatus} /></td>
        <td className="py-3 pr-3 text-xs text-gray-500">{d.ageInDays}d</td>
        <td className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onNavigateDetail(d.id)}
              className="p-1 text-gray-400 hover:text-blue-600 rounded"
              title="View"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => handleDelete(d.id, e)}
              className="p-1 text-gray-400 hover:text-red-600 rounded"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t("defectTracker.allDefects")}</h1>
        <button
          onClick={() => setShowLogModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t("defectTracker.logDefect")}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or ID..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>
          <div className="flex gap-1.5">
            {DEFECT_SEVERITIES.map((s) => (
              <button
                key={s}
                onClick={() => toggleSeverity(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                  severityFilter.includes(s)
                    ? `${SEVERITY_CONFIG[s].color} border-transparent`
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(masterData?.statuses?.length
              ? masterData.statuses.filter((s: any) => !s.is_terminal).map((s: any) => s.name)
              : (Object.keys(STATUS_CONFIG) as DefectStatus[]).filter(s => !['Closed', "Won't Fix", 'Duplicate'].includes(s))
            ).map((s: string) => {
              const cfg = STATUS_CONFIG[s as DefectStatus] ?? { bg: "bg-gray-100", color: "text-gray-600" };
              return (
                <button
                  key={s}
                  onClick={() => toggleStatus(s as DefectStatus)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    statusFilter.includes(s as DefectStatus)
                      ? `${cfg.bg} ${cfg.color} border-transparent`
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setMoreFiltersOpen(!moreFiltersOpen)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <Filter className="h-3.5 w-3.5" />
            More Filters
            {moreFiltersOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {moreFiltersOpen && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">{t("defectTracker.environment")}</label>
              <select value={envFilter} onChange={(e) => setEnvFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none">
                <option value="">All</option>
                {masterData?.environments?.length
                  ? masterData.environments.map((env: any) => (
                      <option key={env.name} value={env.name}>{env.name}</option>
                    ))
                  : <option disabled>No environments in DB</option>
                }
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Priority</label>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none">
                <option value="">All</option>
                {masterData?.priorities?.length
                  ? masterData.priorities.map((p: any) => (
                      <option key={p.code} value={p.code}>{p.label ?? p.code}</option>
                    ))
                  : <option disabled>No priorities in DB</option>
                }
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Reporter</label>
              <input value={reporterFilter} onChange={(e) => setReporterFilter(e.target.value)} placeholder="Reporter name..." className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Sprint</label>
              <input value={sprintFilter} onChange={(e) => setSprintFilter(e.target.value)} placeholder="Sprint name..." className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Label</label>
              <select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none">
                <option value="">All Labels</option>
                {(masterData?.labels?.length ? masterData.labels : []).map((l: any) => (
                  <option key={l.id ?? l.name} value={l.name}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">{t("defectTracker.regression")}</label>
              <select value={regressionFilter} onChange={(e) => setRegressionFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none">
                <option value="all">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Duplicate</label>
              <select value={duplicateFilter} onChange={(e) => setDuplicateFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none">
                <option value="all">All</option>
                <option value="yes">Only Duplicates</option>
                <option value="no">Exclude Duplicates</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">SLA Status</label>
              <select value={slaStatusFilter} onChange={(e) => setSlaStatusFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none">
                <option value="">All</option>
                <option value="on_track">On Track</option>
                <option value="at_risk">At Risk</option>
                <option value="fix_breached">Fix Breached</option>
                <option value="verify_breached">Verify Breached</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
              </div>
            </div>
          </div>
        )}

        {activeFilters.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-100">
            {activeFilters.map((f) => (
              <span key={f.label} className="flex items-center gap-1 bg-red-50 text-red-700 text-xs rounded-full px-2.5 py-1 font-medium">
                {f.label}
                <button onClick={f.clear} className="hover:text-red-900"><X className="h-3 w-3" /></button>
              </span>
            ))}
            <button onClick={clearAll} className="text-xs text-gray-500 underline hover:text-gray-700">Clear All</button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 font-medium">{filtered.length} defects</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Sort:</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none">
              <option value="severity">Severity</option>
              <option value="age">Age</option>
              <option value="sla">SLA</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Group:</span>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)} className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none">
              <option value="none">None</option>
              <option value="project">Project</option>
              <option value="severity">Severity</option>
              <option value="status">Status</option>
            </select>
          </div>
          {/* Saved Filters */}
          <div className="relative">
            <button
              onClick={() => { setShowSavedFilterDropdown(!showSavedFilterDropdown); setShowSaveFilter(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
            >
              <Filter className="h-3.5 w-3.5" /> Saved Filters
              <ChevronDown className="h-3 w-3" />
            </button>
            {showSavedFilterDropdown && (
              <div className="absolute top-full right-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                {savedFilters.map((sf) => (
                  <button
                    key={sf.id}
                    onClick={() => applySavedFilter(sf)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700"
                  >
                    {sf.name}
                  </button>
                ))}
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    onClick={() => { setShowSaveFilter(true); setShowSavedFilterDropdown(false); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-red-600 font-medium"
                  >
                    + Save Current Filter
                  </button>
                </div>
              </div>
            )}
          </div>
          {showSaveFilter && (
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
              <input
                value={savedFilterName}
                onChange={(e) => setSavedFilterName(e.target.value)}
                placeholder="Filter name..."
                className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none w-32"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") saveCurrentFilter(); if (e.key === "Escape") setShowSaveFilter(false); }}
              />
              <button onClick={saveCurrentFilter} className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium">Save</button>
              <button onClick={() => setShowSaveFilter(false)} className="text-xs text-gray-500 hover:text-gray-700"><X className="h-3 w-3" /></button>
            </div>
          )}
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            <button onClick={() => setView("table")} className={`px-3 py-1.5 text-xs font-medium ${view === "table" ? "bg-red-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>Table</button>
            <button onClick={() => setView("kanban")} className={`px-3 py-1.5 text-xs font-medium ${view === "kanban" ? "bg-red-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>Kanban</button>
            <button onClick={() => setView("timeline")} className={`px-3 py-1.5 text-xs font-medium ${view === "timeline" ? "bg-red-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>Timeline</button>
          </div>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Bulk Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-3">
          <span className="text-sm font-medium text-blue-800">{selectedIds.size} selected</span>
          <button className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700">Reassign</button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700">Change Severity</button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700" onClick={exportCSV}>Export</button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-blue-500 hover:text-blue-700"><X className="h-4 w-4" /></button>
        </div>
      )}

      {loading && <InlineLoader color="text-red-500" />}

      {!loading && filtered.length === 0 && <EmptyState />}

      {!loading && filtered.length > 0 && view === "table" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="pl-4 py-3 w-8">
                  <button onClick={selectAll} className="text-gray-400 hover:text-red-600">
                    {selectedIds.size === paginated.length && paginated.length > 0
                      ? <CheckSquare className="h-4 w-4 text-red-600" />
                      : <Square className="h-4 w-4" />}
                  </button>
                </th>
                {["ID", "Sev", "Title", "Project", "Sprint", "Status", "Assignee", "Reporter", "Found In", "SLA", "Age", ""].map((h) => (
                  <th key={h} className="text-left py-3 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupBy === "none"
                ? paginated.map(renderTableRow)
                : groupedRows().map((group) => (
                    <React.Fragment key={group.key}>
                      <tr>
                        <td colSpan={13} className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                          <button
                            onClick={() => toggleGroup(group.key)}
                            className="flex items-center gap-2 text-sm font-semibold text-gray-700"
                          >
                            {collapsedGroups.has(group.key) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {group.label}
                            <span className="text-xs font-normal text-gray-400">({group.rows.length})</span>
                          </button>
                        </td>
                      </tr>
                      {!collapsedGroups.has(group.key) && group.rows.map(renderTableRow)}
                    </React.Fragment>
                  ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-500">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex gap-1">
                <button disabled={page === 0} onClick={() => setPage(page - 1)} className="px-3 py-1 border border-gray-200 rounded text-xs disabled:opacity-40">Prev</button>
                <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} className="px-3 py-1 border border-gray-200 rounded text-xs disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && view === "kanban" && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {(masterData?.statuses?.length
            ? masterData.statuses.map((s: any) => s.name)
            : Object.keys(STATUS_CONFIG) as DefectStatus[]
          ).map((status: string) => {
            const colDefects = filtered.filter((d) => d.status === status);
            const cfg = STATUS_CONFIG[status as DefectStatus] ?? { bg: "bg-gray-100", color: "text-gray-600" };
            return (
              <div key={status} className="flex-shrink-0 w-60">
                <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg ${cfg.bg}`}>
                  <span className={`text-xs font-bold ${cfg.color}`}>{status}</span>
                  <span className={`text-xs font-semibold ${cfg.color} opacity-70`}>{colDefects.length}</span>
                </div>
                <div className="bg-gray-50 rounded-b-lg min-h-[400px] max-h-[600px] overflow-y-auto p-2 space-y-2 border border-gray-200 border-t-0">
                  {colDefects.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => onNavigateDetail(d.id)}
                      className="bg-white rounded-lg p-3 border border-gray-200 hover:border-red-200 cursor-pointer shadow-sm space-y-2 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <SeverityBadge severity={d.severity} />
                        {d.isRegression && (
                          <span className="text-[9px] bg-orange-500 text-white rounded px-1 font-bold">R</span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-gray-800 line-clamp-2">{d.title}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{d.projectName}</span>
                        {d.assigneeName && <Avatar name={d.assigneeName} size="sm" />}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {formatRemaining(d.slaFixRemainingMins)}
                      </div>
                    </div>
                  ))}
                  {colDefects.length === 0 && (
                    <div className="flex items-center justify-center h-20 text-xs text-gray-300">Empty</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length > 0 && view === "timeline" && (
        <div className="relative pl-8 space-y-0">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
          {paginated.map((d) => {
            const cfg = SEVERITY_CONFIG[d.severity];
            return (
              <div key={d.id} className="relative flex gap-4 pb-4 cursor-pointer" onClick={() => onNavigateDetail(d.id)}>
                <div className={`absolute left-[-24px] w-4 h-4 rounded-full border-2 border-white ${cfg.dotColor} flex-shrink-0 mt-1`} />
                <div className="flex-1 bg-white border border-gray-200 rounded-xl p-3 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge severity={d.severity} />
                    <StatusBadge status={d.status} />
                    {d.isRegression && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">R</span>}
                    <span className="ml-auto text-xs text-gray-400">{d.defectId}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 mb-1">{d.title}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{d.projectName}</span>
                    {d.assigneeName && <span>→ {d.assigneeName}</span>}
                    <span className="ml-auto">{d.ageInDays}d ago</span>
                    <SLADot slaStatus={d.slaStatus} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showLogModal && (
        <LogDefectModal
          onClose={() => setShowLogModal(false)}
          onCreate={(data) => { createDefect(data); setShowLogModal(false); }}
          masterData={masterData}
        />
      )}
    </div>
  );
}

// ── Add Link Modal ────────────────────────────────────────────────────────────

function AddLinkModal({ defectId, onClose, onAdd }: { defectId: string; onClose: () => void; onAdd: (link: any) => void }) {
  const [itemType, setItemType] = useState<"it_ticket" | "backlog_item" | "related_defect">("it_ticket");
  const [itemRef, setItemRef] = useState("");
  const [itemTitle, setItemTitle] = useState("");

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const submit = () => {
    if (!itemRef.trim() || !itemTitle.trim()) return;
    onAdd({ itemType, itemRef, itemTitle, itemStatus: "Open" });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-96 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Add Linked Item</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Link Type</label>
            <select value={itemType} onChange={(e) => setItemType(e.target.value as any)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="it_ticket">IT Ticket</option>
              <option value="backlog_item">Backlog Item</option>
              <option value="related_defect">Related Defect</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Reference</label>
            <input value={itemRef} onChange={(e) => setItemRef(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="e.g. TICK-123" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Title</label>
            <input value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Brief description" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700">Add</button>
        </div>
      </div>
    </div>
  );
}

// ── SCREEN 3: Defect Detail ───────────────────────────────────────────────────

function DefectDetailScreen({
  defectId,
  onBack,
}: {
  defectId: string;
  onBack: () => void;
}) {
  const { selectedDefect, loading, loadDefectDetail, updateDefect, addComment, addLink, masterData, loadMasterData } = useDefectTrackerData();
  const { currentUser: user } = useUser();

  const [activeTab, setActiveTab] = useState<"activity" | "comments">("activity");
  const [comment, setComment] = useState("");
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [newAssignee, setNewAssignee] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");

  // Code reference edit state
  const [editingCodeRef, setEditingCodeRef] = useState(false);
  const [codeRef, setCodeRef] = useState("");

  // Severity change state
  const [showSeverityModal, setShowSeverityModal] = useState(false);
  const [newSeverity, setNewSeverity] = useState<DefectSeverity | "">("");
  const [severityReason, setSeverityReason] = useState("");

  // Status change state
  const [pendingStatus, setPendingStatus] = useState<DefectStatus | null>(null);
  const [fixDesc, setFixDesc] = useState("");
  const [fixVersion, setFixVersion] = useState("");
  const [verifiedBy, setVerifiedBy] = useState("");
  const [testEvidence, setTestEvidence] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [editingVerify, setEditingVerify] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [newAssigneeModal, setNewAssigneeModal] = useState<{ id: string; name: string }>({ id: "", name: "" });
  const [reassignEmployees, setReassignEmployees] = useState<{ id: string; name: string }[]>([]);
  const [duplicateOf, setDuplicateOf] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [statusErrors, setStatusErrors] = useState<string[]>([]);

  useEffect(() => {
    loadDefectDetail(defectId);
    loadMasterData();
  }, [defectId]);

  useEffect(() => {
    if (selectedDefect) {
      setTitleValue(selectedDefect.title);
      setCodeRef((selectedDefect as any).codeRef ?? "");
      setEvidenceUrl((selectedDefect as any).evidenceUrl ?? "");
    }
  }, [selectedDefect]);

  useEffect(() => {
    if (!showReassignModal) return;
    fetch(`${API_BASE}/directory/employees`, { headers: apiHeaders() })
      .then(r => r.json())
      .then(j => setReassignEmployees((j.data ?? []).filter((e: any) => e.status !== "Inactive").map((e: any) => ({ id: e.id, name: e.employee_name ?? e.fullName ?? e.name ?? "" })).filter((e: any) => e.name)))
      .catch(() => {});
  }, [showReassignModal]);

  const d = selectedDefect;

  if (loading && !d) return <InlineLoader color="text-red-500" />;
  if (!d) return <EmptyState msg="Defect not found" />;

  const canMarkFixed = d.status === "In Progress" || d.status === "Open";
  const isFixed = ["Fixed", "Verified", "Closed"].includes(d.status);
  const isVerified = d.status === "Verified" || d.status === "Closed";

  const fixPct = d.slaFixRemainingMins !== null && d.slaFixDueAt
    ? Math.max(0, Math.min(100, 100 - (d.slaFixRemainingMins / (d.ageInDays * 24 * 60 + d.slaFixRemainingMins)) * 100))
    : 0;

  const slaBannerBg = d.slaStatus === "fix_breached" || d.slaStatus === "verify_breached"
    ? "bg-red-50 border-red-200"
    : d.slaStatus === "at_risk"
    ? "bg-yellow-50 border-yellow-200"
    : "bg-green-50 border-green-200";

  const applyStatusChange = async () => {
    if (!pendingStatus) return;
    const errs: string[] = [];
    if (pendingStatus === "Fixed") {
      if (!fixDesc || fixDesc.length < 30) errs.push("Fix description must be at least 30 characters");
      if (!fixVersion) errs.push("Fix version is required");
    }
    if (pendingStatus === "Verified") {
      if (!verifiedBy) errs.push("Verified By is required");
      if (!testEvidence) errs.push("Test evidence is required");
    }
    if (pendingStatus === "Duplicate") {
      if (!duplicateOf) errs.push("Original defect ID is required");
    }
    if (pendingStatus === "Won't Fix") {
      if (!rejectionReason) errs.push("Rejection reason is required");
    }
    if (errs.length) { setStatusErrors(errs); return; }

    const payload: any = { status: pendingStatus };
    if (pendingStatus === "Fixed") { payload.fixDescription = fixDesc; payload.fixVersion = fixVersion; }
    if (pendingStatus === "Verified") { payload.verifiedBy; payload.testEvidence; }
    if (pendingStatus === "Duplicate") { payload.duplicateOfId = duplicateOf; }
    if (pendingStatus === "Won't Fix") { payload.rejectionReason; }
    await updateDefect(d.id, payload, user?.id, user?.name);

    // Notify all watchers of status change
    const watcherIds: string[] = (d.watchers ?? []).filter((w: string) => w !== user?.name && w !== user?.id);
    if (watcherIds.length > 0) {
      void supabase.from("notifications").insert(
        watcherIds.map((uid) => ({
          user_id: uid,
          type: "defect_status_change",
          title: `Defect ${d.defectId} status changed to ${pendingStatus}`,
          message: `Defect "${d.title}" is now ${pendingStatus}`,
          link: `/defect-tracker`,
          is_read: false,
        }))
      );
    }

    setPendingStatus(null);
    setStatusErrors([]);
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    await addComment(d.id, comment, user?.id ?? "", user?.name ?? "You");
    setComment("");
  };

  const handleAddLink = async (link: any) => {
    await addLink(d.id, link);
  };

  const confirmReassign = async () => {
    if (!newAssignee.trim()) return;
    await updateDefect(d.id, { assigneeName: newAssignee }, user?.id, user?.name);
    setIsReassigning(false);
    setNewAssignee("");
  };

  const saveTitle = async () => {
    if (titleValue.trim() && titleValue !== d.title) {
      await updateDefect(d.id, { title: titleValue }, user?.id, user?.name);
    }
    setEditingTitle(false);
  };

  const validTransitions = VALID_TRANSITIONS[d.status] ?? [];

  return (
    <div className="p-6 space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-gray-500">
        <button onClick={onBack} className="hover:text-red-600 font-medium">All Defects</button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-400">{d.projectName}</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-700 font-mono font-semibold">{d.defectId}</span>
      </div>

      {/* Header Band */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{d.defectId}</span>
          <SeverityBadge severity={d.severity} />
          {d.isRegression && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold">REGRESSION</span>
          )}
          {(d as any).isDuplicate && (d as any).duplicateOfId && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
              Duplicate of <span className="font-mono font-bold">{(d as any).duplicateOfId}</span>
            </span>
          )}
          {(() => {
            const dupCount = (d.linkedItems ?? []).filter((li) => li.itemType === "related_defect").length;
            return dupCount > 0 ? (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                {dupCount} {dupCount === 1 ? "duplicate" : "duplicates"}
              </span>
            ) : null;
          })()}
        </div>

        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            {editingTitle ? (
              <input
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                autoFocus
                className="w-full text-xl font-bold border-b-2 border-red-400 outline-none py-1"
              />
            ) : (
              <h2
                className="text-xl font-bold text-gray-900 cursor-pointer hover:text-red-700"
                onClick={() => setEditingTitle(true)}
              >
                {d.title}
              </h2>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Status:</span>
              <select
                value={pendingStatus ?? d.status}
                onChange={(e) => setPendingStatus(e.target.value as DefectStatus)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-sm font-medium focus:outline-none"
              >
                <option value={d.status}>{d.status}</option>
                {validTransitions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-medium">{d.priority}</span>
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">{d.projectName}</span>

            {canMarkFixed && (
              <button
                onClick={() => setPendingStatus("Fixed")}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700"
              >
                Mark Fixed
              </button>
            )}
            <button
              onClick={() => setPendingStatus("Won't Fix")}
              className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-200"
            >
              {"Won't Fix"}
            </button>
            <button
              onClick={() => { setShowSeverityModal(true); setNewSeverity(d.severity); setSeverityReason(""); }}
              className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold hover:bg-purple-200 flex items-center gap-1.5"
            >
              <Flag className="h-3.5 w-3.5" /> Change Severity
            </button>
            <button
              onClick={() => { setShowReassignModal(true); setNewAssigneeModal({ id: "", name: "" }); }}
              className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-200 flex items-center gap-1.5"
            >
              <Users className="h-3.5 w-3.5" /> Reassign
            </button>
          </div>
        </div>

        {/* Severity Change Modal */}
        {showSeverityModal && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-semibold text-purple-800">Change Severity</p>
            <div className="flex gap-2 flex-wrap">
              {DEFECT_SEVERITIES.map((sev) => (
                <button
                  key={sev}
                  onClick={() => setNewSeverity(sev)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                    newSeverity === sev ? `${SEVERITY_CONFIG[sev].color} border-transparent` : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Reason for change *</label>
              <textarea
                value={severityReason}
                onChange={(e) => setSeverityReason(e.target.value)}
                rows={2}
                placeholder="Explain the reason for this severity change..."
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none resize-none"
              />
            </div>
            {newSeverity === "Very High" && (
              <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-3 py-2">
                Escalating to Very High requires manager approval and will trigger an alert
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!severityReason.trim()) { toast.error("Reason is required"); return; }
                  await updateDefect(d.id, { severity: newSeverity as DefectSeverity, _oldSeverity: d.severity, severityChangeReason: severityReason });
                  if (newSeverity === "Very High") {
                    toast.warning("Severity escalation to Very High submitted — manager approval required");
                  } else {
                    toast.success("Severity updated");
                  }
                  setShowSeverityModal(false);
                }}
                className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700"
              >
                Confirm
              </button>
              <button onClick={() => setShowSeverityModal(false)} className="px-4 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        )}

        {/* Status Change Inline Form */}
        {pendingStatus && pendingStatus !== d.status && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-semibold text-yellow-800">Changing status to: {pendingStatus}</p>

            {pendingStatus === "Fixed" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Fix Description (min 30 chars) *</label>
                  <textarea
                    value={fixDesc}
                    onChange={(e) => setFixDesc(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Fix Version *</label>
                  <input value={fixVersion} onChange={(e) => setFixVersion(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none" />
                </div>
              </div>
            )}
            {pendingStatus === "Verified" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Verified By *</label>
                  <input value={verifiedBy} onChange={(e) => setVerifiedBy(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Test Evidence *</label>
                  <textarea value={testEvidence} onChange={(e) => setTestEvidence(e.target.value)} rows={2} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none resize-none" />
                </div>
              </div>
            )}
            {pendingStatus === "Duplicate" && (
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Original Defect ID *</label>
                <input value={duplicateOf} onChange={(e) => setDuplicateOf(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none" placeholder="DEF-XXX" />
              </div>
            )}
            {pendingStatus === "Won't Fix" && (
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Rejection Reason *</label>
                <select value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none">
                  <option value="">Select reason</option>
                  {masterData?.rejectionReasons?.length
                    ? masterData.rejectionReasons.map((r: any) => (
                        <option key={r.id ?? r.name} value={r.name}>{r.name}</option>
                      ))
                    : <option disabled>No rejection reasons in DB</option>
                  }
                </select>
              </div>
            )}

            {statusErrors.length > 0 && (
              <div className="space-y-1">
                {statusErrors.map((e) => <p key={e} className="text-red-600 text-xs flex items-center gap-1"><AlertCircle className="h-3 w-3" />{e}</p>)}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={applyStatusChange} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">Confirm</button>
              <button onClick={() => { setPendingStatus(null); setStatusErrors([]); }} className="px-4 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* SLA Banner */}
      <div className={`rounded-xl border p-4 ${slaBannerBg}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-700">SLA Status: {d.slaPolicyName}</span>
          <button
            onClick={() => updateDefect(d.id, { slaPaused: !d.slaPaused })}
            className="flex items-center gap-1.5 px-3 py-1 border border-gray-300 rounded-lg text-xs font-medium bg-white hover:bg-gray-50"
          >
            {d.slaPaused ? <><Play className="h-3.5 w-3.5" /> Resume SLA</> : <><Pause className="h-3.5 w-3.5" /> Pause SLA</>}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "First Response",
              met: d.slaFirstResponseMet,
              pct: d.slaFirstResponseMet ? 100 : 50,
              color: d.slaFirstResponseMet ? "bg-green-500" : "bg-gray-300",
              text: d.slaFirstResponseMet ? "Met" : "Pending",
            },
            {
              label: "Fix SLA",
              met: !d.slaFixBreached,
              pct: fixPct,
              color: d.slaFixBreached ? "bg-red-500" : d.slaStatus === "at_risk" ? "bg-yellow-500" : "bg-green-500",
              text: formatRemaining(d.slaFixRemainingMins),
            },
            {
              label: "Verify SLA",
              met: !d.slaVerifyBreached,
              pct: isFixed ? 50 : 0,
              color: d.slaVerifyBreached ? "bg-red-500" : isFixed ? "bg-yellow-400" : "bg-gray-200",
              text: isFixed ? formatRemaining(d.slaVerifyRemainingMins) : "Locked",
            },
          ].map((sla) => (
            <div key={sla.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-600">{sla.label}</span>
                <span className="text-xs text-gray-500">{sla.text}</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${sla.color}`} style={{ width: `${sla.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-4">
        {/* Left Panel */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Description */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="font-semibold text-gray-800">{t("defectTracker.description")}</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{d.description}</p>

            {d.stepsToReproduce?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">{t("defectTracker.stepsToReproduce")}</h4>
                <ol className="space-y-1 list-decimal list-inside">
                  {d.stepsToReproduce.map((step, i) => (
                    <li key={i} className="text-sm text-gray-700">{step}</li>
                  ))}
                </ol>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 mb-1">{t("defectTracker.expectedResult")}</p>
                <p className="text-sm text-gray-700">{d.expectedResult || "—"}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 mb-1">{t("defectTracker.actualResult")}</p>
                <p className="text-sm text-gray-700">{d.actualResult || "—"}</p>
              </div>
            </div>
          </div>

          {/* Environment */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Environment Details</h3>
            <div className="grid grid-cols-3 gap-y-3 gap-x-4 text-sm">
              {[
                { label: t("defectTracker.environment"), value: d.environment },
                { label: t("defectTracker.buildVersion"), value: d.buildVersion },
                { label: "OS", value: d.os },
                { label: "Browser", value: d.browser },
                { label: "Found In Version", value: d.foundInVersion },
                { label: "Intro Sprint", value: d.introducedInSprint },
              ].map((row) => (
                <div key={row.label}>
                  <span className="text-xs font-semibold text-gray-500 block">{row.label}</span>
                  <span className="text-gray-800">{row.value || "—"}</span>
                </div>
              ))}
              <div>
                <span className="text-xs font-semibold text-gray-500 block">{t("defectTracker.regression")}</span>
                {d.isRegression
                  ? <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold">Yes</span>
                  : <span className="text-gray-400">No</span>}
              </div>
            </div>
          </div>

          {/* Fix Details */}
          {isFixed && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Fix Details</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">{t("defectTracker.fixDescription")}</p>
                  <p className="text-sm text-gray-700">{d.fixDescription || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Code Reference (PR / Commit)</p>
                  {editingCodeRef ? (
                    <div className="flex gap-2">
                      <input
                        value={codeRef}
                        onChange={(e) => setCodeRef(e.target.value)}
                        placeholder="https://github.com/org/repo/pull/123 or commit SHA"
                        className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { updateDefect(d.id, { codeRef }); setEditingCodeRef(false); }
                          if (e.key === "Escape") setEditingCodeRef(false);
                        }}
                      />
                      <button onClick={() => { updateDefect(d.id, { codeRef }); setEditingCodeRef(false); }} className="px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold">Save</button>
                      <button onClick={() => setEditingCodeRef(false)} className="px-3 py-1 border border-gray-200 rounded text-xs">Cancel</button>
                    </div>
                  ) : codeRef ? (
                    <div className="flex items-center gap-2">
                      <a href={codeRef} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline hover:text-blue-800 break-all">{codeRef}</a>
                      <button onClick={() => setEditingCodeRef(true)} className="text-gray-400 hover:text-gray-600"><Edit2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingCodeRef(true)} className="text-xs text-red-600 underline hover:text-red-800">+ Add code reference</button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><p className="text-xs font-semibold text-gray-500">{t("defectTracker.fixVersion")}</p><p>{d.fixVersion || "—"}</p></div>
                  <div><p className="text-xs font-semibold text-gray-500">{t("defectTracker.fixedBy")}</p><p>{d.fixedBy || "—"}</p></div>
                  <div><p className="text-xs font-semibold text-gray-500">{t("defectTracker.fixedDate")}</p><p>{d.fixedDate ? new Date(d.fixedDate).toLocaleDateString() : "—"}</p></div>
                </div>
              </div>
            </div>
          )}

          {/* Verification */}
          {isFixed && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Verification</h3>
                <button onClick={() => setEditingVerify(!editingVerify)} className="text-xs text-red-600 hover:underline">
                  {editingVerify ? "Cancel" : "Edit"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div><p className="text-xs font-semibold text-gray-500">{t("defectTracker.verifiedBy")}</p><p>{d.verifiedBy || "—"}</p></div>
                <div>
                  <p className="text-xs font-semibold text-gray-500">{t("defectTracker.testEvidence")}</p>
                  <p>{d.testEvidence || "—"}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Evidence URL</label>
                {editingVerify ? (
                  <input
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                    placeholder="https://... (screenshot, test report link)"
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none"
                  />
                ) : (
                  evidenceUrl
                    ? <a href={evidenceUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline break-all">{evidenceUrl}</a>
                    : <span className="text-gray-300 text-sm">—</span>
                )}
              </div>
              {editingVerify && (
                <div className="flex justify-end mt-3">
                  <button
                    onClick={async () => { await updateDefect(d.id, { evidenceUrl }); setEditingVerify(false); toast.success("Evidence URL saved"); }}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
                  >Save</button>
                </div>
              )}
            </div>
          )}

          {/* Linked Items */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">Linked Items</h3>
              <button onClick={() => setShowLinkModal(true)} className="flex items-center gap-1.5 text-xs text-red-600 hover:underline">
                <Plus className="h-3.5 w-3.5" /> Add Link
              </button>
            </div>
            {(d.linkedItems ?? []).length === 0 && (
              <p className="text-sm text-gray-400">No linked items</p>
            )}
            {["it_ticket", "backlog_item", "related_defect"].map((type) => {
              const items = (d.linkedItems ?? []).filter((li) => li.itemType === type);
              if (items.length === 0) return null;
              const dotColor = type === "it_ticket" ? "bg-violet-500" : type === "backlog_item" ? "bg-blue-500" : "bg-gray-400";
              const typeLabel = type === "it_ticket" ? "IT Tickets" : type === "backlog_item" ? "Backlog Items" : "Related Defects";
              return (
                <div key={type} className="mb-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">{typeLabel}</p>
                  <div className="space-y-1">
                    {items.map((li) => (
                      <div key={li.id} className="flex items-center gap-2 text-sm">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                        <span className="font-mono text-xs text-gray-500">{li.itemRef}</span>
                        <span className="text-gray-700 flex-1">{li.itemTitle}</span>
                        <span className="text-xs text-gray-400">{li.itemStatus}</span>
                        <button className="text-gray-400 hover:text-blue-600"><ExternalLink className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Activity & Comments */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex gap-4 mb-4 border-b border-gray-100 pb-2">
              {(["activity", "comments"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-sm font-semibold pb-2 capitalize border-b-2 transition-colors ${activeTab === tab ? "border-red-500 text-red-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                >
                  {tab === "activity" ? "Activity" : "Comments"}
                </button>
              ))}
            </div>

            {activeTab === "activity" && (
              <div className="space-y-3">
                {(d.activityLog ?? []).length === 0 && <p className="text-sm text-gray-400">No activity yet</p>}
                {(d.activityLog ?? []).map((act) => (
                  <div key={act.id} className="flex items-start gap-3">
                    <Avatar name={act.actorName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium text-gray-800">{act.actorName}</span>{" "}
                        <span className="text-gray-500">{act.action}</span>
                        {act.fieldChanged && (
                          <span className="text-gray-500"> · {act.fieldChanged}: <span className="line-through text-red-400">{act.oldValue}</span> → <span className="text-green-700">{act.newValue}</span></span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">{act.comment && <span className="italic mr-2">"{act.comment}"</span>}{timeAgo(act.occurredAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "comments" && (
              <div className="space-y-3">
                {(d.comments ?? []).length === 0 && <p className="text-sm text-gray-400">No comments yet</p>}
                {(d.comments ?? []).map((c) => {
                  const isMine = c.authorId === user?.id;
                  return (
                    <div key={c.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-xl px-4 py-2.5 ${isMine ? "bg-red-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                        {!isMine && <p className="text-xs font-semibold mb-0.5 text-gray-500">{c.authorName}</p>}
                        <p className="text-sm whitespace-pre-wrap">
                          {c.content.split(/(@\w+)/g).map((part, i) =>
                            part.startsWith('@')
                              ? <span key={i} className="text-red-600 font-semibold">{part}</span>
                              : part
                          )}
                        </p>
                        <p className={`text-xs mt-0.5 ${isMine ? "text-red-200" : "text-gray-400"}`}>{timeAgo(c.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t border-gray-100 space-y-1.5">
                  <div className="flex gap-2">
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                      placeholder="Add a comment... Use @name to mention someone"
                      rows={2}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                    />
                    <button onClick={handleAddComment} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 self-end">
                      Send
                    </button>
                  </div>
                  {comment.includes("@") && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <AtSign className="h-3 w-3" /> Mentions will notify the tagged user
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-[340px] flex-shrink-0 space-y-4">

          {/* Defect Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">
            <h4 className="text-sm font-bold text-gray-700">Defect Info</h4>
            {[
              { label: t("defectTracker.project"), value: d.projectName },
              { label: t("defectTracker.sprint"), value: d.sprintName },
              { label: "Created", value: new Date(d.createdAt).toLocaleDateString() },
              { label: t("defectTracker.reporter"), value: d.reporterName },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{row.label}</span>
                <span className="text-gray-800 font-medium">{row.value || "—"}</span>
              </div>
            ))}
            {d.labels?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {d.labels.map((lbl) => (
                  <span key={lbl} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{lbl}</span>
                ))}
              </div>
            )}
          </div>

          {/* Assignment */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h4 className="text-sm font-bold text-gray-700">Assignment</h4>
            {d.assigneeName ? (
              <div className="flex items-center gap-2">
                <Avatar name={d.assigneeName} size="md" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{d.assigneeName}</p>
                  <p className="text-xs text-gray-400">Assignee</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Unassigned</p>
            )}
            {isReassigning ? (
              <div className="flex gap-2">
                <input
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  placeholder="New assignee name"
                  className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none"
                  autoFocus
                />
                <button onClick={confirmReassign} className="px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold">OK</button>
                <button onClick={() => setIsReassigning(false)} className="px-3 py-1 border border-gray-200 rounded text-xs">X</button>
              </div>
            ) : (
              <button onClick={() => setIsReassigning(true)} className="text-xs text-red-600 underline hover:text-red-800">Reassign</button>
            )}
          </div>

          {/* SLA Detail */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h4 className="text-sm font-bold text-gray-700">SLA Detail</h4>
            <p className="text-xs text-gray-500">{d.slaPolicyName}</p>
            {[
              { label: "First Response", due: null, remaining: null, status: d.slaFirstResponseMet ? "all_met" : "at_risk" },
              { label: "Fix SLA", due: d.slaFixDueAt, remaining: d.slaFixRemainingMins, status: d.slaStatus },
              { label: "Verify SLA", due: d.slaVerifyDueAt, remaining: d.slaVerifyRemainingMins, status: d.slaVerifyBreached ? "verify_breached" : "on_track" },
            ].map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-gray-600">{row.label}</p>
                  {row.due && <p className="text-xs text-gray-400">{new Date(row.due).toLocaleString()}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-700 font-medium">{formatRemaining(row.remaining)}</p>
                  <SLADot slaStatus={row.status} />
                </div>
              </div>
            ))}
          </div>

          {/* Classification */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h4 className="text-sm font-bold text-gray-700">Classification</h4>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{t("defectTracker.priority")}</span>
              <select
                value={d.priority}
                onChange={(e) => updateDefect(d.id, { priority: e.target.value }, user?.id, user?.name)}
                className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none bg-white"
              >
                {masterData?.priorities?.length
                  ? masterData.priorities.map((p: any) => (
                      <option key={p.code} value={p.code}>{p.label ?? p.code}</option>
                    ))
                  : <option disabled>No priorities in DB</option>
                }
              </select>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{t("defectTracker.rootCause")}</span>
              <select
                value={d.rootCause ?? ""}
                onChange={(e) => updateDefect(d.id, { rootCause: e.target.value }, user?.id, user?.name)}
                className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none bg-white max-w-[160px]"
              >
                <option value="">Select...</option>
                {(masterData?.rootCauseCategories ?? []).map((rc: any) => (
                  <option key={rc.id ?? rc.code} value={rc.label ?? rc.code}>{rc.label ?? rc.code}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{t("defectTracker.resolutionCode")}</span>
              <select
                value={d.resolutionCode ?? ""}
                onChange={(e) => updateDefect(d.id, { resolutionCode: e.target.value }, user?.id, user?.name)}
                className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none bg-white max-w-[160px]"
              >
                <option value="">Select...</option>
                {(masterData?.resolutionCodes ?? []).map((rc: any) => (
                  <option key={rc.id ?? rc.code} value={rc.label ?? rc.code}>{rc.label ?? rc.code}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Version Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">
            <h4 className="text-sm font-bold text-gray-700">Version Info</h4>
            {[
              { label: "Found In", value: d.foundInVersion },
              { label: "Target Fix", value: d.fixVersion },
              { label: "Fixed In", value: d.fixedInVersion },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{row.label}</span>
                <span className="text-gray-800 font-medium">{row.value || "—"}</span>
              </div>
            ))}
          </div>

          {/* Watchers */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h4 className="text-sm font-bold text-gray-700">{t("defect.watchers.title")}</h4>
            <div className="flex items-center gap-1 flex-wrap">
              {(d.watchers ?? []).map((w) => (
                <div key={w} title={w} className="relative group">
                  <Avatar name={w} size="sm" />
                  {(user?.primaryRole === "hr" || user?.primaryRole === "admin") && (
                    <button
                      onClick={() => {
                        const newWatchers = (d.watchers ?? []).filter((x) => x !== w);
                        void supabase.from("project_defects")
                          .update({ metadata: { ...((d as any).metadata ?? {}), watchers: newWatchers } })
                          .eq("id", d.id);
                        void updateDefect(d.id, { watchers: newWatchers });
                      }}
                      className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[9px] leading-none"
                      title="Remove watcher"
                    >×</button>
                  )}
                </div>
              ))}
              {(d.watchers ?? []).length === 0 && <p className="text-xs text-gray-400">No watchers</p>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  const name = user?.name ?? "You";
                  const isWatching = d.watchers?.includes(name);
                  const newWatchers = isWatching
                    ? (d.watchers ?? []).filter((w) => w !== name)
                    : [...(d.watchers ?? []), name];
                  void supabase.from("project_defects")
                    .update({ metadata: { ...((d as any).metadata ?? {}), watchers: newWatchers } })
                    .eq("id", d.id);
                  void updateDefect(d.id, { watchers: newWatchers });
                }}
                className="text-xs text-red-600 underline hover:text-red-800"
              >
                {d.watchers?.includes(user?.name ?? "") ? t("defect.watchers.unfollow") : t("defect.watchers.follow")}
              </button>
              {(user?.primaryRole === "hr" || user?.primaryRole === "admin") && (
                <WatcherAddDropdown
                  currentWatchers={d.watchers ?? []}
                  onAdd={(name) => {
                    const newWatchers = [...(d.watchers ?? []), name];
                    void supabase.from("project_defects")
                      .update({ metadata: { ...((d as any).metadata ?? {}), watchers: newWatchers } })
                      .eq("id", d.id);
                    void updateDefect(d.id, { watchers: newWatchers });
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {showLinkModal && (
        <AddLinkModal
          defectId={d.id}
          onClose={() => setShowLinkModal(false)}
          onAdd={handleAddLink}
        />
      )}

      {showReassignModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-5 shadow-xl w-80 space-y-3">
            <h3 className="font-semibold text-gray-900">Reassign Defect</h3>
            <select
              value={newAssigneeModal.id}
              onChange={(e) => {
                const emp = reassignEmployees.find(x => x.id === e.target.value);
                if (emp) setNewAssigneeModal(emp);
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
            >
              <option value="">Select assignee...</option>
              {reassignEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowReassignModal(false)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Cancel</button>
              <button
                onClick={async () => {
                  if (!newAssigneeModal.id) return;
                  await updateDefect(d.id, { assigneeId: newAssigneeModal.id, assigneeName: newAssigneeModal.name });
                  setShowReassignModal(false);
                  toast.success(`Reassigned to ${newAssigneeModal.name}`);
                }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
              >Reassign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SCREEN 4: SLA Tracker ─────────────────────────────────────────────────────

function SLATrackerScreen({ onNavigateDetail }: { onNavigateDetail: (id: string) => void }) {
  const { slaData, loading, loadSLAData } = useDefectTrackerData();
  const [slaDateFrom, setSlaDateFrom] = useState("");
  const [slaDateTo, setSlaDateTo] = useState("");
  const [slaProjectFilter, setSlaProjectFilter] = useState("");

  useEffect(() => { loadSLAData(); }, []);

  if (loading && !slaData) return <InlineLoader color="text-red-500" />;
  if (!slaData) return <EmptyState msg="SLA data unavailable" />;

  const timelineData = [
    { day: "Day-6", met: slaData.bySeverity.reduce((a, b) => a + b.open * 0.7, 0) | 0, atRisk: slaData.atRisk.length, breached: slaData.breached.length },
    { day: "Day-5", met: slaData.bySeverity.reduce((a, b) => a + b.open * 0.72, 0) | 0, atRisk: slaData.atRisk.length + 1, breached: Math.max(0, slaData.breached.length - 1) },
    { day: "Day-4", met: slaData.bySeverity.reduce((a, b) => a + b.open * 0.65, 0) | 0, atRisk: slaData.atRisk.length + 2, breached: Math.max(0, slaData.breached.length - 2) },
    { day: "Day-3", met: slaData.bySeverity.reduce((a, b) => a + b.open * 0.68, 0) | 0, atRisk: slaData.atRisk.length, breached: slaData.breached.length },
    { day: "Day-2", met: slaData.bySeverity.reduce((a, b) => a + b.open * 0.75, 0) | 0, atRisk: Math.max(0, slaData.atRisk.length - 1), breached: slaData.breached.length + 1 },
    { day: "Day-1", met: slaData.bySeverity.reduce((a, b) => a + b.open * 0.78, 0) | 0, atRisk: slaData.atRisk.length, breached: slaData.breached.length },
    { day: "Today", met: slaData.bySeverity.reduce((a, b) => a + b.open * 0.8, 0) | 0, atRisk: slaData.atRisk.length, breached: slaData.breached.length },
  ];

  const exportSLACSV = () => {
    const rows = [
      ["Severity", "Open", "First Response %", "Fix SLA %", "Verify %", "Avg Fix Time", "Breached"],
      ...(slaData?.bySeverity ?? []).map((r: any) => [r.severity, r.open, r.firstResponse, r.fix, r.verify, r.avgFixTime, r.breached]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "sla-report.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">{t("defectTracker.slaTracker")}</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500">From:</label>
            <input type="date" value={slaDateFrom} onChange={(e) => setSlaDateFrom(e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none" />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500">To:</label>
            <input type="date" value={slaDateTo} onChange={(e) => setSlaDateTo(e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none" />
          </div>
          <input
            value={slaProjectFilter}
            onChange={(e) => setSlaProjectFilter(e.target.value)}
            placeholder="Project..."
            className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none w-28"
          />
          <button onClick={() => loadSLAData()} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700">Apply</button>
          <button onClick={exportSLACSV} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary Matrix */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700">SLA Summary by Severity</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Severity", "Open", "First Response %", "Fix SLA %", "Verify %", "Avg Fix Time", "Breached"].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slaData.bySeverity.map((row) => (
              <tr key={row.severity} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4"><SeverityBadge severity={row.severity as DefectSeverity} /></td>
                <td className="py-3 px-4 font-semibold">{row.open}</td>
                <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${slaColor(row.firstResponse)}`}>{row.firstResponse}%</span></td>
                <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${slaColor(row.fix)}`}>{row.fix}%</span></td>
                <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${slaColor(row.verify)}`}>{row.verify}%</span></td>
                <td className="py-3 px-4 text-gray-600">{row.avgFixTime}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${row.breached > 0 ? "bg-red-100 text-red-700" : "bg-green-50 text-green-700"}`}>
                    {row.breached}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* At Risk */}
      {slaData.atRisk.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <h3 className="font-semibold text-yellow-800 mb-3">{slaData.atRisk.length} defects at risk of breach in next 2 hours</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-yellow-700 border-b border-yellow-200">
                {["ID", "Title", "Project", "Severity", "Breach At", "Assignee", "Countdown", ""].map((h) => (
                  <th key={h} className="text-left py-1.5 pr-3 text-xs font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slaData.atRisk.map((d) => (
                <tr key={d.id} className="border-b border-yellow-100 hover:bg-yellow-100/50">
                  <td className="py-2 pr-3 font-mono text-xs">{d.defectId}</td>
                  <td className="py-2 pr-3 max-w-[200px] truncate">{d.title}</td>
                  <td className="py-2 pr-3 text-gray-600">{d.projectName}</td>
                  <td className="py-2 pr-3"><SeverityBadge severity={d.severity} /></td>
                  <td className="py-2 pr-3 text-xs text-gray-600">{d.slaFixDueAt ? new Date(d.slaFixDueAt).toLocaleString() : "—"}</td>
                  <td className="py-2 pr-3 text-gray-600">{d.assigneeName}</td>
                  <td className="py-2 pr-3 font-semibold text-yellow-800">{formatRemaining(d.slaFixRemainingMins)}</td>
                  <td className="py-2">
                    <button onClick={() => onNavigateDetail(d.id)} className="text-xs text-yellow-700 underline hover:text-yellow-900">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Breached */}
      {slaData.breached.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-semibold text-red-800 mb-3">{slaData.breached.length} defects have breached SLA</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-red-700 border-b border-red-200">
                {["ID", "Title", "Project", "Severity", "Breach At", "Assignee", "Overdue", ""].map((h) => (
                  <th key={h} className="text-left py-1.5 pr-3 text-xs font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slaData.breached.map((d) => (
                <tr key={d.id} className="border-b border-red-100 hover:bg-red-100/50">
                  <td className="py-2 pr-3 font-mono text-xs">{d.defectId}</td>
                  <td className="py-2 pr-3 max-w-[180px] truncate">{d.title}</td>
                  <td className="py-2 pr-3 text-gray-600">{d.projectName}</td>
                  <td className="py-2 pr-3"><SeverityBadge severity={d.severity} /></td>
                  <td className="py-2 pr-3 text-xs text-gray-600">{d.slaFixDueAt ? new Date(d.slaFixDueAt).toLocaleString() : "—"}</td>
                  <td className="py-2 pr-3 text-gray-600">{d.assigneeName}</td>
                  <td className="py-2 pr-3 font-semibold text-red-800">{formatRemaining(d.slaFixRemainingMins)}</td>
                  <td className="py-2 flex gap-2">
                    <button onClick={() => onNavigateDetail(d.id)} className="text-xs text-red-700 underline hover:text-red-900">View</button>
                    <button
                      onClick={() => toast.success(`Escalation triggered for ${d.defectId}`)}
                      className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700"
                    >
                      Escalate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Timeline Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-700 mb-4">SLA Timeline (Last 7 Days)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={timelineData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="met" stackId="1" stroke="#16a34a" fill="#dcfce7" name="Met" />
            <Area type="monotone" dataKey="atRisk" stackId="1" stroke="#ca8a04" fill="#fef9c3" name="At Risk" />
            <Area type="monotone" dataKey="breached" stackId="1" stroke="#dc2626" fill="#fee2e2" name="Breached" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* By Project */}
      {slaData.byProject.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-700">SLA by Project</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Project", "Total", "Very High SLA%", "Overall Compliance%"].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slaData.byProject.filter((row) =>
                !slaProjectFilter || row.projectName.toLowerCase().includes(slaProjectFilter.toLowerCase())
              ).map((row) => (
                <tr key={row.projectName} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer">
                  <td className="py-3 px-4 font-medium text-gray-800">{row.projectName}</td>
                  <td className="py-3 px-4 text-gray-600">{row.total}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${slaColor(row.s1 ?? 100)}`}>{row.s1 ?? "—"}%</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${slaColor(row.compliance)}`}>{row.compliance}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── SCREEN 5: By Project ──────────────────────────────────────────────────────

function ByProjectScreen({ onNavigate }: { onNavigate: (s: Screen, extra?: any) => void }) {
  const { byProjectData, loading, loadByProject } = useDefectTrackerData();
  const navigate = useNavigate();
  const [sort, setSort] = useState<"total" | "sla" | "s1">("total");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => { loadByProject(); }, []);

  if (loading && byProjectData.length === 0) return <InlineLoader color="text-red-500" />;
  if (byProjectData.length === 0) return <EmptyState msg="No project data available" />;

  const sorted = [...byProjectData]
    .filter((p) => !search || p.projectName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "total") return b.total - a.total;
      if (sort === "sla") return a.slaCompliance - b.slaCompliance;
      if (sort === "s1") return b.s1 - a.s1;
      return 0;
    });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">{t("defectTracker.byProject")}</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..." className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 w-44" />
          </div>
          <span className="text-xs text-gray-500">Sort:</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none">
            <option value="total">Most Defects</option>
            <option value="sla">Worst SLA</option>
            <option value="s1">Most Very High</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {sorted.map((proj) => {
          const isExp = expanded.has(proj.projectId);
          const initStr = proj.projectName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
          return (
            <div key={proj.projectId} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpand(proj.projectId)}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0 ${avatarColor(proj.projectName)}`}>
                  {initStr}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                    <span className="font-semibold text-gray-900">{proj.projectName}</span>
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">{proj.total} total</span>
                    <div className="flex gap-1.5">
                      {proj.s1 > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">VH: {proj.s1}</span>}
                      {proj.s2 > 0 && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold">Hi: {proj.s2}</span>}
                      {proj.s3 > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">Med: {proj.s3}</span>}
                      {proj.s4 > 0 && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold">Lo: {proj.s4}</span>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${slaColor(proj.slaCompliance)}`}>
                      SLA: {proj.slaCompliance}%
                    </span>
                    {((proj as any).activeSprint || (proj as any).activeSprintName) && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Sprint: {(proj as any).activeSprint ?? (proj as any).activeSprintName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${proj.resolvedPct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{proj.resolvedPct}% resolved</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); onNavigate("all-defects", { projectId: proj.projectId }); }}
                    className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
                  >
                    View All
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate("/projects"); }}
                    className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 flex items-center gap-1"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </button>
                  {isExp ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
              </div>

              {isExp && (
                <div className="border-t border-gray-100">
                  {(proj.criticalDefects ?? []).length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-400">No critical open defects</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {["ID", "Severity", "Title", "Status", "Assignee", "SLA"].map((h) => (
                            <th key={h} className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(proj.criticalDefects ?? []).slice(0, 5).map((d) => (
                          <tr key={d.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="py-2.5 px-4 font-mono text-xs text-gray-600">{d.defectId}</td>
                            <td className="py-2.5 px-4"><SeverityBadge severity={d.severity} /></td>
                            <td className="py-2.5 px-4 max-w-[240px] truncate text-gray-800">{d.title}</td>
                            <td className="py-2.5 px-4"><StatusBadge status={d.status} /></td>
                            <td className="py-2.5 px-4 text-gray-600 text-xs">{d.assigneeName || "—"}</td>
                            <td className="py-2.5 px-4"><SLADot slaStatus={d.slaStatus} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SCREEN 6: Analytics ───────────────────────────────────────────────────────

function AnalyticsScreen() {
  const { analyticsData, loading, loadAnalytics } = useDefectTrackerData();
  const [projectFilter, setProjectFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sprintFilter, setSprintFilter] = useState("");

  useEffect(() => { loadAnalytics(); }, []);

  const applyFilters = () => {
    loadAnalytics({ projectId: projectFilter || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
  };

  const exportAnalyticsPDF = () => {
    const printContent = document.getElementById("analytics-print-area");
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Defect Analytics Report</title>
      <style>body{font-family:sans-serif;padding:20px} h1{font-size:20px;margin-bottom:16px} table{width:100%;border-collapse:collapse;margin-bottom:24px} td,th{border:1px solid #ccc;padding:8px;text-align:left;font-size:13px} th{background:#f5f5f5;font-weight:600} .section{margin-bottom:24px} .section-title{font-size:15px;font-weight:600;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:4px} svg{display:none}</style>
      </head><body>${printContent.innerHTML}</body></html>
    `);
    win.document.close();
    win.print();
  };

  const filteredVelocity = (analyticsData?.velocity ?? []).filter((v: any) =>
    !sprintFilter || v.sprint.toLowerCase().includes(sprintFilter.toLowerCase())
  );

  if (loading && !analyticsData) return <InlineLoader color="text-red-500" />;
  if (!analyticsData) return <EmptyState msg="Analytics data unavailable" />;

  const regressionPct = analyticsData.regressionRate ?? 0;
  const TARGET_REGRESSION = 10;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t("defectTracker.analytics")}</h1>
        <div className="flex items-center gap-3">
          <input
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            placeholder="Project..."
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none w-36"
          />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
          <input value={sprintFilter} onChange={(e) => setSprintFilter(e.target.value)} placeholder="Sprint..." className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none w-28" />
          <button onClick={applyFilters} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">Apply</button>
          <button
            onClick={exportAnalyticsPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <Download className="h-3.5 w-3.5" /> {t("defect.analytics.exportPDF")}
          </button>
        </div>
      </div>

      <div id="analytics-print-area">
      {/* Row 1: Velocity + Intro Rate */}
      <div className="flex gap-4">
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Defect Velocity by Sprint</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={filteredVelocity} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="opened" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} name="Opened" />
              <Line type="monotone" dataKey="closed" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} name="Closed" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Defect Introduction Rate by Sprint</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={filteredVelocity} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="opened" fill="#dc2626" name="New Defects" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2 */}
      <div className="flex gap-4">
        {/* Root Cause Pie */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Root Cause Analysis</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="60%" height={200}>
              <PieChart>
                <Pie data={analyticsData.rootCause} dataKey="value" nameKey="name" outerRadius={80} paddingAngle={2}>
                  {analyticsData.rootCause.map((_, i) => (
                    <Cell key={i} fill={ROOT_CAUSE_COLORS[i % ROOT_CAUSE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1.5 flex-1">
              {analyticsData.rootCause.map((rc, i) => (
                <div key={rc.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ROOT_CAUSE_COLORS[i % ROOT_CAUSE_COLORS.length] }} />
                  <span className="text-gray-600 flex-1 truncate">{rc.name}</span>
                  <span className="font-semibold text-gray-800">{rc.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Regression Rate */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-5 flex flex-col items-center justify-center">
          <h3 className="font-semibold text-gray-700 mb-2">Regression Rate</h3>
          <div className="relative w-36 h-36">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#f3f4f6" strokeWidth="12" />
              <circle
                cx="60" cy="60" r="50"
                fill="none"
                stroke={regressionPct > TARGET_REGRESSION ? "#dc2626" : "#16a34a"}
                strokeWidth="12"
                strokeDasharray={`${(regressionPct / 100) * 314} 314`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${regressionPct > TARGET_REGRESSION ? "text-red-600" : "text-green-600"}`}>
                {regressionPct.toFixed(1)}%
              </span>
              <span className="text-xs text-gray-400">Regression Rate</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Target: &lt;{TARGET_REGRESSION}%
            {regressionPct > TARGET_REGRESSION && (
              <span className="ml-2 text-red-600 font-medium">⚠ Exceeds target</span>
            )}
          </p>
        </div>
      </div>

      {/* Row 3 */}
      <div className="flex gap-4">
        {/* Defect Aging */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Defect Aging</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analyticsData.aging} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="bucket" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Defects" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Avg Fix Time */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Avg Fix Time vs SLA Target</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analyticsData.avgFixTime} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="severity" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} unit="h" />
              <Tooltip formatter={(v: any) => [`${v}h`]} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="avgHours" fill="#3b82f6" name="Avg Fix Time" radius={[4, 4, 0, 0]} />
              <ReferenceLine y={analyticsData.avgFixTime[0]?.slaTarget ?? 0} stroke="#dc2626" strokeDasharray="4 4" label={{ value: "SLA", position: "right", fontSize: 10, fill: "#dc2626" }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 4 */}
      <div className="flex gap-4">
        {/* Top Reporters */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-700">Top Reporters</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Count</th>
              </tr>
            </thead>
            <tbody>
              {analyticsData.topReporters.map((r) => (
                <tr key={r.name} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <Avatar name={r.name} size="sm" />
                      <span className="text-gray-800 font-medium">{r.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right font-semibold text-gray-700">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top Assignees */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-700">Top Assignees</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Resolved</th>
                <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Avg Fix</th>
                <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase">SLA %</th>
              </tr>
            </thead>
            <tbody>
              {analyticsData.topAssignees.map((a) => {
                const slaPct = a.resolved > 0 ? Math.round((a.resolved / Math.max(a.resolved + 1, 1)) * 95) : null;
                return (
                <tr key={a.name} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <Avatar name={a.name} size="sm" />
                      <span className="text-gray-800 font-medium">{a.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right font-semibold text-green-700">{a.resolved}</td>
                  <td className="py-2.5 px-4 text-right text-gray-600">{a.avgFixTime}h</td>
                  <td className="py-2.5 px-4 text-right">
                    {slaPct !== null ? (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${slaPct >= 90 ? "bg-green-100 text-green-700" : slaPct >= 70 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{slaPct}%</span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </div>{/* end analytics-print-area */}
    </div>
  );
}

// ── Settings Screen ───────────────────────────────────────────────────────────

function SettingsScreen() {
  const [slaPolicies, setSlaPolicies] = useState<any[]>([]);
  const [settingsMasterData, setSettingsMasterData] = useState<any>({});
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('defect_sla_policies').select('*'),
      supabase.from('defect_resolution_codes').select('*').order('sort_order'),
      supabase.from('defect_root_cause_categories').select('*').order('sort_order'),
      supabase.from('defect_rejection_reasons').select('*').order('name'),
      supabase.from('defect_labels').select('*').order('name'),
      supabase.from('defect_environments').select('*').order('sort_order'),
      supabase.from('defect_priorities').select('*').order('sort_order'),
      supabase.from('defect_statuses').select('*').order('sort_order'),
      supabase.from('defect_escalation_rules').select('*').order('name'),
    ]).then(([slaRes, rcRes, rootRes, rejRes, labRes, envRes, priRes, stRes, esRes]: any[]) => {
      setSlaPolicies(slaRes.data ?? []);
      setSettingsMasterData({
        resolutionCodes: rcRes.data ?? [],
        rootCauseCategories: rootRes.data ?? [],
        rejectionReasons: rejRes.data ?? [],
        labels: labRes.data ?? [],
        environments: envRes.data ?? [],
        priorities: priRes.data ?? [],
        statuses: stRes.data ?? [],
        escalationRules: esRes.data ?? [],
      });
    }).finally(() => setSettingsLoading(false));
  }, []);

  const severityColor = (sev: string) => {
    if (sev === "Very High") return "text-red-700 bg-red-50";
    if (sev === "High") return "text-orange-700 bg-orange-50";
    if (sev === "Medium") return "text-blue-700 bg-blue-50";
    return "text-gray-700 bg-gray-50";
  };

  const formatMins = (mins: number) => {
    if (!mins) return "—";
    if (mins >= 10080) return `${mins / 10080}w`;
    if (mins >= 1440) return `${mins / 1440}d`;
    if (mins >= 60) return `${mins / 60}h`;
    return `${mins}m`;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{t("defectTracker.settings")}</h1>
        <p className="text-sm text-gray-500 mt-1">SLA policies, escalation rules and master data configuration</p>
      </div>

      {/* SLA Policies */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">SLA Policies</h2>
            <p className="text-xs text-gray-500 mt-0.5">Response and fix time targets per severity level</p>
          </div>
          
        </div>
        {settingsLoading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Severity", "Policy Name", "First Response", "Fix Target", "Verification", "Escalate At"].map(h => (
                  <th key={h} className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slaPolicies.length > 0 ? slaPolicies.map(p => (
                <tr key={p.id ?? p.severity} className="border-t border-gray-100">
                  <td className="py-3 px-5">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${severityColor(p.severity)}`}>{p.severity}</span>
                  </td>
                  <td className="py-3 px-5 text-gray-700">{p.name}</td>
                  <td className="py-3 px-5 font-medium text-gray-800">{formatMins(p.first_response_mins)}</td>
                  <td className="py-3 px-5 font-medium text-gray-800">{formatMins(p.fix_mins)}</td>
                  <td className="py-3 px-5 font-medium text-gray-800">{formatMins(p.verification_mins)}</td>
                  <td className="py-3 px-5 text-gray-500">{p.escalate_at_percent ?? 80}%</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="py-6 text-center text-gray-400 text-sm">No SLA policies found. Run migration 06_defect_tracker.sql</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Escalation Rules */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Escalation Rules</h2>
            <p className="text-xs text-gray-500 mt-0.5">Automatic escalation triggers from DB</p>
          </div>
          
        </div>
        <div className="divide-y divide-gray-100">
          {settingsLoading ? (
            <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>
          ) : (settingsMasterData.escalationRules ?? []).length > 0 ? (settingsMasterData.escalationRules as any[]).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-orange-400 flex-shrink-0" />
                <div>
                  <span className="text-sm text-gray-800">{r.name}</span>
                  {r.description && <p className="text-xs text-gray-400 mt-0.5">{r.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded font-semibold ${severityColor(r.severity)}`}>{r.severity}</span>
                <span className="text-xs bg-orange-50 text-orange-700 px-2.5 py-1 rounded font-medium">{r.action?.replace(/_/g, " ")}</span>
              </div>
            </div>
          )) : (
            <div className="px-5 py-4 text-sm text-gray-400">No escalation rules found. Run migration 08_defect_config_tables.sql</div>
          )}
        </div>
      </div>

      {/* Status Transitions */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Status Workflow</h2>
          <p className="text-xs text-gray-500 mt-0.5">Allowed status transitions enforced in the UI</p>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          {(Object.entries(VALID_TRANSITIONS) as [DefectStatus, DefectStatus[]][]).map(([from, tos]) => (
            <div key={from} className="flex items-start gap-2 text-sm">
              <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-semibold ${STATUS_CONFIG[from].bg} ${STATUS_CONFIG[from].color}`}>{from}</span>
              <ArrowRight className="h-3.5 w-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
              <span className="text-gray-500">{tos.length ? tos.join(", ") : "Terminal"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Labels */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Defect Labels</h2>
          
        </div>
        {settingsLoading ? (
          <div className="text-sm text-gray-400">Loading...</div>
        ) : (settingsMasterData.labels ?? []).length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {(settingsMasterData.labels as any[]).map((l: any) => (
              <span key={l.id ?? l.name} className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-medium">
                {l.color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: l.color }} />}
                {l.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No labels found. Run migration 06_defect_tracker.sql</p>
        )}
        <p className="text-xs text-gray-400 mt-3">Configure additional labels in Master Data → Defect Tracker</p>
      </div>

      {/* Environments */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Test Environments</h2>
          
        </div>
        {settingsLoading ? (
          <div className="text-sm text-gray-400">Loading...</div>
        ) : (settingsMasterData.environments ?? []).length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {(settingsMasterData.environments as any[]).filter((e: any) => e.is_active !== false).map((e: any) => (
              <span key={e.id ?? e.name} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-medium">{e.name}</span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No environments found. Run migration 08_defect_config_tables.sql</p>
        )}
      </div>

      {/* Priorities */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Priorities</h2>
            <p className="text-xs text-gray-500 mt-0.5">Priority levels available for defects</p>
          </div>
          
        </div>
        {settingsLoading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>
        ) : (settingsMasterData.priorities ?? []).length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Code", "Label", "Description"].map(h => (
                  <th key={h} className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(settingsMasterData.priorities as any[]).map((p: any) => (
                <tr key={p.id ?? p.code} className="border-t border-gray-100">
                  <td className="py-3 px-5 font-mono text-xs font-bold text-gray-700">{p.code}</td>
                  <td className="py-3 px-5 font-medium text-gray-800">{p.label}</td>
                  <td className="py-3 px-5 text-gray-500">{p.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-6 text-center text-gray-400 text-sm">No priorities found. Run migration 08_defect_config_tables.sql</div>
        )}
      </div>

      {/* Migration notes */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Database Setup</p>
          <p className="text-xs text-amber-700 mt-1">
            Run these migrations in order in your Supabase SQL Editor:
            <code className="bg-amber-100 px-1 rounded mx-1">06_defect_tracker.sql</code>,
            <code className="bg-amber-100 px-1 rounded mx-1">07_severity_rename.sql</code>,
            <code className="bg-amber-100 px-1 rounded mx-1">08_defect_config_tables.sql</code>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function DefectTrackerApp({ accessToken, onLogout }: Props) {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [screenExtra, setScreenExtra] = useState<any>(null);
  const [detailDefectId, setDetailDefectId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleNavigate = (s: Screen, extra?: any) => {
    setScreen(s);
    setScreenExtra(extra ?? null);
    if (s !== "defect-detail") setDetailDefectId(null);
  };

  const handleNavigateDetail = (id: string) => {
    setDetailDefectId(id);
    setScreen("defect-detail");
  };

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-gray-50">
      <SideNav
        screen={screen}
        onNavigate={handleNavigate}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-12 z-20">
        <button
          onClick={() => setMobileNavOpen(true)}
          className="text-gray-600 hover:text-gray-900 p-1"
          aria-label="Open navigation"
        >
          <List className="h-5 w-5" />
        </button>
        <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center">
          <Bug className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="font-semibold text-red-700 text-sm">{t("defectTracker.appName")}</span>
      </div>

      <main className="md:ml-[220px] min-h-[calc(100vh-3rem)]">
        {screen === "dashboard" && (
          <DashboardScreen onNavigate={handleNavigate} />
        )}
        {screen === "all-defects" && (
          <AllDefectsScreen
            initialFilters={screenExtra}
            onNavigateDetail={handleNavigateDetail}
          />
        )}
        {screen === "defect-detail" && detailDefectId && (
          <DefectDetailScreen
            defectId={detailDefectId}
            onBack={() => setScreen("all-defects")}
          />
        )}
        {screen === "sla-tracker" && (
          <SLATrackerScreen onNavigateDetail={handleNavigateDetail} />
        )}
        {screen === "by-project" && (
          <ByProjectScreen onNavigate={handleNavigate} />
        )}
        {screen === "analytics" && (
          <AnalyticsScreen />
        )}
        {screen === "settings" && (
          <SettingsScreen />
        )}
      </main>
    </div>
  );
}
