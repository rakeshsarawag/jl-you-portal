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

// ==================== DEFECTS ====================

app.get('/defects', async (c) => {
  try {
    const supabase = getSupabase();
    const projectId = c.req.query('projectId');

    let query = supabase.from('project_defects').select('*').order('created_at', { ascending: false });
    if (projectId) query = query.eq('project_id', projectId);

    const { data, error } = await query;

    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: [] });
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch defects' }, 500);
  }
});

app.post('/defects', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const defectId = `DEF-${Date.now().toString().slice(-4)}`;

    const { data, error } = await supabase
      .from('project_defects')
      .insert([{
        project_id: body.projectId,
        defect_id: defectId,
        title: body.title,
        severity: body.severity || 'Medium',
        status: body.status || 'Open',
        priority: body.priority || 'Medium',
        environment: body.environment || 'staging',
        assignee_name: body.assigneeName || '',
        steps_to_reproduce: body.stepsToReproduce || [],
        expected_result: body.expectedResult || '',
        actual_result: body.actualResult || '',
        linked_tickets: body.linkedTickets || [],
      }])
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
    return c.json({ success: false, error: 'Failed to create defect' }, 500);
  }
});

app.put('/defects/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('project_defects')
      .update({
        title: body.title,
        severity: body.severity,
        status: body.status,
        priority: body.priority,
        environment: body.environment,
        assignee_name: body.assigneeName,
        steps_to_reproduce: body.stepsToReproduce,
        expected_result: body.expectedResult,
        actual_result: body.actualResult,
        linked_tickets: body.linkedTickets,
        updated_at: new Date().toISOString(),
      })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update defect' }, 500);
  }
});

app.delete('/defects/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('project_defects').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete defect' }, 500);
  }
});

export default app;
