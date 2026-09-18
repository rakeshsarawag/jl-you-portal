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

const DEFAULT_TASKS = [
  { title: 'Complete HR Documentation', description: 'Fill out all required forms', category: 'documentation', status: 'pending', priority: 'high', task_order: 1 },
  { title: 'IT Account Setup', description: 'Create email, Slack, and system accounts', category: 'setup', status: 'pending', priority: 'high', task_order: 2 },
  { title: 'Laptop & Equipment Assignment', description: 'Receive laptop and peripherals', category: 'setup', status: 'pending', priority: 'high', task_order: 3 },
  { title: 'Watch Welcome Video', description: 'Complete the company orientation video (15 mins)', category: 'training', status: 'pending', priority: 'medium', task_order: 4 },
  { title: 'Meet Your Manager', description: 'Introduction and role discussion', category: 'meeting', status: 'pending', priority: 'high', task_order: 5 },
  { title: 'Meet Your Buddy', description: 'Introduction call with assigned onboarding buddy', category: 'meeting', status: 'pending', priority: 'medium', task_order: 6 },
  { title: 'Security Training', description: 'Complete mandatory security training', category: 'training', status: 'pending', priority: 'high', task_order: 7 },
  { title: 'Complete Background Verification', description: 'Submit required documents for verification', category: 'documentation', status: 'pending', priority: 'high', task_order: 8 },
];

async function calculateProgress(supabase: any, onboardingId: string) {
  const { data: tasks } = await supabase
    .from('onboarding_tasks')
    .select('status')
    .eq('onboarding_id', onboardingId);

  if (!tasks?.length) return { progress: 0, completedTasks: 0, totalTasks: 0 };
  const completed = tasks.filter((t: any) => t.status === 'completed').length;
  const progress = Math.round((completed / tasks.length) * 100);
  return { progress, completedTasks: completed, totalTasks: tasks.length };
}

// Auto-enrol in mandatory training when onboarding completes
async function autoEnrolMandatoryTraining(supabase: any, employeeId: string) {
  try {
    const { data: courses } = await supabase
      .from('training_courses')
      .select('id')
      .eq('mandatory', true)
      .eq('is_active', true);

    if (!courses?.length) return;

    for (const course of courses) {
      const { data: existing } = await supabase
        .from('training_enrollments')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('course_id', course.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('training_enrollments').insert({
          id: crypto.randomUUID(),
          employee_id: employeeId,
          course_id: course.id,
          status: 'Enrolled',
          progress: 0,
          enrolled_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error('[AutoEnrol] Failed to enrol in mandatory training:', err);
    // Never throw — this is a side effect
  }
}

async function updateOnboardingStatus(supabase: any, onboardingId: string) {
  const { progress, completedTasks, totalTasks } = await calculateProgress(supabase, onboardingId);
  let status = 'not-started';
  if (progress === 100) status = 'completed';
  else if (progress > 0) status = 'in-progress';

  await supabase
    .from('onboarding_records')
    .update({ progress, status, completed_tasks: completedTasks, total_tasks: totalTasks })
    .eq('id', onboardingId);

  return { progress, status, completedTasks, totalTasks };
}

function shapeRecord(record: any) {
  return {
    id: record.id,
    employeeName: record.employee_name,
    email: record.email,
    phone: record.phone || '',
    department: record.department || '',
    position: record.position || '',
    startDate: record.start_date || '',
    manager: record.manager || '',
    buddy: record.buddy || '',
    location: record.location || '',
    status: record.status || 'not-started',
    progress: record.progress || 0,
    completedTasks: record.completed_tasks || 0,
    totalTasks: record.total_tasks || 0,
    notes: record.notes || '',
    portalAccessEnabled: record.portal_access_enabled || false,
    authUserId: record.auth_user_id || null,
    accountCreatedDate: record.account_created_date || null,
    employeeId: record.employee_id || null,
    candidateId: record.candidate_id || null,
    tasks: record.onboarding_tasks || [],
    documents: record.onboarding_documents || [],
    welcomeKit: record.onboarding_welcome_kits?.[0] || null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

// ==================== EMPLOYEES (onboarding records) ====================

// Get all onboarding records
app.get('/employees', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('onboarding_records')
      .select(`
        *,
        onboarding_tasks (*),
        onboarding_documents (*),
        onboarding_welcome_kits (*)
      `)
      .order('created_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json((data || []).map(shapeRecord));
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch employees' }, 500);
  }
});

// Create onboarding record
app.post('/employees', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data: record, error } = await supabase
      .from('onboarding_records')
      .insert([{
        employee_id: body.employeeId || null,
        candidate_id: body.candidateId || null,
        employee_name: body.employeeName || body.name || '',
        email: body.email,
        phone: body.phone || '',
        department: body.department || '',
        position: body.position || '',
        start_date: body.startDate || body.joiningDate || null,
        manager: body.manager || '',
        buddy: body.buddy || '',
        location: body.location || '',
        status: 'not-started',
        progress: 0,
        completed_tasks: 0,
        total_tasks: DEFAULT_TASKS.length,
        notes: body.notes || '',
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);

    // Create default tasks
    const taskInserts = DEFAULT_TASKS.map(t => ({ ...t, onboarding_id: record.id }));
    await supabase.from('onboarding_tasks').insert(taskInserts);

    // Create default welcome kit
    await supabase.from('onboarding_welcome_kits').insert([{
      onboarding_id: record.id,
      status: 'Not Ordered',
      items: ['Laptop', 'Mouse', 'Keyboard', 'Welcome Kit', 'Company T-Shirt'],
      ...auditCreate(c),
    }]);

    const full = await supabase
      .from('onboarding_records')
      .select('*, onboarding_tasks(*), onboarding_documents(*), onboarding_welcome_kits(*)')
      .eq('id', record.id)
      .single();

    return c.json({ success: true, data: shapeRecord(full.data) }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create employee' }, 500);
  }
});

// Update onboarding record
app.post('/employees/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('onboarding_records')
      .update({
        employee_name: body.employeeName || body.name,
        email: body.email,
        phone: body.phone,
        department: body.department,
        position: body.position,
        start_date: body.startDate || body.joiningDate,
        manager: body.manager,
        buddy: body.buddy,
        location: body.location,
        notes: body.notes,
        portal_access_enabled: body.portalAccessEnabled,
        auth_user_id: body.authUserId,
        account_created_date: body.accountCreatedDate,
        employee_id: body.employeeId || null,
        ...auditUpdate(c),
      })
      .eq('id', id)
      .select('*, onboarding_tasks(*), onboarding_documents(*), onboarding_welcome_kits(*)')
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data: shapeRecord(data) });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update employee' }, 500);
  }
});

// Delete onboarding record
app.delete('/employees/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('onboarding_records')
      .delete()
      .eq('id', c.req.param('id'));

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete employee' }, 500);
  }
});

// ==================== TASKS ====================

// Update a task (toggle status)
app.post('/tasks/update', async (c) => {
  try {
    const supabase = getSupabase();
    const { employeeId, taskId, completed } = await c.req.json();

    const { error } = await supabase
      .from('onboarding_tasks')
      .update({
        status: completed ? 'completed' : 'pending',
        completed_date: completed ? new Date().toISOString().split('T')[0] : null,
        ...auditUpdate(c),
      })
      .eq('id', taskId)
      .eq('onboarding_id', employeeId);

    if (error) return c.json({ success: false, error: error.message }, 500);

    const stats = await updateOnboardingStatus(supabase, employeeId);

    const { data: record } = await supabase
      .from('onboarding_records')
      .select('*, onboarding_tasks(*), onboarding_documents(*), onboarding_welcome_kits(*)')
      .eq('id', employeeId)
      .single();

    // Auto-enrol in mandatory training when onboarding reaches 100%
    if (stats.status === 'completed' && record?.employee_id) {
      autoEnrolMandatoryTraining(supabase, record.employee_id);
    }

    return c.json({ success: true, data: record ? shapeRecord(record) : null });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update task' }, 500);
  }
});

// ==================== CANDIDATES (separate onboarding workflow) ====================

app.get('/candidates', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('onboarding_records')
      .select('*, onboarding_tasks(*), onboarding_documents(*), onboarding_welcome_kits(*)')
      .order('created_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: (data || []).map(shapeRecord) });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch candidates' }, 500);
  }
});

app.get('/candidates/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('onboarding_records')
      .select('*, onboarding_tasks(*), onboarding_documents(*), onboarding_welcome_kits(*)')
      .eq('id', c.req.param('id'))
      .single();

    if (error || !data) return c.json({ success: false, error: 'Not found' }, 404);
    return c.json({ success: true, data: shapeRecord(data) });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch candidate' }, 500);
  }
});

app.put('/candidates/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { data, error } = await supabase
      .from('onboarding_records')
      .update({
        employee_name: body.employeeName || body.name,
        email: body.email,
        phone: body.phone,
        department: body.department,
        position: body.position,
        start_date: body.joiningDate || body.startDate,
        buddy: body.buddy,
        notes: body.notes,
        ...auditUpdate(c),
      })
      .eq('id', c.req.param('id'))
      .select('*, onboarding_tasks(*), onboarding_documents(*), onboarding_welcome_kits(*)')
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data: shapeRecord(data) });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update candidate' }, 500);
  }
});

app.delete('/candidates/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('onboarding_records')
      .delete()
      .eq('id', c.req.param('id'));

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, message: 'Candidate deleted successfully' });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete candidate' }, 500);
  }
});

// Checklist item update
app.put('/candidates/:id/checklist/:itemId', async (c) => {
  try {
    const supabase = getSupabase();
    const { status } = await c.req.json();

    const { error } = await supabase
      .from('onboarding_tasks')
      .update({
        status,
        completed_date: status === 'Completed' || status === 'completed' ? new Date().toISOString().split('T')[0] : null,
        ...auditUpdate(c),
      })
      .eq('id', c.req.param('itemId'))
      .eq('onboarding_id', c.req.param('id'));

    if (error) return c.json({ success: false, error: error.message }, 500);
    await updateOnboardingStatus(supabase, c.req.param('id'));

    const { data } = await supabase
      .from('onboarding_records')
      .select('*, onboarding_tasks(*), onboarding_documents(*), onboarding_welcome_kits(*)')
      .eq('id', c.req.param('id'))
      .single();

    return c.json({ success: true, data: data ? shapeRecord(data) : null });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update checklist item' }, 500);
  }
});

// Welcome kit update
app.put('/candidates/:id/welcome-kit', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    await supabase
      .from('onboarding_welcome_kits')
      .upsert({
        onboarding_id: c.req.param('id'),
        status: body.status,
        items: body.items,
        tracking_number: body.trackingNumber || null,
        delivery_date: body.deliveryDate || null,
      }, { onConflict: 'onboarding_id' });

    const { data } = await supabase
      .from('onboarding_records')
      .select('*, onboarding_tasks(*), onboarding_documents(*), onboarding_welcome_kits(*)')
      .eq('id', c.req.param('id'))
      .single();

    return c.json({ success: true, data: data ? shapeRecord(data) : null });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update welcome kit' }, 500);
  }
});

// Add document
app.post('/candidates/:id/documents', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('onboarding_documents')
      .insert([{
        onboarding_id: c.req.param('id'),
        name: body.name,
        type: body.type || 'Other',
        status: 'Pending',
        url: body.url || null,
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to add document' }, 500);
  }
});

// Update document
app.put('/candidates/:id/documents/:docId', async (c) => {
  try {
    const supabase = getSupabase();
    const { status } = await c.req.json();

    const { data, error } = await supabase
      .from('onboarding_documents')
      .update({
        status,
        signed_date: status === 'Signed' ? new Date().toISOString() : null,
        ...auditUpdate(c),
      })
      .eq('id', c.req.param('docId'))
      .eq('onboarding_id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update document' }, 500);
  }
});

// Bulk upload
app.post('/bulk-upload', async (c) => {
  try {
    const supabase = getSupabase();
    const { candidates: candidatesData } = await c.req.json();

    if (!Array.isArray(candidatesData) || !candidatesData.length) {
      return c.json({ success: false, error: 'No candidate data provided' }, 400);
    }

    const { data: existing } = await supabase.from('onboarding_records').select('email');
    const existingEmails = new Set((existing || []).map((e: any) => e.email.toLowerCase()));

    const results = { successful: [] as string[], failed: [] as any[] };

    for (let i = 0; i < candidatesData.length; i++) {
      const cd = candidatesData[i];
      const row = i + 2;
      const missing = ['employeeName', 'email', 'department', 'startDate'].filter(f => !cd[f]);

      if (missing.length) {
        results.failed.push({ row, error: `Missing: ${missing.join(', ')}`, data: cd });
        continue;
      }

      if (existingEmails.has(cd.email.toLowerCase())) {
        results.failed.push({ row, error: `Email ${cd.email} already exists`, data: cd });
        continue;
      }

      const { data: record, error } = await supabase
        .from('onboarding_records')
        .insert([{
          employee_name: cd.employeeName,
          email: cd.email,
          department: cd.department,
          position: cd.position || 'Not specified',
          start_date: cd.startDate,
          manager: cd.manager || 'TBD',
          buddy: cd.buddy || '',
          status: 'not-started',
          progress: 0,
          completed_tasks: 0,
          total_tasks: DEFAULT_TASKS.length,
          notes: cd.notes || '',
          ...auditCreate(c),
        }])
        .select('id')
        .single();

      if (error) {
        results.failed.push({ row, error: error.message, data: cd });
        continue;
      }

      // Create default tasks
      await supabase.from('onboarding_tasks').insert(DEFAULT_TASKS.map(t => ({ ...t, onboarding_id: record.id })));
      results.successful.push(cd.employeeName);
      existingEmails.add(cd.email.toLowerCase());
    }

    return c.json({
      success: true,
      data: {
        totalProcessed: candidatesData.length,
        successCount: results.successful.length,
        failureCount: results.failed.length,
        successful: results.successful,
        failed: results.failed,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to process bulk upload' }, 500);
  }
});

// Stats
app.get('/stats', async (c) => {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('onboarding_records').select('status, start_date, progress');

    const total = data?.length || 0;
    const active = data?.filter((r: any) => r.status === 'in-progress').length || 0;
    const completed = data?.filter((r: any) => r.status === 'completed').length || 0;

    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcoming = data?.filter((r: any) => {
      const d = r.start_date ? new Date(r.start_date) : null;
      return d && d >= today && d <= nextWeek;
    }).length || 0;

    return c.json({ success: true, data: { totalCandidates: total, activeCandidates: active, completedOnboarding: completed, upcomingJoinings: upcoming, avgCompletionTime: 14 } });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch stats' }, 500);
  }
});

// ==================== ACCOUNT ACTIVATION ====================

app.post('/enable-account', async (c) => {
  try {
    const supabase = getSupabase();
    const { employeeId, name, email, department, roles, autoGenerated } = await c.req.json();

    const assignedRoles = roles?.length ? roles : ['employee'];
    const primaryRole = assignedRoles[0];

    // Create Supabase auth account
    const tempPassword = `JL${Math.random().toString(36).slice(-8)}!`;
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      user_metadata: { name, department, source: 'onboarding' },
      email_confirm: true,
    });

    if (createError) {
      if (createError.message.includes('already registered')) {
        return c.json({ success: false, error: 'Account already exists', alreadyExists: true }, 400);
      }
      return c.json({ success: false, error: createError.message }, 500);
    }

    const authUserId = userData.user?.id;

    // Update onboarding record
    await supabase
      .from('onboarding_records')
      .update({ portal_access_enabled: true, auth_user_id: authUserId, account_created_date: new Date().toISOString(), ...auditUpdate(c) })
      .eq('id', employeeId);

    // Ensure employee row exists
    const { data: existing } = await supabase.from('employees').select('id').eq('email', email).maybeSingle();
    let employeeRowId = existing?.id;

    if (!employeeRowId) {
      const { data: onbRecord } = await supabase.from('onboarding_records').select('*').eq('id', employeeId).single();
      const { data: newEmp } = await supabase
        .from('employees')
        .insert([{
          name,
          email,
          department: department || '',
          job_title: onbRecord?.position || '',
          location: onbRecord?.location || '',
          join_date: onbRecord?.start_date || null,
          auth_user_id: authUserId,
          onboarding_id: employeeId,
          ...auditCreate(c),
        }])
        .select('id')
        .single();
      employeeRowId = newEmp?.id;
    } else {
      await supabase.from('employees').update({ auth_user_id: authUserId, ...auditUpdate(c) }).eq('id', employeeRowId);
    }

    // Upsert app_users — handles both new and pre-provisioned users
    const { data: existingAppUser } = await supabase
      .from('app_users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    let appUserId: string | null = null;
    if (existingAppUser?.id) {
      // Update the existing row to link employee_id and auth_user_id
      await supabase.from('app_users').update({
        employee_id: employeeRowId || null,
        auth_user_id: authUserId,
        roles: assignedRoles,
        primary_role: primaryRole,
        status: 'active',
        onboarding_id: employeeId,
        ...auditUpdate(c),
      }).eq('id', existingAppUser.id);
      appUserId = existingAppUser.id;
    } else {
      const { data: newAppUser } = await supabase
        .from('app_users')
        .insert([{
          email,
          name,
          roles: assignedRoles,
          primary_role: primaryRole,
          department: department || '',
          employee_id: employeeRowId || null,
          status: 'active',
          auth_user_id: authUserId,
          onboarding_id: employeeId,
          ...auditCreate(c),
        }])
        .select('id')
        .single();
      appUserId = newAppUser?.id ?? null;
    }

    // Log audit
    await supabase.from('audit_logs').insert([{
      user_email: email,
      action: 'USER_CREATED_FROM_ONBOARDING',
      details: `User ${name} created from onboarding with roles: ${assignedRoles.join(', ')}`,
    }]);

    return c.json({
      success: true,
      data: {
        email,
        tempPassword,
        userId: authUserId,
        userManagementId: appUserId,
        employeeId: employeeRowId,
        message: autoGenerated ? 'Account automatically created upon onboarding completion' : 'Portal access enabled successfully',
      },
    }, 201);
  } catch (error) {
    console.error('[ONBOARDING] Error enabling portal access:', error);
    return c.json({ success: false, error: `Failed to enable portal access: ${error.message}` }, 500);
  }
});

app.get('/check-account/:email', async (c) => {
  try {
    const supabase = getSupabase();
    const email = c.req.param('email');
    const { data } = await supabase.auth.admin.listUsers();
    const exists = (data?.users || []).some((u: any) => u.email === email);
    return c.json({ success: true, exists, email });
  } catch (error) {
    return c.json({ success: false, error: `Failed to check account: ${error.message}` }, 500);
  }
});

// Sync onboarding records to employees table
app.post('/sync-to-directory', async (c) => {
  try {
    const supabase = getSupabase();
    const { data: records } = await supabase
      .from('onboarding_records')
      .select('*')
      .eq('portal_access_enabled', true);

    let synced = 0, updated = 0;

    for (const rec of (records || [])) {
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .eq('email', rec.email)
        .maybeSingle();

      if (existing) {
        await supabase.from('employees').update({
          name: rec.employee_name,
          phone: rec.phone || '',
          department: rec.department || '',
          job_title: rec.position || '',
          location: rec.location || '',
          join_date: rec.start_date || null,
          auth_user_id: rec.auth_user_id || null,
          ...auditUpdate(c),
        }).eq('id', existing.id);

        await supabase.from('onboarding_records').update({ employee_id: existing.id, ...auditUpdate(c) }).eq('id', rec.id);
        updated++;
      } else {
        const { data: newEmp } = await supabase.from('employees').insert([{
          name: rec.employee_name,
          email: rec.email,
          phone: rec.phone || '',
          department: rec.department || '',
          job_title: rec.position || '',
          location: rec.location || '',
          join_date: rec.start_date || null,
          auth_user_id: rec.auth_user_id || null,
          onboarding_id: rec.id,
          ...auditCreate(c),
        }]).select('id').single();

        if (newEmp) {
          await supabase.from('onboarding_records').update({ employee_id: newEmp.id, ...auditUpdate(c) }).eq('id', rec.id);
        }
        synced++;
      }
    }

    return c.json({ success: true, synced, updated, total: (records || []).length });
  } catch (error) {
    return c.json({ success: false, error: `Failed to sync: ${error.message}` }, 500);
  }
});

// ==================== WORKFLOW TEMPLATES ====================

app.get('/templates', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('onboarding_workflow_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch templates' }, 500);
  }
});

app.post('/templates', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { data, error } = await supabase
      .from('onboarding_workflow_templates')
      .insert([{ name: body.name, department: body.department || '', steps: body.steps || [], ...auditCreate(c) }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create template' }, 500);
  }
});

app.put('/templates/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { data, error } = await supabase
      .from('onboarding_workflow_templates')
      .update({ name: body.name, department: body.department, steps: body.steps, ...auditUpdate(c) })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update template' }, 500);
  }
});

app.delete('/templates/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('onboarding_workflow_templates')
      .delete()
      .eq('id', c.req.param('id'));

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete template' }, 500);
  }
});

// Legacy table init endpoint (no-op now, kept for compatibility)
app.post('/init-table', (c) => c.json({ success: true, message: 'Tables managed via SQL migrations' }));

// ── Signature Requests ────────────────────────────────────────────────────

function isTableMissing(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message ?? error);
  return msg.includes('relation') && msg.includes('does not exist');
}

app.get('/signature-requests', async (c) => {
  const supabase = getSupabase();
  const employeeId = c.req.query('employee_id');
  try {
    let q = supabase.from('onboarding_signature_requests').select('*').order('created_at', { ascending: false });
    if (employeeId) q = q.eq('employee_id', employeeId);
    const { data, error } = await q;
    if (error) { if (isTableMissing(error)) return c.json({ success: true, data: [] }); throw error; }
    return c.json({ success: true, data: data ?? [] });
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.post('/signature-requests', async (c) => {
  const supabase = getSupabase();
  const body = await c.req.json();
  try {
    const { data, error } = await supabase.from('onboarding_signature_requests').insert({
      ...body,
      id: crypto.randomUUID(),
      status: 'Pending',
      created_at: new Date().toISOString(),
      ...auditCreate(c),
    }).select().single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.put('/signature-requests/:id', async (c) => {
  const supabase = getSupabase();
  const { id } = c.req.param();
  const body = await c.req.json();
  try {
    const { data, error } = await supabase.from('onboarding_signature_requests').update({
      ...body,
      updated_at: new Date().toISOString(),
      ...auditUpdate(c),
    }).eq('id', id).select().single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

export default app;
