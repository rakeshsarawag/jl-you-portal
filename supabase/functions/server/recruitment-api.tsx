import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { auditCreate, auditUpdate, logAuditFromContext } from "./audit-helpers.ts";
import { requireFields, requireParam } from "./validate.ts";
import { writeWithSchemaCompatibility } from "./schema-compat.ts";
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

function normalizedCandidateExperience(candidate: Record<string, any>): number {
  const years = Number(candidate.experienceYears);
  const months = Number(candidate.experienceMonths);
  if (Number.isInteger(years) && years >= 0 && Number.isInteger(months) && months >= 0 && months <= 11) {
    return Number((years + months / 12).toFixed(2));
  }
  const experience = Number(candidate.experience ?? 0);
  return Number.isFinite(experience) && experience >= 0 ? experience : 0;
}

function mappedUpdates(
  body: Record<string, any>,
  mappings: Array<[column: string, keys: string[], transform?: (value: any) => any]>,
) {
  const updates: Record<string, any> = {};
  for (const [column, keys, transform] of mappings) {
    const key = keys.find(candidate => body[candidate] !== undefined);
    if (!key) continue;
    updates[column] = transform ? transform(body[key]) : body[key];
  }
  return updates;
}

const CANDIDATE_FIELD_MAPPINGS: Array<[string, string[], ((value: any) => any)?]> = [
  ['name', ['name']],
  ['email', ['email']],
  ['phone', ['phone']],
  ['position', ['position']],
  ['department', ['department']],
  ['job_id', ['jobId', 'job_id'], value => value || null],
  ['experience', ['experience']],
  ['current_company', ['currentCompany', 'current_company']],
  ['current_salary', ['currentSalary', 'current_salary']],
  ['expected_salary', ['expectedSalary', 'expected_salary']],
  ['notice_period', ['noticePeriod', 'notice_period']],
  ['source', ['source']],
  ['stage', ['stage']],
  ['applied_date', ['appliedDate', 'applied_date'], value => value || null],
  ['resume_url', ['resumeUrl', 'resume_url'], value => value || null],
  ['rating', ['rating']],
  ['skills', ['skills']],
  ['status', ['status']],
  ['hiring_manager', ['hiringManager', 'hiring_manager']],
  ['notes', ['notes']],
  ['offer_sent_date', ['offerSentDate', 'offer_sent_date'], value => value || null],
  ['offer_accepted_date', ['offerAcceptedDate', 'offer_accepted_date'], value => value || null],
  ['expected_joining_date', ['expectedJoiningDate', 'expected_joining_date'], value => value || null],
  ['expertise', ['expertise']],
  ['nationality', ['nationality']],
  ['part_of_organization', ['partOfOrganization', 'part_of_organization']],
  ['previous_company', ['previousCompany', 'previous_company']],
  ['serving_notice_period', ['servingNoticePeriod', 'serving_notice_period']],
  ['notice_period_end_date', ['noticePeriodEndDate', 'notice_period_end_date'], value => value || null],
  ['attachments', ['attachments']],
  ['user_notes', ['userNotes', 'user_notes']],
  ['agency_name', ['agencyName', 'agency_name']],
  ['agency_email', ['agencyEmail', 'agency_email']],
  ['agency_fee', ['agencyFee', 'agency_fee']],
];

const JOB_FIELD_MAPPINGS: Array<[string, string[], ((value: any) => any)?]> = [
  ['title', ['title']],
  ['department', ['department']],
  ['location', ['location']],
  ['type', ['type']],
  ['experience', ['experience']],
  ['description', ['description']],
  ['requirements', ['requirements']],
  ['posted_date', ['postedDate', 'posted_date'], value => value || null],
  ['status', ['status']],
  ['platforms', ['platforms']],
  ['work_mode', ['workMode', 'work_mode']],
  ['salary_min', ['salaryMin', 'salary_min']],
  ['salary_max', ['salaryMax', 'salary_max']],
  ['headcount', ['headcount']],
  ['deadline', ['deadline'], value => value || null],
  ['hiring_manager', ['hiringManager', 'hiring_manager']],
  ['required_skills', ['requiredSkills', 'required_skills']],
  ['benefits', ['benefits']],
];

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
    const v = await requireFields(c, ['name', 'email']);
    if (!v.ok) return v.response;
    const body = v.body;

    const record = {
      name: body.name,
      email: body.email,
      phone: body.phone || '',
      position: body.position || '',
      department: body.department || '',
      job_id: body.jobId || body.job_id || null,
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
      expertise: body.expertise || '',
      nationality: body.nationality || '',
      part_of_organization: body.partOfOrganization ?? body.part_of_organization ?? false,
      previous_company: body.previousCompany || body.previous_company || '',
      serving_notice_period: body.servingNoticePeriod ?? body.serving_notice_period ?? false,
      notice_period_end_date: body.noticePeriodEndDate || body.notice_period_end_date || null,
      attachments: body.attachments || [],
      user_notes: body.userNotes || body.user_notes || '',
      agency_name: body.agencyName || body.agency_name || '',
      agency_email: body.agencyEmail || body.agency_email || '',
      agency_fee: body.agencyFee ?? body.agency_fee ?? null,
      ...auditCreate(c),
    };
    const { data, error } = await writeWithSchemaCompatibility(
      record,
      compatibleRecord => supabase
        .from('recruitment_candidates')
        .insert([compatibleRecord])
        .select()
        .single(),
    );

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

      const missing = ['name', 'email', 'position', 'department'].filter(f => !cd[f]);
      if (missing.length) {
        results.failed.push({ row, error: `Missing: ${missing.join(', ')}`, data: cd });
        continue;
      }

      if (existingEmails.has(cd.email.toLowerCase())) {
        results.failed.push({ row, error: `Email ${cd.email} already exists`, data: cd });
        continue;
      }

      const record = {
        name: cd.name,
        email: cd.email,
        phone: cd.phone,
        position: cd.position,
        department: cd.department,
        job_id: cd.jobId || cd.job_id || null,
        experience: normalizedCandidateExperience(cd),
        current_company: cd.currentCompany || '',
        current_salary: cd.currentSalary || '',
        expected_salary: cd.expectedSalary || '',
        notice_period: cd.noticePeriod || '',
        source: cd.source || 'Excel Upload',
        stage: 'Applied',
        applied_date: cd.appliedDate || new Date().toISOString().split('T')[0],
        skills: cd.skills || [],
        status: 'Active',
        hiring_manager: cd.hiringManager || '',
        notes: '',
        user_notes: cd.userNotes || cd.user_notes || cd.notes || '',
        expertise: cd.expertise || cd.Expertise || '',
        nationality: cd.nationality || '',
        part_of_organization: cd.partOfOrganization ?? cd.part_of_organization ?? false,
        previous_company: cd.previousCompany || cd.previous_company || '',
        serving_notice_period: cd.servingNoticePeriod ?? cd.serving_notice_period ?? false,
        notice_period_end_date: cd.noticePeriodEndDate || cd.notice_period_end_date || null,
        attachments: cd.attachments || [],
        agency_name: cd.agencyName || cd.agency_name || '',
        agency_email: cd.agencyEmail || cd.agency_email || '',
        agency_fee: cd.agencyFee ?? cd.agency_fee ?? null,
        ...auditCreate(c),
      };
      const { error } = await writeWithSchemaCompatibility(
        record,
        compatibleRecord => supabase.from('recruitment_candidates').insert([compatibleRecord]),
      );

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
    const pv = requireParam(c, 'id');
    if (!pv.ok) return pv.response;
    const body = await c.req.json();
    const updates = {
      ...mappedUpdates(body, CANDIDATE_FIELD_MAPPINGS),
      ...auditUpdate(c),
    };
    const { data, error } = await writeWithSchemaCompatibility(
      updates,
      compatibleUpdates => supabase
        .from('recruitment_candidates')
        .update(compatibleUpdates)
        .eq('id', c.req.param('id'))
        .select()
        .single(),
    );

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
    const updates = {
      ...mappedUpdates(rest, CANDIDATE_FIELD_MAPPINGS),
      ...auditUpdate(c),
    };
    const { data, error } = await writeWithSchemaCompatibility(
      updates,
      compatibleUpdates => supabase
        .from('recruitment_candidates')
        .update(compatibleUpdates)
        .eq('id', id)
        .select()
        .single(),
    );

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

    const interview = {
      candidate_id: candidateId,
      type: body.type,
      interview_date: body.date,
      interview_time: body.time,
      interviewer: body.interviewer,
      duration: body.duration,
      meeting_link: body.meetingLink || null,
      status: body.status || 'Scheduled',
      notes: body.notes || '',
      location_type: body.location_type === 'remote' ? 'virtual' : body.location_type === 'in-person' ? 'in_person' : body.location_type || 'virtual',
      location_address: body.location_address || null,
      ics_uid: body.ics_uid || null,
      calendar_event_url: body.calendar_event_url || null,
      ...auditCreate(c),
    };
    const { data, error } = await writeWithSchemaCompatibility(
      interview,
      compatibleInterview => supabase
        .from('recruitment_interviews')
        .insert([compatibleInterview])
        .select()
        .single(),
    );

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

    const updates = {
      type: body.type,
      interview_date: body.date,
      interview_time: body.time,
      interviewer: body.interviewer,
      duration: body.duration,
      meeting_link: body.meetingLink,
      status: body.status,
      notes: body.notes,
      location_type: body.location_type === 'remote' ? 'virtual' : body.location_type === 'in-person' ? 'in_person' : body.location_type || 'virtual',
      location_address: body.location_address || null,
      ics_uid: body.ics_uid || null,
      calendar_event_url: body.calendar_event_url || null,
      ...auditUpdate(c),
    };
    const { data, error } = await writeWithSchemaCompatibility(
      updates,
      compatibleUpdates => supabase
        .from('recruitment_interviews')
        .update(compatibleUpdates)
        .eq('id', c.req.param('interviewId'))
        .eq('candidate_id', c.req.param('id'))
        .select()
        .single(),
    );

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

    const feedback = {
      candidate_id: candidateId,
      interview_id: body.interview_id || body.interviewId || null,
      interviewer: body.interviewer,
      rating: body.rating,
      feedback_date: String(body.date || body.feedback_date || new Date().toISOString()).slice(0, 10),
      technical_skills: body.technicalSkills ?? body.technical_skills,
      communication: body.communication,
      cultural_fit: body.culturalFit ?? body.cultural_fit,
      comments: body.comments,
      recommendation: body.recommendation,
      competency_ratings: body.competency_ratings || {},
      strengths: body.strengths || '',
      concerns: body.concerns || '',
      ...auditCreate(c),
    };
    const { data, error } = await writeWithSchemaCompatibility(
      feedback,
      compatibleFeedback => supabase
        .from('recruitment_feedback')
        .insert([compatibleFeedback])
        .select()
        .single(),
    );

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
    const v = await requireFields(c, ['title']);
    if (!v.ok) return v.response;
    const body = v.body;
    const record = {
      ...mappedUpdates(body, JOB_FIELD_MAPPINGS),
      status: body.status || 'Active',
      platforms: body.platforms || ['Company Website'],
      ...auditCreate(c),
    };
    const { data, error } = await writeWithSchemaCompatibility(
      record,
      compatibleRecord => supabase
        .from('recruitment_jobs')
        .insert([compatibleRecord])
        .select()
        .single(),
    );

    if (error) return c.json({ success: false, error: error.message }, 500);

    triggerWorkflowEvent("job_posted", "recruitment_job", data.id, {
      title: data.title,
      department: data.department,
      platforms: data.platforms,
    });
    logAuditFromContext(c, { entity_type: "recruitment_job", entity_id: data.id, action: "create", module: "recruitment", metadata: { title: data.title, department: data.department } });

    return c.json({ success: true, data }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create job' }, 500);
  }
});

app.put('/jobs/:id', async (c) => {
  try {
    const supabase = getSupabase();
    const pv = requireParam(c, 'id');
    if (!pv.ok) return pv.response;
    const body = await c.req.json();
    const updates = {
      ...mappedUpdates(body, JOB_FIELD_MAPPINGS),
      ...auditUpdate(c),
    };
    const { data, error } = await writeWithSchemaCompatibility(
      updates,
      compatibleUpdates => supabase
        .from('recruitment_jobs')
        .update(compatibleUpdates)
        .eq('id', c.req.param('id'))
        .select()
        .single(),
    );

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
