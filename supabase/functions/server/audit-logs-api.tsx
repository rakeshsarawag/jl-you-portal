import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';

const app = new Hono();

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// GET /audit-logs — query with filters, pagination
app.get('/', async (c) => {
  try {
    const supabase = getSupabase();
    const {
      page = '1',
      limit = '50',
      user_email,
      event_type,
      resource_type,
      severity,
      status,
      from_date,
      to_date,
      search,
    } = c.req.query();

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(200, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * pageSize;

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (user_email) query = query.ilike('user_email', `%${user_email}%`);
    if (event_type) query = query.eq('event_type', event_type);
    if (resource_type) query = query.eq('resource_type', resource_type);
    if (severity) query = query.eq('severity', severity);
    if (status) query = query.eq('status', status);
    if (from_date) query = query.gte('created_at', from_date);
    if (to_date) query = query.lte('created_at', to_date + 'T23:59:59Z');
    if (search) {
      query = query.or(`action.ilike.%${search}%,user_email.ilike.%${search}%,resource_id.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) return c.json({ success: false, error: error.message }, 500);

    return c.json({
      success: true,
      data: data ?? [],
      total: count ?? 0,
      page: pageNum,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch audit logs' }, 500);
  }
});

// GET /audit-logs/stats — aggregated counts by event_type and severity
app.get('/stats', async (c) => {
  try {
    const supabase = getSupabase();

    const { data: bySeverity } = await supabase
      .from('audit_logs')
      .select('severity')
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());

    const { data: byType } = await supabase
      .from('audit_logs')
      .select('event_type')
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());

    const { count: total } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true });

    const { count: today } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date().toISOString().split('T')[0]);

    const { count: failures } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failure')
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());

    const severityCounts: Record<string, number> = {};
    (bySeverity ?? []).forEach((r: any) => {
      severityCounts[r.severity] = (severityCounts[r.severity] ?? 0) + 1;
    });

    const typeCounts: Record<string, number> = {};
    (byType ?? []).forEach((r: any) => {
      typeCounts[r.event_type] = (typeCounts[r.event_type] ?? 0) + 1;
    });

    return c.json({
      success: true,
      data: { total, today, failures_7d: failures, severityCounts, typeCounts },
    });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch stats' }, 500);
  }
});

// GET /audit-logs/export — CSV export (max 5000 rows)
app.get('/export', async (c) => {
  try {
    const supabase = getSupabase();
    const { from_date, to_date, user_email, event_type, severity, status } = c.req.query();

    let query = supabase
      .from('audit_logs')
      .select('created_at,user_email,user_role,event_type,action,resource_type,resource_id,severity,status,ip_address')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (user_email) query = query.ilike('user_email', `%${user_email}%`);
    if (event_type) query = query.eq('event_type', event_type);
    if (severity) query = query.eq('severity', severity);
    if (status) query = query.eq('status', status);
    if (from_date) query = query.gte('created_at', from_date);
    if (to_date) query = query.lte('created_at', to_date + 'T23:59:59Z');

    const { data, error } = await query;
    if (error) return c.json({ success: false, error: error.message }, 500);

    const header = 'Timestamp,User Email,Role,Event Type,Action,Resource Type,Resource ID,Severity,Status,IP Address';
    const rows = (data ?? []).map((r: any) =>
      [
        r.created_at,
        r.user_email ?? '',
        r.user_role ?? '',
        r.event_type,
        `"${(r.action ?? '').replace(/"/g, '""')}"`,
        r.resource_type ?? '',
        r.resource_id ?? '',
        r.severity,
        r.status,
        r.ip_address ?? '',
      ].join(',')
    );

    return new Response([header, ...rows].join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to export audit logs' }, 500);
  }
});

export default app;
