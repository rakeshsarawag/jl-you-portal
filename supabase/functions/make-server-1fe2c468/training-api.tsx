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

function shapeCourse(course: any) {
  return {
    ...course,
    duration: `${Number(course.duration_hours || 0)} hours`,
    mode: course.type || 'Online',
    level: course.level || 'beginner',
    mandatory: Boolean(course.mandatory),
    assessmentRequired: Boolean(course.assessment_required),
    passingScore: course.passing_score || 70,
    deadlineDays: course.deadline_days || 30,
    renewalMonths: course.renewal_months || 12,
    standardReferences: course.standard_references || [],
    content: course.content || [],
    enrolledCount: course.enrolled_count || 0,
    createdAt: course.created_at,
    updatedAt: course.updated_at,
  };
}

function shapeEnrollment(enrollment: any) {
  return {
    ...enrollment,
    courseId: enrollment.course_id,
    courseName: enrollment.training_courses?.title || enrollment.course_title || '',
    employeeId: enrollment.employee_id,
    employeeName: enrollment.employee_name || '',
    mandatory: Boolean(enrollment.mandatory || enrollment.training_courses?.mandatory),
    assessmentRequired: Boolean(enrollment.assessment_required || enrollment.training_courses?.assessment_required),
    dueDate: enrollment.due_date,
    startDate: enrollment.enrolled_date || enrollment.enrolled_at || enrollment.created_at,
    completedDate: enrollment.completed_date,
    assessmentPassed: Boolean(enrollment.assessment_passed),
    bestScore: enrollment.best_score,
    assessmentAttempts: enrollment.assessment_attempts || 0,
    passingScore: enrollment.training_courses?.passing_score || 70,
    training_courses: undefined,
  };
}

async function issueCertificateIfMissing(supabase: any, enrollment: any, courseTitle: string) {
  const { data: existing } = await supabase
    .from('training_certificates')
    .select('id')
    .eq('employee_id', enrollment.employee_id)
    .eq('course_id', enrollment.course_id)
    .maybeSingle();
  if (existing) return;
  await supabase.from('training_certificates').insert([{
    employee_id: enrollment.employee_id,
    employee_name: enrollment.employee_name,
    course_id: enrollment.course_id,
    course_title: courseTitle,
    certificate_number: `CERT-${Date.now()}-${String(enrollment.id).slice(0, 8)}`,
    issued_date: new Date().toISOString().split('T')[0],
  }]);
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
    return c.json({ success: true, data: (data || []).map(shapeCourse) });
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
        duration_hours: Number.parseFloat(body.durationHours || body.duration) || 0,
        type: body.mode || body.type || 'Online',
        status: body.status || 'Active',
        max_capacity: body.maxCapacity || null,
        passing_score: body.passingScore || 70,
        tags: body.tags || [],
        thumbnail_url: body.thumbnailUrl || body.thumbnail || null,
        mandatory: Boolean(body.mandatory),
        assessment_required: Boolean(body.assessmentRequired),
        is_active: body.isActive ?? true,
        level: body.level || 'beginner',
        content: body.content || [],
        deadline_days: body.deadlineDays || 30,
        renewal_months: body.renewalMonths || 12,
        standard_references: body.standardReferences || [],
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: shapeCourse(data) }, 201);
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
        duration_hours: body.durationHours || body.duration
          ? Number.parseFloat(body.durationHours || body.duration)
          : undefined,
        type: body.mode || body.type,
        status: body.status,
        tags: body.tags,
        passing_score: body.passingScore,
        mandatory: body.mandatory,
        assessment_required: body.assessmentRequired,
        is_active: body.isActive,
        level: body.level,
        content: body.content,
        deadline_days: body.deadlineDays,
        renewal_months: body.renewalMonths,
        standard_references: body.standardReferences,
        ...auditUpdate(c),
      })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data: shapeCourse(data) });
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
    const employeeId = c.req.query('employeeId');
    let query = supabase
      .from('training_enrollments')
      .select('*, training_courses(title, category, instructor, type, mandatory, assessment_required, passing_score)')
      .order('created_at', { ascending: false });
    if (employeeId) query = query.eq('employee_id', employeeId);
    const { data, error } = await query;

    if (error) return c.json({ success: false, error: error.message }, 500);

    const shaped = (data || []).map(shapeEnrollment);

    return c.json({ success: true, data: shaped });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch enrollments' }, 500);
  }
});

app.post('/enrollments', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const employeeId = (c as any).get('employeeId') as string | null;
    const role = (c as any).get('role') as string;
    const canEnrollOthers = ['admin', 'hr', 'manager'].includes(role);
    if (!canEnrollOthers) {
      if (!employeeId) {
        return c.json({ success: false, error: 'Your account is not linked to an employee record' }, 403);
      }
      body.employeeId = employeeId;
    }

    const { data: course, error: courseError } = await supabase
      .from('training_courses')
      .select('mandatory, assessment_required, deadline_days')
      .eq('id', body.courseId)
      .single();
    if (courseError) return c.json({ success: false, error: 'Course not found' }, 404);
    const enrolledDate = body.enrolledDate || new Date().toISOString().split('T')[0];
    const dueDate = new Date(`${enrolledDate}T00:00:00Z`);
    dueDate.setUTCDate(dueDate.getUTCDate() + (course.deadline_days || 30));

    const { data, error } = await supabase
      .from('training_enrollments')
      .insert([{
        employee_id: body.employeeId || null,
        employee_name: body.employeeName || '',
        course_id: body.courseId,
        enrolled_date: enrolledDate,
        enrolled_at: new Date().toISOString(),
        mandatory: Boolean(course.mandatory),
        assessment_required: Boolean(course.assessment_required),
        due_date: body.dueDate || dueDate.toISOString().slice(0, 10),
        progress: 0,
        status: 'Enrolled',
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) {
      return c.json({
        success: false,
        error: error.code === '23505' ? 'This employee is already enrolled in the course' : error.message,
      }, error.code === '23505' ? 409 : 500);
    }
    return c.json({ success: true, data: shapeEnrollment(data) }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create enrollment' }, 500);
  }
});

// Update progress
app.post('/progress', async (c) => {
  try {
    const supabase = getSupabase();
    const { id, progress } = await c.req.json();

    const { data: existing } = await supabase
      .from('training_enrollments')
      .select('assessment_required, assessment_passed')
      .eq('id', id)
      .single();
    if (progress >= 100 && existing?.assessment_required && !existing.assessment_passed) {
      return c.json({ success: false, error: 'Pass the required assessment before completing this mandatory training' }, 409);
    }
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

app.put('/enrollments/:id/progress', async (c) => {
  try {
    const supabase = getSupabase();
    const employeeId = (c as any).get('employeeId') as string | null;
    const role = (c as any).get('role') as string;
    const progress = Number((await c.req.json()).progress || 0);
    const { data: enrollment, error: fetchError } = await supabase
      .from('training_enrollments')
      .select('*, training_courses(title)')
      .eq('id', c.req.param('id'))
      .single();
    if (fetchError || !enrollment) return c.json({ success: false, error: 'Enrollment not found' }, 404);
    if (!['admin', 'hr', 'manager'].includes(role) && employeeId !== enrollment.employee_id) {
      return c.json({ success: false, error: 'You may only update your own training progress' }, 403);
    }
    if (progress >= 100 && enrollment.assessment_required && !enrollment.assessment_passed) {
      return c.json({ success: false, error: 'Pass the required assessment before completing this mandatory training' }, 409);
    }
    const bounded = Math.min(100, Math.max(0, progress));
    const status = bounded >= 100 ? 'Completed' : bounded > 0 ? 'In Progress' : 'Enrolled';
    const { data, error } = await supabase.from('training_enrollments').update({
      progress: bounded,
      status,
      completed_date: status === 'Completed' ? new Date().toISOString().slice(0, 10) : null,
      ...auditUpdate(c),
    }).eq('id', enrollment.id).select('*, training_courses(title, mandatory, assessment_required, passing_score)').single();
    if (error) return c.json({ success: false, error: error.message }, 500);
    if (status === 'Completed') {
      await issueCertificateIfMissing(supabase, data, enrollment.training_courses?.title || '');
    }
    return c.json({ success: true, data: shapeEnrollment(data) });
  } catch {
    return c.json({ success: false, error: 'Failed to update progress' }, 500);
  }
});

app.get('/courses/:id/assessment', async (c) => {
  try {
    const supabase = getSupabase();
    const [{ data: course, error: courseError }, { data: questions, error: questionError }] = await Promise.all([
      supabase.from('training_courses').select('*').eq('id', c.req.param('id')).single(),
      supabase.from('training_assessment_questions')
        .select('id, question, options, sort_order')
        .eq('course_id', c.req.param('id'))
        .order('sort_order'),
    ]);
    if (courseError || !course) return c.json({ success: false, error: 'Course not found' }, 404);
    if (questionError) return c.json({ success: false, error: questionError.message }, 500);
    return c.json({ success: true, data: { course: shapeCourse(course), questions: questions || [] } });
  } catch {
    return c.json({ success: false, error: 'Failed to load assessment' }, 500);
  }
});

app.post('/enrollments/:id/assessment', async (c) => {
  try {
    const supabase = getSupabase();
    const employeeId = (c as any).get('employeeId') as string | null;
    const role = (c as any).get('role') as string;
    const answers = (await c.req.json()).answers || {};
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('training_enrollments')
      .select('*, training_courses(title, passing_score, mandatory, assessment_required)')
      .eq('id', c.req.param('id'))
      .single();
    if (enrollmentError || !enrollment) return c.json({ success: false, error: 'Enrollment not found' }, 404);
    if (!['admin', 'hr', 'manager'].includes(role) && employeeId !== enrollment.employee_id) {
      return c.json({ success: false, error: 'You may only submit your own assessment' }, 403);
    }
    if (enrollment.assessment_passed) {
      return c.json({ success: false, error: 'This assessment has already been passed' }, 409);
    }

    const { data: questions, error: questionsError } = await supabase
      .from('training_assessment_questions')
      .select('id, correct_option_index')
      .eq('course_id', enrollment.course_id);
    if (questionsError) return c.json({ success: false, error: questionsError.message }, 500);
    if (!questions?.length) return c.json({ success: false, error: 'This course has no assessment questions' }, 409);
    if (questions.some((question: any) => answers[question.id] === undefined)) {
      return c.json({ success: false, error: 'Answer every question before submitting' }, 400);
    }

    const correct = questions.filter((question: any) =>
      Number(answers[question.id]) === question.correct_option_index
    ).length;
    const score = Math.round((correct / questions.length) * 100);
    const passingScore = enrollment.training_courses?.passing_score || 70;
    const passed = score >= passingScore;

    const { error: attemptError } = await supabase.from('training_assessment_attempts').insert([{
      enrollment_id: enrollment.id,
      employee_id: enrollment.employee_id,
      course_id: enrollment.course_id,
      answers,
      score,
      passed,
    }]);
    if (attemptError) return c.json({ success: false, error: attemptError.message }, 500);

    const bestScore = Math.max(enrollment.best_score || 0, score);
    const { data: updated, error: updateError } = await supabase
      .from('training_enrollments')
      .update({
        score,
        best_score: bestScore,
        assessment_passed: Boolean(enrollment.assessment_passed || passed),
        assessment_attempts: (enrollment.assessment_attempts || 0) + 1,
        progress: passed ? 100 : Math.max(enrollment.progress || 0, 90),
        status: passed ? 'Completed' : 'In Progress',
        completed_date: passed ? new Date().toISOString().slice(0, 10) : null,
        ...auditUpdate(c),
      })
      .eq('id', enrollment.id)
      .select('*, training_courses(title, mandatory, assessment_required, passing_score)')
      .single();
    if (updateError) return c.json({ success: false, error: updateError.message }, 500);
    if (passed) {
      await issueCertificateIfMissing(supabase, updated, enrollment.training_courses?.title || '');
    }
    return c.json({
      success: true,
      data: {
        enrollment: shapeEnrollment(updated),
        score,
        passingScore,
        passed,
        correct,
        total: questions.length,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to submit assessment' }, 500);
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
