import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';

const app = new Hono();

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

function isTableMissing(error: unknown): boolean {
  const msg = String((error as any)?.message ?? error);
  return msg.includes('relation') && msg.includes('does not exist');
}

// ==================== BACKLOG ITEMS ====================

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
      if (isTableMissing(error)) {
        return c.json({ success: false, error: 'Database table not ready. Please run migration 05_missing_tables.sql in your Supabase SQL Editor.', tableNotReady: true }, 503);
      }
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create backlog item' }, 500);
  }
});

app.put('/backlog/:id', async (c) => {
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
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update backlog item' }, 500);
  }
});

app.delete('/backlog/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('project_backlog_items').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete backlog item' }, 500);
  }
});

export default app;
