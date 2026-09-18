import { Hono } from 'npm:hono';
import { notifyByEmail, notifyUserId } from "./notify-helpers.tsx";
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { auditCreate, auditUpdate } from "./audit-helpers.ts";

const app = new Hono();

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

/** Fire notifications for ticket status/assignment changes. Fire-and-forget. */
async function sendTicketNotifications(body: any, ticket: any): Promise<void> {
  const ticketNum = ticket?.ticket_number ?? "";
  const ticketTitle = ticket?.title ?? body.title ?? "Ticket";
  const requesterEmail = ticket?.requester_email ?? body.requesterEmail ?? "";

  // Assignee notification when assigned_to is set/changed
  if (body.assignedTo && body.assignedTo !== ticket?.assigned_to) {
    await notifyByEmail(body.assignedTo, {
      title: "IT Ticket Assigned to You",
      body: `${ticketNum}: "${ticketTitle}" has been assigned to you. Priority: ${ticket?.priority ?? body.priority ?? "Medium"}.`,
      type: "ticket",
      link: "/it-services",
    }).catch(() => {});
  }

  // Requester notification when status changes
  if (body.status && requesterEmail) {
    if (body.status === "Resolved") {
      await notifyByEmail(requesterEmail, {
        title: "Your IT Ticket Has Been Resolved",
        body: `${ticketNum}: "${ticketTitle}" has been marked as resolved.${ticket?.resolution ? " Resolution: " + ticket.resolution : ""}`,
        type: "ticket",
        link: "/it-services",
      }).catch(() => {});
    } else if (body.status === "In Progress") {
      await notifyByEmail(requesterEmail, {
        title: "IT Ticket In Progress",
        body: `Your ticket ${ticketNum}: "${ticketTitle}" is now being worked on.`,
        type: "ticket",
        link: "/it-services",
      }).catch(() => {});
    } else if (body.status === "Closed") {
      await notifyByEmail(requesterEmail, {
        title: "IT Ticket Closed",
        body: `Your ticket ${ticketNum}: "${ticketTitle}" has been closed.`,
        type: "ticket",
        link: "/it-services",
      }).catch(() => {});
    }
  }
}

// ticket_number is assigned by DB trigger trg_it_ticket_number (INC-######)

// ==================== TICKETS ====================

app.get('/tickets', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('it_tickets')
      .select('*, it_ticket_comments(*)')
      .order('created_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);

    const shaped = (data || []).map((t: any) => ({
      ...t,
      comments: t.it_ticket_comments || [],
      it_ticket_comments: undefined,
    }));

    return c.json({ success: true, data: shaped });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch tickets' }, 500);
  }
});

app.post('/tickets', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('it_tickets')
      .insert([{
        // ticket_number assigned by DB trigger
        requester_id: body.requesterId || null,
        requester_name: body.requesterName || body.createdBy || '',
        requester_email: body.requesterEmail || '',
        category: body.category || 'Other',
        sub_category: body.subCategory || '',
        title: body.title,
        description: body.description || '',
        priority: body.priority || 'Medium',
        status: 'Open',
        assigned_to: body.assignedTo || null,
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);

    // Notify assigned IT staff
    if (body.assignedTo) {
      notifyByEmail(body.assignedTo, {
        title: "IT Ticket Assigned to You",
        body: `Ticket ${data?.ticket_number ?? ""}: "${body.title}" has been assigned to you. Priority: ${body.priority || "Medium"}.`,
        type: "ticket",
        link: "/it-services",
      }).catch(() => {});
    }

    return c.json({ success: true, data: { ...data, comments: [] } }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create ticket' }, 500);
  }
});

app.post('/tickets/update', async (c) => {
  try {
    const supabase = getSupabase();
    const { id, ...body } = await c.req.json();

    const updates: any = {
      title: body.title,
      description: body.description,
      category: body.category,
      priority: body.priority,
      status: body.status,
      assigned_to: body.assignedTo || null,
      resolution: body.resolution || null,
    };

    if (body.status === 'Resolved' || body.status === 'Closed') {
      updates.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('it_tickets')
      .update({ ...updates, ...auditUpdate(c) })
      .eq('id', id)
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);

    sendTicketNotifications(body, data).catch(() => {});

    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update ticket' }, 500);
  }
});

app.put('/tickets/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const updates: any = {
      title: body.title,
      description: body.description,
      category: body.category,
      priority: body.priority,
      status: body.status,
      assigned_to: body.assignedTo || null,
      resolution: body.resolution || null,
    };

    if (body.status === 'Resolved' || body.status === 'Closed') {
      updates.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('it_tickets')
      .update({ ...updates, ...auditUpdate(c) })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);

    sendTicketNotifications(body, data).catch(() => {});

    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update ticket' }, 500);
  }
});

app.delete('/tickets/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('it_tickets').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete ticket' }, 500);
  }
});

// ==================== COMMENTS ====================

app.post('/tickets/:id/comments', async (c) => {
  try {
    const supabase = getSupabase();
    const ticketId = c.req.param('id');
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('it_ticket_comments')
      .insert([{
        ticket_id: ticketId,
        author_id: body.authorId || null,
        author_name: body.author || body.authorName || '',
        content: body.text || body.content || '',
        is_internal: body.isInternal || false,
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to add comment' }, 500);
  }
});

// ==================== STATS ====================

app.get('/stats', async (c) => {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('it_tickets').select('status, priority, created_at, resolved_at');

    const total = data?.length || 0;
    const open = data?.filter((t: any) => t.status === 'Open').length || 0;
    const inProgress = data?.filter((t: any) => t.status === 'In Progress').length || 0;
    const resolved = data?.filter((t: any) => ['Resolved', 'Closed'].includes(t.status)).length || 0;
    const critical = data?.filter((t: any) => t.priority === 'Critical').length || 0;

    // Average resolution time in hours for resolved tickets
    const resolvedTickets = data?.filter((t: any) => ['Resolved', 'Closed'].includes(t.status) && t.created_at && t.resolved_at) || [];
    const avgResolutionHours = resolvedTickets.length > 0
      ? Math.round(resolvedTickets.reduce((sum: number, t: any) => {
          const diffMs = new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
          return sum + diffMs / 3600000;
        }, 0) / resolvedTickets.length * 10) / 10
      : 0;

    // SLA breached: high/critical tickets open >48h or medium >72h
    const now = Date.now();
    const slaBreached = data?.filter((t: any) => {
      if (!['Open', 'In Progress', 'Pending'].includes(t.status)) return false;
      if (!t.created_at) return false;
      const ageHours = (now - new Date(t.created_at).getTime()) / 3600000;
      if (['Critical', 'High'].includes(t.priority)) return ageHours > 48;
      if (t.priority === 'Medium') return ageHours > 72;
      return ageHours > 120;
    }).length || 0;

    return c.json({
      success: true,
      data: { totalTickets: total, openTickets: open, inProgressTickets: inProgress, resolvedTickets: resolved, criticalTickets: critical, avgResolutionHours, slaBreached },
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch stats' }, 500);
  }
});

// ==================== KB ARTICLES ====================

function isTableMissing(error: unknown): boolean {
  const msg = String((error as any)?.message ?? error);
  return msg.includes('relation') && msg.includes('does not exist');
}

app.get('/kb-articles', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('it_kb_articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: [] });
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch KB articles' }, 500);
  }
});

app.post('/kb-articles', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('it_kb_articles')
      .insert([{
        title: body.title,
        category: body.category || 'General',
        excerpt: body.excerpt || '',
        content: body.content || '',
        status: body.status || 'draft',
        author_name: body.authorName || '',
        helpful_votes: 0,
        views: 0,
      }])
      .select()
      .single();

    if (error) {
      if (isTableMissing(error)) {
        return c.json({ success: true, data: { id: crypto.randomUUID(), title: body.title, category: body.category || 'General', excerpt: body.excerpt || '', content: body.content || '', status: body.status || 'draft', author_name: body.authorName || '', helpful_votes: 0, views: 0, created_at: new Date().toISOString() } }, 201);
      }
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create KB article' }, 500);
  }
});

app.put('/kb-articles/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('it_kb_articles')
      .update({
        title: body.title,
        category: body.category,
        excerpt: body.excerpt,
        content: body.content,
        status: body.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update KB article' }, 500);
  }
});

app.delete('/kb-articles/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('it_kb_articles').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete KB article' }, 500);
  }
});

// ==================== LINKED ITEMS ====================

app.get('/linked-items/:ticketId', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('it_linked_items')
      .select('*')
      .eq('ticket_id', c.req.param('ticketId'));

    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: [] });
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch linked items' }, 500);
  }
});

app.post('/linked-items', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('it_linked_items')
      .insert([{
        ticket_id: body.ticketId,
        type: body.type,
        external_id: body.externalId,
        title: body.title || '',
        status: body.status || 'Open',
      }])
      .select()
      .single();

    if (error) {
      if (isTableMissing(error)) {
        return c.json({ success: true, data: { id: crypto.randomUUID(), ticket_id: body.ticketId, type: body.type, external_id: body.externalId, title: body.title || '', status: body.status || 'Open', created_at: new Date().toISOString() } }, 201);
      }
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create linked item' }, 500);
  }
});

app.delete('/linked-items/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('it_linked_items').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete linked item' }, 500);
  }
});

export default app;
