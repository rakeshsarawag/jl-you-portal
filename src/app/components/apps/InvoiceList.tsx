/**
 * Invoice List with Filters and Analytics
 * Displays all invoices with dynamic filtering and analytics dashboard
 */

import { useState, useEffect } from 'react';
import ConfirmDialog from '../ui/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Search, Download, Edit2, Trash2, Eye, Filter, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useInvoiceData, Invoice } from '../../hooks/useInvoiceData';
import { formatCurrency } from '../../utils/invoiceUtils';
import { projectId, publicAnonKey, safeJson } from '../../utils/constants';
import { SelectOptions } from '../../context/ValueHelpsContext';

interface InvoiceListProps {
  onEdit: (invoice: Invoice) => void;
  onView: (invoice: Invoice) => void;
}

export function InvoiceList({ onEdit, onView }: InvoiceListProps) {
  const { invoices, billToList, deleteInvoice, fetchInvoices } = useInvoiceData();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    client: 'all',
    month: 'all',
    year: 'all',
    quarter: 'all',
    status: 'all',
  });
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; danger?: boolean; action: () => void } | null>(null);
  
  // Payment Dialog State
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [paymentData, setPaymentData] = useState({
    amountReceived: 0,
    professionalTaxDeducted: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Fetch analytics whenever filters change
  useEffect(() => {
    fetchAnalytics();
  }, [filters, invoices]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.client !== 'all') params.append('client', filters.client);
      if (filters.month !== 'all') params.append('month', filters.month);
      if (filters.year !== 'all') params.append('year', filters.year);
      if (filters.quarter !== 'all') params.append('quarter', filters.quarter);
      if (filters.status !== 'all') params.append('status', filters.status);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1fe2c468/invoices/analytics?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-User-Id': 'admin'
          },
        }
      ).catch(error => {
        console.error('Network error fetching analytics:', error);
        throw new Error('NETWORK_ERROR');
      });

      const data = await safeJson(response);
      if (data?.success) {
        setAnalytics(data?.data);
      }
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      if (error.message === 'NETWORK_ERROR') {
        console.warn('Backend server is unreachable. Analytics unavailable.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmState({ title: 'Delete Invoice', message: 'Are you sure you want to delete this invoice?', danger: true, action: async () => { setConfirmState(null); try { await deleteInvoice(id); toast.success('Invoice deleted successfully'); } catch { toast.error('Failed to delete invoice'); } } });
  };

  const handleQuickStatusUpdate = async (invoice: Invoice, newStatus: string) => {
    // If changing to Paid status, show payment dialog
    if (newStatus === 'Paid' && invoice.status !== 'Paid') {
      setSelectedInvoiceForPayment(invoice);
      setPaymentData({
        amountReceived: invoice.total,
        professionalTaxDeducted: invoice.subtotal * 0.10,
        paymentDate: new Date().toISOString().split('T')[0],
        notes: invoice.notes || '',
      });
      setShowPaymentDialog(true);
      return;
    }

    // For other status changes, update directly
    try {
      setUpdatingStatus(invoice.id);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1fe2c468/invoices/${invoice.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-User-Id': 'admin'
          },
          body: JSON.stringify({
            ...invoice,
            status: newStatus,
          }),
        }
      );
      
      const data = await safeJson(response);
      if (data?.success) {
        toast.success(`Invoice status updated to ${newStatus}`);
        // Refresh invoice data only, not the full page
        await fetchInvoices();
        await fetchAnalytics();
      } else {
        toast.error('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!selectedInvoiceForPayment) return;
    
    try {
      setUpdatingStatus(selectedInvoiceForPayment.id);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-1fe2c468/invoices/${selectedInvoiceForPayment.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-User-Id': 'admin'
          },
          body: JSON.stringify({
            ...selectedInvoiceForPayment,
            status: 'Paid',
            amountReceived: paymentData.amountReceived,
            professionalTaxDeducted: paymentData.professionalTaxDeducted,
            paymentDate: paymentData.paymentDate,
            notes: paymentData.notes,
          }),
        }
      );
      
      const data = await safeJson(response);
      if (data?.success) {
        toast.success('Invoice marked as Paid');
        setShowPaymentDialog(false);
        setSelectedInvoiceForPayment(null);
        // Refresh invoice data only, not the full page
        await fetchInvoices();
        await fetchAnalytics();
      } else {
        toast.error('Failed to update payment details');
      }
    } catch (error) {
      console.error('Error updating payment:', error);
      toast.error('Failed to update payment details');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid':
        return 'bg-green-100 text-green-800';
      case 'Sent':
        return 'bg-blue-100 text-blue-800';
      case 'Draft':
        return 'bg-gray-100 text-gray-800';
      case 'Unpaid':
        return 'bg-yellow-100 text-yellow-800';
      case 'Overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter invoices based on search
  const filteredInvoices = analytics?.invoices?.filter((inv: Invoice) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(search) ||
      inv.billToName.toLowerCase().includes(search) ||
      inv.status.toLowerCase().includes(search)
    );
  }) || [];

  // Get unique years from invoices
  const years = Array.from(
    new Set(invoices.map((inv) => new Date(inv.invoiceDate).getFullYear()))
  ).sort((a, b) => b - a);

  // Get unique clients
  const clients = Array.from(
    new Set(invoices.map((inv) => inv.billToId))
  );

  return (
    <div className="space-y-6">
      {/* Header with Logo - Compact */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            JL
          </div>
          <div>
            <h1 className="text-lg font-bold">Invoice Generation System</h1>
            <p className="text-xs text-gray-600">Manage and track all your invoices</p>
          </div>
        </div>
      </div>

      {/* Analytics Dashboard */}
      {analytics && (
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Total Invoices</div>
              <div className="text-2xl font-bold mt-1">{analytics.totalInvoices || 0}</div>
              <div className="text-xs text-gray-500 mt-1">
                Paid: {analytics.paidInvoices || 0} | Unpaid: {analytics.unpaidInvoices || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Total Amount (INR)</div>
              <div className="text-2xl font-bold mt-1 text-blue-600">
                ₹ {(analytics.totalAmountINR || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Excl. GST: ₹ {((analytics.totalAmountINR || 0) - (analytics.totalGST || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-green-600 font-semibold mt-1">
                Received: ₹ {(analytics.totalAmountReceivedINR || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-orange-600 font-semibold mt-1">
                To be Received: ₹ {(analytics.totalAmountToBeReceivedINR || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Total GST</div>
              <div className="text-2xl font-bold mt-1 text-purple-600">
                ₹ {(analytics.totalGST || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-500 mt-1">18% GST (INR only)</div>
              <div className="text-xs text-green-600 font-semibold mt-1">
                Received: ₹ {(analytics.gstReceived || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-orange-600 font-semibold mt-1">
                To be Received: ₹ {(analytics.gstToBeReceived || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">Professional Tax (INR)</div>
              <div className="text-2xl font-bold mt-1 text-orange-600">
                ₹ {(analytics.totalProfessionalTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-500 mt-1">10% of Base Amount</div>
              <div className="text-xs text-green-600 font-semibold mt-1">
                PT Deducted: ₹ {(analytics.professionalTaxDeducted || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-orange-600 font-semibold mt-1">
                PT to be Deducted: ₹ {(analytics.professionalTaxToBeDeducted || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          {/* Other Currency Totals - Merged into same row */}
          {analytics.currencyTotals && analytics.currencyTotals.length > 0 && analytics.currencyTotals.map((curr: any) => (
            <Card key={curr.currency}>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">Total Amount ({curr.currency})</div>
                <div className="text-2xl font-bold mt-1 text-indigo-600">
                  {curr.symbol} {(curr.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-green-600 font-semibold mt-1">
                  Received: {curr.symbol} {(curr.received || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-orange-600 font-semibold mt-1">
                  To be Received: {curr.symbol} {(curr.toBeReceived || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setFilters({
                  client: 'all',
                  month: 'all',
                  year: 'all',
                  quarter: 'all',
                  status: 'all',
                });
              }}
            >
              Clear All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Client</label>
              <select
                value={filters.client}
                onChange={(e) => setFilters({ ...filters, client: e.target.value })}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All Clients</option>
                {clients.map((clientId) => {
                  const billTo = billToList.find((b) => b.id === clientId);
                  return (
                    <option key={clientId} value={clientId}>
                      {billTo?.client || billTo?.name || 'Unknown'}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Year (Financial Year)</label>
              <select
                value={filters.year}
                onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All Years</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    FY {year}-{String(parseInt(year) + 1).slice(-2)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Month</label>
              <select
                value={filters.month}
                onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All Months</option>
                <option value="1">January</option>
                <option value="2">February</option>
                <option value="3">March</option>
                <option value="4">April</option>
                <option value="5">May</option>
                <option value="6">June</option>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Quarter (Financial Year)</label>
              <select
                value={filters.quarter}
                onChange={(e) => setFilters({ ...filters, quarter: e.target.value })}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All Quarters</option>
                <option value="1">Q1 (Apr-Jun)</option>
                <option value="2">Q2 (Jul-Sep)</option>
                <option value="3">Q3 (Oct-Dec)</option>
                <option value="4">Q4 (Jan-Mar)</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All Status</option>
                <SelectOptions entity="invoice" field="status" fallback={['Draft','Sent','Paid','Overdue','Cancelled']} />
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Invoices ({filteredInvoices.length})</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No invoices found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Invoice #</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Date</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Client</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Period</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-700">Amount</th>
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Status</th>
                    <th className="text-center p-3 text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice: Invoice) => (
                    <tr key={invoice.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div className="font-medium">{invoice.invoiceNumber}</div>
                        {invoice.poNumber && (
                          <div className="text-xs text-gray-500">PO: {invoice.poNumber}</div>
                        )}
                      </td>
                      <td className="p-3 text-sm">
                        {new Date(invoice.invoiceDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="p-3">
                        <div className="text-sm font-medium">{invoice.billToName}</div>
                        {invoice.billToGstin && (
                          <div className="text-xs text-gray-500">GSTIN: {invoice.billToGstin}</div>
                        )}
                      </td>
                      <td className="p-3 text-sm">
                        {invoice.invoicePeriodFrom && invoice.invoicePeriodTo ? (
                          <div>
                            {new Date(invoice.invoicePeriodFrom).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short'
                            })} - {new Date(invoice.invoicePeriodTo).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="font-semibold">
                          {formatCurrency(invoice.total, invoice.currency)}
                        </div>
                        {invoice.currency === 'INR' && invoice.gstAmount > 0 && (
                          <div className="text-xs text-gray-500">
                            GST: {formatCurrency(invoice.gstAmount, invoice.currency)}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(invoice.status)}>
                            {invoice.status}
                          </Badge>
                          <select
                            value={invoice.status}
                            onChange={(e) => handleQuickStatusUpdate(invoice, e.target.value)}
                            disabled={updatingStatus === invoice.id}
                            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            title="Quick Status Update"
                          >
                            <SelectOptions entity="invoice" field="status" fallback={['Draft','Sent','Paid','Overdue','Cancelled']} />
                          </select>
                          {updatingStatus === invoice.id && (
                            <RefreshCw className="h-3 w-3 animate-spin text-purple-600" />
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onView(invoice)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onEdit(invoice)}
                            title="Edit Invoice"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(invoice.id)}
                            title="Delete Invoice"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onView(invoice)}
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4 text-blue-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      {showPaymentDialog && selectedInvoiceForPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Mark Invoice as Paid</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Invoice: {selectedInvoiceForPayment.invoiceNumber} | {selectedInvoiceForPayment.billToName}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Amount Received *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentData.amountReceived}
                  onChange={(e) => setPaymentData({ ...paymentData, amountReceived: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Invoice Total: {formatCurrency(selectedInvoiceForPayment.total, selectedInvoiceForPayment.currency)}
                </p>
              </div>

              <div>
                <Label>Professional Tax Deducted (10%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentData.professionalTaxDeducted}
                  onChange={(e) => setPaymentData({ ...paymentData, professionalTaxDeducted: parseFloat(e.target.value) || 0 })}
                  className="mt-1 bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Auto-calculated: 10% of {formatCurrency(selectedInvoiceForPayment.subtotal, selectedInvoiceForPayment.currency)}
                </p>
              </div>

              <div>
                <Label>Payment Date *</Label>
                <Input
                  type="date"
                  value={paymentData.paymentDate}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  placeholder="Add any payment notes or comments..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPaymentDialog(false);
                    setSelectedInvoiceForPayment(null);
                  }}
                  disabled={updatingStatus === selectedInvoiceForPayment.id}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePaymentSubmit}
                  disabled={updatingStatus === selectedInvoiceForPayment.id}
                >
                  {updatingStatus === selectedInvoiceForPayment.id ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Mark as Paid'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          danger={confirmState.danger}
          onConfirm={confirmState.action}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}