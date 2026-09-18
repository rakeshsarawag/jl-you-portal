/**
 * User Management API
 * Uses app_users table (FK → employees) instead of KV store
 */

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

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

async function logAudit(supabase: any, userEmail: string, action: string, details: string) {
  await supabase.from('audit_logs').insert([{ user_email: userEmail, action, details }]);
}

// Get all users
app.get('/', async (c) => {
  try {
    const supabase = getSupabase();

    // Fetch app_users rows and Supabase Auth user list in parallel
    const [{ data, error }, { data: authData }] = await Promise.all([
      supabase.from('app_users').select('*').order('name'),
      supabase.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    if (error) return c.json({ error: error.message }, 500);

    // Build a lookup: auth_user_id → last_sign_in_at
    const authById: Record<string, string> = {};
    const authByEmail: Record<string, string> = {};
    for (const au of authData?.users ?? []) {
      if (au.last_sign_in_at) {
        if (au.id) authById[au.id] = au.last_sign_in_at;
        if (au.email) authByEmail[au.email] = au.last_sign_in_at;
      }
    }

    // Collect updates needed to sync app_users.last_login from auth
    const syncUpdates: { id: string; last_login: string }[] = [];

    const users = (data || []).map((u: any) => {
      // Prefer auth last_sign_in_at; fall back to stored last_login
      const authLastLogin =
        (u.auth_user_id && authById[u.auth_user_id]) ||
        (u.email && authByEmail[u.email]) ||
        null;
      const lastLogin = authLastLogin ?? u.last_login ?? null;

      // Queue a sync if auth has a more recent value than what's stored
      if (authLastLogin && authLastLogin !== u.last_login) {
        syncUpdates.push({ id: u.id, last_login: authLastLogin });
      }

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        roles: u.roles || ['employee'],
        primaryRole: u.primary_role || 'employee',
        department: u.department || '',
        employeeId: u.employee_id,
        status: u.status || 'active',
        authUserId: u.auth_user_id,
        permissionOverrides: u.permission_overrides || [],
        lastLogin,
        createdAt: u.created_at,
      };
    });

    // Fire-and-forget: write auth last_sign_in_at back to app_users.last_login
    if (syncUpdates.length > 0) {
      Promise.allSettled(
        syncUpdates.map(({ id, last_login }) =>
          supabase.from('app_users').update({ last_login }).eq('id', id)
        )
      );
    }

    return c.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// Get user by ID
app.get('/audit/logs', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return c.json({ error: error.message }, 500);
    return c.json({ logs: data || [] });
  } catch (error) {
    return c.json({ error: 'Failed to fetch audit logs' }, 500);
  }
});

app.get('/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return c.json({ error: 'User not found' }, 404);

    // Pull last_sign_in_at from Auth if we have an auth_user_id
    let lastLogin = data.last_login ?? null;
    if (data.auth_user_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(data.auth_user_id);
      if (authUser?.user?.last_sign_in_at) {
        lastLogin = authUser.user.last_sign_in_at;
      }
    }

    return c.json({
      user: {
        id: data.id,
        email: data.email,
        name: data.name,
        roles: data.roles || ['employee'],
        primaryRole: data.primary_role || 'employee',
        department: data.department || '',
        employeeId: data.employee_id,
        status: data.status,
        authUserId: data.auth_user_id,
        permissionOverrides: data.permission_overrides || [],
        lastLogin,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

// Create or batch-update users
app.post('/', async (c) => {
  try {
    const supabase = getSupabase();
    const requestData = await c.req.json();

    // Batch update
    if (requestData.users && Array.isArray(requestData.users)) {
      for (const u of requestData.users) {
        await supabase.from('app_users').upsert({
          id: u.id,
          email: u.email,
          name: u.name,
          roles: u.roles || ['employee'],
          primary_role: u.primaryRole || u.roles?.[0] || 'employee',
          department: u.department || '',
          employee_id: u.employeeId || null,
          status: u.status || 'active',
          auth_user_id: u.authUserId || null,
          permission_overrides: u.permissionOverrides || [],
        }, { onConflict: 'id' });
      }

      await logAudit(supabase, 'system', 'BATCH_UPDATE', `Batch update of ${requestData.users.length} users`);
      return c.json({ success: true, count: requestData.users.length });
    }

    // Single user creation
    const u = requestData;
    if (!u.email || !u.name || !u.roles?.length) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Check for existing email
    const { data: existing } = await supabase
      .from('app_users')
      .select('id, roles, employee_id')
      .eq('email', u.email)
      .maybeSingle();

    // Provision mode: upsert app_users + create/invite Supabase Auth user
    if (u.provision) {
      // Look up employee record to fill name/dept/empId
      const { data: emp } = await supabase.from('employees').select('id, name, department').eq('email', u.email).maybeSingle();
      const empName = u.name || emp?.name || u.email.split('@')[0];
      const empDept = u.department || emp?.department || '';
      const empId = u.employeeId || emp?.id || null;

      // Check if auth user already exists
      const { data: authList } = await supabase.auth.admin.listUsers();
      const existingAuthUser = (authList?.users ?? []).find((au: any) => au.email?.toLowerCase() === u.email.toLowerCase());
      let authUserId: string | null = existingAuthUser?.id ?? null;
      let tempPassword: string | null = null;

      if (!authUserId) {
        const pw = generateTempPassword();
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email: u.email,
          password: pw,
          email_confirm: true,
          user_metadata: { name: empName, roles: u.roles },
        });
        if (createErr) {
          console.error('Auth create error:', createErr.message);
        } else {
          authUserId = created?.user?.id ?? null;
          tempPassword = pw;
        }
      }

      if (existing) {
        // Update existing app_users row — REPLACE roles, never merge
        const { error: updErr } = await supabase.from('app_users').update({
          roles: u.roles,
          primary_role: u.roles[0],
          employee_id: existing.employee_id ?? empId,
          auth_user_id: existing.auth_user_id ?? authUserId,
          status: 'active',
          ...auditUpdate(c),
        }).eq('id', existing.id);
        if (updErr) return c.json({ error: updErr.message }, 500);
        // Sync replaced roles to auth metadata so JWT reflects the change immediately
        if (existing.auth_user_id ?? authUserId) {
          supabase.auth.admin.updateUserById(existing.auth_user_id ?? authUserId!, {
            user_metadata: { roles: u.roles, primaryRole: u.roles[0] },
          }).catch(() => {});
        }
        logAudit(supabase, u.email, 'USER_PROVISIONED', `Re-provisioned with roles: ${u.roles.join(', ')}`).catch(() => {});
        return c.json({ provisioned: false, linked: true, userId: existing.id, tempPassword });
      }

      // Insert new app_users row
      const { data: newUser, error: insErr } = await supabase.from('app_users').insert([{
        email: u.email,
        name: empName,
        roles: u.roles,
        primary_role: u.roles[0],
        department: empDept,
        employee_id: empId,
        auth_user_id: authUserId,
        status: 'active',
        permission_overrides: [],
        ...auditCreate(c),
      }]).select('id').single();
      if (insErr) return c.json({ error: insErr.message }, 500);
      logAudit(supabase, u.email, 'USER_PROVISIONED', `Provisioned ${empName} with roles: ${u.roles.join(', ')}`).catch(() => {});
      return c.json({ provisioned: true, linked: !!empId, userId: newUser.id, tempPassword }, 201);
    }

    if (existing) return c.json({ error: 'User with this email already exists' }, 409);

    const { data, error } = await supabase
      .from('app_users')
      .insert([{
        email: u.email,
        name: u.name,
        roles: u.roles,
        primary_role: u.primaryRole || u.roles[0],
        department: u.department || '',
        employee_id: u.employeeId || null,
        status: u.status || 'active',
        auth_user_id: u.authUserId || null,
        permission_overrides: u.permissionOverrides || [],
        onboarding_id: u.onboardingId || null,
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);

    logAudit(supabase, data.email, 'USER_CREATED', `User ${data.name} created with roles: ${u.roles.join(', ')}`).catch(() => {});
    return c.json({ user: data }, 201);
  } catch (error) {
    console.error('Error creating user:', error);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// Update user
app.put('/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');
    const updates = await c.req.json();

    const { data, error } = await supabase
      .from('app_users')
      .update({
        name: updates.name,
        roles: updates.roles,
        primary_role: updates.primaryRole || updates.roles?.[0],
        department: updates.department,
        employee_id: updates.employeeId || null,
        status: updates.status,
        permission_overrides: updates.permissionOverrides,
        ...auditUpdate(c),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return c.json({ error: 'User not found' }, 404);

    // Sync updated roles + name to Supabase Auth user_metadata so the JWT
    // reflects the latest roles immediately after next login.
    if (data.auth_user_id && updates.roles) {
      supabase.auth.admin.updateUserById(data.auth_user_id, {
        user_metadata: {
          name: data.name,
          roles: data.roles,
          primaryRole: data.primary_role,
          department: data.department,
        },
      }).catch((e: any) => console.error('Auth metadata sync failed:', e?.message));
    }

    logAudit(supabase, data.email, 'USER_UPDATED', `User ${data.name} updated`).catch(() => {});
    return c.json({ user: data });
  } catch (error) {
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

// Delete user
app.delete('/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');

    const { data: existing } = await supabase
      .from('app_users')
      .select('name, email')
      .eq('id', id)
      .single();

    if (!existing) return c.json({ error: 'User not found' }, 404);

    await supabase.from('app_users').delete().eq('id', id);
    await logAudit(supabase, existing.email, 'USER_DELETED', `User ${existing.name} deleted`);
    return c.json({ message: 'User deleted successfully' });
  } catch (error) {
    return c.json({ error: 'Failed to delete user' }, 500);
  }
});

// Assign roles
app.put('/:id/roles', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');
    const { roles, primaryRole } = await c.req.json();

    if (!roles?.length) return c.json({ error: 'Invalid roles data' }, 400);

    const { data, error } = await supabase
      .from('app_users')
      .update({ roles, primary_role: primaryRole || roles[0], ...auditUpdate(c) })
      .eq('id', id)
      .select()
      .single();

    if (error) return c.json({ error: 'User not found' }, 404);

    // Sync to Supabase Auth user_metadata
    if (data.auth_user_id) {
      supabase.auth.admin.updateUserById(data.auth_user_id, {
        user_metadata: { roles: data.roles, primaryRole: data.primary_role },
      }).catch((e: any) => console.error('Auth metadata sync failed:', e?.message));
    }

    logAudit(supabase, data.email, 'ROLES_ASSIGNED', `User ${data.name} assigned roles: ${roles.join(', ')}`).catch(() => {});
    return c.json({ user: data });
  } catch (error) {
    return c.json({ error: 'Failed to assign roles' }, 500);
  }
});

// Toggle status
app.put('/:id/status', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');
    const { status } = await c.req.json();

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }

    const { data, error } = await supabase
      .from('app_users')
      .update({ status, ...auditUpdate(c) })
      .eq('id', id)
      .select()
      .single();

    if (error) return c.json({ error: 'User not found' }, 404);

    await logAudit(supabase, data.email, 'STATUS_CHANGED', `User ${data.name} status changed to ${status}`);
    return c.json({ user: data });
  } catch (error) {
    return c.json({ error: 'Failed to update status' }, 500);
  }
});

// Sync onboarded employees to app_users + employees tables
// Reset password (send recovery email)
app.post('/:id/reset-password', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');
    const { data: user, error: fetchErr } = await supabase
      .from('app_users')
      .select('email, name')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr || !user) return c.json({ error: 'User not found' }, 404);
    const { error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: user.email,
    });
    if (error) return c.json({ error: error.message }, 500);
    await logAudit(supabase, user.email, 'RESET_PASSWORD', `Password reset email sent to ${user.email}`);
    return c.json({ success: true, message: `Password reset email sent to ${user.email}` });
  } catch (err: any) {
    console.error('Error resetting password:', err);
    return c.json({ error: err.message }, 500);
  }
});

app.post('/sync-onboarded', async (c) => {
  try {
    const supabase = getSupabase();

    // Get all app_users linked via onboarding
    const { data: existingUsers } = await supabase
      .from('app_users')
      .select('email, onboarding_id');

    const existingEmails = new Set((existingUsers || []).map((u: any) => u.email.toLowerCase()));

    // Get onboarding records with portal access enabled
    const { data: onboardingRecords } = await supabase
      .from('onboarding_records')
      .select('*')
      .eq('portal_access_enabled', true);

    let synced = 0, skipped = 0;

    for (const emp of (onboardingRecords || [])) {
      if (existingEmails.has(emp.email.toLowerCase())) { skipped++; continue; }

      // Ensure employee row exists
      const { data: empRow } = await supabase
        .from('employees')
        .select('id')
        .eq('email', emp.email)
        .maybeSingle();

      let employeeId = empRow?.id;
      if (!employeeId) {
        const { data: newEmp } = await supabase
          .from('employees')
          .insert([{
            name: emp.employee_name,
            email: emp.email,
            phone: emp.phone || '',
            department: emp.department || '',
            job_title: emp.position || '',
            location: emp.location || '',
            join_date: emp.start_date || null,
            auth_user_id: emp.auth_user_id || null,
            onboarding_id: emp.id,
            ...auditCreate(c),
          }])
          .select('id')
          .single();
        employeeId = newEmp?.id;
      }

      await supabase.from('app_users').insert([{
        email: emp.email,
        name: emp.employee_name,
        roles: ['employee'],
        primary_role: 'employee',
        department: emp.department || '',
        employee_id: employeeId || null,
        status: 'active',
        auth_user_id: emp.auth_user_id || null,
        onboarding_id: emp.id,
        ...auditCreate(c),
      }]);

      synced++;
    }

    await logAudit(supabase, 'system', 'SYNC_ONBOARDED', `Synced ${synced} onboarded employees (${skipped} skipped)`);
    return c.json({ success: true, synced, skipped, total: (onboardingRecords || []).length });
  } catch (error) {
    console.error('Error syncing onboarded employees:', error);
    return c.json({ error: 'Failed to sync onboarded employees' }, 500);
  }
});

// Provision a user account for an existing employee by email
// Creates app_users row if none exists, links to employee record.
// Safe to call multiple times — idempotent.
app.post('/provision', async (c) => {
  try {
    const supabase = getSupabase();
    const { email, roles } = await c.req.json();

    if (!email) return c.json({ error: 'email is required' }, 400);

    const resolvedRoles: string[] = roles?.length ? roles : ['employee'];

    // Look up the employee row
    const { data: emp } = await supabase
      .from('employees')
      .select('id, name, department')
      .eq('email', email)
      .maybeSingle();

    // Check for existing user
    const { data: existing } = await supabase
      .from('app_users')
      .select('id, roles, employee_id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      // Merge roles and ensure employee_id is linked
      const merged = Array.from(new Set([...existing.roles, ...resolvedRoles]));
      await supabase
        .from('app_users')
        .update({
          roles: merged,
          primary_role: merged[0],
          employee_id: existing.employee_id ?? emp?.id ?? null,
          status: 'active',
          ...auditUpdate(c),
        })
        .eq('id', existing.id);

      logAudit(supabase, email, 'USER_PROVISIONED', `Re-provisioned existing user with roles: ${merged.join(', ')}`).catch(() => {});
      return c.json({ provisioned: false, linked: true, userId: existing.id });
    }

    const { data: newUser, error } = await supabase
      .from('app_users')
      .insert([{
        email,
        name: emp?.name || email.split('@')[0],
        roles: resolvedRoles,
        primary_role: resolvedRoles[0],
        department: emp?.department || '',
        employee_id: emp?.id || null,
        status: 'active',
        ...auditCreate(c),
      }])
      .select('id')
      .single();

    if (error) {
      console.error('Error inserting app_users row:', JSON.stringify(error));
      return c.json({ error: error.message }, 500);
    }

    logAudit(supabase, email, 'USER_PROVISIONED', `Provisioned new user with roles: ${resolvedRoles.join(', ')}`).catch(() => {});
    return c.json({ provisioned: true, linked: !!emp, userId: newUser.id }, 201);
  } catch (error: any) {
    console.error('Error provisioning user:', error?.message ?? error);
    return c.json({ error: error?.message ?? 'Failed to provision user' }, 500);
  }
});

export default app;
