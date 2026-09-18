/**
 * Employee Dashboard Hook
 * Fully wired to relational DB via /employee-dashboard API.
 * Data isolation: employees see only their own data.
 * Managers see pending leaves via loadPendingLeaves().
 * Phase 7: training enrollments + org announcements (silent failures).
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { API_BASE, publicAnonKey, safeJson, apiHeaders, supabase } from '../utils/constants';
import { LEAVE_TYPES, ATTENDANCE_STATUSES, DEFAULT_LEAVE_BALANCES } from '../../constants/apps/leave';

const DASH_URL = `${API_BASE}/employee-dashboard`;

async function api(path: string, options: RequestInit = {}, userEmail?: string) {
  const res = await fetch(`${DASH_URL}${path}`, {
    cache: 'no-store',
    ...options,
    headers: apiHeaders(userEmail),
  });
  const json = await safeJson(res);
  if (!res.ok) throw new Error(json?.error || `API error ${res.status}`);
  return json;
}

async function apiDirect(url: string, userEmail?: string) {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: apiHeaders(userEmail),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return safeJson(res);
}

const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const normTask = (t: any): any => ({
  ...t,
  priority: t.priority ? cap(t.priority) : t.priority,
  status: t.status ? cap(t.status) : t.status,
});

const normLeave = (l: any): any => ({
  ...l,
  status: l.status ? cap(l.status) : l.status,
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AttendanceRecord {
  id: string;
  user_id: string;
  employee_name: string;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  duration_minutes: number | null;
  status: typeof ATTENDANCE_STATUSES[number];
  work_mode?: 'office' | 'wfh';
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  employee_name: string;
  leave_type: typeof LEAVE_TYPES[number];
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  approved_by?: string;
  approver?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'To Do' | 'In Progress' | 'Completed';
  due_date?: string;
  category?: string;
  assigned_by?: string;
  created_at: string;
}

export interface DashboardStats {
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  tasksCompleted: number;
  tasksPending: number;
  hoursThisMonth: number;
}

export interface TrainingEnrollment {
  id: string;
  course_name: string;
  progress: number; // 0–100
  status?: string;
  enrolled_at?: string;
}

export interface Announcement {
  id: string;
  title: string;
  priority: 'High' | 'Medium' | 'Low' | 'Critical' | 'Normal';
  created_at: string;
  content?: string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEmployeeDashboard(userId: string, userName: string, userEmail?: string) {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<Record<string, number>>(DEFAULT_LEAVE_BALANCES);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [trainingEnrollments, setTrainingEnrollments] = useState<TrainingEnrollment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [todayRes, attendanceRes, leavesRes, balanceRes, tasksRes, trainingRes, announcementsRes] = await Promise.allSettled([
        api(`/attendance/today/${userId}`, {}, userEmail),
        api(`/attendance/${userId}`, {}, userEmail),
        api(`/leaves/${userId}`, {}, userEmail),
        api(`/leave-balance/${userId}`, {}, userEmail),
        api(`/tasks/${userId}`, {}, userEmail),
        apiDirect(`${API_BASE}/training?userId=${userId}&limit=3`, userEmail),
        apiDirect(`${API_BASE}/communications/announcements?limit=3`, userEmail),
      ]);

      if (todayRes.status === 'fulfilled') {
        const today: AttendanceRecord | null = todayRes.value?.data ?? null;
        setTodayAttendance(today);
        setIsCheckedIn(!!today && !today.check_out);
      }
      if (attendanceRes.status === 'fulfilled') {
        const v = attendanceRes.value;
        setAttendance(Array.isArray(v) ? v : (v?.data ?? []));
      }
      if (leavesRes.status === 'fulfilled') {
        const v = leavesRes.value;
        const arr = Array.isArray(v) ? v : (v?.data ?? []);
        setLeaves(arr.map(normLeave));
      }
      if (balanceRes.status === 'fulfilled') {
        const v = balanceRes.value;
        const row = (v && typeof v === 'object' && !Array.isArray(v))
          ? (v.annual_remaining !== undefined ? v : v.data)
          : null;
        if (row?.annual_remaining !== undefined) {
          setLeaveBalance({
            'Annual Leave': row.annual_remaining ?? 0,
            'Sick Leave': row.sick_remaining ?? 0,
            'Casual Leave': row.casual_remaining ?? 0,
            ...(row.maternity_remaining != null ? { 'Maternity Leave': row.maternity_remaining } : {}),
            ...(row.paternity_remaining != null ? { 'Paternity Leave': row.paternity_remaining } : {}),
          });
        } else if (v?.balances) {
          setLeaveBalance(v.balances);
        } else {
          // No balance row yet — seed defaults and initialize in background
          setLeaveBalance(DEFAULT_LEAVE_BALANCES);
          if (userId && userName) {
            fetch(`${DASH_URL}/leave-balance/initialize`, {
              method: 'POST',
              headers: { ...apiHeaders(userEmail), 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, userName, userEmail }),
            }).catch(() => {});
          }
        }
      }
      if (tasksRes.status === 'fulfilled') {
        const v = tasksRes.value;
        const arr = Array.isArray(v) ? v : (v?.data ?? []);
        setTasks(arr.map(normTask));
      }
      // Silent failures for optional widgets
      if (trainingRes.status === 'fulfilled') {
        setTrainingEnrollments(trainingRes.value?.data ?? []);
      }
      if (announcementsRes.status === 'fulfilled') {
        setAnnouncements(announcementsRes.value?.data ?? []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Attendance ────────────────────────────────────────────────────────────

  const checkIn = async (workMode: 'office' | 'wfh' = 'office') => {
    try {
      const res = await api('/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({ userId, userName, work_mode: workMode }),
      }, userEmail);
      setTodayAttendance(res.data ?? res);
      setIsCheckedIn(true);
      toast.success('Checked in successfully');
    } catch (err: any) {
      toast.error(err.message ?? 'Check-in failed');
    }
  };

  const checkOut = async () => {
    try {
      const res = await api('/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }, userEmail);
      setTodayAttendance(res.data ?? res);
      setIsCheckedIn(false);
      toast.success('Checked out. Have a great day!');
    } catch (err: any) {
      toast.error(err.message ?? 'Check-out failed');
    }
  };

  // ── Leaves ────────────────────────────────────────────────────────────────

  const applyLeave = async (payload: {
    leaveType: string; startDate: string; endDate: string; reason: string;
  }) => {
    try {
      const result = await api('/leaves/apply', {
        method: 'POST',
        body: JSON.stringify({ userId, employeeName: userName, ...payload }),
      }, userEmail);
      toast.success('Leave applied successfully');
      await loadAll();

      // Send notification to manager — fetch manager's app_users.id then POST to notifications
      const notifyManager = async () => {
        try {
          const mgrRes = await fetch(`${DASH_URL}/manager/${userId}`, {
            headers: apiHeaders(userEmail),
          });
          if (!mgrRes.ok) return;
          const mgrData = await mgrRes.json();
          const targetUserId = mgrData?.manager_app_user_id;
          if (!targetUserId) return;
          await fetch(`${API_BASE}/notifications`, {
            method: 'POST',
            headers: apiHeaders(userEmail),
            body: JSON.stringify({
              userId: targetUserId,
              title: 'Leave Request Awaiting Approval',
              body: `${userName} has requested ${payload.leaveType} leave from ${payload.startDate} to ${payload.endDate}.`,
              type: 'leave',
              link: '/dashboard',
            }),
          });
        } catch {}
      };
      notifyManager().catch(() => {});
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to apply leave');
      throw err;
    }
  };

  // Deducts leave days from leave_balances after approval
  const deductLeaveBalance = async (leave: { user_id?: string | null; employee_id?: string | null; leave_type: string; days?: number; start_date: string; end_date: string }) => {
    const targetUserId = leave.user_id;
    if (!targetUserId) return;
    const days = leave.days ?? Math.max(1, Math.round((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / 86400000) + 1);
    const year = new Date(leave.start_date).getFullYear();
    const { data: bal } = await supabase.from('leave_balances').select('*').eq('user_id', targetUserId).eq('year', year).single();
    if (!bal) return;
    const type = (leave.leave_type ?? '').toLowerCase();
    let update: Record<string, number> = {};
    if (type.includes('annual') || type.includes('privilege') || type.includes('earned')) {
      update = { annual_used: (bal.annual_used ?? 0) + days, annual_remaining: Math.max(0, (bal.annual_remaining ?? 0) - days) };
    } else if (type.includes('sick') || type.includes('medical')) {
      update = { sick_used: (bal.sick_used ?? 0) + days, sick_remaining: Math.max(0, (bal.sick_remaining ?? 0) - days) };
    } else if (type.includes('casual')) {
      update = { casual_used: (bal.casual_used ?? 0) + days, casual_remaining: Math.max(0, (bal.casual_remaining ?? 0) - days) };
    } else if (type.includes('maternity')) {
      update = { maternity_used: (bal.maternity_used ?? 0) + days, maternity_remaining: Math.max(0, (bal.maternity_remaining ?? 0) - days) };
    } else if (type.includes('paternity')) {
      update = { paternity_used: (bal.paternity_used ?? 0) + days, paternity_remaining: Math.max(0, (bal.paternity_remaining ?? 0) - days) };
    } else {
      update = { annual_used: (bal.annual_used ?? 0) + days, annual_remaining: Math.max(0, (bal.annual_remaining ?? 0) - days) };
    }
    void supabase.from('leave_balances').update({ ...update, updated_at: new Date().toISOString() }).eq('user_id', targetUserId).eq('year', year);
  };

  const approveLeave = async (leaveId: string, approverId: string) => {
    try {
      const { data: leave, error: upErr } = await supabase.from('leaves').update({
        status: 'Approved',
        approver: userName || approverId,
        approved_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', leaveId).select().single();
      if (upErr) throw new Error(upErr.message);
      if (leave) {
        await deductLeaveBalance(leave);
        void supabase.from('notifications').insert([{
          user_id: leave.user_id,
          title: 'Leave Approved',
          message: `Your ${leave.leave_type} leave from ${leave.start_date} to ${leave.end_date} has been approved.`,
          type: 'success',
          app_filter: 'dashboard',
        }]);
      }
      toast.success('Leave approved');
      await loadAll();
      await loadPendingLeaves();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to approve leave');
    }
  };

  const rejectLeave = async (leaveId: string, approverId: string) => {
    try {
      const { data: leave, error: upErr } = await supabase.from('leaves').update({
        status: 'Rejected',
        approver: userName || approverId,
        updated_at: new Date().toISOString(),
      }).eq('id', leaveId).select().maybeSingle();
      if (upErr) throw new Error(upErr.message);
      if (leave) {
        void supabase.from('notifications').insert([{
          user_id: leave.user_id,
          title: 'Leave Rejected',
          message: `Your ${leave.leave_type} leave from ${leave.start_date} to ${leave.end_date} has been rejected.`,
          type: 'warning',
          app_filter: 'dashboard',
        }]);
      }
      toast.success('Leave rejected');
      await loadAll();
      await loadPendingLeaves();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to reject leave');
    }
  };

  const approveLeaveWithComment = async (leaveId: string, comment: string) => {
    try {
      const { data: leave, error: upErr } = await supabase.from('leaves').update({
        status: 'Approved',
        approver: userName || userEmail,
        approved_date: new Date().toISOString(),
        rejection_reason: comment || null,
        updated_at: new Date().toISOString(),
      }).eq('id', leaveId).select().maybeSingle();
      if (upErr) throw new Error(upErr.message);
      if (leave) {
        await deductLeaveBalance(leave);
        void supabase.from('notifications').insert([{
          user_id: leave.user_id,
          title: 'Leave Approved',
          message: `Your ${leave.leave_type} leave from ${leave.start_date} to ${leave.end_date} has been approved.${comment ? ' Note: ' + comment : ''}`,
          type: 'success',
          app_filter: 'dashboard',
        }]);
      }
      toast.success('Leave approved');
      await loadAll();
      await loadPendingLeaves();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to approve leave');
      throw err;
    }
  };

  const rejectLeaveWithComment = async (leaveId: string, comment: string) => {
    try {
      const { data: leave, error: upErr } = await supabase.from('leaves').update({
        status: 'Rejected',
        approver: userName || userEmail,
        rejection_reason: comment || null,
        updated_at: new Date().toISOString(),
      }).eq('id', leaveId).select().maybeSingle();
      if (upErr) throw new Error(upErr.message);
      if (leave) {
        void supabase.from('notifications').insert([{
          user_id: leave.user_id,
          title: 'Leave Rejected',
          message: `Your ${leave.leave_type} leave from ${leave.start_date} to ${leave.end_date} has been rejected.${comment ? ' Reason: ' + comment : ''}`,
          type: 'warning',
          app_filter: 'dashboard',
        }]);
      }
      toast.success('Leave rejected');
      await loadAll();
      await loadPendingLeaves();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to reject leave');
      throw err;
    }
  };

  const cancelLeave = async (leaveId: string) => {
    try {
      // Update directly — avoids anon-key RLS blocking the pre-fetch SELECT
      const { data: leave, error: updateErr } = await supabase
        .from('leaves')
        .update({ status: 'Cancelled', updated_at: new Date().toISOString() })
        .eq('id', leaveId)
        .in('status', ['Pending', 'pending'])
        .select()
        .maybeSingle();

      if (updateErr) throw new Error(updateErr.message);
      if (!leave) throw new Error('Leave not found or can only withdraw pending requests');

      toast.success('Leave request withdrawn');
      await loadAll();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to cancel leave');
      throw err;
    }
  };

  const loadPendingLeaves = useCallback(async () => {
    try {
      const res = await api('/leaves/pending', {}, userEmail);
      const arr = Array.isArray(res) ? res : (res?.data ?? []);
      setPendingLeaves(arr.map(normLeave));
    } catch {
      setPendingLeaves([]);
    }
  }, []);

  // ── Tasks ─────────────────────────────────────────────────────────────────

  const createTask = async (payload: Partial<Task>) => {
    try {
      await api('/tasks/create', {
        method: 'POST',
        body: JSON.stringify({ userId, employeeName: userName, ...payload }),
      }, userEmail);
      toast.success('Task created');
      await loadAll();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create task');
      throw err;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      await api('/tasks/update', {
        method: 'POST',
        body: JSON.stringify({ id: taskId, ...updates }),
      }, userEmail);
      await loadAll();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update task');
    }
  };

  const toggleTaskStatus = async (taskId: string) => {
    try {
      await api('/tasks/toggle-status', {
        method: 'POST',
        body: JSON.stringify({ id: taskId }),
      }, userEmail);
      await loadAll();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update task');
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await api(`/tasks/${taskId}`, { method: 'DELETE' }, userEmail);
      toast.success('Task deleted');
      await loadAll();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to delete task');
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const stats: DashboardStats = {
    presentDays: attendance.filter(a => a.status === 'Present').length,
    absentDays: attendance.filter(a => a.status === 'Absent').length,
    leaveDays: attendance.filter(a => a.status === 'On Leave').length,
    tasksCompleted: tasks.filter(t => t.status === 'Completed').length,
    tasksPending: tasks.filter(t => t.status !== 'Completed').length,
    hoursThisMonth: attendance.reduce((sum, a) => sum + (a.duration_minutes ?? 0), 0) / 60,
  };

  const todaysTasks = tasks.filter(t => {
    if (!t.due_date) return false;
    return t.due_date === new Date().toISOString().split('T')[0];
  });

  const upcomingTasks = tasks
    .filter(t => t.status !== 'Completed')
    .sort((a, b) => {
      // Tasks with due dates first, sorted ascending; no due_date goes last
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;
      return (a.due_date ?? '').localeCompare(b.due_date ?? '');
    })
    .slice(0, 5);

  return {
    attendance, todayAttendance, isCheckedIn,
    leaves, pendingLeaves, leaveBalance,
    tasks, todaysTasks, upcomingTasks,
    trainingEnrollments, announcements,
    stats, loading, error,
    checkIn, checkOut,
    applyLeave, cancelLeave, approveLeave, rejectLeave, approveLeaveWithComment, rejectLeaveWithComment, loadPendingLeaves,
    createTask, updateTask, toggleTaskStatus, deleteTask,
    refresh: loadAll,
  };
}
