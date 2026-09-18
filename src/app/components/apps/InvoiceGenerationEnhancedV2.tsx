/**
 * Invoice Generation - Enhanced with Smart Permissions
 * Permissions:
 * - View Invoices: Finance, Admins, Invoice Creator
 * - Create Invoice: Finance, Admins
 * - Update Invoice: Finance, Admins, Invoice Creator (if draft)
 * - Delete Invoice: Admins only
 * - Mark Paid: Finance, Admins
 * - Send Invoice: Finance, Admins
 * - Download Invoice: All employees (for their own invoices)
 */

import { useState, useEffect } from 'react';
import { InlineLoader } from '../ui/PageLoader';
import ConfirmDialog from '../ui/ConfirmDialog';
import { AppLayout } from './AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { 
  FileText,
  Plus,
  RefreshCw,
  Edit,
  Trash2,
  Download,
  Search,
  Send,
  CheckCircle,
  Clock,
  DollarSign,
  Calendar,
  User
} from 'lucide-react';
import { toast } from 'sonner';
import { t } from '../../../i18n';
import { useUser } from '../../context/UserContext';
import { API_BASE, publicAnonKey } from '../../utils/constants';
import { SelectOptions } from '../../context/ValueHelpsContext';
import { useClientOptions } from '../../hooks/useSharedData';

interface InvoiceGenerationDBProps {
  accessToken: string;
  onLogout: () => void;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
  taxAmount: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  notes?: string;
  createdBy: string;
  createdDate: string;
  paidDate?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export function InvoiceGenerationDB({ accessToken, onLogout }: InvoiceGenerationDBProps) {
  const { currentUser } = useUser();
  const { options: clients = [] } = useClientOptions();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<'invoices' | 'analytics'>('invoices');
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [newItems, setNewItems] = useState<InvoiceItem[]>([]);
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; danger?: boolean; action: () => void } | null>(null);
  const [rejectingInvoiceId, setRejectingInvoiceId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [invoiceErrors, setInvoiceErrors] = useState<Record<string, string>>({});

  // Permission checks
  const isAdmin = currentUser?.roles.includes('admin') || false;
  const isFinance = currentUser?.roles.includes('finance') || false;

  // Permissions
  const canViewInvoices = isFinance || isAdmin;
  const canCreateInvoice = isFinance || isAdmin;
  const canUpdateInvoice = (invoice: Invoice) => 
    (invoice.createdBy === currentUser?.name && invoice.status === 'draft') || isFinance || isAdmin;
  const canDeleteInvoice = isAdmin;
  const canMarkPaid = isFinance || isAdmin;
  const canSendInvoice = isFinance || isAdmin;

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const endpoint = (isAdmin || isFinance) ? `${API_BASE}/invoices/all` : `${API_BASE}/invoices`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      if (res.ok) {
        const json = await res.json();
        setInvoices(json?.data ?? []);
      }
    } catch {
      // keep existing list on error
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = (items: InvoiceItem[], taxRate: number) => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const tax = (subtotal * taxRate) / 100;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  // Auto-detect overdue: status=sent AND dueDate < today
  const getEffectiveStatus = (inv: Invoice): Invoice['status'] => {
    if (inv.status === 'sent' && new Date(inv.dueDate) < new Date()) return 'overdue';
    return inv.status;
  };

  // Persist a status change to the API then reload
  const persistStatus = async (invoiceId: string, status: string, extra?: Record<string, unknown>) => {
    try {
      await fetch(`${API_BASE}/invoices/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ id: invoiceId, status, ...extra }),
      });
      await loadInvoices();
    } catch {
      toast.error(t('invoice.failedUpdateStatus'));
    }
  };

  // Approve invoice
  const handleApproveInvoice = async (invoiceId: string) => {
    if (!isAdmin) { toast.error(t('invoice.onlyAdminsApprove')); return; }
    await persistStatus(invoiceId, 'approved', { approvedBy: currentUser?.name || 'Admin', approvedAt: new Date().toISOString() });
    toast.success(t('invoice.invoiceApproved'));
  };

  // Reject invoice
  const handleRejectInvoice = async (invoiceId: string, reason: string) => {
    if (!isAdmin) { toast.error(t('invoice.onlyAdminsReject')); return; }
    await persistStatus(invoiceId, 'rejected', { rejectionReason: reason });
    setRejectingInvoiceId(null);
    setRejectReason('');
    toast.info(t('invoice.invoiceRejected'));
  };

  const handleAddItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      taxRate: 18,
      amount: 0,
      taxAmount: 0,
    };
    setNewItems([...newItems, newItem]);
  };

  const handleUpdateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setNewItems(newItems.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unitPrice' || field === 'taxRate') {
        updated.amount = updated.quantity * updated.unitPrice;
        updated.taxAmount = updated.amount * (updated.taxRate / 100);
      }
      return updated;
    }));
  };

  const handleRemoveItem = (id: string) => {
    setNewItems(newItems.filter(item => item.id !== id));
  };

  const validateInvoiceForm = (clientName: string, issueDate: string, dueDate: string, taxRate: number) => {
    const errors: Record<string, string> = {};
    if (!clientName?.trim()) errors.clientName = t('validation.invoice.client');
    if (!issueDate?.trim()) errors.issueDate = t('validation.invoice.issueDate');
    if (!dueDate?.trim()) errors.dueDate = t('validation.invoice.dueDate');
    if (issueDate && dueDate && dueDate < issueDate) errors.dueDate = t('validation.invoice.dueAfterIssue');
    if (newItems.length === 0) errors.items = t('validation.invoice.items');
    newItems.forEach((item, idx) => {
      if (item.quantity <= 0) errors[`quantity_${idx}`] = t('validation.invoice.quantity');
      if (item.unitPrice <= 0) errors[`unitPrice_${idx}`] = t('validation.invoice.unitPrice');
    });
    if (taxRate < 0 || taxRate > 100) errors.taxRate = t('validation.invoice.taxRate');
    return errors;
  };

  const handleCreateInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canCreateInvoice) {
      toast.error(t('invoice.onlyFinanceAdminCreate'));
      return;
    }

    const formData = new FormData(e.currentTarget);
    const clientName = formData.get('clientName') as string;
    const issueDate = formData.get('issueDate') as string;
    const dueDate = formData.get('dueDate') as string;
    const taxRate = parseFloat(formData.get('taxRate') as string) || 0;

    const errors = validateInvoiceForm(clientName, issueDate, dueDate, taxRate);
    if (Object.keys(errors).length > 0) {
      setInvoiceErrors(errors);
      toast.error(t('common.error'));
      return;
    }
    setInvoiceErrors({});
    const { subtotal, tax, total } = calculateTotals(newItems, taxRate);

    try {
      const res = await fetch(`${API_BASE}/invoices/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
          clientName: formData.get('clientName'),
          billToName: formData.get('clientName'),
          billToEmail: formData.get('clientEmail'),
          billToAddress: formData.get('clientAddress'),
          invoiceDate: formData.get('issueDate'),
          dueDate: formData.get('dueDate'),
          status: 'Draft',
          lineItems: newItems.map(i => ({ description: i.description, quantity: i.quantity, rate: i.unitPrice, amount: i.amount })),
          subtotal, taxRate, gstRate: taxRate, gstAmount: tax, total,
          notes: formData.get('notes') || '',
          currency: 'INR',
        }),
      });
      if (res.ok) {
        toast.success(t('invoice.invoiceCreated'));
        e.currentTarget.reset();
        setShowNewInvoice(false);
        setNewItems([]);
        await loadInvoices();
      } else {
        toast.error(t('invoice.failedCreate'));
      }
    } catch {
      toast.error(t('invoice.failedCreate'));
    }
  };

  const handleUpdateInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingInvoice || !canUpdateInvoice(editingInvoice)) {
      toast.error(t('invoice.canOnlyUpdateOwn'));
      return;
    }

    const formData = new FormData(e.currentTarget);
    const clientName = formData.get('clientName') as string;
    const issueDate = formData.get('issueDate') as string;
    const dueDate = formData.get('dueDate') as string;
    const taxRate = parseFloat(formData.get('taxRate') as string) || 0;

    const errors = validateInvoiceForm(clientName, issueDate, dueDate, taxRate);
    if (Object.keys(errors).length > 0) {
      setInvoiceErrors(errors);
      toast.error(t('common.error'));
      return;
    }
    setInvoiceErrors({});
    const { subtotal, tax, total } = calculateTotals(editingInvoice.items, taxRate);

    try {
      const res = await fetch(`${API_BASE}/invoices/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
          id: editingInvoice.id,
          clientName: formData.get('clientName'),
          billToName: formData.get('clientName'),
          billToEmail: formData.get('clientEmail'),
          billToAddress: formData.get('clientAddress'),
          invoiceDate: formData.get('issueDate'),
          dueDate: formData.get('dueDate'),
          status: formData.get('status'),
          subtotal, taxRate, gstRate: taxRate, gstAmount: tax, total,
          notes: formData.get('notes') || '',
        }),
      });
      if (res.ok) {
        toast.success(t('invoice.invoiceUpdated'));
        setEditingInvoice(null);
        await loadInvoices();
      } else {
        toast.error(t('invoice.failedUpdate'));
      }
    } catch {
      toast.error(t('invoice.failedUpdate'));
    }
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    if (!canDeleteInvoice) {
      toast.error(t('invoice.onlyAdminsDelete'));
      return;
    }

    setConfirmState({
      title: t('invoice.deleteTitle'),
      message: t('invoice.deleteMessage'),
      danger: true,
      action: async () => {
        setConfirmState(null);
        try {
          const res = await fetch(`${API_BASE}/invoices/${invoiceId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${publicAnonKey}` },
          });
          if (res.ok) {
            toast.success('Invoice deleted!');
            await loadInvoices();
          } else {
            toast.error('Failed to delete invoice');
          }
        } catch {
          toast.error('Failed to delete invoice');
        }
      },
    });
  };

  const handleMarkPaid = async (invoiceId: string) => {
    if (!canMarkPaid) {
      toast.error('Only Finance and Admins can mark invoices as paid');
      return;
    }
    await persistStatus(invoiceId, 'Paid', { paidDate: new Date().toISOString().split('T')[0] });
    toast.success('Invoice marked as paid!');
  };

  const handleSendInvoice = async (invoiceId: string) => {
    if (!canSendInvoice) {
      toast.error('Only Finance and Admins can send invoices');
      return;
    }

    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;

    // Draft → submitted (for approval), unless Admin who can bypass
    if (inv.status === 'draft' || inv.status === 'Draft') {
      if (isAdmin) {
        await persistStatus(invoiceId, 'Sent');
        toast.success('Invoice sent to client!');
      } else {
        await persistStatus(invoiceId, 'Submitted');
        toast.info('Invoice submitted for approval');
        fetch(`${API_BASE}/workflow/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({
            event: 'invoice.submitted',
            entity_type: 'invoice',
            entity_id: inv.id,
            context: { invoice_number: inv.invoiceNumber, client_name: inv.clientName, amount: inv.total, submitted_by: currentUser?.name },
            triggered_by: currentUser?.id,
          }),
        }).catch(() => {});
      }
      return;
    }

    // Approved → send to client
    if (inv.status === 'approved' || inv.status === 'Approved') {
      await persistStatus(invoiceId, 'Sent');
      toast.success('Invoice sent to client!');
    }
  };

  const handleDownload = (invoice: Invoice) => {
    // In a real app, this would generate a PDF
    const invoiceText = `
INVOICE ${invoice.invoiceNumber}

Bill To:
${invoice.clientName}
${invoice.clientEmail}
${invoice.clientAddress}

Issue Date: ${new Date(invoice.issueDate).toLocaleDateString()}
Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}

Items:
${invoice.items.map(item => `${item.description} - Qty: ${item.quantity} x $${item.unitPrice} = $${item.amount}`).join('\n')}

Subtotal: $${invoice.subtotal}
Tax (${invoice.taxRate}%): $${invoice.tax}
Total: $${invoice.total}

${invoice.notes ? `Notes: ${invoice.notes}` : ''}
    `.trim();

    const blob = new Blob([invoiceText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.invoiceNumber}.txt`;
    link.click();
    toast.success('Invoice downloaded!');
  };

  const handleSendReminder = (invoice: Invoice) => {
    const daysOverdue = Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / 86400000);
    setConfirmState({
      title: 'Send Overdue Reminder',
      message: `Log a reminder for ${invoice.invoiceNumber} to ${invoice.clientName}? (${daysOverdue} days overdue)`,
      danger: false,
      action: async () => {
        setConfirmState(null);
        try {
          await fetch(`${API_BASE}/notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': publicAnonKey },
            body: JSON.stringify({
              userId: 'finance',
              title: 'Overdue Invoice Reminder Sent',
              body: `Invoice ${invoice.invoiceNumber} to ${invoice.clientName} is ${daysOverdue} days overdue (₹${invoice.total.toLocaleString()})`,
              type: 'warning',
              link: '/invoices',
            }),
          });
        } catch {
          // best effort
        }
        toast.success(`Reminder logged — contact client for invoice ${invoice.invoiceNumber}`);
      },
    });
  };

  const handleExport = () => {
    const csv = [
      ['Invoice #', 'Client', 'Issue Date', 'Due Date', 'Amount', 'Status'].join(','),
      ...filteredInvoices.map(inv => [
        inv.invoiceNumber,
        `"${inv.clientName}"`,
        inv.issueDate,
        inv.dueDate,
        inv.total,
        inv.status
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoices_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Invoices exported!');
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         inv.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         inv.clientEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const effectiveStatus = getEffectiveStatus(inv);
    const matchesStatus = filterStatus === 'all' || effectiveStatus === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'submitted': return 'bg-blue-100 text-blue-700';
      case 'approved': return 'bg-indigo-100 text-indigo-700';
      case 'rejected': return 'bg-red-100 text-red-700 line-through';
      case 'sent': return 'bg-blue-100 text-blue-700';
      case 'paid': return 'bg-green-100 text-green-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      case 'cancelled': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: Invoice['status']) => {
    if (status === 'submitted') return 'Pending Approval';
    if (status === 'approved') return 'Approved';
    if (status === 'rejected') return 'Rejected';
    return status;
  };

  if (loading) {
    return (
      <AppLayout title="Invoice Generation" icon={<FileText className="h-6 w-6" />} onLogout={onLogout}>
        <InlineLoader />
      </AppLayout>
    );
  }

  if (!canViewInvoices) {
    return (
      <AppLayout title="Invoice Generation" icon={<FileText className="h-6 w-6" />} onLogout={onLogout}>
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-600">You don't have permission to view invoices.</p>
            <p className="text-sm text-gray-500 mt-2">Contact Finance or Admin for access.</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const totalRevenue = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0);
  const pendingRevenue = invoices.filter(inv => inv.status === 'sent').reduce((sum, inv) => sum + inv.total, 0);

  // Revenue summary computed values
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const totalOutstanding = invoices
    .filter(inv => getEffectiveStatus(inv) === 'sent')
    .reduce((sum, inv) => sum + inv.total, 0);

  const overdueAmount = invoices
    .filter(inv => getEffectiveStatus(inv) === 'overdue')
    .reduce((sum, inv) => sum + inv.total, 0);

  const paidThisMonth = invoices
    .filter(inv => {
      if (inv.status !== 'paid' || !inv.paidDate) return false;
      const d = new Date(inv.paidDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, inv) => sum + inv.total, 0);

  // Revenue Analytics computations
  const analyticsData = (() => {
    const totalRevenue = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0);
    const outstanding = invoices.filter(inv => inv.status === 'sent').reduce((sum, inv) => sum + inv.total, 0);
    const overdue = invoices.filter(inv => getEffectiveStatus(inv) === 'overdue').reduce((sum, inv) => sum + inv.total, 0);

    // Revenue by client (paid)
    const clientMap = new Map<string, number>();
    invoices.filter(inv => inv.status === 'paid').forEach(inv => {
      clientMap.set(inv.clientName, (clientMap.get(inv.clientName) ?? 0) + inv.total);
    });
    const allClientData = Array.from(clientMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
    const maxClientAmount = Math.max(...allClientData.map(c => c.amount), 1);
    const clientData = allClientData.map(c => ({ ...c, pct: (c.amount / maxClientAmount) * 100 }));

    // Monthly revenue (last 6 months, paid)
    const now = new Date();
    const monthlyData = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const month = d.getMonth();
      const year = d.getFullYear();
      const total = invoices
        .filter(inv => {
          if (inv.status !== 'paid') return false;
          const dateStr = inv.paidDate ?? inv.createdDate;
          if (!dateStr) return false;
          const pd = new Date(dateStr);
          return pd.getMonth() === month && pd.getFullYear() === year;
        })
        .reduce((sum, inv) => sum + inv.total, 0);
      return { label: d.toLocaleDateString(undefined, { month: 'short' }), total };
    });
    const maxMonthly = Math.max(...monthlyData.map(m => m.total), 1);
    const monthlyBars = monthlyData.map(m => ({ ...m, pct: (m.total / maxMonthly) * 100 }));

    // Status distribution
    const statusCounts = { draft: 0, submitted: 0, approved: 0, rejected: 0, sent: 0, paid: 0, overdue: 0, cancelled: 0 };
    invoices.forEach(inv => {
      const s = getEffectiveStatus(inv);
      if (s in statusCounts) statusCounts[s as keyof typeof statusCounts]++;
    });
    const total = invoices.length || 1;
    const statusDist = [
      { label: 'Draft', count: statusCounts.draft, color: 'bg-gray-400' },
      { label: 'Sent', count: statusCounts.sent, color: 'bg-blue-500' },
      { label: 'Paid', count: statusCounts.paid, color: 'bg-green-500' },
      { label: 'Overdue', count: statusCounts.overdue, color: 'bg-red-500' },
    ].map(s => ({ ...s, pct: ((s.count / total) * 100).toFixed(0) }));

    // Top outstanding clients
    const todayMs = new Date().getTime();
    const outstandingClients = invoices
      .filter(inv => getEffectiveStatus(inv) === 'sent' || getEffectiveStatus(inv) === 'overdue')
      .map(inv => ({
        clientName: inv.clientName,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.total,
        daysOverdue: getEffectiveStatus(inv) === 'overdue'
          ? Math.floor((todayMs - new Date(inv.dueDate).getTime()) / 86400000)
          : 0,
        status: getEffectiveStatus(inv),
      }))
      .sort((a, b) => b.amount - a.amount);

    return { totalRevenue, outstanding, overdue, clientData, monthlyBars, statusDist, outstandingClients };
  })();

  return (
    <AppLayout title="Invoice Generation" icon={<FileText className="h-6 w-6" />} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Invoice Generation</h1>
            <p className="text-gray-600">Create and manage client invoices</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button onClick={loadInvoices} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {canCreateInvoice && (
              <Button onClick={() => setShowNewInvoice(!showNewInvoice)}>
                <Plus className="h-4 w-4 mr-2" />
                New Invoice
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Invoices</p>
                  <p className="text-2xl font-bold">{invoices.length}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Paid</p>
                  <p className="text-2xl font-bold text-green-600">${totalRevenue.toLocaleString()}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">${pendingRevenue.toLocaleString()}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">This Month</p>
                  <p className="text-2xl font-bold">
                    {invoices.filter(inv => 
                      new Date(inv.createdDate).getMonth() === new Date().getMonth()
                    ).length}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveMainTab('invoices')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeMainTab === 'invoices'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Invoices
          </button>
          <button
            onClick={() => setActiveMainTab('analytics')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeMainTab === 'analytics'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Revenue Analytics
          </button>
        </div>

        {activeMainTab === 'analytics' && (
          <div className="space-y-6">
            {/* Revenue Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs text-gray-500 font-medium">Total Revenue</p>
                <p className="text-2xl font-bold text-green-700 mt-1">₹{analyticsData.totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">Paid invoices</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs text-gray-500 font-medium">Outstanding</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">₹{analyticsData.outstanding.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">Sent invoices</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs text-gray-500 font-medium">Overdue</p>
                <p className="text-2xl font-bold text-red-700 mt-1">₹{analyticsData.overdue.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">Past due date</p>
              </div>
            </div>

            {/* Revenue by Client */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue by Client (Top 10, Paid)</h3>
              {analyticsData.clientData.length === 0 ? (
                <p className="text-xs text-gray-400">No paid invoices yet.</p>
              ) : (
                <div className="space-y-2">
                  {analyticsData.clientData.map(c => (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="w-40 text-sm text-gray-600 truncate">{c.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${c.pct}%` }} />
                      </div>
                      <span className="text-sm text-gray-700 w-24 text-right">₹{c.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Monthly Revenue Trend */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Revenue (Last 6 Months)</h3>
              <div className="flex items-end gap-2 h-24">
                {analyticsData.monthlyBars.map(m => (
                  <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-blue-400 rounded-t"
                      style={{ height: `${Math.max(m.pct, m.total > 0 ? 6 : 0)}%` }}
                    />
                    <span className="text-[10px] text-gray-400">{m.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-1">
                {analyticsData.monthlyBars.map(m => (
                  <div key={m.label} className="flex-1 text-center">
                    <span className="text-[10px] text-gray-500">
                      {m.total > 0 ? `₹${(m.total / 1000).toFixed(0)}k` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Invoice Status Distribution */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Invoice Status Distribution</h3>
              <div className="space-y-2">
                {analyticsData.statusDist.map(s => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${s.color}`} />
                    <span className="text-sm text-gray-700 w-20">{s.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${s.color}`} style={{ width: `${s.pct}%` }} />
                    </div>
                    <span className="text-sm text-gray-700 w-16 text-right">{s.count} ({s.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Outstanding Clients */}
            {analyticsData.outstandingClients.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Outstanding Clients</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-semibold text-gray-500 uppercase">
                        <th className="pb-2">Client</th>
                        <th className="pb-2">Invoice #</th>
                        <th className="pb-2 text-right">Amount</th>
                        <th className="pb-2 text-right">Days Overdue</th>
                        <th className="pb-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {analyticsData.outstandingClients.map(c => (
                        <tr key={c.invoiceNumber}>
                          <td className="py-2 font-medium text-gray-900">{c.clientName}</td>
                          <td className="py-2 text-gray-500 font-mono text-xs">{c.invoiceNumber}</td>
                          <td className="py-2 text-right font-semibold text-gray-900">₹{c.amount.toLocaleString()}</td>
                          <td className="py-2 text-right text-red-600">{c.daysOverdue > 0 ? `${c.daysOverdue}d` : '—'}</td>
                          <td className="py-2 text-right">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${getStatusColor(c.status as Invoice['status'])}`}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeMainTab === 'invoices' && (
        <>
        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="search" className="text-sm">Search Invoices</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input 
                    id="search"
                    placeholder="Search by invoice #, client name, or email..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="status" className="text-sm">Filter by Status</Label>
                <select 
                  id="status"
                  className="w-full border rounded-lg p-2"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <SelectOptions entity="invoice" field="status" fallback={['Draft','Sent','Paid','Overdue','Cancelled']} />
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* New Invoice Form */}
        {showNewInvoice && canCreateInvoice && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Invoice</CardTitle>
              <CardDescription>Generate an invoice for your client</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateInvoice} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="clientName">Client Name *</Label>
                    <select id="clientName" name="clientName" required className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                      <option value="">Select client</option>
                      {clients.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    {invoiceErrors.clientName && <p className="text-xs text-red-500 mt-0.5">{invoiceErrors.clientName}</p>}
                  </div>

                  <div>
                    <Label htmlFor="clientEmail">Client Email *</Label>
                    <Input id="clientEmail" name="clientEmail" type="email" required />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="clientAddress">Client Address *</Label>
                    <Textarea id="clientAddress" name="clientAddress" rows={2} required />
                  </div>

                  <div>
                    <Label htmlFor="issueDate">Issue Date *</Label>
                    <Input id="issueDate" name="issueDate" type="date" required />
                    {invoiceErrors.issueDate && <p className="text-xs text-red-500 mt-0.5">{invoiceErrors.issueDate}</p>}
                  </div>

                  <div>
                    <Label htmlFor="dueDate">Due Date *</Label>
                    <Input id="dueDate" name="dueDate" type="date" required />
                    {invoiceErrors.dueDate && <p className="text-xs text-red-500 mt-0.5">{invoiceErrors.dueDate}</p>}
                  </div>

                  <div>
                    <Label htmlFor="taxRate">Tax Rate (%)</Label>
                    <Input id="taxRate" name="taxRate" type="number" step="0.01" defaultValue="10" />
                    {invoiceErrors.taxRate && <p className="text-xs text-red-500 mt-0.5">{invoiceErrors.taxRate}</p>}
                  </div>
                </div>

                {/* Invoice Items */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold">Invoice Items</h4>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Item
                    </Button>
                  </div>

                  {invoiceErrors.items && <p className="text-xs text-red-500">{invoiceErrors.items}</p>}
                  {newItems.map((item, idx) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-end bg-gray-50 p-3 rounded">
                      <div className="col-span-4">
                        <Label className="text-xs">Description</Label>
                        <Input
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                          required
                        />
                        {invoiceErrors[`quantity_${idx}`] && <p className="text-xs text-red-500 mt-0.5">{invoiceErrors[`quantity_${idx}`]}</p>}
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Unit Price (₹)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleUpdateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          required
                        />
                        {invoiceErrors[`unitPrice_${idx}`] && <p className="text-xs text-red-500 mt-0.5">{invoiceErrors[`unitPrice_${idx}`]}</p>}
                      </div>
                      <div className="col-span-1">
                        <Label className="text-xs">Tax %</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.taxRate}
                          onChange={(e) => handleUpdateItem(item.id, 'taxRate', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Amount (₹)</Label>
                        <Input value={`₹${item.amount.toFixed(2)} + ₹${item.taxAmount.toFixed(0)} tax`} disabled className="text-xs" />
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {newItems.length > 0 && (() => {
                    const subtotal = newItems.reduce((s, i) => s + i.amount, 0);
                    const taxTotal = newItems.reduce((s, i) => s + i.taxAmount, 0);
                    const grandTotal = subtotal + taxTotal;
                    return (
                      <div className="bg-blue-50 p-4 rounded text-right space-y-1">
                        <p className="text-sm text-gray-600">Subtotal: <span className="font-bold text-gray-800">₹{subtotal.toFixed(2)}</span></p>
                        <p className="text-sm text-gray-600">GST Tax Total: <span className="font-bold text-gray-800">₹{taxTotal.toFixed(2)}</span></p>
                        <p className="text-lg font-bold text-gray-900">Grand Total: ₹{grandTotal.toFixed(2)}</p>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" rows={2} placeholder="Payment terms, additional information..." />
                </div>

                <div className="flex gap-2">
                  <Button type="submit">Create Invoice</Button>
                  <Button type="button" variant="outline" onClick={() => {
                    setShowNewInvoice(false);
                    setNewItems([]);
                    setInvoiceErrors({});
                  }}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Revenue Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Outstanding</p>
              <p className="text-xl font-bold text-blue-700">₹{totalOutstanding.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Sent invoices</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50 text-red-600">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Overdue Amount</p>
              <p className="text-xl font-bold text-red-700">₹{overdueAmount.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Past due date</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Paid This Month</p>
              <p className="text-xl font-bold text-green-700">₹{paidThisMonth.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Collected revenue</p>
            </div>
          </div>
        </div>

        {/* Overdue Alert Banner */}
        {(isFinance || isAdmin) && (() => {
          const overdueInvoices = filteredInvoices.filter((inv) => getEffectiveStatus(inv) === 'overdue');
          const overdueTotal = overdueInvoices.reduce((s, inv) => s + inv.total, 0);
          if (overdueInvoices.length === 0) return null;
          return (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <span className="text-amber-600 text-lg">⚠️</span>
              <p className="text-sm font-medium text-amber-800">
                {overdueInvoices.length} invoice{overdueInvoices.length !== 1 ? 's are' : ' is'} overdue totalling ₹{overdueTotal.toLocaleString()}
              </p>
            </div>
          );
        })()}

        {/* Pending Approvals — Admin only */}
        {isAdmin && (() => {
          const pendingInvoices = invoices.filter((inv) => inv.status === 'submitted');
          if (pendingInvoices.length === 0) return null;
          return (
            <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-blue-100 flex items-center gap-2 bg-blue-50">
                <Clock className="h-4 w-4 text-blue-600" />
                <h2 className="font-semibold text-blue-900">Pending Approvals</h2>
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-200 text-blue-900 text-xs font-bold">
                  {pendingInvoices.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Invoice #</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Client</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Amount</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Submitted By</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingInvoices.map((inv) => (
                      <>
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{inv.invoiceNumber}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{inv.clientName}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">₹{inv.total.toLocaleString()}</td>
                          <td className="px-4 py-3 text-gray-500">{inv.createdBy}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => handleApproveInvoice(inv.id)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                              >
                                <CheckCircle className="h-3 w-3" /> Approve
                              </button>
                              <button
                                onClick={() => setRejectingInvoiceId(rejectingInvoiceId === inv.id ? null : inv.id)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-medium hover:bg-red-100 transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                        {rejectingInvoiceId === inv.id && (
                          <tr key={`${inv.id}-reject`}>
                            <td colSpan={5} className="px-4 py-3 bg-red-50">
                              <div className="flex items-start gap-3">
                                <textarea
                                  className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                                  rows={2}
                                  placeholder="Rejection reason..."
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                />
                                <button
                                  onClick={() => handleRejectInvoice(inv.id, rejectReason)}
                                  disabled={!rejectReason.trim()}
                                  className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                  Confirm Reject
                                </button>
                                <button
                                  onClick={() => { setRejectingInvoiceId(null); setRejectReason(''); }}
                                  className="px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Invoices List */}
        <div className="space-y-4">
          {filteredInvoices.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No invoices found.</p>
              </CardContent>
            </Card>
          ) : (
            filteredInvoices.map(invoice => (
              <Card key={invoice.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getStatusColor(getEffectiveStatus(invoice))}>
                          {getStatusLabel(getEffectiveStatus(invoice))}
                        </Badge>
                        <Badge variant="outline">{invoice.invoiceNumber}</Badge>
                      </div>
                      <CardTitle className="text-xl">{invoice.clientName}</CardTitle>
                      <CardDescription className="mt-1">
                        {invoice.clientEmail}
                      </CardDescription>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="text-2xl font-bold text-green-600">${invoice.total.toLocaleString()}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Issue Date:</span>
                      <p className="font-medium">{new Date(invoice.issueDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Due Date:</span>
                      <p className="font-medium">{new Date(invoice.dueDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Created By:</span>
                      <p className="font-medium">{invoice.createdBy}</p>
                    </div>
                    {invoice.paidDate && (
                      <div>
                        <span className="text-gray-600">Paid Date:</span>
                        <p className="font-medium text-green-600">{new Date(invoice.paidDate).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  <div>
                    <h4 className="font-semibold mb-2">Items</h4>
                    <div className="space-y-2">
                      {invoice.items.map(item => (
                        <div key={item.id} className="bg-gray-50 p-3 rounded flex justify-between items-center">
                          <div className="flex-1">
                            <p className="font-medium">{item.description}</p>
                            <p className="text-sm text-gray-600">Qty: {item.quantity} × ₹{item.unitPrice}</p>
                            <p className="text-xs text-gray-400">GST @{item.taxRate ?? invoice.taxRate}% ₹{(item.taxAmount ?? (item.amount * (invoice.taxRate / 100))).toLocaleString()}</p>
                          </div>
                          <p className="font-bold">₹{item.amount.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-blue-50 p-3 rounded mt-3 space-y-1 text-right">
                      <p className="text-sm text-gray-600">Subtotal: <span className="font-bold text-gray-800">₹{invoice.subtotal.toLocaleString()}</span></p>
                      <p className="text-sm text-gray-600">GST @{invoice.taxRate}%: <span className="font-bold text-gray-800">₹{invoice.tax.toLocaleString()}</span></p>
                      <p className="text-lg font-bold text-gray-900">Grand Total: ₹{invoice.total.toLocaleString()}</p>
                    </div>
                  </div>

                  {invoice.notes && (
                    <div className="bg-yellow-50 p-3 rounded">
                      <p className="text-sm"><strong>Notes:</strong> {invoice.notes}</p>
                    </div>
                  )}

                  {/* Days overdue counter */}
                  {getEffectiveStatus(invoice) === 'overdue' && (() => {
                    const days = Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / 86400000);
                    return (
                      <p className="text-xs font-semibold text-red-600">
                        {days} day{days !== 1 ? 's' : ''} overdue
                      </p>
                    );
                  })()}

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => handleDownload(invoice)} className="gap-1">
                      <Download className="h-3 w-3" />
                      Download
                    </Button>

                    {invoice.status === 'draft' && canSendInvoice && (
                      <Button size="sm" onClick={() => handleSendInvoice(invoice.id)} className="gap-1">
                        <Send className="h-3 w-3" />
                        {isAdmin ? 'Send to Client' : 'Submit for Approval'}
                      </Button>
                    )}

                    {invoice.status === 'approved' && canSendInvoice && (
                      <Button size="sm" onClick={() => handleSendInvoice(invoice.id)} className="gap-1 bg-indigo-600 hover:bg-indigo-700">
                        <Send className="h-3 w-3" />
                        Send to Client
                      </Button>
                    )}

                    {invoice.status === 'rejected' && invoice.rejectionReason && (
                      <span className="text-xs text-red-600 italic">Rejected: {invoice.rejectionReason}</span>
                    )}

                    {(getEffectiveStatus(invoice) === 'sent' || getEffectiveStatus(invoice) === 'overdue') && canMarkPaid && (
                      <Button size="sm" onClick={() => handleMarkPaid(invoice.id)} className="gap-1 bg-green-600 hover:bg-green-700">
                        <CheckCircle className="h-3 w-3" />
                        Mark as Paid
                      </Button>
                    )}

                    {getEffectiveStatus(invoice) === 'overdue' && (isFinance || isAdmin) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendReminder(invoice)}
                        className="gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                      >
                        ⚠️ Send Reminder
                      </Button>
                    )}

                    {canUpdateInvoice(invoice) && (
                      <Button size="sm" variant="outline" onClick={() => setEditingInvoice(invoice)} className="gap-1">
                        <Edit className="h-3 w-3" />
                        Edit
                      </Button>
                    )}

                    {canDeleteInvoice && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteInvoice(invoice.id)}
                        className="gap-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        </>
        )}
      </div>
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          danger={confirmState.danger}
          onConfirm={confirmState.action}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </AppLayout>
  );
}
