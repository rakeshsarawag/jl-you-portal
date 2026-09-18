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

// ==================== CANDIDATES ====================

// Get all candidates (with interviews + feedback joined)
app.get('/candidates', async (c) => {
  try {
    const supabase = getSupabase();
    const { data: candidates, error } = await supabase
      .from('recruitment_candidates')
      .select(`
        *,
        recruitment_interviews (*),
        recruitment_feedback (*)
      `)
      .order('created_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);

    const shaped = (candidates || []).map((c: any) => ({
      ...c,
      interviews: c.recruitment_interviews || [],
      feedback: c.recruitment_feedback || [],
      recruitment_interviews: undefined,
      recruitment_feedback: undefined,
    }));

    return c.json({ success: true, data: shaped });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch candidates' }, 500);
  }
});

// Get candidates ready for onboarding
app.get('/candidates/ready-for-onboarding', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('recruitment_candidates')
      .select('*')
      .in('stage', ['Offer Accepted', 'Hired'])
      .order('updated_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch candidates' }, 500);
  }
});

// Get single candidate
app.get('/candidates/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('recruitment_candidates')
      .select(`*, recruitment_interviews (*), recruitment_feedback (*)`)
      .eq('id', c.req.param('id'))
      .single();

    if (error || !data) return c.json({ success: false, error: 'Candidate not found' }, 404);

    return c.json({
      success: true,
      data: {
        ...data,
        interviews: data.recruitment_interviews || [],
        feedback: data.recruitment_feedback || [],
        recruitment_interviews: undefined,
        recruitment_feedback: undefined,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch candidate' }, 500);
  }
});

// Create candidate
app.post('/candidates', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('recruitment_candidates')
      .insert([{
        name: body.name,
        email: body.email,
        phone: body.phone || '',
        position: body.position || '',
        department: body.department || '',
        job_id: body.jobId || null,
        experience: body.experience || 0,
        current_company: body.currentCompany || '',
        current_salary: body.currentSalary || '',
        expected_salary: body.expectedSalary || '',
        notice_period: body.noticePeriod || '',
        source: body.source || 'Job Portal',
        stage: body.stage || 'Applied',
        applied_date: body.appliedDate || new Date().toISOString().split('T')[0],
        resume_url: body.resumeUrl || null,
        rating: 0,
        skills: body.skills || [],
        status: body.status || 'Active',
        hiring_manager: body.hiringManager || '',
        notes: body.notes || '',
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: { ...data, interviews: [], feedback: [] } }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create candidate' }, 500);
  }
});

// Bulk upload candidates
app.post('/bulk-upload', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const candidatesData = body.candidates;

    if (!Array.isArray(candidatesData) || candidatesData.length === 0) {
      return c.json({ success: false, error: 'No candidate data provided' }, 400);
    }

    const results = { successful: [] as string[], failed: [] as any[] };

    // Fetch existing emails
    const { data: existing } = await supabase
      .from('recruitment_candidates')
      .select('email');
    const existingEmails = new Set((existing || []).map((e: any) => e.email.toLowerCase()));

    for (let i = 0; i < candidatesData.length; i++) {
      const cd = candidatesData[i];
      const row = i + 2;

      const missing = ['name', 'email', 'phone', 'position', 'department'].filter(f => !cd[f]);
      if (missing.length) {
        results.failed.push({ row, error: `Missing: ${missing.join(', ')}`, data: cd });
        continue;
      }

      if (existingEmails.has(cd.email.toLowerCase())) {
        results.failed.push({ row, error: `Email ${cd.email} already exists`, data: cd });
        continue;
      }

      const { error } = await supabase.from('recruitment_candidates').insert([{
        name: cd.name,
        email: cd.email,
        phone: cd.phone,
        position: cd.position,
        department: cd.department,
        experience: cd.experience || 0,
        current_company: cd.currentCompany || '',
        current_salary: cd.currentSalary || '',
        expected_salary: cd.expectedSalary || '',
        notice_period: cd.noticePeriod || '',
        source: cd.source || 'Excel Upload',
        stage: 'Applied',
        applied_date: cd.appliedDate || new Date().toISOString().split('T')[0],
        skills: [],
        status: 'Active',
        hiring_manager: cd.hiringManager || '',
        notes: cd.notes || '',
        ...auditCreate(c),
      }]);

      if (error) {
        results.failed.push({ row, error: error.message, data: cd });
      } else {
        results.successful.push(cd.name);
        existingEmails.add(cd.email.toLowerCase());
      }
    }

    return c.json({
      success: true,
      data: {
        totalProcessed: candidatesData.length,
        successCount: results.successful.length,
        failureCount: results.failed.length,
        successful: results.successful,
        failed: results.failed,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to process bulk upload' }, 500);
  }
});

// Update candidate (PUT)
app.put('/candidates/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { data, error } = await supabase
      .from('recruitment_candidates')
      .update({
        name: body.name,
        email: body.email,
        phone: body.phone,
        position: body.position,
        department: body.department,
        job_id: body.jobId || null,
        experience: body.experience,
        current_company: body.currentCompany,
        current_salary: body.currentSalary,
        expected_salary: body.expectedSalary,
        notice_period: body.noticePeriod,
        source: body.source,
        stage: body.stage,
        applied_date: body.appliedDate,
        resume_url: body.resumeUrl,
        rating: body.rating,
        skills: body.skills,
        status: body.status,
        hiring_manager: body.hiringManager,
        notes: body.notes,
        offer_sent_date: body.offerSentDate || null,
        offer_accepted_date: body.offerAcceptedDate || null,
        expected_joining_date: body.expectedJoiningDate || null,
        ...auditUpdate(c),
      })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update candidate' }, 500);
  }
});

// Update candidate (POST alternative)
app.post('/candidates/update', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { id, ...rest } = body;

    const { data, error } = await supabase
      .from('recruitment_candidates')
      .update({
        name: rest.name,
        email: rest.email,
        phone: rest.phone,
        position: rest.position,
        department: rest.department,
        experience: rest.experience,
        current_company: rest.currentCompany,
        current_salary: rest.currentSalary,
        expected_salary: rest.expectedSalary,
        notice_period: rest.noticePeriod,
        source: rest.source,
        stage: rest.stage,
        applied_date: rest.appliedDate,
        resume_url: rest.resumeUrl,
        rating: rest.rating,
        skills: rest.skills,
        status: rest.status,
        hiring_manager: rest.hiringManager,
        notes: rest.notes,
        offer_sent_date: rest.offerSentDate || null,
        offer_accepted_date: rest.offerAcceptedDate || null,
        expected_joining_date: rest.expectedJoiningDate || null,
        ...auditUpdate(c),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update candidate' }, 500);
  }
});

// Delete candidate
app.delete('/candidates/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('recruitment_candidates')
      .delete()
      .eq('id', c.req.param('id'));

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, message: 'Candidate deleted successfully' });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete candidate' }, 500);
  }
});

// Update stage
app.put('/candidates/:id/stage', async (c) => {
  try {
    const supabase = getSupabase();
    const { stage } = await c.req.json();
    const { data, error } = await supabase
      .from('recruitment_candidates')
      .update({ stage, ...auditUpdate(c) })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update stage' }, 500);
  }
});

// ==================== INTERVIEWS ====================

app.post('/candidates/:id/interviews', async (c) => {
  try {
    const supabase = getSupabase();
    const candidateId = c.req.param('id');
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('recruitment_interviews')
      .insert([{
        candidate_id: candidateId,
        type: body.type,
        interview_date: body.date,
        interview_time: body.time,
        interviewer: body.interviewer,
        duration: body.duration,
        meeting_link: body.meetingLink || null,
        status: 'Scheduled',
        notes: body.notes || '',
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);

    // Auto-advance stage if needed
    const { data: candidate } = await supabase
      .from('recruitment_candidates')
      .select('stage')
      .eq('id', candidateId)
      .single();

    if (candidate && ['Applied', 'Screening'].includes(candidate.stage)) {
      await supabase
        .from('recruitment_candidates')
        .update({ stage: 'Interview Scheduled', ...auditUpdate(c) })
        .eq('id', candidateId);
    }

    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to add interview' }, 500);
  }
});

app.put('/candidates/:id/interviews/:interviewId', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('recruitment_interviews')
      .update({
        type: body.type,
        interview_date: body.date,
        interview_time: body.time,
        interviewer: body.interviewer,
        duration: body.duration,
        meeting_link: body.meetingLink,
        status: body.status,
        notes: body.notes,
        ...auditUpdate(c),
      })
      .eq('id', c.req.param('interviewId'))
      .eq('candidate_id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update interview' }, 500);
  }
});

// ==================== FEEDBACK ====================

app.post('/candidates/:id/feedback', async (c) => {
  try {
    const supabase = getSupabase();
    const candidateId = c.req.param('id');
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('recruitment_feedback')
      .insert([{
        candidate_id: candidateId,
        interviewer: body.interviewer,
        rating: body.rating,
        technical_skills: body.technicalSkills,
        communication: body.communication,
        cultural_fit: body.culturalFit,
        comments: body.comments,
        recommendation: body.recommendation,
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);

    // Recalculate average rating for candidate
    const { data: allFeedback } = await supabase
      .from('recruitment_feedback')
      .select('rating')
      .eq('candidate_id', candidateId);

    if (allFeedback?.length) {
      const avg = allFeedback.reduce((sum: number, f: any) => sum + (f.rating || 0), 0) / allFeedback.length;
      await supabase
        .from('recruitment_candidates')
        .update({ rating: Math.round(avg * 10) / 10, stage: 'Interview Done', ...auditUpdate(c) })
        .eq('id', candidateId);
    }

    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to add feedback' }, 500);
  }
});

// ==================== JOB POSTINGS ====================

app.get('/jobs', async (c) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('recruitment_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data: data || [] });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch jobs' }, 500);
  }
});

app.post('/jobs', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();

    const { data, error } = await supabase
      .from('recruitment_jobs')
      .insert([{
        title: body.title,
        department: body.department || '',
        location: body.location || '',
        type: body.type || 'Full-time',
        experience: body.experience || '',
        description: body.description || '',
        requirements: body.requirements || [],
        status: 'Active',
        platforms: body.platforms || ['Company Website'],
        ...auditCreate(c),
      }])
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create job' }, 500);
  }
});

app.put('/jobs/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const body = await c.req.json();
    const { data, error } = await supabase
      .from('recruitment_jobs')
      .update({
        title: body.title,
        department: body.department,
        location: body.location,
        type: body.type,
        experience: body.experience,
        description: body.description,
        requirements: body.requirements,
        status: body.status,
        platforms: body.platforms,
        ...auditUpdate(c),
      })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) return c.json({ success: false, error: error.message }, 404);
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update job' }, 500);
  }
});

app.delete('/jobs/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('recruitment_jobs')
      .delete()
      .eq('id', c.req.param('id'));

    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, message: 'Job deleted successfully' });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete job' }, 500);
  }
});

// ==================== STATS ====================

app.get('/stats', async (c) => {
  try {
    const supabase = getSupabase();
    const { data: candidates } = await supabase
      .from('recruitment_candidates')
      .select('stage, status, applied_date, updated_at');

    const total = candidates?.length || 0;
    const active = candidates?.filter((c: any) => c.status === 'Active').length || 0;
    const interviewsScheduled = candidates?.filter((c: any) =>
      ['Interview Scheduled', 'Interview Done'].includes(c.stage)
    ).length || 0;
    const offersExtended = candidates?.filter((c: any) => c.stage === 'Offer Sent').length || 0;
    const hired = candidates?.filter((c: any) => c.stage === 'Hired').length || 0;
    const rejected = candidates?.filter((c: any) => c.stage === 'Rejected').length || 0;
    const conversionRate = total > 0 ? Math.round((hired / total) * 100) : 0;

    return c.json({
      success: true,
      data: {
        totalCandidates: total,
        activeCandidates: active,
        interviewsScheduled,
        offersExtended,
        hired,
        rejected,
        avgTimeToHire: 21,
        conversionRate,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch statistics' }, 500);
  }
});

export default app;
