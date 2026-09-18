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

// Get all employees from the employees table
app.get('/employees', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[DIRECTORY] Error fetching employees:', error);
      return c.json({ success: false, error: error.message }, 500);
    }

    const formatted = (data || []).map((emp: any) => ({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      phone: emp.phone || '',
      department: emp.department || '',
      designation: emp.job_title || '',
      managerId: emp.manager_id || '',
      location: emp.location || '',
      joinDate: emp.join_date || '',
      profilePicture: emp.profile_picture || '',
      skills: emp.skills || [],
      status: emp.status || 'Active',
      authUserId: emp.auth_user_id,
      createdAt: emp.created_at,
      updatedAt: emp.updated_at,
    }));

    console.log(`[DIRECTORY] Returned ${formatted.length} employees from employees table`);
    return c.json({ success: true, data: formatted, source: 'employees_table' });
  } catch (error) {
    console.error('[DIRECTORY] Error:', error);
    return c.json({ success: false, error: 'Failed to fetch employees' }, 500);
  }
});

// Create employee
app.post('/employees', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const ec = body.emergencyContact ?? body.emergency_contact ?? null;
    const record: Record<string, any> = {
      name: body.name,
      email: body.email,
      phone: body.phone || '',
      department: body.department || '',
      job_title: body.designation || body.jobTitle || body.position || '',
      location: body.location || '',
      join_date: body.joinDate || body.join_date || null,
      manager_id: body.managerId || null,
      profile_picture: body.profilePicture || '',
      skills: body.skills || [],
      status: body.status || 'Active',
      auth_user_id: body.authUserId || null,
      onboarding_id: body.onboardingId || null,
    };
    if (ec !== null) record.emergency_contact = ec;

    // Upsert by email
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .eq('email', body.email)
      .maybeSingle();

    let result;
    if (existing) {
      result = await supabase
        .from('employees')
        .update({...record, ...auditUpdate(c)})
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('employees')
        .insert([{...record, ...auditCreate(c)}])
        .select()
        .single();
    }

    if (result.error) {
      return c.json({ success: false, error: result.error.message }, 500);
    }

    return c.json({ success: true, data: result.data }, existing ? 200 : 201);
  } catch (error) {
    console.error('[DIRECTORY] Error creating employee:', error);
    return c.json({ success: false, error: 'Failed to create employee' }, 500);
  }
});

// Update employee
app.put('/employees/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');
    const body = await c.req.json();

    const putEc = body.emergencyContact ?? body.emergency_contact;
    const putRecord: Record<string, any> = {
      name: body.name,
      email: body.email,
      phone: body.phone,
      department: body.department,
      job_title: body.designation || body.jobTitle,
      location: body.location,
      join_date: body.joinDate || body.join_date,
      manager_id: body.managerId || null,
      skills: body.skills,
      status: body.status,
      ...auditUpdate(c),
    };
    if (putEc !== undefined) putRecord.emergency_contact = putEc;

    const { data, error } = await supabase
      .from('employees')
      .update(putRecord)
      .eq('id', id)
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update employee' }, 500);
  }
});

// Delete employee (soft by default)
app.delete('/employees/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');
    const hard = c.req.query('hard') === 'true';

    if (hard) {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) return c.json({ success: false, error: error.message }, 500);
      return c.json({ success: true, message: 'Employee permanently deleted' });
    } else {
      const { data, error } = await supabase
        .from('employees')
        .update({ status: 'Inactive', ...auditUpdate(c) })
        .eq('id', id)
        .select()
        .single();
      if (error) return c.json({ success: false, error: error.message }, 500);
      return c.json({ success: true, data });
    }
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete employee' }, 500);
  }
});

// Search employees
app.get('/search', async (c) => {
  try {
    const supabase = getSupabase();
    const q = c.req.query('q') || '';

    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .or(`name.ilike.%${q}%,email.ilike.%${q}%,department.ilike.%${q}%,job_title.ilike.%${q}%`)
      .eq('status', 'Active')
      .order('name')
      .limit(50);

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Search failed' }, 500);
  }
});

// Stats from the employees table
app.get('/stats', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('employees').select('status');
    if (error) return c.json({ success: false, error: error.message }, 500);

    const total = data?.length || 0;
    const active = data?.filter((e: any) => e.status === 'Active').length || 0;
    const onLeave = data?.filter((e: any) => e.status === 'On Leave').length || 0;

    return c.json({ success: true, data: { totalEmployees: total, activeEmployees: active, onLeave } });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch stats' }, 500);
  }
});

// Departments derived from employees
app.get('/departments', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('employees')
      .select('department')
      .not('department', 'is', null)
      .eq('status', 'Active');

    if (error) return c.json({ success: false, error: error.message }, 500);

    const deptMap = new Map<string, number>();
    (data || []).forEach((e: any) => {
      if (e.department) deptMap.set(e.department, (deptMap.get(e.department) || 0) + 1);
    });

    const departments = Array.from(deptMap.entries()).map(([name, count]) => ({
      name,
      employeeCount: count,
    }));

    return c.json({ success: true, data: departments });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch departments' }, 500);
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────

function isTableMissing(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message ?? error);
  return msg.includes('relation') && msg.includes('does not exist');
}

// ── Employee Documents ─────────────────────────────────────────────────────

app.get('/documents', async (c) => {
  const supabase = getSupabase();
  const employeeId = c.req.query('employee_id');
  try {
    let q = supabase.from('employee_documents').select('*').is('deleted_at', null).order('created_at', { ascending: false });
    if (employeeId) q = q.eq('employee_id', employeeId);
    const { data, error } = await q;
    if (error) { if (isTableMissing(error)) return c.json({ success: true, data: [] }); throw error; }
    return c.json({ success: true, data: data ?? [] });
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.post('/documents', async (c) => {
  const supabase = getSupabase();
  const body = await c.req.json();
  try {
    const { data, error } = await supabase.from('employee_documents').insert({
      ...body,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      status: 'Uploaded',
      ...auditCreate(c),
    }).select().single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.delete('/documents/:id', async (c) => {
  const supabase = getSupabase();
  const { id } = c.req.param();
  try {
    const { error } = await supabase.from('employee_documents').update({ deleted_at: new Date().toISOString(), ...auditUpdate(c) }).eq('id', id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

export default app;
