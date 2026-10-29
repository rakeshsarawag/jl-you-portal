import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { notifyUserId } from './notify-helpers.tsx';

async function sendDefectNotification(supabase: any, opts: {
  defectId: string; defectTitle: string; severity: string;
  recipientIds: string[]; type: string; message: string;
}) {
  const validIds = opts.recipientIds.filter(Boolean);
  if (!validIds.length) return;
  await Promise.all(validIds.map(userId =>
    notifyUserId(userId, {
      title: `Defect ${opts.defectId}: ${opts.severity}`,
      body: opts.message,
      type: opts.type,
    }).catch(() => {})
  ));
}

const app = new Hono();

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

function isMissing(error: unknown): boolean {
  const msg = String((error as any)?.message ?? error);
  return msg.includes('relation') && msg.includes('does not exist') || msg.includes('column') && msg.includes('does not exist');
}

// Compute SLA status for a defect
function computeSLA(defect: any, policies: any[]) {
  const policy = policies.find(p => p.severity === defect.severity);
  if (!policy) return {
    slaStatus: 'on_track', slaFirstResponseRemainingMins: null,
    slaFixRemainingMins: null, slaVerifyRemainingMins: null,
    slaFirstResponseDueAt: null, slaFixDueAt: null, slaVerifyDueAt: null,
    slaFirstResponseMet: false, slaFirstResponseBreached: false,
    slaFixBreached: false, slaVerifyBreached: false, slaPolicyName: '',
  };

  const createdAt = new Date(defect.created_at).getTime();
  const now = Date.now();
  const status = defect.status === 'Fixed' ? 'Resolved' : defect.status;
  const pausedAt = defect.sla_paused_at ? new Date(defect.sla_paused_at).getTime() : null;
  const isPaused = defect.sla_paused || status === 'Awaiting Info';
  const currentPauseMins = isPaused && pausedAt
    ? Math.max(0, Math.round((now - pausedAt) / 60000))
    : 0;
  const totalPauseMins = Math.max(0, Number(defect.sla_total_paused_mins ?? 0)) + currentPauseMins;
  const pauseMs = totalPauseMins * 60000;
  const firstResponseDueAt = new Date(createdAt + policy.first_response_mins * 60000);
  const fixDueAt = new Date(createdAt + policy.fix_mins * 60000 + pauseMs);
  const verifyDueAt = defect.fixed_date
    ? new Date(new Date(defect.fixed_date).getTime() + policy.verification_mins * 60000)
    : null;
  const firstResponseAt = defect.first_response_at ? new Date(defect.first_response_at).getTime() : null;
  const fixedAt = defect.fixed_date ? new Date(defect.fixed_date).getTime() : null;
  const verifiedAt = defect.verified_date ? new Date(defect.verified_date).getTime() : null;
  const firstResponseRemainingMins = Math.round((firstResponseDueAt.getTime() - (firstResponseAt ?? now)) / 60000);
  const fixRemainingMins = Math.round((fixDueAt.getTime() - (fixedAt ?? now)) / 60000);
  const verifyRemainingMins = verifyDueAt ? Math.round((verifyDueAt.getTime() - (verifiedAt ?? now)) / 60000) : null;
  const firstResponseBreached = (firstResponseAt ?? now) > firstResponseDueAt.getTime();
  const fixBreached = (fixedAt ?? now) > fixDueAt.getTime();
  const verifyBreached = verifyDueAt ? (verifiedAt ?? now) > verifyDueAt.getTime() : false;
  const atRiskThreshold = policy.fix_mins * (1 - Math.min(100, Math.max(0, policy.escalate_at_percent ?? 80)) / 100);

  let slaStatus = 'on_track';
  if (isPaused) {
    slaStatus = 'paused';
  } else if (status === 'Verified' || status === 'Closed') {
    slaStatus = 'all_met';
  } else if (status === 'Resolved' && verifyBreached) slaStatus = 'verify_breached';
  else if (!['Resolved','Verified','Closed'].includes(status) && fixBreached) slaStatus = 'fix_breached';
  else if (fixRemainingMins <= atRiskThreshold) slaStatus = 'at_risk';

  return {
    slaStatus,
    slaFirstResponseRemainingMins,
    slaFixRemainingMins: fixRemainingMins,
    slaVerifyRemainingMins: verifyRemainingMins,
    slaFirstResponseDueAt: firstResponseDueAt.toISOString(),
    slaFixDueAt: fixDueAt.toISOString(),
    slaVerifyDueAt: verifyDueAt?.toISOString() ?? null,
    slaFirstResponseMet: firstResponseAt !== null && !firstResponseBreached,
    slaFirstResponseBreached: firstResponseBreached,
    slaFixBreached: fixBreached,
    slaVerifyBreached: verifyBreached,
    slaPolicyName: policy.name,
  };
}

function normalizeDefect(d: any, sla: any = {}) {
  return {
    id: d.id,
    defectId: d.defect_id,
    projectId: d.project_id,
    projectName: d.project_name ?? '',
    title: d.title ?? '',
    severity: d.severity ?? 'Medium',
    priority: d.priority ?? 'P3',
    status: d.status === 'Fixed' ? 'Resolved' : (d.status ?? 'Open'),
    description: d.description ?? '',
    stepsToReproduce: d.steps_to_reproduce ?? [],
    expectedResult: d.expected_result ?? '',
    actualResult: d.actual_result ?? '',
    environment: d.environment ?? '',
    systemName: d.system_name ?? '',
    clientName: d.client_name ?? '',
    externalTicketNo: d.external_ticket_no ?? '',
    transportRequest: d.transport_request ?? '',
    buildVersion: d.build_version ?? '',
    foundInVersion: d.found_in_version ?? '',
    fixVersion: d.fix_version ?? '',
    fixedInVersion: d.fixed_in_version ?? '',
    sprintId: d.sprint_id ?? '',
    sprintName: d.sprint_name ?? '',
    assigneeId: d.assignee_id ?? '',
    assigneeName: d.assignee_name ?? '',
    reporterId: d.reporter_id ?? '',
    reporterName: d.reporter_name ?? '',
    labels: d.labels ?? [],
    isRegression: d.is_regression ?? false,
    isDuplicate: d.is_duplicate ?? false,
    duplicateOfId: d.duplicate_of_id ?? '',
    rootCause: d.root_cause ?? '',
    resolutionCode: d.resolution_code ?? '',
    rejectionReason: d.rejection_reason ?? '',
    fixDescription: d.fix_description ?? '',
    fixedBy: d.fixed_by ?? '',
    fixedDate: d.fixed_date ?? null,
    verifiedBy: d.verified_by ?? '',
    verifiedDate: d.verified_date ?? null,
    testEvidence: d.test_evidence ?? '',
    watchers: d.watchers ?? [],
    slaPaused: d.sla_paused ?? false,
    slaPausedAt: d.sla_paused_at ?? null,
    slaTotalPausedMins: d.sla_total_paused_mins ?? 0,
    firstResponseAt: d.first_response_at ?? null,
    introducedInSprint: d.introduced_in_sprint ?? '',
    os: d.os ?? '',
    browser: d.browser ?? '',
    duplicateCount: d.duplicate_count ?? 0,
    reopenCount: d.reopen_count ?? 0,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    ageInDays: Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000),
    ...sla,
  };
}

// ── GET /defect-tracker/defects ──────────────────────────────────────────────
app.get('/defects', async (c) => {
  try {
    const supabase = getSupabase();
    const q = c.req.query();

    let query = supabase.from('project_defects').select('*').order('created_at', { ascending: false });

    if (q.projectId) query = query.eq('project_id', q.projectId);
    if (q.severity) query = query.in('severity', q.severity.split(','));
    if (q.status) query = query.in('status', q.status.split(','));
    if (q.assigneeId) query = query.eq('assignee_id', q.assigneeId);
    if (q.regression === 'true') query = query.eq('is_regression', true);
    if (q.regression === 'false') query = query.eq('is_regression', false);
    if (q.environment) query = query.eq('environment', q.environment);
    if (q.sprintId) query = query.eq('sprint_id', q.sprintId);
    if (q.dateFrom) query = query.gte('created_at', q.dateFrom);
    if (q.dateTo) query = query.lte('created_at', q.dateTo);

    const { data, error } = await query;
    if (error) {
      if (isMissing(error)) return c.json({ success: true, data: [], total: 0 });
      return c.json({ success: false, error: error.message }, 500);
    }

    const { data: policies } = await supabase.from('defect_sla_policies').select('*');
    const normalized = (data ?? []).map(d => normalizeDefect(d, computeSLA(d, policies ?? [])));

    // Post-filter SLA status
    let result = normalized;
    if (q.slaStatus) {
      const filter = q.slaStatus;
      if (filter === 'breached') result = result.filter(d => d.slaFixBreached || d.slaVerifyBreached);
      else if (filter === 'at_risk') result = result.filter(d => d.slaStatus === 'at_risk');
      else if (filter === 'on_track') result = result.filter(d => d.slaStatus === 'on_track');
    }

    return c.json({ success: true, data: result, total: result.length });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch defects' }, 500);
  }
});

// ── GET /defect-tracker/defects/:id ─────────────────────────────────────────
app.get('/defects/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');

    const [defectRes, commentsRes, activityRes, linksRes, policiesRes] = await Promise.all([
      supabase.from('project_defects').select('*').eq('id', id).single(),
      supabase.from('defect_comments').select('*').eq('defect_id', id).order('created_at'),
      supabase.from('defect_activity_log').select('*').eq('defect_id', id).order('occurred_at', { ascending: false }).limit(50),
      supabase.from('defect_linked_items').select('*').eq('defect_id', id),
      supabase.from('defect_sla_policies').select('*'),
    ]);

    if (defectRes.error) return c.json({ success: false, error: defectRes.error.message }, 404);

    const sla = computeSLA(defectRes.data, policiesRes.data ?? []);
    const defect = normalizeDefect(defectRes.data, sla);

    const comments = (commentsRes.data ?? []).map((c: any) => ({
      id: c.id, authorId: c.author_id, authorName: c.author_name,
      content: c.content, isInternal: c.is_internal, createdAt: c.created_at,
    }));

    const activity = (activityRes.data ?? []).map((a: any) => ({
      id: a.id, actorId: a.actor_id, actorName: a.actor_name, action: a.action,
      fieldChanged: a.field_changed, oldValue: a.old_value, newValue: a.new_value,
      comment: a.comment, occurredAt: a.occurred_at,
    }));

    const links = (linksRes.data ?? []).map((l: any) => ({
      id: l.id, itemType: l.item_type, itemRef: l.item_ref,
      itemTitle: l.item_title, itemStatus: l.item_status,
    }));

    return c.json({ success: true, data: { ...defect, comments, activityLog: activity, linkedItems: links } });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch defect' }, 500);
  }
});

// ── POST /defect-tracker/defects ─────────────────────────────────────────────
app.post('/defects', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase.from('project_defects').insert([{
      project_id: body.projectId,
      project_name: body.projectName ?? '',
      // defect_id assigned by DB trigger (generate_defect_id → DEF-#####)
      title: body.title,
      severity: body.severity ?? 'Medium',
      priority: body.priority ?? 'P3',
      status: 'Open',
      description: body.description ?? '',
      steps_to_reproduce: body.stepsToReproduce ?? [],
      expected_result: body.expectedResult ?? '',
      actual_result: body.actualResult ?? '',
      environment: body.environment ?? '',
      system_name: body.systemName ?? '',
      client_name: body.clientName ?? '',
      external_ticket_no: body.externalTicketNo ?? '',
      transport_request: body.transportRequest ?? '',
      build_version: body.buildVersion ?? '',
      found_in_version: body.foundInVersion ?? '',
      sprint_id: body.sprintId ?? '',
      sprint_name: body.sprintName ?? '',
      assignee_id: body.assigneeId ?? '',
      assignee_name: body.assigneeName ?? '',
      reporter_id: body.reporterId ?? '',
      reporter_name: body.reporterName ?? '',
      labels: body.labels ?? [],
      is_regression: body.isRegression ?? false,
      introduced_in_sprint: body.introducedInSprint ?? '',
      os: body.os ?? '',
      browser: body.browser ?? '',
    }]).select().single();

    if (error) {
      if (isMissing(error)) return c.json({ success: false, error: 'Run migration 06_defect_tracker.sql first', tableNotReady: true }, 503);
      return c.json({ success: false, error: error.message }, 500);
    }

    // Log activity
    await supabase.from('defect_activity_log').insert([{
      defect_id: data.id,
      actor_id: body.reporterId ?? '',
      actor_name: body.reporterName ?? 'System',
      action: 'created',
      new_value: 'Open',
    }]).catch(() => {});

    // Creation and assignment notifications are emitted by the database
    // workflow trigger for every write path.

    const { data: policies } = await supabase.from('defect_sla_policies').select('*');
    return c.json({ success: true, data: normalizeDefect(data, computeSLA(data, policies ?? [])) }, 201);
  } catch (err) {
    return c.json({ success: false, error: 'Failed to create defect' }, 500);
  }
});

// ── PUT /defect-tracker/defects/:id ─────────────────────────────────────────
app.put('/defects/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const id = c.req.param('id');
    const body = await c.req.json();

    const updates: any = { updated_at: new Date().toISOString() };

    const fieldMap: Record<string, string> = {
      title: 'title', severity: 'severity', priority: 'priority', status: 'status',
      description: 'description', stepsToReproduce: 'steps_to_reproduce',
      expectedResult: 'expected_result', actualResult: 'actual_result',
      environment: 'environment', buildVersion: 'build_version',
      systemName: 'system_name', clientName: 'client_name',
      externalTicketNo: 'external_ticket_no', transportRequest: 'transport_request',
      foundInVersion: 'found_in_version', fixVersion: 'fix_version',
      fixedInVersion: 'fixed_in_version', sprintId: 'sprint_id', sprintName: 'sprint_name',
      assigneeId: 'assignee_id', assigneeName: 'assignee_name',
      labels: 'labels', isRegression: 'is_regression', isDuplicate: 'is_duplicate',
      duplicateOfId: 'duplicate_of_id', rootCause: 'root_cause',
      resolutionCode: 'resolution_code', rejectionReason: 'rejection_reason',
      fixDescription: 'fix_description', fixedBy: 'fixed_by',
      verifiedBy: 'verified_by', testEvidence: 'test_evidence',
      watchers: 'watchers', slaPaused: 'sla_paused', slaPauseReason: 'sla_pause_reason',
      os: 'os', browser: 'browser', introducedInSprint: 'introduced_in_sprint',
      projectName: 'project_name',
    };

    for (const [k, v] of Object.entries(fieldMap)) {
      if (body[k] !== undefined) updates[v] = body[k];
    }

    // Handle status-specific timestamp fields
    if (body.status === 'Resolved' && !body.fixedDate) updates.fixed_date = new Date().toISOString();
    if (body.fixedDate) updates.fixed_date = body.fixedDate;
    if (body.status === 'Verified' && !body.verifiedDate) updates.verified_date = new Date().toISOString();
    if (body.status === 'Closed') updates.updated_by = body.actorName ?? body.actorId ?? 'System';

    // First response tracking
    if (body.firstResponse) updates.first_response_at = new Date().toISOString();

    // Reopen regression
    if (body.status === 'Open' && body._wasClosedBefore) {
      updates.is_regression = true;
      updates.reopen_count = (body._reopenCount ?? 0) + 1;
    }

    // Fetch existing defect for notification context
    const { data: existing } = await supabase.from('project_defects').select('defect_id, title, severity, reporter_id, assignee_id, watchers, status, root_cause, resolution_code').eq('id', id).single().catch(() => ({ data: null }));
    if (existing?.status === 'Closed' && body.status && body.status !== 'Closed') {
      return c.json({ success: false, error: 'Closed defects cannot be reopened' }, 409);
    }
    if (body.status === 'Resolved' && !(body.rootCause ?? existing?.root_cause)?.trim()) {
      return c.json({ success: false, error: 'Root Cause is required before resolving a defect' }, 400);
    }
    if (body.status === 'Resolved' && !(body.resolutionCode ?? existing?.resolution_code)?.trim()) {
      return c.json({ success: false, error: 'Resolution Code is required before resolving a defect' }, 400);
    }

    const { data, error } = await supabase.from('project_defects').update(updates).eq('id', id).select().single();
    if (error) return c.json({ success: false, error: error.message }, 500);

    // SLA pause/resume events
    if (body.slaPaused !== undefined) {
      const eventType = body.slaPaused ? 'paused' : 'resumed';
      await supabase.from('defect_sla_events').insert({
        defect_id: id,
        event_type: eventType,
        actor_id: body.actorId ?? null,
        occurred_at: new Date().toISOString(),
        notes: body.slaPauseReason ?? null,
      }).catch(() => {});
    }

    // Lifecycle notifications are emitted by the database workflow trigger so
    // API, UI, scheduled, and administrative updates cannot diverge.

    // Log activity
    if (body.actorId || body.actorName) {
      const logEntries: any[] = [];
      if (body.status) {
        logEntries.push({
          defect_id: id, actor_id: body.actorId ?? '', actor_name: body.actorName ?? 'System',
          action: 'status_changed', field_changed: 'status',
          old_value: body._oldStatus ?? '', new_value: body.status,
        });
      }
      if (body.assigneeName) {
        logEntries.push({
          defect_id: id, actor_id: body.actorId ?? '', actor_name: body.actorName ?? 'System',
          action: 'assigned', field_changed: 'assignee',
          old_value: body._oldAssignee ?? '', new_value: body.assigneeName,
        });
      }
      if (body.severity) {
        logEntries.push({
          defect_id: id, actor_id: body.actorId ?? '', actor_name: body.actorName ?? 'System',
          action: 'severity_changed', field_changed: 'severity',
          old_value: body._oldSeverity ?? '', new_value: body.severity,
        });
      }
      if (body._comment) {
        logEntries.push({
          defect_id: id, actor_id: body.actorId ?? '', actor_name: body.actorName ?? 'System',
          action: 'commented', comment: body._comment,
        });
      }
      if (logEntries.length) await supabase.from('defect_activity_log').insert(logEntries).catch(() => {});
    }

    const { data: policies } = await supabase.from('defect_sla_policies').select('*');
    return c.json({ success: true, data: normalizeDefect(data, computeSLA(data, policies ?? [])) });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to update defect' }, 500);
  }
});

// ── DELETE /defect-tracker/defects/:id ───────────────────────────────────────
app.delete('/defects/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('project_defects').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to delete defect' }, 500);
  }
});

// ── POST /defect-tracker/defects/:id/comments ────────────────────────────────
app.post('/defects/:id/comments', async (c) => {
  try {
    const supabase = getSupabase();
    const defectId = c.req.param('id');
    const body = await c.req.json();

    const { data, error } = await supabase.from('defect_comments').insert([{
      defect_id: defectId,
      author_id: body.authorId ?? '',
      author_name: body.authorName ?? '',
      content: body.content,
      is_internal: body.isInternal ?? false,
    }]).select().single();

    if (error) {
      if (isMissing(error)) return c.json({ success: false, error: 'Run migration first', tableNotReady: true }, 503);
      return c.json({ success: false, error: error.message }, 500);
    }

    const { data: defectContext } = await supabase.from('project_defects')
      .select('defect_id, title, severity, watchers, reporter_id')
      .eq('id', defectId).single().catch(() => ({ data: null }));

    // A reporter comment is not the support team's first response.
    const firstResponseUpdate = defectContext
      && body.authorId
      && body.authorId !== defectContext.reporter_id
      ? supabase.from('project_defects').update({ first_response_at: new Date().toISOString() })
          .eq('id', defectId).is('first_response_at', null)
      : Promise.resolve();
    await Promise.all([
      supabase.from('defect_activity_log').insert([{
        defect_id: defectId, actor_id: body.authorId ?? '', actor_name: body.authorName ?? '',
        action: 'commented', comment: body.content.slice(0, 100),
      }]),
      firstResponseUpdate,
    ]).catch(() => {});

    // @mentions
    const mentions = (body.content ?? '').match(/@(\w+)/g) ?? [];
    if (mentions.length > 0) {
      console.log(`Comment on defect ${defectId} contains mentions:`, mentions);
    }

    // Notify watchers
    const existing = defectContext;
    if (existing && (existing.watchers ?? []).length > 0) {
      await sendDefectNotification(supabase, {
        defectId: existing.defect_id ?? defectId,
        defectTitle: existing.title ?? '',
        severity: existing.severity ?? 'Medium',
        recipientIds: existing.watchers ?? [],
        type: 'comment_added',
        message: `New comment on defect ${existing.defect_id ?? defectId}: "${(body.content ?? '').slice(0, 60)}"`,
      });
    }

    return c.json({ success: true, data: {
      id: data.id, authorId: data.author_id, authorName: data.author_name,
      content: data.content, isInternal: data.is_internal, createdAt: data.created_at,
    }}, 201);
  } catch (err) {
    return c.json({ success: false, error: 'Failed to add comment' }, 500);
  }
});

// ── POST /defect-tracker/defects/:id/links ────────────────────────────────────
app.post('/defects/:id/links', async (c) => {
  try {
    const supabase = getSupabase();
    const defectId = c.req.param('id');
    const body = await c.req.json();

    const { data, error } = await supabase.from('defect_linked_items').insert([{
      defect_id: defectId,
      item_type: body.itemType,
      item_ref: body.itemRef,
      item_title: body.itemTitle ?? '',
      item_status: body.itemStatus ?? '',
    }]).select().single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to add link' }, 500);
  }
});

// ── DELETE /defect-tracker/defects/:defectId/links/:linkId ───────────────────
app.delete('/defects/:defectId/links/:linkId', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('defect_linked_items').delete().eq('id', c.req.param('linkId'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to remove link' }, 500);
  }
});

// ── GET /defect-tracker/dashboard ────────────────────────────────────────────
app.get('/dashboard', async (c) => {
  try {
    const supabase = getSupabase();

    const [allRes, policiesRes] = await Promise.all([
      supabase.from('project_defects').select('*'),
      supabase.from('defect_sla_policies').select('*'),
    ]);

    if (allRes.error && isMissing(allRes.error)) {
      return c.json({ success: true, data: {
        totalOpen: 0, s1Count: 0, slaBreached: 0, fixedToday: 0, pendingVerify: 0,
        s1Defects: [], recentActivity: [], severityBreakdown: [], projectBreakdown: [], slaCompliance: [], trendData: [],
      }});
    }

    const all = (allRes.data ?? []);
    const policies = policiesRes.data ?? [];

    const withSLA = all
      .filter(d => !['Closed','Verified',"Won't Fix",'Duplicate'].includes(d.status))
      .map(d => ({ ...d, ...computeSLA(d, policies) }));
    const s1 = withSLA.filter(d => d.severity === 'Very High');
    const breached = withSLA.filter(d => d.slaFixBreached || d.slaVerifyBreached);

    // Fixed today
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const { count: fixedToday } = await supabase.from('project_defects')
      .select('id', { count: 'exact', head: true })
      .gte('fixed_date', todayStart.toISOString());

    const pendingVerify = withSLA.filter(d => d.status === 'Resolved').length;

    // Week-over-week delta
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const openLastWeek = all.filter(d =>
      !['Closed','Verified',"Won't Fix",'Duplicate'].includes(d.status)
      && d.created_at <= oneWeekAgo
    ).length;

    // Severity breakdown
    const severityBreakdown = ['Very High','High','Medium','Low'].map(sev => ({
      severity: sev,
      count: withSLA.filter(d => d.severity === sev).length,
    }));

    // Project breakdown
    const projectMap: Record<string, Record<string, number>> = {};
    for (const d of withSLA) {
      const pName = d.project_name || d.project_id || 'Unknown';
      if (!projectMap[pName]) projectMap[pName] = { 'Very High': 0, 'High': 0, 'Medium': 0, 'Low': 0 };
      projectMap[pName][d.severity] = (projectMap[pName][d.severity] ?? 0) + 1;
    }
    const projectBreakdown = Object.entries(projectMap).map(([name, counts]) => ({ name, ...counts }));

    // SLA compliance by severity
    const slaCompliance = ['Very High','High','Medium','Low'].map(sev => {
      const sevDefects = withSLA.filter(d => d.severity === sev);
      const total = sevDefects.length;
      const fixMet = sevDefects.filter(d => !d.slaFixBreached).length;
      const verifyMet = sevDefects.filter(d => !d.slaVerifyBreached).length;
      const responseMet = sevDefects.filter(d => d.first_response_at).length;
      return {
        severity: sev,
        firstResponse: total ? Math.round(responseMet / total * 100) : 100,
        fix: total ? Math.round(fixMet / total * 100) : 100,
        verify: total ? Math.round(verifyMet / total * 100) : 100,
      };
    });

    // Recent activity (last 10)
    const { data: activityData } = await supabase.from('defect_activity_log')
      .select('*, project_defects(defect_id, title, project_name)')
      .order('occurred_at', { ascending: false }).limit(10).catch(() => ({ data: [] }));

    const recentActivity = (activityData ?? []).map((a: any) => ({
      id: a.id, actorName: a.actor_name, action: a.action,
      defectId: a.project_defects?.defect_id ?? '',
      defectTitle: a.project_defects?.title ?? '',
      projectName: a.project_defects?.project_name ?? '',
      occurredAt: a.occurred_at,
    }));

    // 30-day trend (simplified: generate from created_at)
    const trendDays: Record<string, { opened: number; closed: number }> = {};
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const { data: trendDefects } = await supabase.from('project_defects')
      .select('created_at, status, fixed_date')
      .gte('created_at', new Date(thirtyDaysAgo).toISOString());

    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      trendDays[key] = { opened: 0, closed: 0 };
    }
    for (const d of trendDefects ?? []) {
      const key = d.created_at?.slice(0, 10);
      if (key && trendDays[key]) trendDays[key].opened++;
      if (d.fixed_date) {
        const fKey = d.fixed_date?.slice(0, 10);
        if (fKey && trendDays[fKey]) trendDays[fKey].closed++;
      }
    }
    const trendData = Object.entries(trendDays).map(([date, v]) => ({ date, ...v }));

    const totalOpen = withSLA.filter(d => !['Closed','Verified'].includes(d.status)).length;
    return c.json({ success: true, data: {
      totalOpen,
      openDelta: totalOpen - openLastWeek,
      s1Count: s1.length,
      slaBreached: breached.length,
      fixedToday: fixedToday ?? 0,
      pendingVerify,
      s1Defects: s1.map(d => normalizeDefect(d, computeSLA(d, policies))).slice(0, 10),
      recentActivity,
      severityBreakdown,
      projectBreakdown,
      slaCompliance,
      trendData,
    }});
  } catch (err) {
    return c.json({ success: false, error: 'Failed to load dashboard' }, 500);
  }
});

// ── GET /defect-tracker/sla ───────────────────────────────────────────────────
app.get('/sla', async (c) => {
  try {
    const supabase = getSupabase();
    const { data: all, error } = await supabase.from('project_defects').select('*');
    if (error && isMissing(error)) return c.json({ success: true, data: { bySeverity: [], atRisk: [], breached: [], byProject: [] } });

    const { data: policies } = await supabase.from('defect_sla_policies').select('*');
    const withSLA = (all ?? []).map(d => ({ ...normalizeDefect(d), ...computeSLA(d, policies ?? []) }));

    const bySeverity = ['Very High','High','Medium','Low'].map(sev => {
      const sevD = withSLA.filter(d => d.severity === sev);
      const total = sevD.length;
      const open = sevD.filter(d => !['Closed','Verified'].includes(d.status)).length;
      const responseMet = sevD.filter(d => d.slaFirstResponseMet).length;
      const fixMet = sevD.filter(d => !d.slaFixBreached).length;
      const verifyMet = sevD.filter(d => !d.slaVerifyBreached).length;
      const fixTimes = sevD.filter(d => d.fixedDate).map(d => (new Date(d.fixedDate).getTime() - new Date(d.createdAt).getTime()) / 3600000);
      const avgFixTime = fixTimes.length ? (fixTimes.reduce((a, b) => a + b, 0) / fixTimes.length).toFixed(1) : 'N/A';
      return {
        severity: sev, open, total,
        firstResponse: total ? Math.round(responseMet / total * 100) : 100,
        fix: total ? Math.round(fixMet / total * 100) : 100,
        verify: total ? Math.round(verifyMet / total * 100) : 100,
        avgFixTime,
        breached: sevD.filter(d => d.slaFixBreached || d.slaVerifyBreached).length,
      };
    });

    const now = Date.now();
    const twoHours = 2 * 3600000;
    const atRisk = withSLA
      .filter(d => !['Closed','Verified','Resolved'].includes(d.status) && !d.sla_paused && d.slaStatus === 'at_risk' && d.slaFixRemainingMins !== null && d.slaFixRemainingMins > 0 && d.slaFixRemainingMins * 60000 < twoHours)
      .sort((a, b) => (a.slaFixRemainingMins ?? 999) - (b.slaFixRemainingMins ?? 999));

    const breached = withSLA.filter(d => d.slaFixBreached || d.slaVerifyBreached);

    // By project
    const projMap: Record<string, any> = {};
    for (const d of withSLA) {
      const pn = d.projectName || 'Unknown';
      if (!projMap[pn]) projMap[pn] = { projectName: pn, total: 0, breached: 0, s1: 0, s2: 0 };
      projMap[pn].total++;
      if (d.slaFixBreached || d.slaVerifyBreached) projMap[pn].breached++;
      if (d.severity === 'S1') projMap[pn].s1++;
      if (d.severity === 'S2') projMap[pn].s2++;
    }
    const byProject = Object.values(projMap).map((p: any) => ({
      ...p,
      compliance: p.total ? Math.round((p.total - p.breached) / p.total * 100) : 100,
    }));

    return c.json({ success: true, data: { bySeverity, atRisk, breached, byProject } });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to load SLA data' }, 500);
  }
});

// ── GET /defect-tracker/analytics ────────────────────────────────────────────
app.get('/analytics', async (c) => {
  try {
    const supabase = getSupabase();
    let query = supabase.from('project_defects').select('*');

    const q = c.req.query();
    if (q.projectId) query = query.eq('project_id', q.projectId);
    if (q.severity) query = query.in('severity', q.severity.split(','));
    if (q.dateFrom) query = query.gte('created_at', q.dateFrom);
    if (q.dateTo) query = query.lte('created_at', q.dateTo);

    const { data: all, error } = await query;
    if (error && isMissing(error)) return c.json({ success: true, data: {} });

    const defects = all ?? [];

    // Root cause breakdown
    const rootCauseMap: Record<string, number> = {};
    for (const d of defects) {
      const rc = d.root_cause || 'Unknown';
      rootCauseMap[rc] = (rootCauseMap[rc] ?? 0) + 1;
    }
    const rootCause = Object.entries(rootCauseMap).map(([name, value]) => ({ name, value }));

    // Regression rate
    const regressionCount = defects.filter((d: any) => d.is_regression).length;
    const regressionRate = defects.length ? Math.round(regressionCount / defects.length * 100) : 0;

    // Aging buckets
    const aging = [
      { bucket: '<1d', count: 0 }, { bucket: '1-3d', count: 0 },
      { bucket: '3-7d', count: 0 }, { bucket: '7-14d', count: 0 }, { bucket: '>14d', count: 0 },
    ];
    for (const d of defects) {
      const age = Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000);
      if (age < 1) aging[0].count++;
      else if (age < 3) aging[1].count++;
      else if (age < 7) aging[2].count++;
      else if (age < 14) aging[3].count++;
      else aging[4].count++;
    }

    // Avg fix time by severity
    const sevFixMins: Record<string,number> = { 'Very High': 480, 'High': 1440, 'Medium': 4320, 'Low': 10080 };
    const avgFixTime = ['Very High','High','Medium','Low'].map(sev => {
      const sevFixed = defects.filter((d: any) => d.severity === sev && d.fixed_date);
      const times = sevFixed.map((d: any) => (new Date(d.fixed_date).getTime() - new Date(d.created_at).getTime()) / 3600000);
      const avg = times.length ? times.reduce((a: number, b: number) => a + b, 0) / times.length : 0;
      return { severity: sev, avgHours: Math.round(avg * 10) / 10, slaTarget: (sevFixMins[sev] ?? 480) / 60 };
    });

    // Top reporters
    const reporterMap: Record<string, number> = {};
    for (const d of defects) {
      const r = d.reporter_name || 'Unknown';
      reporterMap[r] = (reporterMap[r] ?? 0) + 1;
    }
    const topReporters = Object.entries(reporterMap)
      .sort(([, a], [, b]) => b - a).slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Top assignees
    const assigneeMap: Record<string, { resolved: number; totalFix: number }> = {};
    for (const d of defects) {
      const a = d.assignee_name || 'Unassigned';
      if (!assigneeMap[a]) assigneeMap[a] = { resolved: 0, totalFix: 0 };
      if (['Resolved','Verified','Closed'].includes(d.status)) assigneeMap[a].resolved++;
      if (d.fixed_date) assigneeMap[a].totalFix += (new Date(d.fixed_date).getTime() - new Date(d.created_at).getTime()) / 3600000;
    }
    const topAssignees = Object.entries(assigneeMap)
      .sort(([, a], [, b]) => b.resolved - a.resolved).slice(0, 10)
      .map(([name, v]) => ({ name, resolved: v.resolved, avgFixTime: v.resolved ? Math.round(v.totalFix / v.resolved * 10) / 10 : 0 }));

    // Sprint velocity (group by sprint)
    const sprintMap: Record<string, { opened: number; closed: number }> = {};
    for (const d of defects) {
      const sprint = d.sprint_name || d.sprint_id || 'No Sprint';
      if (!sprintMap[sprint]) sprintMap[sprint] = { opened: 0, closed: 0 };
      sprintMap[sprint].opened++;
      if (['Resolved','Verified','Closed'].includes(d.status)) sprintMap[sprint].closed++;
    }
    const velocity = Object.entries(sprintMap).map(([sprint, v]) => ({ sprint, ...v }));

    return c.json({ success: true, data: { rootCause, regressionRate, aging, avgFixTime, topReporters, topAssignees, velocity } });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to load analytics' }, 500);
  }
});

// ── GET /defect-tracker/sla-policies ─────────────────────────────────────────
app.get('/sla-policies', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('defect_sla_policies').select('*').order('severity');
    if (error) {
      if (isMissing(error)) return c.json({ success: true, data: [] });
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data: data ?? [] });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch SLA policies' }, 500);
  }
});

// ── GET /defect-tracker/master-data ──────────────────────────────────────────
app.get('/master-data', async (c) => {
  try {
    const supabase = getSupabase();
    const [resCodesRes, rootCauseRes, rejectionRes, labelsRes, envRes, priorityRes, statusRes, escalationRes] = await Promise.all([
      supabase.from('defect_resolution_codes').select('*').order('sort_order'),
      supabase.from('defect_root_cause_categories').select('*').order('sort_order'),
      supabase.from('defect_rejection_reasons').select('*').order('name'),
      supabase.from('defect_labels').select('*').order('name'),
      supabase.from('defect_environments').select('*').order('sort_order'),
      supabase.from('defect_priorities').select('*').order('sort_order'),
      supabase.from('defect_statuses').select('*').order('sort_order'),
      supabase.from('defect_escalation_rules').select('*').order('name'),
    ]);
    return c.json({ success: true, data: {
      resolutionCodes: resCodesRes.data ?? [],
      rootCauseCategories: rootCauseRes.data ?? [],
      rejectionReasons: rejectionRes.data ?? [],
      labels: labelsRes.data ?? [],
      environments: envRes.data ?? [],
      priorities: priorityRes.data ?? [],
      statuses: statusRes.data ?? [],
      escalationRules: escalationRes.data ?? [],
    }});
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch master data' }, 500);
  }
});

// ── GET /defect-tracker/by-project ────────────────────────────────────────────
app.get('/by-project', async (c) => {
  try {
    const supabase = getSupabase();
    const { data: all, error } = await supabase.from('project_defects').select('*');
    if (error && isMissing(error)) return c.json({ success: true, data: [] });

    const { data: policies } = await supabase.from('defect_sla_policies').select('*');
    const withSLA = (all ?? []).map(d => ({ ...normalizeDefect(d), ...computeSLA(d, policies ?? []) }));

    const projMap: Record<string, any> = {};
    for (const d of withSLA) {
      const pId = d.projectId;
      const pName = d.projectName || pId || 'Unknown';
      if (!projMap[pId]) projMap[pId] = {
        projectId: pId, projectName: pName, defects: [],
        s1: 0, s2: 0, s3: 0, s4: 0, total: 0, resolved: 0, breached: 0,
      };
      projMap[pId].defects.push(d);
      projMap[pId].total++;
      if (d.severity === 'Very High') projMap[pId].s1++;
      if (d.severity === 'High')      projMap[pId].s2++;
      if (d.severity === 'Medium')    projMap[pId].s3++;
      if (d.severity === 'Low')       projMap[pId].s4++;
      if (['Resolved','Verified','Closed'].includes(d.status)) projMap[pId].resolved++;
      if (d.slaFixBreached || d.slaVerifyBreached) projMap[pId].breached++;
    }

    const result = Object.values(projMap).map((p: any) => {
      const critical = p.defects
        .filter((d: any) => !['Resolved','Verified','Closed'].includes(d.status))
        .sort((a: any, b: any) => {
          const order: Record<string, number> = { 'Very High': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
          return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
        })
        .slice(0, 5);
      return {
        projectId: p.projectId, projectName: p.projectName,
        s1: p.s1, s2: p.s2, s3: p.s3, s4: p.s4, total: p.total, resolved: p.resolved,
        resolvedPct: p.total ? Math.round(p.resolved / p.total * 100) : 0,
        slaCompliance: p.total ? Math.round((p.total - p.breached) / p.total * 100) : 100,
        criticalDefects: critical,
      };
    });

    return c.json({ success: true, data: result });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to load by-project data' }, 500);
  }
});

// ── GET /defect-tracker/saved-filters ────────────────────────────────────────
app.get('/saved-filters', async (c) => {
  try {
    const supabase = getSupabase();
    const q = c.req.query();
    if (!q.userId) return c.json({ success: false, error: 'userId is required' }, 400);
    const { data, error } = await supabase
      .from('defect_saved_filters')
      .select('*')
      .eq('user_id', q.userId)
      .order('created_at', { ascending: false });
    if (error) {
      if (isMissing(error)) return c.json({ success: true, data: [] });
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data: data ?? [] });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to fetch saved filters' }, 500);
  }
});

// ── POST /defect-tracker/saved-filters ───────────────────────────────────────
app.post('/saved-filters', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { data, error } = await supabase
      .from('defect_saved_filters')
      .insert({ user_id: body.userId, name: body.name, filters: body.filters })
      .select()
      .single();
    if (error) {
      if (isMissing(error)) return c.json({ success: false, error: 'Run migration first', tableNotReady: true }, 503);
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data }, 201);
  } catch (err) {
    return c.json({ success: false, error: 'Failed to save filter' }, 500);
  }
});

// ── DELETE /defect-tracker/saved-filters/:id ─────────────────────────────────
app.delete('/saved-filters/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('defect_saved_filters').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to delete saved filter' }, 500);
  }
});

export default app;
