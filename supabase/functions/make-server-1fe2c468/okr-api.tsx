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

// ==================== OKRs ====================

app.get('/all', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('okrs')
      .select('*, okr_key_results(*, okr_updates(*))')
      .order('created_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);

    const shaped = (data || []).map((okr: any) => ({
      ...okr,
      keyResults: (okr.okr_key_results || []).map((kr: any) => ({
        ...kr,
        updates: kr.okr_updates || [],
        okr_updates: undefined,
      })),
      okr_key_results: undefined,
    }));

    return c.json({ success: true, data: shaped });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch OKRs' }, 500);
  }
});

app.get('/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('okrs')
      .select('*, okr_key_results(*, okr_updates(*))')
      .eq('id', c.req.param('id'))
      .single();

    if (error || !data) return c.json({ success: false, error: 'OKR not found' }, 404);

    return c.json({
      success: true,
      data: {
        ...data,
        keyResults: (data.okr_key_results || []).map((kr: any) => ({
          ...kr,
          updates: kr.okr_updates || [],
          okr_updates: undefined,
        })),
        okr_key_results: undefined,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch OKR' }, 500);
  }
});

app.post('/create', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data: okr, error } = await supabase
      .from('okrs')
      .insert([{
        title: body.title,
        description: body.description || '',
        owner_id: body.ownerId || null,
        owner_name: body.owner || body.ownerName || '',
        department: body.department || '',
        period: body.period || body.quarter ? `Q${body.quarter} ${body.year}` : '',
        progress: 0,
        status: body.status || 'On Track',
        type: body.type || 'Individual',
        parent_okr_id: body.parentOkrId || null,
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);

    // Create key results if provided
    if (body.keyResults?.length) {
      await supabase.from('okr_key_results').insert(
        body.keyResults.map((kr: any) => ({
          okr_id: okr.id,
          title: kr.title,
          description: kr.description || '',
          target_value: kr.target || kr.targetValue || 100,
          current_value: kr.current || kr.currentValue || 0,
          unit: kr.unit || '%',
          progress: 0,
          status: 'On Track',
          ...auditCreate(c),
        }))
      );
    }

    return c.json({ success: true, data: { ...okr, keyResults: [] } }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create OKR' }, 500);
  }
});

app.put('/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('okrs')
      .update({
        title: body.title,
        description: body.description,
        owner_name: body.owner || body.ownerName,
        department: body.department,
        period: body.period,
        progress: body.progress,
        status: body.status,
        type: body.type,
        ...auditUpdate(c),
      })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update OKR' }, 500);
  }
});

app.delete('/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('okrs').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete OKR' }, 500);
  }
});

// ==================== PROGRESS UPDATE ====================

app.post('/progress', async (c) => {
  try {
    const supabase = getSupabase();
    const { id, progress } = await c.req.json();

    const { data, error } = await supabase
      .from('okrs')
      .update({ progress: Math.min(100, Math.max(0, progress)), ...auditUpdate(c) })
      .eq('id', id)
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update progress' }, 500);
  }
});

// ==================== KEY RESULTS ====================

app.post('/:id/key-results', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('okr_key_results')
      .insert([{
        okr_id: c.req.param('id'),
        title: body.title,
        description: body.description || '',
        target_value: body.target || body.targetValue || 100,
        current_value: body.current || body.currentValue || 0,
        unit: body.unit || '%',
        progress: 0,
        status: 'On Track',
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to add key result' }, 500);
  }
});

app.put('/key-results/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('okr_key_results')
      .update({
        title: body.title,
        description: body.description,
        target_value: body.target || body.targetValue,
        current_value: body.current || body.currentValue,
        unit: body.unit,
        progress: body.progress,
        status: body.status,
        ...auditUpdate(c),
      })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);

    // Auto-recalculate OKR progress from key results
    if (data?.okr_id) {
      const { data: krs } = await supabase.from('okr_key_results').select('progress').eq('okr_id', data.okr_id);
      if (krs?.length) {
        const avgProgress = krs.reduce((s: number, k: any) => s + (k.progress || 0), 0) / krs.length;
        await supabase.from('okrs').update({ progress: Math.round(avgProgress), ...auditUpdate(c) }).eq('id', data.okr_id);
      }
    }

    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update key result' }, 500);
  }
});

// ==================== PROGRESS UPDATES ====================

app.post('/key-results/:id/updates', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('okr_updates')
      .insert([{
        key_result_id: c.req.param('id'),
        author_id: body.authorId || null,
        author_name: body.author || body.authorName || '',
        value: body.value || null,
        comment: body.comment || body.notes || '',
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);

    // Update current_value on the key result
    if (body.value !== undefined) {
      const { data: kr } = await supabase
        .from('okr_key_results')
        .select('target_value')
        .eq('id', c.req.param('id'))
        .single();

      if (kr) {
        const progress = kr.target_value > 0 ? Math.min(100, Math.round((body.value / kr.target_value) * 100)) : 0;
        await supabase.from('okr_key_results').update({ current_value: body.value, progress, ...auditUpdate(c) }).eq('id', c.req.param('id'));
      }
    }

    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to add update' }, 500);
  }
});

// ==================== STATS ====================

app.get('/stats/all', async (c) => {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('okrs').select('status, progress, type');

    return c.json({
      success: true,
      data: {
        totalOKRs: data?.length || 0,
        onTrack: data?.filter((o: any) => o.status === 'On Track').length || 0,
        atRisk: data?.filter((o: any) => o.status === 'At Risk').length || 0,
        completed: data?.filter((o: any) => o.status === 'Completed').length || 0,
        avgProgress: data?.length ? Math.round(data.reduce((s: number, o: any) => s + (o.progress || 0), 0) / data.length) : 0,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch stats' }, 500);
  }
});

export default app;
