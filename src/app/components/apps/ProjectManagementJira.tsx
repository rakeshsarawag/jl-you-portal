import { useState, useEffect, useRef, useCallback, useMemo, type TextareaHTMLAttributes } from "react";
import { InlineLoader } from "../ui/PageLoader";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  Plus,
  Edit,
  Edit2,
  Trash2,
  X,
  Users,
  Clock,
  Calendar,
  ChevronLeft,
  LayoutList,
  LayoutGrid,
  Columns,
  CheckSquare,
  Circle,
  GanttChartSquare,
  Flag,
  Zap,
  BookOpen,
  Bug,
  Search,
  FlaskConical,
  Link2,
  Folder,
  AlertTriangle,
  Timer,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Download,
  ListChecks,
  ExternalLink,
} from "lucide-react";
import { useUser } from "../../context/UserContext";
import {
  useProjectData,
  Project,
  ProjectTask,
  ProjectMember,
} from "../../hooks/useProjectData";
import { t } from "../../../i18n/index";
import { API_BASE, publicAnonKey, safeJson, apiHeaders, supabase } from "../../utils/constants";
import { useSectionPermission } from "../SectionGuard";
import {
  PROJECT_STATUSES,
  PROJECT_PRIORITIES,
  TASK_STATUSES,
  TASK_PRIORITIES,
  PROJECT_CATEGORIES,
  MEMBER_ROLES,
  RAG_STATUSES,
  TIME_LOG_TYPES,
  PM_METHODOLOGIES,
  SPRINT_DURATIONS,
  DEFAULT_SPRINT_DURATION,
} from "../../../constants/apps/projects";
import { SelectOptions } from "../../context/ValueHelpsContext";
import ReportDefectButton from "../ReportDefectButton";
import { useEmployeeOptions } from "../../hooks/useSharedData";
import EmployeeSearchDropdown from "../ui/EmployeeSearchDropdown";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isManagerOrAdmin(role?: string) {
  return role === "manager" || role === "admin";
}

function isAdmin(role?: string) {
  return role === "admin";
}

async function notifyPM(opts: {
  projectId: string;
  recipientId: string;
  eventType: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}) {
  try {
    void supabase.from("project_notifications").insert([{
      project_id: opts.projectId,
      recipient_id: opts.recipientId,
      event_type: opts.eventType,
      title: opts.title,
      body: opts.body ?? "",
      entity_type: opts.entityType ?? null,
      entity_id: opts.entityId ?? null,
    }]);
  } catch { /* fire and forget */ }
}

const STATUS_COLORS: Record<string, string> = {
  Planning: "bg-gray-100 text-gray-700",
  Active: "bg-blue-100 text-blue-700",
  "On Hold": "bg-orange-100 text-orange-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
};

const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-green-100 text-green-700",
  Medium: "bg-yellow-100 text-yellow-700",
  High: "bg-orange-100 text-orange-700",
  Critical: "bg-red-100 text-red-700",
};

const RAG_COLORS: Record<string, string> = {
  Green: "bg-green-500",
  Amber: "bg-orange-400",
  Red: "bg-red-500",
};

function RagDot({ status }: { status: string }) {
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full ${RAG_COLORS[status] ?? "bg-gray-400"}`}
      title={status}
    />
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded text-xs">
      {label}
      <button onClick={onRemove} className="hover:text-indigo-900"><X size={10} /></button>
    </span>
  );
}

function Badge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5">
      <div
        className="bg-blue-500 h-1.5 rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
      {initials}
    </div>
  );
}


function daysRemaining(endDate: string) {
  const end = new Date(endDate);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function computeHealthScore(project: Project): number {
  let score = 100;
  const today = new Date().toISOString().split("T")[0];
  const tasks = project.tasks ?? [];
  const doneTasks = tasks.filter((t) => t.status === "Done").length;
  const totalTasks = tasks.length;
  if (project.endDate && project.endDate < today && project.status !== "Completed") score -= 25;
  const overdue = tasks.filter((t) => t.dueDate && t.dueDate < today && t.status !== "Done").length;
  if (totalTasks > 0) score -= Math.min(20, Math.round((overdue / totalTasks) * 40));
  if (project.budget && project.spent && project.spent > project.budget) score -= 15;
  if (totalTasks > 0) {
    const pct = doneTasks / totalTasks;
    if (pct < 0.2 && project.status === "Active") score -= 10;
  }
  return Math.max(0, Math.min(100, score));
}

function healthLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: "Healthy", color: "text-green-700", bg: "bg-green-50 border-green-200" };
  if (score >= 60) return { label: "At Risk", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" };
  return { label: "Critical", color: "text-red-700", bg: "bg-red-50 border-red-200" };
}

function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ─── Forms ────────────────────────────────────────────────────────────────────

interface ProjectFormProps {
  initial?: Partial<Project>;
  onSubmit: (data: Partial<Project>) => Promise<void>;
  onCancel: () => void;
  methodologyOptions?: string[];
}

function ProjectForm({ initial, onSubmit, onCancel, methodologyOptions = [...PM_METHODOLOGIES] }: ProjectFormProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Partial<Project> & { methodology?: string; budgetCurrency?: string; ragStatus?: string }>({
    name: "",
    description: "",
    category: PROJECT_CATEGORIES[0],
    priority: "Medium",
    status: "Planning",
    startDate: "",
    endDate: "",
    budget: undefined,
    budgetCurrency: "USD",
    managerName: "",
    methodology: methodologyOptions[0] ?? PM_METHODOLOGIES[0],
    ragStatus: "Amber",
    ...initial,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [wizardMembers, setWizardMembers] = useState<{ name: string; role: string }[]>([]);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState(MEMBER_ROLES[0]);

  useEffect(() => {
    fetch(`${API_BASE}/directory/employees`, { headers: apiHeaders() })
      .then(r => r.json())
      .then(json => {
        const list = (json.data ?? [])
          .filter((e: any) => e.status !== "Inactive")
          .map((e: any) => ({ id: e.id, name: e.employee_name ?? e.fullName ?? e.name ?? "" }))
          .filter((e: any) => e.name);
        if (list.length > 0) setEmployees(list);
      })
      .catch(() => {});
  }, []);

  function set(k: string, v: unknown) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  }

  const hasSprints = ["Scrum", "SAFe", "Hybrid"].some(m => (form.methodology ?? "").includes(m));
  const hasPoints = ["Scrum", "SAFe", "Hybrid", "Kanban"].some(m => (form.methodology ?? "").includes(m));

  function validateStep1() {
    const errs: Record<string, string> = {};
    if (!form.name?.trim() || form.name.trim().length < 3) errs.name = t("project.nameRequired");
    return errs;
  }
  function validateStep2() {
    const errs: Record<string, string> = {};
    if (!form.startDate) errs.startDate = t("project.startDateRequired");
    if (!form.endDate) errs.endDate = t("project.endDateRequired");
    return errs;
  }

  function handleNext() {
    if (step === 1) {
      const errs = validateStep1();
      if (Object.keys(errs).length) { setErrors(errs); return; }
    }
    if (step === 2) {
      const errs = validateStep2();
      if (Object.keys(errs).length) { setErrors(errs); return; }
    }
    setErrors({});
    setStep(s => s + 1);
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      await onSubmit({ ...form, members: wizardMembers.map(m => ({ employeeName: m.name, role: m.role })) } as Partial<Project>);
    } finally {
      setSaving(false);
    }
  }

  const STEP_LABELS = ["Basic Info", "Dates & Budget", "Team"];

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-2 justify-center">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <div key={n} className="flex items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${done ? "bg-indigo-500 border-indigo-500 text-white" : active ? "border-indigo-500 text-indigo-600 bg-indigo-50" : "border-border text-muted-foreground bg-muted"}`}>
                {done ? "✓" : n}
              </div>
              <span className={`text-xs ${active ? "font-semibold text-indigo-600" : "text-muted-foreground"}`}>{label}</span>
              {i < STEP_LABELS.length - 1 && <div className="w-6 h-px bg-border mx-1" />}
            </div>
          );
        })}
      </div>

      {/* Step 1 — Basic Info */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("project.projectName")} *</label>
            <input
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.name ? "border-red-400" : "border-border"}`}
              value={form.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
              maxLength={100}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("project.description")}</label>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={2}
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("project.category")}</label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.category ?? PROJECT_CATEGORIES[0]}
                onChange={(e) => set("category", e.target.value)}
              >
                <SelectOptions entity="project" field="category" fallback={["Internal", "Client", "R&D", "Infrastructure"]} />
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("project.methodology") || "Methodology"}</label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.methodology ?? methodologyOptions[0]}
                onChange={(e) => set("methodology", e.target.value)}
              >
                {methodologyOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("common.status")}</label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.status ?? "Planning"}
                onChange={(e) => set("status", e.target.value)}
              >
                {PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("projects.priority")}</label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.priority ?? "Medium"}
                onChange={(e) => set("priority", e.target.value)}
              >
                <SelectOptions entity="project" field="priority" fallback={["Low", "Medium", "High", "Critical"]} />
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t("projects.ragStatus")}</label>
            <div className="flex gap-2">
              {RAG_STATUSES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => set("ragStatus", r)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${form.ragStatus === r ? "border-gray-700 shadow" : "border-transparent opacity-60 hover:opacity-90"} ${RAG_COLORS[r]} text-white`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — Dates & Budget */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("project.startDate")} *</label>
              <input
                type="date"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.startDate ? "border-red-400" : "border-border"}`}
                value={form.startDate ?? ""}
                onChange={(e) => set("startDate", e.target.value)}
              />
              {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("project.endDate")} *</label>
              <input
                type="date"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.endDate ? "border-red-400" : "border-border"}`}
                value={form.endDate ?? ""}
                onChange={(e) => set("endDate", e.target.value)}
              />
              {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("project.budgetLabel")}</label>
              <input
                type="number"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.budget ?? ""}
                onChange={(e) => set("budget", e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Currency</label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.budgetCurrency ?? "USD"}
                onChange={(e) => set("budgetCurrency", e.target.value)}
              >
                {["USD", "EUR", "GBP", "INR"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {hasSprints && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Sprint Length (days)</label>
              <input
                type="number"
                min={1}
                max={30}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={(form as any).sprintLength ?? DEFAULT_SPRINT_DURATION}
                onChange={(e) => set("sprintLength", e.target.value ? Number(e.target.value) : DEFAULT_SPRINT_DURATION)}
              />
            </div>
          )}
          {hasPoints && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Story Point Scale</label>
              <div className="flex gap-2">
                {["Fibonacci", "T-Shirt", "Linear"].map(scale => (
                  <button
                    key={scale}
                    type="button"
                    onClick={() => set("storyPointScale", scale)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${(form as any).storyPointScale === scale ? "bg-indigo-500 text-white border-indigo-500" : "border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    {scale}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Team */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("project.managerName")}</label>
            <EmployeeSearchDropdown
              value={form.managerName ?? ""}
              onChange={(name) => set("managerName", name)}
              placeholder="Search manager…"
            />
          </div>
          <div className="border border-border rounded-lg p-3 space-y-3">
            <p className="text-sm font-medium text-foreground">Add Members</p>
            <div className="flex gap-2">
              <EmployeeSearchDropdown
                value={newMemberName}
                onChange={(name) => setNewMemberName(name)}
                placeholder="Search member…"
                className="flex-1"
              />
              <select
                className="border border-border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
              >
                {MEMBER_ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!newMemberName.trim()) return;
                  setWizardMembers(m => [...m, { name: newMemberName.trim(), role: newMemberRole }]);
                  setNewMemberName("");
                }}
                className="px-3 py-2 text-sm text-white bg-indigo-500 rounded-lg hover:bg-indigo-600"
              >
                Add
              </button>
            </div>
            {wizardMembers.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {wizardMembers.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Avatar name={m.name} />
                    <span className="flex-1 font-medium">{m.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">{m.role}</span>
                    <button type="button" onClick={() => setWizardMembers(ms => ms.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2 border-t">
        <button
          type="button"
          onClick={step === 1 ? onCancel : () => setStep(s => s - 1)}
          className="px-4 py-2 text-sm text-foreground border border-border rounded-lg hover:bg-muted"
        >
          {step === 1 ? t("common.cancel") : "← Back"}
        </button>
        {step < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            className="px-4 py-2 text-sm text-white bg-indigo-500 rounded-lg hover:bg-indigo-600"
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="px-4 py-2 text-sm text-white bg-indigo-500 rounded-lg hover:bg-indigo-600 disabled:opacity-50"
          >
            {saving ? t("common.saving") : initial?.id ? t("project.updateProject") : t("project.createProject")}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MentionTextarea ──────────────────────────────────────────────────────────

// Employee cache shared across all MentionTextarea instances on this page
let _mentionEmployeeCache: { id: string; full_name: string }[] | null = null;
async function fetchMentionEmployees(): Promise<{ id: string; full_name: string }[]> {
  if (_mentionEmployeeCache) return _mentionEmployeeCache;
  try {
    const res = await fetch(`${API_BASE}/directory/employees`, {
      headers: { "Content-Type": "application/json", apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
    });
    const json = await res.json().catch(() => ({}));
    const rows = (json.data ?? []) as any[];
    _mentionEmployeeCache = rows
      .map((e: any) => {
        const full_name = e.full_name ?? e.name ?? `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim();
        return { id: e.id, full_name };
      })
      .filter((e) => e.full_name);
  } catch {
    _mentionEmployeeCache = [];
  }
  return _mentionEmployeeCache!;
}

function MentionTextarea({ value, onChange, projectId: _projectId, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { projectId?: string }) {
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionResults, setMentionResults] = useState<{ id: string; full_name: string }[]>([]);
  const [allEmployees, setAllEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Pre-load employees once on mount
  useEffect(() => {
    fetchMentionEmployees().then(setAllEmployees);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    onChange?.(e);
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/@(\w*)$/);
    if (match) {
      const q = match[1].toLowerCase();
      setMentionQuery(match[1]);
      setCursorPos(cursor);
      setShowDropdown(true);
      const filtered = allEmployees
        .filter((emp) => emp.full_name.toLowerCase().includes(q))
        .slice(0, 8);
      setMentionResults(filtered);
    } else {
      setShowDropdown(false);
    }
  };

  const insertMention = (emp: { id: string; full_name: string }) => {
    if (!ref.current) return;
    const val = ref.current.value;
    const textBefore = val.slice(0, cursorPos);
    const atIdx = textBefore.lastIndexOf("@");
    const newVal = val.slice(0, atIdx) + `@${emp.full_name} ` + val.slice(cursorPos);
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    nativeInputValueSetter?.call(ref.current, newVal);
    ref.current.dispatchEvent(new Event("input", { bubbles: true }));
    onChange?.({ target: ref.current } as React.ChangeEvent<HTMLTextAreaElement>);
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") setShowDropdown(false);
    rest.onKeyDown?.(e);
  };

  useEffect(() => {
    if (!showDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDropdown]);

  return (
    <div className="relative">
      <textarea ref={ref} value={value} onChange={handleChange} onKeyDown={handleKeyDown} {...rest} />
      {showDropdown && mentionResults.length > 0 && (
        <div className="absolute z-50 bg-card border border-border rounded-lg shadow-lg mt-1 w-56 max-h-48 overflow-y-auto">
          <div className="px-3 py-1.5 border-b border-border bg-muted/50">
            <p className="text-xs font-medium text-muted-foreground">Mention a team member</p>
          </div>
          {mentionResults.map((emp) => (
            <button key={emp.id} type="button"
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted border-b border-border last:border-b-0 transition-colors flex items-center gap-2"
              onClick={() => insertMention(emp)}>
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                {emp.full_name.charAt(0).toUpperCase()}
              </span>
              <span className="text-foreground font-medium">{emp.full_name}</span>
            </button>
          ))}
        </div>
      )}
      {showDropdown && mentionResults.length === 0 && mentionQuery.length > 0 && (
        <div className="absolute z-50 bg-white border border-border rounded-lg shadow-lg mt-1 w-48 px-3 py-2 text-sm text-muted-foreground">
          {t("pm.mention.noResults")}
        </div>
      )}
    </div>
  );
}

// ─── Task Form ────────────────────────────────────────────────────────────────

interface TaskFormProps {
  onSubmit: (data: Partial<ProjectTask>) => Promise<void>;
  onCancel: () => void;
  sprintOptions?: { id: string; name: string }[];
  initialData?: Partial<ProjectTask>;
}

const TASK_TYPES = ['task', 'story', 'bug', 'spike', 'research'] as const;

function TaskForm({ onSubmit, onCancel, sprintOptions = [], initialData }: TaskFormProps) {
  const [form, setForm] = useState<Partial<ProjectTask>>({
    title: "",
    description: "",
    priority: "Medium",
    taskType: "task",
    assigneeName: "",
    dueDate: "",
    startDate: "",
    estimatedHours: undefined,
    sprintId: undefined,
    ...initialData,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [taskEmployees, setTaskEmployees] = useState<string[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/directory/employees`, { headers: apiHeaders() })
      .then(r => r.json()).then(json => {
        const names = (json.data ?? []).filter((e: any) => e.status !== 'Inactive').map((e: any) => e.employee_name ?? e.fullName ?? e.name ?? "").filter(Boolean);
        if (names.length) setTaskEmployees(names);
      }).catch(() => {});
  }, []);

  function set(k: keyof ProjectTask, v: unknown) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.title?.trim()) errs.title = "Title is required";
    if (!form.assigneeName?.trim()) errs.assigneeName = "Assignee is required";
    if (!form.dueDate) errs.dueDate = "Due date is required";
    if (!form.estimatedHours) {
      errs.estimatedHours = "Estimated hours is required";
    } else if (form.estimatedHours > 8) {
      errs.estimatedHours = "A single task cannot exceed 8 hours";
    } else if (form.estimatedHours <= 0) {
      errs.estimatedHours = "Hours must be greater than 0";
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onSubmit({ ...form, status: "Todo" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{t("project.taskTitle")} *</label>
        <input
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.title ? "border-red-400" : "border-border"}`}
          value={form.title ?? ""}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Short, clear task title"
        />
        {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{t("project.description")}</label>
        <MentionTextarea
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          placeholder={t("pm.mention.placeholder")}
        />
      </div>

      {/* Type + Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Task Type *</label>
          <select
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.taskType ?? "task"}
            onChange={(e) => set("taskType", e.target.value)}
          >
            {TASK_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("projects.priority")} *</label>
          <select
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.priority ?? "Medium"}
            onChange={(e) => set("priority", e.target.value)}
          >
            {TASK_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Assignee */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">{t("project.assigneeName")} *</label>
        <EmployeeSearchDropdown
          value={form.assigneeName ?? ""}
          onChange={(name, id) => { set("assigneeName", name); set("assigneeId", id ?? undefined); }}
          placeholder="Search assignee…"
          className={errors.assigneeName ? "ring-1 ring-red-400 rounded-lg" : ""}
        />
        {errors.assigneeName && <p className="text-red-500 text-xs mt-1">{errors.assigneeName}</p>}
      </div>

      {/* Start Date + Due Date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Start Date</label>
          <input
            type="date"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.startDate ?? ""}
            onChange={(e) => set("startDate", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("projects.dueDate")} *</label>
          <input
            type="date"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.dueDate ? "border-red-400" : "border-border"}`}
            value={form.dueDate ?? ""}
            onChange={(e) => set("dueDate", e.target.value)}
          />
          {errors.dueDate && <p className="text-red-500 text-xs mt-1">{errors.dueDate}</p>}
        </div>
      </div>

      {/* Estimated Hours */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {t("projects.estimatedHours")} * <span className="text-muted-foreground font-normal">(max 8h per task)</span>
        </label>
        <input
          type="number"
          min="0.5"
          max="8"
          step="0.5"
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.estimatedHours ? "border-red-400" : "border-border"}`}
          value={form.estimatedHours ?? ""}
          onChange={(e) => set("estimatedHours", e.target.value ? Number(e.target.value) : undefined)}
          placeholder="0.5 – 8"
        />
        {errors.estimatedHours && <p className="text-red-500 text-xs mt-1">{errors.estimatedHours}</p>}
      </div>

      {/* Sprint Assignment */}
      {sprintOptions.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Sprint <span className="text-muted-foreground font-normal">(optional)</span></label>
          <select
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
            value={form.sprintId ?? ""}
            onChange={(e) => set("sprintId", e.target.value || undefined)}
          >
            <option value="">No sprint (backlog)</option>
            {sprintOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-foreground border border-border rounded-lg hover:bg-muted">
          {t("common.cancel")}
        </button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? t("common.saving") : (initialData?.id ? t("common.save") : t("project.createTask"))}
        </button>
      </div>
    </form>
  );
}

interface LogTimeModalProps {
  onSubmit: (hours: number, type: string, description: string, logDate: string, billable: boolean) => Promise<void>;
  onClose: () => void;
  task?: { title?: string; estimatedHours?: number; loggedHours?: number };
}

function LogTimeModal({ onSubmit, onClose, task }: LogTimeModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const [hours, setHours] = useState("");
  const [type, setType] = useState(TIME_LOG_TYPES[0]);
  const [description, setDescription] = useState("");
  const [logDate, setLogDate] = useState(today);
  const [billable, setBillable] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const logged = task?.loggedHours ?? 0;
  const estimated = task?.estimatedHours ?? 0;
  const remaining = Math.max(0, estimated - logged);
  const pct = estimated > 0 ? Math.min(100, Math.round((logged / estimated) * 100)) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const h = parseFloat(hours);
    const errs: Record<string, string> = {};
    if (!h || h <= 0) errs.hours = "Hours must be greater than 0";
    else if (h > 8) errs.hours = "Cannot log more than 8 hours per entry";
    if (!logDate) errs.logDate = "Log date is required";
    if (!description.trim()) errs.description = "Description is required";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await onSubmit(h, type, description, logDate, billable);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">{t("projects.logTime")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Record time spent on this task</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Existing hours summary */}
          {(estimated > 0 || logged > 0) && (
            <div className="bg-muted/50 rounded-lg px-3 py-2.5 space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Logged so far</span>
                <span className="font-medium text-foreground">{logged}h{estimated > 0 ? ` / ${estimated}h estimated` : ''}</span>
              </div>
              {estimated > 0 && (
                <>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pct >= 100
                      ? `${logged - estimated}h over estimate`
                      : `${remaining}h remaining`}
                  </p>
                </>
              )}
            </div>
          )}
          {/* Hours + Log Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("project.hours")} * <span className="text-muted-foreground font-normal">(max 8h)</span></label>
              <input
                type="number"
                min="0.5"
                max="8"
                step="0.5"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.hours ? "border-red-400" : "border-border"}`}
                value={hours}
                placeholder="0.5 – 8"
                onChange={(e) => { setHours(e.target.value); setErrors(p => ({ ...p, hours: "" })); }}
              />
              {errors.hours && <p className="text-red-500 text-xs mt-1">{errors.hours}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Log Date *</label>
              <input
                type="date"
                max={today}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.logDate ? "border-red-400" : "border-border"}`}
                value={logDate}
                onChange={(e) => { setLogDate(e.target.value); setErrors(p => ({ ...p, logDate: "" })); }}
              />
              {errors.logDate && <p className="text-red-500 text-xs mt-1">{errors.logDate}</p>}
            </div>
          </div>

          {/* Type + Billable */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("project.logType")}</label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {TIME_LOG_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex flex-col justify-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setBillable(b => !b)}
                  className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${billable ? "bg-blue-600" : "bg-muted-foreground/40"}`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${billable ? "translate-x-5" : "translate-x-0"}`} />
                </div>
                <span className="text-sm font-medium text-foreground">Billable</span>
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">What did you work on? *</label>
            <textarea
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.description ? "border-red-400" : "border-border"}`}
              rows={3}
              placeholder="Brief description of work done..."
              value={description}
              onChange={(e) => { setDescription(e.target.value); setErrors(p => ({ ...p, description: "" })); }}
            />
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-foreground border border-border rounded-lg hover:bg-muted">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? t("project.logging") : t("projects.logTime")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Task Detail Modal ────────────────────────────────────────────────────────

interface TaskDetailProps {
  task: ProjectTask;
  projectId: string;
  canEdit: boolean;
  onUpdate: (updates: Partial<ProjectTask>) => Promise<void>;
  onLogTime: (hours: number, type: string, desc: string, logDate: string, billable: boolean) => Promise<void>;
  onClose: () => void;
  sprintOptions?: { id: string; name: string }[];
}

function TaskDetailModal({
  task,
  canEdit,
  onUpdate,
  onLogTime,
  onClose,
  sprintOptions = [],
}: TaskDetailProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [assigneeName, setAssigneeName] = useState(task.assigneeName ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [status, setStatus] = useState(task.status);
  const [sprintId, setSprintId] = useState(task.sprintId ?? "");
  const [originalSprintId] = useState(task.sprintId ?? "");
  const [sprintChangeReason, setSprintChangeReason] = useState("");
  const [showLogTime, setShowLogTime] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (sprintId !== originalSprintId && !sprintChangeReason.trim()) {
      toast.error("Sprint change reason is required");
      return;
    }
    setSaving(true);
    try {
      await onUpdate({
        title,
        assigneeName,
        dueDate,
        status,
        sprintId: sprintId || undefined,
        sprintChangeReason: sprintId !== originalSprintId ? sprintChangeReason : undefined,
      });
      toast.success(t("project.taskUpdated"));
      setEditing(false);
    } catch {
      toast.error(t("project.taskUpdateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal title={task.title} onClose={onClose}>
        <div className="space-y-4">
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("project.taskTitle")}</label>
                <input
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{t("projects.assignee")}</label>
                  <input
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={assigneeName}
                    onChange={(e) => setAssigneeName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{t("projects.dueDate")}</label>
                  <input
                    type="date"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("common.status")}</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              {sprintOptions.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Sprint</label>
                  <select
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={sprintId}
                    onChange={(e) => setSprintId(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {sprintOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {sprintId !== originalSprintId && (
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-foreground mb-1">Reason for sprint change *</label>
                      <textarea
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        value={sprintChangeReason}
                        onChange={(e) => setSprintChangeReason(e.target.value)}
                        placeholder="Explain why this task is being moved to a different sprint…"
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 text-sm text-foreground border border-border rounded-lg hover:bg-muted"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                <Badge className={STATUS_COLORS[task.status] ?? "bg-gray-100 text-gray-700"}>
                  {task.status}
                </Badge>
              </div>
              {task.description && <p>{task.description}</p>}
              {task.assigneeName && (
                <div className="flex items-center gap-2">
                  <Avatar name={task.assigneeName} />
                  <span>{task.assigneeName}</span>
                </div>
              )}
              {task.dueDate && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>{t("project.dueOn").replace("{date}", task.dueDate)}</span>
                </div>
              )}
              {(task.estimatedHours !== undefined || task.loggedHours !== undefined) && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>
                    {t("project.hoursLogged")
                      .replace("{logged}", String(task.loggedHours ?? 0))
                      .replace("{estimated}", String(task.estimatedHours ?? 0))}
                  </span>
                </div>
              )}
              {task.sprintId && sprintOptions.length > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="font-medium text-foreground">Sprint:</span>
                  <span>{sprintOptions.find(s => s.id === task.sprintId)?.name ?? task.sprintId}</span>
                </div>
              )}
              {task.sprintChangeReason && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                  <span className="font-medium">Last sprint change note:</span> {task.sprintChangeReason}
                </div>
              )}
              {Array.isArray(task.sprintChangeHistory) && task.sprintChangeHistory.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Sprint Change History ({task.sprintChangeHistory.length})
                  </div>
                  <div className="divide-y divide-border">
                    {[...task.sprintChangeHistory].reverse().map((h: any, i: number) => {
                      const fromName = sprintOptions.find(s => s.id === h.from)?.name ?? h.from ?? 'Unassigned';
                      const toName = sprintOptions.find(s => s.id === h.to)?.name ?? h.to ?? 'Unassigned';
                      return (
                        <div key={i} className="px-3 py-2 text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                            <span className="font-medium text-foreground">{fromName}</span>
                            <span>→</span>
                            <span className="font-medium text-foreground">{toName}</span>
                            <span className="ml-auto text-muted-foreground">{h.changedAt ? new Date(h.changedAt).toLocaleDateString() : ''}</span>
                          </div>
                          <p className="text-muted-foreground">{h.reason}</p>
                          {h.changedBy && <p className="text-muted-foreground/60 mt-0.5">by {h.changedBy}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 pt-2 border-t">
            {canEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-foreground border border-border rounded-lg hover:bg-muted"
              >
                <Edit className="w-3.5 h-3.5" /> {t("common.edit")}
              </button>
            )}
            <button
              onClick={() => setShowLogTime(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-foreground border border-border rounded-lg hover:bg-muted"
            >
              <Clock className="w-3.5 h-3.5" /> {t("projects.logTime")}
            </button>
          </div>
        </div>
      </Modal>
      {showLogTime && (
        <LogTimeModal
          task={{ title: task.title, estimatedHours: task.estimatedHours, loggedHours: task.loggedHours }}
          onSubmit={async (h, type, desc, logDate, billable) => {
            await onLogTime(h, type, desc, logDate, billable);
            toast.success(t("project.timeLogged"));
          }}
          onClose={() => setShowLogTime(false)}
        />
      )}
    </>
  );
}

// ─── Kanban board ─────────────────────────────────────────────────────────────

const KANBAN_COLUMNS = ["Todo", "In Progress", "In Review", "Done"];
const KANBAN_COLUMN_LABELS: Record<string, string> = { "Todo": "To Do" };
const KANBAN_COLUMN_COLORS: Record<string, string> = {
  "Todo": "bg-slate-100 text-slate-600",
  "In Progress": "bg-blue-100 text-blue-700",
  "In Review": "bg-amber-100 text-amber-700",
  "Done": "bg-green-100 text-green-700",
};

interface KanbanBoardProps {
  tasks: ProjectTask[];
  projectId: string;
  canManage: boolean;
  currentUserId: string;
  onCreateTask: (data: Partial<ProjectTask>) => Promise<void>;
  onUpdateTask: (taskId: string, updates: Partial<ProjectTask>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onLogTime: (taskId: string, hours: number, type: string, desc: string, logDate: string, billable: boolean) => Promise<void>;
  sprintOptions?: { id: string; name: string }[];
}

// ─── Shared task card ─────────────────────────────────────────────────────────
interface TaskCardProps {
  task: ProjectTask;
  canDrag: boolean;
  isDragging: boolean;
  showAssignee?: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onClick: () => void;
  onStatusChange: (newStatus: string) => void;
  currentCol: string;
}

function TaskCard({ task, canDrag, isDragging, showAssignee = true, onDragStart, onDragEnd, onClick, onStatusChange, currentCol }: TaskCardProps) {
  return (
    <div
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`bg-card rounded-lg p-3 shadow-sm border border-border hover:shadow-md transition-shadow ${canDrag ? (isDragging ? "cursor-grabbing opacity-50" : "cursor-grab") : "cursor-pointer"}`}
    >
      <p className="text-sm font-medium text-foreground mb-2 line-clamp-2">{task.title}</p>
      <div className="flex items-center justify-between">
        <Badge className={`${PRIORITY_COLORS[task.priority]} text-xs`}>{task.priority}</Badge>
        {showAssignee && task.assigneeName && <Avatar name={task.assigneeName} />}
      </div>
      {task.dueDate && (
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <Calendar className="w-3 h-3" />{task.dueDate}
        </p>
      )}
      {task.estimatedHours != null && (
        <div className="mt-2 flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full ${(task.loggedHours ?? 0) >= task.estimatedHours ? "bg-red-500" : "bg-blue-500"}`}
              style={{ width: `${Math.min(100, Math.round(((task.loggedHours ?? 0) / task.estimatedHours) * 100))}%` }}
            />
          </div>
          <span className={`text-xs font-medium ${(task.loggedHours ?? 0) >= task.estimatedHours ? "text-red-500" : "text-muted-foreground"}`}>
            {Math.max(0, task.estimatedHours - (task.loggedHours ?? 0)).toFixed(1)}h left
          </span>
        </div>
      )}
      {canDrag && currentCol !== "Done" && (
        <div className="mt-2 pt-2 border-t border-border flex gap-1 flex-wrap">
          {KANBAN_COLUMNS.filter((c) => c !== currentCol).map((c) => (
            <button
              key={c}
              onClick={(e) => { e.stopPropagation(); onStatusChange(c); }}
              className="text-xs text-blue-600 hover:underline"
            >
              → {KANBAN_COLUMN_LABELS[c] ?? c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Kanban lane (4 columns for a set of tasks) ───────────────────────────────
interface KanbanLaneProps {
  tasks: ProjectTask[];
  canManage: boolean;
  currentUserId: string;
  draggingTaskId: string | null;
  dragOverKey: string | null;
  groupKey: string;
  showAssignee?: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, key: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, newStatus: string) => void;
  onSelectTask: (task: ProjectTask) => void;
  onStatusChange: (task: ProjectTask, newStatus: string) => void;
}

function KanbanLane({
  tasks, canManage, currentUserId, draggingTaskId, dragOverKey, groupKey,
  showAssignee = true, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, onSelectTask, onStatusChange,
}: KanbanLaneProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {KANBAN_COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col);
        const dropKey = `${groupKey}::${col}`;
        const isOver = dragOverKey === dropKey;
        return (
          <div
            key={col}
            className={`rounded-xl p-3 min-h-[120px] transition-all border ${isOver ? "ring-2 ring-indigo-400 bg-indigo-50 border-indigo-200" : "bg-muted border-transparent"}`}
            onDragOver={(e) => onDragOver(e, dropKey)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, col)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${KANBAN_COLUMN_COLORS[col]}`}>
                {KANBAN_COLUMN_LABELS[col] ?? col}
              </span>
              <span className="text-xs text-muted-foreground bg-background rounded-full px-1.5 py-0.5 border border-border">
                {colTasks.length}
              </span>
            </div>
            {isOver && (
              <div className="mb-2 border-2 border-dashed border-indigo-300 rounded-lg p-2 text-center text-xs text-indigo-500">
                {t("pm.drag.dropHere")}
              </div>
            )}
            <div className="space-y-2">
              {colTasks.map((task) => {
                const isOwn = task.assigneeId === currentUserId;
                const canDrag = canManage || isOwn;
                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canDrag={canDrag}
                    isDragging={draggingTaskId === task.id}
                    showAssignee={showAssignee}
                    currentCol={col}
                    onDragStart={(e) => onDragStart(e, task.id)}
                    onDragEnd={onDragEnd}
                    onClick={() => onSelectTask(task)}
                    onStatusChange={(s) => onStatusChange(task, s)}
                  />
                );
              })}
              {colTasks.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4 opacity-60">No tasks</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Assignee group panel ──────────────────────────────────────────────────────
interface AssigneeGroupProps {
  assigneeName: string;
  tasks: ProjectTask[];
  totalCount: number;
  open: boolean;
  onToggle: () => void;
  canManage: boolean;
  currentUserId: string;
  draggingTaskId: string | null;
  dragOverKey: string | null;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, key: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, newStatus: string) => void;
  onSelectTask: (task: ProjectTask) => void;
  onStatusChange: (task: ProjectTask, newStatus: string) => void;
}

function AssigneeGroup({
  assigneeName, tasks, totalCount, open, onToggle,
  canManage, currentUserId, draggingTaskId, dragOverKey,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, onSelectTask, onStatusChange,
}: AssigneeGroupProps) {
  const doneCount = tasks.filter((t) => t.status === "Done").length;
  const inProgressCount = tasks.filter((t) => t.status === "In Progress").length;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted transition-colors text-left"
      >
        <span className={`transition-transform duration-200 text-muted-foreground ${open ? "rotate-90" : ""}`}>
          <ChevronRight className="w-4 h-4" />
        </span>
        <Avatar name={assigneeName} />
        <span className="font-medium text-sm text-foreground flex-1">{assigneeName}</span>
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 border border-border">
            {totalCount} task{totalCount !== 1 ? "s" : ""}
          </span>
          {inProgressCount > 0 && (
            <span className="bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
              {inProgressCount} active
            </span>
          )}
          {doneCount > 0 && (
            <span className="bg-green-100 text-green-700 rounded-full px-2 py-0.5">
              {doneCount} done
            </span>
          )}
        </div>
      </button>
      {/* Lane */}
      {open && (
        <div className="p-3 bg-background border-t border-border">
          <KanbanLane
            tasks={tasks}
            canManage={canManage}
            currentUserId={currentUserId}
            draggingTaskId={draggingTaskId}
            dragOverKey={dragOverKey}
            groupKey={assigneeName}
            showAssignee={false}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onSelectTask={onSelectTask}
            onStatusChange={onStatusChange}
          />
        </div>
      )}
    </div>
  );
}

function KanbanBoard({
  tasks,
  projectId,
  canManage,
  currentUserId,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onLogTime,
  sprintOptions = [],
}: KanbanBoardProps) {
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [groupByAssignee, setGroupByAssignee] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  function isGroupOpen(key: string, idx: number) {
    // Default first 5 groups open unless explicitly set
    return key in openGroups ? openGroups[key] : idx < 5;
  }
  function toggleGroup(key: string, idx: number) {
    setOpenGroups((prev) => ({ ...prev, [key]: !isGroupOpen(key, idx) }));
  }
  function collapseAll(keys: string[]) {
    const next: Record<string, boolean> = {};
    keys.forEach((k) => { next[k] = false; });
    setOpenGroups(next);
  }
  function expandAll(keys: string[]) {
    const next: Record<string, boolean> = {};
    keys.forEach((k) => { next[k] = true; });
    setOpenGroups(next);
  }
  const allCollapsed = (keys: string[]) => keys.every((k, i) => !isGroupOpen(k, i));

  async function handleStatusChange(task: ProjectTask, newStatus: string) {
    try {
      await onUpdateTask(task.id, { status: newStatus });
    } catch {
      toast.error(t("project.taskStatusUpdateFailed"));
    }
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, taskId: string) {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingTaskId(taskId);
  }

  function handleDragEnd() {
    setDraggingTaskId(null);
    setDragOverKey(null);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, key: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverKey(key);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, newStatus: string) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    setDragOverKey(null);
    setDraggingTaskId(null);
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    void onUpdateTask(taskId, { status: newStatus });
  }

  // Build assignee groups: assigned tasks grouped by name, unassigned last
  const assigneeGroups: { key: string; label: string; tasks: ProjectTask[] }[] = [];
  const seen = new Map<string, ProjectTask[]>();
  for (const task of tasks) {
    const key = task.assigneeName?.trim() || "__unassigned__";
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(task);
  }
  for (const [key, grpTasks] of seen) {
    if (key !== "__unassigned__") {
      assigneeGroups.push({ key, label: key, tasks: grpTasks });
    }
  }
  assigneeGroups.sort((a, b) => a.label.localeCompare(b.label));
  if (seen.has("__unassigned__")) {
    assigneeGroups.push({ key: "__unassigned__", label: "Unassigned", tasks: seen.get("__unassigned__")! });
  }

  // Shared drag handlers object to avoid repeating
  const dragHandlers = {
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDragOver: handleDragOver,
    onDragLeave: () => setDragOverKey(null),
    onDrop: handleDrop,
    onSelectTask: setSelectedTask,
    onStatusChange: handleStatusChange,
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</span>
          {groupByAssignee && assigneeGroups.length > 0 && (
            <button
              onClick={() => {
                const keys = assigneeGroups.map((g) => g.key);
                if (allCollapsed(keys)) expandAll(keys); else collapseAll(keys);
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              {allCollapsed(assigneeGroups.map((g) => g.key)) ? "Expand all" : "Collapse all"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            <button
              onClick={() => setGroupByAssignee(false)}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${!groupByAssignee ? "bg-blue-600 text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Board
            </button>
            <button
              onClick={() => setGroupByAssignee(true)}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${groupByAssignee ? "bg-blue-600 text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}
            >
              <Users className="w-3.5 h-3.5" /> By Assignee
            </button>
          </div>
          {canManage && (
            <button
              onClick={() => setShowTaskForm(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> {t("projects.addTask")}
            </button>
          )}
        </div>
      </div>

      {/* Flat board view */}
      {!groupByAssignee && (
        <KanbanLane
          tasks={tasks}
          canManage={canManage}
          currentUserId={currentUserId}
          draggingTaskId={draggingTaskId}
          dragOverKey={dragOverKey}
          groupKey="flat"
          showAssignee={true}
          {...dragHandlers}
        />
      )}

      {/* Grouped by assignee view */}
      {groupByAssignee && (
        <div className="space-y-3">
          {assigneeGroups.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No tasks yet</div>
          )}
          {assigneeGroups.map((group, idx) => (
            <AssigneeGroup
              key={group.key}
              assigneeName={group.label}
              tasks={group.tasks}
              totalCount={group.tasks.length}
              open={isGroupOpen(group.key, idx)}
              onToggle={() => toggleGroup(group.key, idx)}
              canManage={canManage}
              currentUserId={currentUserId}
              draggingTaskId={draggingTaskId}
              dragOverKey={dragOverKey}
              {...dragHandlers}
            />
          ))}
        </div>
      )}

      {showTaskForm && (
        <Modal title={t("project.createTask")} onClose={() => setShowTaskForm(false)}>
          <TaskForm
            onSubmit={async (data) => {
              await onCreateTask(data);
              toast.success(t("project.taskCreated"));
              setShowTaskForm(false);
            }}
            onCancel={() => setShowTaskForm(false)}
            sprintOptions={sprintOptions}
          />
        </Modal>
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          projectId={projectId}
          canEdit={canManage || selectedTask.assigneeId === currentUserId}
          onUpdate={async (updates) => {
            await onUpdateTask(selectedTask.id, updates);
            setSelectedTask((prev) => (prev ? { ...prev, ...updates } : prev));
          }}
          onLogTime={(h, type, desc, logDate, billable) => onLogTime(selectedTask.id, h, type, desc, logDate, billable)}
          onClose={() => setSelectedTask(null)}
          sprintOptions={sprintOptions}
        />
      )}
    </div>
  );
}

// ─── Team tab ────────────────────────────────────────────────────────────────

interface TeamTabProps {
  members: ProjectMember[];
  projectId: string;
  canManage: boolean;
  onAddMember: (data: Partial<ProjectMember>) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
}

function TeamTab({
  members,
  projectId,
  canManage,
  onAddMember,
  onRemoveMember,
}: TeamTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [empName, setEmpName] = useState("");
  const [empId, setEmpId] = useState("");
  const [role, setRole] = useState(MEMBER_ROLES[0]);
  const [saving, setSaving] = useState(false);

  const existingNames = new Set(members.map(m => m.employeeName?.toLowerCase()));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!empName.trim()) { toast.error("Please select an employee"); return; }
    setSaving(true);
    try {
      await onAddMember({ employeeName: empName, employeeId: empId || undefined, role });
      toast.success(t("project.memberAdded"));
      setEmpName("");
      setEmpId("");
      setRole(MEMBER_ROLES[0]);
      setShowForm(false);
    } catch {
      toast.error(t("project.memberAddFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> {t("projects.addMember")}
          </button>
        </div>
      )}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="p-4 bg-muted rounded-xl border space-y-3"
        >
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("project.employeeName")}
              </label>
              <EmployeeSearchDropdown
                value={empName}
                onChange={(name, id) => { setEmpName(name); setEmpId(id ?? ""); }}
                placeholder="Search employee…"
                filter={(e) => !existingNames.has(e.label?.toLowerCase())}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("common.role")}
              </label>
              <select
                className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {MEMBER_ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={saving || !empName}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? t("project.adding") : t("common.add")}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEmpName(""); }}
              className="px-4 py-2 text-sm text-foreground border border-border rounded-lg hover:bg-muted"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}
      <div className="divide-y divide-border">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 py-3">
            <Avatar name={m.employeeName} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{m.employeeName}</p>
              <p className="text-xs text-muted-foreground">{t("project.joined").replace("{date}", m.joinedDate)}</p>
            </div>
            <Badge className="bg-purple-100 text-purple-700">{m.role}</Badge>
            {canManage && (
              <button
                onClick={async () => {
                  if (!confirm(t("project.removeMemberConfirm").replace("{name}", m.employeeName))) return;
                  try {
                    await onRemoveMember(m.id);
                    toast.success(t("project.memberRemoved"));
                  } catch {
                    toast.error(t("project.memberRemoveFailed"));
                  }
                }}
                className="text-red-400 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {members.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">{t("project.noTeamMembers")}</p>
        )}
      </div>
    </div>
  );
}

// ─── Milestone & Sprint Types ─────────────────────────────────────────────────

interface Milestone {
  id: string;
  project_id: string;
  title: string;
  due_date: string;
  status: "Pending" | "Achieved" | "Missed" | "At Risk";
  milestone_type?: "Phase" | "Release" | "Review" | "Contract" | "Internal";
  owner_name?: string;
  linked_backlog_items?: unknown[];
  completion_date?: string;
  notes?: string;
  description?: string;
}

interface ProjectRisk {
  id: string;
  project_id: string;
  title: string;
  category?: string;
  description?: string;
  likelihood: "High" | "Medium" | "Low";
  likelihood_value: number;
  impact: "Critical" | "High" | "Medium" | "Low";
  impact_value: number;
  risk_score: number;
  status: "Identified" | "Assessed" | "Mitigated" | "Accepted" | "Closed" | "Triggered";
  owner_name?: string;
  mitigation_plan?: string;
  contingency_plan?: string;
  due_date?: string;
  resolution_notes?: string;
}

interface Sprint {
  id: string;
  project_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "Planning" | "Active" | "Completed" | "Cancelled";
  goal?: string;
  sprint_number?: number;
  capacity_points?: number;
  committed_points?: number;
  completed_points?: number;
  velocity?: number;
  created_at?: string;
}

interface SprintBacklogItem {
  id: string;
  sprint_id: string;
  backlog_item_id: string;
  order_index?: number;
  mid_sprint_added?: boolean;
  item?: DbBacklogItem;
}

interface DbBacklogItem {
  id: string;
  project_id: string;
  title: string;
  type?: string;
  priority?: string;
  status?: string;
  story_points?: number;
  sprint_id?: string | null;
  assignee_name?: string;
  description?: string;
}

// ─── Backlog & Defect Types ───────────────────────────────────────────────────

interface BacklogItem {
  id: string;
  itemId?: string; // BLI-XXXX human-readable ID
  projectId: string;
  type: "story" | "task" | "epic" | "spike" | "bug";
  title: string;
  description?: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Open" | "In Progress" | "In Review" | "Testing" | "Done" | "Cancelled" | "Blocked";
  points?: number;
  sprint?: string;
  assigneeId?: string;
  assigneeName?: string;
  linkedTicketIds?: string[];
  acceptanceCriteria?: string[];
  epic_id?: string;
  dependencies?: { targetId: string; type: string }[];
  createdAt: string;
}

interface ProjectEpic {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  color: string;
  status: 'Not Started' | 'In Progress' | 'Done' | 'On Hold';
  start_date?: string;
  end_date?: string;
  owner_name?: string;
  created_at?: string;
}

interface Defect {
  id: string;
  _dbId?: string;
  projectId: string;
  severity: "Very High" | "High" | "Medium" | "Low";
  title: string;
  description?: string;
  status: "Open" | "In Progress" | "Fixed" | "Verified" | "Closed" | "Deferred" | "Won't Fix" | "Blocked";
  priority: "P1" | "P2" | "P3" | "P4";
  assigneeId?: string;
  assigneeName?: string;
  foundInVersion?: string;
  sprint?: string;
  environment?: string;
  linkedTicketIds?: string[];
  stepsToReproduce?: string[];
  expectedBehavior?: string;
  actualBehavior?: string;
  regressionFlag?: boolean;
  createdAt: string;
  age?: number;
}

const PM_API = `${API_BASE}/projects`;

function milestoneStatus(m: Milestone): "Pending" | "Achieved" | "Missed" | "At Risk" {
  if (m.status === "Achieved") return "Achieved";
  if (m.status === "Missed") return "Missed";
  if (m.status === "At Risk") return "At Risk";
  if (new Date(m.due_date) < new Date()) return "Missed";
  return "Pending";
}

const MILESTONE_CIRCLE: Record<string, string> = {
  Achieved: "bg-green-500 border-green-500",
  Pending: "bg-gray-400 border-gray-400",
  "At Risk": "bg-amber-400 border-amber-400",
  Missed: "bg-red-500 border-red-500",
};

const MILESTONE_BADGE: Record<string, string> = {
  Achieved: "bg-green-100 text-green-700",
  Pending: "bg-gray-100 text-gray-600",
  "At Risk": "bg-amber-100 text-amber-700",
  Missed: "bg-red-100 text-red-700",
};

// ─── Milestones Tab ───────────────────────────────────────────────────────────

const MILESTONE_TYPES = ["Phase", "Release", "Review", "Contract", "Internal"] as const;
const MILESTONE_STATUSES = ["Pending", "Achieved", "Missed", "At Risk"] as const;

type MilestoneFormState = {
  title: string;
  milestone_type: string;
  due_date: string;
  owner_name: string;
  description: string;
  notes: string;
  status: string;
};

const DEFAULT_MILESTONE_FORM: MilestoneFormState = {
  title: "",
  milestone_type: "Phase",
  due_date: "",
  owner_name: "",
  description: "",
  notes: "",
  status: "Pending",
};

function MilestonesTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"timeline" | "table">("timeline");
  const [showSlideOver, setShowSlideOver] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [form, setForm] = useState<MilestoneFormState>(DEFAULT_MILESTONE_FORM);
  const [saving, setSaving] = useState(false);

  const pmH = { "Content-Type": "application/json", apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` };
  const pmUrl = (path: string) => `${API_BASE}/projects${path}`;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(pmUrl(`/milestones?projectId=${projectId}`), { headers: pmH });
      const json = await res.json();
      const loaded: Milestone[] = json.data ?? [];
      const todayStr = new Date().toISOString().split("T")[0];
      const overdueMilestones = loaded.filter(
        (m) => m.due_date && m.due_date < todayStr && (m.status === "Pending" || m.status === "At Risk")
      );
      if (overdueMilestones.length > 0) {
        for (const m of overdueMilestones) {
          void fetch(pmUrl(`/milestones/${m.id}`), { method: "PUT", headers: pmH, body: JSON.stringify({ status: "Missed" }) });
        }
        const overdueIds = new Set(overdueMilestones.map((m) => m.id));
        setMilestones(loaded.map((m) => overdueIds.has(m.id) ? { ...m, status: "Missed" } : m));
      } else {
        setMilestones(loaded);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [projectId]);

  function openAdd() {
    setEditingMilestone(null);
    setForm(DEFAULT_MILESTONE_FORM);
    setShowSlideOver(true);
  }

  function openEdit(m: Milestone) {
    setEditingMilestone(m);
    setForm({
      title: m.title,
      milestone_type: m.milestone_type ?? "Phase",
      due_date: m.due_date,
      owner_name: m.owner_name ?? "",
      description: m.description ?? "",
      notes: m.notes ?? "",
      status: m.status,
    });
    setShowSlideOver(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.due_date) {
      toast.error(t("project.milestoneTitleDateRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        projectId: projectId,
        title: form.title.trim(),
        milestone_type: form.milestone_type,
        due_date: form.due_date,
        owner_name: form.owner_name,
        description: form.description,
        notes: form.notes,
        status: form.status,
      };
      if (editingMilestone) {
        const res = await fetch(pmUrl(`/milestones/${editingMilestone.id}`), { method: "PUT", headers: pmH, body: JSON.stringify(payload) });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        toast.success(t("project.milestoneUpdated") || "Milestone updated");
      } else {
        const res = await fetch(pmUrl("/milestones"), { method: "POST", headers: pmH, body: JSON.stringify(payload) });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        toast.success(t("project.milestoneAdded"));
      }
      setShowSlideOver(false);
      load();
    } catch {
      toast.error(t("project.milestoneAddFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("project.deleteMilestoneConfirm"))) return;
    try {
      const res = await fetch(pmUrl(`/milestones/${id}`), { method: "DELETE", headers: pmH });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setMilestones((prev) => prev.filter((m) => m.id !== id));
      if (selectedMilestone?.id === id) setSelectedMilestone(null);
      toast.success(t("project.milestoneDeleted"));
    } catch {
      toast.error(t("project.milestoneDeleteFailed"));
    }
  }

  if (loading) return <InlineLoader />;

  // Timeline calculations
  const today = new Date();
  const dates = milestones.map((m) => new Date(m.due_date).getTime()).filter(Boolean);
  const minDate = dates.length ? new Date(Math.min(...dates, today.getTime() - 7 * 86400000)) : new Date(today.getTime() - 30 * 86400000);
  const maxDate = dates.length ? new Date(Math.max(...dates, today.getTime() + 7 * 86400000)) : new Date(today.getTime() + 30 * 86400000);
  const span = maxDate.getTime() - minDate.getTime() || 1;

  function pct(date: Date) {
    return Math.max(0, Math.min(100, ((date.getTime() - minDate.getTime()) / span) * 100));
  }

  const todayPct = pct(today);

  function daysLabel(due_date: string) {
    const diff = Math.round((new Date(due_date).getTime() - today.getTime()) / 86400000);
    if (diff < 0) return { label: `${Math.abs(diff)} days overdue`, cls: "text-red-600 font-medium" };
    if (diff === 0) return { label: "Due today", cls: "text-amber-600 font-medium" };
    return { label: `${diff} days left`, cls: "text-muted-foreground" };
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setView("timeline")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${view === "timeline" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Timeline
          </button>
          <button
            onClick={() => setView("table")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${view === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Table
          </button>
        </div>
        {canManage && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> {t("project.addMilestone")}
          </button>
        )}
      </div>

      {milestones.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Flag className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{t("project.noMilestones")}</p>
        </div>
      ) : view === "timeline" ? (
        <div className="flex gap-4">
          <div className="flex-1 bg-card rounded-xl border p-4 overflow-x-auto">
            <div className="relative h-16 min-w-[600px]">
              {/* Track */}
              <div className="absolute top-7 left-0 right-0 h-0.5 bg-gray-200" />
              {/* Today line */}
              <div
                className="absolute top-0 bottom-0 w-px bg-red-500 z-10"
                style={{ left: `${todayPct}%` }}
              >
                <span className="absolute -top-5 left-1 text-xs text-red-500 whitespace-nowrap">Today</span>
              </div>
              {/* Diamond markers */}
              {milestones.map((m) => {
                const status = milestoneStatus(m);
                const p = pct(new Date(m.due_date));
                const colors: Record<string, string> = {
                  Achieved: "text-green-500",
                  "At Risk": "text-amber-500",
                  Missed: "text-red-500",
                  Pending: "text-gray-400",
                };
                return (
                  <button
                    key={m.id}
                    className={`absolute top-4 -translate-x-1/2 -translate-y-1/2 text-lg ${colors[status]} hover:scale-125 transition-transform z-20`}
                    style={{ left: `${p}%` }}
                    onClick={() => setSelectedMilestone(selectedMilestone?.id === m.id ? null : m)}
                    title={m.title}
                  >
                    ◆
                  </button>
                );
              })}
            </div>
            {/* Labels */}
            <div className="relative min-w-[600px] mt-2">
              {milestones.map((m) => {
                const p = pct(new Date(m.due_date));
                return (
                  <div
                    key={m.id}
                    className="absolute -translate-x-1/2 text-xs text-muted-foreground whitespace-nowrap"
                    style={{ left: `${p}%` }}
                  >
                    {m.due_date}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Side panel */}
          {selectedMilestone && (
            <div className="w-72 bg-card rounded-xl border p-4 space-y-3 flex-shrink-0">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-foreground text-sm">{selectedMilestone.title}</h3>
                <button onClick={() => setSelectedMilestone(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {selectedMilestone.milestone_type && (
                  <div><span className="font-medium text-foreground">Type:</span> {selectedMilestone.milestone_type}</div>
                )}
                <div><span className="font-medium text-foreground">Due:</span> {selectedMilestone.due_date}</div>
                {selectedMilestone.owner_name && (
                  <div><span className="font-medium text-foreground">Owner:</span> {selectedMilestone.owner_name}</div>
                )}
                <div>
                  <Badge className={MILESTONE_BADGE[milestoneStatus(selectedMilestone)]}>{milestoneStatus(selectedMilestone)}</Badge>
                </div>
                {selectedMilestone.description && <p className="mt-2">{selectedMilestone.description}</p>}
                {selectedMilestone.notes && <p className="mt-1 italic">{selectedMilestone.notes}</p>}
              </div>
              {canManage && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => { openEdit(selectedMilestone); setSelectedMilestone(null); }}
                    className="flex-1 text-xs px-2 py-1.5 border border-border rounded-lg hover:bg-muted"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(selectedMilestone.id)}
                    className="text-xs px-2 py-1.5 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted text-xs text-muted-foreground">
                <th className="text-left px-4 py-2 font-medium">Milestone</th>
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-left px-4 py-2 font-medium">Due Date</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Owner</th>
                <th className="text-left px-4 py-2 font-medium">Notes</th>
                <th className="text-left px-4 py-2 font-medium">Days</th>
                {canManage && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => {
                const status = milestoneStatus(m);
                const dl = daysLabel(m.due_date);
                return (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium text-foreground">{m.title}</td>
                    <td className="px-4 py-2">
                      {m.milestone_type && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">{m.milestone_type}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{m.due_date}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MILESTONE_BADGE[status]} ${status === "At Risk" ? "animate-pulse" : ""}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{m.owner_name ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground max-w-[160px] truncate">{m.notes ?? "—"}</td>
                    <td className={`px-4 py-2 text-xs ${dl.cls}`}>{dl.label}</td>
                    {canManage && (
                      <td className="px-4 py-2">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openEdit(m)} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(m.id)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Slide-Over */}
      {showSlideOver && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowSlideOver(false)} />
          <div className="w-[360px] bg-card border-l shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-foreground">{editingMilestone ? "Edit Milestone" : t("project.addMilestone")}</h3>
              <button onClick={() => setShowSlideOver(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("project.milestoneTitle")} *</label>
                <input
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Milestone name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Type</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
                  value={form.milestone_type}
                  onChange={(e) => setForm((f) => ({ ...f, milestone_type: e.target.value }))}
                >
                  {MILESTONE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("projects.dueDate")} *</label>
                <input
                  type="date"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Owner</label>
                <EmployeeSearchDropdown
                  value={form.owner_name}
                  onChange={(name) => setForm(f => ({ ...f, owner_name: name }))}
                  placeholder="Search employee…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t("project.description")}</label>
                <textarea
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <textarea
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {MILESTONE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowSlideOver(false)} className="px-4 py-2 text-sm text-foreground border border-border rounded-lg hover:bg-muted">{t("common.cancel")}</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? t("common.saving") : (editingMilestone ? "Update" : t("common.add"))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Risks Tab ────────────────────────────────────────────────────────────────

const RISK_CATEGORIES = ["Technical", "Resource", "Schedule", "Scope", "Budget", "External", "Compliance"] as const;
const RISK_STATUSES = ["Identified", "Assessed", "Mitigated", "Accepted", "Closed", "Triggered"] as const;
const RISK_LIKELIHOOD_VALUES: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
const RISK_IMPACT_VALUES: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

const RISK_STATUS_BADGE: Record<string, string> = {
  Identified: "bg-gray-100 text-gray-600",
  Assessed: "bg-blue-100 text-blue-700",
  Mitigated: "bg-green-100 text-green-700",
  Accepted: "bg-orange-100 text-orange-700",
  Closed: "bg-gray-100 text-gray-400",
  Triggered: "bg-red-100 text-red-700",
};

function riskScoreBadge(score: number) {
  if (score >= 6) return "bg-red-100 text-red-700 font-bold";
  if (score >= 3) return "bg-amber-100 text-amber-700 font-semibold";
  return "bg-green-100 text-green-700";
}

function riskScoreCell(score: number) {
  if (score >= 6) return "bg-red-50";
  if (score >= 3) return "bg-amber-50";
  return "bg-green-50";
}

type RiskFormState = {
  title: string;
  category: string;
  description: string;
  likelihood: string;
  impact: string;
  status: string;
  owner_name: string;
  mitigation_plan: string;
  contingency_plan: string;
  due_date: string;
};

const DEFAULT_RISK_FORM: RiskFormState = {
  title: "",
  category: "Technical",
  description: "",
  likelihood: "Medium",
  impact: "Medium",
  status: "Identified",
  owner_name: "",
  mitigation_plan: "",
  contingency_plan: "",
  due_date: "",
};

function RisksTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const [risks, setRisks] = useState<ProjectRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSlideOver, setShowSlideOver] = useState(false);
  const [editingRisk, setEditingRisk] = useState<ProjectRisk | null>(null);
  const [form, setForm] = useState<RiskFormState>(DEFAULT_RISK_FORM);
  const [saving, setSaving] = useState(false);
  const [matrixFilter, setMatrixFilter] = useState<{ likelihood: string; impact: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("project_risks")
        .select("*")
        .eq("project_id", projectId)
        .order("risk_score", { ascending: false });
      if (!error) setRisks(data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [projectId]);

  const filteredRisks = matrixFilter
    ? risks.filter((r) => r.likelihood === matrixFilter.likelihood && r.impact === matrixFilter.impact)
    : risks;

  function openAdd() {
    setEditingRisk(null);
    setForm(DEFAULT_RISK_FORM);
    setShowSlideOver(true);
  }

  function openEdit(r: ProjectRisk) {
    setEditingRisk(r);
    setForm({
      title: r.title,
      category: r.category ?? "Technical",
      description: r.description ?? "",
      likelihood: r.likelihood,
      impact: r.impact,
      status: r.status,
      owner_name: r.owner_name ?? "",
      mitigation_plan: r.mitigation_plan ?? "",
      contingency_plan: r.contingency_plan ?? "",
      due_date: r.due_date ?? "",
    });
    setShowSlideOver(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Risk title is required"); return; }
    const lv = RISK_LIKELIHOOD_VALUES[form.likelihood] ?? 2;
    const iv = RISK_IMPACT_VALUES[form.impact] ?? 2;
    const score = lv * iv;
    setSaving(true);
    try {
      const payload = {
        project_id: projectId,
        title: form.title.trim(),
        category: form.category,
        description: form.description,
        likelihood: form.likelihood,
        likelihood_value: lv,
        impact: form.impact,
        impact_value: iv,
        risk_score: score,
        status: form.status,
        owner_name: form.owner_name,
        mitigation_plan: form.mitigation_plan,
        contingency_plan: form.contingency_plan,
        due_date: form.due_date || null,
      };
      if (editingRisk) {
        const { error } = await supabase.from("project_risks").update(payload).eq("id", editingRisk.id);
        if (error) throw error;
        if (form.status === "Triggered") {
          void notifyPM({
            projectId,
            recipientId: "manager",
            eventType: "risk_triggered",
            title: `Risk "${form.title}" has been triggered`,
            entityType: "risk",
            entityId: editingRisk.id,
          });
        }
        toast.success("Risk updated");
      } else {
        const { error } = await supabase.from("project_risks").insert([payload]);
        if (error) throw error;
        toast.success("Risk added");
      }
      setShowSlideOver(false);
      load();
    } catch {
      toast.error("Failed to save risk");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this risk?")) return;
    try {
      const { error } = await supabase.from("project_risks").delete().eq("id", id);
      if (error) throw error;
      setRisks((prev) => prev.filter((r) => r.id !== id));
      toast.success("Risk deleted");
    } catch {
      toast.error("Failed to delete risk");
    }
  }

  const liveScore = (RISK_LIKELIHOOD_VALUES[form.likelihood] ?? 2) * (RISK_IMPACT_VALUES[form.impact] ?? 2);
  const liveScoreLabel = liveScore >= 6 ? "HIGH RISK" : liveScore >= 3 ? "MEDIUM RISK" : "LOW RISK";
  const liveScoreColor = liveScore >= 6 ? "text-red-600" : liveScore >= 3 ? "text-amber-600" : "text-green-600";

  const totalRisks = risks.length;
  const highRisks = risks.filter((r) => r.risk_score >= 6).length;
  const mitigatedRisks = risks.filter((r) => r.status === "Mitigated").length;

  const likelihoods = ["High", "Medium", "Low"] as const;
  const impacts = ["Critical", "High", "Medium", "Low"] as const;

  if (loading) return <InlineLoader />;

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border p-4">
          <div className="text-2xl font-bold text-foreground">{totalRisks}</div>
          <div className="text-sm text-muted-foreground mt-0.5">Total Risks</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="text-2xl font-bold text-red-600">{highRisks}</div>
          <div className="text-sm text-muted-foreground mt-0.5">High Risk (score ≥ 6)</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="text-2xl font-bold text-green-600">{mitigatedRisks}</div>
          <div className="text-sm text-muted-foreground mt-0.5">Mitigated</div>
        </div>
      </div>

      <div className="flex gap-4 items-start">
        {/* Risk Matrix */}
        <div className="bg-card rounded-xl border p-4" style={{ width: "40%" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-foreground">Risk Matrix</h3>
            {matrixFilter && (
              <button
                onClick={() => setMatrixFilter(null)}
                className="text-xs text-blue-600 hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {/* Y label */}
            <div className="flex flex-col justify-around text-xs text-muted-foreground text-right" style={{ width: 52 }}>
              {likelihoods.map((l) => <span key={l}>{l}</span>)}
            </div>
            {/* Grid */}
            <div className="flex-1">
              <div className="grid" style={{ gridTemplateColumns: `repeat(4, 1fr)`, gap: 2 }}>
                {likelihoods.map((l) =>
                  impacts.map((im) => {
                    const lv = RISK_LIKELIHOOD_VALUES[l];
                    const iv = RISK_IMPACT_VALUES[im];
                    const score = lv * iv;
                    const count = risks.filter((r) => r.likelihood === l && r.impact === im).length;
                    const isActive = matrixFilter?.likelihood === l && matrixFilter?.impact === im;
                    return (
                      <button
                        key={`${l}-${im}`}
                        onClick={() => setMatrixFilter(isActive ? null : { likelihood: l, impact: im })}
                        className={`h-10 rounded flex items-center justify-center text-sm font-semibold border-2 transition-all ${riskScoreCell(score)} ${isActive ? "border-blue-500 scale-105" : "border-transparent hover:border-gray-300"}`}
                      >
                        {count > 0 ? count : ""}
                      </button>
                    );
                  })
                )}
              </div>
              {/* X labels */}
              <div className="grid mt-1 text-xs text-muted-foreground" style={{ gridTemplateColumns: `repeat(4, 1fr)` }}>
                {impacts.map((im) => <span key={im} className="text-center">{im}</span>)}
              </div>
            </div>
          </div>
        </div>

        {/* Add button */}
        <div className="flex-1 flex justify-end">
          {canManage && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 h-fit"
            >
              <Plus className="w-4 h-4" /> Add Risk
            </button>
          )}
        </div>
      </div>

      {/* Risk Table */}
      {filteredRisks.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{matrixFilter ? "No risks match this cell" : "No risks recorded"}</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted text-xs text-muted-foreground">
                <th className="text-left px-4 py-2 font-medium w-6">#</th>
                <th className="text-left px-4 py-2 font-medium">Title</th>
                <th className="text-left px-4 py-2 font-medium">Category</th>
                <th className="text-left px-4 py-2 font-medium">Score</th>
                <th className="text-left px-4 py-2 font-medium">Likelihood</th>
                <th className="text-left px-4 py-2 font-medium">Impact</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Owner</th>
                <th className="text-left px-4 py-2 font-medium">Due</th>
                {canManage && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody>
              {filteredRisks.map((r, i) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2 font-medium text-foreground max-w-[200px] truncate">{r.title}</td>
                  <td className="px-4 py-2">
                    {r.category && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">{r.category}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${riskScoreBadge(r.risk_score)}`}>{r.risk_score}</span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{r.likelihood}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.impact}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RISK_STATUS_BADGE[r.status]} ${r.status === "Triggered" ? "animate-pulse" : ""}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{r.owner_name ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.due_date ?? "—"}</td>
                  {canManage && (
                    <td className="px-4 py-2">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(r)} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Slide-Over */}
      {showSlideOver && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowSlideOver(false)} />
          <div className="w-[400px] bg-card border-l shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-foreground">{editingRisk ? "Edit Risk" : "Add Risk"}</h3>
              <button onClick={() => setShowSlideOver(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Title *</label>
                <input
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Risk title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Category</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {RISK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                <textarea
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Likelihood</label>
                <div className="flex gap-2">
                  {(["High", "Medium", "Low"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, likelihood: l }))}
                      className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${form.likelihood === l ? "bg-blue-600 text-white border-blue-600" : "border-border text-foreground hover:bg-muted"}`}
                    >
                      {l} ({RISK_LIKELIHOOD_VALUES[l]})
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Impact</label>
                <div className="flex gap-2 flex-wrap">
                  {(["Critical", "High", "Medium", "Low"] as const).map((im) => (
                    <button
                      key={im}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, impact: im }))}
                      className={`flex-1 py-2 text-sm rounded-lg border transition-colors min-w-[70px] ${form.impact === im ? "bg-blue-600 text-white border-blue-600" : "border-border text-foreground hover:bg-muted"}`}
                    >
                      {im} ({RISK_IMPACT_VALUES[im]})
                    </button>
                  ))}
                </div>
              </div>
              {/* Live score */}
              <div className={`px-3 py-2 rounded-lg border text-sm font-semibold ${liveScore >= 6 ? "bg-red-50 border-red-200" : liveScore >= 3 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
                <span className="text-foreground">Score: </span>
                <span className={liveScoreColor}>{liveScore} — {liveScoreLabel}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {RISK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Owner</label>
                <input
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.owner_name}
                  onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))}
                  placeholder="Owner name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Mitigation Plan</label>
                <textarea
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  value={form.mitigation_plan}
                  onChange={(e) => setForm((f) => ({ ...f, mitigation_plan: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Contingency Plan</label>
                <textarea
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  value={form.contingency_plan}
                  onChange={(e) => setForm((f) => ({ ...f, contingency_plan: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Due Date</label>
                <input
                  type="date"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowSlideOver(false)} className="px-4 py-2 text-sm text-foreground border border-border rounded-lg hover:bg-muted">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Saving…" : (editingRisk ? "Update Risk" : "Save Risk")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sprints Tab ──────────────────────────────────────────────────────────────

const SPRINT_STATUS_BADGE: Record<string, string> = {
  Planning: "bg-gray-100 text-gray-700",
  Active: "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-600",
};

function SprintsTab({ projectId, tasks, canManage }: { projectId: string; tasks: ProjectTask[]; canManage: boolean }) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [sprintItems, setSprintItems] = useState<SprintBacklogItem[]>([]);
  const [availableBacklog, setAvailableBacklog] = useState<DbBacklogItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Planning form state
  const [planName, setPlanName] = useState("");
  const [planGoal, setPlanGoal] = useState("");
  const [planStart, setPlanStart] = useState("");
  const [planEnd, setPlanEnd] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [backlogFilter, setBacklogFilter] = useState<"All" | "Stories" | "Bugs" | "Tasks">("All");
  const [backlogSearch, setBacklogSearch] = useState("");

  // Complete sprint modal
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeChoices, setCompleteChoices] = useState<Record<string, "backlog" | "next">>({});
  const [completing, setCompleting] = useState(false);

  // Analytics tab
  const [subTab, setSubTab] = useState<"detail" | "analytics">("detail");

  const selectedSprint = sprints.find((s) => s.id === selectedSprintId) ?? null;

  const spmH = { "Content-Type": "application/json", apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` };
  const spmUrl = (path: string) => `${API_BASE}/projects${path}`;

  async function loadSprints() {
    setLoading(true);
    try {
      const res = await fetch(spmUrl(`/sprints?projectId=${projectId}`), { headers: spmH });
      const json = await res.json();
      const list = ((json.data ?? []) as Sprint[]).sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
      setSprints(list);
      if (list.length > 0 && !selectedSprintId) setSelectedSprintId(list[0].id);
    } catch {
      // graceful
    } finally {
      setLoading(false);
    }
  }

  async function loadSprintItems(sprintId: string) {
    setLoadingItems(true);
    try {
      const res = await fetch(spmUrl(`/sprints/${sprintId}/backlog`), { headers: spmH });
      const json = await res.json();
      setSprintItems((json.data ?? []) as SprintBacklogItem[]);
    } catch {
      setSprintItems([]);
    } finally {
      setLoadingItems(false);
    }
  }

  async function loadAvailableBacklog() {
    try {
      // DB-level filter: unassigned (sprint_id IS NULL) and not Done
      const res = await fetch(spmUrl(`/backlog?projectId=${projectId}&unassigned=true&excludeStatus=Done`), { headers: spmH });
      const json = await res.json();
      setAvailableBacklog((json.data ?? []) as DbBacklogItem[]);
    } catch {
      setAvailableBacklog([]);
    }
  }

  useEffect(() => { loadSprints(); }, [projectId]);

  useEffect(() => {
    if (!selectedSprintId) return;
    const sprint = sprints.find((s) => s.id === selectedSprintId);
    if (!sprint) return;
    loadSprintItems(selectedSprintId);
    if (sprint.status === "Planning") {
      loadAvailableBacklog();
      setPlanName(sprint.name);
      setPlanGoal(sprint.goal ?? "");
      setPlanStart(sprint.start_date ?? "");
      setPlanEnd(sprint.end_date ?? "");
    }
  }, [selectedSprintId, sprints.length]);

  async function handleNewSprint() {
    const nextNum = sprints.length + 1;
    try {
      const res = await fetch(spmUrl("/sprints"), {
        method: "POST", headers: spmH,
        body: JSON.stringify({ projectId, name: `Sprint ${nextNum}`, sprint_number: nextNum, status: "Planning", goal: "" }),
      });
      const json = await res.json();
      if (!json.success) { toast.error("Failed to create sprint"); return; }
      const newSprint = json.data as Sprint;
      setSprints((prev) => [...prev, newSprint]);
      setSelectedSprintId(newSprint.id);
      toast.success("Sprint created");
    } catch {
      toast.error("Failed to create sprint");
    }
  }

  async function handleSaveDraft() {
    if (!selectedSprint) return;
    setSavingPlan(true);
    try {
      const res = await fetch(spmUrl(`/sprints/${selectedSprint.id}`), {
        method: "PUT", headers: spmH,
        body: JSON.stringify({ name: planName, goal: planGoal, start_date: planStart || null, end_date: planEnd || null }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSprints((prev) => prev.map((s) => s.id === selectedSprint.id
        ? { ...s, name: planName, goal: planGoal, start_date: planStart, end_date: planEnd }
        : s));
      toast.success("Draft saved");
    } catch {
      toast.error("Failed to save draft");
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleAddToSprint(item: DbBacklogItem) {
    if (!selectedSprintId) return;
    try {
      const res = await fetch(spmUrl(`/sprints/${selectedSprintId}/backlog`), {
        method: "POST", headers: spmH,
        body: JSON.stringify({ backlogItemId: item.id, orderIndex: sprintItems.length }),
      });
      const json = await res.json();
      if (json.data) {
        setSprintItems((prev) => [...prev, json.data as SprintBacklogItem]);
        setAvailableBacklog((prev) => prev.filter((b) => b.id !== item.id));
        const totalPts = [...sprintItems, json.data].reduce((sum: number, si: any) => sum + ((si.item?.story_points) ?? 0), 0);
        void fetch(spmUrl(`/sprints/${selectedSprintId}`), { method: "PUT", headers: spmH, body: JSON.stringify({ committed_points: totalPts }) });
        setSprints((prev) => prev.map((s) => s.id === selectedSprintId ? { ...s, committed_points: totalPts } : s));
      }
    } catch {
      toast.error("Failed to add item");
    }
  }

  async function handleRemoveFromSprint(sbi: SprintBacklogItem) {
    if (!selectedSprintId) return;
    try {
      await fetch(spmUrl(`/sprints/${selectedSprintId}/backlog/${sbi.id}`), { method: "DELETE", headers: spmH });
      setSprintItems((prev) => prev.filter((si) => si.id !== sbi.id));
      if (sbi.item) setAvailableBacklog((prev) => [...prev, sbi.item!]);
      const remaining = sprintItems.filter((si) => si.id !== sbi.id);
      const totalPts = remaining.reduce((sum, si) => sum + ((si.item?.story_points) ?? 0), 0);
      void fetch(spmUrl(`/sprints/${selectedSprintId}`), { method: "PUT", headers: spmH, body: JSON.stringify({ committed_points: totalPts }) });
      setSprints((prev) => prev.map((s) => s.id === selectedSprintId ? { ...s, committed_points: totalPts } : s));
    } catch {
      toast.error("Failed to remove item");
    }
  }

  async function handleStartSprint() {
    if (!selectedSprint) return;
    if (!planGoal.trim()) { toast.error("Sprint goal is required before starting."); return; }
    if (sprintItems.length === 0) { toast.error("Add at least one item to the sprint before starting."); return; }
    const hasActive = sprints.some((s) => s.id !== selectedSprint.id && s.status === "Active");
    if (hasActive) { toast.error("There is already an active sprint. Complete it first."); return; }
    if (!planStart || !planEnd) { toast.error("Start and end dates are required."); return; }
    const totalPts = sprintItems.reduce((sum, si) => sum + ((si.item?.story_points) ?? 0), 0);
    const itemIds = sprintItems.map((si) => si.backlog_item_id);
    try {
      const res = await fetch(spmUrl(`/sprints/${selectedSprint.id}`), {
        method: "PUT", headers: spmH,
        body: JSON.stringify({ status: "Active", start_date: planStart, end_date: planEnd, goal: planGoal, name: planName, committed_points: totalPts }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      if (itemIds.length > 0) {
        void fetch(spmUrl("/backlog-items"), { method: "PATCH", headers: spmH, body: JSON.stringify({ ids: itemIds, updates: { sprint_id: selectedSprint.id } }) });
      }
      setSprints((prev) => prev.map((s) => s.id === selectedSprint.id
        ? { ...s, status: "Active", start_date: planStart, end_date: planEnd, goal: planGoal, name: planName, committed_points: totalPts }
        : s));
      toast.success("Sprint started!");
    } catch {
      toast.error("Failed to start sprint");
    }
  }

  async function handleCancelSprint() {
    if (!selectedSprint) return;
    try {
      const res = await fetch(spmUrl(`/sprints/${selectedSprint.id}`), { method: "PUT", headers: spmH, body: JSON.stringify({ status: "Cancelled" }) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSprints((prev) => prev.map((s) => s.id === selectedSprint.id ? { ...s, status: "Cancelled" } : s));
      toast.success("Sprint cancelled");
    } catch {
      toast.error("Failed to cancel sprint");
    }
  }

  async function handleCompleteSprint() {
    if (!selectedSprint) return;
    setCompleting(true);
    try {
      const incompleteItems = sprintItems.filter((si) => si.item?.status !== "Done");
      const doneItems = sprintItems.filter((si) => si.item?.status === "Done");
      const nextSprint = sprints.find((s) => s.id !== selectedSprint.id && s.status === "Planning");

      for (const si of incompleteItems) {
        const choice = completeChoices[si.backlog_item_id] ?? "backlog";
        const targetSprintId = choice === "next" ? (nextSprint?.id ?? null) : null;
        void fetch(spmUrl(`/backlog-items/${si.backlog_item_id}`), { method: "PATCH", headers: spmH, body: JSON.stringify({ sprint_id: targetSprintId }) });
        await fetch(spmUrl(`/sprints/${selectedSprint.id}/backlog/${si.id}`), { method: "DELETE", headers: spmH });
        if (choice === "next" && nextSprint) {
          void fetch(spmUrl(`/sprints/${nextSprint.id}/backlog`), { method: "POST", headers: spmH, body: JSON.stringify({ backlogItemId: si.backlog_item_id }) });
        }
      }

      const velocity = doneItems.reduce((sum, si) => sum + ((si.item?.story_points) ?? 0), 0);
      const res = await fetch(spmUrl(`/sprints/${selectedSprint.id}`), {
        method: "PUT", headers: spmH,
        body: JSON.stringify({ status: "Completed", completed_points: velocity, velocity }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setSprints((prev) => prev.map((s) => s.id === selectedSprint.id
        ? { ...s, status: "Completed", completed_points: velocity, velocity }
        : s));
      setShowCompleteModal(false);
      setCompleting(false);
      toast.success("Sprint completed!");
    } catch {
      toast.error("Failed to complete sprint");
      setCompleting(false);
    }
  }

  // Filtered backlog for planning
  const filteredBacklog = availableBacklog.filter((item) => {
    if (backlogFilter !== "All") {
      const typeMap: Record<string, string[]> = { Stories: ["story", "epic"], Bugs: ["bug"], Tasks: ["task", "spike", "research"] };
      if (!typeMap[backlogFilter]?.includes(item.type ?? "")) return false;
    }
    if (backlogSearch && !item.title.toLowerCase().includes(backlogSearch.toLowerCase())) return false;
    return true;
  });

  const sprintItemIds = new Set(sprintItems.map((si) => si.backlog_item_id));
  const committedPts = sprintItems.reduce((sum, si) => sum + ((si.item?.story_points) ?? 0), 0);

  function daysLeft(sprint: Sprint) {
    const end = new Date(sprint.end_date);
    const now = new Date();
    return Math.ceil((end.getTime() - now.getTime()) / 86400000);
  }

  function priorityDot(priority?: string) {
    const map: Record<string, string> = { Critical: "bg-red-500", High: "bg-orange-400", Medium: "bg-yellow-400", Low: "bg-gray-400" };
    return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${map[priority ?? "Low"] ?? "bg-gray-400"}`} />;
  }

  function typeIcon(type?: string) {
    if (type === "bug") return <Bug className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />;
    if (type === "story" || type === "epic") return <BookOpen className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />;
    return <ListChecks className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />;
  }

  if (loading) return <InlineLoader />;

  return (
    <div className="flex gap-0 h-full min-h-[600px]">
      {/* Left sidebar — sprint list */}
      <div className="w-60 flex-shrink-0 border-r border-border bg-muted/30 flex flex-col">
        <div className="p-3 border-b border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sprints</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sprints.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">No sprints yet</div>
          )}
          {sprints.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSprintId(s.id)}
              className={`w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-muted/60 transition-colors ${selectedSprintId === s.id ? "bg-indigo-50 border-l-2 border-l-indigo-500" : ""}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium text-foreground truncate">{s.name}</span>
                <Badge className={`text-[10px] px-1.5 py-0 ${SPRINT_STATUS_BADGE[s.status]}`}>{s.status}</Badge>
              </div>
              {s.goal && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{s.goal}</p>}
            </button>
          ))}
        </div>
        {canManage && (
          <div className="p-2 border-t border-border">
            <button
              onClick={handleNewSprint}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Sprint
            </button>
          </div>
        )}
      </div>

      {/* Right main area */}
      <div className="flex-1 overflow-y-auto">
        {!selectedSprint ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Zap className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">Select or create a sprint</p>
          </div>
        ) : selectedSprint.status === "Planning" ? (
          /* ─── PLANNING STATE ─────────────────────── */
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Badge className={SPRINT_STATUS_BADGE["Planning"]}>Planning</Badge>
              <span className="text-sm font-semibold text-foreground">{selectedSprint.name}</span>
            </div>
            <div className="flex gap-4">
              {/* Left: available backlog */}
              <div className="w-2/5 flex flex-col gap-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Available Backlog</h4>
                <div className="flex gap-1 flex-wrap">
                  {(["All", "Stories", "Bugs", "Tasks"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setBacklogFilter(f)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${backlogFilter === f ? "bg-indigo-600 text-white border-indigo-600" : "border-border text-muted-foreground hover:bg-muted"}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    className="w-full pl-8 pr-2 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Search backlog..."
                    value={backlogSearch}
                    onChange={(e) => setBacklogSearch(e.target.value)}
                  />
                </div>
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {filteredBacklog.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4 text-center">No items</p>
                  )}
                  {filteredBacklog.map((item) => {
                    const inSprint = sprintItemIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs transition-colors ${inSprint ? "opacity-40 bg-muted" : "bg-card hover:border-indigo-300"}`}
                      >
                        {priorityDot(item.priority)}
                        {typeIcon(item.type)}
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-mono flex-shrink-0">{item.id.slice(0, 6)}</span>
                        <span className="flex-1 truncate text-foreground">{item.title}</span>
                        {item.story_points != null && (
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium flex-shrink-0">{item.story_points}pt</span>
                        )}
                        <button
                          onClick={() => !inSprint && handleAddToSprint(item)}
                          disabled={inSprint}
                          className="text-indigo-600 hover:text-indigo-800 disabled:opacity-30"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: sprint detail */}
              <div className="flex-1 flex flex-col gap-3">
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Sprint Name</label>
                    <input
                      className="w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      value={planName}
                      onChange={(e) => setPlanName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Sprint Goal <span className="text-red-500">*</span></label>
                    <textarea
                      rows={2}
                      className="w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                      placeholder="What is the goal of this sprint?"
                      value={planGoal}
                      onChange={(e) => setPlanGoal(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Start Date</label>
                      <input type="date" className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={planStart} onChange={(e) => setPlanStart(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">End Date</label>
                      <input type="date" className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={planEnd} onChange={(e) => setPlanEnd(e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Committed pts bar */}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Committed</span>
                    <span className={committedPts > 50 ? "text-orange-500 font-semibold" : ""}>{committedPts} pts</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${committedPts > 50 ? "bg-orange-400" : "bg-green-500"}`}
                      style={{ width: `${Math.min(100, (committedPts / 50) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Sprint items */}
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Sprint Items ({sprintItems.length})</h4>
                  {loadingItems && <p className="text-xs text-muted-foreground">Loading...</p>}
                  {sprintItems.length === 0 && !loadingItems && (
                    <p className="text-xs text-muted-foreground py-3 text-center">Add items from the backlog</p>
                  )}
                  {sprintItems.map((si) => (
                    <div key={si.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card text-xs">
                      {si.item && priorityDot(si.item.priority)}
                      {si.item && typeIcon(si.item.type)}
                      <span className="flex-1 truncate text-foreground">{si.item?.title ?? si.backlog_item_id}</span>
                      {(si.item?.story_points ?? 0) > 0 && (
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium flex-shrink-0">{si.item?.story_points}pt</span>
                      )}
                      <button onClick={() => handleRemoveFromSprint(si)} className="text-red-400 hover:text-red-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
                  <div className="flex gap-2">
                    {canManage && (
                      <button onClick={handleCancelSprint} className="px-3 py-1.5 text-xs text-muted-foreground border border-border rounded-lg hover:bg-muted">
                        Cancel Sprint
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSaveDraft} disabled={savingPlan} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted disabled:opacity-50">
                      {savingPlan ? "Saving..." : "Save Draft"}
                    </button>
                    {canManage && (
                      <button onClick={handleStartSprint} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                        <Zap className="w-3.5 h-3.5" /> Start Sprint
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : selectedSprint.status === "Active" ? (
          /* ─── ACTIVE STATE ───────────────────────── */
          <div className="p-4 space-y-4">
            {/* Sprint header card */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="font-semibold text-blue-800 text-sm">{selectedSprint.name}</span>
                    <Badge className="bg-blue-100 text-blue-700 text-[10px]">Active</Badge>
                  </div>
                  {selectedSprint.goal && <p className="text-xs text-blue-700/80 mb-2">{selectedSprint.goal}</p>}
                  {(() => {
                    const days = daysLeft(selectedSprint);
                    const committed = selectedSprint.committed_points ?? 0;
                    const completed = selectedSprint.completed_points ?? 0;
                    const pct = committed > 0 ? Math.min(100, (completed / committed) * 100) : 0;
                    return (
                      <>
                        <div className="flex justify-between text-xs text-blue-700/70 mb-1">
                          <span>{selectedSprint.start_date} → {selectedSprint.end_date}</span>
                          <span className={days <= 3 ? "text-red-600 font-semibold" : ""}>
                            {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d remaining`}
                          </span>
                        </div>
                        <div className="w-full bg-blue-100 rounded-full h-2 mb-2">
                          <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-blue-700/70">
                          <span>{completed} / {committed} pts</span>
                          {selectedSprint.velocity != null && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">Velocity: {selectedSprint.velocity}</span>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
                {canManage && (
                  <button
                    onClick={() => {
                      const incomplete = sprintItems.filter((si) => si.item?.status !== "Done");
                      const init: Record<string, "backlog" | "next"> = {};
                      for (const si of incomplete) init[si.backlog_item_id] = "backlog";
                      setCompleteChoices(init);
                      setShowCompleteModal(true);
                    }}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-green-600 rounded-lg hover:bg-green-700"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Complete Sprint
                  </button>
                )}
              </div>
            </div>

            {/* Active sprint items by status */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Sprint Board</h4>
              {(() => {
                const sprintTasks = tasks.filter(t => t.sprintId === selectedSprintId);
                return (
                  <div className="grid grid-cols-4 gap-3">
                    {(["To Do", "In Progress", "In Review", "Done"] as const).map((col) => {
                      const colItems = sprintItems.filter((si) => {
                        const s = si.item?.status ?? "Open";
                        if (col === "To Do") return s === "Open" || s === "Todo";
                        if (col === "In Progress") return s === "In Progress";
                        if (col === "In Review") return s === "In Review";
                        return s === "Done";
                      });
                      const colTasks = sprintTasks.filter((t) => {
                        if (col === "To Do") return t.status === "Todo";
                        if (col === "In Progress") return t.status === "In Progress";
                        if (col === "In Review") return t.status === "In Review";
                        return t.status === "Done";
                      });
                      return (
                        <div key={col} className="bg-muted/40 rounded-xl p-2">
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-xs font-semibold text-muted-foreground">{col}</span>
                            <span className="text-[10px] bg-gray-200 text-gray-600 rounded-full px-1.5">{colItems.length + colTasks.length}</span>
                          </div>
                          <div className="space-y-1.5">
                            {colItems.map((si) => (
                              <div key={si.id} className="bg-card rounded-lg border p-2 text-xs">
                                <div className="flex items-center gap-1 mb-0.5">
                                  {si.item && priorityDot(si.item.priority)}
                                  {si.item && typeIcon(si.item.type)}
                                </div>
                                <p className="text-foreground font-medium leading-tight">{si.item?.title}</p>
                                {si.item?.assignee_name && <p className="text-muted-foreground mt-0.5">{si.item.assignee_name}</p>}
                                {(si.item?.story_points ?? 0) > 0 && (
                                  <span className="mt-1 inline-block px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium">{si.item?.story_points}pt</span>
                                )}
                              </div>
                            ))}
                            {colTasks.map((t) => (
                              <div key={t.id} className="bg-card rounded-lg border border-blue-100 p-2 text-xs">
                                <div className="flex items-center gap-1 mb-0.5">
                                  {priorityDot(t.priority)}
                                  <CheckSquare className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                  <span className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">Task</span>
                                </div>
                                <p className="text-foreground font-medium leading-tight">{t.title}</p>
                                {t.assigneeName && <p className="text-muted-foreground mt-0.5">{t.assigneeName}</p>}
                                {t.estimatedHours && (
                                  <span className="mt-1 inline-block px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium">{t.estimatedHours}h est</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        ) : selectedSprint.status === "Completed" ? (
          /* ─── COMPLETED STATE ────────────────────── */
          <div className="p-4 space-y-4">
            {/* Sub-tab selector */}
            <div className="flex gap-1 border-b border-border pb-2">
              <button onClick={() => setSubTab("detail")} className={`px-3 py-1.5 text-xs rounded-lg font-medium ${subTab === "detail" ? "bg-indigo-100 text-indigo-700" : "text-muted-foreground hover:bg-muted"}`}>Summary</button>
              <button onClick={() => setSubTab("analytics")} className={`px-3 py-1.5 text-xs rounded-lg font-medium ${subTab === "analytics" ? "bg-indigo-100 text-indigo-700" : "text-muted-foreground hover:bg-muted"}`}>Analytics</button>
            </div>

            {subTab === "detail" && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-semibold text-green-800 text-sm">{selectedSprint.name} — Completed</span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    {[
                      { label: "Committed", value: `${selectedSprint.committed_points ?? 0} pts` },
                      { label: "Completed", value: `${selectedSprint.completed_points ?? 0} pts` },
                      { label: "Velocity", value: selectedSprint.velocity ?? 0 },
                      { label: "Carried Over", value: `${(selectedSprint.committed_points ?? 0) - (selectedSprint.completed_points ?? 0)} pts` },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-white rounded-lg border p-2">
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                        <p className="text-lg font-bold text-foreground">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Items</h4>
                  {sprintItems.map((si) => {
                    const done = si.item?.status === "Done";
                    return (
                      <div key={si.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card text-xs">
                        {done
                          ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                        <span className={`flex-1 truncate ${done ? "text-foreground" : "text-muted-foreground"}`}>{si.item?.title}</span>
                        {(si.item?.story_points ?? 0) > 0 && (
                          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px]">{si.item?.story_points}pt</span>
                        )}
                        <Badge className={done ? "bg-green-100 text-green-700 text-[10px]" : "bg-gray-100 text-gray-500 text-[10px]"}>
                          {done ? "Done" : si.item?.status ?? "Open"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {subTab === "analytics" && (
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Velocity Chart</h4>
                {/* Simple SVG bar chart */}
                <div className="bg-card border rounded-xl p-4 overflow-x-auto">
                  <svg width={Math.max(300, sprints.filter((s) => s.status === "Completed").length * 80)} height={160}>
                    {(() => {
                      const completedSprints = sprints.filter((s) => s.status === "Completed");
                      const maxVal = Math.max(1, ...completedSprints.map((s) => Math.max(s.committed_points ?? 0, s.completed_points ?? 0)));
                      const barW = 24;
                      const gap = 80;
                      const chartH = 120;
                      return completedSprints.map((s, i) => {
                        const x = i * gap + 20;
                        const committedH = ((s.committed_points ?? 0) / maxVal) * chartH;
                        const completedH = ((s.completed_points ?? 0) / maxVal) * chartH;
                        return (
                          <g key={s.id}>
                            <rect x={x} y={chartH - committedH} width={barW} height={committedH} fill="#d1d5db" rx={2} />
                            <rect x={x + barW + 2} y={chartH - completedH} width={barW} height={completedH} fill="#6366f1" rx={2} />
                            <text x={x + barW} y={chartH + 14} textAnchor="middle" fontSize={9} fill="#6b7280">{s.name}</text>
                          </g>
                        );
                      });
                    })()}
                  </svg>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-300 rounded inline-block" /> Committed</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-indigo-500 rounded inline-block" /> Completed</span>
                  </div>
                </div>

                <h4 className="text-xs font-semibold text-muted-foreground uppercase mt-2">Sprint Comparison</h4>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        {["Sprint", "Committed", "Completed", "Velocity", "Carried Over"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-muted-foreground font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sprints.filter((s) => s.status === "Completed").map((s) => (
                        <tr key={s.id} className={`border-t border-border ${s.id === selectedSprint.id ? "bg-indigo-50" : ""}`}>
                          <td className="px-3 py-2 font-medium text-foreground">{s.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{s.committed_points ?? 0}</td>
                          <td className="px-3 py-2 text-muted-foreground">{s.completed_points ?? 0}</td>
                          <td className="px-3 py-2 text-muted-foreground">{s.velocity ?? 0}</td>
                          <td className="px-3 py-2 text-muted-foreground">{(s.committed_points ?? 0) - (s.completed_points ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Cancelled */
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <X className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Sprint was cancelled</p>
          </div>
        )}
      </div>

      {/* Complete Sprint Modal */}
      {showCompleteModal && selectedSprint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-2xl shadow-xl border w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Complete Sprint</h3>
              <button onClick={() => setShowCompleteModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>

            {/* Summary row */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Committed", value: selectedSprint.committed_points ?? 0 },
                { label: "Completed", value: sprintItems.filter((si) => si.item?.status === "Done").reduce((sum, si) => sum + (si.item?.story_points ?? 0), 0) },
                { label: "Carried Over", value: sprintItems.filter((si) => si.item?.status !== "Done").reduce((sum, si) => sum + (si.item?.story_points ?? 0), 0) },
              ].map((s) => (
                <div key={s.label} className="bg-muted rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  <p className="text-sm font-bold text-foreground">{s.value} pts</p>
                </div>
              ))}
            </div>

            {/* Incomplete items */}
            {sprintItems.filter((si) => si.item?.status !== "Done").length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">Incomplete Items</h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {sprintItems.filter((si) => si.item?.status !== "Done").map((si) => (
                    <div key={si.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card text-xs">
                      <span className="flex-1 truncate text-foreground">{si.item?.title}</span>
                      <span className="text-muted-foreground">{si.item?.story_points ?? 0}pt</span>
                      <select
                        className="text-xs border border-border rounded px-1 py-0.5"
                        value={completeChoices[si.backlog_item_id] ?? "backlog"}
                        onChange={(e) => setCompleteChoices((prev) => ({ ...prev, [si.backlog_item_id]: e.target.value as "backlog" | "next" }))}
                      >
                        <option value="backlog">Move to Backlog</option>
                        <option value="next">Move to Next Sprint</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCompleteModal(false)} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
              <button onClick={handleCompleteSprint} disabled={completing} className="px-3 py-1.5 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
                {completing ? "Completing..." : "Complete Sprint"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Linked Tickets Popover ───────────────────────────────────────────────────

function LinkedTicketsBadge({ ids }: { ids: string[] }) {
  const [open, setOpen] = useState(false);
  if (!ids || ids.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
      >
        <Link2 className="w-3 h-3" />
        {ids.length}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-6 left-0 bg-card border border-border rounded-lg shadow-xl p-3 min-w-[160px]">
            <p className="text-xs font-semibold text-foreground mb-2">Linked Tickets</p>
            <div className="flex flex-wrap gap-1">
              {ids.map((id) => (
                <span key={id} className="px-2 py-0.5 rounded border border-blue-300 text-blue-700 text-xs font-mono bg-blue-50">{id}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  confirmClass = "bg-red-600 hover:bg-red-700 text-white",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-2">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{message}</p>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg bg-background hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Backlog Tab ──────────────────────────────────────────────────────────────

function AddEpicSlideOver({ projectId, initial, onClose, onSave }: {
  projectId: string;
  initial?: ProjectEpic;
  onClose: () => void;
  onSave: (epic: ProjectEpic) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [color, setColor] = useState(initial?.color ?? '#6366F1');
  const [status, setStatus] = useState<ProjectEpic['status']>(initial?.status ?? 'Not Started');
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  const [ownerName, setOwnerName] = useState(initial?.owner_name ?? '');
  const [saving, setSaving] = useState(false);

  const PRESET_COLORS = ['#6366F1','#3B82F6','#8B5CF6','#EC4899','#10B981','#F97316','#EF4444','#0D9488'];

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (initial?.id) {
        const { data, error } = await supabase.from('project_epics').update({
          title, description, color, status, start_date: startDate || null, end_date: endDate || null, owner_name: ownerName
        }).eq('id', initial.id).select().single();
        if (error) throw error;
        onSave(data as ProjectEpic);
      } else {
        const { data, error } = await supabase.from('project_epics').insert([{
          project_id: projectId, title, description, color, status,
          start_date: startDate || null, end_date: endDate || null, owner_name: ownerName
        }]).select().single();
        if (error) throw error;
        onSave(data as ProjectEpic);
      }
      toast.success(initial?.id ? 'Epic updated' : 'Epic created');
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[360px] bg-background border-l shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">{initial ? 'Edit Epic' : 'Add Epic'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Epic title"
              className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Color</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as ProjectEpic['status'])}
              className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {['Not Started','In Progress','Done','On Hold'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <MentionTextarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder={t("pm.mention.placeholder")}
              className="w-full mt-1 border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Owner</label>
            <input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Owner name"
              className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        <div className="p-4 border-t flex gap-2">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm hover:bg-muted">Cancel</button>
          <button onClick={handleSave} disabled={!title.trim() || saving}
            className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 hover:bg-indigo-700">
            {saving ? 'Saving...' : 'Save Epic'}
          </button>
        </div>
      </div>
    </>
  );
}

function BacklogTypeIcon({ type }: { type: BacklogItem["type"] }) {
  const map: Record<BacklogItem["type"], { icon: React.ReactNode; bg: string }> = {
    story: { icon: <BookOpen className="w-3.5 h-3.5 text-blue-600" />, bg: "bg-blue-50" },
    epic: { icon: <Zap className="w-3.5 h-3.5 text-purple-600" />, bg: "bg-purple-50" },
    spike: { icon: <FlaskConical className="w-3.5 h-3.5 text-green-600" />, bg: "bg-green-50" },
    bug: { icon: <Bug className="w-3.5 h-3.5 text-red-600" />, bg: "bg-red-50" },
    research: { icon: <Search className="w-3.5 h-3.5 text-amber-600" />, bg: "bg-amber-50" },
  };
  const { icon, bg } = map[type] ?? map.story;
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded ${bg}`}>
      {icon}
    </span>
  );
}

const BACKLOG_PRIORITY_BORDER: Record<string, string> = {
  Critical: "border-l-4 border-l-red-400",
  High: "border-l-4 border-l-orange-400",
  Medium: "border-l-4 border-l-blue-400",
  Low: "",
};

const BACKLOG_PRIORITY_BADGE: Record<string, string> = {
  Critical: "bg-red-100 text-red-700",
  High: "bg-orange-100 text-orange-700",
  Medium: "bg-blue-100 text-blue-700",
  Low: "bg-muted text-muted-foreground",
};

const BACKLOG_STATUS_BADGE: Record<string, string> = {
  "Open": "bg-muted text-muted-foreground",
  "In Progress": "bg-blue-100 text-blue-700",
  "In Review": "bg-purple-100 text-purple-700",
  "Testing": "bg-amber-100 text-amber-700",
  "Done": "bg-green-100 text-green-700",
  "Cancelled": "bg-muted text-muted-foreground line-through",
  "Blocked": "bg-red-100 text-red-700",
};

let backlogCounter = 1000;
function nextBacklogId() { return `BLG-${++backlogCounter}`; }

interface AddBacklogSlideOverProps {
  sprintNames: string[];
  dbSprints?: { id: string; name: string }[];
  memberNames: string[];
  epics?: ProjectEpic[];
  projectId?: string;
  initialItem?: BacklogItem;
  onClose: () => void;
  onSave: (item: BacklogItem) => void | Promise<void>;
}

function AddBacklogSlideOver({ sprintNames, dbSprints = [], memberNames, epics, projectId, initialItem, onClose, onSave }: AddBacklogSlideOverProps) {
  const [title, setTitle] = useState(initialItem?.title ?? "");
  const [type, setType] = useState<BacklogItem["type"]>(initialItem?.type ?? "story");
  const [priority, setPriority] = useState<BacklogItem["priority"]>(initialItem?.priority ?? "Medium");
  const [description, setDescription] = useState(initialItem?.description ?? "");
  const [points, setPoints] = useState<number | undefined>(initialItem?.points);
  const [sprint, setSprint] = useState(initialItem?.sprint ?? "");
  const [assigneeName, setAssigneeName] = useState(initialItem?.assigneeName ?? "");
  const [epicId, setEpicId] = useState<string | undefined>(initialItem?.epic_id);
  const [criteria, setCriteria] = useState<string[]>(initialItem?.acceptanceCriteria ?? []);
  const [ticketInput, setTicketInput] = useState("");
  const [linkedTickets, setLinkedTickets] = useState<string[]>([]);
  const [allEmployees, setAllEmployees] = useState<string[]>([]);
  const [dependencies, setDependencies] = useState<{ targetId: string; targetTitle: string; type: string }[]>([]);
  const [depSearch, setDepSearch] = useState("");
  const [depType, setDepType] = useState("Blocks");
  const [allProjectItems, setAllProjectItems] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/directory/employees`, { headers: apiHeaders() })
      .then(r => r.json()).then(json => {
        const names = (json.data ?? []).filter((e: any) => e.status !== 'Inactive').map((e: any) => e.employee_name ?? e.fullName ?? e.name ?? "").filter(Boolean);
        if (names.length) setAllEmployees(names);
      }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) return;
    fetch(`${API_BASE}/projects/backlog?projectId=${projectId}`, {
      headers: { "Content-Type": "application/json", apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
    }).then(r => r.json()).then(j => setAllProjectItems(j.data ?? [])).catch(() => {});
  }, [projectId]);

  function addCriterion() { setCriteria((c) => [...c, ""]); }
  function setCriterion(i: number, v: string) { setCriteria((c) => c.map((x, j) => j === i ? v : x)); }
  function removeCriterion(i: number) { setCriteria((c) => c.filter((_, j) => j !== i)); }

  function addTicket() {
    const v = ticketInput.trim();
    if (v && !linkedTickets.includes(v)) {
      setLinkedTickets((t) => [...t, v]);
      setTicketInput("");
    }
  }
  function removeTicket(id: string) { setLinkedTickets((t) => t.filter((x) => x !== id)); }

  function handleSave() {
    const item: BacklogItem = {
      id: initialItem?.id ?? nextBacklogId(),
      itemId: initialItem?.itemId,
      projectId: "",
      type,
      title: title.trim(),
      description,
      priority,
      status: initialItem?.status ?? "Open",
      points,
      sprint, // this is now a sprint UUID when dbSprints are used
      assigneeName,
      linkedTicketIds: linkedTickets,
      acceptanceCriteria: criteria.filter(Boolean),
      epic_id: epicId,
      dependencies: dependencies.map((d) => ({ targetId: d.targetId, type: d.type })),
      createdAt: initialItem?.createdAt ?? new Date().toISOString(),
    };
    onSave(item);
  }

  // Use real DB sprints if available, else fall back to name-based list
  const sprintSelectOptions = dbSprints.length > 0
    ? [{ id: "", name: "Backlog (unassigned)" }, ...dbSprints]
    : [{ id: "", name: "Backlog (unassigned)" }, ...sprintNames.map(n => ({ id: n, name: n }))];
  const canSave = title.trim().length >= 5;

  const PRIORITY_DOT: Record<string, string> = { Critical: "bg-red-500", High: "bg-orange-400", Medium: "bg-blue-500", Low: "bg-muted-foreground" };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[560px] bg-card border-l border-border shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h3 className="text-base font-semibold text-foreground">{initialItem ? `Edit ${initialItem.itemId ?? "Backlog Item"}` : "Add Backlog Item"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Basics */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Basics</h4>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Title * <span className="text-xs text-muted-foreground font-normal">({title.length} chars)</span></label>
              <input
                className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short, descriptive title"
              />
              {title.length > 0 && title.length < 5 && <p className="text-xs text-red-500 mt-1">Minimum 5 characters</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Type *</label>
                <select className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" value={type} onChange={(e) => setType(e.target.value as BacklogItem["type"])}>
                  <option value="story">Story</option>
                  <option value="task">Task</option>
                  <option value="epic">Epic</option>
                  <option value="spike">Spike</option>
                  <option value="bug">Bug</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Priority</label>
                <select className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" value={priority} onChange={(e) => setPriority(e.target.value as BacklogItem["priority"])}>
                  {(["Critical", "High", "Medium", "Low"] as const).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1 mt-1"><span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[priority]}`} /></div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Description</label>
              <MentionTextarea className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("pm.mention.placeholder")} />
            </div>
          </div>
          {/* Planning */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Planning</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Story Points</label>
                <select className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" value={points ?? ""} onChange={(e) => setPoints(e.target.value ? Number(e.target.value) : undefined)}>
                  <option value="">—</option>
                  {[1, 2, 3, 5, 8, 13, 21].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Sprint</label>
                <select className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" value={sprint} onChange={(e) => setSprint(e.target.value)}>
                  {sprintSelectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Assignee</label>
                <EmployeeSearchDropdown
                  value={assigneeName}
                  onChange={(name) => setAssigneeName(name)}
                  placeholder="Search assignee…"
                />
              </div>
            </div>
          </div>
          {/* Epic */}
          {(epics ?? []).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Epic</label>
              <select value={epicId ?? ''} onChange={e => setEpicId(e.target.value || undefined)}
                className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                <option value="">— No Epic —</option>
                {(epics ?? []).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
          )}
          {/* Acceptance Criteria */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acceptance Criteria</h4>
            {criteria.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input
                  className="flex-1 bg-input-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  value={c}
                  onChange={(e) => setCriterion(i, e.target.value)}
                  placeholder={`Criterion ${i + 1}`}
                />
                <button onClick={() => removeCriterion(i)} className="text-muted-foreground hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={addCriterion} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
              <Plus className="w-4 h-4" /> Add Criterion
            </button>
          </div>
          {/* Linked IT Tickets */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
              Linked IT Tickets
            </h4>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                value={ticketInput}
                onChange={(e) => setTicketInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTicket()}
                placeholder="Add ticket ID (e.g. INC-1042)"
              />
              <button onClick={addTicket} className="px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">+ Add</button>
            </div>
            {linkedTickets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {linkedTickets.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-violet-300 text-violet-700 text-xs font-mono bg-violet-50">
                    {id}
                    <button onClick={() => removeTicket(id)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Dependencies */}
          {allProjectItems.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dependencies</h4>
              <div className="flex gap-2">
                <select value={depType} onChange={(e) => setDepType(e.target.value)}
                  className="border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-input-background">
                  {["Blocks", "Blocked By", "Relates To", "Duplicates"].map((t) => <option key={t}>{t}</option>)}
                </select>
                <input value={depSearch} onChange={(e) => setDepSearch(e.target.value)} placeholder="Search item..."
                  list="dep-items-list"
                  className="flex-1 border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-input-background" />
                <datalist id="dep-items-list">
                  {allProjectItems.filter((i) => i.title.toLowerCase().includes(depSearch.toLowerCase())).map((i) => (
                    <option key={i.id} value={i.title} />
                  ))}
                </datalist>
                <button type="button" onClick={() => {
                  const target = allProjectItems.find((i) => i.title === depSearch);
                  if (!target) return;
                  if (dependencies.some((d) => d.targetId === target.id)) return;
                  setDependencies((d) => [...d, { targetId: target.id, targetTitle: target.title, type: depType }]);
                  setDepSearch("");
                }} className="px-2 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-xs hover:bg-indigo-100">
                  + Add
                </button>
              </div>
              {dependencies.length > 0 && (
                <div className="space-y-1">
                  {dependencies.map((dep, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-muted rounded px-2 py-1">
                      <span><span className="font-medium">{dep.type}</span>: {dep.targetTitle}</span>
                      <button onClick={() => setDependencies((d) => d.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-red-500"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-foreground border border-border rounded-lg hover:bg-muted">Cancel</button>
          <button onClick={handleSave} disabled={!canSave} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Save Item</button>
        </div>
      </div>
    </>
  );
}

function BacklogTab({ projectId, members, sprintNames, userEmail, canManage }: { projectId: string; members: { employeeName: string }[]; sprintNames: string[]; userEmail: string; canManage: boolean }) {
  const [backlogItems, setBacklogItems] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [filter, setFilter] = useState({ priority: "All", status: "All", type: "All", assignee: "All", sprintId: "All", search: "", pointsMin: "", pointsMax: "" });
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<{ id: string; name: string; filters: typeof filter }[]>([]);
  const [showSaveViewInput, setShowSaveViewInput] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const [epics, setEpics] = useState<ProjectEpic[]>([]);
  const [showEpicsView, setShowEpicsView] = useState(false);
  const [epicFilter, setEpicFilter] = useState<string | null>(null);
  const [showEpicForm, setShowEpicForm] = useState(false);
  const [blockedItemIds, setBlockedItemIds] = useState<Set<string>>(new Set());
  const [editItem, setEditItem] = useState<BacklogItem | null>(null);
  const [dbSprints, setDbSprints] = useState<{ id: string; name: string }[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<BacklogItem | null>(null);

  const loadBacklog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/projects/backlog?projectId=${projectId}`, {
        headers: { "Content-Type": "application/json", apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
      });
      const json = await res.json();
      const data = json.data ?? [];
      setBacklogItems(data.map((r: any) => ({
        id: r.id,
        itemId: r.item_id ?? undefined,
        type: r.type ?? 'story',
        title: r.title ?? '',
        description: r.description ?? '',
        priority: (r.priority ?? 'Medium') as BacklogItem['priority'],
        status: r.status ?? 'Backlog',
        points: r.story_points ?? 0,
        assigneeName: r.assignee_name ?? '',
        sprint: r.sprint_id ?? '',
        acceptanceCriteria: r.acceptance_criteria ?? [],
        linkedTicketIds: r.linked_tickets ?? [],
        epic_id: r.epic_id ?? undefined,
        createdAt: r.created_at ?? '',
      })));
    } catch { setBacklogItems([]); }
    finally { setLoading(false); }
  }, [projectId]);

  const loadEpics = useCallback(async () => {
    const { data } = await supabase.from('project_epics').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
    setEpics(data ?? []);
  }, [projectId]);

  useEffect(() => {
    loadBacklog();
    loadEpics();
  }, [loadBacklog, loadEpics]);

  // Fetch real sprints for the dropdown
  useEffect(() => {
    if (!projectId) return;
    fetch(`${API_BASE}/projects/sprints?projectId=${projectId}`, {
      headers: { "Content-Type": "application/json", apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
    }).then(r => r.json()).then(json => {
      setDbSprints((json.data ?? []).map((s: any) => ({ id: s.id, name: s.name })));
    }).catch(() => {});
  }, [projectId]);

  async function doDeleteBacklog(item: BacklogItem) {
    try {
      const res = await fetch(`${API_BASE}/projects/backlog/${item.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
      });
      if (!res.ok) { toast.error("Failed to delete backlog item"); return; }
      setBacklogItems(prev => prev.filter(x => x.id !== item.id));
      toast.success("Backlog item deleted");
    } catch {
      toast.error("Failed to delete backlog item");
    } finally {
      setConfirmDelete(null);
    }
  }

  async function handleUpdateBacklog(item: BacklogItem, sprintId?: string) {
    try {
      const res = await fetch(`${API_BASE}/projects/backlog/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
          type: item.type,
          title: item.title,
          description: item.description,
          priority: item.priority,
          status: item.status,
          storyPoints: item.points,
          sprintId: sprintId !== undefined ? sprintId : item.sprint,
          assigneeName: item.assigneeName,
          acceptanceCriteria: item.acceptanceCriteria,
          linkedTickets: item.linkedTicketIds,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error ?? "Failed to update backlog item"); return; }
      await loadBacklog();
      toast.success("Backlog item updated");
      setEditItem(null);
    } catch {
      toast.error("Failed to update backlog item");
    }
  }

  // Load dependency data to identify blocked items
  useEffect(() => {
    supabase.from("project_backlog_dependencies")
      .select("target_item_id")
      .then(({ data }) => {
        const ids = new Set((data ?? []).map((d: any) => d.target_item_id as string));
        setBlockedItemIds(ids);
      });
  }, [projectId]);

  useEffect(() => {
    supabase.from("pm_saved_views")
      .select("*")
      .eq("project_id", projectId)
      .eq("screen", "backlog")
      .eq("user_id", userEmail ?? "unknown")
      .order("created_at")
      .then(({ data }) => {
        setSavedViews((data ?? []).map((v: any) => ({ id: v.id, name: v.name, filters: v.filters })));
      });
  }, [projectId, userEmail]);

  const memberNames = members.map((m) => m.employeeName);
  const DEFAULT_FILTER = { priority: "All", status: "All", type: "All", assignee: "All", sprintId: "All", search: "", pointsMin: "", pointsMax: "" };

  const filtered = backlogItems.filter((item) => {
    if (filter.priority !== "All" && item.priority !== filter.priority) return false;
    if (filter.status !== "All" && item.status !== filter.status) return false;
    if (filter.type !== "All" && item.type !== filter.type) return false;
    if (filter.assignee !== "All" && item.assigneeName !== filter.assignee) return false;
    if (filter.sprintId !== "All" && item.sprint !== filter.sprintId) return false;
    if (filter.search && !item.title.toLowerCase().includes(filter.search.toLowerCase())) return false;
    if (filter.pointsMin && (item.points ?? 0) < Number(filter.pointsMin)) return false;
    if (filter.pointsMax && (item.points ?? 0) > Number(filter.pointsMax)) return false;
    if (epicFilter && item.epic_id !== epicFilter) return false;
    return true;
  });

  const KANBAN_COLS = ["Open", "In Progress", "In Review", "Done"] as const;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button onClick={() => setViewMode("table")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <LayoutList className="w-4 h-4" /> Table
            </button>
            <button onClick={() => setViewMode("kanban")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "kanban" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Columns className="w-4 h-4" /> Kanban
            </button>
            <button onClick={() => setShowEpicsView(v => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${showEpicsView ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Zap className="w-4 h-4" /> Epics
            </button>
          </div>
          <input
            type="search"
            placeholder="Search backlog..."
            value={filter.search}
            onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
            className="border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-44"
          />
          <select className="bg-input-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={filter.priority} onChange={(e) => setFilter((f) => ({ ...f, priority: e.target.value }))}>
            <option value="All">All Priorities</option>
            {["Critical", "High", "Medium", "Low"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="bg-input-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
            <option value="All">All Statuses</option>
            {["Open", "In Progress", "In Review", "Testing", "Done", "Cancelled", "Blocked"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="bg-input-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={filter.type} onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}>
            <option value="All">All Types</option>
            {["story", "epic", "spike", "bug", "research"].map((tp) => <option key={tp} value={tp} className="capitalize">{tp}</option>)}
          </select>
          <select className="bg-input-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={filter.assignee} onChange={(e) => setFilter((f) => ({ ...f, assignee: e.target.value }))}>
            <option value="All">All Assignees</option>
            {memberNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {sprintNames.length > 0 && (
            <select className="bg-input-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={filter.sprintId} onChange={(e) => setFilter((f) => ({ ...f, sprintId: e.target.value }))}>
              <option value="All">All Sprints</option>
              {sprintNames.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <div className="flex items-center gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Pts:</span>
            <input type="number" min="0" placeholder="Min" value={filter.pointsMin} onChange={(e) => setFilter((f) => ({ ...f, pointsMin: e.target.value }))}
              className="border border-border rounded px-2 py-1.5 text-xs w-16 focus:outline-none focus:ring-1 focus:ring-primary/30" />
            <span className="text-muted-foreground">–</span>
            <input type="number" min="0" placeholder="Max" value={filter.pointsMax} onChange={(e) => setFilter((f) => ({ ...f, pointsMax: e.target.value }))}
              className="border border-border rounded px-2 py-1.5 text-xs w-16 focus:outline-none focus:ring-1 focus:ring-primary/30" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {savedViews.length > 0 && (
              <select onChange={(e) => {
                const v = savedViews.find((sv) => sv.id === e.target.value);
                if (v) setFilter(v.filters);
              }} className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" defaultValue="">
                <option value="">Saved Views</option>
                {savedViews.map((sv) => <option key={sv.id} value={sv.id}>{sv.name}</option>)}
              </select>
            )}
            <div className="relative">
              <button onClick={() => setShowSaveViewInput(true)}
                className="text-xs px-2.5 py-1.5 border rounded-lg hover:bg-muted flex items-center gap-1">
                <Download size={12} /> Save View
              </button>
              {showSaveViewInput && (
                <div className="absolute right-0 top-8 bg-white border rounded-lg shadow-lg p-3 z-20 w-52">
                  <input value={saveViewName} onChange={(e) => setSaveViewName(e.target.value)}
                    placeholder="View name..." autoFocus
                    className="w-full border rounded px-2 py-1.5 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  <div className="flex gap-2">
                    <button onClick={() => setShowSaveViewInput(false)} className="flex-1 text-xs border rounded py-1.5 hover:bg-muted">Cancel</button>
                    <button onClick={async () => {
                      if (!saveViewName.trim()) return;
                      const { data } = await supabase.from("pm_saved_views").insert([{
                        project_id: projectId, screen: "backlog", user_id: userEmail ?? "unknown",
                        name: saveViewName, filters: filter
                      }]).select().single();
                      if (data) setSavedViews((sv) => [...sv, { id: data.id, name: data.name, filters: data.filters }]);
                      toast.success("View saved");
                      setSaveViewName(""); setShowSaveViewInput(false);
                    }} className="flex-1 text-xs bg-indigo-600 text-white rounded py-1.5 hover:bg-indigo-700">Save</button>
                  </div>
                </div>
              )}
            </div>
            {canManage && (
              <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" /> {t("projectMgmt.addBacklogItem")}
              </button>
            )}
          </div>
        </div>
        {/* Active filter chips */}
        {Object.entries(filter).some(([k, v]) => k !== "search" && v !== "All" && v !== "") && (
          <div className="flex flex-wrap gap-1.5">
            {filter.priority !== "All" && <FilterChip label={`Priority: ${filter.priority}`} onRemove={() => setFilter((f) => ({ ...f, priority: "All" }))} />}
            {filter.status !== "All" && <FilterChip label={`Status: ${filter.status}`} onRemove={() => setFilter((f) => ({ ...f, status: "All" }))} />}
            {filter.type !== "All" && <FilterChip label={`Type: ${filter.type}`} onRemove={() => setFilter((f) => ({ ...f, type: "All" }))} />}
            {filter.assignee !== "All" && <FilterChip label={`Assignee: ${filter.assignee}`} onRemove={() => setFilter((f) => ({ ...f, assignee: "All" }))} />}
            {filter.sprintId !== "All" && <FilterChip label={`Sprint: ${filter.sprintId}`} onRemove={() => setFilter((f) => ({ ...f, sprintId: "All" }))} />}
            {filter.pointsMin !== "" && <FilterChip label={`Min pts: ${filter.pointsMin}`} onRemove={() => setFilter((f) => ({ ...f, pointsMin: "" }))} />}
            {filter.pointsMax !== "" && <FilterChip label={`Max pts: ${filter.pointsMax}`} onRemove={() => setFilter((f) => ({ ...f, pointsMax: "" }))} />}
            <button onClick={() => setFilter(DEFAULT_FILTER)}
              className="text-xs text-muted-foreground hover:text-foreground underline">Clear All</button>
          </div>
        )}
      </div>

      {/* Epic pill filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Epics:</span>
        <button onClick={() => setEpicFilter(null)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${epicFilter === null ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-background border-border hover:bg-muted'}`}>
          All
        </button>
        {epics.map(e => (
          <button key={e.id} onClick={() => setEpicFilter(epicFilter === e.id ? null : e.id)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${epicFilter === e.id ? 'text-white border-transparent' : 'bg-background border-border hover:bg-muted'}`}
            style={epicFilter === e.id ? { backgroundColor: e.color, borderColor: e.color } : {}}>
            {e.title}
          </button>
        ))}
        {canManage && (
          <button onClick={() => setShowEpicForm(true)}
            className="px-2.5 py-1 rounded-full text-xs font-medium border border-dashed hover:bg-muted transition-all">
            + Add Epic
          </button>
        )}
      </div>

      {/* Epic cards view */}
      {showEpicsView && epics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {epics.map(e => {
            const childItems = backlogItems.filter(i => i.epic_id === e.id);
            const doneItems = childItems.filter(i => i.status === 'Done').length;
            const progress = childItems.length > 0 ? Math.round((doneItems / childItems.length) * 100) : 0;
            return (
              <div key={e.id} className="bg-white border rounded-xl overflow-hidden hover:shadow-md transition-all cursor-pointer" onClick={() => { setEpicFilter(e.id); setShowEpicForm(false); }}>
                <div className="h-1.5" style={{ backgroundColor: e.color }} />
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm flex-1 truncate">{e.title}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${e.status === 'Done' ? 'bg-green-100 text-green-700' : e.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : e.status === 'On Hold' ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>{e.status}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{childItems.length} items</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: e.color }} />
                    </div>
                  </div>
                  {(e.start_date || e.end_date) && (
                    <p className="text-xs text-muted-foreground">{e.start_date ?? '—'} → {e.end_date ?? '—'}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loading && <InlineLoader />}

      {backlogItems.length === 0 && !loading && (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <ListChecks className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">{t("projectMgmt.noBacklogItems")}</p>
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && !loading && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="w-[60px] px-3 py-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                  <th className="w-[80px] px-3 py-3 text-left text-xs font-medium text-muted-foreground">ID</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Title</th>
                  <th className="w-[100px] px-3 py-3 text-left text-xs font-medium text-muted-foreground">Priority</th>
                  <th className="w-[120px] px-3 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="w-[70px] px-3 py-3 text-left text-xs font-medium text-muted-foreground">Pts</th>
                  <th className="w-[130px] px-3 py-3 text-left text-xs font-medium text-muted-foreground">Sprint</th>
                  <th className="w-[130px] px-3 py-3 text-left text-xs font-medium text-muted-foreground">Assignee</th>
                  <th className="w-[90px] px-3 py-3 text-left text-xs font-medium text-muted-foreground">Links</th>
                  <th className="w-[40px] px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => (
                  <tr key={item.id} className={`hover:bg-muted/40 transition-colors ${BACKLOG_PRIORITY_BORDER[item.priority] ?? ""}`}>
                    <td className="px-3 py-2.5"><BacklogTypeIcon type={item.type} /></td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{item.itemId ?? item.id.slice(0, 8)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-foreground text-sm">{item.title}</span>
                        {blockedItemIds.has(item.id) && (
                          <span className="text-xs px-1.5 py-0.5 bg-red-50 border border-red-200 text-red-600 rounded inline-flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> Blocked
                          </span>
                        )}
                        {item.epic_id && (() => {
                          const ep = epics.find(e => e.id === item.epic_id);
                          return ep ? (
                            <span className="text-xs px-1.5 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: ep.color }}>
                              {ep.title}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BACKLOG_PRIORITY_BADGE[item.priority]}`}>{item.priority}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BACKLOG_STATUS_BADGE[item.status] ?? "bg-muted text-muted-foreground"}`}>{item.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">{item.points ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[130px]">{dbSprints.find(s => s.id === item.sprint)?.name ?? (item.sprint ? item.sprint : "—")}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{item.assigneeName || "—"}</td>
                    <td className="px-3 py-2.5">
                      <LinkedTicketsBadge ids={item.linkedTicketIds ?? []} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditItem(item)} className="text-muted-foreground hover:text-blue-500" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {canManage && (
                          <button onClick={() => setConfirmDelete(item)} className="text-muted-foreground hover:text-red-500" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground text-sm">No backlog items match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kanban View */}
      {viewMode === "kanban" && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_COLS.map((col) => {
            const colItems = filtered.filter((i) => i.status === col);
            return (
              <div key={col} className="bg-muted rounded-xl p-3 min-h-[200px]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-foreground">{col}</h4>
                  <span className="text-xs text-muted-foreground bg-card rounded-full px-2 py-0.5">{colItems.length}</span>
                </div>
                <div className="space-y-2">
                  {colItems.map((item) => (
                    <div key={item.id} className="bg-card rounded-lg p-3 shadow-sm border border-border">
                      <div className="flex items-start gap-2 mb-2">
                        <BacklogTypeIcon type={item.type} />
                        <p className="text-sm font-medium text-foreground line-clamp-2 flex-1">{item.title}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BACKLOG_PRIORITY_BADGE[item.priority]}`}>{item.priority}</span>
                        {item.points && <span className="text-xs text-muted-foreground">{item.points}pt</span>}
                      </div>
                      {item.assigneeName && <p className="text-xs text-muted-foreground mt-1">{item.assigneeName}</p>}
                    </div>
                  ))}
                  {colItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddBacklogSlideOver
          sprintNames={sprintNames}
          dbSprints={dbSprints}
          memberNames={memberNames}
          epics={epics}
          projectId={projectId}
          onClose={() => setShowAdd(false)}
          onSave={async (item) => {
            try {
              const res = await fetch(`${PM_API}/backlog`, {
                method: 'POST',
                headers: apiHeaders(),
                body: JSON.stringify({
                  projectId,
                  type: item.type ?? 'story',
                  title: item.title,
                  description: item.description ?? '',
                  priority: item.priority ?? 'Medium',
                  status: 'Backlog',
                  storyPoints: item.points ?? 0,
                  sprintId: item.sprint || null,
                  assigneeName: item.assigneeName ?? '',
                  acceptanceCriteria: item.acceptanceCriteria ?? [],
                  linkedTickets: item.linkedTicketIds ?? [],
                  epicId: item.epic_id ?? null,
                }),
              });
              const json = await safeJson(res) ?? {};
              if (!res.ok) {
                toast.error(json.error ?? 'Failed to save backlog item');
              } else {
                const savedItemId = json.data?.id;
                if (savedItemId && (item.dependencies ?? []).length > 0) {
                  for (const dep of item.dependencies ?? []) {
                    await supabase.from('project_backlog_dependencies').insert([{
                      source_item_id: dep.type === 'Blocked By' ? dep.targetId : savedItemId,
                      target_item_id: dep.type === 'Blocked By' ? savedItemId : dep.targetId,
                      dependency_type: dep.type === 'Blocked By' ? 'Blocks' : dep.type,
                    }]);
                  }
                }
                await loadBacklog();
                toast.success(t("projectMgmt.backlogSaved"));
                setShowAdd(false);
              }
            } catch (err: unknown) {
              toast.error(`Failed to save backlog item: ${err instanceof Error ? err.message : String(err)}`);
            }
          }}
        />
      )}

      {editItem && (
        <AddBacklogSlideOver
          sprintNames={sprintNames}
          dbSprints={dbSprints}
          memberNames={memberNames}
          epics={epics}
          projectId={projectId}
          initialItem={editItem}
          onClose={() => setEditItem(null)}
          onSave={async (item) => {
            await handleUpdateBacklog(item, item.sprint || undefined);
          }}
        />
      )}

      {showEpicForm && (
        <AddEpicSlideOver
          projectId={projectId}
          onClose={() => setShowEpicForm(false)}
          onSave={(epic) => {
            setEpics(prev => [...prev, epic]);
            setShowEpicForm(false);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Backlog Item"
          message={`Are you sure you want to delete "${confirmDelete.title}" (${confirmDelete.itemId ?? confirmDelete.id.slice(0, 8)})? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => doDeleteBacklog(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ─── Defects Tab ──────────────────────────────────────────────────────────────

const SEVERITY_BADGE: Record<string, string> = {
  "Very High": "bg-red-100 text-red-800 border border-red-300",
  "High":      "bg-orange-100 text-orange-800 border border-orange-300",
  "Medium":    "bg-blue-100 text-blue-700 border border-blue-300",
  "Low":       "bg-muted text-muted-foreground border border-border",
};
const SEVERITY_LABEL: Record<string, string> = {
  "Very High": "Very High",
  "High":      "High",
  "Medium":    "Medium",
  "Low":       "Low",
};
const SEVERITY_ROW_BG: Record<string, string> = {
  "Very High": "bg-red-50/50",
  "High":      "bg-amber-50/50",
  "Medium":    "",
  "Low":       "",
};

const SEVERITY_DESC: Record<string, string> = {
  "Very High": "System unusable / core function completely broken",
  "High":      "Major feature broken, no workaround",
  "Medium":    "Feature partially broken, workaround exists",
  "Low":       "Cosmetic or minor impact",
};

// defect_id is now DB-generated via trigger; client uses a temp placeholder only for optimistic UI
function tempDefectId() { return `DEF-tmp-${Date.now()}`; }

interface AddDefectSlideOverProps {
  sprintNames: string[];
  memberNames: string[];
  onClose: () => void;
  onSave: (defect: Defect) => void | Promise<void>;
}

function AddDefectSlideOver({ sprintNames, memberNames, onClose, onSave }: AddDefectSlideOverProps) {
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<Defect["severity"] | "">("");
  const [status, setStatus] = useState<Defect["status"]>("Open");
  const [priority, setPriority] = useState<Defect["priority"]>("P2");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [environment, setEnvironment] = useState("QA");
  const [version, setVersion] = useState("");
  const [assigneeName, setAssigneeName] = useState("");
  const [allEmployees, setAllEmployees] = useState<string[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/directory/employees`, { headers: apiHeaders() })
      .then(r => r.json()).then(json => {
        const names = (json.data ?? []).filter((e: any) => e.status !== 'Inactive').map((e: any) => e.employee_name ?? e.fullName ?? e.name ?? "").filter(Boolean);
        if (names.length) setAllEmployees(names);
      }).catch(() => {});
  }, []);
  const [sprint, setSprint] = useState("Backlog");
  const [ticketInput, setTicketInput] = useState("");
  const [linkedTickets, setLinkedTickets] = useState<string[]>([]);
  const [screenshotName, setScreenshotName] = useState("");

  const sprintOptions = ["Backlog", ...sprintNames.filter((s) => s !== "Backlog")];

  function addStep() { setSteps((s) => [...s, ""]); }
  function setStep(i: number, v: string) { setSteps((s) => s.map((x, j) => j === i ? v : x)); }
  function removeStep(i: number) { setSteps((s) => s.filter((_, j) => j !== i)); }

  function addTicket() {
    const v = ticketInput.trim();
    if (v && !linkedTickets.includes(v)) { setLinkedTickets((t) => [...t, v]); setTicketInput(""); }
  }
  function removeTicket(id: string) { setLinkedTickets((t) => t.filter((x) => x !== id)); }

  function handleSave() {
    const defect: Defect = {
      id: tempDefectId(),
      projectId: "",
      severity: severity as Defect["severity"],
      title: title.trim(),
      description,
      status,
      priority,
      assigneeName,
      foundInVersion: version,
      sprint,
      environment,
      linkedTicketIds: linkedTickets,
      stepsToReproduce: steps.filter(Boolean),
      expectedBehavior: expected,
      actualBehavior: actual,
      createdAt: new Date().toISOString(),
      age: 0,
    };
    onSave(defect);
  }

  const canSave = title.trim().length >= 5 && severity !== "";

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[560px] bg-card border-l border-border shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h3 className="text-base font-semibold text-foreground">Add Defect</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Core */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Title *</label>
              <input className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief description of the defect" />
              {title.length > 0 && title.length < 5 && <p className="text-xs text-red-500 mt-1">Minimum 5 characters</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Severity *</label>
              <select className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" value={severity} onChange={(e) => setSeverity(e.target.value as Defect["severity"] | "")}>
                <option value="">— Select severity —</option>
                {(["Very High", "High", "Medium", "Low"] as const).map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
              </select>
              {severity && <p className="text-xs italic text-muted-foreground mt-1">{SEVERITY_DESC[severity]}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                <select className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" value={status} onChange={(e) => setStatus(e.target.value as Defect["status"])}>
                  {["Open","In Progress","Fixed","Verified","Closed","Deferred","Won't Fix","Blocked"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Priority</label>
                <select className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" value={priority} onChange={(e) => setPriority(e.target.value as Defect["priority"])}>
                  {["P1","P2","P3","P4"].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Description</label>
              <MentionTextarea className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("pm.mention.placeholder")} />
            </div>
          </div>
          {/* Steps */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Steps to Reproduce</h4>
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-5 text-right flex-shrink-0">{i + 1}.</span>
                <input className="flex-1 bg-input-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" value={s} onChange={(e) => setStep(i, e.target.value)} placeholder={`Step ${i + 1}`} />
                <button onClick={() => removeStep(i)} className="text-muted-foreground hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={addStep} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"><Plus className="w-4 h-4" /> Add Step</button>
          </div>
          {/* Expected / Actual */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Expected Behavior</label>
              <MentionTextarea className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" rows={3} value={expected} onChange={(e) => setExpected(e.target.value)} placeholder={t("pm.mention.placeholder")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Actual Behavior</label>
              <MentionTextarea className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" rows={3} value={actual} onChange={(e) => setActual(e.target.value)} placeholder={t("pm.mention.placeholder")} />
            </div>
          </div>
          {/* Meta */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Environment</label>
              <select className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                {["Development","QA","Staging","UAT","Production"].map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Build Version</label>
              <input className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g. v2.1.0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Assignee</label>
              <EmployeeSearchDropdown
                value={assigneeName}
                onChange={(name) => setAssigneeName(name)}
                placeholder="Search assignee…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Sprint</label>
              <select className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" value={sprint} onChange={(e) => setSprint(e.target.value)}>
                {sprintOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {/* Linked Tickets */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
              Linked IT Tickets
            </h4>
            <div className="flex gap-2">
              <input className="flex-1 bg-input-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" value={ticketInput} onChange={(e) => setTicketInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTicket()} placeholder="Add ticket ID (e.g. INC-1042)" />
              <button onClick={addTicket} className="px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">+ Add</button>
            </div>
            {linkedTickets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {linkedTickets.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-violet-300 text-violet-700 text-xs font-mono bg-violet-50">
                    {id}<button onClick={() => removeTicket(id)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Screenshot */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Screenshot</h4>
            <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 transition-colors text-muted-foreground text-sm">
              {screenshotName ? (
                <span className="text-foreground font-medium">{screenshotName}</span>
              ) : (
                <>
                  <span>Drop screenshot here or browse</span>
                  <span className="text-xs mt-1 opacity-70">PNG, JPG up to 5 MB</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setScreenshotName(e.target.files?.[0]?.name ?? "")} />
            </label>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-foreground border border-border rounded-lg hover:bg-muted">Cancel</button>
          <button onClick={handleSave} disabled={!canSave} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Save Defect</button>
        </div>
      </div>
    </>
  );
}

function computeLocalSLA(severity: string, createdAt: string | undefined, status: string): string {
  if (status === "Verified" || status === "Closed") return "Met";
  if (!createdAt) return "On Track";
  const fixMins: Record<string, number> = { "Very High": 480, "High": 1440, "Medium": 4320, "Low": 10080 };
  const mins = fixMins[severity] ?? 10080;
  const dueAt = new Date(createdAt).getTime() + mins * 60000;
  const now = Date.now();
  if (now > dueAt) return "Breached";
  if (dueAt - now < 60 * 60 * 1000) return "At Risk";
  return "On Track";
}

const SLA_BADGE: Record<string, string> = {
  "Met": "bg-green-100 text-green-700",
  "On Track": "bg-blue-100 text-blue-700",
  "At Risk": "bg-yellow-100 text-yellow-700",
  "Breached": "bg-red-100 text-red-700",
};

function DefectsTab({ projectId, members, sprintNames, userEmail, canManage }: { projectId: string; members: { employeeName: string }[]; sprintNames: string[]; userEmail: string; canManage: boolean }) {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [filterSeverity, setFilterSeverity] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterAssignee, setFilterAssignee] = useState("All");
  const navigate = useNavigate();

  const memberNames = members.map((m) => m.employeeName);

  const PRIORITY_FROM_DB: Record<string, Defect["priority"]> = {
    'Critical': 'P1', 'High': 'P2', 'Medium': 'P3', 'Low': 'P4',
    'P1': 'P1', 'P2': 'P2', 'P3': 'P3', 'P4': 'P4',
  };

  const loadDefects = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_defects')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) { setDefects([]); return; }
      setDefects((data ?? []).map((d: any) => ({
        id: d.defect_id ?? d.id,
        projectId: d.project_id,
        severity: d.severity ?? 'Medium',
        title: d.title ?? '',
        description: d.description ?? '',
        status: d.status ?? 'Open',
        priority: PRIORITY_FROM_DB[d.priority] ?? 'P3',
        assigneeId: d.assignee_id ?? '',
        assigneeName: d.assignee_name ?? '',
        foundInVersion: d.found_in_version ?? '',
        sprint: d.sprint_name ?? '',
        environment: d.environment ?? '',
        linkedTicketIds: d.linked_tickets ?? [],
        stepsToReproduce: d.steps_to_reproduce ?? [],
        expectedBehavior: d.expected_result ?? '',
        actualBehavior: d.actual_result ?? '',
        regressionFlag: d.is_regression ?? false,
        createdAt: d.created_at ?? '',
        _dbId: d.id,
        age: d.created_at ? Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000) : 0,
      })));
    } catch { setDefects([]); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => {
    loadDefects();
    const interval = setInterval(loadDefects, 30000);
    return () => clearInterval(interval);
  }, [loadDefects]);

  const filtered = defects.filter((d) => {
    if (filterSeverity !== "All" && d.severity !== filterSeverity) return false;
    if (filterStatus !== "All" && d.status !== filterStatus) return false;
    if (filterAssignee !== "All" && (d.assigneeName ?? "") !== filterAssignee) return false;
    return true;
  });

  const DEFECT_STATUS_BADGE: Record<string, string> = {
    "Open": "bg-muted text-muted-foreground",
    "In Progress": "bg-blue-100 text-blue-700",
    "Fixed": "bg-green-100 text-green-700",
    "Verified": "bg-teal-100 text-teal-700",
    "Closed": "bg-muted text-muted-foreground",
    "Deferred": "bg-amber-100 text-amber-700",
    "Won't Fix": "bg-muted text-muted-foreground",
    "Blocked": "bg-red-100 text-red-700",
  };

  const KANBAN_COLS = ["Open", "In Progress", "Fixed", "Verified"] as const;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button onClick={() => setViewMode("table")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <LayoutList className="w-4 h-4" /> Table
          </button>
          <button onClick={() => setViewMode("kanban")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "kanban" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Columns className="w-4 h-4" /> Kanban
          </button>
        </div>
        <select className="bg-input-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
          <option value="All">All Severities</option>
          {["Very High","High","Medium","Low"].map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
        </select>
        <select className="bg-input-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="All">All Statuses</option>
          {["Open","In Progress","Fixed","Verified","Closed","Deferred","Won't Fix","Blocked"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="bg-input-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
          <option value="All">All Assignees</option>
          {memberNames.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => navigate("/defect-tracker")}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted text-muted-foreground"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open in Defect Tracker ↗
          </button>
          {canManage && (
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> {t("projectMgmt.addDefect")}
            </button>
          )}
        </div>
      </div>

      {loading && <InlineLoader />}

      {defects.length === 0 && !loading && (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <Bug className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">{t("projectMgmt.noDefects")}</p>
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && !loading && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="w-[90px] px-3 py-3 text-left text-xs font-medium text-muted-foreground">ID</th>
                  <th className="w-[120px] px-3 py-3 text-left text-xs font-medium text-muted-foreground">Severity</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Title</th>
                  <th className="w-[120px] px-3 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="w-[130px] px-3 py-3 text-left text-xs font-medium text-muted-foreground">Assignee</th>
                  <th className="w-[110px] px-3 py-3 text-left text-xs font-medium text-muted-foreground">Found In</th>
                  <th className="w-[120px] px-3 py-3 text-left text-xs font-medium text-muted-foreground">Sprint</th>
                  <th className="w-[90px] px-3 py-3 text-left text-xs font-medium text-muted-foreground">Links</th>
                  <th className="w-[70px] px-3 py-3 text-left text-xs font-medium text-muted-foreground">Age</th>
                  <th className="w-[90px] px-3 py-3 text-left text-xs font-medium text-muted-foreground">SLA</th>
                  <th className="w-[40px] px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((d) => (
                  <tr key={d.id} className={`hover:bg-muted/40 transition-colors ${SEVERITY_ROW_BG[d.severity] ?? ""}`}>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{d.id}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_BADGE[d.severity]}`}>{SEVERITY_LABEL[d.severity]}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-foreground text-sm">{d.title}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${DEFECT_STATUS_BADGE[d.status] ?? "bg-muted text-muted-foreground"}`}>{d.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{d.assigneeName || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{d.foundInVersion ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[120px]">{d.sprint ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <LinkedTicketsBadge ids={d.linkedTicketIds ?? []} />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{d.age !== undefined ? `${d.age}d` : "—"}</td>
                    <td className="px-3 py-2.5">
                      {(() => { const s = computeLocalSLA(d.severity, d.createdAt, d.status); return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SLA_BADGE[s]}`}>{s}</span>; })()}
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={async () => {
                        const dbId = (d as any)._dbId;
                        if (dbId) await supabase.from('project_defects').delete().eq('id', dbId);
                        setDefects((prev) => prev.filter((x) => x.id !== d.id));
                      }} className="text-muted-foreground hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={11} className="px-4 py-10 text-center text-muted-foreground text-sm">No defects match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kanban View */}
      {viewMode === "kanban" && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_COLS.map((col) => {
            const colItems = filtered.filter((d) => d.status === col);
            return (
              <div key={col} className="bg-muted rounded-xl p-3 min-h-[200px]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-foreground">{col}</h4>
                  <span className="text-xs text-muted-foreground bg-card rounded-full px-2 py-0.5">{colItems.length}</span>
                </div>
                <div className="space-y-2">
                  {colItems.map((d) => (
                    <div key={d.id} className={`bg-card rounded-lg p-3 shadow-sm border border-border ${SEVERITY_ROW_BG[d.severity] ?? ""}`}>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${SEVERITY_BADGE[d.severity]}`}>{SEVERITY_LABEL[d.severity]}</span>
                        {d.age !== undefined && <span className="text-xs text-muted-foreground">{d.age}d</span>}
                      </div>
                      <p className="text-sm font-medium text-foreground line-clamp-2">{d.title}</p>
                      {d.assigneeName && <p className="text-xs text-muted-foreground mt-1">{d.assigneeName}</p>}
                    </div>
                  ))}
                  {colItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddDefectSlideOver
          sprintNames={sprintNames}
          memberNames={memberNames}
          onClose={() => setShowAdd(false)}
          onSave={async (defect) => {
            const PRIORITY_TO_DB: Record<string, string> = {
              'P1': 'Critical', 'P2': 'High', 'P3': 'Medium', 'P4': 'Low',
            };
            const ENV_MAP: Record<string, string> = {
              'Production': 'production', 'Staging': 'staging', 'UAT': 'uat',
              'QA': 'uat', 'Development': 'dev', 'dev': 'dev',
              'production': 'production', 'staging': 'staging', 'uat': 'uat',
            };
            try {
              const { error } = await supabase.from('project_defects').insert([{
                project_id: projectId,
                // defect_id assigned by DB trigger (DEF-#####)
                title: defect.title,
                severity: defect.severity,
                status: 'Open',
                priority: PRIORITY_TO_DB[defect.priority] ?? 'Medium',
                environment: ENV_MAP[defect.environment ?? ''] ?? 'uat',
                assignee_name: defect.assigneeName ?? '',
                steps_to_reproduce: defect.stepsToReproduce ?? [],
                expected_result: defect.expectedBehavior ?? '',
                actual_result: defect.actualBehavior ?? '',
                linked_tickets: defect.linkedTicketIds ?? [],
                found_in_version: defect.foundInVersion ?? '',
                sprint_name: defect.sprint ?? '',
                description: defect.description ?? '',
              }]);
              if (error) {
                toast.error(error.message);
              } else {
                await loadDefects();
                toast.success(t("projectMgmt.defectSaved"));
                setShowAdd(false);
              }
            } catch {
              toast.error("Failed to save defect — check your connection");
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Project Detail Panel ─────────────────────────────────────────────────────

interface ProjectDetailProps {
  project: Project;
  canManage: boolean;
  isAdmin: boolean;
  currentUserId: string;
  userEmail: string;
  onBack: () => void;
  onGoToDashboard?: () => void;
  onUpdateRAG: (ragStatus: string) => Promise<void>;
  onUpdateTask: (taskId: string, updates: Partial<ProjectTask>) => Promise<void>;
  onCreateTask: (data: Partial<ProjectTask>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onLogTime: (taskId: string, hours: number, type: string, desc: string, logDate: string, billable: boolean) => Promise<void>;
  onAddMember: (data: Partial<ProjectMember>) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab({ projectId, project }: { projectId: string; project: Project }) {
  const [reportTab, setReportTab] = useState<"burndown" | "velocity" | "timelog" | "budget" | "defects">("burndown");
  const { options: empOptions } = useEmployeeOptions();

  // ── Burndown state ──
  const [sprints, setSprints] = useState<any[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>("");
  const [sprintItems, setSprintItems] = useState<any[]>([]);
  const [burndownLoading, setBurndownLoading] = useState(false);

  // ── Velocity state ──
  const [allSprints, setAllSprints] = useState<any[]>([]);

  // ── Time Log state ──
  const [timeLogs, setTimeLogs] = useState<any[]>([]);
  const [tlMember, setTlMember] = useState("");
  const [tlType, setTlType] = useState("");
  const [tlFrom, setTlFrom] = useState("");
  const [tlTo, setTlTo] = useState("");
  const [tlBillable, setTlBillable] = useState<"all" | "yes" | "no">("all");

  // ── Budget state ──
  const [budgetItems, setBudgetItems] = useState<any[]>([]);

  // ── Defects state ──
  const [defects, setDefects] = useState<any[]>([]);

  // Helper: fetch via edge function (bypasses RLS)
  const pmFetch = async (path: string) => {
    const res = await fetch(`${API_BASE}/projects${path}`, {
      headers: { "Content-Type": "application/json", apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
    });
    const json = await res.json().catch(() => ({}));
    return json.data ?? [];
  };

  // Load burndown sprints
  useEffect(() => {
    if (reportTab !== "burndown") return;
    pmFetch(`/sprints?projectId=${projectId}`).then(data => {
      if (data?.length) {
        setSprints(data);
        if (!selectedSprintId) setSelectedSprintId(data[0].id);
      }
    });
  }, [projectId, reportTab]);

  useEffect(() => {
    if (!selectedSprintId) return;
    setBurndownLoading(true);
    // Fetch backlog items for sprint directly; join in component
    Promise.all([
      pmFetch(`/backlog?projectId=${projectId}`),
      fetch(`${API_BASE}/projects/sprints/${selectedSprintId}/backlog`, {
        headers: { "Content-Type": "application/json", apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
      }).then(r => r.json()).then(j => j.data ?? []).catch(() => []),
    ]).then(([backlogItems, sprintBacklog]) => {
      // Merge: attach backlog item data onto sprint_backlog rows
      const merged = (sprintBacklog.length ? sprintBacklog : []).map((sb: any) => {
        const item = backlogItems.find((b: any) => b.id === sb.backlog_item_id);
        return { ...sb, item };
      });
      setSprintItems(merged.length ? merged : backlogItems.map((b: any) => ({ item: b })));
      setBurndownLoading(false);
    });
  }, [selectedSprintId]);

  // Load velocity
  useEffect(() => {
    if (reportTab !== "velocity") return;
    pmFetch(`/sprints?projectId=${projectId}`).then(data => {
      setAllSprints((data ?? []).filter((s: any) => ["Completed", "Active"].includes(s.status))
        .sort((a: any, b: any) => (a.sprint_number ?? 0) - (b.sprint_number ?? 0)));
    });
  }, [projectId, reportTab]);

  // Load time logs via edge function
  useEffect(() => {
    if (reportTab !== "timelog") return;
    pmFetch(`/time-logs?projectId=${projectId}`).then(data => { if (data) setTimeLogs(data); });
  }, [projectId, reportTab]);

  // Load budget
  useEffect(() => {
    if (reportTab !== "budget") return;
    pmFetch(`/budget?projectId=${projectId}`).then(data => { if (data) setBudgetItems(data); });
  }, [projectId, reportTab]);

  // Load defects via direct Supabase
  useEffect(() => {
    if (reportTab !== "defects") return;
    supabase
      .from("project_defects")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .then(({ data: rows }) => { if (rows) setDefects(rows); });
  }, [projectId, reportTab]);

  // ── SVG chart helpers ──
  const W = 600, H = 220, PL = 40, PR = 16, PT = 16, PB = 32;
  const CW = W - PL - PR, CH = H - PT - PB;
  function px(val: number, total: number) { return PL + (total > 0 ? (val / total) * CW : 0); }
  function py(val: number, maxVal: number) { return PT + (1 - (maxVal > 0 ? val / maxVal : 0)) * CH; }

  // ── Burndown calculation ──
  const selectedSprint = sprints.find(s => s.id === selectedSprintId);
  const sprintDuration = selectedSprint?.duration_days ?? 14;
  const sprintStart = selectedSprint?.start_date ? new Date(selectedSprint.start_date) : new Date();
  const today = new Date();
  const dayElapsed = Math.max(0, Math.min(sprintDuration, Math.floor((today.getTime() - sprintStart.getTime()) / 86400000)));
  const totalPts = (sprintItems ?? []).reduce((sum: number, si: any) => sum + (si.item?.story_points ?? 0), 0);
  const completedPts = (sprintItems ?? []).filter((si: any) => si.item?.status === "Done").reduce((sum: number, si: any) => sum + (si.item?.story_points ?? 0), 0);
  const remainingPts = totalPts - completedPts;

  // Build actual line: for each day, estimate remaining based on completed_at
  const burndownDays = Array.from({ length: sprintDuration + 1 }, (_, d) => {
    const dayDate = new Date(sprintStart.getTime() + d * 86400000);
    const doneByDay = (sprintItems ?? []).filter((si: any) => {
      if (!si.item?.completed_at) return false;
      return new Date(si.item.completed_at) <= dayDate;
    }).reduce((sum: number, si: any) => sum + (si.item?.story_points ?? 0), 0);
    return totalPts - doneByDay;
  });

  function burndownPath(data: number[]) {
    if (data.length === 0) return "";
    return data.map((v, i) => (i === 0 ? "M" : "L") + `${px(i, sprintDuration).toFixed(1)},${py(v, totalPts).toFixed(1)}`).join(" ");
  }

  const idealPath = burndownPath([totalPts, 0].map((_, i, arr) => {
    // straight line from totalPts to 0
    if (i === 0) return totalPts;
    return 0;
  }));
  // Actually build ideal as two points
  const idealLine = totalPts > 0
    ? `M${px(0, sprintDuration).toFixed(1)},${py(totalPts, totalPts).toFixed(1)} L${px(sprintDuration, sprintDuration).toFixed(1)},${py(0, totalPts).toFixed(1)}`
    : "";

  const actualPath = burndownPath(burndownDays.slice(0, dayElapsed + 1));

  // ── Velocity calculation ──
  const avgVelocity = allSprints.length > 0
    ? Math.round(allSprints.reduce((s: number, sp: any) => s + (sp.completed_points ?? 0), 0) / allSprints.length)
    : 0;
  const rolling3 = allSprints.map((_: any, i: number) => {
    const slice = allSprints.slice(Math.max(0, i - 2), i + 1);
    return Math.round(slice.reduce((s: number, sp: any) => s + (sp.completed_points ?? 0), 0) / slice.length);
  });

  const velMaxPts = Math.max(1, ...allSprints.map((s: any) => Math.max(s.committed_points ?? 0, s.completed_points ?? 0)));
  const barW = allSprints.length > 0 ? Math.floor((CW - 8 * allSprints.length) / (allSprints.length * 2 + 1)) : 20;

  // ── Time log filtering ──
  // Fallback: derive entries from tasks with loggedHours when no DB time logs exist
  const taskDerivedLogs: any[] = timeLogs.length === 0
    ? (project.tasks ?? [])
        .filter(t => (t.loggedHours ?? 0) > 0)
        .map(t => ({
          id: `task-${t.id}`,
          task_id: t.id,
          task_title: t.title,
          employee_name: t.assigneeName ?? "",
          log_date: (t as any).completedDate ?? (t as any).closedAt ?? (t as any).createdAt?.slice(0, 10) ?? "",
          hours: t.loggedHours,
          log_type: "Development",
          billable: true,
          comment: `Logged on task: ${t.title}`,
          _derived: true,
        }))
    : [];

  const allLogs = [...timeLogs, ...taskDerivedLogs];

  const filteredLogs = allLogs.filter(l => {
    if (tlMember && l.employee_name !== tlMember) return false;
    if (tlType && l.log_type !== tlType) return false;
    if (tlFrom && l.log_date < tlFrom) return false;
    if (tlTo && l.log_date > tlTo) return false;
    if (tlBillable === "yes" && !l.billable) return false;
    if (tlBillable === "no" && l.billable) return false;
    return true;
  });

  const totalHours = filteredLogs.reduce((s: number, l: any) => s + (l.hours ?? 0), 0);
  const billableHours = filteredLogs.filter(l => l.billable).reduce((s: number, l: any) => s + (l.hours ?? 0), 0);
  const nonBillableHours = totalHours - billableHours;

  // Donut chart data
  const LOG_TYPE_COLORS: Record<string, string> = {
    Development: "#6366f1", Review: "#3b82f6", Testing: "#22c55e",
    Meeting: "#a855f7", Documentation: "#f59e0b", Other: "#9ca3af",
  };
  const logTypeTotals = Object.entries(
    timeLogs.reduce((acc: Record<string, number>, l: any) => {
      const k = l.log_type ?? "Other";
      acc[k] = (acc[k] ?? 0) + (l.hours ?? 0);
      return acc;
    }, {})
  );
  const totalLogHours = logTypeTotals.reduce((s: number, [, h]) => s + (h as number), 0);
  function donutSegments() {
    let cumAngle = -Math.PI / 2;
    const R = 60, r = 35, cx = 80, cy = 80;
    return logTypeTotals.map(([type, hrs]) => {
      const angle = totalLogHours > 0 ? ((hrs as number) / totalLogHours) * 2 * Math.PI : 0;
      const x1 = cx + R * Math.cos(cumAngle), y1 = cy + R * Math.sin(cumAngle);
      const x2 = cx + R * Math.cos(cumAngle + angle), y2 = cy + R * Math.sin(cumAngle + angle);
      const xi1 = cx + r * Math.cos(cumAngle), yi1 = cy + r * Math.sin(cumAngle);
      const xi2 = cx + r * Math.cos(cumAngle + angle), yi2 = cy + r * Math.sin(cumAngle + angle);
      const large = angle > Math.PI ? 1 : 0;
      const d = `M${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} L${xi2.toFixed(1)},${yi2.toFixed(1)} A${r},${r} 0 ${large},0 ${xi1.toFixed(1)},${yi1.toFixed(1)} Z`;
      cumAngle += angle;
      return { type, hrs, d, color: LOG_TYPE_COLORS[type] ?? "#9ca3af" };
    });
  }

  function exportTimeLogCsv() {
    const rows = filteredLogs.map((l: any) => [l.log_date, l.employee_name, l.log_type, l.hours, l.billable ? "Yes" : "No", l.comment ?? ""]);
    const csv = ["Date,Member,Type,Hours,Billable,Comment", ...rows.map((r: any[]) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "time-log.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Budget calculations ──
  const totalBudget = project.budget ?? 0;
  const totalSpent = project.spent ?? 0;
  const remaining = totalBudget - totalSpent;
  const budgetPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const budgetStart = project.startDate ? new Date(project.startDate) : today;
  const budgetEnd = project.endDate ? new Date(project.endDate) : today;
  const daysElapsed = Math.max(1, (today.getTime() - budgetStart.getTime()) / 86400000);
  const totalDays = Math.max(1, (budgetEnd.getTime() - budgetStart.getTime()) / 86400000);
  const burnRate = totalSpent / daysElapsed;
  const projected = burnRate * totalDays;

  const budgetMaxVal = Math.max(1, ...budgetItems.map((b: any) => Math.max(b.budgeted ?? 0, b.actual ?? 0)));

  // ── Defect calculations ──
  const openDefects = defects.filter((d: any) => !["Fixed", "Closed", "Resolved"].includes(d.status));
  const fixedDefects = defects.filter((d: any) => ["Fixed", "Closed", "Resolved"].includes(d.status));
  const regressionDefects = defects.filter((d: any) => d.priority === "Critical" || d.priority === "Blocker");

  // 30-day window opened vs closed
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);
  const defectDays = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(thirtyDaysAgo.getTime() + i * 86400000);
    const dStr = d.toISOString().slice(0, 10);
    const opened = defects.filter((df: any) => df.created_at?.slice(0, 10) === dStr).length;
    const closed = defects.filter((df: any) => df.updated_at?.slice(0, 10) === dStr && ["Fixed", "Closed", "Resolved"].includes(df.status)).length;
    return { dStr, opened, closed };
  });
  const maxDefects = Math.max(1, ...defectDays.map(d => Math.max(d.opened, d.closed)));

  function defectLinePath(key: "opened" | "closed") {
    return defectDays.map((d, i) => (i === 0 ? "M" : "L") + `${px(i, 29).toFixed(1)},${py(d[key], maxDefects).toFixed(1)}`).join(" ");
  }

  // Priority breakdown for defects
  const PRIORITY_DEFECT_COLORS: Record<string, string> = { Low: "#22c55e", Medium: "#eab308", High: "#f97316", Critical: "#ef4444" };
  const priorityBreakdown = ["Low", "Medium", "High", "Critical"].map(p => ({
    label: p, count: defects.filter((d: any) => d.priority === p).length, color: PRIORITY_DEFECT_COLORS[p],
  }));
  const hasRootCause = defects.some((d: any) => d.root_cause);
  const rootCauseBreakdown = hasRootCause
    ? Object.entries(defects.reduce((acc: Record<string, number>, d: any) => {
        if (d.root_cause) acc[d.root_cause] = (acc[d.root_cause] ?? 0) + 1;
        return acc;
      }, {})).map(([label, count]) => ({ label, count: count as number }))
    : [];

  const SUB_TABS = [
    { key: "burndown", label: "Burndown" },
    { key: "velocity", label: "Velocity" },
    { key: "timelog", label: "Time Log" },
    { key: "budget", label: "Budget" },
    { key: "defects", label: "Defect Trends" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Sub-tab bar */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setReportTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              reportTab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BURNDOWN ── */}
      {reportTab === "burndown" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-muted-foreground">Sprint:</label>
            <select
              value={selectedSprintId}
              onChange={e => setSelectedSprintId(e.target.value)}
              className="border rounded-md px-3 py-1.5 text-sm bg-card"
            >
              {sprints.map(s => <option key={s.id} value={s.id}>{s.name ?? `Sprint ${s.sprint_number}`}</option>)}
            </select>
          </div>
          {burndownLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : totalPts === 0 && sprintItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">No sprint items found. Select a sprint with backlog items.</div>
          ) : (
            <div className="bg-card border rounded-xl p-4">
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map(r => (
                  <line key={r} x1={PL} x2={W - PR} y1={PT + r * CH} y2={PT + r * CH} stroke="#e5e7eb" strokeWidth="1" />
                ))}
                {/* Y-axis labels */}
                {[0, 0.25, 0.5, 0.75, 1].map(r => (
                  <text key={r} x={PL - 4} y={PT + r * CH + 4} textAnchor="end" fontSize="10" fill="#6b7280">{Math.round(totalPts * (1 - r))}</text>
                ))}
                {/* X-axis labels */}
                {Array.from({ length: Math.min(sprintDuration + 1, 8) }, (_, i) => {
                  const d = Math.round(i * sprintDuration / Math.min(sprintDuration, 7));
                  return <text key={i} x={px(d, sprintDuration)} y={H - 4} textAnchor="middle" fontSize="10" fill="#6b7280">D{d}</text>;
                })}
                {/* Ideal line */}
                {idealLine && <path d={idealLine} stroke="#9ca3af" strokeWidth="2" strokeDasharray="6 3" fill="none" />}
                {/* Actual line */}
                {actualPath && <path d={actualPath} stroke="#6366f1" strokeWidth="2.5" fill="none" />}
                {/* Today marker */}
                {dayElapsed > 0 && dayElapsed <= sprintDuration && (
                  <line
                    x1={px(dayElapsed, sprintDuration)} x2={px(dayElapsed, sprintDuration)}
                    y1={PT} y2={PT + CH}
                    stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 2"
                  />
                )}
                {/* Legend */}
                <line x1={PL} y1={H - 10} x2={PL + 24} y2={H - 10} stroke="#9ca3af" strokeWidth="2" strokeDasharray="6 3" />
                <text x={PL + 28} y={H - 6} fontSize="10" fill="#6b7280">Ideal</text>
                <line x1={PL + 60} y1={H - 10} x2={PL + 84} y2={H - 10} stroke="#6366f1" strokeWidth="2.5" />
                <text x={PL + 88} y={H - 6} fontSize="10" fill="#6b7280">Actual</text>
              </svg>
            </div>
          )}
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Committed", value: totalPts, unit: "pts" },
              { label: "Completed", value: completedPts, unit: "pts" },
              { label: "Remaining", value: remainingPts, unit: "pts" },
              { label: "Day", value: `${dayElapsed}/${sprintDuration}`, unit: "" },
            ].map(s => (
              <div key={s.label} className="bg-card border rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{s.value}{s.unit && <span className="text-sm font-normal text-muted-foreground ml-1">{s.unit}</span>}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── VELOCITY ── */}
      {reportTab === "velocity" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-sm font-semibold">
              Avg Velocity: {avgVelocity} pts
            </span>
          </div>
          {allSprints.length === 0 ? (
            <div className="text-sm text-muted-foreground">No completed or active sprints found.</div>
          ) : (
            <div className="bg-card border rounded-xl p-4">
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
                {[0, 0.25, 0.5, 0.75, 1].map(r => (
                  <line key={r} x1={PL} x2={W - PR} y1={PT + r * CH} y2={PT + r * CH} stroke="#e5e7eb" strokeWidth="1" />
                ))}
                {[0, 0.25, 0.5, 0.75, 1].map(r => (
                  <text key={r} x={PL - 4} y={PT + r * CH + 4} textAnchor="end" fontSize="10" fill="#6b7280">{Math.round(velMaxPts * (1 - r))}</text>
                ))}
                {allSprints.map((sp: any, i: number) => {
                  const slotW = CW / allSprints.length;
                  const bw = Math.min(barW, 18);
                  const cx = PL + i * slotW + slotW / 2;
                  const committedH = velMaxPts > 0 ? ((sp.committed_points ?? 0) / velMaxPts) * CH : 0;
                  const completedH = velMaxPts > 0 ? ((sp.completed_points ?? 0) / velMaxPts) * CH : 0;
                  return (
                    <g key={sp.id}>
                      <rect x={cx - bw - 2} y={PT + CH - committedH} width={bw} height={committedH} fill="#9ca3af" rx="2" />
                      <rect x={cx + 2} y={PT + CH - completedH} width={bw} height={completedH} fill="#6366f1" rx="2" />
                      <text x={cx} y={H - 4} textAnchor="middle" fontSize="9" fill="#6b7280">{sp.name ?? `S${sp.sprint_number}`}</text>
                    </g>
                  );
                })}
                {/* Rolling 3 avg line */}
                {rolling3.length > 1 && (
                  <path
                    d={rolling3.map((v: number, i: number) => {
                      const slotW = CW / allSprints.length;
                      const cx = PL + i * slotW + slotW / 2;
                      return (i === 0 ? "M" : "L") + `${cx.toFixed(1)},${py(v, velMaxPts).toFixed(1)}`;
                    }).join(" ")}
                    stroke="#ef4444" strokeWidth="2" strokeDasharray="5 3" fill="none"
                  />
                )}
                {/* Legend */}
                <rect x={PL} y={H - 12} width={10} height={10} fill="#9ca3af" rx="1" />
                <text x={PL + 14} y={H - 3} fontSize="10" fill="#6b7280">Committed</text>
                <rect x={PL + 70} y={H - 12} width={10} height={10} fill="#6366f1" rx="1" />
                <text x={PL + 84} y={H - 3} fontSize="10" fill="#6b7280">Completed</text>
                <line x1={PL + 150} y1={H - 7} x2={PL + 170} y2={H - 7} stroke="#ef4444" strokeWidth="2" strokeDasharray="5 3" />
                <text x={PL + 174} y={H - 3} fontSize="10" fill="#6b7280">3-Sprint Avg</text>
              </svg>
            </div>
          )}
          {/* Sprint comparison table */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h4 className="font-medium text-sm">Sprint Comparison</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["Sprint", "Committed", "Completed", "Velocity", "Completion %"].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allSprints.map((sp: any) => {
                    const pct = sp.committed_points > 0 ? Math.round((sp.completed_points ?? 0) / sp.committed_points * 100) : 0;
                    return (
                      <tr key={sp.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium">{sp.name ?? `Sprint ${sp.sprint_number}`}</td>
                        <td className="px-4 py-2">{sp.committed_points ?? 0}</td>
                        <td className="px-4 py-2">{sp.completed_points ?? 0}</td>
                        <td className="px-4 py-2">{sp.completed_points ?? 0}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pct >= 80 ? "bg-green-100 text-green-700" : pct >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                            {pct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {allSprints.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No sprint data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TIME LOG ── */}
      {reportTab === "timelog" && (
        <div className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Hours", value: totalHours.toFixed(1) },
              { label: "Billable Hours", value: billableHours.toFixed(1) },
              { label: "Non-Billable", value: nonBillableHours.toFixed(1) },
            ].map(k => (
              <div key={k.label} className="bg-card border rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-foreground">{k.value}<span className="text-sm font-normal text-muted-foreground ml-1">h</span></div>
                <div className="text-xs text-muted-foreground mt-1">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 items-center">
            <select value={tlMember} onChange={e => setTlMember(e.target.value)} className="border rounded-md px-3 py-1.5 text-sm bg-card w-44">
              <option value="">All members</option>
              {empOptions.map(e => <option key={e.value} value={e.label}>{e.label}</option>)}
            </select>
            <select value={tlType} onChange={e => setTlType(e.target.value)} className="border rounded-md px-3 py-1.5 text-sm bg-card">
              <option value="">All types</option>
              {["Development", "Review", "Testing", "Meeting", "Documentation", "Other"].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input type="date" value={tlFrom} onChange={e => setTlFrom(e.target.value)} className="border rounded-md px-3 py-1.5 text-sm bg-card" />
            <span className="text-muted-foreground text-sm">–</span>
            <input type="date" value={tlTo} onChange={e => setTlTo(e.target.value)} className="border rounded-md px-3 py-1.5 text-sm bg-card" />
            <select value={tlBillable} onChange={e => setTlBillable(e.target.value as "all" | "yes" | "no")} className="border rounded-md px-3 py-1.5 text-sm bg-card">
              <option value="all">All</option>
              <option value="yes">Billable</option>
              <option value="no">Non-billable</option>
            </select>
            <button onClick={exportTimeLogCsv} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>

          <div className="flex gap-4 items-start">
            {/* Table */}
            <div className="flex-1 bg-card border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {["Date", "Member", "Task/Type", "Hours", "Billable", "Comment"].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((l: any, i: number) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 whitespace-nowrap">{l.log_date}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{l.employee_name ?? "—"}</td>
                        <td className="px-3 py-2"><div><span className="text-xs text-foreground">{l.task_title ?? ""}</span><span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-muted">{l.log_type ?? "—"}</span></div></td>
                        <td className="px-3 py-2 font-medium">{l.hours ?? 0}h{l._derived && <span className="ml-1 text-xs text-muted-foreground italic">(estimated)</span>}</td>
                        <td className="px-3 py-2">{l.billable ? <span className="text-green-600 font-medium">✓</span> : <span className="text-muted-foreground">✗</span>}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-xs truncate">{l.comment ?? ""}</td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground text-sm">No time log entries</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Donut chart */}
            {logTypeTotals.length > 0 && (
              <div className="bg-card border rounded-xl p-4 flex-shrink-0">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">By Type</h4>
                <svg viewBox="0 0 160 160" width="160" height="160">
                  {donutSegments().map(seg => (
                    <path key={seg.type} d={seg.d} fill={seg.color} />
                  ))}
                </svg>
                <div className="mt-2 space-y-1">
                  {logTypeTotals.map(([type, hrs]) => (
                    <div key={type} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: LOG_TYPE_COLORS[type] ?? "#9ca3af" }} />
                      <span className="text-muted-foreground truncate">{type}</span>
                      <span className="ml-auto font-medium">{(hrs as number).toFixed(1)}h</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BUDGET ── */}
      {reportTab === "budget" && (
        <div className="space-y-4">
          {/* Overview card */}
          <div className="bg-card border rounded-xl p-5">
            <h4 className="font-semibold mb-4">Budget Overview</h4>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Total Budget", value: `$${(totalBudget).toLocaleString()}`, color: "text-foreground" },
                { label: "Spent", value: `$${(totalSpent).toLocaleString()}`, color: "text-orange-600" },
                { label: "Remaining", value: `$${remaining.toLocaleString()}`, color: remaining >= 0 ? "text-green-600" : "text-red-600" },
                { label: "Burn Rate", value: `$${burnRate.toFixed(0)}/day`, color: "text-blue-600" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                </div>
              ))}
            </div>
            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Budget used: {budgetPct}%</span>
                <span>Projected: ${projected.toFixed(0)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${budgetPct > 100 ? "bg-red-500" : budgetPct > 80 ? "bg-orange-500" : "bg-indigo-500"}`}
                  style={{ width: `${Math.min(budgetPct, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          {budgetItems.length > 0 ? (
            <>
              <div className="bg-card border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b">
                  <h4 className="font-medium text-sm">Category Breakdown</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {["Category", "Budgeted", "Actual", "Variance", "% Used"].map(h => (
                          <th key={h} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {budgetItems.map((b: any) => {
                        const variance = (b.budgeted ?? 0) - (b.actual ?? 0);
                        const pctUsed = b.budgeted > 0 ? Math.round((b.actual ?? 0) / b.budgeted * 100) : 0;
                        return (
                          <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-2 font-medium">{b.category ?? b.name}</td>
                            <td className="px-4 py-2">${(b.budgeted ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-2">${(b.actual ?? 0).toLocaleString()}</td>
                            <td className={`px-4 py-2 font-medium ${variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {variance >= 0 ? "+" : ""}${variance.toLocaleString()}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${pctUsed > 100 ? "bg-red-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(pctUsed, 100)}%` }} />
                                </div>
                                <span className="text-xs">{pctUsed}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Budget vs Actual bar chart */}
              <div className="bg-card border rounded-xl p-4">
                <h4 className="text-sm font-medium mb-3">Budget vs Actual by Category</h4>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
                  {[0, 0.25, 0.5, 0.75, 1].map(r => (
                    <line key={r} x1={PL} x2={W - PR} y1={PT + r * CH} y2={PT + r * CH} stroke="#e5e7eb" strokeWidth="1" />
                  ))}
                  {[0, 0.25, 0.5, 0.75, 1].map(r => (
                    <text key={r} x={PL - 4} y={PT + r * CH + 4} textAnchor="end" fontSize="10" fill="#6b7280">${Math.round(budgetMaxVal * (1 - r)).toLocaleString()}</text>
                  ))}
                  {budgetItems.map((b: any, i: number) => {
                    const slotW = CW / budgetItems.length;
                    const bw = Math.min(16, slotW / 3);
                    const cx = PL + i * slotW + slotW / 2;
                    const budgH = budgetMaxVal > 0 ? ((b.budgeted ?? 0) / budgetMaxVal) * CH : 0;
                    const actH = budgetMaxVal > 0 ? ((b.actual ?? 0) / budgetMaxVal) * CH : 0;
                    return (
                      <g key={b.id}>
                        <rect x={cx - bw - 2} y={PT + CH - budgH} width={bw} height={budgH} fill="#9ca3af" rx="2" />
                        <rect x={cx + 2} y={PT + CH - actH} width={bw} height={actH} fill="#6366f1" rx="2" />
                        <text x={cx} y={H - 4} textAnchor="middle" fontSize="9" fill="#6b7280">{(b.category ?? b.name ?? "").slice(0, 8)}</text>
                      </g>
                    );
                  })}
                  <rect x={PL} y={H - 12} width={10} height={10} fill="#9ca3af" rx="1" />
                  <text x={PL + 14} y={H - 3} fontSize="10" fill="#6b7280">Budgeted</text>
                  <rect x={PL + 68} y={H - 12} width={10} height={10} fill="#6366f1" rx="1" />
                  <text x={PL + 82} y={H - 3} fontSize="10" fill="#6b7280">Actual</text>
                </svg>
              </div>
            </>
          ) : (
            <div className="bg-card border rounded-xl p-8 text-center text-sm text-muted-foreground">
              No budget categories configured
            </div>
          )}
        </div>
      )}

      {/* ── DEFECT TRENDS ── */}
      {reportTab === "defects" && (
        <div className="space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total", value: defects.length, color: "text-foreground" },
              { label: "Open", value: openDefects.length, color: "text-red-600" },
              { label: "Fixed", value: fixedDefects.length, color: "text-green-600" },
              { label: "Critical/Blocker", value: regressionDefects.length, color: "text-orange-600" },
            ].map(k => (
              <div key={k.label} className="bg-card border rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Opened vs Closed line chart */}
          <div className="bg-card border rounded-xl p-4">
            <h4 className="text-sm font-medium mb-3">Opened vs Closed (Last 30 Days)</h4>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
              {[0, 0.25, 0.5, 0.75, 1].map(r => (
                <line key={r} x1={PL} x2={W - PR} y1={PT + r * CH} y2={PT + r * CH} stroke="#e5e7eb" strokeWidth="1" />
              ))}
              {[0, 0.25, 0.5, 0.75, 1].map(r => (
                <text key={r} x={PL - 4} y={PT + r * CH + 4} textAnchor="end" fontSize="10" fill="#6b7280">{Math.round(maxDefects * (1 - r))}</text>
              ))}
              {[0, 7, 14, 21, 29].map(i => (
                <text key={i} x={px(i, 29)} y={H - 4} textAnchor="middle" fontSize="9" fill="#6b7280">{defectDays[i]?.dStr?.slice(5) ?? ""}</text>
              ))}
              <path d={defectLinePath("opened")} stroke="#ef4444" strokeWidth="2" fill="none" />
              <path d={defectLinePath("closed")} stroke="#22c55e" strokeWidth="2" fill="none" />
              <line x1={PL} y1={H - 10} x2={PL + 20} y2={H - 10} stroke="#ef4444" strokeWidth="2" />
              <text x={PL + 24} y={H - 6} fontSize="10" fill="#6b7280">Opened</text>
              <line x1={PL + 72} y1={H - 10} x2={PL + 92} y2={H - 10} stroke="#22c55e" strokeWidth="2" />
              <text x={PL + 96} y={H - 6} fontSize="10" fill="#6b7280">Closed</text>
            </svg>
          </div>

          {/* Root cause / priority breakdown */}
          <div className="bg-card border rounded-xl p-4">
            <h4 className="text-sm font-medium mb-3">{hasRootCause ? "Root Cause Breakdown" : "Priority Breakdown"}</h4>
            {hasRootCause ? (
              <div className="space-y-2">
                {rootCauseBreakdown.map(rc => (
                  <div key={rc.label} className="flex items-center gap-3">
                    <div className="w-32 text-sm truncate text-muted-foreground">{rc.label}</div>
                    <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${defects.length > 0 ? (rc.count / defects.length) * 100 : 0}%` }} />
                    </div>
                    <div className="w-8 text-right text-sm font-medium">{rc.count}</div>
                  </div>
                ))}
                {rootCauseBreakdown.length === 0 && <div className="text-sm text-muted-foreground">No root cause data</div>}
              </div>
            ) : (
              <div className="space-y-2">
                {priorityBreakdown.map(p => (
                  <div key={p.label} className="flex items-center gap-3">
                    <div className="w-20 text-sm text-muted-foreground">{p.label}</div>
                    <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${defects.length > 0 ? (p.count / defects.length) * 100 : 0}%`, background: p.color }} />
                    </div>
                    <div className="w-8 text-right text-sm font-medium">{p.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectDetailPanel({
  project,
  canManage,
  isAdmin: isAdminUser,
  currentUserId,
  userEmail,
  onBack,
  onGoToDashboard,
  onUpdateRAG,
  onUpdateTask,
  onCreateTask,
  onDeleteTask,
  onLogTime,
  onAddMember,
  onRemoveMember,
}: ProjectDetailProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "backlog" | "defects" | "tasks" | "team" | "milestones" | "sprints" | "risks" | "reports">("overview");
  const [sprintNames, setSprintNames] = useState<string[]>([]);
  const [sprintOptions, setSprintOptions] = useState<{ id: string; name: string }[]>([]);
  const [updatingRag, setUpdatingRag] = useState(false);
  const [ragLog, setRagLog] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<any[]>([]);

  const tasks = project.tasks ?? [];
  const members = project.members ?? [];

  const taskCounts = TASK_STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: tasks.filter((t) => t.status === s).length }),
    {} as Record<string, number>
  );

  const days = daysRemaining(project.endDate);
  const healthScore = computeHealthScore(project);
  const { label: healthLbl, color: healthColor, bg: healthBg } = healthLabel(healthScore);
  const budgetPct = project.budget ? Math.round(((project.spent ?? 0) / project.budget) * 100) : 0;

  useEffect(() => {
    if (budgetPct >= 100) toast.error("Budget exceeded! Spending is over 100%.");
    else if (budgetPct >= 90) toast.warning("Budget alert: 90% of budget used.");
    else if (budgetPct >= 70) toast.warning("Budget alert: 70% of budget used.");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Fetch real sprints for the project
  useEffect(() => {
    if (!project.id) return;
    fetch(`${API_BASE}/projects/sprints?projectId=${project.id}`, {
      headers: { "Content-Type": "application/json", apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
    }).then(r => r.json()).then(json => {
      const sprints = (json.data ?? []) as { id: string; name: string }[];
      setSprintOptions(sprints);
      setSprintNames(sprints.map(s => s.name));
    }).catch(() => {});
  }, [project.id]);

  useEffect(() => {
    supabase.from("project_rag_log").select("*").eq("project_id", project.id).order("created_at", { ascending: false }).limit(5)
      .then(({ data }) => { if (data) setRagLog(data); });
    supabase.from("project_activity_log").select("*").eq("project_id", project.id).order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => { if (data) setActivityLog(data); });
  }, [project.id]);

  async function handleRagChange(ragStatus: string) {
    setUpdatingRag(true);
    try {
      await onUpdateRAG(ragStatus);
      await supabase.from("project_rag_log").insert([{
        project_id: project.id,
        old_status: project.ragStatus,
        new_status: ragStatus,
        changed_by: userEmail ?? "unknown",
      }]);
      const { data } = await supabase.from("project_rag_log").select("*").eq("project_id", project.id).order("created_at", { ascending: false }).limit(5);
      if (data) setRagLog(data);
      if (ragStatus === "Red") {
        void notifyPM({
          projectId: project.id,
          recipientId: "admin",
          eventType: "rag_changed_red",
          title: `Project "${project.name}" RAG changed to Red`,
          body: `Changed by ${userEmail ?? "unknown"}`,
          entityType: "project",
          entityId: project.id,
        });
      }
      toast.success(t("project.ragUpdated"));
    } catch {
      toast.error(t("project.ragUpdateFailed"));
    } finally {
      setUpdatingRag(false);
    }
  }

  const TAB_LABELS: Record<string, string> = {
    overview: t("project.tabOverview"),
    backlog: t("projectMgmt.backlog"),
    defects: t("projectMgmt.defects"),
    tasks: t("project.tabTasks"),
    team: t("project.tabTeam"),
    milestones: t("project.tabMilestones"),
    sprints: t("project.tabSprints"),
    risks: t("pm.risks.title") || "Risks",
    reports: "Reports",
  };

  return (
    <div className="fixed inset-0 z-40 bg-card overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b px-6 py-4 flex items-center gap-4">
        <div className="flex items-center gap-1 text-sm text-muted-foreground flex-shrink-0">
          {onGoToDashboard && (
            <>
              <button onClick={onGoToDashboard} className="hover:text-foreground transition-colors">
                {t("projectMgmt.dashboard")}
              </button>
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
            </>
          )}
          <button onClick={onBack} className="hover:text-foreground transition-colors">
            {t("projectMgmt.projects")}
          </button>
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-foreground font-medium truncate max-w-[180px]">{project.name}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-foreground truncate">{project.name}</h2>
        </div>
        <Badge className={STATUS_COLORS[project.status] ?? "bg-gray-100 text-gray-700"}>
          {project.status}
        </Badge>
        {(() => { const hs = computeHealthScore(project); const hl = healthLabel(hs); return <span className={`text-xs font-medium px-2 py-0.5 rounded border ${hl.bg} ${hl.color}`}>{hl.label} {hs}</span>; })()}
        <ReportDefectButton
          appName="Project Management"
          featureName={project.name}
          projectId={project.id}
        />
        {canManage && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("project.rag")}:</span>
            <div className="flex gap-1">
              {RAG_STATUSES.map((r) => (
                <button
                  key={r}
                  disabled={updatingRag}
                  onClick={() => handleRagChange(r)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${RAG_COLORS[r]} ${project.ragStatus === r ? "border-gray-800 scale-110" : "border-transparent opacity-60 hover:opacity-100"}`}
                  title={r}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex gap-1 mb-6 bg-muted rounded-lg p-1 w-fit">
          {(["overview", "backlog", "defects", "tasks", "team", "milestones", "sprints", "risks", "reports"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-card rounded-xl border p-5 space-y-4">
                <h3 className="font-semibold text-foreground">{t("project.projectDetails")}</h3>
                {project.description && (
                  <p className="text-sm text-muted-foreground">{project.description}</p>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t("project.category")}</span>
                    <p className="font-medium">{project.category}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("projects.priority")}</span>
                    <p>
                      <Badge className={PRIORITY_COLORS[project.priority]}>
                        {project.priority}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("project.startDate")}</span>
                    <p className="font-medium">{project.startDate}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("project.endDate")}</span>
                    <p className="font-medium">{project.endDate}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("project.manager")}</span>
                    <p className="font-medium">{project.managerName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("projects.ragStatus")}</span>
                    <p className="flex items-center gap-1">
                      <RagDot status={project.ragStatus} />
                      {project.ragStatus}
                    </p>
                  </div>
                </div>
              </div>

              {/* Activity Log */}
              <div className="bg-card rounded-xl border p-5">
                <h4 className="font-semibold text-sm mb-3">Recent Activity</h4>
                <div className="space-y-3">
                  {activityLog.map((a: any) => (
                    <div key={a.id} className="flex gap-2 text-xs">
                      <Avatar name={a.actor_name ?? "System"} />
                      <div className="flex-1">
                        <span className="font-medium">{a.actor_name ?? "System"}</span>{" "}
                        <span className="text-muted-foreground">{a.action} {a.entity_type}</span>{" "}
                        {a.entity_title && <span className="font-medium">"{a.entity_title}"</span>}
                        {a.new_value && <span className="text-muted-foreground"> → {a.new_value}</span>}
                        <div className="text-muted-foreground mt-0.5">{formatRelativeTime(a.created_at)}</div>
                      </div>
                    </div>
                  ))}
                  {activityLog.length === 0 && <p className="text-xs text-muted-foreground">No recent activity.</p>}
                </div>
              </div>

              {/* RAG History */}
              {ragLog.length > 0 && (
                <div className="bg-card rounded-xl border p-5">
                  <h4 className="font-semibold text-sm mb-3">RAG History</h4>
                  <div className="space-y-2">
                    {ragLog.map((entry: any) => (
                      <div key={entry.id} className="flex items-center gap-2 text-xs">
                        <RagDot status={entry.new_status} />
                        <span className="font-medium">{entry.new_status}</span>
                        {entry.old_status && <span className="text-muted-foreground">(was {entry.old_status})</span>}
                        <span className="text-muted-foreground ml-auto">{formatRelativeTime(entry.created_at)}</span>
                        <span className="text-muted-foreground">by {entry.changed_by}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="bg-card rounded-xl border p-5">
                <h3 className="font-semibold text-foreground mb-4">{t("project.quickStats")}</h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(taskCounts).map(([s, n]) => (
                    <div key={s} className="flex justify-between">
                      <span className="text-muted-foreground">{s}</span>
                      <span className="font-semibold">{n}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {t("project.teamSize")}
                    </span>
                    <span className="font-semibold">{members.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {t("project.daysRemaining")}
                    </span>
                    <span className={`font-semibold ${days < 0 ? "text-red-600" : ""}`}>
                      {days < 0
                        ? `${Math.abs(days)} ${t("project.overdueCount")}`
                        : days}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-card rounded-xl border p-5">
                <h3 className="font-semibold text-foreground mb-3">{t("project.progress")}</h3>
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {project.progress}%
                </div>
                <ProgressBar value={project.progress} />
              </div>

              {/* Budget Card */}
              <div className="bg-white border rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-sm">Budget</h4>
                  <span className="text-xs text-muted-foreground">{project.budget ? `${(project as any).budgetCurrency ?? "USD"} ${(project.budget / 1000).toFixed(0)}K total` : "Not set"}</span>
                </div>
                {project.budget ? (
                  <>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Spent</span>
                        <span className="font-medium">{((project.spent ?? 0) / 1000).toFixed(0)}K ({budgetPct}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${budgetPct >= 100 ? "bg-red-500" : budgetPct >= 70 ? "bg-amber-400" : "bg-indigo-500"}`}
                          style={{ width: `${Math.min(100, budgetPct)}%` }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Remaining</span><br /><span className="font-semibold">{(((project.budget ?? 0) - (project.spent ?? 0)) / 1000).toFixed(0)}K</span></div>
                      <div><span className="text-muted-foreground">Used</span><br /><span className="font-semibold">{budgetPct}%</span></div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No budget defined.</p>
                )}
              </div>

              {/* Health Score Card */}
              <div className="bg-white border rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-sm">Health Score</h4>
                <div className={`text-2xl font-bold ${healthColor}`}>{healthScore} <span className={`text-xs font-medium px-2 py-0.5 rounded border ${healthBg} ${healthColor}`}>{healthLbl}</span></div>
                <div className="space-y-2 text-xs">
                  {[
                    { label: "Schedule", value: project.endDate && project.endDate < new Date().toISOString().split("T")[0] && project.status !== "Completed" ? 0 : 100 },
                    { label: "Scope", value: tasks.length > 0 ? Math.round((tasks.filter(t => t.status === "Done").length / tasks.length) * 100) : 100 },
                    { label: "Velocity", value: tasks.length > 0 ? Math.max(0, 100 - Math.round((tasks.filter(t => t.dueDate && t.dueDate < new Date().toISOString().split("T")[0] && t.status !== "Done").length / tasks.length) * 100)) : 100 },
                    { label: "Budget", value: project.budget ? Math.max(0, Math.round(100 - Math.max(0, ((project.spent ?? 0) - project.budget) / project.budget * 100))) : 100 },
                    { label: "Progress", value: project.progress },
                  ].map(dim => (
                    <div key={dim.label}>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-muted-foreground">{dim.label}</span>
                        <span className="font-medium">{dim.value}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${dim.value >= 80 ? "bg-green-400" : dim.value >= 60 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${dim.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Backlog */}
        {activeTab === "backlog" && (
          <BacklogTab projectId={project.id} members={members} sprintNames={sprintNames} userEmail={userEmail} canManage={canManage} />
        )}

        {/* Defects */}
        {activeTab === "defects" && (
          <DefectsTab projectId={project.id} members={members} sprintNames={sprintNames} userEmail={userEmail} canManage={canManage} />
        )}

        {/* Tasks */}
        {activeTab === "tasks" && (
          <KanbanBoard
            tasks={tasks}
            projectId={project.id}
            canManage={canManage}
            currentUserId={currentUserId}
            onCreateTask={onCreateTask}
            onUpdateTask={(taskId, updates) => onUpdateTask(taskId, updates)}
            onDeleteTask={onDeleteTask}
            onLogTime={onLogTime}
            sprintOptions={sprintOptions}
          />
        )}

        {/* Team */}
        {activeTab === "team" && (
          <TeamTab
            members={members}
            projectId={project.id}
            canManage={canManage}
            onAddMember={onAddMember}
            onRemoveMember={onRemoveMember}
          />
        )}

        {/* Milestones */}
        {activeTab === "milestones" && (
          <MilestonesTab projectId={project.id} canManage={canManage} />
        )}

        {/* Sprints */}
        {activeTab === "sprints" && (
          <SprintsTab projectId={project.id} tasks={tasks} canManage={canManage} />
        )}

        {/* Risks */}
        {activeTab === "risks" && (
          <RisksTab projectId={project.id} canManage={canManage} />
        )}

        {/* Reports */}
        {activeTab === "reports" && (
          <ReportsTab projectId={project.id} project={project} />
        )}
      </div>
    </div>
  );
}

// ─── Gantt Timeline View ──────────────────────────────────────────────────────

const GANTT_TASK_STATUS_COLORS: Record<string, string> = {
  "To Do": "bg-gray-400",
  "In Progress": "bg-blue-500",
  "In Review": "bg-purple-400",
  Done: "bg-green-500",
  Blocked: "bg-red-500",
};

const RAG_BAR_FILL: Record<string, string> = { Red: '#FEE2E2', Amber: '#FEF3C7', Green: '#DCFCE7' };
const RAG_BAR_STROKE: Record<string, string> = { Red: '#EF4444', Amber: '#F59E0B', Green: '#22C55E' };

const MILESTONE_COLORS: Record<string, string> = {
  Achieved: "text-green-600",
  Missed: "text-red-500",
  "At Risk": "text-amber-500",
  Pending: "text-blue-500",
};

function GanttTimelineView({ projects, onSelectProject }: { projects: Project[]; onSelectProject?: (p: Project) => void }) {
  const [zoom, setZoom] = useState<'month' | 'quarter' | 'year'>('month');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; project: Project } | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [milestoneTooltip, setMilestoneTooltip] = useState<{ x: number; y: number; milestone: Milestone } | null>(null);

  useEffect(() => {
    const projectIds = projects.map((p) => p.id).filter(Boolean);
    if (projectIds.length === 0) return;
    void (async () => {
      const { data } = await supabase
        .from("project_milestones")
        .select("*")
        .in("project_id", projectIds);
      if (data) setMilestones(data as Milestone[]);
    })();
  }, [projects.map((p) => p.id).join(",")]);

  function milestonesByProject(projectId: string) {
    return milestones.filter((m) => m.project_id === projectId && m.due_date);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Collect all tasks across all projects
  const allTasksWithProject = projects.flatMap((p) =>
    (p.tasks ?? []).map((t) => ({ ...t, projectName: p.name, projectStartDate: p.startDate, projectEndDate: p.endDate, projectRag: p.ragStatus ?? 'Green', projectObj: p }))
  );

  const scheduled = allTasksWithProject.filter((t) => t.dueDate);
  const unscheduled = allTasksWithProject.filter((t) => !t.dueDate);

  // Compute timeline bounds
  const allDueDates = scheduled.map((t) => new Date(t.dueDate!).getTime());
  const projectStarts = projects.filter((p) => p.startDate).map((p) => new Date(p.startDate).getTime());
  const projectEnds = projects.filter((p) => p.endDate).map((p) => new Date(p.endDate).getTime());

  const timelineStart = new Date(
    Math.min(...[...projectStarts, ...allDueDates, today.getTime() - 30 * 86400000].filter(Boolean))
  );
  timelineStart.setHours(0, 0, 0, 0);

  const timelineEnd = new Date(
    Math.max(...[...projectEnds, ...allDueDates, today.getTime() + 60 * 86400000].filter(Boolean))
  );
  timelineEnd.setHours(0, 0, 0, 0);

  const totalMs = timelineEnd.getTime() - timelineStart.getTime();
  const totalDays = totalMs / 86400000;

  function pct(date: Date) {
    return Math.max(0, Math.min(100, ((date.getTime() - timelineStart.getTime()) / totalMs) * 100));
  }

  // Build month labels
  const monthLabels: { label: string; left: number }[] = [];
  const cur = new Date(timelineStart);
  cur.setDate(1);
  while (cur <= timelineEnd) {
    monthLabels.push({
      label: cur.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      left: pct(cur),
    });
    cur.setMonth(cur.getMonth() + 1);
  }

  const todayPct = pct(today);

  if (scheduled.length === 0 && unscheduled.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">{t("project.noTimelineTasks")}</div>
    );
  }

  // Project-level bars (for projects with start+end dates)
  const projectBars = projects.filter((p) => p.startDate && p.endDate);

  return (
    <div className="space-y-2">
      {/* Zoom controls */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">Timeline</span>
        <div className="flex gap-1">
          {(['month', 'quarter', 'year'] as const).map((z) => (
            <button key={z} onClick={() => setZoom(z)}
              className={`px-3 py-1 text-xs rounded font-medium capitalize ${zoom === z ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {z}
            </button>
          ))}
        </div>
      </div>

      {/* Project bars section */}
      {projectBars.length > 0 && (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="px-4 py-2 bg-muted border-b text-xs font-medium text-muted-foreground">Projects</div>
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${Math.max(600, totalDays * 4)}px` }}>
              {projectBars.map((p) => {
                const start = new Date(p.startDate);
                const end = new Date(p.endDate);
                const left = pct(start);
                const right = pct(end);
                const width = Math.max(0.5, right - left);
                const rag = p.ragStatus ?? 'Green';
                return (
                  <div key={p.id} className="flex items-center border-b last:border-0 hover:bg-muted group">
                    <div className="w-52 shrink-0 px-4 py-2 border-r">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.progress ?? 0}% complete</p>
                    </div>
                    <div className="flex-1 relative h-10">
                      <div className="absolute top-0 bottom-0 w-px bg-red-400 z-10" style={{ left: `${todayPct}%` }} />
                      <div
                        className="absolute top-2 h-6 rounded cursor-pointer border"
                        style={{ left: `${left}%`, width: `${width}%`, backgroundColor: RAG_BAR_FILL[rag], borderColor: RAG_BAR_STROKE[rag] }}
                        title={`${p.name} · ${p.startDate} → ${p.endDate}`}
                        onClick={() => onSelectProject?.(p)}
                        onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, project: p })}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <span className="text-xs truncate font-medium px-2 hidden sm:block" style={{ color: RAG_BAR_STROKE[rag] }}>{p.name}</span>
                      </div>
                      {/* Milestone diamonds */}
                      {milestonesByProject(p.id).map((m) => {
                        const mDate = new Date(m.due_date!);
                        const mPct = pct(mDate);
                        const mStatus = milestoneStatus(m);
                        const colorClass = MILESTONE_COLORS[mStatus] ?? "text-blue-500";
                        return (
                          <div
                            key={m.id}
                            className={`absolute top-1 z-20 text-lg leading-none select-none cursor-default ${colorClass}`}
                            style={{ left: `${mPct}%`, transform: "translateX(-50%)" }}
                            onMouseEnter={(e) => setMilestoneTooltip({ x: e.clientX, y: e.clientY, milestone: m })}
                            onMouseLeave={() => setMilestoneTooltip(null)}
                          >
                            ◇
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border overflow-hidden">
        {/* Header row */}
        <div className="flex border-b bg-muted">
          <div className="w-52 shrink-0 px-4 py-3 text-xs font-medium text-muted-foreground border-r">{t("project.task")}</div>
          <div className="flex-1 relative h-10 overflow-hidden">
            {monthLabels.map((m, i) => (
              <span
                key={i}
                className="absolute top-2 text-xs text-muted-foreground font-medium"
                style={{ left: `${m.left}%`, transform: "translateX(-50%)" }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>

        {/* Gantt rows */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${Math.max(600, totalDays * 4)}px` }}>
            <div className="relative">
              {scheduled.map((task) => {
                const due = new Date(task.dueDate!);
                const projStart = task.projectStartDate ? new Date(task.projectStartDate) : null;
                const taskStart = projStart && projStart < due ? projStart : new Date(due.getTime() - 86400000);
                const left = pct(taskStart);
                const right = pct(due);
                const width = Math.max(0.5, right - left);
                const colorClass = GANTT_TASK_STATUS_COLORS[task.status] ?? "bg-gray-400";
                const rag = task.projectRag;

                return (
                  <div key={task.id} className="flex items-center border-b last:border-0 hover:bg-muted group">
                    <div className="w-52 shrink-0 px-4 py-2 border-r">
                      <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{task.assigneeName ?? t("project.unassigned")}</p>
                    </div>
                    <div className="flex-1 relative h-10">
                      <div
                        className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                        style={{ left: `${todayPct}%` }}
                      />
                      <div
                        className={`absolute top-2 h-6 rounded ${colorClass} opacity-90 group-hover:opacity-100 flex items-center px-2 cursor-pointer border`}
                        style={{ left: `${left}%`, width: `${width}%`, borderColor: RAG_BAR_STROKE[rag] }}
                        title={`${task.title} · Due ${task.dueDate} · ${task.status}`}
                        onClick={() => onSelectProject?.(task.projectObj)}
                        onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, project: task.projectObj })}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <span className="text-white text-xs truncate font-medium hidden sm:block">{task.title}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Unscheduled section */}
        {unscheduled.length > 0 && (
          <div className="border-t">
            <div className="px-4 py-2 bg-muted text-xs font-medium text-muted-foreground">
              {t("project.unscheduled").replace("{count}", String(unscheduled.length))}
            </div>
            {unscheduled.map((task) => (
              <div key={task.id} className="flex items-center border-b last:border-0 px-4 py-2 opacity-50">
                <span className="text-sm text-muted-foreground truncate">{task.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">— {t("project.noDueDate")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="fixed z-50 bg-white border rounded-lg shadow-lg p-3 text-xs pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 60 }}>
          <p className="font-semibold">{tooltip.project.name}</p>
          <p className="text-muted-foreground">{tooltip.project.startDate} → {tooltip.project.endDate}</p>
          <p>{tooltip.project.progress ?? 0}% complete</p>
          <p>Manager: {tooltip.project.managerName}</p>
          <div className="flex items-center gap-1 mt-1"><RagDot status={tooltip.project.ragStatus ?? 'Green'} /><span>{tooltip.project.ragStatus}</span></div>
        </div>
      )}
      {/* Milestone tooltip */}
      {milestoneTooltip && (
        <div className="fixed z-50 bg-white border rounded-lg shadow-lg p-3 text-xs pointer-events-none"
          style={{ left: milestoneTooltip.x + 12, top: milestoneTooltip.y - 60 }}>
          <p className="font-semibold">{milestoneTooltip.milestone.title}</p>
          <p className="text-muted-foreground">{t("pm.gantt.milestoneDue")}: {milestoneTooltip.milestone.due_date}</p>
          <p className={MILESTONE_COLORS[milestoneStatus(milestoneTooltip.milestone)] ?? ""}>{milestoneStatus(milestoneTooltip.milestone)}</p>
        </div>
      )}
    </div>
  );
}

// ─── Project Card (for Dashboard grid) ───────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  product_dev: '#6366F1', it_infra: '#0EA5E9', biz_process: '#10B981',
  research: '#8B5CF6', compliance: '#F59E0B', marketing: '#EC4899',
  operations: '#14B8A6', client_delivery: '#F97316', internal_tools: '#6B7280',
};

function ProjectCard({ project, onSelect }: { project: Project; onSelect: () => void }) {
  const health = computeHealthScore(project);
  const hl = healthLabel(health);
  const catColor = CATEGORY_COLORS[project.category ?? ''] ?? '#6366F1';
  const progress = project.progress ?? 0;
  return (
    <button onClick={onSelect} className="text-left w-full bg-white border rounded-xl overflow-hidden hover:shadow-md transition-all cursor-pointer group">
      <div className="h-1.5" style={{ backgroundColor: catColor }} />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{project.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{(project.category ?? '').replace(/_/g, ' ')}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <RagDot status={project.ragStatus ?? 'Green'} />
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${hl.label === 'Healthy' ? 'text-green-700 bg-green-50 border-green-200' : hl.label === 'At Risk' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200'}`}>{hl.label}</span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <ProgressBar value={progress} />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{project.managerName || 'No manager'}</span>
          <span>{project.endDate ? project.endDate.slice(0, 10) : 'No end date'}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Users size={11} />{project.members?.length ?? 0}</span>
          <span className="flex items-center gap-1"><CheckSquare size={11} />{project.tasks?.length ?? 0} tasks</span>
        </div>
      </div>
    </button>
  );
}

// ─── Dashboard View ───────────────────────────────────────────────────────────

function DashboardView({
  projects,
  currentUser,
  onSelectProject,
  onMyTasks,
}: {
  projects: Project[];
  currentUser: { id: string; name?: string; fullName?: string } | null;
  onSelectProject: (p: Project) => void;
  onMyTasks: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const allTasks = projects.flatMap((p) =>
    (p.tasks ?? []).map((t) => ({ ...t, projectName: p.name, projectId: p.id }))
  );

  const activeProjectsCount = projects.filter((p) => p.status === "Active").length;
  const tasksDueToday = allTasks.filter((t) => t.dueDate === today).length;
  const overdueCount = allTasks.filter(
    (t) => t.dueDate && t.dueDate < today && t.status !== "Done"
  ).length;
  const atRiskCount = projects.filter((p) => p.ragStatus === 'Red' || p.ragStatus === 'Amber').length;

  const userId = currentUser?.id ?? "";
  const [myTasksTab, setMyTasksTab] = useState<'today' | 'week' | 'overdue'>('week');

  const allMyTasks = allTasks.filter((t) => t.assigneeId === userId);
  const myTasksToday = allMyTasks.filter((t) => t.dueDate === today);
  const myTasksWeek = allMyTasks.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd);
  const myTasksOverdue = allMyTasks.filter((t) => t.dueDate && t.dueDate < today && t.status !== 'Done');
  const myTasksTabMap = { today: myTasksToday, week: myTasksWeek, overdue: myTasksOverdue };
  const myTasks = myTasksTabMap[myTasksTab].slice(0, 10);

  function projectProgress(p: Project) {
    const tasks = p.tasks ?? [];
    if (tasks.length === 0) return 0;
    const done = tasks.filter((t) => t.status === "Done").length;
    return Math.round((done / tasks.length) * 100);
  }

  // Team workload
  const statusOrder = ["To Do", "In Progress", "In Review", "Done", "Blocked"];
  const workloadMap = new Map<string, { name: string; counts: Record<string, number> }>();
  for (const task of allTasks) {
    if (!task.assigneeName) continue;
    if (!workloadMap.has(task.assigneeName)) {
      workloadMap.set(task.assigneeName, { name: task.assigneeName, counts: {} });
    }
    const entry = workloadMap.get(task.assigneeName)!;
    entry.counts[task.status] = (entry.counts[task.status] ?? 0) + 1;
  }
  const workload = Array.from(workloadMap.values())
    .map((w) => ({ ...w, total: Object.values(w.counts).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const WORKLOAD_COLORS: Record<string, string> = {
    "To Do": "bg-muted-foreground/30",
    "In Progress": "bg-blue-500",
    "In Review": "bg-purple-500",
    Done: "bg-green-500",
    Blocked: "bg-red-500",
  };
  const WORKLOAD_DOT: Record<string, string> = {
    "To Do": "bg-muted-foreground",
    "In Progress": "bg-blue-500",
    "In Review": "bg-purple-500",
    Done: "bg-green-500",
    Blocked: "bg-red-500",
  };

  // Burndown chart (mock seed data, 14-day sprint)
  const SPRINT_DAYS = 14;
  const TOTAL_PTS = 55;
  const actualPts = [55, 55, 50, 48, 45, 40, 38, 35, 30, 28, 22, 18, 12, 8, 5];
  const vbW = 300;
  const vbH = 180;
  const vbPL = 28;
  const vbPR = 8;
  const vbPT = 8;
  const vbPB = 28;
  const vbCW = vbW - vbPL - vbPR;
  const vbCH = vbH - vbPT - vbPB;
  function bX(day: number) { return vbPL + (day / SPRINT_DAYS) * vbCW; }
  function bY(pts: number) { return vbPT + (1 - pts / TOTAL_PTS) * vbCH; }
  const idealPoly = `${bX(0)},${bY(TOTAL_PTS)} ${bX(SPRINT_DAYS)},${bY(0)}`;
  const actualPoly = actualPts.map((p, i) => `${bX(i)},${bY(p)}`).join(" ");

  const TASK_PRIORITY_DOT: Record<string, string> = {
    Critical: "bg-red-500",
    High: "bg-orange-400",
    Medium: "bg-blue-500",
    Low: "bg-muted-foreground",
  };
  const TASK_STATUS_BADGE_SM: Record<string, string> = {
    "To Do": "bg-muted text-muted-foreground",
    "In Progress": "bg-blue-100 text-blue-700",
    "In Review": "bg-purple-100 text-purple-700",
    Done: "bg-green-100 text-green-700",
    Blocked: "bg-red-100 text-red-700",
  };
  const PROJECT_AVATAR_COLORS = ["bg-blue-500","bg-purple-500","bg-green-500","bg-orange-500","bg-pink-500"];
  function projectInitials(name: string) {
    return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  }

  const myProjects = projects.slice(0, 3);

  const activityItems = useMemo(() => {
    const items: { initials: string; action: string; time: string }[] = [];
    projects.slice(0, 10).forEach(p => {
      (p.tasks ?? []).filter(t => t.status === 'Done').slice(0, 2).forEach(t => {
        const name = t.assigneeName ?? 'Someone';
        items.push({ initials: name.slice(0, 2).toUpperCase(), action: `${name} completed '${t.title}' in ${p.name}`, time: t.completedDate ? new Date(t.completedDate).toLocaleDateString() : 'Recently' });
      });
      (p.members ?? []).slice(0, 1).forEach(m => {
        items.push({ initials: m.employeeName.slice(0, 2).toUpperCase(), action: `${m.employeeName} is on the ${p.name} team`, time: m.joinedDate ? new Date(m.joinedDate).toLocaleDateString() : '' });
      });
    });
    return items.slice(0, 5);
  }, [projects]);

  return (
    <div className="space-y-6">
      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Active Projects", value: String(activeProjectsCount), icon: Folder, bg: "bg-blue-50", color: "text-blue-600", valColor: "text-foreground" },
          { label: "Due Today", value: String(tasksDueToday), icon: Clock, bg: "bg-orange-50", color: "text-orange-600", valColor: tasksDueToday > 0 ? "text-orange-600" : "text-foreground" },
          { label: "Overdue", value: String(overdueCount), icon: AlertTriangle, bg: "bg-red-50", color: "text-red-600", valColor: overdueCount > 0 ? "text-red-600" : "text-foreground" },
          { label: "At Risk Projects", value: String(atRiskCount), icon: AlertTriangle, bg: "bg-amber-50", color: "text-amber-600", valColor: atRiskCount > 0 ? "text-amber-600" : "text-foreground" },
        ].map(({ label, value, icon: Icon, bg, color, valColor }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-lg ${bg} ${color} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-sm text-muted-foreground font-medium leading-tight">{label}</span>
            </div>
            <p className={`text-3xl font-bold ${valColor}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Row 2: My Tasks + My Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* My Tasks widget */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">My Tasks</h3>
            <button onClick={onMyTasks} className="text-xs text-blue-600 hover:underline">View All →</button>
          </div>
          {/* Tab strip */}
          <div className="flex gap-1 mb-3 border-b border-border">
            {([
              { key: 'today', label: 'Today', count: myTasksToday.length },
              { key: 'week', label: 'This Week', count: myTasksWeek.length },
              { key: 'overdue', label: 'Overdue', count: myTasksOverdue.length },
            ] as const).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setMyTasksTab(key)}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${myTasksTab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                {label} {count > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-muted">{count}</span>}
              </button>
            ))}
          </div>
          {myTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No tasks in this category</p>
          ) : (
            <div className="space-y-1">
              {myTasks.map((task) => {
                const isOverdue = !!(task.dueDate && task.dueDate < today && task.status !== "Done");
                const proj = projects.find((p) => p.id === task.projectId);
                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-2 py-2 border-b border-border last:border-0 ${isOverdue ? "border-l-2 border-l-red-400 pl-2" : ""}`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TASK_PRIORITY_DOT[task.priority] ?? "bg-muted-foreground"}`} />
                    <span className="text-sm text-foreground truncate flex-1 min-w-0">{task.title}</span>
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded flex-shrink-0 max-w-[70px] truncate">
                      {task.projectName}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${TASK_STATUS_BADGE_SM[task.status] ?? "bg-muted text-muted-foreground"}`}>
                      {task.status}
                    </span>
                    {task.dueDate && (
                      <span className={`text-xs flex-shrink-0 ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}>
                        {task.dueDate}
                      </span>
                    )}
                    {proj && (
                      <button onClick={() => onSelectProject(proj)} className="text-xs text-indigo-600 hover:text-indigo-800 flex-shrink-0">Open →</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* My Projects widget */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-semibold text-foreground">My Projects</h3>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{myProjects.length}</span>
          </div>
          <div className="space-y-3">
            {myProjects.map((p, i) => {
              const progress = projectProgress(p);
              const totalTasks = (p.tasks ?? []).length;
              const doneTasks = (p.tasks ?? []).filter((t) => t.status === "Done").length;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectProject(p)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${PROJECT_AVATAR_COLORS[i % PROJECT_AVATAR_COLORS.length]}`}>
                    {projectInitials(p.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[p.status] ?? "bg-muted text-muted-foreground"}`}>{p.status}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full mb-1">
                      <div className="h-1.5 bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{doneTasks}/{totalTasks} tasks</span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{(p.members ?? []).length}</span>
                    </div>
                  </div>
                </button>
              );
            })}
            {myProjects.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No projects found</p>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Team Workload + Sprint Burndown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Team Workload */}
        <div className="bg-card border border-border rounded-xl p-4" style={{ minHeight: 280 }}>
          <h3 className="font-semibold text-foreground mb-4">{t("projectMgmt.teamWorkload")}</h3>
          {workload.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No task data available</p>
          ) : (
            <div className="space-y-3">
              {workload.map((member) => (
                <div key={member.name} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {member.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <span className="text-xs text-foreground w-[60px] truncate flex-shrink-0">{member.name.split(" ")[0]}</span>
                  <div className="flex-1 flex h-4 rounded-full overflow-hidden bg-muted">
                    {statusOrder.map((status) => {
                      const count = member.counts[status] ?? 0;
                      if (count === 0 || member.total === 0) return null;
                      const pct = (count / member.total) * 100;
                      return (
                        <div
                          key={status}
                          title={`${status}: ${count}`}
                          className={`h-full ${WORKLOAD_COLORS[status] ?? "bg-muted"}`}
                          style={{ width: `${pct}%` }}
                        />
                      );
                    })}
                  </div>
                  <span className="text-xs text-muted-foreground w-5 text-right">{member.total}</span>
                </div>
              ))}
              <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
                {statusOrder.map((s) => (
                  <div key={s} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${WORKLOAD_DOT[s] ?? "bg-muted-foreground"}`} />
                    <span className="text-xs text-muted-foreground">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sprint Burndown */}
        <div className="bg-card border border-border rounded-xl p-4" style={{ minHeight: 280 }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">{t("projectMgmt.sprintBurndown")}</h3>
            <span className="text-xs text-muted-foreground">Sprint 12</span>
          </div>
          <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full" style={{ height: 180 }}>
            {/* Axes */}
            <line x1={vbPL} y1={vbPT} x2={vbPL} y2={vbPT + vbCH} stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
            <line x1={vbPL} y1={vbPT + vbCH} x2={vbPL + vbCW} y2={vbPT + vbCH} stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
            {/* Y-axis labels */}
            {[0, 25, 50].map((pts) => (
              <text key={pts} x={vbPL - 3} y={bY(pts) + 3} textAnchor="end" fontSize="7" fill="currentColor" opacity="0.5">{pts}</text>
            ))}
            {/* X-axis labels */}
            {[0, 7, 14].map((d) => (
              <text key={d} x={bX(d)} y={vbPT + vbCH + 11} textAnchor="middle" fontSize="7" fill="currentColor" opacity="0.5">D{d}</text>
            ))}
            {/* Ideal line (dashed) */}
            <polyline points={idealPoly} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,3" />
            {/* Actual line */}
            <polyline points={actualPoly} fill="none" stroke="#3b82f6" strokeWidth="2" />
          </svg>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1.5">
              <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,2" /></svg>
              <span className="text-xs text-muted-foreground">Ideal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="#3b82f6" strokeWidth="2" /></svg>
              <span className="text-xs text-muted-foreground">Actual</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Activity Feed */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-semibold text-foreground mb-4">{t("projectMgmt.recentActivity")}</h3>
        <div className="space-y-3">
          {activityItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
          ) : activityItems.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                {item.initials}
              </div>
              <p className="text-sm text-foreground flex-1 min-w-0">{item.action}</p>
              <span className="text-xs text-muted-foreground flex-shrink-0">{item.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Row 5: Active Projects Grid */}
      {(() => {
        const activeProjects = projects.filter((p) => p.status === "Active");
        if (activeProjects.length === 0) return null;
        return (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">Active Projects</h3>
              <span className="text-xs text-muted-foreground">{activeProjects.length} projects</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeProjects.map((p) => (
                <ProjectCard key={p.id} project={p} onSelect={() => onSelectProject(p)} />
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Enhanced My Tasks View ───────────────────────────────────────────────────

function EnhancedMyTasksView({
  projects,
  currentUser,
}: {
  projects: Project[];
  currentUser: { id: string; name?: string; fullName?: string } | null;
}) {
  const today = new Date().toISOString().split("T")[0];
  const userId = currentUser?.id ?? "";
  const userName = currentUser?.name ?? currentUser?.fullName ?? "";

  const [groupBy, setGroupBy] = useState<"project" | "dueDate" | "priority">("project");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "kanban" | "calendar">("list");
  const [calDate, setCalDate] = useState(new Date());
  const [filterProject, setFilterProject] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const allMyTasks = useMemo(() =>
    projects.flatMap((p) =>
      (p.tasks ?? [])
        .filter((t) => t.assigneeId === userId || (userName && t.assigneeName === userName))
        .map((t) => ({ ...t, projectName: p.name, projectId: p.id }))
    ),
    [projects, userId, userName]
  );

  const filteredMyTasks = useMemo(() =>
    allMyTasks.filter((t) => {
      if (filterProject && t.projectId !== filterProject) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      return true;
    }),
    [allMyTasks, filterProject, filterPriority, filterStatus]
  );

  const overdueTasks = filteredMyTasks.filter(
    (t) => t.dueDate && t.dueDate < today && t.status !== "Done"
  );

  const groupedTasks = useMemo(() => {
    if (groupBy === "project") {
      const byProject: Record<string, typeof filteredMyTasks> = {};
      filteredMyTasks.forEach((t) => {
        if (!byProject[t.projectName]) byProject[t.projectName] = [];
        byProject[t.projectName].push(t);
      });
      return byProject;
    }

    if (groupBy === "dueDate") {
      const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      const groups: Record<string, typeof filteredMyTasks> = { Overdue: [], Today: [], "This Week": [], Later: [], "No Date": [] };
      filteredMyTasks.forEach((t) => {
        if (!t.dueDate) { groups["No Date"].push(t); return; }
        if (t.dueDate < today) { groups.Overdue.push(t); return; }
        if (t.dueDate === today) { groups.Today.push(t); return; }
        if (t.dueDate <= weekEnd) { groups["This Week"].push(t); return; }
        groups.Later.push(t);
      });
      return groups;
    }

    if (groupBy === "priority") {
      const groups: Record<string, typeof filteredMyTasks> = { Critical: [], High: [], Medium: [], Low: [] };
      filteredMyTasks.forEach((t) => { (groups[t.priority] ?? groups.Low).push(t); });
      return groups;
    }

    return {} as Record<string, typeof filteredMyTasks>;
  }, [filteredMyTasks, groupBy, today]);

  // Auto-expand groups that have active tasks
  useEffect(() => {
    const expanded = new Set<string>();
    Object.entries(groupedTasks).forEach(([key, tasks]) => {
      if (tasks.some((t) => t.status !== "Done")) expanded.add(key);
    });
    setExpandedGroups(expanded);
  }, [groupBy]);

  function toggleGroup(name: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const TASK_PRIORITY_DOT: Record<string, string> = {
    Critical: "bg-red-500",
    High: "bg-orange-400",
    Medium: "bg-blue-500",
    Low: "bg-muted-foreground",
  };
  const TASK_STATUS_BADGE_SM: Record<string, string> = {
    "To Do": "bg-muted text-muted-foreground",
    "In Progress": "bg-blue-100 text-blue-700",
    "In Review": "bg-purple-100 text-purple-700",
    Done: "bg-green-100 text-green-700",
    Blocked: "bg-red-100 text-red-700",
  };

  const GROUP_HEADER_COLORS: Record<string, Record<string, string>> = {
    dueDate: {
      Overdue: "bg-red-50 border-red-200 text-red-700",
      Today: "bg-orange-50 border-orange-200 text-orange-700",
      "This Week": "bg-blue-50 border-blue-200 text-blue-700",
      Later: "bg-muted/40 border-border text-muted-foreground",
      "No Date": "bg-muted/40 border-border text-muted-foreground",
    },
    priority: {
      Critical: "bg-red-50 border-red-200 text-red-700",
      High: "bg-orange-50 border-orange-200 text-orange-700",
      Medium: "bg-blue-50 border-blue-200 text-blue-700",
      Low: "bg-muted/40 border-border text-muted-foreground",
    },
  };

  function getGroupHeaderClass(key: string) {
    if (groupBy === "project") return "bg-muted/40 border-transparent text-foreground";
    return GROUP_HEADER_COLORS[groupBy]?.[key] ?? "bg-muted/40 border-transparent text-foreground";
  }

  const groupDotColors: Record<string, string> = {
    Overdue: "bg-red-500", Today: "bg-orange-400", "This Week": "bg-blue-500",
    Later: "bg-muted-foreground", "No Date": "bg-muted-foreground",
    Critical: "bg-red-500", High: "bg-orange-400", Medium: "bg-blue-500", Low: "bg-muted-foreground",
  };

  if (allMyTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-1">{"You're all caught up!"}</h3>
        <p className="text-sm text-muted-foreground">No tasks are assigned to you across any project.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
          className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
          className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          <option value="">All Priorities</option>
          {["Critical", "High", "Medium", "Low"].map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500">
          <option value="">All Statuses</option>
          {["Todo", "In Progress", "In Review", "Done"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* GroupBy toggle + View mode toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Group by:</span>
        <div className="flex bg-muted p-1 rounded-lg gap-1">
          {(["project", "dueDate", "priority"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${groupBy === g ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {g === "project" ? "Project" : g === "dueDate" ? "Due Date" : "Priority"}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1 ml-auto">
          {(["list", "kanban", "calendar"] as const).map((m) => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`px-3 py-1 rounded text-xs font-medium capitalize transition-all ${viewMode === m ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Overdue banner (only when grouping by project in list view) */}
      {viewMode === "list" && groupBy === "project" && overdueTasks.length > 0 && (
        <div className="bg-red-50 border border-red-200 px-6 py-3 rounded-xl">
          <p className="text-sm font-semibold text-red-700 mb-2">{overdueTasks.length} Overdue Tasks</p>
          <div className="space-y-1">
            {overdueTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2 border-l-2 border-red-400 pl-2 py-0.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TASK_PRIORITY_DOT[task.priority] ?? "bg-muted-foreground"}`} />
                <span className="text-sm text-red-800 truncate flex-1">{task.title}</span>
                <span className="text-xs text-red-600 flex-shrink-0">{task.dueDate}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List view: Grouped task sections */}
      {viewMode === "list" && Object.entries(groupedTasks)
        .filter(([, tasks]) => tasks.length > 0)
        .map(([groupKey, tasks]) => {
          const isExpanded = expandedGroups.has(groupKey);
          const dotColor = groupDotColors[groupKey] ?? "bg-blue-500";
          const headerClass = getGroupHeaderClass(groupKey);
          return (
            <div key={groupKey}>
              <div
                className={`rounded-xl px-4 py-2 mb-2 flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity border ${headerClass}`}
                onClick={() => toggleGroup(groupKey)}
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
                <span className="font-medium text-sm flex-1">{groupKey}</span>
                <span className="text-xs bg-card text-muted-foreground px-2 py-0.5 rounded-full">{tasks.length}</span>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              {isExpanded && (
                <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
                  {tasks.map((task) => {
                    const isOverdue = !!(task.dueDate && task.dueDate < today && task.status !== "Done");
                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 hover:bg-muted/40 transition-colors ${isOverdue ? "border-l-2 border-l-red-400" : ""}`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TASK_PRIORITY_DOT[task.priority] ?? "bg-muted-foreground"}`} />
                        <span className="text-sm text-foreground flex-1 min-w-0 truncate">{task.title}</span>
                        {groupBy !== "project" && (
                          <span className="text-xs text-muted-foreground truncate hidden sm:inline">{task.projectName}</span>
                        )}
                        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded hidden sm:inline">task</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${TASK_STATUS_BADGE_SM[task.status] ?? "bg-muted text-muted-foreground"}`}>
                          {task.status}
                        </span>
                        {task.dueDate && (
                          <span className={`text-xs flex-shrink-0 hidden sm:inline ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}>
                            {task.dueDate}
                          </span>
                        )}
                        {task.estimatedHours !== undefined && (
                          <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:inline">{task.estimatedHours}h est.</span>
                        )}
                        <button
                          onClick={() => toast.info(t("projectMgmt.logTimeUnavailable"))}
                          className="text-xs text-muted-foreground hover:text-foreground flex-shrink-0 hidden sm:inline-flex items-center gap-1"
                        >
                          <Clock className="w-3 h-3" /> Log Time
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

      {/* Kanban view */}
      {viewMode === "kanban" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(["Todo", "In Progress", "In Review", "Done"] as const).map((col) => {
            const colTasks = filteredMyTasks.filter((task) =>
              col === "Todo" ? (task.status === "Todo" || task.status === "To Do") :
              col === "Done" ? task.status === "Done" :
              task.status === col
            );
            return (
              <div key={col} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{col}</span>
                  <span className="text-xs bg-muted rounded-full px-2">{colTasks.length}</span>
                </div>
                <div className="space-y-2 min-h-[80px]">
                  {colTasks.map((task) => (
                    <div key={task.id} className="bg-white border rounded-lg p-2.5 text-xs space-y-1.5 shadow-sm">
                      <p className="font-medium leading-snug line-clamp-2">{task.title}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">{task.projectName}</span>
                        {task.dueDate && (
                          <span className={`${task.dueDate < today && task.status !== "Done" ? "text-red-500" : "text-muted-foreground"}`}>
                            {task.dueDate}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar view */}
      {viewMode === "calendar" && (() => {
        const year = calDate.getFullYear();
        const month = calDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cells: (number | null)[] = Array(firstDay).fill(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        while (cells.length % 7 !== 0) cells.push(null);

        const tasksByDate: Record<string, typeof filteredMyTasks> = {};
        filteredMyTasks.forEach((task) => {
          if (task.dueDate) {
            if (!tasksByDate[task.dueDate]) tasksByDate[task.dueDate] = [];
            tasksByDate[task.dueDate].push(task);
          }
        });

        const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        return (
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <button onClick={() => setCalDate(new Date(year, month - 1, 1))} className="p-1 rounded hover:bg-muted"><ChevronLeft size={16} /></button>
              <span className="font-semibold">{MONTH_NAMES[month]} {year}</span>
              <button onClick={() => setCalDate(new Date(year, month + 1, 1))} className="p-1 rounded hover:bg-muted"><ChevronRight size={16} /></button>
            </div>
            <div className="grid grid-cols-7 border-b">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day, i) => {
                if (day === null) return <div key={i} className="min-h-[80px] border-r border-b bg-muted/20" />;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayTasks = tasksByDate[dateStr] ?? [];
                const isToday = dateStr === today;
                const isPast = dateStr < today;
                return (
                  <div key={i} className={`min-h-[80px] border-r border-b p-1 ${isPast && !isToday ? "bg-muted/10" : ""}`}>
                    <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? "bg-indigo-600 text-white" : "text-foreground"}`}>{day}</div>
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map((task) => (
                        <div key={task.id} className={`text-xs px-1 py-0.5 rounded truncate ${
                          task.priority === "Critical" || task.priority === "High" ? "bg-red-100 text-red-700" :
                          task.priority === "Medium" ? "bg-orange-100 text-orange-700" :
                          "bg-blue-100 text-blue-700"
                        }`} title={task.title}>{task.title}</div>
                      ))}
                      {dayTasks.length > 3 && <div className="text-xs text-muted-foreground px-1">+{dayTasks.length - 3} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Notification Preferences Modal ──────────────────────────────────────────

const NOTIF_PREF_EVENTS = [
  { key: "task_assigned", label: "pm.notifPrefs.taskAssigned" },
  { key: "rag_changed", label: "pm.notifPrefs.ragChanged" },
  { key: "risk_triggered", label: "pm.notifPrefs.riskTriggered" },
  { key: "milestone_missed", label: "pm.notifPrefs.milestoneMissed" },
  { key: "budget_alert_70", label: "pm.notifPrefs.budgetAlert70" },
  { key: "budget_alert_90", label: "pm.notifPrefs.budgetAlert90" },
  { key: "budget_alert_100", label: "pm.notifPrefs.budgetAlert100" },
  { key: "sprint_started", label: "pm.notifPrefs.sprintStarted" },
  { key: "sprint_completed", label: "pm.notifPrefs.sprintCompleted" },
] as const;

function NotificationPreferencesModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIF_PREF_EVENTS.map((e) => [e.key, true]))
  );
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("event_type, enabled")
        .eq("user_id", userId)
        .eq("app", "projects");
      if (data && data.length > 0) {
        const map: Record<string, boolean> = { ...prefs };
        for (const row of data) {
          map[row.event_type as string] = row.enabled as boolean;
        }
        setPrefs(map);
      }
      setLoaded(true);
    })();
  }, [userId]);

  async function handleSave() {
    setSaving(true);
    try {
      const rows = NOTIF_PREF_EVENTS.map((e) => ({
        user_id: userId,
        app: "projects",
        event_type: e.key,
        enabled: prefs[e.key] ?? true,
      }));
      const { error: notifPrefErr } = await supabase
        .from("notification_preferences")
        .upsert(rows, { onConflict: "user_id,app,event_type" });
      if (notifPrefErr) throw new Error(notifPrefErr.message);
      toast.success(t("pm.notifPrefs.saved"));
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={t("pm.notifPrefs.title")} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("pm.notifPrefs.subtitle")}</p>
        {!loaded ? (
          <InlineLoader />
        ) : (
          <div className="space-y-3">
            {NOTIF_PREF_EVENTS.map((e) => (
              <label key={e.key} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0 cursor-pointer">
                <span className="text-sm text-foreground">{t(e.label)}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs[e.key]}
                  onClick={() => setPrefs((p) => ({ ...p, [e.key]: !p[e.key] }))}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${prefs[e.key] ? "bg-indigo-600" : "bg-gray-300"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${prefs[e.key] ? "translate-x-4" : "translate-x-0"}`}
                  />
                </button>
              </label>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !loaded}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("pm.notifPrefs.save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type View = "list" | "board" | "mytasks" | "timeline";

export function ProjectManagementJira({
  accessToken,
  onLogout,
}: {
  accessToken: string;
  onLogout: () => void;
}) {
  const { currentUser } = useUser();
  const {
    projects,
    stats,
    loading,
    error,
    loadAll,
    createProject,
    updateProject,
    deleteProject,
    addMember,
    removeMember,
    createTask,
    updateTask,
    deleteTask,
    logTime,
    updateRAG,
  } = useProjectData();

  // Permission gates
  const secViewProjects = useSectionPermission("projects", "view_projects");
  const secCreateProject = useSectionPermission("projects", "create_project");
  const secManageTeam = useSectionPermission("projects", "manage_team");
  const secCreateTasks = useSectionPermission("projects", "create_tasks");
  const secDeleteTasks = useSectionPermission("projects", "delete_tasks");
  const secReports = useSectionPermission("projects", "reports");
  const secManageBacklog = useSectionPermission("projects", "manage_backlog");
  const secManageDefects = useSectionPermission("projects", "manage_defects");
  const secManageSprints = useSectionPermission("projects", "manage_sprints");
  const secTimeLogs = useSectionPermission("projects", "time_logs");

  const [mainView, setMainView] = useState<"dashboard" | "projects" | "mytasks">("dashboard");
  const [projectOpenedFromDashboard, setProjectOpenedFromDashboard] = useState(false);
  const [view, setView] = useState<View>("list");
  const [projectsViewMode, setProjectsViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showRagSelector, setShowRagSelector] = useState<string | null>(null);
  const [dbMethodologies, setDbMethodologies] = useState<string[]>([]);
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<{ id: string; name: string } | null>(null);
  const [deleteNameInput, setDeleteNameInput] = useState("");
  const [showNotifPrefs, setShowNotifPrefs] = useState(false);

  const role = currentUser?.primaryRole as string | undefined;
  const canManage = isManagerOrAdmin(role);
  const canAdminDelete = isAdmin(role);
  const userId = currentUser?.id ?? "";
  const userEmail = currentUser?.email ?? "";

  // SideNav badge computations
  const today = new Date().toISOString().split("T")[0];
  const currentUserName = currentUser?.name ?? currentUser?.fullName ?? "";
  const allTasks = projects.flatMap((p) => (p.tasks ?? []).map((t) => ({ ...t, projectId: p.id })));
  const myAssignedTasks = allTasks.filter((t) => t.assigneeId === userId || (currentUserName && t.assigneeName === currentUserName));
  const overdueTaskCount = myAssignedTasks.filter((t) => t.dueDate && t.dueDate < today && t.status !== "Done").length;
  const atRiskProjectCount = projects.filter((p) => p.ragStatus === "Red" || p.ragStatus === "Amber").length;

  function handleExportCSV(data: Record<string, unknown>[], filename: string) {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const rows = data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? "")).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast.success(t("projectMgmt.exportSuccess"));
  }

  useEffect(() => {
    const employeeId = currentUser?.employeeId ?? undefined;
    const userName = currentUser?.name ?? currentUser?.fullName ?? undefined;
    loadAll(userId, role, employeeId, userName);
  }, [userId, role, currentUser?.employeeId, currentUser?.name]);

  useEffect(() => {
    fetch(`${API_BASE}/master-data/project-methodologies`, { headers: apiHeaders() })
      .then((r) => r.json())
      .then((json) => {
        const names = (json.data ?? []).filter((m: any) => m.is_active).map((m: any) => m.name);
        if (names.length > 0) setDbMethodologies(names);
      })
      .catch(() => {});
  }, []);

  const methodologyOptions = dbMethodologies.length > 0 ? dbMethodologies : [...PM_METHODOLOGIES];

  // Sync selectedProject when projects change
  useEffect(() => {
    if (selectedProject) {
      const updated = projects.find((p) => p.id === selectedProject.id);
      if (updated) setSelectedProject(updated);
    }
  }, [projects]);

  async function handleCreateProject(data: Partial<Project>) {
    try {
      await createProject(data);
      toast.success(t("project.projectCreated"));
      setShowProjectForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("createProject failed:", msg, data);
      toast.error(`Failed to create project: ${msg}`);
    }
  }

  async function handleUpdateProject(id: string, data: Partial<Project>) {
    try {
      await updateProject(id, data);
      toast.success(t("project.projectUpdated"));
      setEditingProject(null);
    } catch {
      toast.error(t("project.projectUpdateFailed"));
    }
  }

  async function handleDeleteProject(id: string, name: string) {
    setDeleteConfirmProject({ id, name });
    setDeleteNameInput("");
  }

  async function confirmDeleteProject() {
    if (!deleteConfirmProject || deleteNameInput !== deleteConfirmProject.name) return;
    try {
      await deleteProject(deleteConfirmProject.id);
      toast.success(t("project.projectDeleted"));
    } catch {
      toast.error(t("project.projectDeleteFailed"));
    } finally {
      setDeleteConfirmProject(null);
      setDeleteNameInput("");
    }
  }

  // My tasks: flat list of tasks assigned to current user
  const myTasks = projects.flatMap((p) =>
    (p.tasks ?? [])
      .filter((t) => t.assigneeId === userId)
      .map((t) => ({ ...t, projectName: p.name, projectId: p.id }))
  );

  const myTasksByProject = myTasks.reduce(
    (acc, t) => {
      const pn = (t as ProjectTask & { projectName: string }).projectName;
      if (!acc[pn]) acc[pn] = [];
      acc[pn].push(t);
      return acc;
    },
    {} as Record<string, (ProjectTask & { projectName: string })[]>
  );

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground">
              {t("projects.title")}
            </h1>
          </div>
          {/* Main view toggle */}
          <div className="flex bg-muted p-1 rounded-lg gap-1">
            <button
              onClick={() => setMainView("dashboard")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${mainView === "dashboard" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t("projectMgmt.dashboard")}
            </button>
            <button
              onClick={() => setMainView("projects")}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${mainView === "projects" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t("projectMgmt.projects")}
              {atRiskProjectCount > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-medium">
                  {atRiskProjectCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setMainView("mytasks")}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${mainView === "mytasks" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t("projectMgmt.myTasks")}
              {overdueTaskCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-medium">
                  {overdueTaskCount > 99 ? "99+" : overdueTaskCount}
                </span>
              )}
            </button>
          </div>
          {secCreateProject && mainView === "projects" && (
            <button
              onClick={() => setShowProjectForm(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t("project.newProject")}</span>
            </button>
          )}
          <button
            onClick={() => setShowNotifPrefs(true)}
            title={t("pm.notifPrefs.button")}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted text-muted-foreground"
          >
            <span>⚙</span>
            <span className="hidden sm:inline text-xs">{t("pm.notifPrefs.button")}</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Dashboard View */}
        {mainView === "dashboard" && (
          <DashboardView
            projects={projects}
            currentUser={currentUser}
            onSelectProject={(p) => { setSelectedProject(p); setMainView("projects"); setProjectOpenedFromDashboard(true); }}
            onMyTasks={() => setMainView("mytasks")}
          />
        )}

        {/* Enhanced My Tasks View */}
        {mainView === "mytasks" && (
          <EnhancedMyTasksView projects={projects} currentUser={currentUser} />
        )}

        {/* Projects View */}
        {mainView === "projects" && <>
        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: t("project.totalProjects"), value: stats.total, color: "text-foreground" },
            { label: t("common.active"), value: stats.active, color: "text-blue-600" },
            { label: t("project.completed"), value: stats.completed, color: "text-green-600" },
            {
              label: t("project.overdueLabel"),
              value: stats.overdue,
              color: stats.overdue > 0 ? "text-red-600" : "text-foreground",
            },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-xl border p-4">
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Export CSV + Grid/Table toggle */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button onClick={() => setProjectsViewMode('grid')} className={`px-3 py-1.5 text-xs rounded font-medium flex items-center gap-1 ${projectsViewMode === 'grid' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <LayoutList className="w-3.5 h-3.5" /> Grid
            </button>
            <button onClick={() => setProjectsViewMode('table')} className={`px-3 py-1.5 text-xs rounded font-medium flex items-center gap-1 ${projectsViewMode === 'table' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <Columns className="w-3.5 h-3.5" /> Table
            </button>
          </div>
          <button
            onClick={() => handleExportCSV(projects.map((p) => ({ name: p.name, status: p.status, priority: p.priority, progress: p.progress, teamCount: (p.members ?? []).length, startDate: p.startDate, endDate: p.endDate })), "projects.csv")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> {t("projectMgmt.exportCsv")}
          </button>
        </div>

        {/* Projects Grid/Table quick view (outside main view switcher) */}
        {projectsViewMode === 'grid' && view === 'list' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onSelect={() => setSelectedProject(p)} />
            ))}
            {projects.length === 0 && <p className="text-sm text-muted-foreground col-span-3 text-center py-8">{t("projects.noProjects")}</p>}
          </div>
        )}
        {projectsViewMode === 'table' && view === 'list' && (
          <div className="overflow-x-auto bg-card border rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 px-3 font-medium">Name</th>
                  <th className="text-left py-2 px-3 font-medium">Category</th>
                  <th className="text-left py-2 px-3 font-medium">Status</th>
                  <th className="text-left py-2 px-3 font-medium">Health</th>
                  <th className="text-left py-2 px-3 font-medium">RAG</th>
                  <th className="text-left py-2 px-3 font-medium">Manager</th>
                  <th className="text-left py-2 px-3 font-medium">Progress</th>
                  <th className="text-left py-2 px-3 font-medium">Budget %</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const h = computeHealthScore(p);
                  const hl = healthLabel(h);
                  const budgetPct = p.budget && p.spent ? Math.round((p.spent / p.budget) * 100) : null;
                  return (
                    <tr key={p.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedProject(p)}>
                      <td className="py-2 px-3 font-medium">{p.name}</td>
                      <td className="py-2 px-3 text-muted-foreground capitalize">{(p.category ?? '').replace(/_/g, ' ')}</td>
                      <td className="py-2 px-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] ?? 'bg-muted text-muted-foreground'}`}>{p.status}</span></td>
                      <td className="py-2 px-3"><span className={`text-xs font-medium ${hl.color}`}>{hl.label}</span></td>
                      <td className="py-2 px-3"><RagDot status={p.ragStatus ?? 'Green'} /></td>
                      <td className="py-2 px-3 text-muted-foreground">{p.managerName}</td>
                      <td className="py-2 px-3 w-28"><ProgressBar value={p.progress ?? 0} /></td>
                      <td className="py-2 px-3 text-muted-foreground">{budgetPct !== null ? `${budgetPct}%` : '—'}</td>
                      <td className="py-2 px-3">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedProject(p); }} className="text-xs text-indigo-600 hover:text-indigo-800">Open</button>
                      </td>
                    </tr>
                  );
                })}
                {projects.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">{t("projects.noProjects")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* View switcher */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
          {(
            [
              { id: "list", label: t("project.viewList"), icon: LayoutList },
              { id: "board", label: t("projects.board"), icon: Columns },
              { id: "mytasks", label: t("projects.myTasks"), icon: CheckSquare },
              { id: "timeline", label: t("projects.timeline"), icon: GanttChartSquare },
            ] as { id: View; label: string; icon: React.ElementType }[]
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                view === id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <InlineLoader />
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : (
          <>
            {/* List View */}
            {view === "list" && (
              <div className="bg-card rounded-xl border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                          {t("project.projectNameCol")}
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                          {t("project.category")}
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                          {t("common.status")}
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                          {t("projects.priority")}
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                          {t("project.rag")}
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                          {t("project.manager")}
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                          {t("projects.timeline")}
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                          {t("project.progress")}
                        </th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {projects.map((project) => (
                        <tr
                          key={project.id}
                          className="group hover:bg-muted transition-colors"
                        >
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setSelectedProject(project)}
                              className="font-medium text-blue-700 hover:underline text-left"
                            >
                              {project.name}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className="bg-muted text-foreground">
                              {project.category}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={STATUS_COLORS[project.status] ?? "bg-gray-100 text-gray-700"}>
                              {project.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={PRIORITY_COLORS[project.priority]}>
                              {project.priority}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <RagDot status={project.ragStatus} />
                          </td>
                          <td className="px-4 py-3">
                            {(() => { const hs = computeHealthScore(project); const hl = healthLabel(hs); return <span className={`text-xs font-medium px-2 py-0.5 rounded border ${hl.bg} ${hl.color}`}>{hl.label}</span>; })()}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {project.managerName}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell whitespace-nowrap">
                            {project.startDate} – {project.endDate}
                          </td>
                          <td className="px-4 py-3 w-32">
                            <div className="flex items-center gap-2">
                              <ProgressBar value={project.progress} />
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {project.progress}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setSelectedProject(project)}
                                className="p-1 text-blue-500 hover:text-blue-700"
                                title={t("common.view")}
                              >
                                <Circle className="w-4 h-4" />
                              </button>
                              {canManage && (
                                <>
                                  <button
                                    onClick={() => setEditingProject(project)}
                                    className="p-1 text-muted-foreground hover:text-foreground"
                                    title={t("common.edit")}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setShowRagSelector(
                                        showRagSelector === project.id
                                          ? null
                                          : project.id
                                      )
                                    }
                                    className="p-1 text-muted-foreground hover:text-foreground relative"
                                    title={t("project.rag")}
                                  >
                                    <RagDot status={project.ragStatus} />
                                    {showRagSelector === project.id && (
                                      <div className="absolute right-0 top-6 z-20 bg-card border rounded-lg shadow-lg p-2 flex gap-2">
                                        {RAG_STATUSES.map((r) => (
                                          <button
                                            key={r}
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              try {
                                                await updateRAG(project.id, r);
                                                toast.success(t("project.ragUpdatedInline"));
                                              } catch {
                                                toast.error(t("project.failed"));
                                              }
                                              setShowRagSelector(null);
                                            }}
                                            className={`w-5 h-5 rounded-full ${RAG_COLORS[r]} ${project.ragStatus === r ? "ring-2 ring-offset-1 ring-gray-600" : ""}`}
                                            title={r}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </button>
                                </>
                              )}
                              {canAdminDelete && (
                                <button
                                  onClick={() =>
                                    handleDeleteProject(project.id, project.name)
                                  }
                                  className="p-1 text-red-400 hover:text-red-600"
                                  title={t("common.delete")}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {projects.length === 0 && (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-4 py-12 text-center text-muted-foreground"
                          >
                            {t("projects.noProjects")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Board View */}
            {view === "board" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {PROJECT_STATUSES.map((status) => {
                  const cols = projects.filter((p) => p.status === status);
                  return (
                    <div key={status} className="bg-muted rounded-xl p-3 min-h-[200px]">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-foreground">
                          {status}
                        </h4>
                        <span className="text-xs text-muted-foreground bg-gray-200 rounded-full px-2 py-0.5">
                          {cols.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {cols.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => setSelectedProject(p)}
                            className="bg-card rounded-lg p-3 shadow-sm border border-border cursor-pointer hover:shadow-md transition-shadow"
                          >
                            <p className="text-sm font-semibold text-foreground mb-2 line-clamp-2">
                              {p.name}
                            </p>
                            <div className="flex items-center gap-1 flex-wrap mb-1">
                              <Badge className={PRIORITY_COLORS[p.priority]}>
                                {p.priority}
                              </Badge>
                              {(() => { const hs = computeHealthScore(p); const hl = healthLabel(hs); return <span className={`text-xs font-medium px-2 py-0.5 rounded border ${hl.bg} ${hl.color}`}>{hl.label}</span>; })()}
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {(p.members ?? []).length}
                              </span>
                              <span>{p.endDate}</span>
                            </div>
                            <div className="mt-2">
                              <ProgressBar value={p.progress} />
                            </div>
                          </div>
                        ))}
                        {cols.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            {t("project.boardEmpty")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* My Tasks View */}
            {view === "timeline" && (
              <GanttTimelineView projects={projects} onSelectProject={(p) => setSelectedProject(p)} />
            )}

            {view === "mytasks" && (
              <div className="space-y-6">
                {Object.keys(myTasksByProject).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {t("project.noTasksAssigned")}
                  </div>
                ) : (
                  Object.entries(myTasksByProject).map(([projectName, tasks]) => (
                    <div key={projectName} className="bg-card rounded-xl border overflow-hidden">
                      <div className="px-4 py-3 bg-muted border-b">
                        <h3 className="font-semibold text-foreground">{projectName}</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted border-b">
                            <tr>
                              <th className="text-left px-4 py-2 font-medium text-muted-foreground">{t("project.task")}</th>
                              <th className="text-left px-4 py-2 font-medium text-muted-foreground">{t("projects.priority")}</th>
                              <th className="text-left px-4 py-2 font-medium text-muted-foreground">{t("common.status")}</th>
                              <th className="text-left px-4 py-2 font-medium text-muted-foreground">{t("projects.dueDate")}</th>
                              <th className="px-4 py-2" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {tasks.map((task) => (
                              <tr key={task.id} className="hover:bg-muted">
                                <td className="px-4 py-3 font-medium">{task.title}</td>
                                <td className="px-4 py-3">
                                  <Badge className={PRIORITY_COLORS[task.priority]}>
                                    {task.priority}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge className={STATUS_COLORS[task.status] ?? "bg-gray-100 text-gray-700"}>
                                    {task.status}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {task.dueDate ?? "—"}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {task.status !== "Done" && (
                                      <button
                                        onClick={async () => {
                                          try {
                                            await updateTask(task.projectId, task.id, {
                                              status: "Done",
                                            });
                                            toast.success(t("project.taskMarkedDone"));
                                          } catch {
                                            toast.error(t("project.taskUpdateFailed"));
                                          }
                                        }}
                                        className="text-xs text-green-600 hover:underline flex items-center gap-1"
                                      >
                                        <CheckSquare className="w-3.5 h-3.5" /> {t("project.markDone")}
                                      </button>
                                    )}
                                    <LogTimeButton
                                      onLog={async (h, type, desc, logDate, billable) => {
                                        await logTime(task.id, h, type, desc, { logDate, billable, projectId: task.projectId });
                                        toast.success(t("project.timeLogged"));
                                      }}
                                    />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
        </>}
      </div>

      {/* Project Detail Panel — use live project from state so task/member changes reflect immediately */}
      {selectedProject && (
        <ProjectDetailPanel
          project={projects.find(p => p.id === selectedProject.id) ?? selectedProject}
          canManage={canManage}
          isAdmin={canAdminDelete}
          currentUserId={userId}
          userEmail={userEmail}
          onBack={() => { setSelectedProject(null); setProjectOpenedFromDashboard(false); }}
          onGoToDashboard={projectOpenedFromDashboard ? () => { setSelectedProject(null); setMainView("dashboard"); setProjectOpenedFromDashboard(false); } : undefined}
          onUpdateRAG={(ragStatus) => updateRAG(selectedProject.id, ragStatus)}
          onCreateTask={async (data) => {
            await createTask(selectedProject.id, data);
            if (data.assigneeId) {
              void notifyPM({
                projectId: selectedProject.id,
                recipientId: data.assigneeId,
                eventType: "task_assigned",
                title: `You have been assigned: ${data.title ?? "a new task"}`,
                entityType: "task",
                entityId: data.assigneeId,
              });
            }
          }}
          onUpdateTask={(taskId, updates) =>
            updateTask(selectedProject.id, taskId, updates)
          }
          onDeleteTask={(taskId) => deleteTask(selectedProject.id, taskId)}
          onLogTime={(taskId, h, type, desc, logDate, billable) => logTime(taskId, h, type, desc, { logDate, billable, projectId: selectedProject?.id })}
          onAddMember={(data) => addMember(selectedProject.id, data)}
          onRemoveMember={(memberId) => removeMember(selectedProject.id, memberId)}
        />
      )}

      {/* Project Form Modal */}
      {showProjectForm && (
        <Modal title={t("project.newProject")} onClose={() => setShowProjectForm(false)}>
          <ProjectForm
            onSubmit={handleCreateProject}
            onCancel={() => setShowProjectForm(false)}
            methodologyOptions={methodologyOptions}
          />
        </Modal>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <Modal
          title={t("project.editProjectTitle").replace("{name}", editingProject.name)}
          onClose={() => setEditingProject(null)}
        >
          <ProjectForm
            initial={editingProject}
            onSubmit={(data) => handleUpdateProject(editingProject.id, data)}
            onCancel={() => setEditingProject(null)}
            methodologyOptions={methodologyOptions}
          />
        </Modal>
      )}

      {/* Delete Project Confirmation Modal */}
      {showNotifPrefs && (
        <NotificationPreferencesModal userId={userId} onClose={() => setShowNotifPrefs(false)} />
      )}

      {deleteConfirmProject && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl p-6 w-[440px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Delete Project</h3>
                <p className="text-xs text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Type <strong className="text-foreground">{deleteConfirmProject.name}</strong> to confirm deletion.
            </p>
            <input
              value={deleteNameInput}
              onChange={(e) => setDeleteNameInput(e.target.value)}
              placeholder="Type project name..."
              className="w-full bg-input-background border border-border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500/30"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDeleteConfirmProject(null); setDeleteNameInput(""); }}
                className="px-4 py-2 text-sm bg-card border border-border rounded-lg text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                disabled={deleteNameInput !== deleteConfirmProject.name}
                onClick={confirmDeleteProject}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inline log time button ───────────────────────────────────────────────────

function LogTimeButton({
  onLog,
}: {
  onLog: (hours: number, type: string, desc: string, logDate: string, billable: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
      >
        <Clock className="w-3.5 h-3.5" /> {t("project.log")}
      </button>
      {open && (
        <LogTimeModal onSubmit={onLog} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
