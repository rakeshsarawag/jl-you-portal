import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';

const app = new Hono();

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// Send email via Resend (or log if no key)
async function sendReportEmail(to: string[], subject: string, html: string): Promise<boolean> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.log(`[scheduled-reports] No RESEND_API_KEY — would send to ${to.join(', ')}: ${subject}`);
    return true;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'reports@jlhris.com',
        to,
        subject,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function buildReportHtml(report: any, data: Record<string, any>): string {
  const now = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>${report.name}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; background: #f9fafb; margin: 0; padding: 24px; }
      .card { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #e5e7eb; }
      h1 { font-size: 22px; color: #111827; margin: 0 0 4px; }
      .meta { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
      .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
      .stat { background: #f3f4f6; border-radius: 8px; padding: 14px; text-align: center; }
      .stat-value { font-size: 28px; font-weight: 700; color: #4f46e5; }
      .stat-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { background: #f9fafb; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
      td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
      .footer { text-align: center; font-size: 12px; color: #9ca3af; margin-top: 24px; }
    </style>
    </head>
    <body>
      <div class="card">
        <h1>${report.name}</h1>
        <div class="meta">Generated on ${now} · Scheduled ${report.schedule} report</div>

        ${report.report_type === 'executive_summary' ? `
        <div class="stat-grid">
          <div class="stat"><div class="stat-value">${data.totalEmployees ?? '—'}</div><div class="stat-label">Total Employees</div></div>
          <div class="stat"><div class="stat-value">${data.pendingLeaves ?? '—'}</div><div class="stat-label">Pending Leaves</div></div>
          <div class="stat"><div class="stat-value">₹${data.payrollPayout ? Number(data.payrollPayout).toLocaleString('en-IN') : '—'}</div><div class="stat-label">Last Payroll</div></div>
        </div>
        ` : ''}

        ${report.report_type === 'headcount' && data.departments ? `
        <table>
          <tr><th>Department</th><th>Headcount</th></tr>
          ${(data.departments as any[]).map((d: any) => `<tr><td>${d.name}</td><td>${d.count}</td></tr>`).join('')}
        </table>
        ` : ''}

        ${report.report_type === 'leave_summary' && data.leaveByType ? `
        <table>
          <tr><th>Leave Type</th><th>Approved</th><th>Pending</th></tr>
          ${(data.leaveByType as any[]).map((l: any) => `<tr><td>${l.type}</td><td>${l.approved}</td><td>${l.pending}</td></tr>`).join('')}
        </table>
        ` : ''}
      </div>
      <div class="footer">This is an automated report from JL HRIS. Do not reply to this email.</div>
    </body>
    </html>
  `;
}

async function gatherReportData(supabase: any, reportType: string, filterConfig: any): Promise<Record<string, any>> {
  const data: Record<string, any> = {};

  try {
    if (reportType === 'executive_summary' || reportType === 'headcount') {
      const { count } = await supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'Active');
      data.totalEmployees = count ?? 0;

      const { data: depts } = await supabase.from('employees').select('department').eq('status', 'Active');
      if (depts) {
        const byDept: Record<string, number> = {};
        for (const e of depts) { byDept[e.department || 'Unknown'] = (byDept[e.department || 'Unknown'] || 0) + 1; }
        data.departments = Object.entries(byDept).map(([name, count]) => ({ name, count })).sort((a, b) => (b.count as number) - (a.count as number));
      }
    }

    if (reportType === 'executive_summary' || reportType === 'leave_summary') {
      const { count: pendingLeaves } = await supabase.from('leaves').select('*', { count: 'exact', head: true }).eq('status', 'Pending');
      data.pendingLeaves = pendingLeaves ?? 0;

      const { data: leaves } = await supabase.from('leaves').select('leave_type, status');
      if (leaves) {
        const byType: Record<string, { approved: number; pending: number }> = {};
        for (const l of leaves) {
          if (!byType[l.leave_type]) byType[l.leave_type] = { approved: 0, pending: 0 };
          if (l.status === 'Approved') byType[l.leave_type].approved++;
          else if (l.status === 'Pending') byType[l.leave_type].pending++;
        }
        data.leaveByType = Object.entries(byType).map(([type, v]) => ({ type, ...v }));
      }
    }

    if (reportType === 'executive_summary' || reportType === 'payroll_summary') {
      const now = new Date();
      const { data: payroll } = await supabase
        .from('payroll_records')
        .select('net_salary')
        .eq('year', now.getFullYear())
        .eq('month', now.toLocaleString('default', { month: 'long' }))
        .eq('status', 'Paid');
      data.payrollPayout = payroll?.reduce((s: number, r: any) => s + (r.net_salary || 0), 0) ?? 0;
    }
  } catch {}

  return data;
}

// POST /scheduled-reports/dispatch — called by a cron or manually to dispatch due reports
app.post('/dispatch', async (c) => {
  try {
    const supabase = getSupabase();
    const now = new Date();

    const { data: reports, error } = await supabase
      .from('scheduled_reports')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_at', now.toISOString());

    if (error) return c.json({ success: false, error: error.message }, 500);
    if (!reports?.length) return c.json({ success: true, dispatched: 0, message: 'No reports due' });

    let dispatched = 0;
    const errors: string[] = [];

    for (const report of reports) {
      try {
        const recipients: string[] = report.recipients || [];
        if (!recipients.length) {
          await updateNextRun(supabase, report);
          continue;
        }

        const data = await gatherReportData(supabase, report.report_type, report.filter_config);
        const html = buildReportHtml(report, data);
        const subject = `[JL HRIS] ${report.name} — ${now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;

        const sent = await sendReportEmail(recipients, subject, html);
        if (sent) {
          dispatched++;
          await supabase.from('scheduled_reports')
            .update({ last_run_at: now.toISOString(), next_run_at: calcNextRun(report.schedule).toISOString() })
            .eq('id', report.id);
        } else {
          errors.push(`Failed to send report: ${report.name}`);
        }
      } catch (err: any) {
        errors.push(`${report.name}: ${err.message}`);
        await updateNextRun(supabase, report);
      }
    }

    return c.json({ success: true, dispatched, total: reports.length, errors });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

async function updateNextRun(supabase: any, report: any) {
  await supabase.from('scheduled_reports')
    .update({ last_run_at: new Date().toISOString(), next_run_at: calcNextRun(report.schedule).toISOString() })
    .eq('id', report.id);
}

function calcNextRun(schedule: string): Date {
  const next = new Date();
  switch (schedule) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      next.setHours(8, 0, 0, 0);
      break;
    case 'weekly':
      next.setDate(next.getDate() + (7 - next.getDay() + 1) % 7 || 7);
      next.setHours(8, 0, 0, 0);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1, 1);
      next.setHours(8, 0, 0, 0);
      break;
    case 'first_of_month':
      next.setMonth(next.getMonth() + 1, 1);
      next.setHours(8, 0, 0, 0);
      break;
    default:
      next.setDate(next.getDate() + 1);
  }
  return next;
}

// GET /scheduled-reports — list all
app.get('/', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('scheduled_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /scheduled-reports — create
app.post('/', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const nextRun = calcNextRun(body.schedule);
    const { data, error } = await supabase
      .from('scheduled_reports')
      .insert([{
        name: body.name,
        created_by: body.created_by,
        report_type: body.report_type || 'executive_summary',
        filter_config: body.filter_config || {},
        schedule: body.schedule || 'weekly',
        recipients: body.recipients || [],
        next_run_at: nextRun.toISOString(),
        is_active: true,
      }])
      .select()
      .single();
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PATCH /scheduled-reports/:id — update
app.patch('/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { data, error } = await supabase
      .from('scheduled_reports')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', c.req.param('id'))
      .select()
      .single();
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// DELETE /scheduled-reports/:id
app.delete('/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('scheduled_reports').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default app;
