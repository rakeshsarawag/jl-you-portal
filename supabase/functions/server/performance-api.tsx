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

// ==================== REVIEWS ====================

app.get('/reviews', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('performance_reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch reviews' }, 500);
  }
});

app.post('/reviews', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('performance_reviews')
      .insert([{
        employee_id: body.employeeId || null,
        employee_name: body.employeeName || '',
        reviewer_id: body.reviewerId || null,
        reviewer_name: body.reviewer || body.reviewerName || '',
        period: body.reviewPeriod || body.period || '',
        review_date: body.reviewDate || new Date().toISOString().split('T')[0],
        overall_rating: body.overallRating || null,
        goals_rating: body.goalsRating || null,
        competencies_rating: body.competenciesRating || null,
        manager_comments: body.managerComments || body.comments || '',
        employee_comments: body.employeeComments || '',
        status: body.status || 'Draft',
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create review' }, 500);
  }
});

app.post('/reviews/update', async (c) => {
  try {
    const supabase = getSupabase();
    const { id, ...body } = await c.req.json();

    const { data, error } = await supabase
      .from('performance_reviews')
      .update({
        employee_name: body.employeeName,
        reviewer_name: body.reviewer || body.reviewerName,
        period: body.reviewPeriod || body.period,
        review_date: body.reviewDate,
        overall_rating: body.overallRating,
        goals_rating: body.goalsRating,
        competencies_rating: body.competenciesRating,
        manager_comments: body.managerComments || body.comments,
        employee_comments: body.employeeComments,
        status: body.status,
        ...auditUpdate(c),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update review' }, 500);
  }
});

app.put('/reviews/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('performance_reviews')
      .update({
        employee_name: body.employeeName,
        reviewer_name: body.reviewer || body.reviewerName,
        period: body.reviewPeriod || body.period,
        review_date: body.reviewDate,
        overall_rating: body.overallRating,
        goals_rating: body.goalsRating,
        competencies_rating: body.competenciesRating,
        manager_comments: body.managerComments || body.comments,
        employee_comments: body.employeeComments,
        status: body.status,
        ...auditUpdate(c),
      })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update review' }, 500);
  }
});

app.delete('/reviews/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('performance_reviews').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete review' }, 500);
  }
});

// ==================== GOALS ====================

app.get('/goals', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('performance_goals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch goals' }, 500);
  }
});

app.post('/goals', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('performance_goals')
      .insert([{
        employee_id: body.employeeId || null,
        employee_name: body.employeeName || '',
        title: body.title,
        description: body.description || '',
        target_value: body.targetValue || body.target || '',
        current_value: body.currentValue || body.current || '',
        weight: body.weight || 0,
        status: body.status || 'Not Started',
        due_date: body.dueDate || null,
        period: body.period || '',
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create goal' }, 500);
  }
});

app.put('/goals/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { data, error } = await supabase
      .from('performance_goals')
      .update({
        title: body.title,
        description: body.description,
        target_value: body.targetValue || body.target,
        current_value: body.currentValue || body.current,
        weight: body.weight,
        status: body.status,
        due_date: body.dueDate,
        period: body.period,
        ...auditUpdate(c),
      })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update goal' }, 500);
  }
});

// ==================== FEEDBACK (360) ====================

app.get('/feedback', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('performance_feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch feedback' }, 500);
  }
});

app.post('/feedback', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('performance_feedback')
      .insert([{
        employee_id: body.employeeId || null,
        reviewer_id: body.reviewerId || null,
        reviewer_name: body.reviewerName || body.reviewer || '',
        feedback_type: body.feedbackType || body.type || 'Peer',
        rating: body.rating || null,
        comments: body.comments || '',
        period: body.period || '',
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create feedback' }, 500);
  }
});

// ==================== PIPs ====================

app.get('/pips', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('performance_pips')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch PIPs' }, 500);
  }
});

app.post('/pips', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('performance_pips')
      .insert([{
        employee_id: body.employeeId || null,
        employee_name: body.employeeName || '',
        manager_id: body.managerId || null,
        title: body.title,
        description: body.description || '',
        start_date: body.startDate || null,
        end_date: body.endDate || null,
        goals: body.goals || [],
        status: body.status || 'Active',
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create PIP' }, 500);
  }
});

// ==================== REVIEW CYCLES ====================

app.get('/cycles', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('performance_cycles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // Graceful fallback: if table doesn't exist return empty array
      if ((error as any).code === '42P01') return c.json({ success: true, data: [] });
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: true, data: [] });
  }
});

app.post('/cycles', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('performance_cycles')
      .insert([{
        name: body.name || '',
        period_start: body.period_start || null,
        period_end: body.period_end || null,
        status: body.status || 'Draft',
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) {
      if ((error as any).code === '42P01') return c.json({ success: false, error: 'Cycles table not yet created. Please run migrations.' }, 400);
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create cycle' }, 500);
  }
});

app.put('/cycles/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const updatePayload: Record<string, unknown> = {};
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.period_start !== undefined) updatePayload.period_start = body.period_start;
    if (body.period_end !== undefined) updatePayload.period_end = body.period_end;
    if (body.status !== undefined) updatePayload.status = body.status;

    const { data, error } = await supabase
      .from('performance_cycles')
      .update(updatePayload)
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update cycle' }, 500);
  }
});

app.delete('/cycles/:id', async (c) => {
  try {
    const supabase = getSupabase();
    // Only allow deleting Draft cycles
    const { data: existing } = await supabase
      .from('performance_cycles')
      .select('status')
      .eq('id', c.req.param('id'))
      .single();

    if (existing && existing.status !== 'Draft') {
      return c.json({ success: false, error: 'Only Draft cycles can be deleted' }, 400);
    }

    const { error } = await supabase
      .from('performance_cycles')
      .delete()
      .eq('id', c.req.param('id'));

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete cycle' }, 500);
  }
});

// ==================== STATS ====================

app.get('/stats', async (c) => {
  try {
    const supabase = getSupabase();
    const { data: reviews } = await supabase.from('performance_reviews').select('status, overall_rating');
    const { data: goals } = await supabase.from('performance_goals').select('status');

    const total = reviews?.length || 0;
    const completed = reviews?.filter((r: any) => r.status === 'Completed').length || 0;
    const avgRating = total > 0
      ? (reviews?.reduce((s: number, r: any) => s + (r.overall_rating || 0), 0) || 0) / total
      : 0;

    return c.json({
      success: true,
      data: {
        totalReviews: total,
        completedReviews: completed,
        avgRating: Math.round(avgRating * 10) / 10,
        totalGoals: goals?.length || 0,
        completedGoals: goals?.filter((g: any) => g.status === 'Completed').length || 0,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch stats' }, 500);
  }
});

export default app;
