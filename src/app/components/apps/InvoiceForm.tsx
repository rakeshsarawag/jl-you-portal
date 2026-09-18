/**
 * Invoice Generation Form
 * Complete form for creating/editing invoices with all requirements
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useInvoiceData, Invoice, InvoiceLineItem } from '../../hooks/useInvoiceData';
import { numberToWords, calculateDueDate, formatCurrency } from '../../utils/invoiceUtils';
import { SelectOptions } from '../../context/ValueHelpsContext';
import { useMasterDataDirect } from '../../hooks/useSharedData';

interface InvoiceFormProps {
  invoice?: Invoice;
  onSave: () => void;
  onCancel: () => void;
}

export function InvoiceForm({ invoice, onSave, onCancel }: InvoiceFormProps) {
  const {
    billToList,
    registrationList,
    remittanceList,
    descriptionList,
    getNextInvoiceNumber,
    createInvoice,
    updateInvoice,
  } = useInvoiceData();

  const { data: currencies } = useMasterDataDirect('currencies');

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Invoice>>({
    invoiceDate: new Date().toISOString().split('T')[0],
    currency: 'INR',
    currencySymbol: '₹',
    gstRate: 18,
    status: 'Draft',
    terms: 'Net 45',
    lineItems: [{
      id: `item_${Date.now()}`,
      description: '',
      hsnSac: '998314',
      quantity: 1,
      rate: 0,
      amount: 0,
    }],
  });

  // Load invoice data if editing
  useEffect(() => {
    if (invoice) {
      setFormData(invoice);
    } else {
      // Get next invoice number for new invoice
      getNextInvoiceNumber().then((number) => {
        setFormData((prev) => ({ ...prev, invoiceNumber: number }));
      });
    }
  }, [invoice, getNextInvoiceNumber]);

  // Auto-select default remittance based on currency
  useEffect(() => {
    if (formData.currency && !invoice) {
      const defaultRemittance = remittanceList.find(
        (r) => r.currency === formData.currency && r.isDefault
      );
      if (defaultRemittance) {
        setFormData((prev) => ({
          ...prev,
          remittanceId: defaultRemittance.id,
          remittanceDetails: defaultRemittance.details,
        }));
      }
      
      // Auto-select default registration based on currency
      const defaultRegistration = registrationList.find(
        (r) => r.currency === formData.currency && r.isDefault
      );
      if (defaultRegistration) {
        setFormData((prev) => ({
          ...prev,
          registrationId: defaultRegistration.id,
          registrationDetails: defaultRegistration.details,
        }));
      }
    }
  }, [formData.currency, remittanceList, registrationList, invoice]);

  // Calculate due date when invoice date or terms change
  useEffect(() => {
    if (formData.invoiceDate && formData.terms) {
      const dueDate = calculateDueDate(formData.invoiceDate, formData.terms);
      setFormData((prev) => ({ ...prev, dueDate }));
    }
  }, [formData.invoiceDate, formData.terms]);

  // Calculate amounts when line items change
  useEffect(() => {
    calculateTotals();
  }, [formData.lineItems, formData.currency]);

  const calculateTotals = () => {
    const lineItems = formData.lineItems || [];
    const subtotal = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    
    // GST only for INR currency
    const gstRate = formData.currency === 'INR' ? 18 : 0;
    const gstAmount = (subtotal * gstRate) / 100;
    const total = subtotal + gstAmount;
    
    // Generate total in words
    const totalInWords = numberToWords(total, formData.currency || 'INR');
    
    setFormData((prev) => ({
      ...prev,
      subtotal,
      gstRate,
      gstAmount,
      total,
      totalInWords,
    }));
  };

  const handleCurrencyChange = (currency: string) => {
    const symbols: Record<string, string> = {
      'INR': '₹',
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
    };
    
    setFormData((prev) => ({
      ...prev,
      currency,
      currencySymbol: symbols[currency] || currency,
    }));
  };

  const handleBillToChange = (billToId: string) => {
    const billTo = billToList.find((b) => b.id === billToId);
    if (billTo) {
      setFormData((prev) => ({
        ...prev,
        billToId: billTo.id,
        billToName: billTo.name,
        billToAddress: billTo.address,
        billToGstin: billTo.gstin,
      }));
      
      // Default currency from client if available
      if (billTo.currency) {
        handleCurrencyChange(billTo.currency);
      }
    }
  };

  const handleRegistrationChange = (registrationId: string) => {
    const registration = registrationList.find((r) => r.id === registrationId);
    if (registration) {
      setFormData((prev) => ({
        ...prev,
        registrationId: registration.id,
        registrationDetails: registration.details,
      }));
    }
  };

  const handleRemittanceChange = (remittanceId: string) => {
    const remittance = remittanceList.find((r) => r.id === remittanceId);
    if (remittance) {
      setFormData((prev) => ({
        ...prev,
        remittanceId: remittance.id,
        remittanceDetails: remittance.details,
      }));
    }
  };

  const handleAddLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      lineItems: [
        ...(prev.lineItems || []),
        {
          id: `item_${Date.now()}`,
          description: '',
          hsnSac: '998314',
          quantity: 1,
          rate: 0,
          amount: 0,
        },
      ],
    }));
  };

  const handleRemoveLineItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      lineItems: prev.lineItems?.filter((_, i) => i !== index),
    }));
  };

  const handleLineItemChange = (index: number, field: keyof InvoiceLineItem, value: any) => {
    const items = [...(formData.lineItems || [])];
    items[index] = { ...items[index], [field]: value };
    
    // Calculate amount
    if (field === 'quantity' || field === 'rate') {
      items[index].amount = items[index].quantity * items[index].rate;
    }
    
    setFormData((prev) => ({ ...prev, lineItems: items }));
  };

  const handleSubmit = async () => {
    try {
      // Validation
      if (!formData.billToId) {
        toast.error('Please select a Bill To address');
        return;
      }
      if (!formData.registrationId) {
        toast.error('Please select Registration details');
        return;
      }
      if (!formData.remittanceId) {
        toast.error('Please select Remittance details');
        return;
      }
      if (!formData.lineItems || formData.lineItems.length === 0) {
        toast.error('Please add at least one line item');
        return;
      }
      if (formData.lineItems.some((item) => !item.description || item.rate === 0)) {
        toast.error('Please fill in all line item details');
        return;
      }

      setLoading(true);

      if (invoice) {
        await updateInvoice(invoice.id, formData);
        toast.success('Invoice updated successfully');
      } else {
        await createInvoice(formData);
        toast.success('Invoice created successfully');
      }

      onSave();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{invoice ? 'Edit Invoice' : 'Create New Invoice'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invoice Header */}
        <div className="grid grid-cols-4 gap-4">
          <div>
            <Label>Invoice Number</Label>
            <Input value={formData.invoiceNumber || ''} disabled className="bg-gray-100" />
          </div>
          <div>
            <Label>Invoice Date *</Label>
            <Input
              type="date"
              value={formData.invoiceDate || ''}
              onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
            />
          </div>
          <div>
            <Label>Currency *</Label>
            <select
              value={formData.currency || 'INR'}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {currencies.map((c: any) => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
            </select>
          </div>
          <div>
            <Label>PO Number</Label>
            <Input
              value={formData.poNumber || ''}
              onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
              placeholder="Optional"
            />
          </div>
        </div>

        {/* Invoice Period */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Invoice Period From *</Label>
            <Input
              type="date"
              value={formData.invoicePeriodFrom || ''}
              onChange={(e) => setFormData({ ...formData, invoicePeriodFrom: e.target.value })}
            />
          </div>
          <div>
            <Label>Invoice Period To *</Label>
            <Input
              type="date"
              value={formData.invoicePeriodTo || ''}
              onChange={(e) => setFormData({ ...formData, invoicePeriodTo: e.target.value })}
            />
          </div>
        </div>

        {/* Bill To */}
        <div>
          <Label>Bill To *</Label>
          <select
            value={formData.billToId || ''}
            onChange={(e) => handleBillToChange(e.target.value)}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select Bill To</option>
            {billToList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.client && `${item.client} - `}{item.name}
              </option>
            ))}
          </select>
          {formData.billToAddress && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600 whitespace-pre-line">
              {formData.billToAddress}
              {formData.billToGstin && `\nGSTIN: ${formData.billToGstin}`}
            </div>
          )}
        </div>

        {/* Registration */}
        <div>
          <Label>Registration Details *</Label>
          <select
            value={formData.registrationId || ''}
            onChange={(e) => handleRegistrationChange(e.target.value)}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select Registration</option>
            {registrationList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {formData.registrationDetails && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600 whitespace-pre-line">
              {formData.registrationDetails}
            </div>
          )}
        </div>

        {/* Remittance */}
        <div>
          <Label>Remittance Details *</Label>
          <select
            value={formData.remittanceId || ''}
            onChange={(e) => handleRemittanceChange(e.target.value)}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select Remittance</option>
            {remittanceList
              .filter((r) => r.currency === formData.currency)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} {item.isDefault && '(Default)'}
                </option>
              ))}
          </select>
          {formData.remittanceDetails && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600 whitespace-pre-line">
              {formData.remittanceDetails}
            </div>
          )}
        </div>

        {/* Terms and Due Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Payment Terms *</Label>
            <select
              value={formData.terms || 'Net 45'}
              onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <SelectOptions entity="invoice" field="payment_terms" fallback={['Net 15','Net 30','Net 45','Net 60','Due on Receipt']} />
            </select>
          </div>
          <div>
            <Label>Due Date</Label>
            <Input
              type="date"
              value={formData.dueDate || ''}
              disabled
              className="bg-gray-100"
            />
          </div>
        </div>

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-lg">Line Items *</Label>
            <Button size="sm" onClick={handleAddLineItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
          
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2 text-sm font-medium">Description</th>
                  {formData.currency === 'INR' && (
                    <th className="text-left p-2 text-sm font-medium w-32">HSN/SAC</th>
                  )}
                  <th className="text-right p-2 text-sm font-medium w-24">Qty</th>
                  <th className="text-right p-2 text-sm font-medium w-32">Rate</th>
                  <th className="text-right p-2 text-sm font-medium w-32">Amount</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {formData.lineItems?.map((item, index) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-2">
                      <Input
                        value={item.description}
                        onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                        placeholder="Service description"
                        list="descriptions-list"
                      />
                      <datalist id="descriptions-list">
                        {descriptionList.map((desc) => (
                          <option key={desc.id} value={desc.description} />
                        ))}
                      </datalist>
                    </td>
                    {formData.currency === 'INR' && (
                      <td className="p-2">
                        <Input
                          value={item.hsnSac}
                          onChange={(e) => handleLineItemChange(index, 'hsnSac', e.target.value)}
                        />
                      </td>
                    )}
                    <td className="p-2">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="text-right"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) => handleLineItemChange(index, 'rate', parseFloat(e.target.value) || 0)}
                        className="text-right"
                      />
                    </td>
                    <td className="p-2 text-right font-medium">
                      {formatCurrency(item.amount, formData.currency || 'INR')}
                    </td>
                    <td className="p-2">
                      {formData.lineItems && formData.lineItems.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveLineItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="border-t pt-4">
          <div className="flex justify-end">
            <div className="w-96 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-medium">{formatCurrency(formData.subtotal || 0, formData.currency || 'INR')}</span>
              </div>
              {formData.currency === 'INR' && (
                <div className="flex justify-between text-sm">
                  <span>GST @ 18%:</span>
                  <span className="font-medium">{formatCurrency(formData.gstAmount || 0, formData.currency || 'INR')}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Total:</span>
                <span className="font-semibold text-lg">{formatCurrency(formData.total || 0, formData.currency || 'INR')}</span>
              </div>
              <div className="text-xs text-gray-600 text-right">
                {formData.totalInWords}
              </div>
            </div>
          </div>
        </div>

        {/* Status and Notes */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Status *</Label>
            <select
              value={formData.status || 'Draft'}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <SelectOptions entity="invoice" field="status" fallback={['Draft','Sent','Paid','Overdue','Cancelled']} />
            </select>
          </div>
        </div>

        {/* Payment Details (for Paid status) */}
        {formData.status === 'Paid' && (
          <div className="grid grid-cols-3 gap-4 border-t pt-4">
            <div>
              <Label>Amount Received</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amountReceived || 0}
                onChange={(e) => setFormData({ ...formData, amountReceived: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Professional Tax Deducted (10%)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.professionalTaxDeducted || 0}
                onChange={(e) => setFormData({ ...formData, professionalTaxDeducted: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={formData.paymentDate || ''}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <Label>Notes</Label>
          <Textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes or comments"
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end border-t pt-4">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Invoice
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}