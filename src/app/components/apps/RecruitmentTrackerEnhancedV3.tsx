import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { InlineLoader } from '../ui/PageLoader';
import {
  Users, Briefcase, Calendar, CheckCircle, Plus, Search, Edit2, Trash2,
  ChevronRight, X, Eye, ArrowRight, FileText, Upload, Tag, Globe,
  Building2, Paperclip, Star, AlertCircle, Download, CheckSquare, Square,
  ChevronDown, MessageSquare, ShieldOff, Send, Phone, Mail, BarChart2,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { useUser } from "../../context/UserContext";
import { useSectionPermission } from "../SectionGuard";
import { useMasterData } from "../../context/MasterDataContext";
import {
  useRecruitmentData, Candidate, JobPosting, Interview, Feedback,
  CandidateAttachment, BulkUploadResult,
} from "../../hooks/useRecruitmentData";
import { t } from "../../../i18n/index";
import { SelectOptions } from '../../context/ValueHelpsContext';
import {
  RECRUITMENT_STAGES, RECRUITMENT_SOURCES, INTERVIEW_TYPES, NATIONALITIES,
} from "../../../constants/apps/recruitment";
import { DEPARTMENTS, LOCATIONS } from "../../../constants/apps/directory";
import { API_BASE, apiHeaders, safeJson, supabase } from "../../utils/constants";

// ==================== HELPERS ====================

const canEdit = (roles: string[]) => roles.some((r) => r === "admin" || r === "hr");

const STAGE_COLORS: Record<string, string> = {
  Applied: "bg-gray-100 text-gray-700",
  Screening: "bg-blue-100 text-blue-700",
  "Interview Scheduled": "bg-yellow-100 text-yellow-700",
  "Interview Done": "bg-orange-100 text-orange-700",
  "HR Round Done": "bg-purple-100 text-purple-700",
  "Offer Sent": "bg-indigo-100 text-indigo-700",
  "Offer Accepted": "bg-teal-100 text-teal-700",
  Hired: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
};

const INTERVIEW_STAGES = ["Interview Scheduled", "Interview Done", "HR Round Done"];

const STAGE_GUIDE: Record<string, { next: string; requirements: string }> = {
  Applied: { next: "Screening", requirements: "Initial review of the application" },
  Screening: { next: "Interview Scheduled", requirements: "Schedule an initial interview" },
  "Interview Scheduled": { next: "Interview Done", requirements: "Submit interview feedback before advancing" },
  "Interview Done": { next: "HR Round Done", requirements: "Submit technical assessment feedback before advancing" },
  "HR Round Done": { next: "Offer Sent", requirements: "Submit HR round feedback before advancing" },
  "Offer Sent": { next: "Offer Accepted", requirements: "Candidate must accept the offer" },
  "Offer Accepted": { next: "Hired", requirements: "Complete offer acceptance formalities" },
  Hired: { next: "—", requirements: "Onboarding initiated" },
};

// ==================== NEW MASTER DATA CONSTANTS ====================

const COMPETENCY_FRAMEWORKS = [
  "Technical Skills",
  "Communication",
  "Problem Solving",
  "Leadership",
  "Teamwork",
];

const OFFER_LETTER_TEMPLATES: { id: string; name: string; html: string }[] = [
  {
    id: "standard",
    name: "Standard",
    html: `<div style="font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:0 auto">
<h2 style="color:#1e40af">Offer of Employment</h2>
<p>Dear <strong>{name}</strong>,</p>
<p>We are pleased to offer you the position of <strong>{designation}</strong> in the <strong>{department}</strong> department at our organization.</p>
<p><strong>Compensation:</strong> {ctc} per annum</p>
<p><strong>Date of Joining:</strong> {joining_date}</p>
<p><strong>Offer valid until:</strong> {expiry_date}</p>
<p>Please confirm your acceptance by signing below or responding before the offer expiry date.</p>
<p>We look forward to welcoming you to our team.</p>
<br/><p>Sincerely,<br/>HR Department</p></div>`,
  },
  {
    id: "senior",
    name: "Senior",
    html: `<div style="font-family:Georgia,serif;padding:40px;max-width:700px;margin:0 auto;border:2px solid #1e40af">
<h2 style="color:#1e40af;text-align:center">Confidential — Letter of Offer</h2>
<p>Dear <strong>{name}</strong>,</p>
<p>Following our recent discussions, we are delighted to extend this formal offer of employment for the senior role of <strong>{designation}</strong> within the <strong>{department}</strong> team.</p>
<p><strong>Total Compensation:</strong> {ctc} per annum (all-inclusive)</p>
<p><strong>Expected Joining Date:</strong> {joining_date}</p>
<p><strong>Offer Expiry:</strong> {expiry_date}</p>
<p>This offer is subject to successful completion of background verification.</p>
<br/><p>Warm regards,<br/>HR Leadership</p></div>`,
  },
  {
    id: "executive",
    name: "Executive",
    html: `<div style="font-family:'Times New Roman',serif;padding:48px;max-width:700px;margin:0 auto;border-top:4px solid #7c3aed">
<h2 style="color:#7c3aed;letter-spacing:2px;font-size:18px">EXECUTIVE APPOINTMENT OFFER</h2>
<p>Dear <strong>{name}</strong>,</p>
<p>The Board of Directors is pleased to appoint you to the executive position of <strong>{designation}</strong> in the <strong>{department}</strong> function, effective <strong>{joining_date}</strong>.</p>
<p><strong>Compensation Package:</strong> {ctc} per annum</p>
<p><strong>Offer Expiry:</strong> {expiry_date}</p>
<p>This appointment is subject to board ratification and satisfactory background screening.</p>
<br/><p>On behalf of the Board,<br/>Chief Human Resources Officer</p></div>`,
  },
];

const REQUISITION_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const REQUISITION_STATUSES = ["draft", "submitted", "approved", "rejected", "converted"] as const;
const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Intern"] as const;

// ==================== INTERFACES ====================

interface Requisition {
  id: string;
  title: string;
  department: string;
  location: string;
  employment_type: string;
  number_of_positions: number;
  justification: string;
  priority: typeof REQUISITION_PRIORITIES[number];
  requested_by: string;
  approved_by?: string;
  status: typeof REQUISITION_STATUSES[number];
  rejection_reason?: string;
  converted_job_id?: string;
  budget_min?: string;
  budget_max?: string;
  target_start_date?: string;
  created_at?: string;
}

interface Offer {
  id: string;
  candidate_id: string;
  job_id?: string;
  offered_ctc: string;
  offered_designation: string;
  joining_date: string;
  offer_expiry_date: string;
  offer_letter_url?: string;
  status: "draft" | "sent" | "accepted" | "negotiating" | "declined" | "expired" | "revoked";
  candidate_response?: string;
  negotiated_ctc?: string;
  created_at?: string;
}

interface CommunicationLog {
  id: string;
  candidate_id: string;
  channel: string;
  direction: "inbound" | "outbound";
  subject: string;
  body: string;
  sent_by?: string;
  sent_at: string;
  attachments?: string[];
}

// ==================== ICS HELPERS ====================

function padZ(n: number): string { return String(n).padStart(2, "0"); }

function toICSDate(dateStr: string, timeStr = "09:00"): string {
  const [y, m, d] = dateStr.split("-");
  const [h, min] = timeStr.split(":");
  return `${y}${m}${d}T${h}${min}00`;
}

function addMinutesToICS(dateStr: string, timeStr: string, mins: number): string {
  const base = new Date(`${dateStr}T${timeStr || "09:00"}:00`);
  base.setMinutes(base.getMinutes() + mins);
  return `${base.getFullYear()}${padZ(base.getMonth() + 1)}${padZ(base.getDate())}T${padZ(base.getHours())}${padZ(base.getMinutes())}00`;
}

function generateICS(candidateName: string, type: string, date: string, time: string, durationStr: string, location: string, uid: string): string {
  const durationMins = parseInt(durationStr) || 60;
  const dtStart = toICSDate(date, time);
  const dtEnd = addMinutesToICS(date, time, durationMins);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HR Portal//EN",
    "BEGIN:VEVENT",
    `SUMMARY:${type} Interview - ${candidateName}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `LOCATION:${location || "TBD"}`,
    `UID:${uid}@hrportal`,
    `DESCRIPTION:${type} interview for ${candidateName}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

function downloadICS(ics: string, filename: string) {
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==================== OFFER LETTER HELPERS ====================

function fillOfferTemplate(html: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, "g"), v), html);
}

// ==================== EMPLOYEE LIST HOOK ====================
// Lightweight fetch of active employee names for interviewer / hiring-manager dropdowns.

interface EmployeeOption { id: string; name: string; designation: string }

function useEmployeeList(): EmployeeOption[] {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/directory/employees`, { headers: apiHeaders() })
      .then((r) => safeJson(r))
      .then((raw) => {
        const list: any[] = Array.isArray(raw) ? raw : (raw?.data ?? raw?.employees ?? []);
        setEmployees(
          list
            .filter((e) => e.status !== "Inactive" && e.status !== "Resigned")
            .map((e) => ({ id: e.id, name: e.name, designation: e.designation || e.job_title || "" }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      })
      .catch(() => setEmployees([]));
  }, []);
  return employees;
}

// ==================== COMBOBOX ====================
// Searchable select that falls back to free-text when no match is found.

interface ComboBoxProps {
  value: string;
  onChange: (v: string) => void;
  options: string[] | readonly string[];
  placeholder?: string;
  className?: string;
  allowFreeText?: boolean;
}

function ComboBox({ value, onChange, options, placeholder = "Select or type…", className = "", allowFreeText = true }: ComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options as string[];
    return (options as string[]).filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (v: string) => { onChange(v); setQuery(""); setOpen(false); };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className={`flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 border-border`}>
        <input
          type="text"
          className="flex-1 text-sm px-3 py-2 bg-transparent outline-none"
          placeholder={placeholder}
          value={open ? query : value}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onChange={(e) => { setQuery(e.target.value); if (allowFreeText) onChange(e.target.value); }}
          onBlur={() => { if (allowFreeText && query && !options.includes(query as never)) onChange(query); }}
        />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
          className="px-2 py-2 text-muted-foreground hover:text-foreground">
          <ChevronDown size={14} />
        </button>
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-2">
              {allowFreeText ? `Press Enter to use "${query}"` : t("recruitment.noOptionsFound")}
            </p>
          ) : (
            filtered.map((opt) => (
              <button key={opt} type="button" onMouseDown={() => select(opt)}
                className={`w-full text-left text-sm px-3 py-2.5 hover:bg-muted border-b border-border last:border-b-0 truncate ${opt === value ? "bg-blue-50 text-blue-700 font-medium" : "text-foreground"}`}>
                {opt}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ComboBox variant for employee objects (shows name + designation subtitle)
interface EmployeeComboBoxProps {
  value: string;
  onChange: (v: string) => void;
  employees: EmployeeOption[];
  placeholder?: string;
  className?: string;
}

function EmployeeComboBox({ value, onChange, employees, placeholder = "Select employee…", className = "" }: EmployeeComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(q) || e.designation.toLowerCase().includes(q));
  }, [employees, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (name: string) => { onChange(name); setQuery(""); setOpen(false); };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="flex items-center border border-border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
        <input
          type="text"
          className="flex-1 text-sm px-3 py-2 bg-transparent outline-none"
          placeholder={placeholder}
          value={open ? query : value}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); }}
        />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
          className="px-2 py-2 text-muted-foreground hover:text-foreground">
          <ChevronDown size={14} />
        </button>
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-2">
              {query ? `No employee found — press Enter to use "${query}"` : t("recruitment.noEmployeesLoaded")}
            </p>
          ) : (
            filtered.map((emp) => (
              <button key={emp.id} type="button" onMouseDown={() => select(emp.name)}
                className={`w-full text-left px-3 py-2.5 hover:bg-muted border-b border-border last:border-b-0 transition-colors ${emp.name === value ? "bg-blue-50" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-medium ${emp.name === value ? "text-blue-700" : "text-foreground"}`}>{emp.name}</p>
                  {emp.name === value && <span className="text-blue-500 text-xs">✓</span>}
                </div>
                {emp.designation && <p className="text-xs text-muted-foreground mt-0.5">{emp.designation}</p>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function nameSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (!s1 || !s2) return 0;
  let matches = 0;
  const used = new Array(s2.length).fill(false);
  for (const ch of s1) {
    const idx = s2.split("").findIndex((c, i) => !used[i] && c === ch);
    if (idx !== -1) { matches++; used[idx] = true; }
  }
  return matches / Math.max(s1.length, s2.length);
}

// ==================== SUB-COMPONENTS ====================

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number | string; color: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function StageBadge({ stage }: { stage: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[stage] ?? "bg-gray-100 text-gray-600"}`}>
      {stage}
    </span>
  );
}

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-xl p-6 max-w-sm w-full">
        <p className="text-foreground mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted">{t("cancel")}</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">{t("delete")}</button>
        </div>
      </div>
    </div>
  );
}

// ==================== SKILLS INPUT ====================

function SkillsInput({ value, onChange }: { value: string[]; onChange: (skills: string[]) => void }) {
  const [input, setInput] = useState("");

  const addSkill = () => {
    const skill = input.trim();
    if (skill && !value.includes(skill)) {
      onChange([...value, skill]);
    }
    setInput("");
  };

  const removeSkill = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-6">
        {value.map((skill, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
            {skill}
            <button type="button" onClick={() => removeSkill(i)} className="hover:text-red-500 ml-0.5"><X size={10} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(); } }}
          placeholder={t("addSkillHint")}
          className="flex-1 text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="button" onClick={addSkill}
          className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100 font-medium">
          <Tag size={14} />
        </button>
      </div>
    </div>
  );
}

// ==================== ATTACHMENTS INPUT ====================

function AttachmentsInput({ value, onChange }: { value: CandidateAttachment[]; onChange: (a: CandidateAttachment[]) => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const add = () => {
    if (!name.trim()) return;
    onChange([...value, { name: name.trim(), url: url.trim() || undefined }]);
    setName("");
    setUrl("");
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground italic">{t("noAttachments")}</p>
      )}
      {value.map((a, i) => (
        <div key={i} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
          <Paperclip size={12} className="text-muted-foreground shrink-0" />
          <span className="flex-1 text-xs text-foreground truncate">{a.name}</span>
          {a.url && (
            <a href={a.url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline shrink-0">Link</a>
          )}
          <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-red-500 ml-1">
            <X size={12} />
          </button>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder={t("attachmentName")}
          className="text-xs border border-border rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          type="url" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder={t("attachmentUrl")}
          className="text-xs border border-border rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <button type="button" onClick={add}
        className="w-full py-1.5 text-xs border border-dashed border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center justify-center gap-1">
        <Plus size={12} />{t("addAttachment")}
      </button>
    </div>
  );
}

// ==================== BULK UPLOAD MODAL ====================

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === "," && !inQuote) { result.push(cur); cur = ""; }
    else { cur += ch; }
  }
  result.push(cur);
  return result.map((s) => s.replace(/^"|"$/g, "").trim());
}

function parseCSVText(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
    return row;
  }).filter((r) => Object.values(r).some((v) => v.trim()));
}

const TEMPLATE_HEADERS = ["Name", "Email", "Phone", "Position", "Department", "Experience", "Expected Salary", "Current Company", "Notice Period", "Source", "Skills", "Nationality", "Previous Company", "Notes"];
const REQUIRED_COLS = ["Name", "Email", "Position", "Department"];

interface ParsedRow { data: Record<string, string>; errors: string[] }

function validateRow(row: Record<string, string>, index: number): ParsedRow {
  const errors: string[] = [];
  REQUIRED_COLS.forEach((col) => {
    if (!row[col]?.trim()) errors.push(`Row ${index + 2}: "${col}" is required`);
  });
  if (row.Email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.Email.trim())) {
    errors.push(`Row ${index + 2}: Invalid email format`);
  }
  return { data: row, errors };
}

interface BulkUploadModalProps {
  onClose: () => void;
  onUpload: (rows: Record<string, string>[]) => Promise<BulkUploadResult>;
}

function BulkUploadModal({ onClose, onUpload }: BulkUploadModalProps) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileError, setFileError] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const example = "John Doe,john.doe@example.com,+1-555-0100,Software Engineer,Engineering,5,75000,Acme Corp,30 days,Job Portal,\"React,TypeScript\",American,,Initial screening completed";
    const csv = TEMPLATE_HEADERS.join(",") + "\n" + example;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "candidates_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    setFileError("");
    setFileName(file.name);
    setParsedRows([]);
    setResult(null);
    try {
      let rows: Record<string, string>[];
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        rows = parseCSVText(text);
      } else {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
      }
      setParsedRows(rows.map((r, i) => validateRow(r, i)));
    } catch {
      setFileError(t("fileParseError"));
    }
  };

  const validRows = parsedRows.filter((r) => r.errors.length === 0);
  const errorRows = parsedRows.filter((r) => r.errors.length > 0);

  const handleImport = async () => {
    if (!validRows.length) return;
    setUploading(true);
    try {
      const res = await onUpload(validRows.map((r) => r.data));
      setResult(res);
      toast.success(t("bulkUploadSuccess"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-foreground">{t("bulkUploadTitle")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t("bulkUploadHint")}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {result ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-green-700">{result.successCount}</p>
                  <p className="text-xs text-green-600 mt-1">{t("rowsImported")}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-red-700">{result.failureCount}</p>
                  <p className="text-xs text-red-600 mt-1">{t("rowsFailed")}</p>
                </div>
              </div>
              {result.failed.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-600 mb-2">{t("errorRows")}</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {result.failed.map((f, i) => (
                      <div key={i} className="text-xs bg-red-50 text-red-700 rounded px-3 py-1.5">
                        Row {f.row}: {f.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.successful.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-700 mb-2">{t("recruitment.importedCandidates")}</p>
                  <div className="flex flex-wrap gap-1">
                    {result.successful.map((name, i) => (
                      <span key={i} className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">{name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex gap-3">
                <button onClick={downloadTemplate}
                  className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted">
                  <Download size={14} />{t("downloadTemplate")}
                </button>
                <button onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                  <Upload size={14} />{t("selectFile")}
                </button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
              </div>

              {fileName && (
                <p className="text-xs text-muted-foreground">
                  {t("recruitment.selected")} <span className="font-medium text-foreground">{fileName}</span>
                </p>
              )}

              {fileError && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 rounded-lg px-3 py-2 text-sm">
                  <AlertCircle size={14} />{fileError}
                </div>
              )}

              {parsedRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1.5 text-green-700">
                      <CheckSquare size={14} />{validRows.length} {t("validRows")}
                    </span>
                    {errorRows.length > 0 && (
                      <span className="flex items-center gap-1.5 text-red-600">
                        <AlertCircle size={14} />{errorRows.length} {t("errorRows")}
                      </span>
                    )}
                  </div>

                  {errorRows.length > 0 && (
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {errorRows.flatMap((r) => r.errors).map((e, i) => (
                        <p key={i} className="text-xs text-red-600">{e}</p>
                      ))}
                    </div>
                  )}

                  {validRows.length > 0 && (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="overflow-x-auto max-h-48">
                        <table className="w-full text-xs">
                          <thead className="bg-muted">
                            <tr>
                              {["Name", "Email", "Position", "Department", "Source"].map((h) => (
                                <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {validRows.slice(0, 10).map((row, i) => (
                              <tr key={i} className="border-t border-border">
                                {["Name", "Email", "Position", "Department", "Source"].map((h) => (
                                  <td key={h} className="px-3 py-1.5 text-foreground truncate max-w-32">{row.data[h]}</td>
                                ))}
                              </tr>
                            ))}
                            {validRows.length > 10 && (
                              <tr className="border-t border-border">
                                <td colSpan={5} className="px-3 py-1.5 text-muted-foreground text-center">
                                  + {validRows.length - 10} {t("recruitment.moreRows")}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-muted rounded-lg px-4 py-3">
                <p className="text-xs font-medium text-foreground mb-1">{t("recruitment.requiredColumns")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {REQUIRED_COLS.map((c) => (
                    <span key={c} className="text-xs bg-red-50 text-red-700 rounded px-2 py-0.5">{c}</span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">{t("recruitment.optionalColumns")}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-border shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">{t("cancel")}</button>
          {!result && validRows.length > 0 && (
            <button onClick={handleImport} disabled={uploading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
              {uploading
                ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />{t("uploadingFile")}</>
                : <><Upload size={14} />{t("importAll")} ({validRows.length})</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== CANDIDATE FORM ====================

interface CandidateFormProps {
  initial?: Partial<Candidate>;
  existingCandidates: Candidate[];
  onSave: (data: Partial<Candidate>) => Promise<void>;
  onClose: () => void;
  onViewDuplicate: (candidate: Candidate) => void;
}

function CandidateForm({ initial, existingCandidates, onSave, onClose, onViewDuplicate }: CandidateFormProps) {
  const employees = useEmployeeList();
  const { masterData } = useMasterData();
  const departmentOptions = useMemo(() => {
    const fromMaster = masterData.departments.filter((d) => d.status === "active").map((d) => d.name);
    return fromMaster.length > 0 ? fromMaster : [...DEPARTMENTS];
  }, [masterData.departments]);
  const positionOptions = useMemo(() => {
    return masterData.jobTitles.filter((j) => j.status === "active").map((j) => j.title);
  }, [masterData.jobTitles]);

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    position: initial?.position ?? "",
    department: initial?.department ?? "",
    source: initial?.source ?? RECRUITMENT_SOURCES[0],
    experience: String(initial?.experience ?? ""),
    currentCompany: initial?.currentCompany ?? "",
    currentSalary: initial?.currentSalary ?? "",
    expectedSalary: initial?.expectedSalary ?? "",
    noticePeriod: initial?.noticePeriod ?? "",
    servingNoticePeriod: initial?.servingNoticePeriod ?? false,
    noticePeriodEndDate: initial?.noticePeriodEndDate ?? "",
    stage: initial?.stage ?? "Applied",
    hiringManager: initial?.hiringManager ?? "",
    skills: initial?.skills ?? [] as string[],
    nationality: initial?.nationality ?? "",
    partOfOrganization: initial?.partOfOrganization ?? false,
    previousCompany: initial?.previousCompany ?? "",
    attachments: initial?.attachments ?? [] as CandidateAttachment[],
    userNotes: initial?.userNotes ?? "",
    agency_name: initial?.agency_name ?? "",
    agency_email: initial?.agency_email ?? "",
    agency_fee: String(initial?.agency_fee ?? 50000),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const others = existingCandidates.filter((c) => c.id !== initial?.id);

  const emailDup = form.email.trim()
    ? others.find((c) => c.email?.toLowerCase() === form.email.toLowerCase().trim()) ?? null
    : null;

  const phoneDup = form.phone.trim()
    ? others.find((c) => c.phone && c.phone.replace(/\D/g, "") === form.phone.replace(/\D/g, "") && form.phone.replace(/\D/g, "").length >= 7) ?? null
    : null;

  const nameDup = form.name.trim().length >= 3
    ? others.find((c) => nameSimilarity(c.name, form.name) > 0.7 && c.name.toLowerCase() !== form.name.toLowerCase().trim()) ?? null
    : null;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t("required");
    if (!form.email.trim()) e.email = t("required");
    if (!form.position.trim()) e.position = t("required");
    if (!form.department.trim()) e.department = t("required");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({ ...form, experience: Number(form.experience) || 0, agency_fee: Number(form.agency_fee) || 50000 });
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const tf = (key: keyof typeof form, label: string, type = "text", extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type={type}
        value={String(form[key])}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[key] ? "border-red-400" : "border-border"}`}
        {...extra}
      />
      {errors[key] && <p className="text-xs text-red-500 mt-0.5">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold text-foreground">{initial?.id ? t("editCandidate") : t("addCandidate")}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">

          {/* Basic Info */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("recruitment.basicInfo")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("name")} *</label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? "border-red-400" : "border-border"}`} />
                {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
                {nameDup && (
                  <p className="text-xs text-amber-600 mt-1">
                    {t("recruitment.similarName")}{" "}
                    <button type="button" onClick={() => onViewDuplicate(nameDup)} className="underline font-medium">{nameDup.name}</button>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("email")} *</label>
                <input type="email" value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? "border-red-400" : emailDup ? "border-amber-400" : "border-border"}`} />
                {errors.email && <p className="text-xs text-red-500 mt-0.5">{errors.email}</p>}
                {emailDup && !errors.email && (
                  <p className="text-xs text-amber-600 mt-1">
                    {t("recruitment.duplicate")}{" "}
                    <button type="button" onClick={() => onViewDuplicate(emailDup)} className="underline font-medium">{emailDup.name}</button>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("phone")}</label>
                <input type="tel" value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${phoneDup ? "border-amber-400" : "border-border"}`} />
                {phoneDup && (
                  <p className="text-xs text-amber-600 mt-1">
                    {t("recruitment.duplicate")}{" "}
                    <button type="button" onClick={() => onViewDuplicate(phoneDup)} className="underline font-medium">{phoneDup.name}</button>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("nationality")}</label>
                <ComboBox
                  value={form.nationality}
                  onChange={(v) => setForm((f) => ({ ...f, nationality: v }))}
                  options={NATIONALITIES}
                  placeholder="Select or type nationality…"
                />
              </div>
            </div>
          </section>

          {/* Role & Department */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("recruitment.roleCompensation")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("position")} *</label>
                <ComboBox
                  value={form.position}
                  onChange={(v) => setForm((f) => ({ ...f, position: v }))}
                  options={positionOptions}
                  placeholder="Select or type position…"
                  className={errors.position ? "[&>div]:border-red-400" : ""}
                />
                {errors.position && <p className="text-xs text-red-500 mt-0.5">{errors.position}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("department")} *</label>
                <ComboBox
                  value={form.department}
                  onChange={(v) => setForm((f) => ({ ...f, department: v }))}
                  options={departmentOptions}
                  placeholder="Select or type department…"
                  className={errors.department ? "[&>div]:border-red-400" : ""}
                />
                {errors.department && <p className="text-xs text-red-500 mt-0.5">{errors.department}</p>}
              </div>
              {tf("experience", t("experience"), "number", { min: "0", step: "1" })}
              {tf("expectedSalary", t("expectedSalary"))}
              {tf("currentCompany", t("currentCompany"))}
              {tf("currentSalary", t("currentSalary"))}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("hiringManager")}</label>
                <EmployeeComboBox
                  value={form.hiringManager}
                  onChange={(v) => setForm((f) => ({ ...f, hiringManager: v }))}
                  employees={employees}
                  placeholder="Select or type manager name…"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("source")}</label>
                <select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {RECRUITMENT_SOURCES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("stage")}</label>
                <select value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {RECRUITMENT_STAGES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {form.source === "Agency" && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="sm:col-span-2 text-xs font-semibold text-amber-700 uppercase tracking-wide">{t("recruitment.agencyDetails")}</p>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.agencyName")}</label>
                  <input type="text" value={form.agency_name}
                    onChange={(e) => setForm((f) => ({ ...f, agency_name: e.target.value }))}
                    placeholder="e.g. TalentFirst Recruiters"
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.agencyEmail")}</label>
                  <input type="email" value={form.agency_email}
                    onChange={(e) => setForm((f) => ({ ...f, agency_email: e.target.value }))}
                    placeholder="billing@agency.com"
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.agencyFee")}</label>
                  <input type="number" value={form.agency_fee} min="0" step="1000"
                    onChange={(e) => setForm((f) => ({ ...f, agency_fee: e.target.value }))}
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}
          </section>

          {/* Notice Period */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Notice Period</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tf("noticePeriod", t("noticePeriod"))}
              <div className="flex flex-col gap-2">
                <label className="block text-xs font-medium text-muted-foreground">{t("servingNoticePeriod")}</label>
                <button type="button"
                  onClick={() => setForm((f) => ({ ...f, servingNoticePeriod: !f.servingNoticePeriod }))}
                  className="flex items-center gap-2 text-sm text-foreground w-fit">
                  {form.servingNoticePeriod ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-muted-foreground" />}
                  Currently serving notice
                </button>
              </div>
              {form.servingNoticePeriod && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t("noticePeriodEndDate")}</label>
                  <input type="date" value={form.noticePeriodEndDate}
                    onChange={(e) => setForm((f) => ({ ...f, noticePeriodEndDate: e.target.value }))}
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
            </div>
          </section>

          {/* Previous Experience */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Previous Experience</p>
            <div className="space-y-3">
              <button type="button"
                onClick={() => setForm((f) => ({ ...f, partOfOrganization: !f.partOfOrganization }))}
                className="flex items-center gap-2 text-sm text-foreground">
                {form.partOfOrganization ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-muted-foreground" />}
                {t("partOfOrganization")}
              </button>
              {form.partOfOrganization && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t("previousCompany")}</label>
                  <input type="text" value={form.previousCompany}
                    onChange={(e) => setForm((f) => ({ ...f, previousCompany: e.target.value }))}
                    placeholder="Previous company / department name"
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
            </div>
          </section>

          {/* Skills */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("skills")}</p>
            <SkillsInput value={form.skills} onChange={(skills) => setForm((f) => ({ ...f, skills }))} />
          </section>

          {/* Attachments */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("attachments")}</p>
            <AttachmentsInput value={form.attachments} onChange={(attachments) => setForm((f) => ({ ...f, attachments }))} />
          </section>

          {/* Notes */}
          <section>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("userNotes")}</label>
            <textarea rows={3} value={form.userNotes}
              onChange={(e) => setForm((f) => ({ ...f, userNotes: e.target.value }))}
              placeholder="Add any additional notes about this candidate..."
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </section>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">{t("cancel")}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== JOB FORM ====================

interface JobFormProps {
  initial?: Partial<JobPosting>;
  onSave: (data: Partial<JobPosting>) => Promise<void>;
  onClose: () => void;
}

function JobForm({ initial, onSave, onClose }: JobFormProps) {
  const employees = useEmployeeList();
  const { masterData } = useMasterData();
  const departmentOptions = useMemo(() => {
    const fromMaster = masterData.departments.filter((d) => d.status === "active").map((d) => d.name);
    return fromMaster.length > 0 ? fromMaster : [...DEPARTMENTS];
  }, [masterData.departments]);
  const positionOptions = useMemo(() => masterData.jobTitles.filter((j) => j.status === "active").map((j) => j.title), [masterData.jobTitles]);
  const locationOptions = [...LOCATIONS];

  const [form, setForm] = useState({
    title: initial?.title ?? "",
    department: initial?.department ?? "",
    location: initial?.location ?? "",
    type: initial?.type ?? 'Full-time',
    workMode: initial?.workMode ?? "On-site",
    experience: initial?.experience ?? "",
    salaryMin: initial?.salaryMin ?? "",
    salaryMax: initial?.salaryMax ?? "",
    headcount: String(initial?.headcount ?? "1"),
    deadline: initial?.deadline ?? "",
    hiringManager: initial?.hiringManager ?? "",
    description: initial?.description ?? "",
    requiredSkills: initial?.requiredSkills ?? [] as string[],
    benefits: initial?.benefits ?? "",
    status: initial?.status ?? "Active",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = t("required");
    if (!form.department.trim()) e.department = t("required");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({ ...form, headcount: Number(form.headcount) || 1 });
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="font-semibold text-foreground">{initial?.id ? t("editJob") : t("addJob")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Fill in the job details for this opening</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">

          {/* Role */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Role Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("jobTitle")} *</label>
                <ComboBox value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))}
                  options={positionOptions} placeholder="Select or type job title…"
                  className={errors.title ? "[&>div]:border-red-400" : ""} />
                {errors.title && <p className="text-xs text-red-500 mt-0.5">{errors.title}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("department")} *</label>
                <ComboBox value={form.department} onChange={(v) => setForm((f) => ({ ...f, department: v }))}
                  options={departmentOptions} placeholder="Select or type department…"
                  className={errors.department ? "[&>div]:border-red-400" : ""} />
                {errors.department && <p className="text-xs text-red-500 mt-0.5">{errors.department}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("location")}</label>
                <ComboBox value={form.location} onChange={(v) => setForm((f) => ({ ...f, location: v }))}
                  options={locationOptions} placeholder="Select or type location…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Employment Type</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <SelectOptions entity="employee" field="employment_type" fallback={['Full-time','Part-time','Contract','Internship','Freelance']} />
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Work Mode</label>
                <select value={form.workMode} onChange={(e) => setForm((f) => ({ ...f, workMode: e.target.value }))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <SelectOptions entity="employee" field="work_mode" fallback={['On-site','Remote','Hybrid']} />
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Experience Required</label>
                <input value={form.experience} onChange={(e) => setForm((f) => ({ ...f, experience: e.target.value }))}
                  placeholder="e.g. 3-5 years"
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">No. of Openings</label>
                <input type="number" min="1" value={form.headcount}
                  onChange={(e) => setForm((f) => ({ ...f, headcount: e.target.value }))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Application Deadline</label>
                <input type="date" value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Hiring Manager</label>
                <EmployeeComboBox value={form.hiringManager}
                  onChange={(v) => setForm((f) => ({ ...f, hiringManager: v }))}
                  employees={employees} placeholder="Select hiring manager…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Active</option><option>Closed</option>
                </select>
              </div>
            </div>
          </section>

          {/* Compensation */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Compensation</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Min Salary / CTC</label>
                <input value={form.salaryMin} onChange={(e) => setForm((f) => ({ ...f, salaryMin: e.target.value }))}
                  placeholder="e.g. 8 LPA"
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Max Salary / CTC</label>
                <input value={form.salaryMax} onChange={(e) => setForm((f) => ({ ...f, salaryMax: e.target.value }))}
                  placeholder="e.g. 15 LPA"
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Benefits & Perks</label>
                <input value={form.benefits} onChange={(e) => setForm((f) => ({ ...f, benefits: e.target.value }))}
                  placeholder="e.g. Health insurance, flexible hours, WFH allowance"
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </section>

          {/* Required Skills */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Required Skills</p>
            <SkillsInput value={form.requiredSkills}
              onChange={(requiredSkills) => setForm((f) => ({ ...f, requiredSkills }))} />
          </section>

          {/* Description */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Job Description</p>
            <textarea rows={4} value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe responsibilities, requirements, and what the role entails…"
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </section>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">{t("cancel")}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== CANDIDATE DRAWER ====================

interface CandidateDrawerProps {
  candidate: Candidate;
  isEditor: boolean;
  onClose: () => void;
  onAddInterview: (candidateId: string, data: Omit<Interview, "id">) => Promise<void>;
  onAddFeedback: (candidateId: string, data: Omit<Feedback, "id">) => Promise<void>;
  onOfferSaved?: () => void;
  onBlacklist?: (reason: string) => Promise<void>;
}

function StarRating({ value, max = 5, onChange }: { value: number; max?: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <button key={i} type={onChange ? "button" : undefined}
          onClick={onChange ? () => onChange(i + 1) : undefined}
          className={`text-lg leading-none ${i < value ? "text-yellow-400" : "text-gray-200"} ${onChange ? "hover:text-yellow-300 cursor-pointer" : "cursor-default"}`}>
          ★
        </button>
      ))}
    </div>
  );
}

const STAGES_ORDERED = ["Applied", "Screening", "Interview Scheduled", "Interview Done", "HR Round Done", "Offer Sent", "Offer Accepted", "Hired"];

const BLANK_FEEDBACK = () => ({
  rating: 0, technicalSkills: 0, communication: 0, culturalFit: 0, comments: "",
  recommendation: "Maybe" as const,
  competency_ratings: {} as Record<string, number>,
  strengths: "", concerns: "",
});

function CandidateDrawer({ candidate, isEditor, onClose, onAddInterview, onAddFeedback, onOfferSaved, onBlacklist }: CandidateDrawerProps) {
  const employees = useEmployeeList();
  const { currentUser } = useUser();
  const [tab, setTab] = useState<"info" | "interviews" | "feedback" | "attachments" | "offers" | "communications">("info");
  const [interviewForm, setInterviewForm] = useState({
    type: INTERVIEW_TYPES[0], date: "", time: "", interviewer: "", duration: "60 min", status: "Scheduled", meetingLink: "", notes: "",
    location_type: "remote", location_address: "",
  });
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [feedbackForId, setFeedbackForId] = useState<string | null>(null);
  const [feedbackForm, setFeedbackForm] = useState<ReturnType<typeof BLANK_FEEDBACK> & { interviewer: string; interviewId?: string }>({ interviewer: "", ...BLANK_FEEDBACK() });
  const [saving, setSaving] = useState(false);

  // Offers
  const [offers, setOffers] = useState<Offer[]>([]);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);

  // Communications
  const [communications, setCommunications] = useState<CommunicationLog[]>([]);
  const [showCommModal, setShowCommModal] = useState(false);
  const [commRefresh, setCommRefresh] = useState(0);

  // Blacklist
  const [showBlacklist, setShowBlacklist] = useState(false);

  useEffect(() => {
    supabase.from("recruitment_offers").select("*").eq("candidate_id", candidate.id).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setOffers(data as Offer[]); });
  }, [candidate.id, showOfferModal]);

  useEffect(() => {
    supabase.from("recruitment_communication_log").select("*").eq("candidate_id", candidate.id).order("sent_at", { ascending: false })
      .then(({ data }) => { if (data) setCommunications(data as CommunicationLog[]); });
  }, [candidate.id, commRefresh]);

  const stageIdx = STAGES_ORDERED.indexOf(candidate.stage);
  const needsFeedback = INTERVIEW_STAGES.includes(candidate.stage) && (candidate.feedback ?? []).length === 0;
  const interviews = candidate.interviews ?? [];
  const feedbacks = candidate.feedback ?? [];

  const openFeedbackFor = (iv: Interview) => {
    setFeedbackForId(iv.id);
    setFeedbackForm({ interviewer: iv.interviewer, interviewId: iv.id, ...BLANK_FEEDBACK() });
  };

  const closeFeedbackForm = () => { setFeedbackForId(null); setFeedbackForm({ interviewer: "", ...BLANK_FEEDBACK() }); };

  const handleAddInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewForm.date || !interviewForm.interviewer) { toast.error("Date and interviewer are required"); return; }
    setSaving(true);
    try {
      const icsUid = `${candidate.id}-${Date.now()}`;
      await onAddInterview(candidate.id, {
        ...interviewForm,
        ics_uid: icsUid,
        calendar_event_url: null,
      } as any);
      toast.success(t("interviewScheduled"));
      setInterviewForm({ type: INTERVIEW_TYPES[0], date: "", time: "", interviewer: "", duration: "60 min", status: "Scheduled", meetingLink: "", notes: "", location_type: "remote", location_address: "" });
      setShowInterviewForm(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setSaving(false); }
  };

  const handleAddFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackForm.comments.trim()) { toast.error("Feedback comments are required"); return; }
    if (feedbackForm.rating === 0) { toast.error("Please select an overall rating"); return; }
    setSaving(true);
    try {
      await onAddFeedback(candidate.id, { ...feedbackForm, date: new Date().toISOString() } as any);
      // Recalculate aggregate feedback score
      const allFeedbacks = [...(candidate.feedback ?? []), { ...feedbackForm, date: new Date().toISOString() }];
      const avg = allFeedbacks.reduce((s, fb) => s + ((fb as any).rating ?? 0), 0) / allFeedbacks.length;
      const { error: fbScoreErr } = await supabase.from("recruitment_candidates").update({ aggregate_feedback_score: Math.round(avg * 10) / 10 }).eq("id", candidate.id);
      if (fbScoreErr) throw new Error(fbScoreErr.message);
      toast.success(t("feedbackAdded"));
      closeFeedbackForm();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setSaving(false); }
  };

  const drawerTabs = [
    { id: "info" as const, label: "Info" },
    { id: "interviews" as const, label: `Interviews${interviews.length > 0 ? ` (${interviews.length})` : ""}` },
    { id: "feedback" as const, label: `Feedback${feedbacks.length > 0 ? ` (${feedbacks.length})` : ""}` },
    { id: "attachments" as const, label: `Docs${(candidate.attachments ?? []).length > 0 ? ` (${candidate.attachments!.length})` : ""}` },
    { id: "offers" as const, label: `Offers${offers.length > 0 ? ` (${offers.length})` : ""}` },
    { id: "communications" as const, label: `Comms${communications.length > 0 ? ` (${communications.length})` : ""}` },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-card shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h2 className="font-semibold text-foreground">{candidate.name}</h2>
              <StageBadge stage={candidate.stage} />
              {(candidate as any).blacklisted && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                  <ShieldOff size={10} />{t("recruitment.blacklisted")}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{candidate.position} · {candidate.department}</p>
            <div className="flex items-center gap-3 mt-1">
              {candidate.rating != null && candidate.rating > 0 && (
                <StarRating value={Math.round(candidate.rating)} />
              )}
              {(candidate as any).aggregate_feedback_score != null && (candidate as any).aggregate_feedback_score > 0 && (
                <span className="text-xs bg-indigo-50 text-indigo-700 rounded px-2 py-0.5 font-medium">
                  {t("recruitment.aggregateScore")}: {Number((candidate as any).aggregate_feedback_score).toFixed(1)}/5
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {isEditor && onBlacklist && !(candidate as any).blacklisted && (
              <button onClick={() => setShowBlacklist(true)} title={t("recruitment.blacklist")}
                className="p-1.5 text-muted-foreground hover:text-red-500 rounded">
                <ShieldOff size={14} />
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X size={18} /></button>
          </div>
        </div>

        {/* Feedback gate warning */}
        {needsFeedback && isEditor && (
          <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-800 shrink-0">
            <AlertCircle size={13} className="shrink-0" />
            <span><strong>Action needed:</strong> {t("feedbackRequiredDetail")}</span>
          </div>
        )}

        {/* Stage guide */}
        {candidate.stage !== "Hired" && candidate.stage !== "Rejected" && (
          <div className="flex items-center gap-2 bg-blue-50 border-b border-blue-100 px-4 py-2 text-xs text-blue-700 shrink-0">
            <ChevronRight size={12} className="shrink-0" />
            <span>
              <strong>Next:</strong> {STAGE_GUIDE[candidate.stage]?.next ?? "—"} &mdash; {STAGE_GUIDE[candidate.stage]?.requirements ?? ""}
            </span>
          </div>
        )}

        {/* Compact stage timeline */}
        <div className="flex items-center gap-0.5 px-4 py-2 overflow-x-auto border-b border-border shrink-0 scrollbar-hide">
          {STAGES_ORDERED.map((s, i) => {
            const done = i < stageIdx;
            const current = i === stageIdx;
            return (
              <React.Fragment key={s}>
                <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${current ? "bg-blue-600 text-white" : done ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}>
                  {s}
                </span>
                {i < STAGES_ORDERED.length - 1 && <ChevronRight size={10} className="text-gray-300 shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 overflow-x-auto scrollbar-hide">
          {drawerTabs.map((tb) => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className={`shrink-0 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${tab === tb.id ? "border-b-2 border-blue-600 text-blue-600" : "text-muted-foreground hover:text-foreground"}`}>
              {tb.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* ── INFO TAB ── */}
          {tab === "info" && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                {([
                  [t("email"), candidate.email],
                  [t("phone"), candidate.phone],
                  [t("nationality"), candidate.nationality],
                  [t("source"), candidate.source],
                  [t("experience"), candidate.experience ? `${candidate.experience} yrs` : null],
                  [t("currentCompany"), candidate.currentCompany],
                  [t("currentSalary"), candidate.currentSalary],
                  [t("expectedSalary"), candidate.expectedSalary],
                  [t("noticePeriod"), candidate.noticePeriod],
                  [t("noticePeriodEndDate"), candidate.noticePeriodEndDate],
                  [t("appliedDate"), candidate.appliedDate],
                  [t("hiringManager"), candidate.hiringManager],
                ] as [string, string | null | undefined][]).filter(([, v]) => v).map(([label, val]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-foreground font-medium truncate">{val}</p>
                  </div>
                ))}
              </div>

              {candidate.servingNoticePeriod && (
                <div className="flex items-center gap-2 bg-orange-50 rounded-lg px-3 py-2 text-xs text-orange-700">
                  <AlertCircle size={12} />
                  Currently serving notice period{candidate.noticePeriodEndDate ? ` — ends ${candidate.noticePeriodEndDate}` : ""}
                </div>
              )}

              {candidate.partOfOrganization && (
                <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
                  <Building2 size={12} />
                  Previously part of this organization{candidate.previousCompany ? ` (${candidate.previousCompany})` : ""}
                </div>
              )}

              {(candidate.skills ?? []).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">{t("skills")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(candidate.skills ?? []).map((s) => (
                      <span key={s} className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {candidate.userNotes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t("userNotes")}</p>
                  <p className="text-xs text-foreground bg-muted rounded-lg px-3 py-2 whitespace-pre-wrap">{candidate.userNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* ── INTERVIEWS TAB ── */}
          {tab === "interviews" && (
            <div className="space-y-3">
              {interviews.length === 0 && !showInterviewForm && (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t("noInterviews")}</p>
                </div>
              )}

              {interviews.map((iv) => {
                const linkedFeedback = feedbacks.filter((fb) =>
                  fb.interviewId ? fb.interviewId === iv.id : fb.interviewer === iv.interviewer
                );
                const hasFeedback = linkedFeedback.length > 0;
                const isAddingFeedback = feedbackForId === iv.id;

                return (
                  <div key={iv.id} className="border border-border rounded-xl overflow-hidden">
                    {/* Interview card header */}
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">{iv.type}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${iv.status === "Completed" ? "bg-green-100 text-green-700" : iv.status === "Cancelled" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                            {iv.status}
                          </span>
                        </div>
                        {/* Add Feedback button — only shown when no feedback yet for this interviewer */}
                        {isEditor && !hasFeedback && !isAddingFeedback && (
                          <button
                            type="button"
                            onClick={() => openFeedbackFor(iv)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors">
                            <Plus size={11} /> Add Feedback
                          </button>
                        )}
                        {isEditor && isAddingFeedback && (
                          <button type="button" onClick={closeFeedbackForm}
                            className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {(iv.date || iv.time) && <p>📅 {iv.date}{iv.time ? ` at ${iv.time}` : ""}</p>}
                        {iv.interviewer && <p>👤 {iv.interviewer}</p>}
                        {iv.duration && <p>⏱ {iv.duration}</p>}
                        {iv.meetingLink && (
                          <p>🔗 <a href={iv.meetingLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Meeting Link</a></p>
                        )}
                        {iv.notes && <p className="mt-1 italic">{iv.notes}</p>}
                        {iv.date && (
                          <button type="button"
                            onClick={() => {
                              const location = (iv as any).location_address || iv.meetingLink || "TBD";
                              const uid = (iv as any).ics_uid || iv.id;
                              const ics = generateICS(candidate.name, iv.type, iv.date, iv.time ?? "09:00", iv.duration ?? "60 min", location, uid);
                              downloadICS(ics, `interview-${candidate.name.replace(/\s+/g, "-")}.ics`);
                            }}
                            className="flex items-center gap-1 text-blue-600 hover:underline mt-0.5">
                            <Download size={10} />{t("recruitment.downloadICS")}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Feedback already submitted for this interview */}
                    {hasFeedback && linkedFeedback.map((fb) => (
                      <div key={fb.id} className="border-t border-border bg-green-50/60 px-3 py-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-green-800">Feedback submitted</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${fb.recommendation === "Hire" ? "bg-green-100 text-green-700" : fb.recommendation === "Reject" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                            {fb.recommendation}
                          </span>
                        </div>
                        <StarRating value={fb.rating} />
                        {(fb.technicalSkills != null || fb.communication != null || fb.culturalFit != null) && (
                          <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                            {fb.technicalSkills != null && <div><p className="text-muted-foreground">Technical</p><StarRating value={fb.technicalSkills} /></div>}
                            {fb.communication != null && <div><p className="text-muted-foreground">Comm.</p><StarRating value={fb.communication} /></div>}
                            {fb.culturalFit != null && <div><p className="text-muted-foreground">Culture</p><StarRating value={fb.culturalFit} /></div>}
                          </div>
                        )}
                        {fb.comments && (
                          <p className="text-xs text-muted-foreground bg-white/70 rounded px-2 py-1.5 whitespace-pre-wrap">{fb.comments}</p>
                        )}
                      </div>
                    ))}

                    {/* Inline feedback form — shown only for this interview */}
                    {isAddingFeedback && (
                      <form onSubmit={handleAddFeedback} className="border-t border-blue-200 bg-blue-50/50 p-3 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <p className="text-xs font-semibold text-blue-800">Feedback for: {feedbackForm.interviewer}</p>
                        </div>

                        <div className="space-y-2.5">
                          {([
                            ["Overall Rating *", "rating"],
                            [t("technicalSkills"), "technicalSkills"],
                            [t("communication"), "communication"],
                            [t("culturalFit"), "culturalFit"],
                          ] as [string, keyof typeof feedbackForm][]).map(([label, key]) => key !== "interviewer" && (
                            <div key={String(key)} className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">{label}</span>
                              <StarRating
                                value={feedbackForm[key] as number}
                                onChange={(v) => setFeedbackForm((f) => ({ ...f, [key]: v }))}
                              />
                            </div>
                          ))}
                        </div>

                        {/* Competency Ratings */}
                        <div>
                          <p className="text-xs font-semibold text-blue-800 mb-2">{t("recruitment.competencies")}</p>
                          <div className="space-y-2">
                            {COMPETENCY_FRAMEWORKS.map((comp) => (
                              <div key={comp} className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">{comp}</span>
                                <StarRating
                                  value={feedbackForm.competency_ratings[comp] ?? 0}
                                  onChange={(v) => setFeedbackForm((f) => ({
                                    ...f,
                                    competency_ratings: { ...f.competency_ratings, [comp]: v },
                                  }))}
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Overall Recommendation */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{t("recruitment.recommendation")}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {["Strong Hire", "Hire", "Neutral", "No Hire", "Strong No Hire"].map((rec) => (
                              <button key={rec} type="button"
                                onClick={() => setFeedbackForm((f) => ({ ...f, recommendation: rec as any }))}
                                className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors ${feedbackForm.recommendation === rec
                                  ? rec.includes("Hire") && !rec.includes("No") ? "bg-green-600 text-white border-green-600"
                                    : rec.includes("No") ? "bg-red-600 text-white border-red-600"
                                    : "bg-yellow-500 text-white border-yellow-500"
                                  : "border-border text-muted-foreground hover:border-blue-300"}`}>
                                {rec}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Strengths & Concerns */}
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">{t("recruitment.strengths")}</label>
                          <textarea rows={2} value={feedbackForm.strengths}
                            onChange={(e) => setFeedbackForm((f) => ({ ...f, strengths: e.target.value }))}
                            placeholder="Candidate's key strengths…"
                            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">{t("recruitment.concerns")}</label>
                          <textarea rows={2} value={feedbackForm.concerns}
                            onChange={(e) => setFeedbackForm((f) => ({ ...f, concerns: e.target.value }))}
                            placeholder="Areas of concern…"
                            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>

                        <textarea rows={3}
                          placeholder="Overall comments (required)"
                          value={feedbackForm.comments}
                          onChange={(e) => setFeedbackForm((f) => ({ ...f, comments: e.target.value }))}
                          className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />

                        <div className="flex gap-2">
                          <button type="button" onClick={closeFeedbackForm}
                            className="flex-1 py-2 text-sm border border-border rounded-lg hover:bg-muted">{t("cancel")}</button>
                          <button type="submit" disabled={saving}
                            className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 font-medium">
                            {saving ? t("saving") : t("submitFeedback")}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}

              {/* Schedule Interview form */}
              {isEditor && !showInterviewForm && (
                <button type="button" onClick={() => setShowInterviewForm(true)}
                  className="w-full py-2.5 text-sm border border-dashed border-blue-300 text-blue-600 rounded-xl hover:bg-blue-50 flex items-center justify-center gap-1.5 font-medium transition-colors">
                  <Plus size={14} /> {t("scheduleInterview")}
                </button>
              )}

              {isEditor && showInterviewForm && (
                <form onSubmit={handleAddInterview} className="border border-border rounded-xl p-4 space-y-3 bg-card">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">{t("scheduleInterview")}</p>
                    <button type="button" onClick={() => setShowInterviewForm(false)}
                      className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                  </div>
                  <select value={interviewForm.type} onChange={(e) => setInterviewForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {INTERVIEW_TYPES.map((tp) => <option key={tp}>{tp}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" value={interviewForm.date} onChange={(e) => setInterviewForm((f) => ({ ...f, date: e.target.value }))}
                      className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="time" value={interviewForm.time} onChange={(e) => setInterviewForm((f) => ({ ...f, time: e.target.value }))}
                      className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <EmployeeComboBox
                    value={interviewForm.interviewer}
                    onChange={(v) => setInterviewForm((f) => ({ ...f, interviewer: v }))}
                    employees={employees}
                    placeholder={`${t("interviewer")} *`}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={interviewForm.duration} onChange={(e) => setInterviewForm((f) => ({ ...f, duration: e.target.value }))}
                      className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <SelectOptions entity="recruitment" field="interview_duration" fallback={['30 min','45 min','60 min','90 min','120 min']} />
                    </select>
                    <select value={interviewForm.status} onChange={(e) => setInterviewForm((f) => ({ ...f, status: e.target.value }))}
                      className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <SelectOptions entity="recruitment" field="interview_status" fallback={['Scheduled','Completed','Cancelled','No-show']} />
                    </select>
                  </div>
                  <input placeholder="Meeting link (optional)" value={interviewForm.meetingLink}
                    onChange={(e) => setInterviewForm((f) => ({ ...f, meetingLink: e.target.value }))}
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={interviewForm.location_type}
                      onChange={(e) => setInterviewForm((f) => ({ ...f, location_type: e.target.value }))}
                      className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="remote">Remote</option>
                      <option value="in-person">In-Person</option>
                      <option value="phone">Phone</option>
                    </select>
                    {interviewForm.location_type === "in-person" && (
                      <input placeholder="Location address" value={interviewForm.location_address}
                        onChange={(e) => setInterviewForm((f) => ({ ...f, location_address: e.target.value }))}
                        className="text-sm border border-border rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    )}
                  </div>
                  <textarea rows={2} placeholder="Notes (optional)" value={interviewForm.notes}
                    onChange={(e) => setInterviewForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setShowInterviewForm(false)}
                      className="flex-1 py-2 text-sm border border-border rounded-lg hover:bg-muted">{t("cancel")}</button>
                    <button type="submit" disabled={saving}
                      className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 font-medium">
                      {saving ? t("saving") : t("addInterview")}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ── FEEDBACK TAB ── read-only summary ── */}
          {tab === "feedback" && (
            <div className="space-y-4">
              {INTERVIEW_STAGES.includes(candidate.stage) && feedbacks.length === 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  <p>{t("feedbackRequiredDetail")} Go to the <strong>Interviews</strong> tab to add feedback against a scheduled interview.</p>
                </div>
              )}
              {feedbacks.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  <Star size={28} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">{t("noFeedback")}</p>
                  {interviews.length > 0 && isEditor && (
                    <button type="button" onClick={() => setTab("interviews")}
                      className="mt-3 text-xs text-blue-600 hover:underline">
                      Go to Interviews tab to add feedback →
                    </button>
                  )}
                </div>
              )}
              {feedbacks.map((fb) => {
                const linkedInterview = interviews.find((iv) => iv.interviewer === fb.interviewer);
                return (
                  <div key={fb.id} className="border border-border rounded-xl p-3 space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm text-foreground">{fb.interviewer}</p>
                        <p className="text-xs text-muted-foreground">
                          {fb.date ? new Date(fb.date).toLocaleDateString() : ""}
                          {linkedInterview ? ` · ${linkedInterview.type} interview` : ""}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${fb.recommendation === "Hire" ? "bg-green-100 text-green-700" : fb.recommendation === "Reject" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {fb.recommendation}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Overall</p>
                        <StarRating value={fb.rating} />
                      </div>
                    </div>
                    {(fb.technicalSkills != null || fb.communication != null || fb.culturalFit != null) && (
                      <div className="grid grid-cols-3 gap-2 text-xs border-t border-border pt-2">
                        {fb.technicalSkills != null && (
                          <div><p className="text-muted-foreground mb-0.5">Technical</p><StarRating value={fb.technicalSkills} /></div>
                        )}
                        {fb.communication != null && (
                          <div><p className="text-muted-foreground mb-0.5">Comm.</p><StarRating value={fb.communication} /></div>
                        )}
                        {fb.culturalFit != null && (
                          <div><p className="text-muted-foreground mb-0.5">Culture Fit</p><StarRating value={fb.culturalFit} /></div>
                        )}
                      </div>
                    )}
                    {fb.comments && (
                      <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2 whitespace-pre-wrap">{fb.comments}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── ATTACHMENTS TAB ── */}
          {tab === "attachments" && (
            <div className="space-y-3">
              {(candidate.attachments ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t("noAttachments")}</p>
              )}
              {(candidate.attachments ?? []).map((a, i) => (
                <div key={i} className="flex items-center gap-3 border border-border rounded-lg px-4 py-3">
                  <Paperclip size={16} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                    {a.url && (
                      <a href={a.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline truncate block">{a.url}</a>
                    )}
                  </div>
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 p-1.5 text-muted-foreground hover:text-blue-600 rounded">
                      <FileText size={14} />
                    </a>
                  )}
                </div>
              ))}
              <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                To add or remove attachments, open the candidate edit form.
              </div>
            </div>
          )}

          {/* ── OFFERS TAB ── */}
          {tab === "offers" && (
            <div className="space-y-3">
              {isEditor && (
                <button onClick={() => { setEditingOffer(null); setShowOfferModal(true); }}
                  className="w-full py-2.5 text-sm border border-dashed border-blue-300 text-blue-600 rounded-xl hover:bg-blue-50 flex items-center justify-center gap-1.5 font-medium">
                  <Plus size={14} />{t("recruitment.offerGenerate")}
                </button>
              )}
              {offers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t("recruitment.noOffers")}</p>
                </div>
              )}
              {offers.map((offer) => (
                <div key={offer.id} className="border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-foreground">{offer.offered_designation}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      offer.status === "accepted" ? "bg-green-100 text-green-700" :
                      offer.status === "declined" ? "bg-red-100 text-red-700" :
                      offer.status === "sent" ? "bg-blue-100 text-blue-700" :
                      offer.status === "negotiating" ? "bg-amber-100 text-amber-700" :
                      "bg-gray-100 text-gray-600"}`}>
                      {offer.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <span>CTC: <strong className="text-foreground">{offer.offered_ctc}</strong></span>
                    <span>Joining: <strong className="text-foreground">{offer.joining_date}</strong></span>
                    {offer.negotiated_ctc && <span>Negotiated: <strong className="text-foreground">{offer.negotiated_ctc}</strong></span>}
                    {offer.offer_expiry_date && <span>Expires: {offer.offer_expiry_date}</span>}
                  </div>
                  {isEditor && offer.status !== "accepted" && offer.status !== "declined" && (
                    <button onClick={() => { setEditingOffer(offer); setShowOfferModal(true); }}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <Edit2 size={10} />Edit offer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── COMMUNICATIONS TAB ── */}
          {tab === "communications" && (
            <div className="space-y-3">
              {isEditor && (
                <button onClick={() => setShowCommModal(true)}
                  className="w-full py-2.5 text-sm border border-dashed border-blue-300 text-blue-600 rounded-xl hover:bg-blue-50 flex items-center justify-center gap-1.5 font-medium">
                  <Plus size={14} />{t("recruitment.logCommunication")}
                </button>
              )}
              {communications.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t("recruitment.noCommunications")}</p>
                </div>
              )}
              {communications.map((comm) => (
                <div key={comm.id} className="border border-border rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`p-1 rounded ${comm.channel === "email" ? "bg-blue-50 text-blue-600" : comm.channel === "phone" ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-600"}`}>
                        {comm.channel === "email" ? <Mail size={12} /> : comm.channel === "phone" ? <Phone size={12} /> : <MessageSquare size={12} />}
                      </span>
                      <span className="text-xs font-medium text-foreground capitalize">{comm.channel}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${comm.direction === "inbound" ? "bg-purple-50 text-purple-600" : "bg-orange-50 text-orange-600"}`}>
                        {comm.direction}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(comm.sent_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs font-medium text-foreground">{comm.subject}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{comm.body}</p>
                  {comm.sent_by && <p className="text-xs text-muted-foreground">By: {comm.sent_by}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Offer Modal */}
      {showOfferModal && (
        <OfferModal
          candidate={candidate}
          existingOffer={editingOffer}
          onClose={() => { setShowOfferModal(false); setEditingOffer(null); }}
          onSaved={() => { onOfferSaved?.(); }}
        />
      )}

      {/* Communication Log Modal */}
      {showCommModal && (
        <CommunicationLogModal
          candidateId={candidate.id}
          sentBy={currentUser?.name ?? currentUser?.email ?? ""}
          onClose={() => setShowCommModal(false)}
          onSaved={() => setCommRefresh((n) => n + 1)}
        />
      )}

      {/* Blacklist Modal */}
      {showBlacklist && onBlacklist && (
        <BlacklistModal
          candidate={candidate}
          onCancel={() => setShowBlacklist(false)}
          onConfirm={async (reason) => {
            await onBlacklist(reason);
            setShowBlacklist(false);
          }}
        />
      )}
    </>
  );
}

// ==================== REQUISITION FORM ====================

interface RequisitionFormProps {
  initial?: Partial<Requisition>;
  onSave: (data: Partial<Requisition>) => Promise<void>;
  onClose: () => void;
}

function RequisitionForm({ initial, onSave, onClose }: RequisitionFormProps) {
  const { masterData } = useMasterData();
  const { currentUser } = useUser();
  const departmentOptions = useMemo(() => {
    const fromMaster = masterData.departments.filter((d) => d.status === "active").map((d) => d.name);
    return fromMaster.length > 0 ? fromMaster : [...DEPARTMENTS];
  }, [masterData.departments]);

  const [form, setForm] = useState({
    title: initial?.title ?? "",
    department: initial?.department ?? "",
    location: initial?.location ?? "",
    employment_type: initial?.employment_type ?? "Full-time",
    number_of_positions: String(initial?.number_of_positions ?? "1"),
    justification: initial?.justification ?? "",
    priority: initial?.priority ?? "medium" as typeof REQUISITION_PRIORITIES[number],
    budget_min: initial?.budget_min ?? "",
    budget_max: initial?.budget_max ?? "",
    target_start_date: initial?.target_start_date ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = t("common.required");
    if (!form.department.trim()) e.department = t("common.required");
    if (!form.justification.trim()) e.justification = t("common.required");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        number_of_positions: Number(form.number_of_positions) || 1,
        requested_by: currentUser?.name ?? currentUser?.email ?? "Unknown",
        status: "submitted",
      });
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="font-semibold text-foreground">{initial?.id ? "Edit Requisition" : t("recruitment.newRequisition")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Submit a requisition for approval before posting the job</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Role Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.requisitionTitle")} *</label>
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.title ? "border-red-400" : "border-border"}`} />
                {errors.title && <p className="text-xs text-red-500 mt-0.5">{errors.title}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("common.department")} *</label>
                <ComboBox value={form.department} onChange={(v) => setForm((f) => ({ ...f, department: v }))}
                  options={departmentOptions} placeholder="Select department…"
                  className={errors.department ? "[&>div]:border-red-400" : ""} />
                {errors.department && <p className="text-xs text-red-500 mt-0.5">{errors.department}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
                <ComboBox value={form.location} onChange={(v) => setForm((f) => ({ ...f, location: v }))}
                  options={[...LOCATIONS]} placeholder="Select location…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.employmentType")}</label>
                <select value={form.employment_type} onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value }))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {EMPLOYMENT_TYPES.map((et) => <option key={et}>{et}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.numberOfPositions")}</label>
                <input type="number" min="1" value={form.number_of_positions}
                  onChange={(e) => setForm((f) => ({ ...f, number_of_positions: e.target.value }))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.priority")}</label>
                <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as typeof form.priority }))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {REQUISITION_PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.targetStartDate")}</label>
                <input type="date" value={form.target_start_date}
                  onChange={(e) => setForm((f) => ({ ...f, target_start_date: e.target.value }))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </section>
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Compensation</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.budgetMin")}</label>
                <input value={form.budget_min} onChange={(e) => setForm((f) => ({ ...f, budget_min: e.target.value }))}
                  placeholder="e.g. 8 LPA"
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.budgetMax")}</label>
                <input value={form.budget_max} onChange={(e) => setForm((f) => ({ ...f, budget_max: e.target.value }))}
                  placeholder="e.g. 15 LPA"
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </section>
          <section>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("recruitment.justification")} *</label>
            <textarea rows={4} value={form.justification}
              onChange={(e) => setForm((f) => ({ ...f, justification: e.target.value }))}
              placeholder="Explain the business need for this position…"
              className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${errors.justification ? "border-red-400" : "border-border"}`} />
            {errors.justification && <p className="text-xs text-red-500 mt-0.5">{errors.justification}</p>}
          </section>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">{t("common.cancel")}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Saving…" : "Submit Requisition"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== REJECT REQUISITION MODAL ====================

function RejectRequisitionModal({ onConfirm, onCancel }: { onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-xl p-6 max-w-sm w-full">
        <h3 className="font-semibold text-foreground mb-2">{t("recruitment.rejectRequisition")}</h3>
        <p className="text-xs text-muted-foreground mb-3">Please provide a reason for rejection.</p>
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Rejection reason (required)…"
          className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">{t("common.cancel")}</button>
          <button onClick={() => { if (reason.trim()) onConfirm(reason.trim()); }}
            disabled={!reason.trim()}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== OFFER MODAL ====================

interface OfferModalProps {
  candidate: Candidate;
  existingOffer?: Offer | null;
  onClose: () => void;
  onSaved: () => void;
}

async function createAgencyBillingInvoice(candidate: Candidate, currentUserId?: string) {
  const { error: clientErr } = await supabase.from("invoice_clients").upsert(
    [{ name: candidate.agency_name!, email: candidate.agency_email || "", gstin: "" }],
    { onConflict: "name" }
  );
  if (clientErr) throw new Error(clientErr.message);
  const { error: invoiceErr } = await supabase.from("invoices").insert([{
    client_name: candidate.agency_name,
    invoice_number: "AGY-" + Date.now(),
    issue_date: new Date().toISOString().split("T")[0],
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    status: "draft",
    subtotal: candidate.agency_fee ?? 50000,
    tax_amount: 0,
    total_amount: candidate.agency_fee ?? 50000,
    currency: "INR",
    notes: "Auto-generated agency billing for hiring: " + candidate.name + " for " + (candidate.position || "position"),
    items: JSON.stringify([{
      description: "Recruitment Fee — " + candidate.name,
      quantity: 1,
      unit_price: candidate.agency_fee ?? 50000,
      amount: candidate.agency_fee ?? 50000,
    }]),
  }]);
  if (invoiceErr) throw new Error(invoiceErr.message);
  void supabase.from("notifications").insert([{
    user_id: currentUserId,
    type: "agency_invoice_created",
    title: t("recruitment.agencyInvoiceTitle"),
    message: t("recruitment.agencyInvoiceMessage") + candidate.agency_name,
    severity: "info",
    app: "invoice",
  }]);
  toast.success(t("recruitment.agencyInvoiceDrafted") + candidate.agency_name);
}

function OfferModal({ candidate, existingOffer, onClose, onSaved }: OfferModalProps) {
  const { currentUser } = useUser();
  const [form, setForm] = useState({
    offered_designation: existingOffer?.offered_designation ?? candidate.position,
    offered_ctc: existingOffer?.offered_ctc ?? "",
    joining_date: existingOffer?.joining_date ?? "",
    offer_expiry_date: existingOffer?.offer_expiry_date ?? "",
    template_id: "standard",
    negotiated_ctc: existingOffer?.negotiated_ctc ?? "",
    candidate_response: existingOffer?.candidate_response ?? "",
  });
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedTemplate = OFFER_LETTER_TEMPLATES.find((t) => t.id === form.template_id) ?? OFFER_LETTER_TEMPLATES[0];

  const offerVars = {
    name: candidate.name,
    designation: form.offered_designation,
    department: candidate.department ?? "",
    ctc: form.offered_ctc,
    joining_date: form.joining_date,
    expiry_date: form.offer_expiry_date,
  };
  const filledHTML = fillOfferTemplate(selectedTemplate.html, offerVars);

  const handleSend = async () => {
    if (!form.offered_ctc || !form.joining_date) { toast.error("CTC and joining date are required"); return; }
    setSaving(true);
    try {
      if (existingOffer?.id) {
        const { error: offerUpdateErr } = await supabase.from("recruitment_offers").update({
          offered_designation: form.offered_designation,
          offered_ctc: form.offered_ctc,
          joining_date: form.joining_date,
          offer_expiry_date: form.offer_expiry_date,
          status: "sent",
          negotiated_ctc: form.negotiated_ctc || null,
          candidate_response: form.candidate_response || null,
        }).eq("id", existingOffer.id);
        if (offerUpdateErr) throw new Error(offerUpdateErr.message);
      } else {
        const { error: offerInsertErr } = await supabase.from("recruitment_offers").insert([{
          candidate_id: candidate.id,
          offered_designation: form.offered_designation,
          offered_ctc: form.offered_ctc,
          joining_date: form.joining_date,
          offer_expiry_date: form.offer_expiry_date,
          status: "sent",
          offer_letter_url: null,
          signature_data: null,
          signed_pdf_url: null,
        }]);
        if (offerInsertErr) throw new Error(offerInsertErr.message);
      }
      toast.success(t("recruitment.offerSent"));
      onSaved();
      onClose();
    } catch { toast.error(t("common.error")); }
    finally { setSaving(false); }
  };

  const handleAcceptDecline = async (accept: boolean) => {
    if (!existingOffer?.id) return;
    const { error: adErr } = await supabase.from("recruitment_offers").update({ status: accept ? "accepted" : "declined" }).eq("id", existingOffer.id);
    if (adErr) throw new Error(adErr.message);
    if (accept) {
      // Integration 1: Recruitment → Onboarding
      // Auto-create onboarding record when offer is accepted
      const { error: hireErr } = await supabase.from("recruitment_candidates").update({ hired_at: new Date().toISOString(), stage: "Hired" }).eq("id", candidate.id);
      if (hireErr) throw new Error(hireErr.message);
      const { data: onboardRow, error: onboardErr } = await supabase.from("onboarding_records").insert([{
        employee_name: candidate.name,
        email: candidate.email,
        position: existingOffer.offered_designation || candidate.position,
        department: candidate.department || "",
        start_date: existingOffer.joining_date || null,
        status: "Pending",
        source: "Recruitment",
        candidate_id: candidate.id,
        progress: 0,
      }]).select("id").single();
      if (onboardErr) throw new Error(onboardErr.message);

      // Pre-fill checklist from the first available onboarding template
      if (onboardRow?.id) {
        const { data: templates } = await supabase
          .from("onboarding_templates")
          .select("id, tasks")
          .order("created_at", { ascending: true })
          .limit(1);
        const template = templates?.[0];
        if (template?.tasks?.length) {
          const taskRows = (template.tasks as any[]).map((task: any, idx: number) => ({
            onboarding_id: onboardRow.id,
            title: task.title || task.name || `Task ${idx + 1}`,
            description: task.description || "",
            assigned_to: task.assignedTo || task.assigned_to || "HR",
            status: "Pending",
            due_date: null,
            order: idx,
          }));
          void supabase.from("onboarding_tasks").insert(taskRows);
        }
      }
      // Notify HR admin
      void supabase.from("notifications").insert([{
        user_id: currentUser?.id,
        title: "New Joiner Record Created",
        body: `${candidate.name} has accepted the offer. Onboarding record created — joining on ${existingOffer.joining_date || "TBD"}.`,
        type: "success",
        app_filter: "recruitment",
        is_read: false,
      }]);
      // Integration 2: Recruitment → Invoice (agency billing)
      if (candidate.source === "Agency" && candidate.agency_name) {
        await createAgencyBillingInvoice(candidate, currentUser?.id);
      }
    }
    toast.success(accept ? "Offer accepted — onboarding record created" : "Offer declined");
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-foreground">{t("recruitment.offerGenerate")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{candidate.name} · {candidate.position}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {existingOffer && (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
              existingOffer.status === "accepted" ? "bg-green-50 text-green-700" :
              existingOffer.status === "declined" ? "bg-red-50 text-red-700" :
              existingOffer.status === "negotiating" ? "bg-amber-50 text-amber-700" :
              "bg-blue-50 text-blue-700"}`}>
              {t("recruitment.offerStatus")}: {existingOffer.status}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.offeredDesignation")}</label>
              <input value={form.offered_designation} onChange={(e) => setForm((f) => ({ ...f, offered_designation: e.target.value }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.offeredCTC")} *</label>
              <input value={form.offered_ctc} onChange={(e) => setForm((f) => ({ ...f, offered_ctc: e.target.value }))}
                placeholder="e.g. 12 LPA"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.joiningDate")} *</label>
              <input type="date" value={form.joining_date} onChange={(e) => setForm((f) => ({ ...f, joining_date: e.target.value }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.offerExpiry")}</label>
              <input type="date" value={form.offer_expiry_date} onChange={(e) => setForm((f) => ({ ...f, offer_expiry_date: e.target.value }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.offerTemplate")}</label>
              <select value={form.template_id} onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {OFFER_LETTER_TEMPLATES.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
              </select>
            </div>
            {existingOffer?.status === "negotiating" && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.negotiatedCTC")}</label>
                <input value={form.negotiated_ctc} onChange={(e) => setForm((f) => ({ ...f, negotiated_ctc: e.target.value }))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
          </div>

          <div>
            <button type="button" onClick={() => setPreview((p) => !p)}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <Eye size={12} />{preview ? "Hide" : "Preview"} offer letter
            </button>
            {preview && (
              <div className="mt-2 border border-border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: filledHTML }} className="text-sm" />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between gap-3 p-5 border-t border-border shrink-0">
          <div className="flex gap-2">
            {existingOffer?.status === "sent" && (
              <>
                <button onClick={() => handleAcceptDecline(true)}
                  className="px-3 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">
                  Mark Accepted
                </button>
                <button onClick={() => handleAcceptDecline(false)}
                  className="px-3 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">
                  Mark Declined
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">{t("common.cancel")}</button>
            <button onClick={handleSend} disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
              <Send size={14} />{saving ? "Sending…" : t("recruitment.sendOffer")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== BLACKLIST MODAL ====================

function BlacklistModal({ candidate, onConfirm, onCancel }: { candidate: Candidate; onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-xl p-6 max-w-sm w-full">
        <div className="flex items-center gap-2 mb-3">
          <ShieldOff size={18} className="text-red-500" />
          <h3 className="font-semibold text-foreground">{t("recruitment.blacklist")}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">{t("recruitment.blacklistConfirm")} — <strong>{candidate.name}</strong></p>
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for blacklisting…"
          className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">{t("common.cancel")}</button>
          <button onClick={() => { if (reason.trim()) onConfirm(reason.trim()); }}
            disabled={!reason.trim()}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {t("recruitment.blacklist")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== COMMUNICATION LOG MODAL ====================

function CommunicationLogModal({ candidateId, sentBy, onClose, onSaved }: { candidateId: string; sentBy: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ channel: "email", direction: "outbound" as "inbound" | "outbound", subject: "", body: "" });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.subject.trim() || !form.body.trim()) { toast.error("Subject and body are required"); return; }
    setSaving(true);
    try {
      const { error: commErr } = await supabase.from("recruitment_communication_log").insert([{
        candidate_id: candidateId,
        channel: form.channel,
        direction: form.direction,
        subject: form.subject,
        body: form.body,
        sent_by: sentBy,
        sent_at: new Date().toISOString(),
      }]);
      if (commErr) throw new Error(commErr.message);
      toast.success(t("recruitment.communicationSaved"));
      onSaved();
      onClose();
    } catch { toast.error(t("common.error")); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold text-foreground">{t("recruitment.logCommunication")}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.channel")}</label>
              <select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {["email", "phone", "sms", "in-person", "video-call", "other"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.direction")}</label>
              <select value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as "inbound" | "outbound" }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.subject")}</label>
            <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("recruitment.body")}</label>
            <textarea rows={4} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">{t("common.cancel")}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Saving…" : "Log Communication"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== JOB DETAIL MODAL (applicants view) ====================

interface JobDetailModalProps {
  job: JobPosting;
  applicants: Candidate[];
  onClose: () => void;
  onViewCandidate: (id: string) => void;
}

function JobDetailModal({ job, applicants, onClose, onViewCandidate }: JobDetailModalProps) {
  const salaryRange = job.salaryMin || job.salaryMax ? `${job.salaryMin || "—"} – ${job.salaryMax || "—"}` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-foreground">{job.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{job.department}{job.location ? ` · ${job.location}` : ""}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-3 shrink-0"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Job snapshot */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              ["Type", job.type],
              ["Work Mode", job.workMode],
              ["Experience", job.experience],
              ["Salary Range", salaryRange],
              ["Openings", job.headcount ? String(job.headcount) : null],
              ["Deadline", job.deadline],
              ["Hiring Manager", job.hiringManager],
              ["Status", job.status],
              ["Posted", job.postedDate],
            ].filter(([, v]) => v).map(([label, val]) => (
              <div key={label} className="bg-muted rounded-lg px-3 py-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium text-foreground">{val}</p>
              </div>
            ))}
          </div>

          {/* Required skills */}
          {(job.requiredSkills ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Required Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {(job.requiredSkills ?? []).map((s) => (
                  <span key={s} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-0.5 font-medium">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Benefits */}
          {job.benefits && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Benefits</p>
              <p className="text-sm text-foreground">{job.benefits}</p>
            </div>
          )}

          {/* Description */}
          {job.description && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Job Description</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{job.description}</p>
            </div>
          )}

          {/* Applicants */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Applicants <span className="ml-1 bg-blue-100 text-blue-700 rounded-full px-1.5">{applicants.length}</span>
              </p>
            </div>
            {applicants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm bg-muted rounded-lg">
                <Users size={24} className="mx-auto mb-2 opacity-30" />
                No applicants yet for this position
              </div>
            ) : (
              <div className="space-y-2">
                {applicants.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 border border-border rounded-lg px-3 py-2.5 hover:bg-muted transition-colors">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StageBadge stage={c.stage} />
                      {c.experience ? <span className="text-xs text-muted-foreground">{c.experience}y</span> : null}
                      <button onClick={() => { onClose(); onViewCandidate(c.id); }}
                        className="p-1 text-muted-foreground hover:text-blue-600 rounded" title="View candidate">
                        <Eye size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end p-4 border-t border-border shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Close</button>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export function RecruitmentTracker({ accessToken, onLogout }: { accessToken: string; onLogout: () => void }) {
  const { currentUser } = useUser();
  const roles = currentUser?.roles ?? [];
  const isEditor = canEdit(roles);
  const canViewCandidates = useSectionPermission("recruitment", "view_candidates");
  const canCreateCandidate = useSectionPermission("recruitment", "create_candidate");
  const canScheduleInterviews = useSectionPermission("recruitment", "schedule_interviews");
  const canMakeOffers = useSectionPermission("recruitment", "make_offers");

  const {
    candidates, jobPostings, stats, loading, error, refresh,
    addCandidate, updateCandidate, deleteCandidate, hireCandidate,
    addInterview, addFeedback,
    addJob, updateJob, deleteJob, moveToNextStage, bulkUpload,
  } = useRecruitmentData();

  const [activeTab, setActiveTab] = useState<"pipeline" | "jobs" | "analytics" | "requisitions">("pipeline");
  const [stageFilter, setStageFilter] = useState("All");
  const [pipelineView, setPipelineView] = useState<"list" | "kanban">("list");
  const [search, setSearch] = useState("");

  // Requisitions state
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqStatusFilter, setReqStatusFilter] = useState("All");
  const [reqDeptFilter, setReqDeptFilter] = useState("All");
  const [showReqForm, setShowReqForm] = useState(false);
  const [editingReq, setEditingReq] = useState<Requisition | null>(null);
  const [rejectingReq, setRejectingReq] = useState<Requisition | null>(null);

  const loadRequisitions = useCallback(async () => {
    setReqLoading(true);
    try {
      const { data } = await supabase.from("job_requisitions").select("*").order("created_at", { ascending: false });
      if (data) setRequisitions(data as Requisition[]);
    } catch { /* silent */ }
    finally { setReqLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === "requisitions") loadRequisitions();
  }, [activeTab, loadRequisitions]);

  const handleSaveRequisition = async (data: Partial<Requisition>) => {
    if (editingReq) {
      const { error: reqUpdateErr } = await supabase.from("job_requisitions").update(data).eq("id", editingReq.id);
      if (reqUpdateErr) throw new Error(reqUpdateErr.message);
    } else {
      const { error: reqInsertErr } = await supabase.from("job_requisitions").insert([data]);
      if (reqInsertErr) throw new Error(reqInsertErr.message);
    }
    toast.success(t("recruitment.requisitionSaved"));
    await loadRequisitions();
  };

  const handleApproveReq = async (req: Requisition) => {
    const { error: approveReqErr } = await supabase.from("job_requisitions").update({
      status: "approved",
      approved_by: currentUser?.name ?? currentUser?.email ?? "",
    }).eq("id", req.id);
    if (approveReqErr) throw new Error(approveReqErr.message);
    toast.success(t("recruitment.requisitionApproved"));
    await loadRequisitions();
  };

  const handleRejectReq = async (req: Requisition, reason: string) => {
    const { error: rejectReqErr } = await supabase.from("job_requisitions").update({ status: "rejected", rejection_reason: reason }).eq("id", req.id);
    if (rejectReqErr) throw new Error(rejectReqErr.message);
    toast.success(t("recruitment.requisitionRejected"));
    setRejectingReq(null);
    await loadRequisitions();
  };

  const handleConvertReq = async (req: Requisition) => {
    // Create a job posting from the requisition
    const { data: newJob } = await supabase.from("recruitment_jobs").insert([{
      title: req.title,
      department: req.department,
      location: req.location,
      type: req.employment_type,
      headcount: req.number_of_positions,
      status: "Active",
    }]).select("id").single();
    const { error: convertErr } = await supabase.from("job_requisitions").update({
      status: "converted",
      converted_job_id: newJob?.id ?? null,
    }).eq("id", req.id);
    if (convertErr) throw new Error(convertErr.message);
    if (newJob?.id) {
      await addJob({
        title: req.title,
        department: req.department,
        location: req.location,
        type: req.employment_type,
        headcount: req.number_of_positions,
        status: "Active",
      } as any);
    }
    toast.success(t("recruitment.requisitionConverted"));
    await loadRequisitions();
    await refresh();
  };

  const handleBlacklistCandidate = async (candidateId: string, reason: string) => {
    const { error: blacklistErr } = await supabase.from("recruitment_candidates").update({ blacklisted: true, blacklist_reason: reason }).eq("id", candidateId);
    if (blacklistErr) throw new Error(blacklistErr.message);
    await refresh();
    toast.success("Candidate blacklisted");
  };

  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const selectedCandidate = selectedCandidateId ? (candidates.find((c) => c.id === selectedCandidateId) ?? null) : null;
  const [confirmDelete, setConfirmDelete] = useState<{ type: "candidate" | "job"; id: string } | null>(null);
  const [confirmHire, setConfirmHire] = useState<Candidate | null>(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [viewingJobId, setViewingJobId] = useState<string | null>(null);
  const viewingJob = viewingJobId ? jobPostings.find((j) => j.id === viewingJobId) ?? null : null;

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const matchStage = stageFilter === "All" || c.stage === stageFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || c.name.toLowerCase().includes(q) || c.position.toLowerCase().includes(q) || (c.department ?? "").toLowerCase().includes(q);
      return matchStage && matchSearch;
    });
  }, [candidates, stageFilter, search]);

  const derivedStats = useMemo(() => ({
    total: stats?.totalCandidates ?? candidates.length,
    active: stats?.activeCandidates ?? candidates.filter((c) => c.stage !== "Hired" && c.stage !== "Rejected").length,
    interviews: stats?.interviewsScheduled ?? candidates.reduce((sum, c) => sum + (c.interviews?.filter((i) => i.status === "Scheduled").length ?? 0), 0),
    hired: stats?.hired ?? candidates.filter((c) => c.stage === "Hired").length,
  }), [stats, candidates]);

  if (loading) return <InlineLoader />;

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-500 mb-3">{error}</p>
          <button onClick={refresh} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">{t("retry")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-blue-600 text-white rounded-lg p-1.5 shrink-0"><Users size={18} /></div>
            <div className="min-w-0">
              <h1 className="font-semibold text-foreground text-sm sm:text-base">{t("recruitmentTracker")}</h1>
              {currentUser && (
                <span className="text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5 capitalize">
                  {currentUser.primaryRole}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(isEditor || canCreateCandidate) && (
              <>
                <button onClick={() => setShowBulkUpload(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-muted-foreground text-sm rounded-lg hover:bg-muted">
                  <Upload size={14} /><span className="hidden sm:inline">{t("bulkUpload")}</span>
                </button>
                <button onClick={() => { setEditingCandidate(null); setShowCandidateForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                  <Plus size={14} /><span className="hidden sm:inline">{t("addCandidate")}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Users} label={t("totalCandidates")} value={derivedStats.total} color="bg-blue-50 text-blue-600" />
          <StatCard icon={Briefcase} label={t("activePipeline")} value={derivedStats.active} color="bg-orange-50 text-orange-600" />
          <StatCard icon={Calendar} label={t("interviewsScheduled")} value={derivedStats.interviews} color="bg-yellow-50 text-yellow-600" />
          <StatCard icon={CheckCircle} label={t("hiredThisMonth")} value={derivedStats.hired} color="bg-green-50 text-green-600" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border overflow-x-auto scrollbar-hide">
          {([
            { id: "pipeline", label: "Pipeline" },
            { id: "jobs", label: "Jobs" },
            { id: "requisitions", label: t("recruitment.requisitions") },
            { id: "analytics", label: "Analytics" },
          ] as const).map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.id ? "border-b-2 border-blue-600 text-blue-600" : "text-muted-foreground hover:text-foreground"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Pipeline tab */}
        {activeTab === "pipeline" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1 border border-border rounded-lg p-0.5">
                <button onClick={() => setPipelineView("list")} className={`px-3 py-1 text-xs rounded ${pipelineView === "list" ? "bg-blue-600 text-white" : "text-muted-foreground"}`}>{t("recruitment.listView")}</button>
                <button onClick={() => setPipelineView("kanban")} className={`px-3 py-1 text-xs rounded ${pipelineView === "kanban" ? "bg-blue-600 text-white" : "text-muted-foreground"}`}>{t("recruitment.kanbanView")}</button>
              </div>
              {pipelineView === "list" && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
                  {["All", ...RECRUITMENT_STAGES].map((s) => (
                    <button key={s} onClick={() => setStageFilter(s)}
                      className={`shrink-0 px-3 py-1.5 text-xs rounded-full border transition-colors ${stageFilter === s ? "bg-blue-600 text-white border-blue-600" : "border-border text-muted-foreground hover:border-blue-300"}`}>
                      {s}
                      {s !== "All" && (
                        <span className="ml-1 opacity-70">({candidates.filter((c) => c.stage === s).length})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {pipelineView === "list" && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchCandidates")}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}

            {pipelineView === "kanban" && (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {RECRUITMENT_STAGES.map((stage) => {
                  const stageCandidates = candidates.filter((c) => c.stage === stage);
                  const stageIndex = RECRUITMENT_STAGES.indexOf(stage);
                  const nextStage = stageIndex < RECRUITMENT_STAGES.length - 1 ? RECRUITMENT_STAGES[stageIndex + 1] : null;
                  return (
                    <div key={stage} className="min-w-[220px] flex-1 flex flex-col gap-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-semibold text-foreground">{stage}</span>
                        <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">{stageCandidates.length}</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {stageCandidates.map((c) => (
                          <div key={c.id} onClick={() => setSelectedCandidateId(c.id)}
                            className="bg-card rounded-lg border border-border p-3 space-y-2 cursor-pointer hover:shadow-sm transition-shadow">
                            <div>
                              <p className="text-sm font-medium text-foreground leading-tight">{c.name}</p>
                              <p className="text-xs text-muted-foreground">{c.position}</p>
                            </div>
                            {c.experience != null && (
                              <p className="text-xs text-muted-foreground">{c.experience} yrs exp.</p>
                            )}
                            <StageBadge stage={c.stage} />
                            {nextStage && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const { error: stageErr } = await supabase.from("recruitment_candidates").update({ stage: nextStage }).eq("id", c.id);
                                  if (stageErr) throw new Error(stageErr.message);
                                  void refresh();
                                }}
                                className="w-full text-xs px-2 py-1 border border-border rounded hover:bg-muted text-muted-foreground transition-colors">
                                {t("recruitment.moveToNext")}
                              </button>
                            )}
                          </div>
                        ))}
                        {stageCandidates.length === 0 && (
                          <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">No candidates</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {pipelineView === "list" && <div className="bg-card rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left px-4 py-3 font-medium">{t("candidate")}</th>
                    <th className="text-left px-4 py-3 font-medium">{t("stage")}</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">{t("source")}</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">{t("appliedDate")}</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">{t("experience")}</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">{t("salary")}</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Skills</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">{t("noCandidates")}</td></tr>
                  )}
                  {filteredCandidates.map((c) => {
                    const needsFb = INTERVIEW_STAGES.includes(c.stage) && (c.feedback ?? []).length === 0;
                    const isBlacklisted = (c as any).blacklisted;
                    return (
                      <tr key={c.id} onClick={() => setSelectedCandidateId(c.id)}
                        className={`group border-b border-gray-50 hover:bg-muted transition-colors cursor-pointer ${isBlacklisted ? "opacity-60" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium text-foreground">{c.name}</p>
                                {isBlacklisted && (
                                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                                    <ShieldOff size={9} />Blacklisted
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{c.position}</p>
                            </div>
                            {needsFb && (
                              <span title="Feedback required before advancing">
                                <AlertCircle size={13} className="text-amber-500" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3"><StageBadge stage={c.stage} /></td>
                        <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{c.source}</td>
                        <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{c.appliedDate}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{c.experience ? `${c.experience} yrs` : "—"}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{c.expectedSalary || "—"}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {(c.skills ?? []).slice(0, 3).map((s) => (
                              <span key={s} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{s}</span>
                            ))}
                            {(c.skills ?? []).length > 3 && (
                              <span className="text-xs text-muted-foreground">+{(c.skills ?? []).length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            <button title={t("view")} onClick={(e) => { e.stopPropagation(); setSelectedCandidateId(c.id); }}
                              className="p-1.5 text-muted-foreground hover:text-blue-600 rounded"><Eye size={14} /></button>
                            {(isEditor || canCreateCandidate) && (
                              <>
                                <button title={t("edit")} onClick={(e) => { e.stopPropagation(); setEditingCandidate(c); setShowCandidateForm(true); }}
                                  className="p-1.5 text-muted-foreground hover:text-blue-600 rounded"><Edit2 size={14} /></button>
                                <button title={needsFb ? t("feedbackRequired") : t("nextStage")}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try { await moveToNextStage(c.id); await refresh(); }
                                    catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Cannot advance stage"); }
                                  }}
                                  className={`p-1.5 rounded ${needsFb ? "text-amber-400 hover:text-amber-600" : "text-muted-foreground hover:text-orange-500"}`}>
                                  <ArrowRight size={14} />
                                </button>
                                {(isEditor || canMakeOffers) && (c.stage === "Offer Sent" || c.stage === "Offer Accepted") && (
                                  <button title={t("hire")} onClick={(e) => { e.stopPropagation(); setConfirmHire(c); }}
                                    className="p-1.5 text-muted-foreground hover:text-green-600 rounded"><CheckCircle size={14} /></button>
                                )}
                                {(isEditor || canMakeOffers) && (
                                  <button title={t("generateOffer")} onClick={(e) => { e.stopPropagation(); setSelectedCandidateId(c.id); }}
                                    className="p-1.5 text-muted-foreground hover:text-purple-600 rounded"><FileText size={14} /></button>
                                )}
                                <button title={t("delete")} onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: "candidate", id: c.id }); }}
                                  className="p-1.5 text-muted-foreground hover:text-red-500 rounded"><Trash2 size={14} /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>}
          </div>
        )}

        {/* Requisitions tab */}
        {activeTab === "requisitions" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <select value={reqStatusFilter} onChange={(e) => setReqStatusFilter(e.target.value)}
                  className="text-sm border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="All">All Statuses</option>
                  {REQUISITION_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
                <select value={reqDeptFilter} onChange={(e) => setReqDeptFilter(e.target.value)}
                  className="text-sm border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="All">All Departments</option>
                  {[...new Set(requisitions.map((r) => r.department))].filter(Boolean).map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              {isEditor && (
                <button onClick={() => { setEditingReq(null); setShowReqForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                  <Plus size={14} />{t("recruitment.newRequisition")}
                </button>
              )}
            </div>

            {reqLoading && (
              <div className="text-center py-8 text-muted-foreground text-sm">Loading requisitions…</div>
            )}

            {!reqLoading && requisitions.length === 0 && (
              <div className="text-center py-16 bg-card rounded-xl border border-border text-muted-foreground">
                <FileText size={32} className="mx-auto mb-3 opacity-30" />
                <p>No requisitions found. Create one to get started.</p>
              </div>
            )}

            {!reqLoading && (
              <div className="bg-card rounded-xl border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left px-4 py-3 font-medium">Title</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">{t("common.department")}</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Positions</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">{t("recruitment.priority")}</th>
                      <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Requested By</th>
                      <th className="text-left px-4 py-3 font-medium">{t("common.status")}</th>
                      <th className="text-left px-4 py-3 font-medium">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requisitions
                      .filter((r) => (reqStatusFilter === "All" || r.status === reqStatusFilter) && (reqDeptFilter === "All" || r.department === reqDeptFilter))
                      .map((req) => (
                        <tr key={req.id} className="border-b border-gray-50 hover:bg-muted transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{req.title}</p>
                            <p className="text-xs text-muted-foreground">{req.employment_type}</p>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{req.department}</td>
                          <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{req.number_of_positions}</td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              req.priority === "urgent" ? "bg-red-100 text-red-700" :
                              req.priority === "high" ? "bg-orange-100 text-orange-700" :
                              req.priority === "medium" ? "bg-yellow-100 text-yellow-700" :
                              "bg-gray-100 text-gray-600"}`}>
                              {req.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{req.requested_by}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              req.status === "approved" ? "bg-green-100 text-green-700" :
                              req.status === "rejected" ? "bg-red-100 text-red-700" :
                              req.status === "converted" ? "bg-indigo-100 text-indigo-700" :
                              req.status === "submitted" ? "bg-blue-100 text-blue-700" :
                              "bg-gray-100 text-gray-600"}`}>
                              {req.status}
                            </span>
                            {req.rejection_reason && (
                              <p className="text-xs text-red-500 mt-0.5 max-w-32 truncate" title={req.rejection_reason}>
                                {req.rejection_reason}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {isEditor && req.status === "submitted" && (
                                <>
                                  <button onClick={() => handleApproveReq(req)}
                                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                                    {t("recruitment.approveRequisition")}
                                  </button>
                                  <button onClick={() => setRejectingReq(req)}
                                    className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">
                                    {t("recruitment.rejectRequisition")}
                                  </button>
                                </>
                              )}
                              {isEditor && req.status === "approved" && (
                                <button onClick={() => handleConvertReq(req)}
                                  className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 whitespace-nowrap">
                                  {t("recruitment.convertToJob")}
                                </button>
                              )}
                              {isEditor && req.status !== "converted" && (
                                <button onClick={() => { setEditingReq(req); setShowReqForm(true); }}
                                  className="p-1 text-muted-foreground hover:text-blue-600 rounded">
                                  <Edit2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    {requisitions.filter((r) => (reqStatusFilter === "All" || r.status === reqStatusFilter) && (reqDeptFilter === "All" || r.department === reqDeptFilter)).length === 0 && (
                      <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No requisitions match current filters</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Job Postings tab */}
        {activeTab === "jobs" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{jobPostings.length} posting{jobPostings.length !== 1 ? "s" : ""}</p>
              {(isEditor || canCreateCandidate) && (
                <button onClick={() => { setEditingJob(null); setShowJobForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                  <Plus size={14} />{t("addJob")}
                </button>
              )}
            </div>

            {jobPostings.length === 0 && (
              <div className="text-center py-16 text-muted-foreground text-sm bg-card rounded-xl border border-border">
                <Briefcase size={32} className="mx-auto mb-3 opacity-30" />
                <p>{t("noJobs")}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {jobPostings.map((j) => {
                const applicantCandidates = candidates.filter((c) => c.position.toLowerCase().trim() === j.title.toLowerCase().trim());
                const alreadyApplied = applicantCandidates.some((c) => c.email?.toLowerCase() === currentUser?.email?.toLowerCase());
                const salaryRange = j.salaryMin || j.salaryMax ? `${j.salaryMin || "?"}${j.salaryMax ? ` – ${j.salaryMax}` : "+"}` : null;
                return (
                  <div key={j.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground text-sm leading-snug">{j.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{j.department}{j.location ? ` · ${j.location}` : ""}</p>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${j.status === "Active" ? "bg-green-100 text-green-700" : j.status === "Draft" ? "bg-gray-100 text-gray-500" : j.status === "On Hold" ? "bg-yellow-100 text-yellow-700" : "bg-red-50 text-red-600"}`}>
                        {j.status}
                      </span>
                    </div>

                    {/* Meta chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {j.type && <span className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-0.5">{j.type}</span>}
                      {j.workMode && <span className="text-xs bg-purple-50 text-purple-700 rounded px-2 py-0.5">{j.workMode}</span>}
                      {j.experience && <span className="text-xs bg-muted text-muted-foreground rounded px-2 py-0.5">{j.experience}</span>}
                      {salaryRange && <span className="text-xs bg-green-50 text-green-700 rounded px-2 py-0.5">{salaryRange}</span>}
                      {j.headcount && j.headcount > 1 && <span className="text-xs bg-orange-50 text-orange-700 rounded px-2 py-0.5">{j.headcount} openings</span>}
                    </div>

                    {/* Required skills preview */}
                    {(j.requiredSkills ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(j.requiredSkills ?? []).slice(0, 4).map((s) => (
                          <span key={s} className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{s}</span>
                        ))}
                        {(j.requiredSkills ?? []).length > 4 && (
                          <span className="text-xs text-muted-foreground">+{(j.requiredSkills ?? []).length - 4} more</span>
                        )}
                      </div>
                    )}

                    {/* Description snippet */}
                    {j.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{j.description}</p>
                    )}

                    {/* Footer row */}
                    <div className="flex items-center justify-between gap-2 pt-1 mt-auto border-t border-border">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <button onClick={() => setViewingJobId(j.id)}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                          <Users size={12} />
                          <span>{applicantCandidates.length} applicant{applicantCandidates.length !== 1 ? "s" : ""}</span>
                        </button>
                        {j.deadline && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {j.deadline}
                          </span>
                        )}
                        {j.hiringManager && (
                          <span className="truncate max-w-24" title={j.hiringManager}>{j.hiringManager}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/* Employee apply button */}
                        {!isEditor && j.status === "Active" && (
                          <button
                            disabled={alreadyApplied}
                            onClick={async () => {
                              if (!currentUser) return;
                              try {
                                await addCandidate({
                                  name: currentUser.name ?? currentUser.email ?? "Employee",
                                  email: currentUser.email ?? "",
                                  phone: "",
                                  position: j.title,
                                  department: j.department,
                                  source: "Internal",
                                  experience: 0,
                                  expectedSalary: "",
                                  noticePeriod: "",
                                  stage: "Applied",
                                  appliedDate: new Date().toISOString().slice(0, 10),
                                  skills: [],
                                } as any);
                                await refresh();
                                toast.success("Your application has been submitted!");
                              } catch (err: unknown) {
                                toast.error(err instanceof Error ? err.message : "Failed to apply");
                              }
                            }}
                            className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${alreadyApplied ? "bg-green-50 text-green-600 cursor-default" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                            {alreadyApplied ? "Applied" : "Apply Now"}
                          </button>
                        )}
                        {isEditor && (
                          <>
                            <button onClick={() => setViewingJobId(j.id)}
                              className="p-1.5 text-muted-foreground hover:text-blue-600 rounded" title="View applicants">
                              <Eye size={13} />
                            </button>
                            <button onClick={() => { setEditingJob(j); setShowJobForm(true); }}
                              className="p-1.5 text-muted-foreground hover:text-blue-600 rounded" title="Edit">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => setConfirmDelete({ type: "job", id: j.id })}
                              className="p-1.5 text-muted-foreground hover:text-red-500 rounded" title="Delete">
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Analytics tab */}
        {activeTab === "analytics" && (() => {
          const now = new Date();
          const thisMonth = now.getMonth();
          const thisYear = now.getFullYear();
          const funnelStages = ["Applied", "Screening", "Interview Scheduled", "Offer Sent", "Hired"];
          const funnelColors = ["bg-indigo-500", "bg-blue-500", "bg-amber-500", "bg-orange-500", "bg-green-500"];
          const funnelCounts = funnelStages.map((s) => candidates.filter((c) => c.stage === s).length);
          const funnelMax = Math.max(...funnelCounts, 1);
          const sourceMap: Record<string, { total: number; hired: number }> = {};
          candidates.forEach((c) => {
            const src = c.source ?? "Unknown";
            if (!sourceMap[src]) sourceMap[src] = { total: 0, hired: 0 };
            sourceMap[src].total++;
            if (c.stage === "Hired") sourceMap[src].hired++;
          });
          const sourceRows = Object.entries(sourceMap)
            .map(([source, data]) => ({ source, ...data, rate: data.total > 0 ? Math.round((data.hired / data.total) * 100) : 0 }))
            .sort((a, b) => b.rate - a.rate);
          const hiredCandidates = candidates.filter((c) => c.stage === "Hired" && c.appliedDate);
          const avgDaysToHire = hiredCandidates.length > 0
            ? Math.round(hiredCandidates.reduce((sum, c) => {
                return sum + Math.max(0, Math.round((Date.now() - new Date(c.appliedDate!).getTime()) / 86400000));
              }, 0) / hiredCandidates.length)
            : 0;
          const activeJobs = jobPostings.filter((j) => j.status === "Active").length;
          const candidatesThisMonth = candidates.filter((c) => {
            if (!c.appliedDate) return false;
            const d = new Date(c.appliedDate);
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
          }).length;
          const totalCands = candidates.length;
          const totalHired = candidates.filter((c) => c.stage === "Hired").length;
          const hireRate = totalCands > 0 ? Math.round((totalHired / totalCands) * 100) : 0;
          const pendingFeedback = candidates.filter((c) => INTERVIEW_STAGES.includes(c.stage) && (c.feedback ?? []).length === 0).length;

          return (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Active Jobs", value: activeJobs, color: "bg-blue-50 text-blue-600", icon: Briefcase },
                  { label: "This Month", value: candidatesThisMonth, color: "bg-indigo-50 text-indigo-600", icon: Users },
                  { label: "Hire Rate", value: `${hireRate}%`, color: "bg-green-50 text-green-600", icon: CheckCircle },
                  { label: "Awaiting Feedback", value: pendingFeedback, color: pendingFeedback > 0 ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-500", icon: Star },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} className="bg-card rounded-xl border border-border px-4 py-3 flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${color}`}><Icon size={16} /></div>
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-xl font-bold text-foreground">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card rounded-xl border border-border p-5">
                  <h3 className="font-semibold text-foreground mb-4 text-sm">Pipeline Funnel</h3>
                  <div className="space-y-3">
                    {funnelStages.map((stage, i) => (
                      <div key={stage} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">{stage}</span>
                        <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                          <div className={`h-full ${funnelColors[i]} rounded-full flex items-center justify-end pr-2 transition-all`}
                            style={{ width: `${Math.max((funnelCounts[i] / funnelMax) * 100, funnelCounts[i] > 0 ? 8 : 0)}%` }}>
                            {funnelCounts[i] > 0 && <span className="text-white text-xs font-medium">{funnelCounts[i]}</span>}
                          </div>
                        </div>
                        {funnelCounts[i] === 0 && <span className="text-xs text-muted-foreground">0</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-card rounded-xl border border-border p-5 flex flex-col justify-center items-center text-center">
                  <p className="text-xs text-muted-foreground mb-2">Avg. Time to Hire</p>
                  <p className="text-5xl font-bold text-blue-600">{avgDaysToHire}</p>
                  <p className="text-sm text-muted-foreground mt-1">days</p>
                  <p className="text-xs text-muted-foreground mt-3">Based on {hiredCandidates.length} hired</p>
                </div>
              </div>

              {/* Source Bar Chart */}
              {sourceRows.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-5">
                  <h3 className="font-semibold text-foreground text-sm mb-4 flex items-center gap-2">
                    <BarChart2 size={14} className="text-indigo-500" />Source Volume
                  </h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={sourceRows} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                      <XAxis dataKey="source" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Bar dataKey="total" name="Candidates" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="hired" name="Hired" fill="#22c55e" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h3 className="font-semibold text-foreground text-sm">Source Effectiveness</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-50 text-xs text-muted-foreground">
                        <th className="text-left px-5 py-3 font-medium">Source</th>
                        <th className="text-left px-5 py-3 font-medium">Candidates</th>
                        <th className="text-left px-5 py-3 font-medium">Hired</th>
                        <th className="text-left px-5 py-3 font-medium">Conversion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceRows.length === 0 && (
                        <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">No candidate data yet</td></tr>
                      )}
                      {sourceRows.map((row) => (
                        <tr key={row.source} className="border-b border-gray-50 hover:bg-muted">
                          <td className="px-5 py-3 font-medium text-foreground">{row.source}</td>
                          <td className="px-5 py-3 text-muted-foreground">{row.total}</td>
                          <td className="px-5 py-3 text-muted-foreground">{row.hired}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-muted rounded-full h-1.5">
                                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${row.rate}%` }} />
                              </div>
                              <span className={`text-xs font-medium ${row.rate >= 50 ? "text-green-600" : row.rate >= 20 ? "text-amber-600" : "text-muted-foreground"}`}>{row.rate}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Modals */}
      {showCandidateForm && (
        <CandidateForm
          initial={editingCandidate ?? undefined}
          existingCandidates={candidates}
          onClose={() => { setShowCandidateForm(false); setEditingCandidate(null); }}
          onViewDuplicate={(dup) => { setShowCandidateForm(false); setEditingCandidate(null); setSelectedCandidateId(dup.id); }}
          onSave={async (data) => {
            if (editingCandidate) {
              await updateCandidate(editingCandidate.id, data);
              toast.success(t("candidateUpdated"));
            } else {
              await addCandidate(data as Parameters<typeof addCandidate>[0]);
              toast.success(t("candidateAdded"));
            }
            await refresh();
          }}
        />
      )}

      {showJobForm && (
        <JobForm
          initial={editingJob ?? undefined}
          onClose={() => { setShowJobForm(false); setEditingJob(null); }}
          onSave={async (data) => {
            if (editingJob) {
              await updateJob(editingJob.id, data);
              toast.success(t("jobUpdated"));
            } else {
              await addJob(data as Parameters<typeof addJob>[0]);
              toast.success(t("jobAdded"));
            }
            await refresh();
          }}
        />
      )}

      {showBulkUpload && (
        <BulkUploadModal
          onClose={() => setShowBulkUpload(false)}
          onUpload={bulkUpload}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={t("confirmDelete")}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            try {
              if (confirmDelete.type === "candidate") await deleteCandidate(confirmDelete.id);
              else await deleteJob(confirmDelete.id);
              toast.success(t("deleted"));
              await refresh();
            } catch (err: unknown) {
              toast.error(err instanceof Error ? err.message : "Failed");
            } finally {
              setConfirmDelete(null);
            }
          }}
        />
      )}

      {showReqForm && (
        <RequisitionForm
          initial={editingReq ?? undefined}
          onClose={() => { setShowReqForm(false); setEditingReq(null); }}
          onSave={handleSaveRequisition}
        />
      )}

      {rejectingReq && (
        <RejectRequisitionModal
          onCancel={() => setRejectingReq(null)}
          onConfirm={(reason) => handleRejectReq(rejectingReq, reason)}
        />
      )}

      {confirmHire && (
        <ConfirmDialog
          message={`${t("confirmHire")} — ${confirmHire.name}?`}
          onCancel={() => setConfirmHire(null)}
          onConfirm={async () => {
            try {
              await hireCandidate(confirmHire.id, confirmHire.name, confirmHire.email, confirmHire.position, confirmHire.department);
              await refresh();
            } catch (err: unknown) {
              toast.error(err instanceof Error ? err.message : "Failed to hire");
            } finally {
              setConfirmHire(null);
            }
          }}
        />
      )}

      {viewingJob && (
        <JobDetailModal
          job={viewingJob}
          applicants={candidates.filter((c) => c.position.toLowerCase().trim() === viewingJob.title.toLowerCase().trim())}
          onClose={() => setViewingJobId(null)}
          onViewCandidate={(id) => { setViewingJobId(null); setSelectedCandidateId(id); setActiveTab("pipeline"); }}
        />
      )}

      {selectedCandidate && (
        <CandidateDrawer
          candidate={selectedCandidate}
          isEditor={isEditor || canScheduleInterviews}
          onClose={() => setSelectedCandidateId(null)}
          onAddInterview={async (id, data) => { await addInterview(id, data); }}
          onAddFeedback={async (id, data) => { await addFeedback(id, data); }}
          onOfferSaved={() => refresh()}
          onBlacklist={async (reason) => { await handleBlacklistCandidate(selectedCandidate.id, reason); setSelectedCandidateId(null); }}
        />
      )}
    </div>
  );
}

export default RecruitmentTracker;
