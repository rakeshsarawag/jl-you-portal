/**
 * Invoice Generation System
 * Tabs: Invoices | Clients | Templates | Create Invoice | Analytics
 * Features: Client management, invoice templates, partial payment tracking,
 *           paginated invoice list, analytics date range filter
 */

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router";
import { useAuditLogger } from "../../../hooks/useAuditLogger";
import { t } from "../../../i18n/index";
import { useInvoiceData, Invoice, InvoiceLineItem, BillToItem } from "../../hooks/useInvoiceData";
import { useUser } from "../../context/UserContext";
import { supabase } from "../../utils/constants";
import EmployeeSearchDropdown from "../ui/EmployeeSearchDropdown";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import {
  FileText,
  Plus,
  Trash2,
  Send,
  CheckCircle,
  Eye,
  Search,
  X,
  ChevronDown,
  Pencil,
  Users,
  LayoutTemplate,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  RefreshCw,
  Pause,
  Play,
  Mail,
  Ban,
  Globe,
} from "lucide-react";
import { INVOICE_STATUSES } from "../../../constants/apps/invoice";
import { SelectOptions } from "../../context/ValueHelpsContext";
import ReportDefectButton from "../ReportDefectButton";

// ---- Types ---------------------------------------------------------------

type InvoiceStatus = Invoice["status"];

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  gst_number?: string;
  pan_number?: string;
  currency?: string;
  payment_terms?: string;
  notes?: string;
  is_active: boolean;
  created_by?: string;
}

interface InvoiceTemplate {
  id: string;
  name: string;
  description?: string;
  line_items?: InvoiceLineItem[];
  notes_template?: string;
  payment_terms?: string;
  tax_rate?: number;
  is_default?: boolean;
}

interface InvoicePayment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference?: string;
  notes?: string;
  recorded_by?: string;
}

// ---- Additional Types ---------------------------------------------------

type RecurringFrequency = "weekly" | "monthly" | "quarterly" | "annually";
type RecurringStatus = "active" | "paused" | "completed";

interface RecurringInvoiceConfig {
  id: string;
  template_id?: string;
  client_id: string;
  frequency: RecurringFrequency;
  start_date: string;
  end_date?: string;
  next_run_date?: string;
  auto_send: boolean;
  status: RecurringStatus;
  created_by?: string;
  // joined
  client_name?: string;
  client_email?: string;
}

type SupplyType = "interstate" | "intrastate";

// ---- Helpers -------------------------------------------------------------

function statusBadge(status: InvoiceStatus) {
  const map: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-700",
    Sent: "bg-blue-100 text-blue-700",
    Paid: "bg-green-100 text-green-700",
    Unpaid: "bg-yellow-100 text-yellow-700",
    Overdue: "bg-red-100 text-red-700",
    Cancelled: "bg-gray-100 text-gray-500",
    "Partially Paid": "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

function fmt(amount: number, symbol = "$") {
  return `${symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso?: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Number-to-words converter (Indian context, up to crores)
function numberToWords(n: number): string {
  if (n === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function belowThousand(num: number): string {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
    return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + belowThousand(num % 100) : "");
  }

  const intPart = Math.floor(n);
  let result = "";
  if (intPart >= 10000000) { result += belowThousand(Math.floor(intPart / 10000000)) + " Crore "; n = intPart % 10000000; } else { n = intPart; }
  if (n >= 100000) { result += belowThousand(Math.floor(n / 100000)) + " Lakh "; n %= 100000; }
  if (n >= 1000) { result += belowThousand(Math.floor(n / 1000)) + " Thousand "; n %= 1000; }
  if (n > 0) result += belowThousand(n);
  return "Rupees " + result.trim() + " Only";
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateGSTIN(gstin: string) {
  return gstin.length === 15;
}

// ---- Hooks ---------------------------------------------------------------

function useClients(activeOnly = false) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("clients").select("*").order("name");
    if (activeOnly) query = (query as any).eq("is_active", true);
    const { data } = await query;
    setClients((data as Client[]) ?? []);
    setLoading(false);
  }, [activeOnly]);

  useEffect(() => { void fetchClients(); }, [fetchClients]);

  return { clients, loading, refresh: fetchClients };
}

function useTemplates() {
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("invoice_templates").select("*").order("name");
    setTemplates((data as InvoiceTemplate[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchTemplates(); }, [fetchTemplates]);

  return { templates, loading, refresh: fetchTemplates };
}

function useInvoicePayments(invoiceId: string | null) {
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPayments = useCallback(async () => {
    if (!invoiceId) { setPayments([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("invoice_payments")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("payment_date", { ascending: false });
    setPayments((data as InvoicePayment[]) ?? []);
    setLoading(false);
  }, [invoiceId]);

  useEffect(() => { void fetchPayments(); }, [fetchPayments]);

  return { payments, loading, refresh: fetchPayments };
}

function useRecurringConfigs() {
  const [configs, setConfigs] = useState<RecurringInvoiceConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("recurring_invoice_configs")
      .select("*, clients(name, email)")
      .order("created_at", { ascending: false });
    const mapped = (data ?? []).map((r: Record<string, unknown>) => ({
      ...(r as RecurringInvoiceConfig),
      client_name: (r.clients as { name: string; email: string } | null)?.name ?? "",
      client_email: (r.clients as { name: string; email: string } | null)?.email ?? "",
    }));
    setConfigs(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchConfigs(); }, [fetchConfigs]);

  return { configs, loading, refresh: fetchConfigs };
}

// ---- Client Form Modal ---------------------------------------------------

interface ClientFormProps {
  client?: Client | null;
  onClose: () => void;
  onSaved: () => void;
  currentUserId?: string;
}

function ClientFormModal({ client, onClose, onSaved, currentUserId }: ClientFormProps) {
  const [name, setName] = useState(client?.name ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [address, setAddress] = useState(client?.address ?? "");
  const [city, setCity] = useState(client?.city ?? "");
  const [country, setCountry] = useState(client?.country ?? "");
  const [gstNumber, setGstNumber] = useState(client?.gst_number ?? "");
  const [panNumber, setPanNumber] = useState(client?.pan_number ?? "");
  const [currency, setCurrency] = useState(client?.currency ?? "USD");
  const [paymentTerms, setPaymentTerms] = useState(client?.payment_terms ?? "NET30");
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { toast.error(t("invoice.nameRequired")); return; }
    if (!email.trim()) { toast.error(t("invoice.emailRequired")); return; }
    if (!validateEmail(email)) { toast.error(t("invoice.emailInvalid")); return; }
    if (gstNumber && !validateGSTIN(gstNumber)) { toast.error(t("invoice.gstinRequired15")); return; }

    setSaving(true);
    try {
      const payload: Partial<Client> = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        country: country.trim() || undefined,
        gst_number: gstNumber.trim() || undefined,
        pan_number: panNumber.trim() || undefined,
        currency: currency || "USD",
        payment_terms: paymentTerms || "NET30",
        notes: notes.trim() || undefined,
        is_active: true,
      };

      if (client?.id) {
        const { error } = await supabase.from("clients").update(payload).eq("id", client.id);
        if (error) throw new Error(error.message);
      } else {
        if (currentUserId) payload.created_by = currentUserId;
        const { error } = await supabase.from("clients").insert([payload]);
        if (error) throw new Error(error.message);
      }

      toast.success(t("invoice.clientSaved"));
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  const field = "w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const label = "block text-sm font-medium text-foreground mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-foreground">
            {client ? t("invoice.editClient") : t("invoice.addClient")}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>{t("invoice.clientName")} *</label>
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" />
            </div>
            <div>
              <label className={label}>{t("invoice.clientEmail")} *</label>
              <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="billing@acme.com" />
            </div>
            <div>
              <label className={label}>{t("invoice.clientPhone")}</label>
              <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
            </div>
            <div>
              <label className={label}>{t("invoice.gstNumber")}</label>
              <input className={field} value={gstNumber} onChange={(e) => setGstNumber(e.target.value.toUpperCase())} placeholder="15-char GSTIN" maxLength={15} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>{t("invoice.clientAddress")}</label>
              <input className={field} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" />
            </div>
            <div>
              <label className={label}>{t("invoice.clientCity")}</label>
              <input className={field} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
            </div>
            <div>
              <label className={label}>{t("invoice.clientCountry")}</label>
              <input className={field} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" />
            </div>
            <div>
              <label className={label}>{t("invoice.currency")}</label>
              <div className="relative">
                <select className={`${field} appearance-none pr-8`} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {["USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD", "AED"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={label}>{t("invoice.paymentTerms")}</label>
              <div className="relative">
                <select className={`${field} appearance-none pr-8`} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
                  {["NET15", "NET30", "NET45", "NET60"].map((pt) => (
                    <option key={pt} value={pt}>{pt}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className={label}>{t("invoice.clientNotes")}</label>
              <textarea className={`${field} resize-none`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={onClose} disabled={saving} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
              {t("common.cancel")}
            </button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Client Detail Slide-Over -------------------------------------------

function ClientDetailPanel({ client, onClose }: { client: Client; onClose: () => void }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientNotes, setClientNotes] = useState(client.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(client.notes ?? "");
  const [clientMetrics, setClientMetrics] = useState<{
    totalBilled: number;
    amountPaid: number;
    outstanding: number;
    openCount: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [invRes, payRes] = await Promise.all([
        supabase.from("invoices").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("invoice_payments").select("*").order("payment_date", { ascending: false }).limit(20),
      ]);
      const allInvoices = (invRes.data as Invoice[]) ?? [];
      setInvoices(allInvoices);
      setPayments((payRes.data as InvoicePayment[]) ?? []);

      // Compute 4 metrics from client invoices
      const totalBilled = allInvoices.reduce((s, i) => s + (i.total ?? 0), 0);
      const amountPaid = allInvoices.filter((i) => i.status === "Paid").reduce((s, i) => s + (i.total ?? 0), 0);
      const outstanding = allInvoices
        .filter((i) => i.status === "Sent" || i.status === "Overdue" || i.status === ("Partially Paid" as string))
        .reduce((s, i) => s + ((i.total ?? 0) - (i.amountPaid ?? 0)), 0);
      const openCount = allInvoices.filter((i) => i.status === "Sent" || i.status === "Overdue" || i.status === ("Partially Paid" as string)).length;
      setClientMetrics({ totalBilled, amountPaid, outstanding, openCount });
      setLoading(false);
    }
    void load();
  }, [client.id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="bg-card w-full max-w-2xl h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-foreground">{client.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{client.email}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 p-6 space-y-6">
          {/* 4-metric summary tiles */}
          {clientMetrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground font-medium mb-1">Total Billed</p>
                <p className="text-sm font-bold text-foreground">{fmt(clientMetrics.totalBilled)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground font-medium mb-1">Amount Paid</p>
                <p className="text-sm font-bold text-green-700">{fmt(clientMetrics.amountPaid)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground font-medium mb-1">Outstanding</p>
                <p className="text-sm font-bold text-orange-700">{fmt(clientMetrics.outstanding)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground font-medium mb-1">Open Invoices</p>
                <p className="text-sm font-bold text-blue-700">{clientMetrics.openCount}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            {client.phone && <InfoRow label={t("invoice.clientPhone")} value={client.phone} />}
            {client.city && <InfoRow label={t("invoice.clientCity")} value={client.city} />}
            {client.country && <InfoRow label={t("invoice.clientCountry")} value={client.country} />}
            {client.gst_number && <InfoRow label={t("invoice.gstNumber")} value={client.gst_number} />}
            {client.currency && <InfoRow label={t("invoice.currency")} value={client.currency} />}
            {client.payment_terms && <InfoRow label={t("invoice.paymentTerms")} value={client.payment_terms} />}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (
            <>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">{t("invoice.clientInvoiceHistory")}</h3>
                {invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("invoice.noInvoicesFound")}</p>
                ) : (
                  <div className="space-y-2">
                    {invoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between text-sm border border-border rounded-xl p-3">
                        <div>
                          <p className="font-medium text-foreground">{inv.invoiceNumber}</p>
                          <p className="text-muted-foreground">{fmtDate(inv.invoiceDate)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-foreground">{fmt(inv.total, inv.currencySymbol)}</p>
                          {statusBadge(inv.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">{t("invoice.clientPaymentHistory")}</h3>
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("invoice.noPayments")}</p>
                ) : (
                  <div className="space-y-2">
                    {payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-sm border border-border rounded-xl p-3">
                        <div>
                          <p className="font-medium text-foreground">{fmt(p.amount)}</p>
                          <p className="text-muted-foreground">{p.payment_method} · {fmtDate(p.payment_date)}</p>
                        </div>
                        {p.reference && <p className="text-xs text-muted-foreground">{p.reference}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">Notes</h3>
                  {!editingNotes && (
                    <button
                      onClick={() => { setNotesDraft(clientNotes); setEditingNotes(true); }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="Add notes about this client..."
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingNotes(false)}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          setClientNotes(notesDraft);
                          setEditingNotes(false);
                          void supabase.from("clients").update({ notes: notesDraft }).eq("id", client.id);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {clientNotes || "No notes added"}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Client portal coming soon */}
          <div className="mt-4 border border-dashed border-gray-200 rounded-lg p-4 bg-gray-50 text-center">
            <Globe className="h-6 w-6 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Client portal coming soon...</p>
            <p className="text-xs text-gray-300 mt-1">Clients will be able to view invoices and make payments online</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-foreground mt-0.5">{value}</p>
    </div>
  );
}

// ---- Clients Tab ---------------------------------------------------------

interface ClientsTabProps {
  currentUserId?: string;
  invoices?: Invoice[];
}

function ClientsTab({ currentUserId, invoices: allInvoices = [] }: ClientsTabProps) {
  const { clients, loading, refresh } = useClients();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedClientForDetail, setSelectedClientForDetail] = useState<Client | null>(null);
  const [showClientDetail, setShowClientDetail] = useState(false);

  // Fix 6: invoice metrics per client
  const [clientInvoiceMetrics, setClientInvoiceMetrics] = useState<Map<string, { openInvoices: number; totalBilled: number; outstanding: number }>>(new Map());

  useEffect(() => {
    async function loadInvoiceMetrics() {
      const { data: invData } = await supabase
        .from("invoices")
        .select("client_id, total_amount, balance_due, status, total");
      if (!invData) return;
      const metrics = new Map<string, { openInvoices: number; totalBilled: number; outstanding: number }>();
      const openStatuses = ["Sent", "Overdue", "Partially Paid"];
      for (const row of invData as Array<{ client_id: string; total_amount?: number; balance_due?: number; status: string; total?: number }>) {
        const cid = row.client_id;
        if (!cid) continue;
        const existing = metrics.get(cid) ?? { openInvoices: 0, totalBilled: 0, outstanding: 0 };
        const amount = row.total ?? row.total_amount ?? 0;
        const balance = row.balance_due ?? 0;
        existing.totalBilled += amount;
        if (openStatuses.includes(row.status)) {
          existing.openInvoices += 1;
          existing.outstanding += balance > 0 ? balance : amount;
        }
        metrics.set(cid, existing);
      }
      setClientInvoiceMetrics(metrics);
    }
    void loadInvoiceMetrics();
  }, [clients]);

  function handleSearchChange(val: string) {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(val), 300);
  }

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchStatus =
        statusFilter === "All" ||
        (statusFilter === "Active" && c.is_active) ||
        (statusFilter === "Inactive" && !c.is_active);
      const q = debouncedSearch.toLowerCase();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.gst_number ?? "").toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [clients, debouncedSearch, statusFilter]);

  async function handleToggleActive(client: Client) {
    const newActive = !client.is_active;
    await supabase.from("clients").update({ is_active: newActive }).eq("id", client.id);
    toast.success(newActive ? t("invoice.clientActivated") : t("invoice.clientDeactivated"));
    void refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("invoice.searchClients")}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          {(["All", "Active", "Inactive"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "bg-blue-600 text-white"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`invoice.${s === "All" ? "allStatuses" : s === "Active" ? "activeOnly" : "inactiveOnly"}`)}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setEditClient(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          {t("invoice.addClient")}
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <svg className="animate-spin h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {t("common.loading")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">{t("invoice.noClientsFound")}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">{t("invoice.clientName")}</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">{t("invoice.clientEmail")}</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium hidden sm:table-cell">{t("invoice.clientPhone")}</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium hidden md:table-cell">{t("invoice.gstNumber")}</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium hidden md:table-cell">{t("invoice.currency")}</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium hidden lg:table-cell">{t("invoice.paymentTerms")}</th>
                  <th className="px-4 py-3 text-center text-muted-foreground font-medium">{t("invoice.isActive")}</th>
                  <th className="px-4 py-3 text-right text-muted-foreground font-medium hidden xl:table-cell">Open Invoices</th>
                  <th className="px-4 py-3 text-right text-muted-foreground font-medium hidden xl:table-cell">Total Billed</th>
                  <th className="px-4 py-3 text-right text-muted-foreground font-medium hidden xl:table-cell">Outstanding</th>
                  <th className="px-4 py-3 text-center text-muted-foreground font-medium">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((client) => (
                  <tr
                    key={client.id}
                    className="hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => { setSelectedClientForDetail(client); setShowClientDetail(true); }}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{client.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{client.email}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{client.phone ?? "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell font-mono text-xs">{client.gst_number ?? "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{client.currency ?? "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{client.payment_terms ?? "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        client.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {client.is_active ? t("invoice.activeOnly") : t("invoice.inactiveOnly")}
                      </span>
                    </td>
                    {/* Fix 6: Financial columns */}
                    <td className="px-4 py-3 text-right text-foreground hidden xl:table-cell">
                      {clientInvoiceMetrics.get(client.id)?.openInvoices ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground hidden xl:table-cell">
                      ₹{(clientInvoiceMetrics.get(client.id)?.totalBilled ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-orange-700 font-medium hidden xl:table-cell">
                      ₹{(clientInvoiceMetrics.get(client.id)?.outstanding ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          title={t("invoice.viewClient")}
                          onClick={() => setViewClient(client)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          title={t("invoice.editClientBtn")}
                          onClick={() => { setEditClient(client); setShowForm(true); }}
                          className="p-1.5 rounded-lg hover:bg-yellow-50 text-muted-foreground hover:text-yellow-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          title={client.is_active ? t("invoice.deactivateClientBtn") : t("invoice.activate")}
                          onClick={() => handleToggleActive(client)}
                          className={`p-1.5 rounded-lg ${client.is_active ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-green-50 hover:text-green-600"} text-muted-foreground`}
                        >
                          {client.is_active ? <X className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <ClientFormModal
          client={editClient}
          onClose={() => { setShowForm(false); setEditClient(null); }}
          onSaved={refresh}
          currentUserId={currentUserId}
        />
      )}

      {viewClient && (
        <ClientDetailPanel client={viewClient} onClose={() => setViewClient(null)} />
      )}

      {/* Client detail slide-over (row click) with locally-calculated metrics */}
      {showClientDetail && selectedClientForDetail && (() => {
        const clientInvoices = allInvoices.filter(i => i.client_id === selectedClientForDetail.id || i.billToId === selectedClientForDetail.id);
        const totalBilled = clientInvoices.reduce((s, i) => s + (i.total || 0), 0);
        const totalPaid = clientInvoices.reduce((s, i) => s + (i.amount_paid || i.amountPaid || 0), 0);
        const outstanding = clientInvoices.filter(i => !["Paid", "Cancelled"].includes(i.status)).reduce((s, i) => s + (i.balance_due || i.balanceDue || 0), 0);
        const invoiceCount = clientInvoices.length;
        return (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
            <div className="bg-card w-full max-w-sm h-full overflow-y-auto shadow-2xl flex flex-col">
              <div className="flex items-center justify-between p-5 border-b">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{selectedClientForDetail.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedClientForDetail.email}</p>
                </div>
                <button onClick={() => setShowClientDetail(false)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5 space-y-5">
                {/* 4 metric tiles */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground font-medium mb-1">Total Billed</p>
                    <p className="text-sm font-bold text-blue-700">₹{totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground font-medium mb-1">Total Paid</p>
                    <p className="text-sm font-bold text-green-700">₹{totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground font-medium mb-1">Outstanding</p>
                    <p className="text-sm font-bold text-orange-700">₹{outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground font-medium mb-1">Invoice Count</p>
                    <p className="text-sm font-bold text-purple-700">{invoiceCount}</p>
                  </div>
                </div>
                {/* Client info */}
                <div className="space-y-2 text-sm">
                  {selectedClientForDetail.phone && <InfoRow label="Phone" value={selectedClientForDetail.phone} />}
                  {selectedClientForDetail.address && <InfoRow label="Address" value={selectedClientForDetail.address} />}
                  {selectedClientForDetail.city && <InfoRow label="City" value={selectedClientForDetail.city} />}
                  {selectedClientForDetail.gst_number && <InfoRow label="GSTIN" value={selectedClientForDetail.gst_number} />}
                  {selectedClientForDetail.pan_number && <InfoRow label="PAN" value={selectedClientForDetail.pan_number} />}
                  {selectedClientForDetail.currency && <InfoRow label="Currency" value={selectedClientForDetail.currency} />}
                  {selectedClientForDetail.payment_terms && <InfoRow label="Payment Terms" value={selectedClientForDetail.payment_terms} />}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ---- Template Form Modal -------------------------------------------------

interface TemplateFormProps {
  template?: InvoiceTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}

function TemplateFormModal({ template, onClose, onSaved }: TemplateFormProps) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [notesTemplate, setNotesTemplate] = useState(template?.notes_template ?? "");
  const [paymentTerms, setPaymentTerms] = useState(template?.payment_terms ?? "NET30");
  const [taxRate, setTaxRate] = useState(template?.tax_rate ?? 0);
  const [isDefault, setIsDefault] = useState(template?.is_default ?? false);
  const [lineItemsJson, setLineItemsJson] = useState(
    template?.line_items ? JSON.stringify(template.line_items, null, 2) : "[]"
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { toast.error(t("invoice.nameRequired")); return; }
    let parsedItems: InvoiceLineItem[] = [];
    try {
      parsedItems = JSON.parse(lineItemsJson);
    } catch {
      toast.error("Invalid JSON for line items");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        line_items: parsedItems,
        notes_template: notesTemplate.trim() || null,
        payment_terms: paymentTerms,
        tax_rate: taxRate,
        is_default: isDefault,
      };

      if (template?.id) {
        const { error: tplUpdateErr } = await supabase.from("invoice_templates").update(payload).eq("id", template.id);
        if (tplUpdateErr) throw new Error(tplUpdateErr.message);
      } else {
        const { error: tplInsertErr } = await supabase.from("invoice_templates").insert([payload]);
        if (tplInsertErr) throw new Error(tplInsertErr.message);
      }

      toast.success(t("invoice.templateSaved"));
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  const field = "w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-sm font-medium text-foreground mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-foreground">
            {template ? t("invoice.editTemplate") : t("invoice.newTemplate")}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className={labelCls}>{t("invoice.templateName")} *</label>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Monthly Retainer" />
          </div>
          <div>
            <label className={labelCls}>{t("invoice.templateDescription")}</label>
            <input className={field} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t("invoice.paymentTerms")}</label>
              <div className="relative">
                <select className={`${field} appearance-none pr-8`} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
                  {["NET15", "NET30", "NET45", "NET60"].map((pt) => (
                    <option key={pt} value={pt}>{pt}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t("invoice.taxRate")}</label>
              <input className={field} type="number" min={0} max={100} step={0.5} value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>{t("invoice.notesTemplate")}</label>
            <textarea className={`${field} resize-none`} rows={3} value={notesTemplate} onChange={(e) => setNotesTemplate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>{t("invoice.lineItems")} (JSON)</label>
            <textarea
              className={`${field} font-mono text-xs resize-none`}
              rows={6}
              value={lineItemsJson}
              onChange={(e) => setLineItemsJson(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              id="isDefault"
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 accent-blue-600"
            />
            <label htmlFor="isDefault" className="text-sm text-foreground">{t("invoice.isDefault")}</label>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={onClose} disabled={saving} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
              {t("common.cancel")}
            </button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Templates Tab -------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  return fmtDate(iso);
}

function TemplatesTab() {
  const { templates, loading, refresh } = useTemplates();
  const [showForm, setShowForm] = useState(false);
  const [editTemplate, setEditTemplate] = useState<InvoiceTemplate | null>(null);
  const [lastUsedMap, setLastUsedMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    async function loadLastUsed() {
      const { data: templateUsage } = await supabase
        .from("invoices")
        .select("template_id, created_at")
        .not("template_id", "is", null)
        .order("created_at", { ascending: false });
      const map = new Map<string, string>();
      for (const row of (templateUsage ?? []) as Array<{ template_id: string; created_at: string }>) {
        if (row.template_id && !map.has(row.template_id)) {
          map.set(row.template_id, row.created_at);
        }
      }
      setLastUsedMap(map);
    }
    void loadLastUsed();
  }, [templates]);

  async function handleDelete(id: string) {
    const { error: delTplErr } = await supabase.from("invoice_templates").delete().eq("id", id);
    if (delTplErr) throw new Error(delTplErr.message);
    toast.success(t("invoice.templateDeleted"));
    void refresh();
  }

  async function handleSetDefault(id: string) {
    const { error: unsetErr } = await supabase.from("invoice_templates").update({ is_default: false }).neq("id", id);
    if (unsetErr) throw new Error(unsetErr.message);
    const { error: setErr } = await supabase.from("invoice_templates").update({ is_default: true }).eq("id", id);
    if (setErr) throw new Error(setErr.message);
    toast.success(t("invoice.defaultSet"));
    void refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => { setEditTemplate(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          {t("invoice.newTemplate")}
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <svg className="animate-spin h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {t("common.loading")}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16">
            <LayoutTemplate className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">{t("invoice.noTemplates")}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-muted-foreground font-medium">{t("invoice.templateName")}</th>
                <th className="px-4 py-3 text-left text-muted-foreground font-medium hidden sm:table-cell">{t("invoice.paymentTerms")}</th>
                <th className="px-4 py-3 text-right text-muted-foreground font-medium hidden sm:table-cell">{t("invoice.taxRate")}</th>
                <th className="px-4 py-3 text-center text-muted-foreground font-medium">{t("invoice.isDefault")}</th>
                <th className="px-4 py-3 text-left text-muted-foreground font-medium hidden md:table-cell">Last Used</th>
                <th className="px-4 py-3 text-center text-muted-foreground font-medium">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {templates.map((tmpl) => (
                <tr key={tmpl.id} className="hover:bg-muted transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{tmpl.name}</p>
                    {tmpl.description && <p className="text-xs text-muted-foreground mt-0.5">{tmpl.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{tmpl.payment_terms ?? "-"}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">{tmpl.tax_rate ?? 0}%</td>
                  <td className="px-4 py-3 text-center">
                    {tmpl.is_default && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        Default
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-sm hidden md:table-cell">
                    {lastUsedMap.has(tmpl.id) ? relativeTime(lastUsedMap.get(tmpl.id)!) : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        title={t("invoice.editTemplate")}
                        onClick={() => { setEditTemplate(tmpl); setShowForm(true); }}
                        className="p-1.5 rounded-lg hover:bg-yellow-50 text-muted-foreground hover:text-yellow-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {!tmpl.is_default && (
                        <button
                          title={t("invoice.setDefault")}
                          onClick={() => handleSetDefault(tmpl.id)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        title={t("invoice.deleteTemplate")}
                        onClick={() => handleDelete(tmpl.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <TemplateFormModal
          template={editTemplate}
          onClose={() => { setShowForm(false); setEditTemplate(null); }}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

// ---- Record Payment Modal ------------------------------------------------

interface RecordPaymentProps {
  invoice: Invoice;
  onClose: () => void;
  onSaved: () => void;
  currentUserId?: string;
}

function RecordPaymentModal({ invoice, onClose, onSaved, currentUserId }: RecordPaymentProps) {
  const { log: logPayment } = useAuditLogger();
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [overpaymentConfirm, setOverpaymentConfirm] = useState(false);

  const balanceDue = invoice.total - (invoice.amountPaid ?? 0);

  async function handleSave() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    // Fix 5: overpayment warning state instead of blocking toast
    if (amt > balanceDue && !overpaymentConfirm) {
      setOverpaymentConfirm(true);
      return;
    }
    setSaving(true);
    try {
      const paymentPayload = {
        invoice_id: invoice.id,
        amount: amt,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        recorded_by: currentUserId ?? null,
      };

      const { error: payErr } = await supabase.from("invoice_payments").insert([paymentPayload]);
      if (payErr) throw new Error(payErr.message);

      const newAmountPaid = (invoice.amountPaid ?? 0) + amt;
      const newBalanceDue = invoice.total - newAmountPaid;
      const newStatus: Invoice["status"] =
        newBalanceDue <= 0 ? "Paid" : ("Partially Paid" as Invoice["status"]);

      const { error: invUpdateErr } = await supabase.from("invoices").update({
        amount_paid: newAmountPaid,
        balance_due: newBalanceDue,
        status: newStatus,
      }).eq("id", invoice.id);
      if (invUpdateErr) throw new Error(invUpdateErr.message);

      if (newBalanceDue <= 0) {
        void supabase.from("notifications").insert([{
          type: "invoice_paid",
          title: "Invoice Paid",
          body: `Invoice ${invoice.invoiceNumber} fully paid by ${invoice.billToName}`,
          is_read: false,
          created_at: new Date().toISOString(),
        }]);
      } else {
        void supabase.from("notifications").insert([{
          type: "partial_payment_received",
          title: "Partial Payment Received",
          body: `Partial payment of ${fmt(amt, invoice.currencySymbol)} received for ${invoice.invoiceNumber}`,
          is_read: false,
          created_at: new Date().toISOString(),
        }]);
      }

      logPayment({ event_type: 'invoice_payment_recorded', action: 'invoice_payment_recorded', resource_id: invoice.id, metadata: { invoice_id: invoice.id, amount: amt, method: paymentMethod } });
      toast.success(t("invoice.paymentRecorded"));
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  const field = "w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-foreground">{t("invoice.recordPayment")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{invoice.invoiceNumber} · Balance: {fmt(balanceDue, invoice.currencySymbol)}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("invoice.paymentAmount")} *</label>
            <input
              className={field}
              type="number"
              min={0}
              step={0.01}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setOverpaymentConfirm(false); }}
              placeholder="0.00"
            />
          </div>
          {/* Fix 5: Overpayment inline warning */}
          {overpaymentConfirm && (
            <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
              <p className="font-medium mb-2">&#9888; This amount exceeds the balance due of ₹{balanceDue.toLocaleString("en-IN")}.</p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setOverpaymentConfirm(false)}
                  className="px-3 py-1.5 rounded-lg border border-yellow-400 text-xs font-medium text-yellow-800 hover:bg-yellow-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { void handleSave(); }}
                  className="px-3 py-1.5 rounded-lg bg-yellow-600 text-white text-xs font-medium hover:bg-yellow-700"
                >
                  Record Overpayment Anyway
                </button>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("invoice.paymentDate")}</label>
            <input className={field} type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("invoice.paymentMethod")}</label>
            <div className="relative">
              <select className={`${field} appearance-none pr-8`} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {["bank_transfer", "cheque", "upi", "cash", "credit_card", "other"].map((m) => (
                  <option key={m} value={m}>{m.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("invoice.paymentReference")}</label>
            <input className={field} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / Cheque No." />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("invoice.paymentNotes")}</label>
            <textarea className={`${field} resize-none`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={onClose} disabled={saving} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
              {t("common.cancel")}
            </button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? t("common.saving") : t("invoice.recordPayment")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Email Preview Modal -------------------------------------------------

interface EmailPreviewModalProps {
  invoice: Invoice;
  clientEmail: string;
  companyName: string;
  onClose: () => void;
  onSent: () => void;
}

function EmailPreviewModal({ invoice, clientEmail, companyName, onClose, onSent }: EmailPreviewModalProps) {
  const { log: logEmail } = useAuditLogger();
  const { currentUser } = useUser();
  const [subject, setSubject] = useState(
    `Invoice ${invoice.invoiceNumber} from ${companyName} for ₹${invoice.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
  );
  const [sending, setSending] = useState(false);
  const [editingBody, setEditingBody] = useState(false);
  const defaultEmailBody = `Dear ${invoice.billToName}, Please find attached invoice ${invoice.invoiceNumber} for ₹${invoice.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })} due on ${fmtDate(invoice.dueDate)}. Please arrange payment at your earliest convenience. Thank you for your business.`;
  const [emailBody, setEmailBody] = useState(defaultEmailBody);

  async function handleSendNow() {
    setSending(true);
    try {
      const { error: sendErr } = await supabase.from("invoices").update({
        status: "Sent",
        sent_at: new Date().toISOString(),
        email_sent_to: clientEmail,
        email_body: emailBody,
      }).eq("id", invoice.id);
      if (sendErr) throw new Error(sendErr.message);

      void supabase.from("notifications").insert([{
        type: "invoice_sent",
        title: "Invoice Sent",
        body: `Invoice ${invoice.invoiceNumber} sent to ${invoice.billToName}`,
        is_read: false,
        created_at: new Date().toISOString(),
      }]);

      logEmail({ event_type: 'invoice_sent', action: 'invoice_sent', resource_id: invoice.id, metadata: { invoice_id: invoice.id, sent_to_email: clientEmail } });
      void supabase.from('invoice_reminder_log').insert([{
        invoice_id: invoice.id,
        sent_at: new Date().toISOString(),
        sent_by: currentUser?.id,
        recipient_email: clientEmail || '',
        reminder_type: 'manual',
        notes: emailBody,
      }]);
      toast.success(`${t("invoice.invoiceSentTo")} ${clientEmail}`);
      onSent();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSending(false);
    }
  }

  const field = "w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-[460px]">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-bold text-foreground">
              {t("invoice.previewEmailTo")} {clientEmail}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("invoice.emailSubject")}</label>
            <input className={field} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="border border-border rounded-xl p-4 bg-muted/40 space-y-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              {editingBody ? (
                <div className="flex-1 space-y-2">
                  <textarea
                    className="w-full border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-card"
                    rows={4}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                  />
                  <button
                    onClick={() => setEditingBody(false)}
                    className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-muted-foreground text-xs flex-1">{emailBody}</p>
                  <button
                    onClick={() => setEditingBody(true)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0"
                    title="Edit body"
                  >
                    <Pencil className="h-3 w-3" /> Edit Body
                  </button>
                </>
              )}
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">{t("invoice.description")}</th>
                    <th className="px-3 py-2 text-right text-muted-foreground font-medium">{t("invoice.qty")}</th>
                    <th className="px-3 py-2 text-right text-muted-foreground font-medium">{t("invoice.rate")}</th>
                    <th className="px-3 py-2 text-right text-muted-foreground font-medium">{t("invoice.amount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(invoice.lineItems ?? []).map((li) => (
                    <tr key={li.id}>
                      <td className="px-3 py-1.5 text-foreground">{li.description}</td>
                      <td className="px-3 py-1.5 text-right text-foreground">{li.quantity}</td>
                      <td className="px-3 py-1.5 text-right text-foreground">{fmt(li.rate, invoice.currencySymbol)}</td>
                      <td className="px-3 py-1.5 text-right font-medium text-foreground">{fmt(li.amount, invoice.currencySymbol)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>{t("invoice.subtotal")}</span><span>{fmt(invoice.subtotal, invoice.currencySymbol)}</span>
              </div>
              {(invoice.taxRate ?? 0) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("invoice.tax")}</span><span>{fmt(invoice.taxAmount ?? 0, invoice.currencySymbol)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-foreground pt-1 border-t">
                <span>{t("invoice.total")}</span><span>{fmt(invoice.total, invoice.currencySymbol)}</span>
              </div>
            </div>

            <p className="text-muted-foreground text-xs">
              {t("invoice.emailRegards")}<br />{companyName}
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <button onClick={onClose} disabled={sending} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
              <ChevronLeft className="h-4 w-4" /> {t("invoice.editInvoice")}
            </button>
            <button onClick={handleSendNow} disabled={sending} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              <Send className="h-4 w-4" /> {sending ? t("common.saving") : t("invoice.sendNow")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- PDF Download --------------------------------------------------------

function handleDownloadPDF(invoice: Invoice, companyInfo?: { company_name?: string; company_gstin?: string; company_pan?: string; company_address?: string; bank_name?: string; bank_account?: string; bank_ifsc?: string }) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  type ExtItem = InvoiceLineItem & { hsn_code?: string; gst_rate?: number };
  const items = (invoice.lineItems ?? []) as ExtItem[];
  const hasGST = items.some((i) => (i.gst_rate ?? 0) > 0);
  const isIntrastate = (((invoice as Invoice & { supply_type?: string }).supply_type) ?? "intrastate") === "intrastate";

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #1f2937; }
    h1 { font-size: 24px; color: #6366f1; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #f3f4f6; padding: 8px; text-align: left; font-size: 12px; border: 1px solid #e5e7eb; }
    td { padding: 8px; font-size: 12px; border: 1px solid #e5e7eb; }
    .total-row { font-weight: bold; background: #f9fafb; }
    .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
    .company-block { font-size: 12px; line-height: 1.6; }
    .bank-details { margin-top: 24px; padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb; font-size: 11px; }
    .footer { margin-top: 32px; font-size: 11px; color: #6b7280; text-align: center; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-block">
      <h1>TAX INVOICE</h1>
      <p><strong>${companyInfo?.company_name ?? "Your Company"}</strong></p>
      ${companyInfo?.company_address ? `<p>${companyInfo.company_address}</p>` : ""}
      ${companyInfo?.company_gstin ? `<p>GSTIN: ${companyInfo.company_gstin}</p>` : ""}
      ${companyInfo?.company_pan ? `<p>PAN: ${companyInfo.company_pan}</p>` : ""}
      ${companyInfo?.company_gstin ? `<p>State Code: ${companyInfo.company_gstin.substring(0, 2)}</p>` : ""}
    </div>
    <div>
      <p>Invoice #: ${invoice.invoiceNumber}</p>
      <p>Date: ${invoice.invoiceDate ?? ""}</p>
      <p>Due: ${invoice.dueDate ?? ""}</p>
      <p><strong>To:</strong></p>
      <p>${invoice.billToName}</p>
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>Rate (&#8377;)</th>${hasGST ? (isIntrastate ? "<th>CGST</th><th>SGST</th>" : "<th>IGST</th>") : ""}<th>Amount (&#8377;)</th></tr></thead>
    <tbody>
      ${items.map((item, i) => {
        const amt = item.quantity * item.rate;
        const gstAmt = amt * (item.gst_rate ?? 0) / 100;
        const halfGST = gstAmt / 2;
        return `<tr><td>${i + 1}</td><td>${item.description}</td><td>${item.hsn_code ?? ""}</td><td>${item.quantity}</td><td>${item.rate.toLocaleString("en-IN")}</td>${hasGST ? (isIntrastate ? `<td>${halfGST.toFixed(2)}</td><td>${halfGST.toFixed(2)}</td>` : `<td>${gstAmt.toFixed(2)}</td>`) : ""}<td>${(amt + gstAmt).toFixed(2)}</td></tr>`;
      }).join("")}
    </tbody>
    <tfoot>
      <tr class="total-row"><td colspan="${hasGST ? (isIntrastate ? 7 : 6) : 5}" style="text-align:right">Total</td><td>&#8377;${(invoice.total ?? 0).toLocaleString("en-IN")}</td></tr>
    </tfoot>
  </table>
  <div class="bank-details">
    <strong>Bank Details:</strong><br/>
    Bank Name: ${companyInfo?.bank_name ?? "HDFC Bank"} &nbsp;&nbsp; Account No.: ${companyInfo?.bank_account ?? "XXXX XXXX XXXX"} &nbsp;&nbsp; IFSC: ${companyInfo?.bank_ifsc ?? "HDFC0001234"}
  </div>
  <div class="footer"><p>This is a computer-generated invoice. No signature required.</p></div>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
}

// ---- GST Invoice Download ------------------------------------------------

function handleDownloadGSTInvoice(invoice: Invoice) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  const totalCgst = invoice.line_items?.reduce((s, i) => s + (i.cgst_amount || 0), 0) ?? 0;
  const totalSgst = invoice.line_items?.reduce((s, i) => s + (i.sgst_amount || 0), 0) ?? 0;
  const totalIgst = invoice.line_items?.reduce((s, i) => s + (i.igst_amount || 0), 0) ?? 0;
  printWindow.document.write(`<html><head><title>GST Invoice ${invoice.invoice_number}</title>
  <style>
    body{font-family:Arial,sans-serif;margin:40px;color:#111}
    .header{display:flex;justify-content:space-between;margin-bottom:24px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th,td{border:1px solid #ddd;padding:8px;font-size:12px}
    th{background:#f5f5f5}
    .gst-box{margin-top:16px;text-align:right}
    .total-row{font-weight:bold;background:#f9f9f9}
    @media print{body{margin:20px}}
  </style>
  </head><body>
  <div class="header">
    <div><h2>TAX INVOICE</h2><div><strong>${invoice.company_name || "Acme Technologies Pvt Ltd"}</strong></div><div>GSTIN: ${invoice.company_gstin || "27AABCA1234B1Z5"}</div><div>PAN: ${invoice.company_pan || "AABCA1234B"}</div></div>
    <div style="text-align:right"><div><strong>Invoice No:</strong> ${invoice.invoice_number}</div><div><strong>Date:</strong> ${invoice.invoice_date}</div><div><strong>Due Date:</strong> ${invoice.due_date}</div></div>
  </div>
  <div><strong>Bill To:</strong><br/>${invoice.client_name}<br/>${invoice.client_address || ""}<br/>GSTIN: ${invoice.client_gstin || "N/A"}</div>
  <table><thead><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>Rate</th><th>Amount</th><th>GST%</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th></tr></thead>
  <tbody>${(invoice.line_items || []).map((item, i) => `<tr><td>${i + 1}</td><td>${item.description}</td><td>${item.hsn_sac || "—"}</td><td>${item.quantity}</td><td>₹${item.unit_price?.toLocaleString("en-IN")}</td><td>₹${item.amount?.toLocaleString("en-IN")}</td><td>${item.gst_rate || 0}%</td><td>₹${(item.cgst_amount || 0).toLocaleString("en-IN")}</td><td>₹${(item.sgst_amount || 0).toLocaleString("en-IN")}</td><td>₹${(item.igst_amount || 0).toLocaleString("en-IN")}</td><td>₹${item.total?.toLocaleString("en-IN")}</td></tr>`).join("")}
  </tbody></table>
  <div class="gst-box">
    <div>Subtotal: ₹${invoice.subtotal?.toLocaleString("en-IN")}</div>
    ${totalCgst > 0 ? `<div>CGST: ₹${totalCgst.toLocaleString("en-IN")}</div><div>SGST: ₹${totalSgst.toLocaleString("en-IN")}</div>` : ""}
    ${totalIgst > 0 ? `<div>IGST: ₹${totalIgst.toLocaleString("en-IN")}</div>` : ""}
    <div class="total-row">Total: ₹${invoice.total?.toLocaleString("en-IN")}</div>
  </div>
  <div style="margin-top:32px"><strong>Bank Details:</strong> ${invoice.bank_name || "HDFC Bank"} | A/C: ${invoice.bank_account || "XXXXXXXX"} | IFSC: ${invoice.bank_ifsc || "HDFC0001234"}</div>
  </body></html>`);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 400);
}

// ---- View Invoice Modal (enhanced with payments) -------------------------

function ViewInvoiceModal({ invoice, onClose, onPaymentRecorded, currentUserId, companyInfo }: {
  invoice: Invoice;
  onClose: () => void;
  onPaymentRecorded?: () => void;
  currentUserId?: string;
  companyInfo?: { company_name?: string; company_gstin?: string; company_pan?: string; company_address?: string; bank_name?: string; bank_account?: string; bank_ifsc?: string };
}) {
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const { payments, loading: paymentsLoading, refresh: refreshPayments } = useInvoicePayments(invoice.id);

  const amountPaid = invoice.amountPaid ?? 0;
  const balanceDue = invoice.total - amountPaid;

  type ExtendedLineItem = InvoiceLineItem & { hsn_code?: string; gst_rate?: number };
  const extItems = (invoice.lineItems ?? []) as ExtendedLineItem[];
  const hasGst = extItems.some((item) => (item.gst_rate ?? 0) > 0);
  const invSupplyType: SupplyType =
    ((invoice as Invoice & { supply_type?: SupplyType }).supply_type) ?? "intrastate";

  // Build GST summary rows
  interface GstSummaryRow { gstRate: number; taxable: number; cgst: number; sgst: number; igst: number; }
  const gstSummaryMap = new Map<number, GstSummaryRow>();
  if (hasGst) {
    for (const item of extItems) {
      const rate = item.gst_rate ?? 0;
      if (rate === 0) continue;
      const taxable = item.amount;
      const gstAmt = taxable * rate / 100;
      const existing = gstSummaryMap.get(rate) ?? { gstRate: rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      existing.taxable += taxable;
      existing.cgst += invSupplyType === "intrastate" ? gstAmt / 2 : 0;
      existing.sgst += invSupplyType === "intrastate" ? gstAmt / 2 : 0;
      existing.igst += invSupplyType === "interstate" ? gstAmt : 0;
      gstSummaryMap.set(rate, existing);
    }
  }
  const gstSummaryRows = Array.from(gstSummaryMap.values());
  const totalGstAmt = gstSummaryRows.reduce((s, r) => s + r.cgst + r.sgst + r.igst, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-foreground">{invoice.invoiceNumber}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{fmtDate(invoice.invoiceDate)}</p>
          </div>
          <div className="flex items-center gap-3">
            {statusBadge(invoice.status)}
            <button
              onClick={() => handleDownloadPDF(invoice, companyInfo)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
            >
              Download PDF
            </button>
            <button
              onClick={() => handleDownloadGSTInvoice(invoice)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
            >
              Download GST Invoice (PDF)
            </button>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {/* Company details section */}
          {companyInfo && (companyInfo.company_name || companyInfo.company_gstin) && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm">
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">From</p>
              <p className="font-bold text-foreground">{companyInfo.company_name}</p>
              {companyInfo.company_address && <p className="text-muted-foreground">{companyInfo.company_address}</p>}
              {companyInfo.company_gstin && <p className="text-muted-foreground">GSTIN: {companyInfo.company_gstin}</p>}
              {companyInfo.company_pan && <p className="text-muted-foreground">PAN: {companyInfo.company_pan}</p>}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground font-medium mb-1">{t("invoice.billTo")}</p>
              <p className="font-semibold text-foreground">{invoice.billToName}</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{invoice.billToAddress}</p>
              {invoice.billToGstin && <p className="text-muted-foreground mt-1">GSTIN: {invoice.billToGstin}</p>}
            </div>
            <div className="text-right">
              <p className="text-muted-foreground font-medium mb-1">{t("invoice.dueDate")}</p>
              <p className="font-semibold text-foreground">{fmtDate(invoice.dueDate)}</p>
              {invoice.poNumber && (
                <>
                  <p className="text-muted-foreground font-medium mt-3 mb-1">{t("invoice.poNumber")}</p>
                  <p className="text-foreground">{invoice.poNumber}</p>
                </>
              )}
            </div>
          </div>

          <div className="border rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">{t("invoice.description")}</th>
                  {hasGst && <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">HSN/SAC</th>}
                  <th className="px-4 py-3 text-right text-muted-foreground font-medium">{t("invoice.qty")}</th>
                  <th className="px-4 py-3 text-right text-muted-foreground font-medium">{t("invoice.rate")}</th>
                  {hasGst && (
                    <>
                      <th className="px-3 py-3 text-right text-muted-foreground font-medium whitespace-nowrap">GST%</th>
                      <th className="px-3 py-3 text-right text-muted-foreground font-medium whitespace-nowrap">Taxable Amt</th>
                      {invSupplyType === "intrastate" ? (
                        <>
                          <th className="px-3 py-3 text-right text-muted-foreground font-medium">CGST</th>
                          <th className="px-3 py-3 text-right text-muted-foreground font-medium">SGST</th>
                        </>
                      ) : (
                        <th className="px-3 py-3 text-right text-muted-foreground font-medium">IGST</th>
                      )}
                    </>
                  )}
                  <th className="px-4 py-3 text-right text-muted-foreground font-medium">{t("invoice.amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {extItems.map((item) => {
                  const gstRate = item.gst_rate ?? 0;
                  const taxable = item.amount;
                  const gstAmt = taxable * gstRate / 100;
                  const cgst = invSupplyType === "intrastate" ? gstAmt / 2 : 0;
                  const sgst = invSupplyType === "intrastate" ? gstAmt / 2 : 0;
                  const igst = invSupplyType === "interstate" ? gstAmt : 0;
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-foreground">{item.description}</td>
                      {hasGst && <td className="px-3 py-3 text-muted-foreground text-xs font-mono">{item.hsn_code ?? "-"}</td>}
                      <td className="px-4 py-3 text-right text-foreground">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-foreground">{fmt(item.rate, invoice.currencySymbol)}</td>
                      {hasGst && (
                        <>
                          <td className="px-3 py-3 text-right text-muted-foreground">{gstRate}%</td>
                          <td className="px-3 py-3 text-right text-foreground">{fmt(taxable, invoice.currencySymbol)}</td>
                          {invSupplyType === "intrastate" ? (
                            <>
                              <td className="px-3 py-3 text-right text-foreground">{fmt(cgst, invoice.currencySymbol)}</td>
                              <td className="px-3 py-3 text-right text-foreground">{fmt(sgst, invoice.currencySymbol)}</td>
                            </>
                          ) : (
                            <td className="px-3 py-3 text-right text-foreground">{fmt(igst, invoice.currencySymbol)}</td>
                          )}
                        </>
                      )}
                      <td className="px-4 py-3 text-right font-medium text-foreground">{fmt(item.amount, invoice.currencySymbol)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* GST Tax Summary */}
          {hasGst && gstSummaryRows.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Tax Summary</p>
              <div className="border border-amber-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-amber-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-muted-foreground font-medium">Tax Type</th>
                      <th className="px-3 py-2 text-right text-muted-foreground font-medium">Rate</th>
                      <th className="px-3 py-2 text-right text-muted-foreground font-medium">Taxable Amt</th>
                      <th className="px-3 py-2 text-right text-muted-foreground font-medium">Tax Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {gstSummaryRows.map((row) =>
                      invSupplyType === "intrastate" ? (
                        <>
                          <tr key={`cgst-${row.gstRate}`}>
                            <td className="px-3 py-1.5 text-foreground">CGST</td>
                            <td className="px-3 py-1.5 text-right text-muted-foreground">{row.gstRate / 2}%</td>
                            <td className="px-3 py-1.5 text-right text-foreground">{fmt(row.taxable, invoice.currencySymbol)}</td>
                            <td className="px-3 py-1.5 text-right font-medium text-foreground">{fmt(row.cgst, invoice.currencySymbol)}</td>
                          </tr>
                          <tr key={`sgst-${row.gstRate}`}>
                            <td className="px-3 py-1.5 text-foreground">SGST</td>
                            <td className="px-3 py-1.5 text-right text-muted-foreground">{row.gstRate / 2}%</td>
                            <td className="px-3 py-1.5 text-right text-foreground">{fmt(row.taxable, invoice.currencySymbol)}</td>
                            <td className="px-3 py-1.5 text-right font-medium text-foreground">{fmt(row.sgst, invoice.currencySymbol)}</td>
                          </tr>
                        </>
                      ) : (
                        <tr key={`igst-${row.gstRate}`}>
                          <td className="px-3 py-1.5 text-foreground">IGST</td>
                          <td className="px-3 py-1.5 text-right text-muted-foreground">{row.gstRate}%</td>
                          <td className="px-3 py-1.5 text-right text-foreground">{fmt(row.taxable, invoice.currencySymbol)}</td>
                          <td className="px-3 py-1.5 text-right font-medium text-foreground">{fmt(row.igst, invoice.currencySymbol)}</td>
                        </tr>
                      )
                    )}
                    <tr className="bg-amber-50 font-semibold">
                      <td className="px-3 py-1.5 text-foreground" colSpan={3}>Total GST</td>
                      <td className="px-3 py-1.5 text-right text-foreground">{fmt(totalGstAmt, invoice.currencySymbol)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{t("invoice.subtotal")}</span>
                <span>{fmt(invoice.subtotal, invoice.currencySymbol)}</span>
              </div>
              {(invoice.taxRate ?? invoice.gstRate ?? 0) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("invoice.tax")} ({invoice.taxRate ?? invoice.gstRate}%)</span>
                  <span>{fmt(invoice.taxAmount ?? invoice.gstAmount ?? 0, invoice.currencySymbol)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-foreground pt-2 border-t">
                <span>{t("invoice.total")}</span>
                <span>{fmt(invoice.total, invoice.currencySymbol)}</span>
              </div>
              {amountPaid > 0 && (
                <>
                  <div className="flex justify-between text-green-600">
                    <span>{t("invoice.amountPaid")}</span>
                    <span>{fmt(amountPaid, invoice.currencySymbol)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-orange-600">
                    <span>{t("invoice.balanceDue")}</span>
                    <span>{fmt(balanceDue, invoice.currencySymbol)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {invoice.status === "Overdue" && invoice.dueDate && (() => {
            const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / 86400000));
            const monthlyPeriods = Math.max(1, Math.floor(daysOverdue / 30));
            const outstandingBalance = balanceDue > 0 ? balanceDue : invoice.total;
            const lateFee = outstandingBalance * 0.015 * monthlyPeriods;
            return (
              <div className="border border-yellow-300 bg-yellow-50 rounded-xl p-4 flex gap-3">
                <span className="text-yellow-600 text-lg leading-none">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-yellow-800">
                    Late Fee Applicable: {fmt(lateFee, invoice.currencySymbol)} (1.5% × {monthlyPeriods} month{monthlyPeriods !== 1 ? "s" : ""} overdue)
                  </p>
                  <p className="text-xs text-yellow-700 mt-0.5">This amount is advisory only. Apply it manually when recording payment.</p>
                </div>
              </div>
            );
          })()}

          {invoice.notes && (
            <div className="bg-muted rounded-xl p-4">
              <p className="text-xs text-muted-foreground font-medium mb-1">{t("invoice.notes")}</p>
              <p className="text-sm text-foreground">{invoice.notes}</p>
            </div>
          )}

          {/* Cancellation details */}
          {invoice.status === "Cancelled" && (
            <div className="border border-red-200 bg-red-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Cancellation Details</p>
              {(invoice as Invoice & { cancellation_reason?: string }).cancellation_reason && (
                <div>
                  <p className="text-xs text-red-600 font-medium">Reason</p>
                  <p className="text-sm text-red-800">{(invoice as Invoice & { cancellation_reason?: string }).cancellation_reason}</p>
                </div>
              )}
              {(invoice as Invoice & { credit_note_reference?: string }).credit_note_reference && (
                <div>
                  <p className="text-xs text-red-600 font-medium">Credit Note Reference</p>
                  <p className="text-sm text-red-800 font-mono">{(invoice as Invoice & { credit_note_reference?: string }).credit_note_reference}</p>
                </div>
              )}
            </div>
          )}

          {/* Bank details footer */}
          {companyInfo && (companyInfo.bank_name || companyInfo.bank_account) && (
            <div className="bg-muted rounded-xl p-4 text-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Bank Details</p>
              <div className="flex flex-wrap gap-4 text-foreground">
                {companyInfo.bank_name && <span><span className="text-muted-foreground">Bank:</span> {companyInfo.bank_name}</span>}
                {companyInfo.bank_account && <span><span className="text-muted-foreground">A/C:</span> {companyInfo.bank_account}</span>}
                {companyInfo.bank_ifsc && <span><span className="text-muted-foreground">IFSC:</span> {companyInfo.bank_ifsc}</span>}
              </div>
            </div>
          )}

          {/* Payments section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">{t("invoice.payments")}</h3>
              {invoice.status !== "Paid" && invoice.status !== "Cancelled" && (
                <button
                  onClick={() => setShowPaymentForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("invoice.recordPayment")}
                </button>
              )}
            </div>
            {paymentsLoading ? (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("invoice.noPayments")}</p>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-muted-foreground font-medium">{t("invoice.paymentDate")}</th>
                      <th className="px-3 py-2.5 text-left text-muted-foreground font-medium">{t("invoice.paymentMethod")}</th>
                      <th className="px-3 py-2.5 text-right text-muted-foreground font-medium">{t("invoice.paymentAmount")}</th>
                      <th className="px-3 py-2.5 text-left text-muted-foreground font-medium hidden sm:table-cell">{t("invoice.paymentReference")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2 text-foreground">{fmtDate(p.payment_date)}</td>
                        <td className="px-3 py-2 text-muted-foreground capitalize">{p.payment_method.replace("_", " ")}</td>
                        <td className="px-3 py-2 text-right font-medium text-foreground">{fmt(p.amount, invoice.currencySymbol)}</td>
                        <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{p.reference ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPaymentForm && (
        <RecordPaymentModal
          invoice={invoice}
          onClose={() => setShowPaymentForm(false)}
          onSaved={() => {
            void refreshPayments();
            onPaymentRecorded?.();
          }}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}

// ---- Edit Invoice Modal --------------------------------------------------

interface EditInvoiceModalProps {
  invoice: Invoice;
  billToClients: BillToItem[];
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<Invoice | null>;
  onClose: () => void;
}

interface LineItemRow {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  hsnCode: string;
  gstRate: number;
}

function newRow(): LineItemRow {
  return { id: crypto.randomUUID(), description: "", quantity: 1, rate: 0, hsnCode: "", gstRate: 18 };
}

function EditInvoiceModal({ invoice, billToClients, updateInvoice, onClose }: EditInvoiceModalProps) {
  const [clientId, setClientId] = useState(invoice.billToId ?? "");
  const [dueDate, setDueDate] = useState(invoice.dueDate ?? "");
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [status, setStatus] = useState<Invoice["status"]>(invoice.status);
  const [taxRate, setTaxRate] = useState(invoice.taxRate ?? invoice.gstRate ?? 0);
  const [rows, setRows] = useState<LineItemRow[]>(
    (invoice.lineItems ?? []).map((li) => ({
      id: li.id,
      description: li.description,
      quantity: li.quantity,
      rate: li.rate,
      hsnCode: "",
      gstRate: 18,
    }))
  );
  const [saving, setSaving] = useState(false);

  const selectedClient = billToClients.find((c) => c.id === clientId);

  const subtotal = rows.reduce((s, r) => s + r.quantity * r.rate, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const updateRow = (id: string, field: keyof LineItemRow, value: string | number) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, newRow()]);
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  async function handleSave() {
    if (invoice.status === "Paid") { toast.error("Paid invoices cannot be edited"); return; }
    if (rows.every((r) => !r.description)) { toast.error(t("invoice.addAtLeastOneItem")); return; }
    setSaving(true);
    const lineItems: InvoiceLineItem[] = rows
      .filter((r) => r.description)
      .map((r) => ({
        id: r.id,
        description: r.description,
        quantity: r.quantity,
        rate: r.rate,
        amount: r.quantity * r.rate,
      }));

    const updates: Partial<Invoice> = { dueDate, notes, status, lineItems, subtotal, taxRate, taxAmount, total };

    if (clientId && clientId !== invoice.billToId) {
      updates.billToId = clientId;
      updates.billToName = selectedClient?.name ?? invoice.billToName;
      updates.billToAddress = selectedClient?.address ?? invoice.billToAddress;
      updates.billToGstin = selectedClient?.gstin;
    }

    try {
      const result = await updateInvoice(invoice.id, updates);
      if (result) onClose();
    } catch {
      // error already toasted inside updateInvoice
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-foreground">{t("common.edit")} {invoice.invoiceNumber}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{t("invoice.editInvoiceSubtitle")}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("invoice.billTo")}</label>
              {billToClients.length > 0 ? (
                <div className="relative">
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full appearance-none border border-border rounded-xl px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t("invoice.selectClient")}</option>
                    {billToClients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              ) : (
                <input
                  type="text"
                  value={selectedClient?.name ?? invoice.billToName}
                  readOnly
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-muted text-foreground"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("invoice.dueDate")}</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("invoice.paymentStatus")}</label>
            <div className="relative w-48">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Invoice["status"])}
                className="w-full appearance-none border border-border rounded-xl px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <SelectOptions entity="invoice" field="status" fallback={["Draft", "Sent", "Paid", "Overdue", "Cancelled"]} />
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-2">{t("invoice.lineItems")}</p>
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-muted-foreground font-medium w-full">{t("invoice.description")}</th>
                      <th className="px-3 py-2.5 text-right text-muted-foreground font-medium whitespace-nowrap">{t("invoice.qty")}</th>
                      <th className="px-3 py-2.5 text-right text-muted-foreground font-medium whitespace-nowrap">{t("invoice.rate")}</th>
                      <th className="px-3 py-2.5 text-right text-muted-foreground font-medium whitespace-nowrap">{t("invoice.amount")}</th>
                      <th className="px-2 py-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => updateRow(row.id, "description", e.target.value)}
                            placeholder={t("invoice.itemDescriptionPlaceholder")}
                            maxLength={500}
                            className="w-full border-0 focus:outline-none bg-transparent text-foreground placeholder-gray-400"
                          />
                          {row.description.length > 400 && (
                            <p className="text-xs text-gray-400">{500 - row.description.length} chars left</p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            value={row.quantity}
                            onChange={(e) => updateRow(row.id, "quantity", parseFloat(e.target.value) || 0)}
                            className="w-20 text-right border-0 focus:outline-none bg-transparent text-foreground"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={row.rate}
                            onChange={(e) => updateRow(row.id, "rate", parseFloat(e.target.value) || 0)}
                            className="w-24 text-right border-0 focus:outline-none bg-transparent text-foreground"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                          {fmt(row.quantity * row.rate, invoice.currencySymbol)}
                        </td>
                        <td className="px-2 py-2">
                          <button
                            onClick={() => removeRow(row.id)}
                            disabled={rows.length === 1}
                            className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 disabled:opacity-30"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 border-t bg-muted">
                <button onClick={addRow} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  <Plus className="h-4 w-4" />
                  {t("invoice.addLine")}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t("invoice.notes")}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder={t("invoice.notesPlaceholder")}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex flex-col justify-end">
              <div className="bg-muted border border-border rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("invoice.subtotal")}</span>
                  <span>{fmt(subtotal, invoice.currencySymbol)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>{t("invoice.tax")} %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      className="w-16 border border-border rounded px-2 py-0.5 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <span>{fmt(taxAmount, invoice.currencySymbol)}</span>
                </div>
                <div className="flex justify-between font-bold text-foreground pt-2 border-t border-border">
                  <span>{t("invoice.total")}</span>
                  <span>{fmt(total, invoice.currencySymbol)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? t("invoice.saving") : t("invoice.saveChanges")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Inline New Client Mini-Form -----------------------------------------

interface NewClientMiniFormProps {
  onSaved: (clientId: string, clientName: string) => void;
  onCancel: () => void;
  currentUserId?: string;
}

function NewClientMiniForm({ onSaved, onCancel, currentUserId }: NewClientMiniFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { toast.error(t("invoice.nameRequired")); return; }
    if (!email.trim()) { toast.error(t("invoice.emailRequired")); return; }
    if (!validateEmail(email)) { toast.error(t("invoice.emailInvalid")); return; }
    if (gstNumber && !validateGSTIN(gstNumber)) { toast.error(t("invoice.gstinRequired15")); return; }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        gst_number: gstNumber.trim() || null,
        address: address.trim() || null,
        is_active: true,
        created_by: currentUserId ?? null,
      };

      const { data, error } = await supabase.from("clients").insert([payload]).select().single();
      if (error) throw new Error(error.message);
      toast.success(t("invoice.clientSavedAndSelected"));
      onSaved((data as Client).id, (data as Client).name);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  const field = "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="mt-2 border border-indigo-200 rounded-xl p-4 bg-indigo-50 space-y-3 animate-in slide-in-from-top-2 duration-200">
      <p className="text-sm font-semibold text-indigo-800">{t("invoice.addNewClientHeader")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">{t("invoice.clientName")} *</label>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">{t("invoice.clientEmail")} *</label>
          <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="billing@acme.com" />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">{t("invoice.clientPhone")}</label>
          <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">{t("invoice.gstNumber")}</label>
          <input className={field} value={gstNumber} onChange={(e) => setGstNumber(e.target.value.toUpperCase())} maxLength={15} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-foreground mb-1">{t("invoice.clientAddress")}</label>
          <input className={field} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} disabled={saving} className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted">
          {t("common.cancel")}
        </button>
        <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">
          {saving ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </div>
  );
}

// ---- Recurring Config Modal ----------------------------------------------

interface RecurringConfigModalProps {
  config?: RecurringInvoiceConfig | null;
  clients: Client[];
  templates: InvoiceTemplate[];
  onClose: () => void;
  onSaved: () => void;
  currentUserId?: string;
}

function RecurringConfigModal({ config, clients, templates, onClose, onSaved, currentUserId }: RecurringConfigModalProps) {
  const [clientId, setClientId] = useState(config?.client_id ?? "");
  const [templateId, setTemplateId] = useState(config?.template_id ?? "");
  const [frequency, setFrequency] = useState<RecurringFrequency>(config?.frequency ?? "monthly");
  const [startDate, setStartDate] = useState(config?.start_date ?? new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(config?.end_date ?? "");
  const [autoSend, setAutoSend] = useState(config?.auto_send ?? false);
  const [saving, setSaving] = useState(false);

  const field = "w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-sm font-medium text-foreground mb-1";

  async function handleSave() {
    if (!clientId) { toast.error(t("invoice.pleaseSelectClient")); return; }
    setSaving(true);
    try {
      const payload = {
        client_id: clientId,
        template_id: templateId || null,
        frequency,
        start_date: startDate,
        end_date: endDate || null,
        auto_send: autoSend,
        status: "active" as RecurringStatus,
        next_run_date: startDate,
        created_by: currentUserId ?? null,
      };

      if (config?.id) {
        const { error } = await supabase.from("recurring_invoice_configs").update(payload).eq("id", config.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("recurring_invoice_configs").insert([payload]);
        if (error) throw new Error(error.message);
      }

      toast.success(t("invoice.recurringConfigSaved"));
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-foreground">
            {config ? t("invoice.editRecurring") : t("invoice.newRecurringConfig")}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className={labelCls}>{t("invoice.billTo")} *</label>
            <div className="relative">
              <select className={`${field} appearance-none pr-8`} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">{t("invoice.selectClient")}</option>
                {clients.filter((c) => c.is_active).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {templates.length > 0 && (
            <div>
              <label className={labelCls}>{t("invoice.templateOptional")}</label>
              <div className="relative">
                <select className={`${field} appearance-none pr-8`} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <option value="">{t("invoice.noTemplate")}</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>{t("invoice.frequency")}</label>
            <div className="flex gap-2 flex-wrap">
              {(["weekly", "monthly", "quarterly", "annually"] as RecurringFrequency[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors capitalize ${
                    frequency === f ? "bg-blue-600 text-white border-blue-600" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t("invoice.startDate")}</label>
              <input className={field} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>{t("invoice.endDateOptional")}</label>
              <input className={field} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoSend(!autoSend)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoSend ? "bg-blue-600" : "bg-gray-200"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${autoSend ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            <span className="text-sm text-foreground">{t("invoice.autoSend")}</span>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button onClick={onClose} disabled={saving} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
              {t("common.cancel")}
            </button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Recurring Tab -------------------------------------------------------

interface RecurringTabProps {
  clients: Client[];
  templates: InvoiceTemplate[];
  currentUserId?: string;
}

function RecurringTab({ clients, templates, currentUserId }: RecurringTabProps) {
  const { configs, loading, refresh } = useRecurringConfigs();
  const [showModal, setShowModal] = useState(false);
  const [editConfig, setEditConfig] = useState<RecurringInvoiceConfig | null>(null);

  async function handlePauseResume(config: RecurringInvoiceConfig) {
    const newStatus: RecurringStatus = config.status === "active" ? "paused" : "active";
    await supabase.from("recurring_invoice_configs").update({ status: newStatus }).eq("id", config.id);
    toast.success(newStatus === "active" ? t("invoice.recurringResumed") : t("invoice.recurringPaused"));
    void refresh();
  }

  async function handleDelete(id: string) {
    await supabase.from("recurring_invoice_configs").delete().eq("id", id);
    toast.success(t("invoice.recurringDeleted"));
    void refresh();
  }

  const statusBadgeRecurring = (s: RecurringStatus) => {
    const map: Record<RecurringStatus, string> = {
      active: "bg-green-100 text-green-700",
      paused: "bg-yellow-100 text-yellow-700",
      completed: "bg-gray-100 text-gray-500",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[s]}`}>
        {s}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => { setEditConfig(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          {t("invoice.newRecurringConfig")}
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <svg className="animate-spin h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {t("common.loading")}
          </div>
        ) : configs.length === 0 ? (
          <div className="text-center py-16">
            <RefreshCw className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">{t("invoice.noRecurringConfigs")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">{t("invoice.clientName")}</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">{t("invoice.frequency")}</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium hidden sm:table-cell">{t("invoice.startDate")}</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium hidden md:table-cell">{t("invoice.endDate")}</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium hidden lg:table-cell">{t("invoice.nextRun")}</th>
                  <th className="px-4 py-3 text-center text-muted-foreground font-medium">{t("invoice.autoSend")}</th>
                  <th className="px-4 py-3 text-left text-muted-foreground font-medium">{t("common.status")}</th>
                  <th className="px-4 py-3 text-center text-muted-foreground font-medium">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {configs.map((cfg) => (
                  <tr key={cfg.id} className="hover:bg-muted transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{cfg.client_name}</p>
                      <p className="text-xs text-muted-foreground">{cfg.client_email}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{cfg.frequency}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{fmtDate(cfg.start_date)}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{cfg.end_date ? fmtDate(cfg.end_date) : "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{cfg.next_run_date ? fmtDate(cfg.next_run_date) : "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.auto_send ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                        {cfg.auto_send ? "On" : "Off"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{statusBadgeRecurring(cfg.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          title={cfg.status === "active" ? t("invoice.pause") : t("invoice.resume")}
                          onClick={() => handlePauseResume(cfg)}
                          className={`p-1.5 rounded-lg text-muted-foreground ${cfg.status === "active" ? "hover:bg-yellow-50 hover:text-yellow-600" : "hover:bg-green-50 hover:text-green-600"}`}
                        >
                          {cfg.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                        <button
                          title={t("common.edit")}
                          onClick={() => { setEditConfig(cfg); setShowModal(true); }}
                          className="p-1.5 rounded-lg hover:bg-yellow-50 text-muted-foreground hover:text-yellow-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          title={t("common.delete")}
                          onClick={() => handleDelete(cfg.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <RecurringConfigModal
          config={editConfig}
          clients={clients}
          templates={templates}
          onClose={() => { setShowModal(false); setEditConfig(null); }}
          onSaved={refresh}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}

// ---- Create Invoice Tab (enhanced) --------------------------------------

interface CreateInvoiceTabProps {
  billToClients: BillToItem[];
  onCreated: () => void;
  createInvoice: (data: Partial<Invoice>) => Promise<Invoice | null>;
  sendInvoice: (id: string) => Promise<boolean>;
  templates: InvoiceTemplate[];
  onRefreshClients: () => void;
  currentUserId?: string;
  supaClients?: Client[];
  defaultTaxRate?: number;
  defaultPaymentTerms?: number;
}

function CreateInvoiceTab({ billToClients, onCreated, createInvoice, sendInvoice, templates, onRefreshClients, currentUserId, supaClients, defaultTaxRate = 0, defaultPaymentTerms = 30 }: CreateInvoiceTabProps) {
  const { log: logCreate } = useAuditLogger();
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + defaultPaymentTerms * 86400000).toISOString().slice(0, 10);

  const [clientId, setClientId] = useState("");
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState(due);
  const [taxRate, setTaxRate] = useState(defaultTaxRate);
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<LineItemRow[]>([newRow()]);
  const [saving, setSaving] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // GST fields
  const [supplyType, setSupplyType] = useState<SupplyType>("intrastate");
  const [placeOfSupply, setPlaceOfSupply] = useState("");

  // Recurring invoice
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [recurFrequency, setRecurFrequency] = useState<RecurringFrequency>("monthly");
  const [recurStart, setRecurStart] = useState(today);
  const [recurEnd, setRecurEnd] = useState("");
  const [recurAutoSend, setRecurAutoSend] = useState(false);

  // Contractor / Employee cross-reference
  const [contractorId, setContractorId] = useState<string>("");
  const [contractorName, setContractorName] = useState<string>("");

  const selectedClient = billToClients.find((c) => c.id === clientId);

  const subtotal = rows.reduce((s, r) => s + r.quantity * r.rate, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const updateRow = (id: string, field: keyof LineItemRow, value: string | number) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, newRow()]);
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  function applyTemplate(tmplId: string) {
    const tmpl = templates.find((t) => t.id === tmplId);
    if (!tmpl) return;
    if (tmpl.line_items && tmpl.line_items.length > 0) {
      setRows(tmpl.line_items.map((li) => ({
        id: crypto.randomUUID(),
        description: li.description,
        quantity: li.quantity,
        rate: li.rate,
        hsnCode: "",
        gstRate: 18,
      })));
    }
    if (tmpl.notes_template) setNotes(tmpl.notes_template);
    if (tmpl.tax_rate !== undefined) setTaxRate(tmpl.tax_rate);
    toast.success(t("invoice.templateApplied"));
    setSelectedTemplateId("");
  }

  function handleClientSelect(value: string) {
    if (value === "__new__") {
      setShowNewClientForm(true);
    } else {
      setClientId(value);
      setShowNewClientForm(false);
    }
  }

  // GST tax calculation
  const gstTaxSummary = useMemo(() => {
    return rows
      .filter((r) => r.description)
      .map((r) => {
        const lineAmount = r.quantity * r.rate;
        const gstAmount = lineAmount * r.gstRate / 100;
        return {
          hsn: r.hsnCode,
          taxable: lineAmount,
          gstRate: r.gstRate,
          cgst: supplyType === "intrastate" ? gstAmount / 2 : 0,
          sgst: supplyType === "intrastate" ? gstAmount / 2 : 0,
          igst: supplyType === "interstate" ? gstAmount : 0,
        };
      });
  }, [rows, supplyType]);

  const totalGst = gstTaxSummary.reduce((s, r) => s + r.cgst + r.sgst + r.igst, 0);

  async function handleSave(andSend = false) {
    if (!clientId) { toast.error(t("invoice.pleaseSelectClient")); return; }
    if (rows.every((r) => !r.description)) { toast.error(t("invoice.addAtLeastOneItem")); return; }

    // Fix 2: due_date >= invoice_date validation
    if (dueDate && invoiceDate && dueDate < invoiceDate) {
      toast.error("Due date must be on or after the invoice date");
      return;
    }

    setSaving(true);
    const lineItems: (InvoiceLineItem & { hsn_code?: string; gst_rate?: number })[] = rows
      .filter((r) => r.description)
      .map((r) => ({
        id: r.id,
        description: r.description,
        quantity: r.quantity,
        rate: r.rate,
        amount: r.quantity * r.rate,
        hsn_code: r.hsnCode || undefined,
        gst_rate: r.gstRate,
      }));

    const effectiveTax = totalGst > 0 ? totalGst : taxAmount;
    const effectiveTotal = subtotal + effectiveTax;

    const payload: Partial<Invoice> & { supply_type?: string; place_of_supply?: string; is_recurring?: boolean } = {
      billToId: clientId,
      billToName: selectedClient?.name ?? "",
      billToAddress: selectedClient?.address ?? "",
      billToGstin: selectedClient?.gstin,
      invoiceDate,
      dueDate,
      lineItems,
      subtotal,
      taxRate,
      taxAmount: effectiveTax,
      total: effectiveTotal,
      currency: selectedClient?.currency ?? "INR",
      currencySymbol: "₹",
      status: "Draft",
      notes,
      // Fix 1: Save GST fields
      supply_type: supplyType,
      place_of_supply: placeOfSupply || undefined,
      is_recurring: makeRecurring,
    };

    try {
      const created = await createInvoice(payload);
      if (created) {
        logCreate({ event_type: 'invoice_created', action: 'invoice_created', resource_id: created.id, metadata: { invoice_id: created.id, invoice_number: created.invoiceNumber, client_id: clientId, total_amount: effectiveTotal } });
        if (makeRecurring) {
          void supabase.from("recurring_invoice_configs").insert([{
            client_id: clientId,
            frequency: recurFrequency,
            start_date: recurStart,
            end_date: recurEnd || null,
            auto_send: recurAutoSend,
            status: "active",
            next_run_date: recurStart,
            created_by: currentUserId ?? null,
          }]);
          if (currentUserId) {
            void supabase.from("notifications").insert([{
              user_id: currentUserId,
              type: "recurring_invoice_created",
              title: "Recurring Invoice Created",
              message: `Recurring invoice ${created.invoiceNumber} created for ${selectedClient?.name ?? ""}.`,
              app_name: "Invoice Generation",
              read: false,
            }]);
          }
        }

        if (andSend) {
          await sendInvoice(created.id);
          void supabase.from("notifications").insert([{
            type: "invoice_sent",
            title: "Invoice Sent",
            body: `Invoice ${created.invoiceNumber} sent to ${selectedClient?.name ?? ""}`,
            is_read: false,
            created_at: new Date().toISOString(),
          }]);
        }
      }
      if (created) onCreated();
    } catch {
      // error already toasted inside createInvoice/sendInvoice
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Template selector */}
      {templates.length > 0 && (
        <div className="flex items-center gap-3">
          <LayoutTemplate className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="relative flex-1 max-w-xs">
            <select
              value={selectedTemplateId}
              onChange={(e) => { setSelectedTemplateId(e.target.value); applyTemplate(e.target.value); }}
              className="w-full appearance-none border border-border rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t("invoice.useTemplate")}</option>
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>{tmpl.name}{tmpl.is_default ? " (Default)" : ""}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      )}

      {/* Client + Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1">
          <label className="block text-sm font-medium text-foreground mb-1">{t("invoice.billTo")} *</label>
          <div className="relative">
            <select
              value={showNewClientForm ? "__new__" : clientId}
              onChange={(e) => handleClientSelect(e.target.value)}
              className="w-full appearance-none border border-border rounded-xl px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t("invoice.selectClient")}</option>
              {billToClients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="__new__" style={{ color: "#4f46e5", fontStyle: "italic" }}>
                {t("invoice.newClientInline")}
              </option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          {showNewClientForm && (
            <NewClientMiniForm
              onSaved={(id, name) => {
                setClientId(id);
                setShowNewClientForm(false);
                onRefreshClients();
                void name;
              }}
              onCancel={() => { setShowNewClientForm(false); setClientId(""); }}
              currentUserId={currentUserId}
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("invoice.invoiceDate")}</label>
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("invoice.dueDate")}</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Client preview */}
      {selectedClient && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-foreground">
          <p className="font-semibold text-foreground">{selectedClient.name}</p>
          <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{selectedClient.address}</p>
          {selectedClient.gstin && <p className="text-muted-foreground mt-1">GSTIN: {selectedClient.gstin}</p>}
        </div>
      )}

      {/* Contractor / Employee cross-reference */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Contractor / Employee (optional)</label>
        <EmployeeSearchDropdown
          value={contractorName}
          onChange={(name, id) => { setContractorName(name); setContractorId(id ?? ""); }}
          placeholder="Search employee…"
        />
      </div>

      {/* GST Supply Type */}
      <div className="border border-border rounded-xl p-4 space-y-3 bg-amber-50/50">
        <p className="text-sm font-semibold text-foreground">{t("invoice.gstDetails")}</p>
        <div className="flex flex-wrap gap-4 items-start">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">{t("invoice.supplyType")}</p>
            <div className="flex gap-2">
              {(["intrastate", "interstate"] as SupplyType[]).map((st) => (
                <button
                  key={st}
                  onClick={() => setSupplyType(st)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors capitalize ${
                    supplyType === st ? "bg-amber-600 text-white border-amber-600" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("invoice.placeOfSupply")}</label>
            <input
              type="text"
              value={placeOfSupply}
              onChange={(e) => setPlaceOfSupply(e.target.value)}
              placeholder="27"
              maxLength={2}
              className="w-20 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">{t("invoice.lineItems")}</p>
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2.5 text-left text-muted-foreground font-medium w-full">{t("invoice.description")}</th>
                  <th className="px-3 py-2.5 text-left text-muted-foreground font-medium whitespace-nowrap hidden md:table-cell">{t("invoice.hsnCode")}</th>
                  <th className="px-3 py-2.5 text-right text-muted-foreground font-medium whitespace-nowrap">{t("invoice.qty")}</th>
                  <th className="px-3 py-2.5 text-right text-muted-foreground font-medium whitespace-nowrap">{t("invoice.rate")}</th>
                  <th className="px-3 py-2.5 text-right text-muted-foreground font-medium whitespace-nowrap hidden sm:table-cell">{t("invoice.gstRateCol")}</th>
                  <th className="px-3 py-2.5 text-right text-muted-foreground font-medium whitespace-nowrap">{t("invoice.amount")}</th>
                  <th className="px-2 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => updateRow(row.id, "description", e.target.value)}
                        placeholder={t("invoice.itemDescriptionPlaceholder")}
                        maxLength={500}
                        className="w-full border-0 focus:outline-none bg-transparent text-foreground placeholder-gray-400"
                      />
                      {row.description.length > 400 && (
                        <p className="text-xs text-gray-400">{500 - row.description.length} chars left</p>
                      )}
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <input
                        type="text"
                        value={row.hsnCode}
                        onChange={(e) => updateRow(row.id, "hsnCode", e.target.value)}
                        placeholder="HSN/SAC"
                        className="w-20 border-0 focus:outline-none bg-transparent text-foreground placeholder-gray-400"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        value={row.quantity}
                        onChange={(e) => updateRow(row.id, "quantity", parseFloat(e.target.value) || 0)}
                        className="w-20 text-right border-0 focus:outline-none bg-transparent text-foreground"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={row.rate}
                        onChange={(e) => updateRow(row.id, "rate", parseFloat(e.target.value) || 0)}
                        className="w-24 text-right border-0 focus:outline-none bg-transparent text-foreground"
                      />
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      <select
                        value={row.gstRate}
                        onChange={(e) => updateRow(row.id, "gstRate", parseInt(e.target.value))}
                        className="w-20 text-right border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent"
                      >
                        {[0, 5, 12, 18, 28].map((r) => (
                          <option key={r} value={r}>{r}%</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                      {fmt(row.quantity * row.rate)}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length === 1}
                        className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 disabled:opacity-30"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t bg-muted">
            <button onClick={addRow} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <Plus className="h-4 w-4" />
              {t("invoice.addLine")}
            </button>
          </div>
        </div>
      </div>

      {/* GST Tax Summary */}
      {gstTaxSummary.some((r) => r.gstRate > 0) && (
        <div>
          <p className="text-sm font-medium text-foreground mb-2">{t("invoice.gstSummary")}</p>
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-amber-50">
                <tr>
                  <th className="px-3 py-2 text-left text-muted-foreground font-medium">{t("invoice.hsnCode")}</th>
                  <th className="px-3 py-2 text-right text-muted-foreground font-medium">{t("invoice.taxable")}</th>
                  <th className="px-3 py-2 text-right text-muted-foreground font-medium">CGST%</th>
                  <th className="px-3 py-2 text-right text-muted-foreground font-medium">CGST Amt</th>
                  <th className="px-3 py-2 text-right text-muted-foreground font-medium">SGST%</th>
                  <th className="px-3 py-2 text-right text-muted-foreground font-medium">SGST Amt</th>
                  <th className="px-3 py-2 text-right text-muted-foreground font-medium">IGST%</th>
                  <th className="px-3 py-2 text-right text-muted-foreground font-medium">IGST Amt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {gstTaxSummary.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-foreground">{r.hsn || "-"}</td>
                    <td className="px-3 py-1.5 text-right text-foreground">₹{r.taxable.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{supplyType === "intrastate" ? r.gstRate / 2 : 0}%</td>
                    <td className="px-3 py-1.5 text-right text-foreground">₹{r.cgst.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{supplyType === "intrastate" ? r.gstRate / 2 : 0}%</td>
                    <td className="px-3 py-1.5 text-right text-foreground">₹{r.sgst.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{supplyType === "interstate" ? r.gstRate : 0}%</td>
                    <td className="px-3 py-1.5 text-right text-foreground">₹{r.igst.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2 italic">{numberToWords(subtotal + totalGst)}</p>
        </div>
      )}

      {/* Tax + Notes + Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("invoice.notes")}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder={t("invoice.notesPlaceholder")}
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div className="flex flex-col justify-end">
          <div className="bg-muted border border-border rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>{t("invoice.subtotal")}</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            {totalGst > 0 ? (
              <>
                {gstTaxSummary.some((r) => r.cgst > 0) && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>CGST</span><span>₹{gstTaxSummary.reduce((s, r) => s + r.cgst, 0).toFixed(2)}</span>
                  </div>
                )}
                {gstTaxSummary.some((r) => r.sgst > 0) && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>SGST</span><span>₹{gstTaxSummary.reduce((s, r) => s + r.sgst, 0).toFixed(2)}</span>
                  </div>
                )}
                {gstTaxSummary.some((r) => r.igst > 0) && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>IGST</span><span>₹{gstTaxSummary.reduce((s, r) => s + r.igst, 0).toFixed(2)}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>{t("invoice.tax")} %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-16 border border-border rounded px-2 py-0.5 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <span>₹{taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-foreground pt-2 border-t border-border">
              <span>{t("invoice.total")}</span>
              <span>₹{(subtotal + (totalGst > 0 ? totalGst : taxAmount)).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Make Recurring */}
      <div className="border border-border rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMakeRecurring(!makeRecurring)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${makeRecurring ? "bg-blue-600" : "bg-gray-200"}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${makeRecurring ? "translate-x-6" : "translate-x-1"}`} />
          </button>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-foreground">{t("invoice.makeRecurring")}</span>
          </div>
        </div>

        {makeRecurring && (
          <div className="space-y-4 pt-2 border-t border-border">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{t("invoice.frequency")}</p>
              <div className="flex gap-2 flex-wrap">
                {(["weekly", "monthly", "quarterly", "annually"] as RecurringFrequency[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setRecurFrequency(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                      recurFrequency === f ? "bg-blue-600 text-white border-blue-600" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("invoice.startDate")}</label>
                <input
                  type="date"
                  value={recurStart}
                  onChange={(e) => setRecurStart(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t("invoice.endDateOptional")}</label>
                <input
                  type="date"
                  value={recurEnd}
                  onChange={(e) => setRecurEnd(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRecurAutoSend(!recurAutoSend)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${recurAutoSend ? "bg-blue-600" : "bg-gray-200"}`}
              >
                <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform ${recurAutoSend ? "translate-x-5" : "translate-x-1"}`} />
              </button>
              <span className="text-xs text-foreground">{t("invoice.autoSend")}</span>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-end pt-2">
        <button
          onClick={() => { setTemplateNameInput(""); setShowSaveTemplateModal(true); }}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
        >
          Save as Template
        </button>
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
        >
          {t("invoice.saveAsDraft")}
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Send className="h-4 w-4" />
          {t("invoice.saveAndSend")}
        </button>
      </div>

      {/* Save as Template inline modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Save as Template</h2>
              <button onClick={() => setShowSaveTemplateModal(false)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Template Name *</label>
              <input
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={templateNameInput}
                onChange={(e) => setTemplateNameInput(e.target.value)}
                placeholder="e.g. Monthly Retainer"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSaveTemplateModal(false)}
                disabled={savingTemplate}
                className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                disabled={savingTemplate}
                onClick={async () => {
                  if (!templateNameInput.trim()) { toast.error(t("invoice.nameRequired")); return; }
                  setSavingTemplate(true);
                  try {
                    const lineItems: InvoiceLineItem[] = rows
                      .filter((r) => r.description)
                      .map((r) => ({
                        id: r.id,
                        description: r.description,
                        quantity: r.quantity,
                        rate: r.rate,
                        amount: r.quantity * r.rate,
                      }));
                    const { error: saveTplErr } = await supabase.from("invoice_templates").insert([{
                      name: templateNameInput.trim(),
                      line_items: lineItems,
                      notes: notes,
                      payment_terms: "NET30",
                      created_by: currentUserId ?? null,
                    }]);
                    if (saveTplErr) throw new Error(saveTplErr.message);
                    toast.success("Template saved successfully");
                    setShowSaveTemplateModal(false);
                  } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : t("common.error"));
                  } finally {
                    setSavingTemplate(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {savingTemplate ? t("common.saving") : "Save Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Analytics Tab (with date range) ------------------------------------

type DateRange = "last30" | "last90" | "thisFY" | "custom";

interface AnalyticsTabProps {
  analytics: ReturnType<typeof useInvoiceData>["analytics"];
  invoices: Invoice[];
  onAgeFilterClick?: (bucket: string) => void;
}

interface RevenueTrendPoint { month: string; revenue: number; }
interface TopClientPoint { name: string; revenue: number; }

function AnalyticsTab({ analytics, invoices, onAgeFilterClick }: AnalyticsTabProps) {
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange>("last30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Chart data states
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrendPoint[]>([]);
  const [topClients, setTopClients] = useState<TopClientPoint[]>([]);

  // Revenue trend: last 12 months
  useEffect(() => {
    async function loadCharts() {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
      twelveMonthsAgo.setDate(1);
      const { data } = await supabase
        .from("invoices")
        .select("total, created_at, status")
        .gte("created_at", twelveMonthsAgo.toISOString());

      if (data) {
        const monthMap: Record<string, number> = {};
        for (const row of data as Array<{ total: number; created_at: string; status: string }>) {
          const d = new Date(row.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          monthMap[key] = (monthMap[key] ?? 0) + (row.status === "Paid" ? row.total : 0);
        }
        const months: RevenueTrendPoint[] = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const label = d.toLocaleString("en-US", { month: "short" });
          months.push({ month: label, revenue: Math.round((monthMap[key] ?? 0) / 1000 * 10) / 10 });
        }
        setRevenueTrend(months);
      }

      // Top 5 clients by paid revenue
      const { data: paidData } = await supabase
        .from("invoices")
        .select("client_id, bill_to_name, total")
        .eq("status", "Paid");

      if (paidData) {
        const clientMap: Record<string, { name: string; revenue: number }> = {};
        for (const row of paidData as Array<{ client_id: string; bill_to_name: string; total: number }>) {
          const id = row.client_id ?? row.bill_to_name;
          if (!clientMap[id]) clientMap[id] = { name: row.bill_to_name, revenue: 0 };
          clientMap[id].revenue += row.total;
        }
        const sorted = Object.values(clientMap)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)
          .map((c) => ({ name: c.name, revenue: Math.round(c.revenue) }));
        setTopClients(sorted);
      }
    }
    void loadCharts();
  }, []);

  // Status distribution from invoices prop
  const statusDistData = useMemo(() => {
    const colorMap: Record<string, string> = {
      Draft: "#9ca3af",
      Sent: "#3b82f6",
      "Partially Paid": "#f59e0b",
      Paid: "#10b981",
      Overdue: "#ef4444",
      Cancelled: "#64748b",
      Unpaid: "#eab308",
    };
    const counts: Record<string, number> = {};
    for (const inv of invoices) {
      counts[inv.status] = (counts[inv.status] ?? 0) + 1;
    }
    return Object.entries(counts).map(([status, value]) => ({
      name: status,
      value,
      color: colorMap[status] ?? "#9ca3af",
    }));
  }, [invoices]);

  const [filteredAnalytics, setFilteredAnalytics] = useState<{
    totalRevenue: number;
    outstanding: number;
    overdue: number;
    paidThisMonth: number;
    totalInvoices: number;
    paidCount: number;
    overdueCount: number;
  } | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  function getDateBounds(range: DateRange): { from: string; to: string } {
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    if (range === "last30") {
      const from = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
      return { from, to };
    } else if (range === "last90") {
      const from = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);
      return { from, to };
    } else if (range === "thisFY") {
      const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      return { from: `${year}-04-01`, to: `${year + 1}-03-31` };
    } else {
      return { from: customFrom || to, to: customTo || to };
    }
  }

  useEffect(() => {
    if (dateRange === "custom" && (!customFrom || !customTo)) return;

    async function loadAnalytics() {
      setLoadingAnalytics(true);
      const { from, to } = getDateBounds(dateRange);
      const { data } = await supabase
        .from("invoices")
        .select("status, total, invoice_date")
        .gte("invoice_date", from)
        .lte("invoice_date", to);

      if (!data) { setLoadingAnalytics(false); return; }

      const rows = data as Array<{ status: string; total: number; invoice_date: string }>;
      const totalRevenue = rows.filter((r) => r.status === "Paid").reduce((s, r) => s + r.total, 0);
      const outstanding = rows.filter((r) => r.status === "Sent" || r.status === "Partially Paid").reduce((s, r) => s + r.total, 0);
      const overdue = rows.filter((r) => r.status === "Overdue").reduce((s, r) => s + r.total, 0);
      const now = new Date();
      const paidThisMonth = rows
        .filter((r) => {
          const d = new Date(r.invoice_date);
          return r.status === "Paid" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((s, r) => s + r.total, 0);

      setFilteredAnalytics({
        totalRevenue,
        outstanding,
        overdue,
        paidThisMonth,
        totalInvoices: rows.length,
        paidCount: rows.filter((r) => r.status === "Paid").length,
        overdueCount: rows.filter((r) => r.status === "Overdue").length,
      });
      setLoadingAnalytics(false);
    }

    void loadAnalytics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, customFrom, customTo]);

  const activeAnalytics = filteredAnalytics ?? analytics;

  const cards = [
    {
      label: t("invoice.totalRevenue"),
      value: activeAnalytics ? fmt(activeAnalytics.totalRevenue) : "-",
      color: "bg-green-50 border-green-200 text-green-700",
      accent: "text-green-600",
    },
    {
      label: t("invoice.outstanding"),
      value: activeAnalytics ? fmt(activeAnalytics.outstanding) : "-",
      color: "bg-blue-50 border-blue-200 text-blue-700",
      accent: "text-blue-600",
    },
    {
      label: t("invoice.overdue"),
      value: activeAnalytics ? fmt(activeAnalytics.overdue) : "-",
      color: "bg-red-50 border-red-200 text-red-700",
      accent: "text-red-600",
    },
    {
      label: t("invoice.paidThisMonth"),
      value: activeAnalytics ? fmt(activeAnalytics.paidThisMonth) : "-",
      color: "bg-purple-50 border-purple-200 text-purple-700",
      accent: "text-purple-600",
    },
  ];

  const statusCounts: Record<string, number> = {};
  for (const inv of invoices) {
    statusCounts[inv.status] = (statusCounts[inv.status] ?? 0) + 1;
  }
  const total = invoices.length || 1;

  const barColors: Record<string, string> = {
    Draft: "bg-gray-400",
    Sent: "bg-blue-500",
    Paid: "bg-green-500",
    Unpaid: "bg-yellow-500",
    Overdue: "bg-red-500",
    Cancelled: "bg-gray-300",
    "Partially Paid": "bg-orange-400",
  };

  return (
    <div className="space-y-6">
      {/* Date range filter */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-foreground">{t("invoice.dateRange")}:</span>
          {(["last30", "last90", "thisFY", "custom"] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                dateRange === r
                  ? "bg-blue-600 text-white"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {r === "last30" ? t("invoice.last30Days") :
               r === "last90" ? t("invoice.last90Days") :
               r === "thisFY" ? t("invoice.thisFY") :
               t("invoice.customRange")}
            </button>
          ))}
          {dateRange === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          {loadingAnalytics && (
            <svg className="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`border rounded-2xl p-4 ${c.color}`}>
            <p className="text-xs font-medium opacity-75 mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.accent}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Charts 2-column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Revenue Trend — full width */}
        <div className="sm:col-span-2 bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={revenueTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="indigoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${v}k`} />
              <Tooltip formatter={(v: number) => [`₹${v}k`, "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#indigoGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status Donut */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Invoice Status Distribution</h3>
          {statusDistData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusDistData}
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {statusDistData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Legend iconSize={10} wrapperStyle={{ fontSize: "11px" }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top 5 Clients Horizontal Bar */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Top 5 Clients by Revenue</h3>
          {topClients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No paid invoices yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={topClients} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
                <Bar dataKey="revenue" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Revenue Trend (local invoices) + Top 5 Clients (local invoices) */}
      {(() => {
        const revenueByMonth = invoices.reduce((acc, inv) => {
          const month = inv.invoiceDate?.slice(0, 7);
          if (!month) return acc;
          acc[month] = (acc[month] || 0) + (inv.total || 0);
          return acc;
        }, {} as Record<string, number>);
        const trendData = Object.entries(revenueByMonth).sort().slice(-6).map(([month, total]) => ({ month: month.slice(5), total }));

        const clientTotals = invoices.reduce((acc, inv) => {
          const name = inv.billToName || inv.client_name || "Unknown";
          acc[name] = (acc[name] || 0) + (inv.total || 0);
          return acc;
        }, {} as Record<string, number>);
        const top5 = Object.entries(clientTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, total]) => ({ name, total }));

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Revenue Trend (Last 6 Months)</h3>
              {trendData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
                    <Line type="monotone" dataKey="total" stroke="#4F46E5" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Top 5 Clients (All Invoices)</h3>
              {top5.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={top5} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Total"]} />
                    <Bar dataKey="total" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        );
      })()}

      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">{t("invoice.statusBreakdown")}</h3>
        <div className="space-y-3">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="flex items-center gap-3">
              <span className="w-24 text-sm text-muted-foreground">{status}</span>
              <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColors[status] ?? "bg-gray-400"} transition-all`}
                  style={{ width: `${(count / total) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-sm font-medium text-foreground">{count}</span>
            </div>
          ))}
          {invoices.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t("invoice.noInvoiceData")}</p>
          )}
        </div>
      </div>

      {/* Overdue Aging Chart */}
      {(() => {
        const overdueInvoices = invoices.filter(
          (inv) => (inv.status === "Sent" || inv.status === ("Partially Paid" as string)) && inv.dueDate && new Date(inv.dueDate) < today
        );
        const buckets = [
          { label: "0-30d", count: 0, amount: 0 },
          { label: "31-60d", count: 0, amount: 0 },
          { label: "61-90d", count: 0, amount: 0 },
          { label: "90d+", count: 0, amount: 0 },
        ];
        for (const inv of overdueInvoices) {
          const ageDays = Math.floor((today.getTime() - new Date(inv.dueDate!).getTime()) / 86400000);
          const bi = ageDays <= 30 ? 0 : ageDays <= 60 ? 1 : ageDays <= 90 ? 2 : 3;
          buckets[bi].count++;
          buckets[bi].amount += inv.total;
        }
        const maxAmt = Math.max(...buckets.map((b) => b.amount), 1);
        return overdueInvoices.length > 0 ? (
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">{t("invoice.overdueAging")}</h3>
              {onAgeFilterClick && (
                <p className="text-xs text-muted-foreground">Click a bar to filter invoices by aging bucket</p>
              )}
            </div>
            <div className="flex items-end gap-4 h-32">
              {buckets.map((b) => (
                <div
                  key={b.label}
                  className={`flex-1 flex flex-col items-center gap-1 ${onAgeFilterClick && b.count > 0 ? "cursor-pointer group" : ""}`}
                  onClick={() => { if (onAgeFilterClick && b.count > 0) onAgeFilterClick(b.label); }}
                >
                  <p className="text-xs font-medium text-red-600">{b.count > 0 ? fmt(b.amount) : ""}</p>
                  <div className="w-full flex items-end justify-center" style={{ height: "80px" }}>
                    <div
                      className="w-full bg-red-400 rounded-t transition-all group-hover:bg-red-600"
                      style={{ height: `${(b.amount / maxAmt) * 100}%`, minHeight: b.count > 0 ? "4px" : "0" }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{b.label}</p>
                  <p className="text-xs text-red-600 font-medium">{b.count} inv</p>
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}

      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">{t("invoice.summary")}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div className="text-center p-3 bg-muted rounded-xl">
            <p className="text-2xl font-bold text-foreground">{activeAnalytics?.totalInvoices ?? invoices.length}</p>
            <p className="text-muted-foreground mt-0.5">{t("invoice.totalInvoices")}</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-xl">
            <p className="text-2xl font-bold text-green-700">{activeAnalytics?.paidCount ?? statusCounts["Paid"] ?? 0}</p>
            <p className="text-muted-foreground mt-0.5">{t("invoice.paid")}</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-xl">
            <p className="text-2xl font-bold text-red-700">{activeAnalytics?.overdueCount ?? statusCounts["Overdue"] ?? 0}</p>
            <p className="text-muted-foreground mt-0.5">{t("invoice.overdue")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Cancel Invoice Modal -----------------------------------------------

interface CancelInvoiceModalProps {
  invoice: Invoice;
  onClose: () => void;
  onCancelled: () => void;
  currentUserId?: string;
}

function CancelInvoiceModal({ invoice, onClose, onCancelled, currentUserId }: CancelInvoiceModalProps) {
  const [cancelReason, setCancelReason] = useState("");
  const [creditNoteRef, setCreditNoteRef] = useState("");
  const [saving, setSaving] = useState(false);

  const field = "w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500";

  async function handleCancel() {
    if (!cancelReason.trim()) { toast.error("Cancellation reason is required."); return; }
    if (cancelReason.trim().length < 10) { toast.error("Cancellation reason must be at least 10 characters."); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({
          status: "Cancelled",
          cancellation_reason: cancelReason.trim(),
          credit_note_reference: creditNoteRef.trim() || null,
          cancelled_at: new Date().toISOString(),
          cancelled_by: currentUserId ?? null,
        })
        .eq("id", invoice.id);
      if (error) throw new Error(error.message);

      const notifyUserId = (invoice as Invoice & { created_by?: string }).created_by ?? invoice.createdBy;
      if (notifyUserId) {
        void supabase.from("notifications").insert([{
          user_id: notifyUserId,
          type: "invoice_cancelled",
          title: "Invoice Cancelled",
          message: `Invoice ${invoice.invoiceNumber} has been cancelled. Reason: ${cancelReason.trim()}`,
          severity: "medium",
          read: false,
          action_required: false,
          action_data: { invoice_id: invoice.id },
        }]);
      }

      toast.success("Invoice cancelled successfully");
      onCancelled();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-red-600" />
            <div>
              <h2 className="text-xl font-bold text-foreground">Cancel Invoice</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{invoice.invoiceNumber} · {invoice.billToName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Cancellation Reason *</label>
            <textarea
              className={`${field} resize-none`}
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Credit Note Reference (optional)</label>
            <input
              className={field}
              value={creditNoteRef}
              onChange={(e) => setCreditNoteRef(e.target.value)}
              placeholder="CN-2026-001"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={onClose} disabled={saving} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
              Keep Invoice
            </button>
            <button onClick={handleCancel} disabled={saving} className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {saving ? "Cancelling..." : "Cancel Invoice"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Main component ------------------------------------------------------

const PAGE_SIZE = 20;

interface Props { accessToken?: string; onLogout?: () => void; }
export function InvoiceGenerationSystem(_props: Props) {
  const { currentUser } = useUser();
  const { log } = useAuditLogger();
  const [activeTab, setActiveTab] = useState<"invoices" | "clients" | "templates" | "recurring" | "create" | "analytics">("invoices");
  const [emailPreviewInvoice, setEmailPreviewInvoice] = useState<Invoice | null>(null);
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "All";
  const setStatusFilter = (status: string) =>
    setSearchParams(prev => { prev.set("status", status); prev.set("page", "1"); return prev; });
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const setCurrentPage = (page: number) =>
    setSearchParams(prev => { prev.set("page", String(page)); return prev; });
  // Fix 7: age filter from analytics chart
  const [ageFilter, setAgeFilter] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [pagedInvoices, setPagedInvoices] = useState<Invoice[]>([]);
  const [pageLoading, setPageLoading] = useState(false);

  // Master data config: invoice policies (loaded from DB, seeded with defaults)
  const [invoicePolicies, setInvoicePolicies] = useState({
    company_name: "Your Company",
    company_gstin: "",
    company_pan: "",
    company_address: "",
    company_email: "",
    bank_name: "",
    bank_account: "",
    bank_ifsc: "",
    default_payment_terms: 30,
    default_tax_rate: 18,
    late_fee_percent: 1.5,
    invoice_number_format: "INV-{YYYY}-{####}",
  });

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("master_data_config")
        .select("config_key, config_value")
        .eq("config_group", "invoice_policies");
      if (data && data.length > 0) {
        const overrides: Record<string, unknown> = {};
        data.forEach((row: { config_key: string; config_value: unknown }) => { overrides[row.config_key] = row.config_value; });
        setInvoicePolicies(prev => ({ ...prev, ...overrides }));
      } else {
        void supabase.from("master_data_config").upsert([
          { config_group: "invoice_policies", config_key: "company_name", config_value: "Your Company", display_name: "Company Name", data_type: "string" },
          { config_group: "invoice_policies", config_key: "company_gstin", config_value: "", display_name: "Company GSTIN", data_type: "string" },
          { config_group: "invoice_policies", config_key: "company_pan", config_value: "", display_name: "Company PAN", data_type: "string" },
          { config_group: "invoice_policies", config_key: "default_payment_terms", config_value: 30, display_name: "Default Payment Terms (days)", data_type: "number" },
          { config_group: "invoice_policies", config_key: "default_tax_rate", config_value: 18, display_name: "Default GST Rate (%)", data_type: "number" },
          { config_group: "invoice_policies", config_key: "late_fee_percent", config_value: 1.5, display_name: "Late Fee % per Month", data_type: "number" },
          { config_group: "invoice_policies", config_key: "bank_name", config_value: "", display_name: "Bank Name", data_type: "string" },
          { config_group: "invoice_policies", config_key: "bank_account", config_value: "", display_name: "Bank Account Number", data_type: "string" },
          { config_group: "invoice_policies", config_key: "bank_ifsc", config_value: "", display_name: "Bank IFSC", data_type: "string" },
        ], { onConflict: "config_group,config_key", ignoreDuplicates: true });
      }
    })();
  }, []);

  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [cancellingInvoice, setCancellingInvoice] = useState<Invoice | null>(null);
  const [quickPaymentInvoice, setQuickPaymentInvoice] = useState<Invoice | null>(null);
  const overdueCheckDoneRef = useRef(false);
  const [reminderCounts, setReminderCounts] = useState<Record<string, number>>({});

  const { invoices, analytics, billToClients, loading, createInvoice, updateInvoice, sendInvoice, markPaid, deleteInvoice, refresh } =
    useInvoiceData();

  const { templates, refresh: refreshTemplates } = useTemplates();
  const { clients: supaClients, refresh: refreshClients } = useClients(true);

  const isAdminOrFinance =
    currentUser?.primaryRole === "admin" || currentUser?.primaryRole === "finance";

  const canCancelInvoice =
    currentUser?.primaryRole === "admin" || currentUser?.primaryRole === "finance_manager";

  // Paginated server-side fetch
  const fetchPage = useCallback(async (page: number, q: string, status: string) => {
    setPageLoading(true);
    const todayStr = new Date().toISOString().slice(0, 10);
    let query = supabase.from("invoices").select("*", { count: "exact" });
    if (status === "Overdue") {
      query = query.in("status", ["Sent", "Partially Paid"]).lt("due_date", todayStr);
    } else if (status !== "All") {
      query = query.eq("status", status);
    }
    if (q) query = query.or(`invoice_number.ilike.%${q}%,bill_to_name.ilike.%${q}%`);
    query = query.order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, count } = await query;
    const fetchedInvoices = (data as Invoice[]) ?? [];
    setPagedInvoices(fetchedInvoices);
    setTotalCount(count ?? 0);
    if (fetchedInvoices.length > 0) {
      const { data: reminderData } = await supabase
        .from('invoice_reminder_log')
        .select('invoice_id')
        .in('invoice_id', fetchedInvoices.map(i => i.id));
      if (reminderData) {
        const counts: Record<string, number> = {};
        for (const row of reminderData) {
          counts[row.invoice_id] = (counts[row.invoice_id] ?? 0) + 1;
        }
        setReminderCounts(counts);
      }
    }
    setPageLoading(false);
  }, []);

  useEffect(() => {
    void fetchPage(currentPage, search, statusFilter);
  }, [currentPage, search, statusFilter, fetchPage]);

  // Reset to page 1 on search text change (statusFilter change already resets via setStatusFilter)
  const prevSearchRef = useRef(search);
  useEffect(() => {
    if (prevSearchRef.current !== search) {
      prevSearchRef.current = search;
      setSearchParams(prev => { prev.set("page", "1"); return prev; });
    }
  }, [search, setSearchParams]);

  // FIX 1a: Check and notify overdue invoices once when invoices tab loads
  useEffect(() => {
    if (
      activeTab === "invoices" &&
      !overdueCheckDoneRef.current &&
      pagedInvoices.length > 0 &&
      currentUser?.id
    ) {
      overdueCheckDoneRef.current = true;
      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const overdueInvs = pagedInvoices.filter(
        inv => ["Sent", "Partially Paid"].includes(inv.status) && inv.dueDate && inv.dueDate < yesterdayStr
      );
      if (overdueInvs.length > 0) {
        supabase.from("app_users").select("id").contains("roles", ["finance_manager"]).then(({ data: financeUsers }) => {
          const targets = (financeUsers ?? []);
          for (const inv of overdueInvs) {
            const dueDate14 = new Date(inv.dueDate);
            const daysPast14 = (Date.now() - dueDate14.getTime()) / (1000 * 60 * 60 * 24);
            for (const fu of targets) {
              void supabase.from("notifications").insert([{
                user_id: fu.id,
                type: "invoice_overdue",
                title: "Invoice Overdue",
                message: `Invoice ${inv.invoiceNumber} for ${inv.billToName} is overdue.`,
                app_name: "Invoice Generation",
                read: false,
              }]);
              if (daysPast14 >= 14) {
                void supabase.from("notifications").insert([{
                  user_id: fu.id,
                  type: "invoice_overdue_14d",
                  title: "Invoice 14 Days Overdue",
                  message: `Invoice ${inv.invoiceNumber} is ${Math.floor(daysPast14)} days overdue. Urgent follow-up required.`,
                  app_name: "Invoice Generation",
                  read: false,
                  severity: "high",
                }]);
              }
            }
          }
        });
      }
    }
  }, [activeTab, pagedInvoices, currentUser]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  async function handleDelete(id: string) {
    const inv = pagedInvoices.find(i => i.id === id);
    await deleteInvoice(id);
    log({ event_type: 'invoice_deleted', action: 'invoice_deleted', resource_id: id, metadata: { invoice_id: id, invoice_number: inv?.invoiceNumber } });
    setConfirmDeleteId(null);
    void fetchPage(currentPage, search, statusFilter);
  }

  const tabs = [
    { id: "invoices" as const, label: t("invoice.invoices"), icon: FileText },
    { id: "clients" as const, label: t("invoice.clients"), icon: Users },
    { id: "templates" as const, label: t("invoice.templates"), icon: LayoutTemplate },
    { id: "recurring" as const, label: t("invoice.recurring"), icon: RefreshCw },
    { id: "create" as const, label: t("invoice.newInvoice"), icon: Plus },
    { id: "analytics" as const, label: t("invoice.analytics"), icon: CreditCard },
  ];

  // Build merged billToClients from both hook data and supabase clients
  const mergedBillToClients: BillToItem[] = useMemo(() => {
    const fromSupabase: BillToItem[] = supaClients
      .filter((c) => c.is_active)
      .map((c) => ({
        id: c.id,
        name: c.name,
        address: [c.address, c.city, c.country].filter(Boolean).join(", "),
        gstin: c.gst_number,
        currency: c.currency,
      }));
    const existing = billToClients.filter((b) => !fromSupabase.find((s) => s.id === b.id));
    return [...fromSupabase, ...existing];
  }, [supaClients, billToClients]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-blue-100 rounded-xl">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t("invoice.title")}</h1>
          <div className="ml-auto">
            <ReportDefectButton appName="Invoice Generation" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground ml-12">
          {isAdminOrFinance
            ? t("invoice.manageAllInvoices")
            : t("invoice.viewAndManage")}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 bg-muted p-1 rounded-xl mb-6 w-fit max-w-full">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ---- Invoices tab ---- */}
      {activeTab === "invoices" && (
        <div className="space-y-4">
          {/* Fix 7: Age filter banner */}
          {ageFilter && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm">
              <span className="text-red-700 font-medium">Filtering by overdue aging: {ageFilter}</span>
              <button
                onClick={() => setAgeFilter(null)}
                className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-xs font-medium"
              >
                <X className="h-3 w-3" />
                Clear Filter
              </button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t("invoice.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none border border-border rounded-xl px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(["All", ...INVOICE_STATUSES, "Partially Paid", "Overdue"] as string[]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            <button
              onClick={() => setActiveTab("create")}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              {t("invoice.newInvoice")}
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              {pageLoading || loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <svg className="animate-spin h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {t("invoice.loadingInvoices")}
                </div>
              ) : pagedInvoices.length === 0 ? (
                <div className="text-center py-16">
                  <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">{t("invoice.noInvoicesFound")}</p>
                  <p className="text-muted-foreground text-sm mt-1">
                    {search || statusFilter !== "All" ? t("invoice.adjustFilters") : t("invoice.createFirstInvoice")}
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">{t("invoice.invoiceNumber")}</th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">{t("invoice.billTo")}</th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">{t("common.date")}</th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium hidden sm:table-cell">{t("invoice.dueDate")}</th>
                      <th className="px-4 py-3 text-right text-muted-foreground font-medium">{t("invoice.total")}</th>
                      <th className="px-4 py-3 text-left text-muted-foreground font-medium">{t("invoice.paymentStatus")}</th>
                      <th className="px-4 py-3 text-center text-muted-foreground font-medium">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(ageFilter
                      ? pagedInvoices.filter((inv) => {
                          if (!inv.dueDate) return false;
                          const ageDays = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000);
                          if (ageFilter === "0-30d") return ageDays >= 0 && ageDays <= 30;
                          if (ageFilter === "31-60d") return ageDays >= 31 && ageDays <= 60;
                          if (ageFilter === "61-90d") return ageDays >= 61 && ageDays <= 90;
                          if (ageFilter === "90d+") return ageDays > 90;
                          return true;
                        })
                      : pagedInvoices
                    ).map((inv) => {
                      const isOverdue =
                        (inv.status === "Sent" || inv.status === ("Partially Paid" as string)) &&
                        !!inv.dueDate && new Date(inv.dueDate) < new Date();
                      const overdueDays = isOverdue
                        ? Math.floor((Date.now() - new Date(inv.dueDate!).getTime()) / 86400000)
                        : 0;
                      return (
                      <tr key={inv.id} className={`hover:bg-muted transition-colors ${isOverdue ? "bg-red-50" : ""}`}>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {inv.invoiceNumber}
                          {(inv as Invoice & { is_recurring?: boolean }).is_recurring && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full px-1.5 py-0.5">🔄 Recurring</span>
                          )}
                          {(reminderCounts[inv.id] ?? 0) > 0 && (
                            <span className="ml-1 inline-flex items-center text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5" title="Reminders sent">
                              Reminders sent: {reminderCounts[inv.id]}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-foreground">{inv.billToName}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(inv.invoiceDate)}</td>
                        <td className="px-4 py-3 whitespace-nowrap hidden sm:table-cell">
                          {isOverdue ? (
                            <span className="relative inline-flex items-center">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-40"></span>
                              <span className="relative bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                                {t("invoice.overdueDays").replace("{n}", String(overdueDays))}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{fmtDate(inv.dueDate)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">
                          {fmt(inv.total, inv.currencySymbol)}
                        </td>
                        <td className="px-4 py-3">
                          {statusBadge(
                            (inv.amountPaid ?? 0) > 0 && inv.status !== "Paid"
                              ? "Partially Paid" as Invoice["status"]
                              : inv.status
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {(inv.status === "Sent" || inv.status === "Overdue" || inv.status === ("Partially Paid" as string)) && (
                              <button
                                title={t("invoice.recordPayment")}
                                onClick={() => setQuickPaymentInvoice(inv)}
                                className="p-1.5 rounded-lg hover:bg-purple-50 text-muted-foreground hover:text-purple-600 transition-colors"
                              >
                                <CreditCard className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              title={t("common.view")}
                              onClick={() => setViewingInvoice(inv)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {inv.status !== "Paid" && inv.status !== "Cancelled" && (
                              <button
                                title={t("common.edit")}
                                onClick={() => setEditingInvoice(inv)}
                                className="p-1.5 rounded-lg hover:bg-yellow-50 text-muted-foreground hover:text-yellow-600 transition-colors"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {inv.status === "Draft" && (
                              <button
                                title={t("invoice.send")}
                                onClick={() => setEmailPreviewInvoice(inv)}
                                className="p-1.5 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-colors"
                              >
                                <Send className="h-4 w-4" />
                              </button>
                            )}
                            {(inv.status === "Sent" || inv.status === "Overdue" || inv.status === ("Partially Paid" as string)) && (
                              <button
                                title={t("invoice.markPaid")}
                                onClick={async () => {
                                  await markPaid(inv.id);
                                  void fetchPage(currentPage, search, statusFilter);
                                }}
                                className="p-1.5 rounded-lg hover:bg-green-50 text-muted-foreground hover:text-green-600 transition-colors"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            )}
                            {canCancelInvoice && ["Draft", "Sent"].includes(inv.status) && (
                              <button
                                title="Cancel Invoice"
                                onClick={() => setCancellingInvoice(inv)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            )}
                            {isAdminOrFinance && (
                              <button
                                title={t("common.delete")}
                                onClick={() => {
                                  // Fix 4: guard Paid or Overdue invoices
                                  if (inv.status === "Paid" || inv.status === "Overdue") {
                                    toast.error("Cannot delete Paid or Overdue invoices");
                                    return;
                                  }
                                  setConfirmDeleteId(inv.id);
                                }}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {!pageLoading && totalCount > 0 && (
              <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {totalCount} invoice{totalCount !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t("invoice.prevPage")}
                  </button>
                  <span className="text-muted-foreground px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {t("invoice.nextPage")}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Clients tab ---- */}
      {activeTab === "clients" && (
        <ClientsTab currentUserId={currentUser?.id} invoices={invoices} />
      )}

      {/* ---- Templates tab ---- */}
      {activeTab === "templates" && (
        <TemplatesTab />
      )}

      {/* ---- Recurring tab ---- */}
      {activeTab === "recurring" && (
        <RecurringTab
          clients={supaClients}
          templates={templates}
          currentUserId={currentUser?.id}
        />
      )}

      {/* ---- Create Invoice tab ---- */}
      {activeTab === "create" && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">{t("invoice.newInvoice")}</h2>
          <CreateInvoiceTab
            billToClients={mergedBillToClients}
            createInvoice={createInvoice}
            sendInvoice={sendInvoice}
            templates={templates}
            onRefreshClients={refreshClients}
            currentUserId={currentUser?.id}
            supaClients={supaClients}
            defaultTaxRate={typeof invoicePolicies.default_tax_rate === 'number' ? invoicePolicies.default_tax_rate : 0}
            defaultPaymentTerms={typeof invoicePolicies.default_payment_terms === 'number' ? invoicePolicies.default_payment_terms : 30}
            onCreated={() => {
              setActiveTab("invoices");
              refresh();
              void fetchPage(1, search, statusFilter);
            }}
          />
        </div>
      )}

      {/* ---- Analytics tab ---- */}
      {activeTab === "analytics" && (
        <AnalyticsTab
          analytics={analytics}
          invoices={invoices}
          onAgeFilterClick={(bucket) => {
            setAgeFilter(bucket);
            setActiveTab("invoices");
          }}
        />
      )}

      {/* View Invoice Modal */}
      {viewingInvoice && (
        <ViewInvoiceModal
          invoice={viewingInvoice}
          onClose={() => setViewingInvoice(null)}
          onPaymentRecorded={() => {
            void fetchPage(currentPage, search, statusFilter);
            refresh();
          }}
          currentUserId={currentUser?.id}
          companyInfo={invoicePolicies}
        />
      )}

      {/* Edit Invoice Modal */}
      {editingInvoice && (
        <EditInvoiceModal
          invoice={editingInvoice}
          billToClients={mergedBillToClients}
          updateInvoice={async (id, updates) => {
            const result = await updateInvoice(id, updates);
            if (result) {
              setEditingInvoice(null);
              refresh();
              void fetchPage(currentPage, search, statusFilter);
            }
            return result;
          }}
          onClose={() => setEditingInvoice(null)}
        />
      )}

      {/* Email Preview Modal */}
      {emailPreviewInvoice && (
        <EmailPreviewModal
          invoice={emailPreviewInvoice}
          clientEmail={
            supaClients.find((c) => c.id === emailPreviewInvoice.billToId)?.email ??
            emailPreviewInvoice.billToName
          }
          companyName={invoicePolicies.company_name}
          onClose={() => setEmailPreviewInvoice(null)}
          onSent={() => {
            setEmailPreviewInvoice(null);
            void fetchPage(currentPage, search, statusFilter);
            refresh();
          }}
        />
      )}

      {/* Quick Record Payment Modal (from invoice list row) */}
      {quickPaymentInvoice && (
        <RecordPaymentModal
          invoice={quickPaymentInvoice}
          onClose={() => setQuickPaymentInvoice(null)}
          onSaved={() => {
            setQuickPaymentInvoice(null);
            void fetchPage(currentPage, search, statusFilter);
            refresh();
          }}
          currentUserId={currentUser?.id}
        />
      )}

      {/* Cancel Invoice Modal */}
      {cancellingInvoice && (
        <CancelInvoiceModal
          invoice={cancellingInvoice}
          onClose={() => setCancellingInvoice(null)}
          onCancelled={() => {
            setCancellingInvoice(null);
            void fetchPage(currentPage, search, statusFilter);
            refresh();
          }}
          currentUserId={currentUser?.id}
        />
      )}

      {/* Confirm Delete Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-foreground mb-2">{t("invoice.deleteTitle")}</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {t("invoice.deleteMessage")}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700"
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoiceGenerationSystem;
