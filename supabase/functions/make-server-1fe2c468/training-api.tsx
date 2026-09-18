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

// ==================== COURSES ====================

app.get('/courses', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('training_courses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch courses' }, 500);
  }
});

app.post('/courses', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('training_courses')
      .insert([{
        title: body.title,
        description: body.description || '',
        category: body.category || '',
        instructor: body.instructor || '',
        duration_hours: body.durationHours || body.duration || 0,
        type: body.type || 'Online',
        status: body.status || 'Active',
        max_capacity: body.maxCapacity || null,
        passing_score: body.passingScore || 70,
        tags: body.tags || [],
        thumbnail_url: body.thumbnailUrl || body.thumbnail || null,
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create course' }, 500);
  }
});

app.put('/courses/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { data, error } = await supabase
      .from('training_courses')
      .update({
        title: body.title,
        description: body.description,
        category: body.category,
        instructor: body.instructor,
        duration_hours: body.durationHours || body.duration,
        type: body.type,
        status: body.status,
        tags: body.tags,
        ...auditUpdate(c),
      })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update course' }, 500);
  }
});

app.delete('/courses/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('training_courses').delete().eq('id', c.req.param('id'));
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete course' }, 500);
  }
});

// ==================== ENROLLMENTS ====================

app.get('/enrollments', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('training_enrollments')
      .select('*, training_courses(title, category, instructor, type)')
      .order('created_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);

    const shaped = (data || []).map((e: any) => ({
      ...e,
      courseTitle: e.training_courses?.title,
      courseCategory: e.training_courses?.category,
      courseInstructor: e.training_courses?.instructor,
      courseType: e.training_courses?.type,
      training_courses: undefined,
    }));

    return c.json({ success: true, data: shaped });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch enrollments' }, 500);
  }
});

app.post('/enrollments', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('training_enrollments')
      .insert([{
        employee_id: body.employeeId || null,
        employee_name: body.employeeName || '',
        course_id: body.courseId,
        enrolled_date: body.enrolledDate || new Date().toISOString().split('T')[0],
        progress: 0,
        status: 'Enrolled',
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create enrollment' }, 500);
  }
});

// Update progress
app.post('/progress', async (c) => {
  try {
    const supabase = getSupabase();
    const { id, progress } = await c.req.json();

    const newStatus = progress >= 100 ? 'Completed' : progress > 0 ? 'In Progress' : 'Enrolled';
    const { data, error } = await supabase
      .from('training_enrollments')
      .update({
        progress: Math.min(100, Math.max(0, progress)),
        status: newStatus,
        completed_date: newStatus === 'Completed' ? new Date().toISOString().split('T')[0] : null,
        ...auditUpdate(c),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);

    // If completed, auto-issue certificate
    if (newStatus === 'Completed' && data) {
      const { data: courseData } = await supabase
        .from('training_courses')
        .select('title')
        .eq('id', data.course_id)
        .single();

      await supabase.from('training_certificates').insert([{
        employee_id: data.employee_id,
        employee_name: data.employee_name,
        course_id: data.course_id,
        course_title: courseData?.title || '',
        certificate_number: `CERT-${Date.now()}`,
        issued_date: new Date().toISOString().split('T')[0],
        ...auditCreate(c),
      }]).select().maybeSingle();
    }

    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update progress' }, 500);
  }
});

// ==================== CERTIFICATES ====================

app.get('/certificates', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('training_certificates')
      .select('*')
      .order('issued_date', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch certificates' }, 500);
  }
});

// ==================== LEARNING PATHS ====================

function isTableMissing(err: any) {
  return err?.code === '42P01';
}

app.get('/learning-paths', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('learning_paths')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: [] });
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data: data ?? [] });
  } catch {
    return c.json({ success: false, error: 'Failed to fetch learning paths' }, 500);
  }
});

app.post('/learning-paths', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const record = {
      id: crypto.randomUUID(),
      name: body.name,
      description: body.description ?? '',
      target_role: body.target_role ?? null,
      courses: body.courses ?? [],
      estimated_hours: body.estimated_hours ?? 0,
      created_by: body.created_by ?? '',
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('learning_paths').insert({ ...record, ...auditCreate(c) }).select().single();
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: record }, 201);
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data }, 201);
  } catch {
    return c.json({ success: false, error: 'Failed to create learning path' }, 500);
  }
});

app.get('/learning-paths/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('learning_paths').select('*').eq('id', c.req.param('id')).single();
    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch {
    return c.json({ success: false, error: 'Failed to fetch learning path' }, 500);
  }
});

app.put('/learning-paths/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { data, error } = await supabase.from('learning_paths').update({ ...body, ...auditUpdate(c) }).eq('id', c.req.param('id')).select().single();
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data });
  } catch {
    return c.json({ success: false, error: 'Failed to update learning path' }, 500);
  }
});

app.get('/path-enrollments', async (c) => {
  try {
    const supabase = getSupabase();
    const employeeId = c.req.query('employee_id');
    let query = supabase.from('path_enrollments').select('*').order('enrolled_at', { ascending: false });
    if (employeeId) query = query.eq('employee_id', employeeId);
    const { data, error } = await query;
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: [] });
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data: data ?? [] });
  } catch {
    return c.json({ success: false, error: 'Failed to fetch path enrollments' }, 500);
  }
});

app.post('/path-enrollments', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const record = {
      id: crypto.randomUUID(),
      path_id: body.path_id,
      employee_id: body.employee_id,
      current_course_index: 0,
      status: 'In Progress',
      enrolled_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('path_enrollments').insert({ ...record, ...auditCreate(c) }).select().single();
    if (error) {
      if (isTableMissing(error)) return c.json({ success: true, data: record }, 201);
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: true, data }, 201);
  } catch {
    return c.json({ success: false, error: 'Failed to enroll in path' }, 500);
  }
});

app.put('/path-enrollments/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    // Check if completed
    const updateData: any = { ...body };
    if (body.status === 'Completed' && !body.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase.from('path_enrollments').update({ ...updateData, ...auditUpdate(c) }).eq('id', c.req.param('id')).select().single();
    if (error) return c.json({ success: false, error: error.message }, 500);

    // If completed, insert notification
    if (updateData.status === 'Completed' && data) {
      try {
        await supabase.from('notifications').insert({
          id: crypto.randomUUID(),
          user_id: data.employee_id,
          title: 'Learning Path Completed!',
          message: 'Congratulations! You have completed a learning path.',
          type: 'training',
          link: '/training',
          created_at: new Date().toISOString(),
          read: false,
          ...auditCreate(c),
        });
      } catch { /* non-critical */ }
    }

    return c.json({ success: true, data });
  } catch {
    return c.json({ success: false, error: 'Failed to update path enrollment' }, 500);
  }
});

// ==================== STATS ====================

app.get('/stats', async (c) => {
  try {
    const supabase = getSupabase();
    const [enrollRes, courseRes, certRes] = await Promise.allSettled([
      supabase.from('training_enrollments').select('status'),
      supabase.from('training_courses').select('status'),
      supabase.from('training_certificates').select('id'),
    ]);

    const enrollments = enrollRes.status === 'fulfilled' ? enrollRes.value.data || [] : [];
    const courses = courseRes.status === 'fulfilled' ? courseRes.value.data || [] : [];
    const certs = certRes.status === 'fulfilled' ? certRes.value.data || [] : [];

    const total = enrollments.length;
    const completed = enrollments.filter((e: any) => e.status === 'Completed').length;
    const inProgress = enrollments.filter((e: any) => e.status === 'In Progress').length;
    const certified = certs.length;

    return c.json({
      success: true,
      data: {
        enrollments: total,
        totalEnrollments: total,
        completedEnrollments: completed,
        inProgressEnrollments: inProgress,
        activeCourses: courses.filter((c: any) => c.status === 'Active').length,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        certified,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch stats' }, 500);
  }
});

export default app;
