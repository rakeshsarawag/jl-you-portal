/**
 * Employee Dashboard API
 * Uses attendance, leaves, leave_balances, employee_tasks tables (FK → employees)
 */

import { Hono } from "npm:hono@4";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { auditCreate, auditUpdate } from "./audit-helpers.ts";
import { notifyManager, notifyUserId } from "./notify-helpers.tsx";

const app = new Hono();

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ==================== ATTENDANCE ====================

app.post("/attendance/check-in", async (c) => {
  try {
    const supabase = getSupabase();
    const { userId, userName } = await c.req.json();
    if (!userId) return c.json({ error: "User ID required" }, 400);

    const today = new Date().toISOString().split('T')[0];

    // Check if already checked in today without checkout
    const { data: existing } = await supabase
      .from('attendance')
      .select('id, check_in, check_out')
      .eq('user_id', userId)
      .eq('attendance_date', today)
      .maybeSingle();

    if (existing && !existing.check_out) {
      return c.json({ error: "Already checked in today" }, 400);
    }

    const now = new Date();
    const { data, error } = await supabase
      .from('attendance')
      .insert([{
        user_id: userId,
        employee_name: userName,
        attendance_date: today,
        check_in: now.toISOString(),
        status: 'Present',
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/attendance/check-out", async (c) => {
  try {
    const supabase = getSupabase();
    const { userId } = await c.req.json();
    if (!userId) return c.json({ error: "User ID required" }, 400);

    const today = new Date().toISOString().split('T')[0];
    const { data: record } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('attendance_date', today)
      .is('check_out', null)
      .maybeSingle();

    if (!record) return c.json({ error: "No active check-in found for today" }, 400);

    const now = new Date();
    const checkIn = new Date(record.check_in);
    const durationMinutes = Math.max(0, Math.round((now.getTime() - checkIn.getTime()) / 60000));

    const { data, error } = await supabase
      .from('attendance')
      .update({ check_out: now.toISOString(), duration_minutes: durationMinutes, ...auditUpdate(c) })
      .eq('id', record.id)
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Static sub-routes must be registered before the parameterised catch-all
app.get("/attendance/today/:userId", async (c) => {
  try {
    const supabase = getSupabase();
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', c.req.param('userId'))
      .eq('attendance_date', today)
      .maybeSingle();

    if (error) return c.json({ error: error.message }, 500);
    return c.json({ data: data ?? null });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

app.get("/attendance/:userId", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', c.req.param('userId'))
      .order('attendance_date', { ascending: false })
      .limit(90);

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data || []);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// ==================== LEAVES ====================

app.post("/leaves/apply", async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const { data, error } = await supabase
      .from('leaves')
      .insert([{
        user_id: body.userId,
        employee_name: body.userName || body.employeeName || '',
        leave_type: body.leaveType || body.type,
        start_date: body.startDate,
        end_date: body.endDate,
        days,
        reason: body.reason || '',
        status: 'Pending',
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);

    // Notify the reporting manager that a leave request is pending approval
    if (data?.user_id) {
      notifyManager(data.user_id, {
        title: "Leave Request Awaiting Approval",
        body: `${data.employee_name || "An employee"} has requested ${data.leave_type} leave (${data.days} day${data.days !== 1 ? "s" : ""}) from ${data.start_date} to ${data.end_date}.`,
        type: "leave",
        link: "/dashboard",
      }).catch(() => {});
    }

    return c.json(data);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/leaves/approve", async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { leaveId } = body;
    const approverName = body.approverName || body.approverId || 'Manager';

    const { data: leave } = await supabase
      .from('leaves')
      .select('*')
      .eq('id', leaveId)
      .single();

    if (!leave) return c.json({ error: "Leave not found" }, 404);

    await supabase
      .from('leaves')
      .update({ status: 'Approved', approver: approverName, approved_date: new Date().toISOString(), ...auditUpdate(c) })
      .eq('id', leaveId);

    // Notify employee their leave was approved (in-app + push)
    notifyUserId(leave.user_id, {
      title: "Leave Request Approved",
      body: `Your ${leave.leave_type} leave (${leave.days} day${leave.days !== 1 ? "s" : ""}) from ${leave.start_date} to ${leave.end_date} has been approved by ${approverName}.`,
      type: "leave",
      link: "/dashboard",
    }).catch(() => {});

    // If LOP/unpaid leave, notify Finance for payroll impact
    const lopTypes = ['LOP', 'Loss of Pay', 'Unpaid', 'Without Pay'];
    if (lopTypes.includes(leave.leave_type)) {
      try {
        const startDate = new Date(leave.start_date);
        const monthYear = startDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        const days = leave.days || 1;
        await supabase.from('notifications').insert({
          user_id: null,
          title: 'LOP Leave Approved — Payroll Impact',
          message: `${leave.employee_name || 'Employee'}'s Loss of Pay leave (${days} days) approved for ${monthYear}. Payroll will be adjusted automatically.`,
          type: 'payroll',
          link: '/payroll',
          ...auditCreate(c),
        });
      } catch {}
    }

    // Deduct from leave balance
    const balanceField = getLeaveBalanceField(leave.leave_type);
    if (balanceField && leave.user_id) {
      const year = new Date(leave.start_date).getFullYear();
      await supabase.rpc('decrement_leave_balance', {
        p_user_id: leave.user_id,
        p_year: year,
        p_used_field: balanceField + '_used',
        p_remaining_field: balanceField + '_remaining',
        p_days: leave.days,
      }).catch(() => {
        // Fallback: manual update
        updateLeaveBalance(supabase, leave.user_id, year, leave.leave_type, leave.days);
      });
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/leaves/reject", async (c) => {
  try {
    const supabase = getSupabase();
    const rb = await c.req.json();
    const { leaveId, reason } = rb;
    const approverName = rb.approverName || rb.approverId || 'Manager';

    const { data: leaveRej } = await supabase
      .from('leaves')
      .update({ status: 'Rejected', approver: approverName, rejection_reason: reason || '', ...auditUpdate(c) })
      .eq('id', leaveId)
      .select()
      .single();

    // Notify employee their leave was rejected
    if (leaveRej?.user_id) {
      notifyUserId(leaveRej.user_id, {
        title: "Leave Request Rejected",
        body: `Your ${leaveRej.leave_type} leave request has been rejected by ${approverName}${reason ? `: ${reason}` : "."}`,
        type: "leave",
        link: "/dashboard",
      }).catch(() => {});
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Resolve the reporting manager name for a given app_user_id
// Chain: app_users.employee_id → employees.manager_id → employees.name
app.get("/manager/:userId", async (c) => {
  try {
    const supabase = getSupabase();
    const userId = c.req.param('userId');

    const { data: appUser } = await supabase
      .from('app_users')
      .select('employee_id')
      .eq('id', userId)
      .maybeSingle();

    if (!appUser?.employee_id) return c.json({ manager_name: null, manager_id: null });

    const { data: emp } = await supabase
      .from('employees')
      .select('manager_id')
      .eq('id', appUser.employee_id)
      .maybeSingle();

    if (!emp?.manager_id) return c.json({ manager_name: null, manager_id: null });

    const { data: mgr } = await supabase
      .from('employees')
      .select('name')
      .eq('id', emp.manager_id)
      .maybeSingle();

    // Also resolve the manager's app_users.id for notification targeting
    const { data: mgrAppUser } = await supabase
      .from('app_users')
      .select('id')
      .eq('employee_id', emp.manager_id)
      .maybeSingle();

    return c.json({
      manager_name: mgr?.name ?? null,
      manager_id: emp.manager_id,
      manager_app_user_id: mgrAppUser?.id ?? null,
    });
  } catch {
    return c.json({ manager_name: null, manager_id: null, manager_app_user_id: null });
  }
});

// Static route must come before parameterised :userId to avoid shadowing
app.get("/leaves/pending", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('leaves')
      .select('*')
      .eq('status', 'Pending')
      .order('created_at', { ascending: false });

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data || []);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

app.get("/leaves/:userId", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('leaves')
      .select('*')
      .eq('user_id', c.req.param('userId'))
      .order('created_at', { ascending: false });

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data || []);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// ==================== LEAVE BALANCE ====================

app.get("/leave-balance/:userId", async (c) => {
  try {
    const supabase = getSupabase();
    const year = new Date().getFullYear();
    const { data, error } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('user_id', c.req.param('userId'))
      .eq('year', year)
      .maybeSingle();

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data || null);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/leave-balance/initialize", async (c) => {
  try {
    const supabase = getSupabase();
    const { userId, userName, userEmail } = await c.req.json();
    const year = new Date().getFullYear();

    const { data, error } = await supabase
      .from('leave_balances')
      .upsert({
        user_id: userId,
        employee_name: userName,
        user_email: userEmail,
        year,
        annual_total: 18, annual_used: 0, annual_remaining: 18,
        sick_total: 12, sick_used: 0, sick_remaining: 12,
        casual_total: 6, casual_used: 0, casual_remaining: 6,
        maternity_total: 180, maternity_used: 0, maternity_remaining: 180,
        paternity_total: 15, paternity_used: 0, paternity_remaining: 15,
      }, { onConflict: 'user_id,year' })
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// ==================== EMPLOYEE TASKS ====================

app.get("/tasks/:userId", async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('employee_tasks')
      .select('*')
      .eq('user_id', c.req.param('userId'))
      .order('created_at', { ascending: false });

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data || []);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/tasks/create", async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('employee_tasks')
      .insert([{
        user_id: body.userId,
        title: body.title,
        description: body.description || '',
        due_date: body.due_date || body.dueDate || null,
        priority: (body.priority || 'medium').toLowerCase(),
        status: (body.status || 'pending').toLowerCase(),
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/tasks/update", async (c) => {
  try {
    const supabase = getSupabase();
    const { id, ...updates } = await c.req.json();

    const { data, error } = await supabase
      .from('employee_tasks')
      .update({
        title: updates.title,
        description: updates.description,
        due_date: updates.due_date || updates.dueDate,
        priority: updates.priority ? updates.priority.toLowerCase() : undefined,
        status: updates.status ? updates.status.toLowerCase() : undefined,
        completed_date: updates.status === 'completed' ? new Date().toISOString() : null,
        ...auditUpdate(c),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/tasks/:id", async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('employee_tasks').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/tasks/toggle-status", async (c) => {
  try {
    const supabase = getSupabase();
    const { id } = await c.req.json();

    const { data: task } = await supabase.from('employee_tasks').select('status').eq('id', id).single();
    if (!task) return c.json({ error: "Task not found" }, 404);

    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const { data, error } = await supabase
      .from('employee_tasks')
      .update({
        status: newStatus,
        completed_date: newStatus === 'completed' ? new Date().toISOString() : null,
        ...auditUpdate(c),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// ==================== LEAVE ENCASHMENT ====================

function isTableMissing(err: any) {
  return err?.code === '42P01' || err?.code === 'PGRST116';
}

app.get('/leave-encashment', async (c) => {
  const supabase = getSupabase();
  const employeeId = c.req.query('employee_id');
  try {
    let q = supabase.from('leave_encashment_requests').select('*').order('created_at', { ascending: false });
    if (employeeId) q = q.eq('employee_id', employeeId);
    const { data, error } = await q;
    if (error) { if (isTableMissing(error)) return c.json({ success: true, data: [] }); throw error; }
    return c.json({ success: true, data: data ?? [] });
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.post('/leave-encashment', async (c) => {
  const supabase = getSupabase();
  const body = await c.req.json();
  try {
    const { data, error } = await supabase.from('leave_encashment_requests').insert({
      ...body, id: crypto.randomUUID(), created_at: new Date().toISOString(), ...auditCreate(c),
    }).select().single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

app.put('/leave-encashment/:id', async (c) => {
  const supabase = getSupabase();
  const { id } = c.req.param();
  const body = await c.req.json();
  try {
    const { data, error } = await supabase.from('leave_encashment_requests')
      .update({ ...body, updated_at: new Date().toISOString(), ...auditUpdate(c) }).eq('id', id).select().single();
    if (error) throw error;
    return c.json({ success: true, data });
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

// ==================== HELPERS ====================

app.post("/leaves/cancel", async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { leaveId, userId, restoreOnly } = body;

    const { data: leave } = await supabase
      .from('leaves')
      .select('*')
      .eq('id', leaveId)
      .single();

    if (!leave) return c.json({ error: "Leave not found" }, 404);

    // Only the owner can cancel their own leave
    if (userId && leave.user_id !== userId) {
      return c.json({ error: "Not authorized to cancel this leave" }, 403);
    }

    // Only Pending leaves can be cancelled
    if (leave.status !== 'Pending') {
      return c.json({ error: `Only pending leaves can be withdrawn` }, 400);
    }

    const wasPending = leave.status === 'Pending';

    // restoreOnly=true means the frontend already updated status via Supabase client
    if (!restoreOnly) {
      await supabase
        .from('leaves')
        .update({ status: 'Cancelled', ...auditUpdate(c) })
        .eq('id', leaveId);
    }

    // Notify the manager that the leave was cancelled
    notifyManager(leave.user_id, {
      title: "Leave Request Cancelled",
      body: `${leave.employee_name || 'An employee'} has cancelled their ${leave.leave_type} leave (${leave.days} day${leave.days !== 1 ? 's' : ''}) from ${leave.start_date} to ${leave.end_date}.`,
      type: "leave",
      link: "/dashboard",
    }).catch(() => {});

    return c.json({ success: true, was_approved: !wasPending });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

function getLeaveBalanceField(leaveType: string): string | null {
  const type = (leaveType || '').toLowerCase();
  if (type.includes('annual') || type.includes('earned') || type.includes('privileged')) return 'annual';
  if (type.includes('sick') || type.includes('medical')) return 'sick';
  if (type.includes('casual')) return 'casual';
  if (type.includes('maternity')) return 'maternity';
  if (type.includes('paternity')) return 'paternity';
  return null;
}

async function updateLeaveBalance(supabase: any, userId: string, year: number, leaveType: string, days: number) {
  const field = getLeaveBalanceField(leaveType);
  if (!field) return;

  const { data } = await supabase
    .from('leave_balances')
    .select(`${field}_used, ${field}_remaining, ${field}_total`)
    .eq('user_id', userId)
    .eq('year', year)
    .maybeSingle();

  if (!data) return;

  const newUsed = (data[`${field}_used`] || 0) + days;
  const newRemaining = Math.max(0, (data[`${field}_total`] || 0) - newUsed);

  await supabase
    .from('leave_balances')
    .update({ [`${field}_used`]: newUsed, [`${field}_remaining`]: newRemaining })
    .eq('user_id', userId)
    .eq('year', year);
}

async function restoreLeaveBalance(supabase: any, userId: string, year: number, leaveType: string, days: number) {
  const field = getLeaveBalanceField(leaveType);
  if (!field) return;

  const { data } = await supabase
    .from('leave_balances')
    .select(`${field}_used, ${field}_remaining, ${field}_total`)
    .eq('user_id', userId)
    .eq('year', year)
    .maybeSingle();

  if (!data) return;

  const newUsed = Math.max(0, (data[`${field}_used`] || 0) - days);
  const newRemaining = Math.min(data[`${field}_total`] || 0, (data[`${field}_remaining`] || 0) + days);

  await supabase
    .from('leave_balances')
    .update({ [`${field}_used`]: newUsed, [`${field}_remaining`]: newRemaining })
    .eq('user_id', userId)
    .eq('year', year);
}

export default app;
