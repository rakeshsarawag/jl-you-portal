import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { API_BASE, publicAnonKey, safeJson, apiHeaders } from "../utils/constants";
import { useUser } from "../context/UserContext";

const INVOICE_URL = `${API_BASE}/invoices`;

export interface InvoiceLineItem {
  id: string;
  description: string;
  hsnSac?: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoicePeriodFrom?: string;
  invoicePeriodTo?: string;
  poNumber?: string;
  currency: string;
  currencySymbol: string;
  billToId: string;
  billToName: string;
  billToAddress: string;
  billToGstin?: string;
  registrationId?: string;
  registrationDetails?: string;
  remittanceId?: string;
  remittanceDetails?: string;
  terms?: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  gstRate?: number;
  gstAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  totalInWords?: string;
  status: "Draft" | "Sent" | "Paid" | "Unpaid" | "Overdue" | "Cancelled";
  amountReceived?: number;
  professionalTaxDeducted?: number;
  paymentDate?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BillToItem {
  id: string;
  name: string;
  address: string;
  gstin?: string;
  client?: string;
  currency?: string;
}

export interface InvoiceAnalytics {
  totalRevenue: number;
  outstanding: number;
  overdue: number;
  paidThisMonth: number;
  totalInvoices: number;
  draftCount: number;
  sentCount: number;
  paidCount: number;
  overdueCount: number;
  cancelledCount: number;
}

function api(method: string, url: string, body?: unknown, userEmail?: string): Promise<Response> {
  return fetch(url, {
    method,
    headers: apiHeaders(userEmail),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function useInvoiceData(statusFilter?: string, clientIdFilter?: string) {
  const { currentUser } = useUser();
  const userEmail = currentUser?.email;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [analytics, setAnalytics] = useState<InvoiceAnalytics | null>(null);
  const [billToClients, setBillToClients] = useState<BillToItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdminOrFinance =
    currentUser?.primaryRole === "admin" || currentUser?.primaryRole === "finance";

  const buildInvoiceListUrl = useCallback(() => {
    const base = isAdminOrFinance ? `${INVOICE_URL}/all` : INVOICE_URL;
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (clientIdFilter) params.set("clientId", clientIdFilter);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }, [isAdminOrFinance, statusFilter, clientIdFilter]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [invoicesResult, analyticsResult, billToResult] = await Promise.allSettled([
        api("GET", buildInvoiceListUrl(), userEmail).then((r) => safeJson(r)),
        api("GET", `${INVOICE_URL}/analytics`, userEmail).then((r) => safeJson(r)),
        api("GET", `${INVOICE_URL}/billto/all`, userEmail).then((r) => safeJson(r)),
      ]);

      if (invoicesResult.status === "fulfilled" && invoicesResult.value?.success) {
        setInvoices(invoicesResult.value.data ?? []);
      }
      if (analyticsResult.status === "fulfilled" && analyticsResult.value?.success) {
        setAnalytics(analyticsResult.value.data ?? null);
      }
      if (billToResult.status === "fulfilled" && billToResult.value?.success) {
        setBillToClients(billToResult.value.data ?? []);
      }
    } catch {
      toast.error("Failed to load invoice data");
    } finally {
      setLoading(false);
    }
  }, [buildInvoiceListUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createInvoice = useCallback(
    async (invoiceData: Partial<Invoice>): Promise<Invoice | null> => {
      try {
        const res = await api("POST", `${INVOICE_URL}/create`, invoiceData, userEmail);
        const data = await safeJson(res);
        if (!res.ok || !data?.success) throw new Error(data?.error || "Failed to create invoice");
        setInvoices((prev) => [data.data, ...prev]);
        toast.success("Invoice created successfully");
        return data.data;
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to create invoice");
        return null;
      }
    },
    []
  );

  const updateInvoice = useCallback(
    async (id: string, updates: Partial<Invoice>): Promise<Invoice | null> => {
      try {
        const res = await api("POST", `${INVOICE_URL}/update`, { id, ...updates }, userEmail);
        const data = await safeJson(res);
        if (!res.ok || !data?.success) throw new Error(data?.error || "Failed to update invoice");
        setInvoices((prev) => prev.map((inv) => (inv.id === id ? data.data : inv)));
        toast.success("Invoice updated successfully");
        return data.data;
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to update invoice");
        return null;
      }
    },
    []
  );

  const deleteInvoice = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await api("DELETE", `${INVOICE_URL}/${id}`, userEmail);
      const data = await safeJson(res);
      if (!res.ok || !data?.success) throw new Error(data?.error || "Failed to delete invoice");
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
      toast.success("Invoice deleted");
      return true;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete invoice");
      return false;
    }
  }, []);

  const sendInvoice = useCallback(
    async (id: string): Promise<boolean> => {
      return updateInvoice(id, { status: "Sent" }).then((r) => r !== null);
    },
    [updateInvoice]
  );

  const markPaid = useCallback(
    async (id: string): Promise<boolean> => {
      return updateInvoice(id, {
        status: "Paid",
        paymentDate: new Date().toISOString().slice(0, 10),
      }).then((r) => r !== null);
    },
    [updateInvoice]
  );

  const createBillToClient = useCallback(
    async (item: Partial<BillToItem>): Promise<BillToItem | null> => {
      try {
        const res = await api("POST", `${INVOICE_URL}/billto`, item, userEmail);
        const data = await safeJson(res);
        if (!res.ok || !data?.success) throw new Error(data?.error || "Failed to create client");
        setBillToClients((prev) => [data.data, ...prev]);
        toast.success("Client created");
        return data.data;
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to create client");
        return null;
      }
    },
    []
  );

  return {
    invoices,
    analytics,
    billToClients,
    loading,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    sendInvoice,
    markPaid,
    createBillToClient,
    refresh,
  };
}
