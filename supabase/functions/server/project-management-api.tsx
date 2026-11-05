import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { auditCreate, auditUpdate, getUserEmail, logAuditFromContext } from "./audit-helpers.ts";
import { notifyByEmail, notifyByEmployeeId } from "./notify-helpers.tsx";
import { requireFields, requireParam } from "./validate.ts";
import { dispatchWorkflowEvent } from "./workflow-api.tsx";

const app = new Hono();

function triggerWorkflowEvent(event: string, entity_type: string, entity_id: string, context: Record<string, unknown>, triggered_by?: string) {
  dispatchWorkflowEvent({ event, entity_type, entity_id, context, triggered_by })
    .catch((error) => console.error(`Workflow event "${event}" failed`, error));
}

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

function validateProjectInput(body: any): string | null {
  if (body.startDate && body.endDate && body.endDate < body.startDate) {
    return 'Project end date must be on or after the start date';
  }
  if (body.budget !== undefined && body.budget !== null && (!Number.isFinite(Number(body.budget)) || Number(body.budget) < 0)) {
    return 'Project budget cannot be negative';
  }
  if (body.sprintLength !== undefined && (!Number.isInteger(Number(body.sprintLength)) || Number(body.sprintLength) < 1 || Number(body.sprintLength) > 30)) {
    return 'Sprint length must be an integer from 1 to 30 days';
  }
  if (Array.isArray(body.members)) {
    const seen = new Set<string>();
    for (const member of body.members) {
      const key = member.employeeId
        ? `id:${String(member.employeeId).toLowerCase()}`
        : `name:${String(member.employeeName ?? member.name ?? '').trim().toLowerCase()}`;
      if (!key.endsWith(':') && seen.has(key)) return 'Duplicate project members are not allowed';
      seen.add(key);
    }
  }
  return null;
}

async function canAccessProject(c: any, projectId: string): Promise<boolean> {
  const role = c.get('role');
  if (role === 'admin' || role === 'hr') return true;
  const employeeId = c.get('employeeId');
  if (!employeeId) return false;
  const supabase = getSupabase();
  const { data: managedProject } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('manager_id', employeeId)
    .maybeSingle();
  if (managedProject) return true;
  const { data: membership } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('employee_id', employeeId)
    .limit(1)
    .maybeSingle();
  return Boolean(membership);
}

async function canManageProject(c: any, projectId: string): Promise<boolean> {
  const role = c.get('role');
  if (role === 'admin' || role === 'hr') return true;
  if (role !== 'manager') return false;
  const employeeId = c.get('employeeId');
  if (!employeeId) return false;
  const supabase = getSupabase();
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('manager_id', employeeId)
    .maybeSingle();
  if (project) return true;
  const { data: membership } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('employee_id', employeeId)
    .in('role', ['Owner', 'Manager', 'Project Manager'])
    .limit(1)
    .maybeSingle();
  return Boolean(membership);
}

async function getRecordProjectId(table: string, id: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from(table)
    .select('project_id')
    .eq('id', id)
    .maybeSingle();
  return data?.project_id ?? null;
}

// The server client uses service_role and therefore bypasses RLS. Resolve the
// parent project for every mutation and enforce project ownership here.
app.use('*', async (c, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
    await next();
    return;
  }

  const marker = '/projects';
  const markerIndex = c.req.path.indexOf(marker);
  const path = markerIndex >= 0 ? c.req.path.slice(markerIndex + marker.length) || '/' : c.req.path;
  if (path === '/time-logs' || path === '/saved-views' || path.startsWith('/saved-views/')) {
    await next();
    return;
  }

  const role = (c as any).get('role');
  if (role === 'admin' || role === 'hr') {
    await next();
    return;
  }
  if (path === '/create' && role === 'manager') {
    await next();
    return;
  }

  let body: any = {};
  if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
    body = await c.req.raw.clone().json().catch(() => ({}));
  }

  let projectId: string | null = null;
  if (path === '/update') projectId = body.id ?? null;
  else if (path === '/milestones' || path === '/sprints' || path === '/backlog' || path === '/tasks/create' || path === '/budget' || path === '/defects' || path === '/risks' || path === '/epics' || path === '/notifications' || path === '/saved-views') {
    projectId = body.projectId ?? body.project_id ?? null;
  } else {
    const entityMatchers: Array<[RegExp, string]> = [
      [/^\/milestones\/([^/]+)$/, 'project_milestones'],
      [/^\/sprints\/([^/]+)(?:\/(?:start|complete))?$/, 'project_sprints'],
      [/^\/sprints\/([^/]+)\/backlog(?:\/[^/]+)?$/, 'project_sprints'],
      [/^\/backlog-items\/([^/]+)$/, 'project_backlog_items'],
      [/^\/backlog\/([^/]+)(?:\/dependencies)?$/, 'project_backlog_items'],
      [/^\/tasks\/([^/]+)(?:\/comments)?$/, 'project_tasks'],
      [/^\/budget\/([^/]+)$/, 'project_budget_line_items'],
      [/^\/defects\/([^/]+)$/, 'project_defects'],
      [/^\/risks\/([^/]+)$/, 'project_risks'],
      [/^\/epics\/([^/]+)$/, 'project_epics'],
      [/^\/saved-views\/([^/]+)$/, 'pm_saved_views'],
    ];
    for (const [pattern, table] of entityMatchers) {
      const match = path.match(pattern);
      if (match) {
        projectId = await getRecordProjectId(table, match[1]);
        break;
      }
    }
  }

  if (!projectId) {
    const projectRoute = path.match(/^\/([^/]+)(?:\/(?:members(?:\/[^/]+)?|rag))?$/);
    if (projectRoute && !['all', 'stats', 'defects'].includes(projectRoute[1])) {
      projectId = projectRoute[1];
    }
  }

  if (!projectId || !await canManageProject(c, projectId)) {
    return c.json({ success: false, error: 'Forbidden: project management access required' }, 403);
  }
  await next();
});

// ==================== MILESTONES ====================

app.get('/milestones', async (c) => {
  const projectId = c.req.query('projectId');
  if (!projectId) return c.json({ success: false, error: 'projectId required' }, 400);
  if (!await canAccessProject(c, projectId)) return c.json({ success: false, error: 'Project not found' }, 404);
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
      milestone_type: body.milestone_type || 'Phase',
      due_date: body.due_date,
      description: body.description || '',
      notes: body.notes || '',
      owner_id: body.owner_id || body.ownerId || null,
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
  if (body.owner_id !== undefined || body.ownerId !== undefined) updates.owner_id = body.owner_id || body.ownerId || null;
  if (body.owner_name !== undefined) updates.owner_name = body.owner_name;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.status === 'Achieved') updates.completion_date = body.completion_date || new Date().toISOString().slice(0, 10);
  else if (body.status !== undefined) updates.completion_date = null;
  const { data, error } = await supabase
    .from('project_milestones')
    .update(updates)
    .eq('id', c.req.param('id'))
    .select()
    .single();
  if (error && isTableMissing(error)) return c.json({ success: true, data: { id: c.req.param('id'), ...body } });
  if (error) return c.json({ success: false, error: error.message }, 500);

  // Stakeholder notification on milestone completion (G-FSD requirement)
  if (body.status === "Achieved" && data) {
    const supabaseNotify = getSupabase();
    const { data: members } = await supabaseNotify
      .from("project_members")
      .select("employee_id, employee_name")
      .eq("project_id", data.project_id);
    if (members?.length) {
      for (const m of members) {
        if (m.employee_id) {
          notifyByEmployeeId(m.employee_id, {
            title: `Milestone Completed: ${data.title}`,
            message: `Milestone "${data.title}" has been marked as completed.`,
            type: "project",
            link: `/project-management`,
          }).catch(() => {});
        }
      }
    }
    logAuditFromContext(c, { entity_type: "milestone", entity_id: data.id, action: "update", module: "projects", metadata: { status: "Achieved", title: data.title } });
  }

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
  if (!await canAccessProject(c, projectId)) return c.json({ success: false, error: 'Project not found' }, 404);
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
  if (body.velocity !== undefined) updates.velocity = body.velocity;
  if (body.capacity_points !== undefined) updates.capacity_points = body.capacity_points;
  if (body.status === 'Completed') updates.completed_at = new Date().toISOString();
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

app.post('/sprints/:id/start', async (c) => {
  const body = await c.req.json();
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('pm_start_sprint', {
    p_sprint_id: c.req.param('id'),
    p_name: body.name,
    p_goal: body.goal,
    p_start_date: body.start_date,
    p_end_date: body.end_date,
  });
  if (error) return c.json({ success: false, error: error.message }, 400);
  return c.json({ success: true, data });
});

app.post('/sprints/:id/complete', async (c) => {
  const body = await c.req.json();
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('pm_complete_sprint', {
    p_sprint_id: c.req.param('id'),
    p_moves: body.moves ?? [],
  });
  if (error) return c.json({ success: false, error: error.message }, 400);
  return c.json({ success: true, data });
});

// Sprint backlog management
app.post('/sprints/:sprintId/backlog', async (c) => {
  const body = await c.req.json();
  const supabase = getSupabase();
  const sprintId = c.req.param('sprintId');
  const { data: result, error } = await supabase.rpc('pm_add_sprint_item', {
    p_sprint_id: sprintId,
    p_backlog_item_id: body.backlogItemId,
    p_order_index: body.orderIndex ?? 0,
  });
  if (error) return c.json({ success: false, error: error.message }, 500);
  const { data, error: reloadError } = await supabase
    .from('project_sprint_backlog')
    .select('*, item:project_backlog_items(*)')
    .eq('id', result.entry.id)
    .single();
  if (reloadError) return c.json({ success: false, error: reloadError.message }, 500);
  return c.json({ success: true, data, committedPoints: result.committed_points }, 201);
});

app.delete('/sprints/:sprintId/backlog/:itemId', async (c) => {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('pm_remove_sprint_item', {
    p_sprint_id: c.req.param('sprintId'),
    p_entry_id: c.req.param('itemId'),
  });
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, committedPoints: data.committed_points });
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
    const role = (c as any).get('role');
    const employeeId = (c as any).get('employeeId');
    let query = supabase
      .from('projects')
      .select('*, project_members(id, employee_id, employee_name, role, joined_at), project_tasks(*)')
      .order('created_at', { ascending: false });
    if (role !== 'admin' && role !== 'hr') {
      if (!employeeId) return c.json({ success: true, data: [] });
      const { data: memberships, error: membershipError } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('employee_id', employeeId);
      if (membershipError) return c.json({ success: false, error: membershipError.message }, 500);
      const projectIds = [...new Set((memberships ?? []).map((member: any) => member.project_id))];
      const filters = [`manager_id.eq.${employeeId}`];
      if (projectIds.length > 0) filters.push(`id.in.(${projectIds.join(',')})`);
      query = query.or(filters.join(','));
    }
    const { data, error } = await query;

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
    if (!body.projectId || !await canAccessProject(c, body.projectId)) {
      return c.json({ success: false, error: 'Forbidden: project access required' }, 403);
    }

    const { data, error } = await supabase.rpc('pm_log_time_atomic', {
      p_project_id: body.projectId || null,
      p_task_id: body.taskId || null,
      p_sprint_id: body.sprintId || null,
      p_employee_name: body.employeeName || '',
      p_log_date: body.logDate || new Date().toISOString().split('T')[0],
      p_hours: body.hours,
      p_log_type: body.logType || 'Development',
      p_billable: body.billable ?? true,
      p_comment: body.comment || '',
      p_created_by: getUserEmail(c),
    });

    if (error) return c.json({ success: false, error: error.message }, 400);

    return c.json({ success: true, data }, 201);
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to log time' }, 500);
  }
});

app.get('/time-logs', async (c) => {
  try {
    const supabase = getSupabase();
    const projectId = c.req.query('projectId');
    const taskId = c.req.query('taskId');
    if (!projectId) return c.json({ success: false, error: 'projectId required' }, 400);
    if (!await canAccessProject(c, projectId)) return c.json({ success: false, error: 'Project not found' }, 404);
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
    const page = Math.max(1, Number(c.req.query('page') ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(c.req.query('pageSize') ?? 50)));
    if (!projectId) return c.json({ success: false, error: 'projectId required' }, 400);
    if (!await canAccessProject(c, projectId)) return c.json({ success: false, error: 'Project not found' }, 404);
    let query = supabase.from('project_defects').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (projectId) query = query.eq('project_id', projectId);
    const from = (page - 1) * pageSize;
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [], pagination: { page, pageSize, total: count ?? 0 } });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch defects' }, 500);
  }
});

app.post('/defects', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const terminalStatuses = ['Resolved', 'Verified', 'Closed'];
    if (!body.projectId || !String(body.title ?? '').trim()) {
      return c.json({ success: false, error: 'projectId and title are required' }, 400);
    }
    if (terminalStatuses.includes(body.status) && (!String(body.resolutionNotes ?? '').trim() || !String(body.rootCause ?? '').trim())) {
      return c.json({ success: false, error: 'Root cause and resolution notes are required for terminal defects' }, 400);
    }
    const { data, error } = await supabase
      .from('project_defects')
      .insert([{
        project_id: body.projectId,
        title: String(body.title).trim(),
        description: body.description ?? '',
        severity: body.severity ?? 'Medium',
        status: body.status ?? 'Open',
        priority: body.priority ?? 'Medium',
        environment: body.environment ?? 'uat',
        assignee_id: body.assigneeId ?? '',
        assignee_name: body.assigneeName ?? '',
        steps_to_reproduce: body.stepsToReproduce ?? [],
        expected_result: body.expectedResult ?? '',
        actual_result: body.actualResult ?? '',
        linked_tickets: body.linkedTickets ?? [],
        found_in_version: body.foundInVersion ?? '',
        sprint_name: body.sprintName ?? '',
        root_cause: body.rootCause ?? '',
        resolution_notes: body.resolutionNotes ?? '',
        ...auditCreate(c),
      }])
      .select()
      .single();
    if (error) return c.json({ success: false, error: error.message }, 500);
    logAuditFromContext(c, { entity_type: 'defect', entity_id: data.id, action: 'create', module: 'projects', metadata: { title: data.title } });
    return c.json({ success: true, data }, 201);
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to create defect' }, 500);
  }
});

app.put('/defects/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const terminalStatuses = ['Resolved', 'Verified', 'Closed'];
    if (!String(body.title ?? '').trim()) return c.json({ success: false, error: 'Title is required' }, 400);
    if (terminalStatuses.includes(body.status) && (!String(body.resolutionNotes ?? '').trim() || !String(body.rootCause ?? '').trim())) {
      return c.json({ success: false, error: 'Root cause and resolution notes are required for terminal defects' }, 400);
    }
    const { data, error } = await supabase
      .from('project_defects')
      .update({
        title: String(body.title).trim(),
        description: body.description ?? '',
        severity: body.severity,
        status: body.status,
        priority: body.priority,
        environment: body.environment,
        assignee_id: body.assigneeId ?? '',
        assignee_name: body.assigneeName ?? '',
        steps_to_reproduce: body.stepsToReproduce ?? [],
        expected_result: body.expectedResult ?? '',
        actual_result: body.actualResult ?? '',
        linked_tickets: body.linkedTickets ?? [],
        found_in_version: body.foundInVersion ?? '',
        sprint_name: body.sprintName ?? '',
        root_cause: body.rootCause ?? '',
        resolution_notes: body.resolutionNotes ?? '',
        ...auditUpdate(c),
      })
      .eq('id', c.req.param('id'))
      .select()
      .single();
    if (error) return c.json({ success: false, error: error.message }, 500);
    logAuditFromContext(c, { entity_type: 'defect', entity_id: data.id, action: 'update', module: 'projects', metadata: { title: data.title, status: data.status } });
    return c.json({ success: true, data });
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to update defect' }, 500);
  }
});

app.delete('/defects/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const defectId = c.req.param('id');
    const { data: attachments, error: attachmentError } = await supabase
      .from('entity_attachments')
      .select('storage_bucket, storage_path')
      .eq('entity_type', 'defect')
      .eq('entity_id', defectId);
    if (attachmentError) return c.json({ success: false, error: attachmentError.message }, 500);

    const storageObjects = (attachments ?? []).map((attachment) => ({
      bucket: attachment.storage_bucket || 'portal-attachments',
      path: attachment.storage_path,
    }));
    const { data: cleanupJob, error: cleanupJobError } = await supabase
      .from('pm_attachment_cleanup_jobs')
      .insert({
        entity_type: 'defect',
        entity_id: defectId,
        storage_objects: storageObjects,
        status: 'pending',
        attempts: 1,
      })
      .select('id')
      .single();
    if (cleanupJobError) return c.json({ success: false, error: cleanupJobError.message }, 500);

    const failCleanup = async (message: string) => {
      await supabase
        .from('pm_attachment_cleanup_jobs')
        .update({ status: 'failed', last_error: message, updated_at: new Date().toISOString() })
        .eq('id', cleanupJob.id);
    };

    const byBucket = new Map<string, string[]>();
    for (const attachment of attachments ?? []) {
      const bucket = attachment.storage_bucket || 'portal-attachments';
      byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), attachment.storage_path]);
    }
    for (const [bucket, paths] of byBucket) {
      const { error } = await supabase.storage.from(bucket).remove(paths);
      if (error) {
        const message = `Attachment cleanup failed: ${error.message}`;
        await failCleanup(message);
        return c.json({ success: false, error: message, retryable: true }, 500);
      }
    }

    const { data, error } = await supabase.rpc('pm_delete_defect_with_attachments', {
      p_defect_id: defectId,
    });
    if (error) {
      await failCleanup(error.message);
      return c.json({ success: false, error: error.message, retryable: true }, 500);
    }
    await supabase
      .from('pm_attachment_cleanup_jobs')
      .update({ status: 'completed', last_error: null, updated_at: new Date().toISOString() })
      .eq('id', cleanupJob.id);
    logAuditFromContext(c, {
      entity_type: 'defect',
      entity_id: defectId,
      action: 'delete',
      module: 'projects',
      metadata: { title: data?.title, attachmentsDeleted: attachments?.length ?? 0 },
    });
    return c.json({ success: true, data });
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to delete defect' }, 500);
  }
});

// ==================== RISKS ====================

app.get('/risks', async (c) => {
  const projectId = c.req.query('projectId');
  if (!projectId) return c.json({ success: false, error: 'projectId required' }, 400);
  if (!await canAccessProject(c, projectId)) return c.json({ success: false, error: 'Project not found' }, 404);
  const { data, error } = await getSupabase().from('project_risks').select('*').eq('project_id', projectId).order('risk_score', { ascending: false });
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data: data ?? [] });
});

app.post('/risks', async (c) => {
  const body = await c.req.json();
  const likelihoodValues: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
  const impactValues: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  if (!String(body.title ?? '').trim()) return c.json({ success: false, error: 'Risk title is required' }, 400);
  const { data, error } = await getSupabase().from('project_risks').insert([{
    project_id: body.projectId,
    title: String(body.title).trim(),
    category: body.category ?? null,
    description: body.description ?? '',
    likelihood: body.likelihood ?? 'Medium',
    likelihood_value: likelihoodValues[body.likelihood] ?? 2,
    impact: body.impact ?? 'Medium',
    impact_value: impactValues[body.impact] ?? 2,
    status: body.status ?? 'Identified',
    owner_id: body.ownerId || null,
    owner_name: body.ownerName ?? '',
    mitigation_plan: body.mitigationPlan ?? '',
    contingency_plan: body.contingencyPlan ?? '',
    due_date: body.dueDate || null,
    resolution_notes: body.resolutionNotes ?? '',
    ...auditCreate(c),
  }]).select().single();
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data }, 201);
});

app.put('/risks/:id', async (c) => {
  const body = await c.req.json();
  const likelihoodValues: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
  const impactValues: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  if (!String(body.title ?? '').trim()) return c.json({ success: false, error: 'Risk title is required' }, 400);
  const { data, error } = await getSupabase().from('project_risks').update({
    title: String(body.title).trim(),
    category: body.category ?? null,
    description: body.description ?? '',
    likelihood: body.likelihood,
    likelihood_value: likelihoodValues[body.likelihood] ?? 2,
    impact: body.impact,
    impact_value: impactValues[body.impact] ?? 2,
    status: body.status,
    owner_id: body.ownerId || null,
    owner_name: body.ownerName ?? '',
    mitigation_plan: body.mitigationPlan ?? '',
    contingency_plan: body.contingencyPlan ?? '',
    due_date: body.dueDate || null,
    resolution_notes: body.resolutionNotes ?? '',
    ...auditUpdate(c),
  }).eq('id', c.req.param('id')).select().single();
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});

app.delete('/risks/:id', async (c) => {
  const { error } = await getSupabase().from('project_risks').delete().eq('id', c.req.param('id'));
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true });
});

// ==================== EPICS ====================

app.get('/epics', async (c) => {
  const projectId = c.req.query('projectId');
  if (!projectId) return c.json({ success: false, error: 'projectId required' }, 400);
  if (!await canAccessProject(c, projectId)) return c.json({ success: false, error: 'Project not found' }, 404);
  const { data, error } = await getSupabase().from('project_epics').select('*').eq('project_id', projectId).order('created_at');
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data: data ?? [] });
});

app.post('/epics', async (c) => {
  const body = await c.req.json();
  if (!String(body.title ?? '').trim()) return c.json({ success: false, error: 'Epic title is required' }, 400);
  const { data, error } = await getSupabase().from('project_epics').insert([{
    project_id: body.projectId,
    title: String(body.title).trim(),
    description: body.description ?? '',
    color: body.color ?? '#6366F1',
    status: body.status ?? 'Not Started',
    start_date: body.startDate || null,
    end_date: body.endDate || null,
    acceptance_criteria: body.acceptanceCriteria ?? '',
    owner_id: body.ownerId || null,
    owner_name: body.ownerName ?? '',
    ...auditCreate(c),
  }]).select().single();
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data }, 201);
});

app.put('/epics/:id', async (c) => {
  const body = await c.req.json();
  if (!String(body.title ?? '').trim()) return c.json({ success: false, error: 'Epic title is required' }, 400);
  const { data, error } = await getSupabase().from('project_epics').update({
    title: String(body.title).trim(),
    description: body.description ?? '',
    color: body.color,
    status: body.status,
    start_date: body.startDate || null,
    end_date: body.endDate || null,
    acceptance_criteria: body.acceptanceCriteria ?? '',
    owner_id: body.ownerId || null,
    owner_name: body.ownerName ?? '',
    ...auditUpdate(c),
  }).eq('id', c.req.param('id')).select().single();
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data });
});

app.delete('/epics/:id', async (c) => {
  const { error } = await getSupabase().from('project_epics').delete().eq('id', c.req.param('id'));
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true });
});

// ==================== PROJECT-SCOPED SUPPORT DATA ====================

app.get('/dependencies', async (c) => {
  const projectId = c.req.query('projectId');
  if (!projectId) return c.json({ success: false, error: 'projectId required' }, 400);
  if (!await canAccessProject(c, projectId)) return c.json({ success: false, error: 'Project not found' }, 404);
  const { data, error } = await getSupabase()
    .from('project_backlog_dependencies')
    .select('source_item_id, target_item_id, dependency_type, source:project_backlog_items!project_backlog_dependencies_source_item_id_fkey(project_id)')
    .eq('source.project_id', projectId);
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data: data ?? [] });
});

app.get('/saved-views', async (c) => {
  const projectId = c.req.query('projectId');
  const screen = c.req.query('screen');
  const actor = getUserEmail(c);
  if (!projectId || !screen) return c.json({ success: false, error: 'projectId and screen required' }, 400);
  if (!await canAccessProject(c, projectId)) return c.json({ success: false, error: 'Project not found' }, 404);
  const { data, error } = await getSupabase().from('pm_saved_views').select('*')
    .eq('project_id', projectId).eq('screen', screen).eq('user_id', actor).order('created_at');
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data: data ?? [] });
});

app.post('/saved-views', async (c) => {
  const body = await c.req.json();
  const actor = getUserEmail(c);
  if (!body.projectId || !body.screen || !String(body.name ?? '').trim()) {
    return c.json({ success: false, error: 'projectId, screen, and name required' }, 400);
  }
  if (!await canAccessProject(c, body.projectId)) return c.json({ success: false, error: 'Project not found' }, 404);
  const { data, error } = await getSupabase().from('pm_saved_views').insert([{
    user_id: actor,
    project_id: body.projectId,
    screen: body.screen,
    name: String(body.name).trim(),
    filters: body.filters ?? {},
    is_shared: false,
  }]).select().single();
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data }, 201);
});

app.delete('/saved-views/:id', async (c) => {
  const actor = getUserEmail(c);
  const { data: view } = await getSupabase().from('pm_saved_views').select('project_id, user_id').eq('id', c.req.param('id')).maybeSingle();
  if (!view || view.user_id !== actor || !await canAccessProject(c, view.project_id)) {
    return c.json({ success: false, error: 'Saved view not found' }, 404);
  }
  const { error } = await getSupabase().from('pm_saved_views').delete().eq('id', c.req.param('id')).eq('user_id', actor);
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true });
});

app.post('/notifications', async (c) => {
  const body = await c.req.json();
  const { data, error } = await getSupabase().from('project_notifications').insert([{
    project_id: body.projectId,
    recipient_id: body.recipientId,
    event_type: body.eventType,
    title: body.title,
    body: body.body ?? '',
    entity_type: body.entityType ?? null,
    entity_id: body.entityId ?? null,
  }]).select().single();
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data }, 201);
});

app.get('/:id/rag-log', async (c) => {
  const projectId = c.req.param('id');
  if (!await canAccessProject(c, projectId)) return c.json({ success: false, error: 'Project not found' }, 404);
  const { data, error } = await getSupabase().from('project_rag_log').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(20);
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data: data ?? [] });
});

app.get('/:id/activity', async (c) => {
  const projectId = c.req.param('id');
  if (!await canAccessProject(c, projectId)) return c.json({ success: false, error: 'Project not found' }, 404);
  const { data, error } = await getSupabase().from('project_activity_log').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(50);
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({ success: true, data: data ?? [] });
});

// ==================== BUDGET LINE ITEMS (must be before /:id wildcard) ====================

app.get('/budget', async (c) => {
  try {
    const supabase = getSupabase();
    const projectId = c.req.query('projectId');
    if (!projectId) return c.json({ success: false, error: 'projectId required' }, 400);
    if (!await canAccessProject(c, projectId)) return c.json({ success: false, error: 'Project not found' }, 404);
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
    const { data: sprint } = await supabase
      .from('project_sprints')
      .select('project_id')
      .eq('id', sprintId)
      .maybeSingle();
    if (!sprint || !await canAccessProject(c, sprint.project_id)) {
      return c.json({ success: false, error: 'Sprint not found' }, 404);
    }
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
    if (!projectId) return c.json({ success: false, error: 'projectId required' }, 400);
    if (!await canAccessProject(c, projectId)) return c.json({ success: false, error: 'Project not found' }, 404);

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
    const validTypes = ['story', 'task', 'bug', 'epic', 'spike', 'research'];
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
        epic_id: body.epicId || null,
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

app.put('/backlog/:itemId/dependencies', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { data, error } = await supabase.rpc('pm_sync_backlog_dependencies', {
      p_item_id: c.req.param('itemId'),
      p_dependencies: body.dependencies ?? [],
      p_actor: getUserEmail(c),
    });
    if (error) return c.json({ success: false, error: error.message }, 400);
    return c.json({ success: true, data });
  } catch (error: unknown) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed to update dependencies' }, 500);
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
    if (!await canAccessProject(c, c.req.param('id'))) {
      return c.json({ success: false, error: 'Project not found' }, 404);
    }
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
    const v = await requireFields(c, ['name']);
    if (!v.ok) return v.response;
    const body = v.body;
    const validationError = validateProjectInput(body);
    if (validationError) return c.json({ success: false, error: validationError }, 400);

    const projectPayload = {
      ...body,
      clientName: body.clientName || body.client || '',
      managerName: body.managerName || body.owner || '',
      ragStatus: body.ragStatus || body.rag_status || 'Green',
    };
    const { data, error } = await supabase.rpc('pm_create_project_with_members', {
      p_project: projectPayload,
      p_members: body.members ?? [],
      p_actor: getUserEmail(c),
    });

    if (error) return c.json({ success: false, error: error.message }, 500);

    // Return project with members so the client can populate team state
    const { data: full, error: reloadError } = await supabase
      .from('projects')
      .select('*, project_members(id, employee_id, employee_name, role, joined_at), project_tasks(*)')
      .eq('id', data.id)
      .single();
    if (reloadError) return c.json({ success: false, error: reloadError.message }, 500);

    triggerWorkflowEvent("project_created", "project", data.id, {
      project_name: data.name,
      manager_id: data.manager_id,
      status: data.status,
    }, data.manager_id);
    logAuditFromContext(c, { entity_type: "project", entity_id: data.id, action: "create", module: "projects", metadata: { name: data.name } });

    return c.json({ success: true, data: full ?? data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create project' }, 500);
  }
});

app.post('/update', async (c) => {
  try {
    const supabase = getSupabase();
    const { id, ...body } = await c.req.json();
    const validationError = validateProjectInput(body);
    if (validationError) return c.json({ success: false, error: validationError }, 400);

    const projectPayload = {
      ...body,
      ...(body.client !== undefined && body.clientName === undefined ? { clientName: body.client } : {}),
      ...(body.owner !== undefined && body.managerName === undefined ? { managerName: body.owner } : {}),
      ...(body.rag_status !== undefined && body.ragStatus === undefined ? { ragStatus: body.rag_status } : {}),
    };
    const { data, error } = await supabase.rpc('pm_update_project_with_members', {
      p_project_id: id,
      p_updates: projectPayload,
      p_members: Array.isArray(body.members) ? body.members : null,
      p_actor: getUserEmail(c),
    });
    if (error) return c.json({ success: false, error: error.message }, 400);

    const { data: fullProject, error: reloadError } = await supabase
      .from('projects')
      .select('*, project_members(id, employee_id, employee_name, role, joined_at), project_tasks(*)')
      .eq('id', id)
      .single();
    if (reloadError) return c.json({ success: false, error: reloadError.message }, 500);
    return c.json({ success: true, data: fullProject ?? data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update project' }, 500);
  }
});

app.put('/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const pv = requireParam(c, 'id');
    if (!pv.ok) return pv.response;
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
    if (!await canAccessProject(c, c.req.param('id'))) {
      return c.json({ success: false, error: 'Project not found' }, 404);
    }
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
    const v = await requireFields(c, ['projectId', 'title']);
    if (!v.ok) return v.response;
    const body = v.body;
    if (!body.title.trim()) return c.json({ success: false, error: 'Task title is required' }, 400);
    if (!body.assigneeId && !String(body.assigneeName ?? '').trim()) {
      return c.json({ success: false, error: 'Task assignee is required' }, 400);
    }
    if (!body.dueDate) return c.json({ success: false, error: 'Task due date is required' }, 400);
    if (body.estimatedHours !== undefined && (Number(body.estimatedHours) <= 0 || Number(body.estimatedHours) > 8)) {
      return c.json({ success: false, error: 'Estimated hours must be greater than 0 and no more than 8' }, 400);
    }
    if (body.startDate && body.dueDate && body.dueDate < body.startDate) {
      return c.json({ success: false, error: 'Task due date must be on or after the start date' }, 400);
    }
    const { data: taskProject } = await supabase.from('projects').select('start_date, end_date').eq('id', body.projectId).maybeSingle();
    if (taskProject?.start_date && body.startDate && body.startDate < taskProject.start_date) {
      return c.json({ success: false, error: 'Task start date cannot be before the project start date' }, 400);
    }
    if (taskProject?.end_date && body.dueDate > taskProject.end_date) {
      return c.json({ success: false, error: 'Task due date cannot be after the project end date' }, 400);
    }

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
    const pv = requireParam(c, 'id');
    if (!pv.ok) return pv.response;
    const body = await c.req.json();

    let actualHours = body.actualHours;
    let currentTask: any = null;
    if (body.additionalHours !== undefined || body.logEntry !== undefined) {
      return c.json({
        success: false,
        error: 'Use POST /time-logs so task hours and the time log are committed atomically',
      }, 400);
    }
    const { data: cur, error: currentTaskError } = await supabase
      .from('project_tasks')
      .select('project_id, title, assignee_id, assignee_name, actual_hours, sprint_id, sprint_change_history, status, started_at, completed_at, closed_at, start_date, due_date, estimated_hours')
      .eq('id', c.req.param('id'))
      .single();
    if (currentTaskError || !cur) return c.json({ success: false, error: 'Task not found' }, 404);
    currentTask = cur;
    const nextTitle = body.title !== undefined ? String(body.title).trim() : currentTask.title;
    const nextStartDate = body.startDate !== undefined ? body.startDate : currentTask.start_date;
    const nextDueDate = body.dueDate !== undefined ? body.dueDate : currentTask.due_date;
    const nextAssigneeId = body.assigneeId !== undefined ? body.assigneeId : currentTask.assignee_id;
    const nextAssigneeName = body.assigneeName !== undefined ? body.assigneeName : currentTask.assignee_name;
    if (!nextTitle) return c.json({ success: false, error: 'Task title is required' }, 400);
    if (!nextAssigneeId && !String(nextAssigneeName ?? '').trim()) return c.json({ success: false, error: 'Task assignee is required' }, 400);
    if (!nextDueDate) return c.json({ success: false, error: 'Task due date is required' }, 400);
    if (body.estimatedHours !== undefined && (!Number.isFinite(Number(body.estimatedHours)) || Number(body.estimatedHours) <= 0 || Number(body.estimatedHours) > 8)) {
      return c.json({ success: false, error: 'Estimated hours must be greater than 0 and no more than 8' }, 400);
    }
    if (nextStartDate && nextDueDate && nextDueDate < nextStartDate) {
      return c.json({ success: false, error: 'Task due date must be on or after the start date' }, 400);
    }
    const { data: taskProject } = await supabase.from('projects').select('start_date, end_date').eq('id', currentTask.project_id).maybeSingle();
    if (taskProject?.start_date && nextStartDate && nextStartDate < taskProject.start_date) {
      return c.json({ success: false, error: 'Task start date cannot be before the project start date' }, 400);
    }
    if (taskProject?.end_date && nextDueDate > taskProject.end_date) {
      return c.json({ success: false, error: 'Task due date cannot be after the project end date' }, 400);
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
    if (
      body.sprintId !== undefined &&
      (body.sprintId || null) !== (currentTask?.sprint_id || null) &&
      body.sprintChangeReason
    ) {
      updates.sprint_change_history = [
        ...(Array.isArray(currentTask?.sprint_change_history) ? currentTask.sprint_change_history : []),
        {
          from: currentTask?.sprint_id || null,
          to: body.sprintId || null,
          reason: body.sprintChangeReason,
          changedAt: new Date().toISOString(),
          changedBy: c.req.header('x-user-email') ?? '',
        },
      ];
    }
    // Set lifecycle timestamps only on transitions and clear stale terminal
    // timestamps when work is reopened.
    const now = new Date().toISOString();
    if (body.status !== undefined && body.status !== currentTask?.status) {
      if (body.status === 'In Progress' && !currentTask?.started_at) updates.started_at = now;
      if (body.status === 'Done') updates.completed_at = now;
      else updates.completed_at = null;
      if (body.status === 'Cancelled') updates.closed_at = now;
      else updates.closed_at = null;
      if (body.status === 'Todo' || body.status === 'To Do') updates.started_at = null;
    }

    const { data, error } = await supabase
      .from('project_tasks')
      .update(updates)
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);

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

// ==================== TASK COMMENTS ====================

app.get('/tasks/:id/comments', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', c.req.param('id'))
      .order('created_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch task comments' }, 500);
  }
});

app.post('/tasks/:id/comments', async (c) => {
  try {
    const supabase = getSupabase();
    const pv = requireParam(c, 'id');
    if (!pv.ok) return pv.response;
    const taskId = pv.value;
    const v = await requireFields(c, ['content']);
    if (!v.ok) return v.response;
    const body = v.body;

    const { data, error } = await supabase
      .from('task_comments')
      .insert([{
        task_id: taskId,
        author_id: body.authorId || null,
        author_name: body.authorName || body.author || '',
        content: body.content.trim(),
        created_by: c.req.header('x-user-email') ?? null,
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to add comment' }, 500);
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
    const projectId = c.req.param('id');
    const { data: current } = await supabase.from('projects').select('rag_status').eq('id', projectId).maybeSingle();
    const { data, error } = await supabase
      .from('projects')
      .update({ rag_status: body.ragStatus, updated_at: new Date().toISOString() })
      .eq('id', projectId)
      .select()
      .single();
    if (error) return c.json({ success: false, error: error.message }, 500);
    if (current?.rag_status !== body.ragStatus) {
      const { error: logError } = await supabase.from('project_rag_log').insert([{
        project_id: projectId,
        old_status: current?.rag_status ?? null,
        new_status: body.ragStatus,
        changed_by: getUserEmail(c),
        changed_by_id: c.get('employeeId') ?? null,
        reason: body.reason ?? '',
      }]);
      if (logError) return c.json({ success: false, error: logError.message }, 500);
    }
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
