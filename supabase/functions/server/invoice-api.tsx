import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { auditCreate, auditUpdate } from "./audit-helpers.ts";

const app = new Hono();

function triggerWorkflowEvent(event: string, entity_type: string, entity_id: string, context: Record<string, unknown>, triggered_by?: string) {
  const base = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  fetch(`${base}/functions/v1/make-server-1fe2c468/workflow/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({ event, entity_type, entity_id, context, triggered_by }),
  }).catch(() => {});
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

async function getNextInvoiceNumber(supabase: any): Promise<string> {
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', 'JSN%')
    .order('invoice_number', { ascending: false })
    .limit(1);

  let next = 1;
  if (data?.length) {
    const match = String(data[0].invoice_number).match(/JSN(\d+)/);
    if (match) next = parseInt(match[1]) + 1;
  }
  return `JSN${String(next).padStart(4, '0')}`;
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
    const { data } = await supabase.from('invoices').select('status, total, invoice_date');
    const total = data?.length || 0;
    const paid = data?.filter((i: any) => i.status === 'Paid').reduce((s: number, i: any) => s + (i.total || 0), 0) || 0;
    const pending = data?.filter((i: any) => i.status === 'Sent').reduce((s: number, i: any) => s + (i.total || 0), 0) || 0;
    return c.json({ success: true, data: { totalInvoices: total, paidAmount: paid, pendingAmount: pending } });
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

    triggerWorkflowEvent("invoice_created", "invoice", inv.id, {
      invoice_number: inv.invoice_number,
      client_name: inv.client_name,
      total,
      status: inv.status,
    });

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

// ==================== PAYMENT REMINDERS ====================

// POST /invoice/reminders/send — find overdue/due-soon invoices and send reminders
app.post('/reminders/send', async (c) => {
  try {
    const supabase = getSupabase();
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const soonStr = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10); // 7 days ahead

    // Get unpaid invoices that are overdue or due within 7 days
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, client_name, client_email, due_date, total_amount, currency, status')
      .in('status', ['Sent', 'Partially Paid', 'Overdue'])
      .lte('due_date', soonStr)
      .not('client_email', 'is', null);

    if (error) return c.json({ success: false, error: error.message }, 500);
    if (!invoices?.length) return c.json({ success: true, sent: 0, message: 'No overdue/due-soon invoices found' });

    const resendKey = Deno.env.get('RESEND_API_KEY');
    let sent = 0;
    const errors: string[] = [];

    for (const inv of invoices) {
      const dueDate = new Date(inv.due_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
      const isOverdue = daysOverdue > 0;

      // Mark as overdue in DB if past due
      if (isOverdue && inv.status !== 'Overdue') {
        await supabase.from('invoices').update({ status: 'Overdue' }).eq('id', inv.id);
      }

      // Create in-portal notification for finance team
      await supabase.from('notifications').insert({
        user_id: null, // broadcast to finance role
        title: isOverdue ? `Payment Overdue: ${inv.invoice_number}` : `Payment Due Soon: ${inv.invoice_number}`,
        message: isOverdue
          ? `Invoice ${inv.invoice_number} for ${inv.client_name} is ${daysOverdue} day(s) overdue. Amount: ${inv.currency} ${Number(inv.total_amount).toLocaleString('en-IN')}`
          : `Invoice ${inv.invoice_number} for ${inv.client_name} is due on ${inv.due_date}. Amount: ${inv.currency} ${Number(inv.total_amount).toLocaleString('en-IN')}`,
        type: 'invoice',
        link: '/invoice',
        created_at: new Date().toISOString(),
      }).catch(() => {});

      // Send email reminder if Resend key available and client has email
      if (resendKey && inv.client_email) {
        try {
          const html = `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <h2 style="color:#1f2937">${isOverdue ? '⚠️ Payment Overdue' : '📋 Payment Reminder'}</h2>
              <p>Dear ${inv.client_name},</p>
              <p>${isOverdue
                ? `This is to inform you that invoice <strong>${inv.invoice_number}</strong> was due on <strong>${inv.due_date}</strong> and is now <strong>${daysOverdue} day(s) overdue</strong>.`
                : `This is a friendly reminder that invoice <strong>${inv.invoice_number}</strong> is due on <strong>${inv.due_date}</strong>.`
              }</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <tr><td style="padding:8px 12px;background:#f9fafb;font-weight:600">Invoice #</td><td style="padding:8px 12px">${inv.invoice_number}</td></tr>
                <tr><td style="padding:8px 12px;background:#f9fafb;font-weight:600">Amount Due</td><td style="padding:8px 12px">${inv.currency} ${Number(inv.total_amount).toLocaleString('en-IN')}</td></tr>
                <tr><td style="padding:8px 12px;background:#f9fafb;font-weight:600">Due Date</td><td style="padding:8px 12px">${inv.due_date}</td></tr>
              </table>
              <p>Please arrange payment at your earliest convenience.</p>
              <p style="color:#6b7280;font-size:13px">This is an automated reminder from JL HRIS Finance module.</p>
            </div>`;
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'finance@jlhris.com',
              to: [inv.client_email],
              subject: `${isOverdue ? 'Payment Overdue' : 'Payment Reminder'}: Invoice ${inv.invoice_number}`,
              html,
            }),
          });
          if (r.ok) sent++;
          else errors.push(`Email failed for ${inv.invoice_number}`);
        } catch (e: any) {
          errors.push(`${inv.invoice_number}: ${e.message}`);
        }
      } else {
        sent++; // count as "processed" even if no email key
      }
    }

    return c.json({ success: true, sent, total: invoices.length, errors });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default app;
