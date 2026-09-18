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

    // Build a name lookup for manager resolution
    const nameById: Record<string, string> = {};
    (data || []).forEach((emp: any) => { nameById[emp.id] = emp.name; });

    const formatted = (data || []).map((emp: any) => ({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      phone: emp.phone || '',
      department: emp.department || '',
      designation: emp.job_title || '',
      // Both snake_case (DirectoryEmployee type) and camelCase for compatibility
      manager_id: emp.manager_id || '',
      managerId: emp.manager_id || '',
      manager_name: emp.manager_id ? (nameById[emp.manager_id] || '') : '',
      location: emp.location || '',
      join_date: emp.join_date || '',
      joinDate: emp.join_date || '',
      profile_picture: emp.profile_picture || '',
      profilePicture: emp.profile_picture || '',
      skills: emp.skills || [],
      status: emp.status || 'Active',
      authUserId: emp.auth_user_id,
      emergencyContact: emp.emergency_contact ?? null,
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

    const record = {
      name: body.name,
      email: body.email,
      phone: body.phone || '',
      department: body.department || '',
      job_title: body.designation || body.jobTitle || body.job_title || body.position || '',
      location: body.location || '',
      join_date: body.join_date || body.joinDate || null,
      manager_id: body.manager_id || body.managerId || null,
      profile_picture: body.profile_picture || body.profilePicture || '',
      skills: body.skills || [],
      status: body.status || 'Active',
      auth_user_id: body.authUserId || null,
      onboarding_id: body.onboardingId || null,
      emergency_contact: body.emergencyContact ?? body.emergency_contact ?? null,
    };

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

    // If emergency_contact column doesn't exist yet, add it and retry WITH the ec data
    if (result.error && result.error.message?.includes('emergency_contact')) {
      await ensureEmergencyContactColumn(supabase);
      if (existing) {
        result = await supabase.from('employees').update({...record, ...auditUpdate(c)}).eq('id', existing.id).select().single();
      } else {
        result = await supabase.from('employees').insert([{...record, ...auditCreate(c)}]).select().single();
      }
    }

    if (result.error) {
      return c.json({ success: false, error: result.error.message }, 500);
    }

    const employee = result.data;

    // Auto-provision app_users row if one doesn't exist yet for this email
    if (!existing) {
      const { data: existingUser } = await supabase
        .from('app_users')
        .select('id')
        .eq('email', employee.email)
        .maybeSingle();

      if (!existingUser) {
        await supabase.from('app_users').insert([{
          email: employee.email,
          name: employee.name,
          roles: ['employee'],
          primary_role: 'employee',
          department: employee.department || '',
          employee_id: employee.id,
          status: 'active',
          ...auditCreate(c),
        }]);
      } else {
        // Link existing user to the new employee row
        await supabase
          .from('app_users')
          .update({ employee_id: employee.id, ...auditUpdate(c) })
          .eq('id', existingUser.id);
      }
    }

    return c.json({ success: true, data: employee }, existing ? 200 : 201);
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

    // Use raw text parsing to avoid Hono/Deno body-stream quirks on PUT
    const rawText = await c.req.text();
    let body: Record<string, any> = {};
    try {
      body = rawText ? JSON.parse(rawText) : {};
    } catch {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    const updatePayload: Record<string, any> = {
      ...auditUpdate(c),
    };
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.email !== undefined) updatePayload.email = body.email;
    if (body.phone !== undefined) updatePayload.phone = body.phone;
    if (body.department !== undefined) updatePayload.department = body.department;
    // Accept designation / jobTitle / job_title
    const jobTitle = body.designation ?? body.jobTitle ?? body.job_title;
    if (jobTitle !== undefined) updatePayload.job_title = jobTitle;
    if (body.location !== undefined) updatePayload.location = body.location;
    // Accept join_date (snake) or joinDate (camel)
    const joinDate = body.join_date ?? body.joinDate;
    if (joinDate !== undefined) updatePayload.join_date = joinDate;
    // Accept manager_id (snake) or managerId (camel)
    const managerId = body.manager_id !== undefined ? body.manager_id : body.managerId;
    if (managerId !== undefined) updatePayload.manager_id = managerId || null;
    if (body.skills !== undefined) updatePayload.skills = body.skills;
    if (body.status !== undefined) updatePayload.status = body.status;
    // Accept emergencyContact (camel) or emergency_contact (snake)
    const ecValue = body.emergencyContact ?? body.emergency_contact;
    if (ecValue !== undefined) updatePayload.emergency_contact = ecValue;

    let { data, error } = await supabase
      .from('employees')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    // If emergency_contact column doesn't exist, add it and retry WITH the ec data
    if (error && error.message?.includes('emergency_contact')) {
      await ensureEmergencyContactColumn(supabase);
      const retry = await supabase
        .from('employees')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update employee' }, 500);
  }
});

// Dedicated emergency contact patch
app.patch('/employees/:id/emergency-contact', async (c) => {
  const supabase = getSupabase();
  const id = c.req.param('id');

  try {
    // Use raw text parsing to avoid Hono/Deno body-stream quirks
    const rawText = await c.req.text();
    let body: Record<string, any> = {};
    try {
      body = rawText ? JSON.parse(rawText) : {};
    } catch {
      return c.json({ success: false, error: `Invalid JSON body: ${rawText.slice(0, 100)}` }, 400);
    }

    const ec = body.emergencyContact ?? body.emergency_contact;
    if (ec === undefined || ec === null) {
      return c.json({ success: false, error: `emergencyContact is required. Received keys: ${Object.keys(body).join(', ') || 'none'}` }, 400);
    }

    // First verify the employee exists
    const { data: existing, error: findErr } = await supabase
      .from('employees')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (findErr) {
      // If column missing, add it then retry
      if (findErr.message?.includes('emergency_contact')) {
        await ensureEmergencyContactColumn(supabase);
      } else {
        return c.json({ success: false, error: findErr.message }, 500);
      }
    }

    if (!existing) {
      return c.json({ success: false, error: `Employee not found: ${id}` }, 404);
    }

    // Perform the update and select back to confirm
    const { data: updated, error: updateErr } = await supabase
      .from('employees')
      .update({ emergency_contact: ec })
      .eq('id', id)
      .select('id, emergency_contact')
      .maybeSingle();

    if (updateErr) {
      // Column might be missing — try adding it and retry once
      if (updateErr.message?.includes('emergency_contact') || updateErr.message?.includes('column')) {
        await ensureEmergencyContactColumn(supabase);
        const { data: retried, error: retryErr } = await supabase
          .from('employees')
          .update({ emergency_contact: ec })
          .eq('id', id)
          .select('id, emergency_contact')
          .maybeSingle();
        if (retryErr) return c.json({ success: false, error: retryErr.message }, 500);
        return c.json({ success: true, data: retried });
      }
      return c.json({ success: false, error: updateErr.message }, 500);
    }

    return c.json({ success: true, data: updated });
  } catch (err: any) {
    return c.json({ success: false, error: err?.message ?? 'Failed to update emergency contact' }, 500);
  }
});

// Ensure the emergency_contact column exists on employees
async function ensureEmergencyContactColumn(supabase: ReturnType<typeof getSupabase>): Promise<void> {
  // Try a lightweight probe first
  const { error: probe } = await supabase
    .from('employees')
    .select('emergency_contact')
    .limit(1);
  if (!probe) return; // column exists

  // Column missing — add via management API
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sql = 'ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact JSONB DEFAULT NULL';
  await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  }).catch(() => null);
}

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
    const { data, error } = await supabase.from('employees').select('status, join_date');
    if (error) return c.json({ success: false, error: error.message }, 500);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const total = data?.length || 0;
    const active = data?.filter((e: any) => e.status === 'Active').length || 0;
    const onLeave = data?.filter((e: any) => e.status === 'On Leave').length || 0;
    const inactive = data?.filter((e: any) => e.status === 'Inactive').length || 0;

    const newThisMonth = data?.filter((e: any) => {
      if (!e.join_date) return false;
      const d = new Date(e.join_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length || 0;

    const attrition = total > 0 ? Math.round((inactive / total) * 100 * 10) / 10 : 0;

    return c.json({
      success: true,
      data: {
        total, active, newThisMonth, attrition,
        totalEmployees: total, activeEmployees: active, onLeave,
      },
    });
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

// ── One-time migration endpoint ───────────────────────────────────────────
// Adds the emergency_contact JSONB column if it doesn't exist yet.
// Call once: POST /directory/migrate
app.post('/migrate', async (c) => {
  try {
    const supabase = getSupabase();
    // Use Supabase's pg connection via a raw SQL approach through the DB REST API
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_ddl`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: "ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact JSONB DEFAULT NULL" }),
    });
    if (!res.ok) {
      // Try via a direct column probe — if SELECT works the column exists
      const { data, error } = await supabase
        .from('employees')
        .select('emergency_contact')
        .limit(1);
      if (!error) return c.json({ success: true, message: 'Column already exists' });
      return c.json({ success: false, error: await res.text() }, 500);
    }
    return c.json({ success: true, message: 'Column added' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
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
