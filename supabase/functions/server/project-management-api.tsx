import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { auditCreate, auditUpdate } from "./audit-helpers.ts";
import { notifyByEmail, notifyByEmployeeId } from "./notify-helpers.tsx";

const app = new Hono();

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

function isTableMissing(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message ?? error);
  return msg.includes('relation') && msg.includes('does not exist');
}

// ==================== MILESTONES ====================

app.get('/milestones', async (c) => {
  const projectId = c.req.query('projectId');
  if (!projectId) return c.json({ success: false, error: 'projectId required' }, 400);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('due_date', { ascending: true });
  if (error && isTableMissing(error)) return c.json({ success: true, data: [] });
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data: data ?? [] });
});

app.post('/milestones', async (c) => {
  const body = await c.req.json();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('project_milestones')
    .insert([{
      project_id: body.projectId ?? body.project_id,
      title: body.title,
      milestone_type: body.milestone_type || 'Delivery',
      due_date: body.due_date,
      description: body.description || '',
      notes: body.notes || '',
      owner_name: body.owner_name || '',
      status: body.status || 'Pending',
      ...auditCreate(c),
    }])
    .select()
    .single();
  if (error && isTableMissing(error)) return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, created_at: new Date().toISOString() } }, 201);
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data }, 201);
});

app.put('/milestones/:id', async (c) => {
  const body = await c.req.json();
  const supabase = getSupabase();
  const updates: any = { ...auditUpdate(c) };
  if (body.title !== undefined) updates.title = body.title;
  if (body.due_date !== undefined) updates.due_date = body.due_date;
  if (body.description !== undefined) updates.description = body.description;
  if (body.status !== undefined) updates.status = body.status;
  if (body.milestone_type !== undefined) updates.milestone_type = body.milestone_type;
  if (body.owner_name !== undefined) updates.owner_name = body.owner_name;
  if (body.notes !== undefined) updates.notes = body.notes;
  const { data, error } = await supabase
    .from('project_milestones')
    .update(updates)
    .eq('id', c.req.param('id'))
    .select()
    .single();
  if (error && isTableMissing(error)) return c.json({ success: true, data: { id: c.req.param('id'), ...body } });
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});

app.delete('/milestones/:id', async (c) => {
  const supabase = getSupabase();
  const { error } = await supabase.from('project_milestones').delete().eq('id', c.req.param('id'));
  if (error && isTableMissing(error)) return c.json({ success: true });
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true });
});

// ==================== SPRINTS ====================

app.get('/sprints', async (c) => {
  const projectId = c.req.query('projectId');
  if (!projectId) return c.json({ success: false, error: 'projectId required' }, 400);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('project_sprints')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error && isTableMissing(error)) return c.json({ success: true, data: [] });
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data: data ?? [] });
});

app.post('/sprints', async (c) => {
  const body = await c.req.json();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('project_sprints')
    .insert([{
      project_id: body.projectId ?? body.project_id,
      name: body.name,
      sprint_number: body.sprint_number ?? null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      goal: body.goal || '',
      status: body.status || 'Planning',
      ...auditCreate(c),
    }])
    .select()
    .single();
  if (error && isTableMissing(error)) return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, created_at: new Date().toISOString() } }, 201);
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data }, 201);
});

app.put('/sprints/:id', async (c) => {
  const body = await c.req.json();
  const supabase = getSupabase();
  const updates: any = { ...auditUpdate(c) };
  if (body.name !== undefined) updates.name = body.name;
  if (body.start_date !== undefined) updates.start_date = body.start_date || null;
  if (body.end_date !== undefined) updates.end_date = body.end_date || null;
  if (body.goal !== undefined) updates.goal = body.goal;
  if (body.status !== undefined) updates.status = body.status;
  if (body.committed_points !== undefined) updates.committed_points = body.committed_points;
  if (body.completed_points !== undefined) updates.completed_points = body.completed_points;
  const { data, error } = await supabase
    .from('project_sprints')
    .update(updates)
    .eq('id', c.req.param('id'))
    .select()
    .single();
  if (error && isTableMissing(error)) return c.json({ success: true, data: { id: c.req.param('id'), ...body } });
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});

// Sprint backlog management
app.post('/sprints/:sprintId/backlog', async (c) => {
  const body = await c.req.json();
  const supabase = getSupabase();
  const sprintId = c.req.param('sprintId');
  const { data, error } = await supabase
    .from('project_sprint_backlog')
    .insert([{ sprint_id: sprintId, backlog_item_id: body.backlogItemId, order_index: body.orderIndex ?? 0 }])
    .select('*, item:project_backlog_items(*)')
    .single();
  if (error && isTableMissing(error)) return c.json({ success: true, data: { id: crypto.randomUUID(), sprint_id: sprintId, backlog_item_id: body.backlogItemId } }, 201);
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data }, 201);
});

app.delete('/sprints/:sprintId/backlog/:itemId', async (c) => {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('project_sprint_backlog')
    .delete()
    .eq('id', c.req.param('itemId'));
  if (error && isTableMissing(error)) return c.json({ success: true });
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true });
});

app.patch('/backlog-items/:id', async (c) => {
  const body = await c.req.json();
  const supabase = getSupabase();
  const updates: any = { updated_at: new Date().toISOString() };
  if (body.sprint_id !== undefined) updates.sprint_id = body.sprint_id;
  if (body.status !== undefined) updates.status = body.status;
  const { data, error } = await supabase
    .from('project_backlog_items')
    .update(updates)
    .eq('id', c.req.param('id'))
    .select()
    .single();
  if (error && isTableMissing(error)) return c.json({ success: true, data: { id: c.req.param('id'), ...body } });
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});

app.patch('/backlog-items', async (c) => {
  // Bulk update
  const body = await c.req.json();
  const supabase = getSupabase();
  const { ids, updates: upd } = body;
  if (!ids?.length) return c.json({ success: true });
  const updates: any = { updated_at: new Date().toISOString() };
  if (upd.sprint_id !== undefined) updates.sprint_id = upd.sprint_id;
  if (upd.status !== undefined) updates.status = upd.status;
  const { error } = await supabase.from('project_backlog_items').update(updates).in('id', ids);
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true });
});

// ==================== PROJECTS ====================

app.get('/all', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('projects')
      .select('*, project_members(id, employee_id, employee_name, role, joined_at), project_tasks(*)')
      .order('created_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch projects' }, 500);
  }
});

// ==================== TIME LOGS (must be before /:id wildcard) ====================

app.post('/time-logs', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('project_time_logs')
      .insert([{
        project_id: body.projectId || null,
        task_id: body.taskId || null,
        sprint_id: body.sprintId || null,
        employee_name: body.employeeName || '',
        log_date: body.logDate || new Date().toISOString().split('T')[0],
        hours: body.hours,
        log_type: body.logType || 'Development',
        billable: body.billable ?? true,
        comment: body.comment || '',
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);

    // Auto-transition task to In Progress if still Todo
    if (body.taskId) {
      const { data: task } = await supabase.from('project_tasks').select('status, started_at').eq('id', body.taskId).single();
      if (task && task.status === 'Todo' && !task.started_at) {
        await supabase.from('project_tasks').update({ status: 'In Progress', started_at: new Date().toISOString() }).eq('id', body.taskId);
      }
    }

    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to log time' }, 500);
  }
});

app.get('/time-logs', async (c) => {
  try {
    const supabase = getSupabase();
    const projectId = c.req.query('projectId');
    const taskId = c.req.query('taskId');
    let query = supabase.from('project_time_logs').select('*').order('log_date', { ascending: false });
    if (projectId) query = query.eq('project_id', projectId);
    if (taskId) query = query.eq('task_id', taskId);
    const { data, error } = await query;
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch time logs' }, 500);
  }
});

// ==================== DEFECTS (must be before /:id wildcard) ====================

app.get('/defects', async (c) => {
  try {
    const supabase = getSupabase();
    const projectId = c.req.query('projectId');
    let query = supabase.from('project_defects').select('*').order('created_at', { ascending: false });
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch defects' }, 500);
  }
});

// ==================== BUDGET LINE ITEMS (must be before /:id wildcard) ====================

app.get('/budget', async (c) => {
  try {
    const supabase = getSupabase();
    const projectId = c.req.query('projectId');
    let query = supabase.from('project_budget_line_items').select('*').order('sort_order', { ascending: true });
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) {
      const msg = String((error as any)?.message ?? error);
      if (msg.includes('relation') && msg.includes('does not exist')) return c.json({ success: true, data: [] });
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch budget items' }, 500);
  }
});

// ==================== SPRINTS BACKLOG (must be before /:id wildcard) ====================

app.get('/sprints/:sprintId/backlog', async (c) => {
  try {
    const supabase = getSupabase();
    const sprintId = c.req.param('sprintId');
    const { data, error } = await supabase
      .from('project_sprint_backlog')
      .select('*, item:project_backlog_items(id, item_id, title, story_points, status, completed_at, priority, type)')
      .eq('sprint_id', sprintId);
    if (error) {
      const msg = String((error as any)?.message ?? error);
      if (msg.includes('relation') && msg.includes('does not exist')) return c.json({ success: true, data: [] });
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch sprint backlog' }, 500);
  }
});

// ==================== BACKLOG ITEMS (must be before /:id wildcard) ====================

app.get('/backlog', async (c) => {
  try {
    const supabase = getSupabase();
    const projectId = c.req.query('projectId');
    const unassigned = c.req.query('unassigned');
    const excludeStatus = c.req.query('excludeStatus');

    let query = supabase.from('project_backlog_items').select('*').order('created_at', { ascending: false });
    if (projectId) query = query.eq('project_id', projectId);
    if (unassigned === 'true') query = query.is('sprint_id', null);
    if (excludeStatus) query = query.neq('status', excludeStatus);

    const { data, error } = await query;
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: [] });
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch backlog items' }, 500);
  }
});

app.post('/backlog', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    async function nextItemId(): Promise<string> {
      const { data: seqData, error: seqErr } = await supabase.rpc('nextval_backlog_item_id');
      if (!seqErr && seqData) return seqData as string;
      const { data } = await supabase
        .from('project_backlog_items')
        .select('item_id')
        .like('item_id', 'BLI-%')
        .order('created_at', { ascending: false })
        .limit(50);
      const nums = (data ?? [])
        .map((r: any) => parseInt((r.item_id as string).replace('BLI-', ''), 10))
        .filter((n: number) => !isNaN(n));
      const max = nums.length ? Math.max(...nums) : 1000;
      return `BLI-${String(max + 1).padStart(4, '0')}`;
    }

    const itemId = await nextItemId();
    const validTypes = ['story', 'task', 'bug', 'epic', 'spike'];
    const rawType = (body.type || 'story').toLowerCase();
    const type = validTypes.includes(rawType) ? rawType : 'story';

    const record: any = {
      project_id: body.projectId,
      item_id: itemId,
      type,
      title: body.title,
      description: body.description || '',
      priority: body.priority || 'Medium',
      status: body.status || 'Backlog',
      story_points: body.storyPoints ?? 0,
      sprint_id: body.sprintId || null,
      assignee_name: body.assigneeName || '',
      acceptance_criteria: body.acceptanceCriteria || [],
      linked_tickets: body.linkedTickets || [],
    };
    if (body.epicId) record.epic_id = body.epicId;

    const { data, error } = await supabase
      .from('project_backlog_items')
      .insert([record])
      .select()
      .single();

    if (error) {
      if (isTableMissing(error)) return c.json({ success: false, error: 'Database table not ready. Please run migration 05_missing_tables.sql in your Supabase SQL Editor.', tableNotReady: true }, 503);
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create backlog item' }, 500);
  }
});

app.put('/backlog/:itemId', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { data, error } = await supabase
      .from('project_backlog_items')
      .update({
        type: body.type,
        title: body.title,
        description: body.description,
        priority: body.priority,
        status: body.status,
        story_points: body.storyPoints,
        sprint_id: body.sprintId || null,
        assignee_name: body.assigneeName,
        acceptance_criteria: body.acceptanceCriteria,
        linked_tickets: body.linkedTickets,
        updated_at: new Date().toISOString(),
      })
      .eq('id', c.req.param('itemId'))
      .select()
      .single();
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update backlog item' }, 500);
  }
});

app.delete('/backlog/:itemId', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('project_backlog_items').delete().eq('id', c.req.param('itemId'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete backlog item' }, 500);
  }
});

app.get('/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('projects')
      .select('*, project_members(employee_id, employee_name, role), project_tasks(*)')
      .eq('id', c.req.param('id'))
      .single();

    if (error || !data) return c.json({ success: false, error: 'Project not found' }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch project' }, 500);
  }
});

app.post('/create', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('projects')
      .insert([{
        name: body.name,
        description: body.description || '',
        category: body.category || '',
        client_id: body.clientId || null,
        client_name: body.clientName || body.client || '',
        manager_id: body.managerId || null,
        manager_name: body.managerName || body.owner || '',
        status: body.status || 'Planning',
        priority: body.priority || 'Medium',
        rag_status: body.ragStatus || body.rag_status || 'Green',
        start_date: body.startDate || null,
        end_date: body.endDate || null,
        budget: body.budget || null,
        tags: body.tags || [],
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);

    // Add initial members if provided
    if (body.members?.length) {
      await supabase.from('project_members').insert(
        body.members.map((m: any) => ({
          project_id: data.id,
          employee_id: m.employeeId || null,
          employee_name: m.name || m.employeeName || '',
          role: m.role || 'Member',
        }))
      );
    }

    // Return project with members so the client can populate team state
    const { data: full } = await supabase
      .from('projects')
      .select('*, project_members(id, employee_id, employee_name, role, joined_at), project_tasks(*)')
      .eq('id', data.id)
      .single();

    return c.json({ success: true, data: full ?? data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create project' }, 500);
  }
});

app.post('/update', async (c) => {
  try {
    const supabase = getSupabase();
    const { id, ...body } = await c.req.json();

    const { data, error } = await supabase
      .from('projects')
      .update({
        name: body.name,
        description: body.description,
        client_name: body.clientName || body.client,
        manager_name: body.managerName || body.owner,
        status: body.status,
        priority: body.priority,
        start_date: body.startDate,
        end_date: body.endDate,
        budget: body.budget,
        progress: body.progress,
        tags: body.tags,
        ...auditUpdate(c),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update project' }, 500);
  }
});

app.put('/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('projects')
      .update({
        name: body.name,
        description: body.description,
        status: body.status,
        priority: body.priority,
        start_date: body.startDate,
        end_date: body.endDate,
        budget: body.budget,
        progress: body.progress,
        ...auditUpdate(c),
      })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update project' }, 500);
  }
});

app.delete('/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('projects').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete project' }, 500);
  }
});

// ==================== PROJECT TASKS ====================

app.get('/:id/tasks', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('project_id', c.req.param('id'))
      .order('created_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch tasks' }, 500);
  }
});

app.post('/tasks/create', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    // Build insert using only guaranteed base-schema columns.
    // Columns added by later ALTER TABLE migrations (task_type, start_date, sprint_id)
    // are included conditionally so the insert works even on older schemas.
    const taskRecord: any = {
      project_id: body.projectId,
      title: body.title,
      description: body.description || '',
      assignee_id: body.assigneeId || null,
      assignee_name: body.assigneeName || body.assignee || '',
      status: (body.status === 'To Do' ? 'Todo' : body.status) || 'Todo',
      priority: body.priority || 'Medium',
      due_date: body.dueDate || null,
      estimated_hours: body.estimatedHours || null,
      tags: body.tags || [],
      ...auditCreate(c),
    };
    // Conditionally include migration-added columns (safe to omit if column missing)
    if (body.taskType) taskRecord.task_type = body.taskType;
    if (body.startDate) taskRecord.start_date = body.startDate;
    if (body.sprintId) taskRecord.sprint_id = body.sprintId;

    const { data, error } = await supabase
      .from('project_tasks')
      .insert([taskRecord])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);

    // Notify the assignee about the new task
    const actorEmail = c.req.header("x-user-email") ?? "";
    if (data?.assignee_id) {
      notifyByEmployeeId(data.assignee_id, {
        title: "Task Assigned to You",
        body: `"${data.title}" has been assigned to you${actorEmail ? ` by ${actorEmail.split("@")[0]}` : ""}.`,
        type: "task",
        link: "/projects",
      }).catch(() => {});
    } else if (body.assigneeEmail) {
      notifyByEmail(body.assigneeEmail, {
        title: "Task Assigned to You",
        body: `"${data?.title ?? body.title}" has been assigned to you.`,
        type: "task",
        link: "/projects",
      }).catch(() => {});
    }

    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create task' }, 500);
  }
});

app.put('/tasks/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    // Fetch current task to accumulate actual_hours if additionalHours given
    let actualHours = body.actualHours;
    if (body.additionalHours) {
      const { data: cur } = await supabase.from('project_tasks').select('actual_hours').eq('id', c.req.param('id')).single();
      actualHours = (Number(cur?.actual_hours ?? 0) + Number(body.additionalHours));
    }

    const updates: Record<string, unknown> = {
      ...auditUpdate(c),
    };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.taskType !== undefined) updates.task_type = body.taskType;
    if (body.assigneeId !== undefined) updates.assignee_id = body.assigneeId || null;
    if (body.assigneeName !== undefined) updates.assignee_name = body.assigneeName || body.assignee;
    if (body.status !== undefined) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.dueDate !== undefined) updates.due_date = body.dueDate;
    if (body.startDate !== undefined) updates.start_date = body.startDate;
    if (body.estimatedHours !== undefined) updates.estimated_hours = body.estimatedHours;
    if (actualHours !== undefined) updates.actual_hours = actualHours;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.sprintId !== undefined) updates.sprint_id = body.sprintId || null;
    if (body.sprintChangeReason !== undefined) updates.sprint_change_reason = body.sprintChangeReason;
    // Audit date tracking
    if (body.startedAt) updates.started_at = body.startedAt;
    if (body.completedAt) updates.completed_at = body.completedAt;
    if (body.closedAt) updates.closed_at = body.closedAt;

    const { data, error } = await supabase
      .from('project_tasks')
      .update(updates)
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);

    // Write time log entry if provided alongside the task update
    if (body.logEntry) {
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('project_time_logs').insert([{
        task_id: c.req.param('id'),
        project_id: body.logEntry.projectId || null,
        hours: body.logEntry.hours,
        log_type: body.logEntry.logType || 'Development',
        comment: body.logEntry.comment || '',
        log_date: body.logEntry.logDate || today,
        billable: body.logEntry.billable ?? true,
        employee_name: body.logEntry.employeeName || '',
        ...auditCreate(c),
      }]);
      // Auto-transition to In Progress if task was still Todo
      if (data?.status === 'Todo') {
        await supabase.from('project_tasks').update({ status: 'In Progress', started_at: new Date().toISOString() }).eq('id', c.req.param('id'));
      }
    }

    // Notify new assignee when the assignee field is being set/changed
    if (body.assigneeId && data?.assignee_id) {
      notifyByEmployeeId(data.assignee_id, {
        title: "Task Assigned to You",
        body: `"${data.title}" has been assigned to you.`,
        type: "task",
        link: "/projects",
      }).catch(() => {});
    } else if (body.assigneeEmail) {
      notifyByEmail(body.assigneeEmail, {
        title: "Task Assigned to You",
        body: `"${data?.title ?? body.title}" has been assigned to you.`,
        type: "task",
        link: "/projects",
      }).catch(() => {});
    }

    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update task' }, 500);
  }
});

app.delete('/tasks/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('project_tasks').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete task' }, 500);
  }
});

// ==================== MEMBERS ====================

app.post('/:id/members', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const projectId = c.req.param('id');

    const { error } = await supabase
      .from('project_members')
      .insert([{
        project_id: projectId,
        employee_id: body.employeeId || null,
        employee_name: body.employeeName || body.name || '',
        role: body.role || 'Member',
        joined_at: new Date().toISOString(),
      }]);

    if (error) return c.json({ success: false, error: error.message }, 500);

    // Return full project with members so hook can update state
    const { data: projectData } = await supabase
      .from('projects')
      .select('*, project_members(id, employee_id, employee_name, role, joined_at), project_tasks(*)')
      .eq('id', projectId)
      .single();

    return c.json({ success: true, data: projectData }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to add member' }, 500);
  }
});

app.delete('/:id/members/:memberId', async (c) => {
  try {
    const supabase = getSupabase();
    const projectId = c.req.param('id');
    const { error } = await supabase.from('project_members').delete().eq('id', c.req.param('memberId'));
    if (error) return c.json({ success: false, error: error.message }, 500);

    const { data: projectData } = await supabase
      .from('projects')
      .select('*, project_members(id, employee_id, employee_name, role, joined_at), project_tasks(*)')
      .eq('id', projectId)
      .single();

    return c.json({ success: true, data: projectData });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to remove member' }, 500);
  }
});

// ==================== RAG STATUS ====================

app.put('/:id/rag', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { data, error } = await supabase
      .from('projects')
      .update({ rag_status: body.ragStatus, updated_at: new Date().toISOString() })
      .eq('id', c.req.param('id'))
      .select()
      .single();
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update RAG status' }, 500);
  }
});

// ==================== STATS ====================

app.get('/stats/all', async (c) => {
  try {
    const supabase = getSupabase();
    const { data: projects } = await supabase.from('projects').select('status, progress');
    const { data: tasks } = await supabase.from('project_tasks').select('status');

    return c.json({
      success: true,
      data: {
        totalProjects: projects?.length || 0,
        activeProjects: projects?.filter((p: any) => p.status === 'Active').length || 0,
        completedProjects: projects?.filter((p: any) => p.status === 'Completed').length || 0,
        totalTasks: tasks?.length || 0,
        completedTasks: tasks?.filter((t: any) => t.status === 'Done').length || 0,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch stats' }, 500);
  }
});

export default app;
