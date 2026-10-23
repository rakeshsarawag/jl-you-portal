/**
 * User Management API
 * Uses app_users table (FK → employees) instead of KV store
 */

import { Hono } from 'npm:hono';
import { requireFields, requireParam } from "./validate.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { auditCreate, auditUpdate } from "./audit-helpers.ts";
import { invalidateUserRoleCache } from "./role-guard.ts";

const app = new Hono();

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

async function logAudit(supabase: any, userEmail: string, action: string, details: string) {
  await supabase.from('audit_logs').insert([{ user_email: userEmail, action, details }]);
}

// Get all users
app.get('/', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .is('deleted_at', null)
      .order('name');

    if (error) return c.json({ error: error.message }, 500);

    const users = (data || []).map((u: any) => ({
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
      lastLogin: u.last_login,
      createdAt: u.created_at,
    }));

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
        lastLogin: data.last_login,
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
    if (!requestData || (!requestData.email && !requestData.users)) return c.json({ success: false, error: 'Missing required fields: email or users array' }, 400);

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
      .select('id')
      .eq('email', u.email)
      .maybeSingle();

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

    await logAudit(supabase, data.email, 'USER_CREATED', `User ${data.name} created with roles: ${u.roles.join(', ')}`);
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
    const pv = requireParam(c, 'id');
    if (!pv.ok) return pv.response;
    const id = pv.value;
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

    await logAudit(supabase, data.email, 'USER_UPDATED', `User ${data.name} updated`);
    return c.json({ user: data });
  } catch (error) {
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

// Soft-delete a portal account while retaining the employee and business history.
app.delete('/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');

    const { data: existing, error: fetchError } = await supabase
      .from('app_users')
      .select('id, name, email, auth_user_id, employee_id, deleted_at')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) return c.json({ error: fetchError.message }, 500);
    if (!existing) return c.json({ error: 'User not found' }, 404);
    if (existing.deleted_at) return c.json({ error: 'User is already deleted' }, 409);
    if (existing.auth_user_id && existing.auth_user_id === (c as any).get('userId')) {
      return c.json({ error: 'You cannot delete your own account' }, 400);
    }

    const now = new Date();
    const purgeScheduledAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (existing.auth_user_id) {
      const { error: authError } = await supabase.auth.admin.updateUserById(
        existing.auth_user_id,
        { ban_duration: '876000h' },
      );
      if (authError) {
        return c.json({ error: 'Authentication access could not be revoked' }, 500);
      }
    }

    const { error: deleteError } = await supabase
      .from('app_users')
      .update({
        status: 'inactive',
        deleted_at: now.toISOString(),
        purge_scheduled_at: purgeScheduledAt.toISOString(),
        ...auditUpdate(c),
      })
      .eq('id', id);

    if (deleteError) {
      if (existing.auth_user_id) {
        await supabase.auth.admin.updateUserById(
          existing.auth_user_id,
          { ban_duration: 'none' },
        );
      }
      return c.json({ error: deleteError.message }, 500);
    }

    invalidateUserRoleCache(existing.auth_user_id);

    const cleanupTasks = [
      supabase.from('app_user_sessions').update({
        revoked: true,
        revoked_at: now.toISOString(),
      }).eq('user_id', id).eq('revoked', false),
      supabase.from('temporary_access_grants').update({
        is_revoked: true,
        revoked_at: now.toISOString(),
      }).eq('user_id', id).eq('is_revoked', false),
      supabase.from('push_subscriptions').delete().in(
        'user_id',
        [id, existing.auth_user_id, existing.employee_id].filter(Boolean),
      ),
    ];

    if (existing.employee_id) {
      cleanupTasks.push(
        supabase.from('user_push_subscriptions').delete().eq('employee_id', existing.employee_id),
      );
    }
    await Promise.allSettled(cleanupTasks);

    await logAudit(
      supabase,
      existing.email,
      'USER_SOFT_DELETED',
      `User ${existing.name} archived; authentication and active access revoked; purge scheduled for ${purgeScheduledAt.toISOString()}`,
    );
    return c.json({
      success: true,
      message: 'User archived successfully',
      purgeScheduledAt: purgeScheduledAt.toISOString(),
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return c.json({ error: 'Failed to delete user' }, 500);
  }
});

// Restore an archived portal account. Historical grants and sessions stay revoked.
app.post('/:id/restore', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');
    const { data: existing, error: fetchError } = await supabase
      .from('app_users')
      .select('id, name, email, auth_user_id, deleted_at')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) return c.json({ error: fetchError.message }, 500);
    if (!existing) return c.json({ error: 'User not found' }, 404);
    if (!existing.deleted_at) return c.json({ error: 'User is not deleted' }, 409);

    if (existing.auth_user_id) {
      const { error: authError } = await supabase.auth.admin.updateUserById(
        existing.auth_user_id,
        { ban_duration: 'none' },
      );
      if (authError) return c.json({ error: authError.message }, 500);
    }

    const { error: restoreError } = await supabase
      .from('app_users')
      .update({
        status: 'active',
        deleted_at: null,
        purge_scheduled_at: null,
        ...auditUpdate(c),
      })
      .eq('id', id);

    if (restoreError) {
      if (existing.auth_user_id) {
        await supabase.auth.admin.updateUserById(
          existing.auth_user_id,
          { ban_duration: '876000h' },
        );
      }
      return c.json({ error: restoreError.message }, 500);
    }

    invalidateUserRoleCache(existing.auth_user_id);
    await logAudit(
      supabase,
      existing.email,
      'USER_RESTORED',
      `User ${existing.name} restored; previous sessions and temporary grants remain revoked`,
    );
    return c.json({ success: true, message: 'User restored successfully' });
  } catch (error) {
    console.error('Error restoring user:', error);
    return c.json({ error: 'Failed to restore user' }, 500);
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

    await logAudit(supabase, data.email, 'ROLES_ASSIGNED', `User ${data.name} assigned roles: ${roles.join(', ')}`);
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

export default app;
