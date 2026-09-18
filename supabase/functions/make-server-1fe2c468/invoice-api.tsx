import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { auditCreate, auditUpdate } from "./audit-helpers.ts";

const app = new Hono();

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

async function getNextInvoiceNumber(supabase: any): Promise<string> {
  const { data } = await supabase.rpc('nextval_invoice_number');
  if (data) return `JSN${String(data).padStart(4, '0')}`;
  // Fallback: max-scan if sequence RPC unavailable
  const { data: rows } = await supabase
    .from('invoices').select('invoice_number').like('invoice_number', 'JSN%')
    .order('invoice_number', { ascending: false }).limit(1);
  let maxNum = 1001;
  if (rows?.length) {
    const match = rows[0].invoice_number.match(/JSN(\d+)/);
    if (match) maxNum = parseInt(match[1]) + 1;
  }
  return `JSN${String(maxNum).padStart(4, '0')}`;
}

function shapeInvoice(inv: any) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    invoiceDate: inv.invoice_date,
    dueDate: inv.due_date,
    currency: inv.currency || 'INR',
    currencySymbol: inv.currency === 'USD' ? '$' : '₹',
    billToId: inv.client_id,
    billToName: inv.client_name,
    status: inv.status,
    subtotal: inv.subtotal,
    gstRate: inv.tax_rate,
    gstAmount: inv.tax_amount,
    total: inv.total,
    discountPercent: inv.discount_percent,
    discountAmount: inv.discount_amount,
    notes: inv.notes,
    terms: inv.terms,
    bankDetails: inv.bank_details,
    lineItems: inv.invoice_line_items || [],
    createdAt: inv.created_at,
    updatedAt: inv.updated_at,
  };
}

// ==================== INVOICE CRUD ====================

app.get('/', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('invoices')
      .select('*, invoice_line_items(*)')
      .order('invoice_number', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: (data || []).map(shapeInvoice) });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch invoices' }, 500);
  }
});

app.get('/all', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('invoices')
      .select('*, invoice_line_items(*)')
      .order('invoice_number', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: (data || []).map(shapeInvoice) });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch invoices' }, 500);
  }
});

app.get('/next-number', async (c) => {
  try {
    const supabase = getSupabase();
    const nextNumber = await getNextInvoiceNumber(supabase);
    return c.json({ success: true, nextNumber });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to get next number' }, 500);
  }
});

app.get('/analytics', async (c) => {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('invoices').select('status, total, invoice_date, due_date');
    const total = data?.length || 0;

    const totalRevenue = data?.filter((i: any) => i.status === 'Paid')
      .reduce((s: number, i: any) => s + (i.total || 0), 0) || 0;
    const outstanding = data?.filter((i: any) => ['Sent', 'Pending', 'Draft'].includes(i.status))
      .reduce((s: number, i: any) => s + (i.total || 0), 0) || 0;

    const today = new Date().toISOString().slice(0, 10);
    const overdue = data?.filter((i: any) =>
      i.status !== 'Paid' && i.due_date && i.due_date < today
    ).reduce((s: number, i: any) => s + (i.total || 0), 0) || 0;

    return c.json({ success: true, data: { totalInvoices: total, totalRevenue, outstanding, overdue, paidAmount: totalRevenue, pendingAmount: outstanding } });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to get analytics' }, 500);
  }
});

app.get('/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('invoices')
      .select('*, invoice_line_items(*)')
      .eq('id', c.req.param('id'))
      .single();

    if (error || !data) return c.json({ success: false, error: 'Invoice not found' }, 404);
    return c.json({ success: true, data: shapeInvoice(data) });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch invoice' }, 500);
  }
});

app.post('/create', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const invoiceNumber = body.invoiceNumber || await getNextInvoiceNumber(supabase);
    const lineItems = body.lineItems || body.descriptions || [];

    const subtotal = lineItems.reduce((s: number, item: any) => s + (item.amount || item.rate * item.quantity || 0), 0);
    const taxRate = body.gstRate || body.taxRate || 18;
    const taxAmount = body.gstAmount || (subtotal * taxRate / 100);
    const total = body.total || (subtotal + taxAmount);

    // Upsert client
    let clientId = body.billToId || body.clientId || null;
    if (!clientId && body.billToName) {
      const { data: existingClient } = await supabase
        .from('invoice_clients')
        .select('id')
        .eq('company_name', body.billToName)
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: newClient } = await supabase
          .from('invoice_clients')
          .insert([{
            company_name: body.billToName,
            email: body.billToEmail || '',
            address: body.billToAddress || '',
            gst_number: body.billToGstin || '',
            ...auditCreate(c),
          }])
          .select('id')
          .single();
        clientId = newClient?.id;
      }
    }

    const { data: inv, error } = await supabase
      .from('invoices')
      .insert([{
        invoice_number: invoiceNumber,
        client_id: clientId,
        client_name: body.billToName || body.clientName || '',
        invoice_date: body.invoiceDate || new Date().toISOString().split('T')[0],
        due_date: body.dueDate || null,
        status: body.status || 'Draft',
        subtotal,
        discount_percent: body.discountPercent || 0,
        discount_amount: body.discountAmount || 0,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        currency: body.currency || 'INR',
        notes: body.notes || '',
        terms: body.terms || '',
        bank_details: body.bankDetails || body.remittanceDetails || {},
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);

    // Insert line items
    if (lineItems.length) {
      await supabase.from('invoice_line_items').insert(
        lineItems.map((item: any, idx: number) => ({
          invoice_id: inv.id,
          description: item.description || item.particulars || '',
          quantity: item.quantity || 1,
          unit: item.unit || item.hsnSac || 'Unit',
          rate: item.rate || 0,
          amount: item.amount || (item.rate * (item.quantity || 1)),
          item_order: idx,
          ...auditCreate(c),
        }))
      );
    }

    const { data: full } = await supabase
      .from('invoices')
      .select('*, invoice_line_items(*)')
      .eq('id', inv.id)
      .single();

    return c.json({ success: true, data: shapeInvoice(full) }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create invoice' }, 500);
  }
});

app.post('/update', async (c) => {
  try {
    const supabase = getSupabase();
    const { id, ...body } = await c.req.json();

    const { data, error } = await supabase
      .from('invoices')
      .update({
        status: body.status,
        due_date: body.dueDate,
        notes: body.notes,
        terms: body.terms,
        tax_rate: body.gstRate || body.taxRate,
        tax_amount: body.gstAmount || body.taxAmount,
        subtotal: body.subtotal,
        total: body.total,
        bank_details: body.bankDetails || body.remittanceDetails,
        ...auditUpdate(c),
      })
      .eq('id', id)
      .select('*, invoice_line_items(*)')
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data: shapeInvoice(data) });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update invoice' }, 500);
  }
});

app.delete('/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('invoices').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete invoice' }, 500);
  }
});

// ==================== CLIENTS (bill-to) ====================

app.get('/billto/all', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('invoice_clients').select('*').order('company_name');
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch clients' }, 500);
  }
});

app.post('/billto', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { data, error } = await supabase
      .from('invoice_clients')
      .insert([{
        company_name: body.companyName || body.name,
        contact_name: body.contactName || '',
        email: body.email || '',
        phone: body.phone || '',
        address: body.address || '',
        city: body.city || '',
        state: body.state || '',
        country: body.country || 'India',
        gst_number: body.gstin || body.gstNumber || '',
        pan_number: body.pan || '',
        payment_terms: body.paymentTerms || 'Net 30',
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create client' }, 500);
  }
});

export default app;
