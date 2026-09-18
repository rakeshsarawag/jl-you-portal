import { useState, useEffect, useCallback } from "react";
import { API_BASE, safeJson, apiHeaders } from "../utils/constants";
import { toast } from "sonner";

const RECRUIT_URL = `${API_BASE}/recruitment`;

// ==================== TYPES ====================

export interface CandidateAttachment {
  name: string;
  url?: string;
}

interface CandidateMeta {
  nationality?: string;
  partOfOrganization?: boolean;
  previousCompany?: string;
  servingNoticePeriod?: boolean;
  noticePeriodEndDate?: string;
  attachments?: CandidateAttachment[];
  userNotes?: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  experience: number;
  currentCompany?: string;
  currentSalary?: string;
  expectedSalary: string;
  noticePeriod: string;
  source: string;
  stage: string;
  appliedDate: string;
  resumeUrl?: string;
  rating?: number;
  skills?: string[];
  status?: string;
  hiringManager?: string;
  // Extended fields (serialized into notes on the backend)
  nationality?: string;
  partOfOrganization?: boolean;
  previousCompany?: string;
  servingNoticePeriod?: boolean;
  noticePeriodEndDate?: string;
  attachments?: CandidateAttachment[];
  userNotes?: string;
  // Agency sourcing
  agency_name?: string;
  agency_email?: string;
  agency_fee?: number;
  // Relations
  interviews: Interview[];
  feedback: Feedback[];
  createdAt: string;
  updatedAt: string;
}

export interface Interview {
  id: string;
  type: string;
  date: string;
  time: string;
  interviewer: string;
  duration: string;
  meetingLink?: string;
  status: string;
  notes?: string;
}

export interface Feedback {
  id: string;
  interviewId?: string;
  interviewer: string;
  date: string;
  rating: number;
  technicalSkills?: number;
  communication?: number;
  culturalFit?: number;
  comments: string;
  recommendation: string;
}

export interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  experience: string;
  description: string;
  requirements?: string[];
  postedDate: string;
  status: string;
  applicants: number;
  platforms?: string[];
  createdAt: string;
  updatedAt: string;
  // Extended fields (serialized into description as JSON meta)
  workMode?: string;
  salaryMin?: string;
  salaryMax?: string;
  headcount?: number;
  deadline?: string;
  hiringManager?: string;
  requiredSkills?: string[];
  benefits?: string;
}

export interface RecruitmentStats {
  totalCandidates: number;
  activeCandidates: number;
  interviewsScheduled: number;
  offersExtended: number;
  hired: number;
  rejected: number;
  avgTimeToHire?: number;
  conversionRate?: number;
}

export interface BulkUploadResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  successful: string[];
  failed: Array<{ row: number; error: string; data: Record<string, string> }>;
}

// ==================== JOB META HELPERS ====================
// Extended job fields are serialized into the `description` column as a JSON block prefixed by __JOBMETA__.

interface JobMeta {
  workMode?: string;
  salaryMin?: string;
  salaryMax?: string;
  headcount?: number;
  deadline?: string;
  hiringManager?: string;
  requiredSkills?: string[];
  benefits?: string;
  plain?: string;
}

function parseJobDescription(raw: string | null | undefined): { plain: string; meta: JobMeta } {
  if (!raw) return { plain: "", meta: {} };
  if (raw.startsWith("__JOBMETA__")) {
    try {
      const { plain = "", ...meta } = JSON.parse(raw.slice(11)) as JobMeta;
      return { plain, meta };
    } catch {}
  }
  return { plain: raw, meta: {} };
}

function serializeJobDescription(plain: string, meta: Omit<JobMeta, "plain">): string {
  return "__JOBMETA__" + JSON.stringify({ ...meta, plain });
}

function shapedJob(j: any): JobPosting {
  // Support both direct columns (migration 02) and legacy __JOBMETA__ description
  const raw = j.description ?? "";
  const { plain: legacyPlain, meta: legacyMeta } = parseJobDescription(raw);
  const hasLegacyMeta = raw.startsWith("__JOBMETA__");
  return {
    id: j.id,
    title: j.title ?? "",
    department: j.department ?? "",
    location: j.location ?? "",
    type: j.type ?? "",
    experience: j.experience ?? "",
    description: hasLegacyMeta ? legacyPlain : raw,
    requirements: j.requirements ?? [],
    postedDate: j.posted_date ?? j.postedDate ?? "",
    status: j.status ?? "Active",
    applicants: j.applicants ?? 0,
    platforms: j.platforms ?? [],
    createdAt: j.created_at ?? j.createdAt ?? "",
    updatedAt: j.updated_at ?? j.updatedAt ?? "",
    // Direct columns first, fall back to legacy meta
    workMode: j.work_mode ?? legacyMeta.workMode,
    salaryMin: j.salary_min ?? legacyMeta.salaryMin,
    salaryMax: j.salary_max ?? legacyMeta.salaryMax,
    headcount: j.headcount ?? legacyMeta.headcount,
    deadline: j.deadline ?? legacyMeta.deadline,
    hiringManager: j.hiring_manager ?? legacyMeta.hiringManager,
    requiredSkills: j.required_skills ?? legacyMeta.requiredSkills ?? [],
    benefits: j.benefits ?? legacyMeta.benefits,
  };
}

// ==================== NOTES HELPERS ====================
// Legacy: some candidates may still have JSON-encoded notes from before the
// migration added separate columns. parseNotes is kept for read-side backward
// compat; serializeNotes is no longer used for new writes.

function parseNotes(raw: string | null | undefined): CandidateMeta {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as CandidateMeta;
    return { userNotes: raw };
  } catch {
    return { userNotes: raw };
  }
}

function shapedCandidate(c: any): Candidate {
  // For backward compat: if direct columns are null, fall back to legacy JSON notes
  const meta = parseNotes(c.notes);
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone ?? "",
    position: c.position ?? "",
    department: c.department ?? "",
    experience: c.experience ?? 0,
    currentCompany: c.current_company ?? c.currentCompany,
    currentSalary: c.current_salary ?? c.currentSalary,
    expectedSalary: c.expected_salary ?? c.expectedSalary ?? "",
    noticePeriod: c.notice_period ?? c.noticePeriod ?? "",
    source: c.source ?? "",
    stage: c.stage ?? "Applied",
    appliedDate: c.applied_date ?? c.appliedDate ?? "",
    resumeUrl: c.resume_url ?? c.resumeUrl,
    rating: c.rating,
    skills: c.skills ?? [],
    status: c.status,
    hiringManager: c.hiring_manager ?? c.hiringManager,
    createdAt: c.created_at ?? c.createdAt ?? "",
    updatedAt: c.updated_at ?? c.updatedAt ?? "",
    interviews: (c.interviews ?? []).map((iv: any) => ({
      id: iv.id,
      type: iv.type,
      date: iv.interview_date ?? iv.date ?? "",
      time: iv.interview_time ?? iv.time ?? "",
      interviewer: iv.interviewer ?? "",
      duration: iv.duration ?? "60 min",
      meetingLink: iv.meeting_link ?? iv.meetingLink,
      status: iv.status ?? "Scheduled",
      notes: iv.notes,
    })),
    feedback: (c.feedback ?? []).map((fb: any) => ({
      id: fb.id,
      interviewId: fb.interview_id ?? fb.interviewId,
      interviewer: fb.interviewer ?? "",
      date: fb.feedback_date ?? fb.created_at ?? fb.date ?? "",
      rating: fb.rating ?? 0,
      technicalSkills: fb.technical_skills ?? fb.technicalSkills,
      communication: fb.communication,
      culturalFit: fb.cultural_fit ?? fb.culturalFit,
      comments: fb.comments ?? "",
      recommendation: fb.recommendation ?? "Maybe",
    })),
    // Direct columns (migration 02); fall back to legacy JSON notes for old rows
    nationality: c.nationality ?? meta.nationality,
    partOfOrganization: c.part_of_organization ?? meta.partOfOrganization,
    previousCompany: c.previous_company ?? meta.previousCompany,
    servingNoticePeriod: c.serving_notice_period ?? meta.servingNoticePeriod,
    noticePeriodEndDate: c.notice_period_end_date ?? meta.noticePeriodEndDate,
    attachments: c.attachments ?? meta.attachments ?? [],
    userNotes: c.user_notes ?? meta.userNotes,
  };
}

// ==================== API HELPER ====================

async function api(path: string, options: RequestInit = {}, userEmail?: string) {
  const res = await fetch(path, {
    ...options,
    headers: apiHeaders(userEmail),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return safeJson(res);
}

// ==================== HOOK ====================

const INTERVIEW_STAGES = ["Interview Scheduled", "Interview Done", "HR Round Done"];

export function useRecruitmentData(userEmail?: string) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [stats, setStats] = useState<RecruitmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [candidatesRes, jobsRes, statsRes] = await Promise.allSettled([
      api(`${RECRUIT_URL}/candidates`, {}, userEmail),
      api(`${RECRUIT_URL}/jobs`, {}, userEmail),
      api(`${RECRUIT_URL}/stats`, {}, userEmail),
    ]);

    if (candidatesRes.status === "fulfilled") {
      const raw = candidatesRes.value;
      const list = Array.isArray(raw) ? raw : (raw?.data ?? raw?.candidates ?? []);
      setCandidates(list.map(shapedCandidate));
    } else {
      setError(candidatesRes.reason?.message ?? "Failed to load candidates");
    }

    if (jobsRes.status === "fulfilled") {
      const raw = jobsRes.value;
      const list = Array.isArray(raw) ? raw : (raw?.data ?? raw?.jobs ?? []);
      setJobPostings(list.map(shapedJob));
    }

    if (statsRes.status === "fulfilled") {
      const raw = statsRes.value;
      setStats(raw?.data ?? raw);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ==================== CANDIDATES ====================

  const addCandidate = useCallback(
    async (candidate: Omit<Candidate, "id" | "interviews" | "feedback" | "createdAt" | "updatedAt">) => {
      const { nationality, partOfOrganization, previousCompany, servingNoticePeriod, noticePeriodEndDate, attachments, userNotes, ...rest } = candidate;
      const res = await api(`${RECRUIT_URL}/candidates`, {
        method: "POST",
        body: JSON.stringify({
          ...rest,
          nationality,
          part_of_organization: partOfOrganization,
          previous_company: previousCompany,
          serving_notice_period: servingNoticePeriod,
          notice_period_end_date: noticePeriodEndDate,
          attachments: attachments ?? [],
          user_notes: userNotes,
        }),
      }, userEmail);
      const created: Candidate = shapedCandidate(res?.data ?? res);
      setCandidates((prev) => [...prev, created]);
      return created;
    },
    []
  );

  const updateCandidate = useCallback(async (id: string, updates: Partial<Candidate>) => {
    const { nationality, partOfOrganization, previousCompany, servingNoticePeriod, noticePeriodEndDate, attachments, userNotes, ...rest } = updates;
    const payload: Record<string, unknown> = { ...rest };
    if (nationality !== undefined) payload.nationality = nationality;
    if (partOfOrganization !== undefined) payload.part_of_organization = partOfOrganization;
    if (previousCompany !== undefined) payload.previous_company = previousCompany;
    if (servingNoticePeriod !== undefined) payload.serving_notice_period = servingNoticePeriod;
    if (noticePeriodEndDate !== undefined) payload.notice_period_end_date = noticePeriodEndDate;
    if (attachments !== undefined) payload.attachments = attachments;
    if (userNotes !== undefined) payload.user_notes = userNotes;

    const res = await api(`${RECRUIT_URL}/candidates/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }, userEmail);
    const updated: Candidate = shapedCandidate(res?.data ?? res);
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, ...updated, interviews: updated.interviews?.length ? updated.interviews : c.interviews, feedback: updated.feedback?.length ? updated.feedback : c.feedback }
          : c
      )
    );
    return updated;
  }, []);

  const deleteCandidate = useCallback(async (id: string) => {
    await api(`${RECRUIT_URL}/candidates/${id}`, { method: "DELETE" }, userEmail);
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const hireCandidate = useCallback(
    async (candidateId: string, candidateName: string, email: string, position: string, department: string) => {
      await api(`${RECRUIT_URL}/candidates/${candidateId}`, {
        method: "PUT",
        body: JSON.stringify({ stage: "Hired" }),
      }, userEmail);
      setCandidates((prev) => prev.map((c) => (c.id === candidateId ? { ...c, stage: "Hired" } : c)));

      // Enrich onboarding record with all available candidate data
      const candidate = candidates.find((c) => c.id === candidateId);
      await api(`${API_BASE}/onboarding/employees`, {
        method: "POST",
        body: JSON.stringify({
          name: candidateName,
          email,
          phone: candidate?.phone ?? "",
          position,
          department,
          joiningDate: new Date().toISOString().slice(0, 10),
          status: "Pending",
          source: "Recruitment",
          recruitmentCandidateId: candidateId,
          nationality: candidate?.nationality ?? "",
          offeredCTC: candidate?.expectedSalary ?? "",
          notes: candidate?.userNotes ?? "",
        }),
      }, userEmail);

      toast.success("Candidate hired! Onboarding record created.");
    },
    [candidates]
  );

  const generateOfferLetter = useCallback(
    async (candidateId: string) => {
      const candidate = candidates.find((c) => c.id === candidateId);
      if (!candidate) throw new Error("Candidate not found");

      await api(`${RECRUIT_URL}/candidates/${candidateId}`, {
        method: "PUT",
        body: JSON.stringify({ stage: "Offer Sent" }),
      }, userEmail);
      setCandidates((prev) => prev.map((c) => (c.id === candidateId ? { ...c, stage: "Offer Sent" } : c)));

      return `OFFER LETTER\n\nDear ${candidate.name},\n\nWe are pleased to offer you the position of ${candidate.position} in the ${candidate.department} department.\n\nExpected Start Date: ${new Date().toLocaleDateString()}\nCompensation: ${candidate.expectedSalary}\n\nPlease review and sign within 5 business days.\n\nRegards,\nHR Team`;
    },
    [candidates]
  );

  // ==================== INTERVIEWS ====================

  const addInterview = useCallback(async (candidateId: string, interview: Omit<Interview, "id">) => {
    const res = await api(`${RECRUIT_URL}/candidates/${candidateId}/interviews`, {
      method: "POST",
      body: JSON.stringify(interview),
    }, userEmail);
    const created: Interview = res?.data ?? res;
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, interviews: [...(c.interviews ?? []), { ...created, date: created.date || interview.date, time: created.time || interview.time }] } : c))
    );
    return created;
  }, []);

  // ==================== FEEDBACK ====================

  const addFeedback = useCallback(async (candidateId: string, feedback: Omit<Feedback, "id">) => {
    const { interviewId, technicalSkills, culturalFit, ...rest } = feedback;
    const res = await api(`${RECRUIT_URL}/candidates/${candidateId}/feedback`, {
      method: "POST",
      body: JSON.stringify({
        ...rest,
        interview_id: interviewId,
        technical_skills: technicalSkills,
        cultural_fit: culturalFit,
      }),
    }, userEmail);
    const created: Feedback = {
      ...(res?.data ?? res),
      interviewId: (res?.data ?? res)?.interview_id ?? interviewId,
      technicalSkills: (res?.data ?? res)?.technical_skills ?? technicalSkills,
      culturalFit: (res?.data ?? res)?.cultural_fit ?? culturalFit,
    };
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, feedback: [...(c.feedback ?? []), created] } : c))
    );
    return created;
  }, []);

  // ==================== JOBS ====================

  const addJob = useCallback(async (job: Omit<JobPosting, "id" | "createdAt" | "updatedAt" | "applicants">) => {
    const { workMode, salaryMin, salaryMax, headcount, deadline, hiringManager, requiredSkills, benefits, ...rest } = job;
    const payload = {
      ...rest,
      work_mode: workMode,
      salary_min: salaryMin,
      salary_max: salaryMax,
      headcount,
      deadline,
      hiring_manager: hiringManager,
      required_skills: requiredSkills ?? [],
      benefits,
    };
    const res = await api(`${RECRUIT_URL}/jobs`, { method: "POST", body: JSON.stringify(payload) }, userEmail);
    const created = shapedJob(res?.data ?? res);
    setJobPostings((prev) => [...prev, created]);
    return created;
  }, []);

  const updateJob = useCallback(async (id: string, updates: Partial<JobPosting>) => {
    const { workMode, salaryMin, salaryMax, headcount, deadline, hiringManager, requiredSkills, benefits, ...rest } = updates;
    const payload: Record<string, unknown> = { ...rest };
    if (workMode !== undefined) payload.work_mode = workMode;
    if (salaryMin !== undefined) payload.salary_min = salaryMin;
    if (salaryMax !== undefined) payload.salary_max = salaryMax;
    if (headcount !== undefined) payload.headcount = headcount;
    if (deadline !== undefined) payload.deadline = deadline;
    if (hiringManager !== undefined) payload.hiring_manager = hiringManager;
    if (requiredSkills !== undefined) payload.required_skills = requiredSkills;
    if (benefits !== undefined) payload.benefits = benefits;
    const res = await api(`${RECRUIT_URL}/jobs/${id}`, { method: "PUT", body: JSON.stringify(payload) }, userEmail);
    const updated = shapedJob(res?.data ?? res);
    setJobPostings((prev) => prev.map((j) => (j.id === id ? { ...j, ...updated } : j)));
    return updated;
  }, [jobPostings]);

  const deleteJob = useCallback(async (id: string) => {
    await api(`${RECRUIT_URL}/jobs/${id}`, { method: "DELETE" }, userEmail);
    setJobPostings((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const moveToNextStage = useCallback(
    async (candidateId: string) => {
      const STAGES = ["Applied", "Screening", "Interview Scheduled", "Interview Done", "HR Round Done", "Offer Sent", "Offer Accepted", "Hired"];
      const candidate = candidates.find((c) => c.id === candidateId);
      if (!candidate) return;
      const idx = STAGES.indexOf(candidate.stage);
      if (idx < 0 || idx >= STAGES.length - 1) return;

      // Gate: feedback required before leaving any interview stage
      if (INTERVIEW_STAGES.includes(candidate.stage) && (candidate.feedback ?? []).length === 0) {
        throw new Error(`Feedback is required before advancing from the "${candidate.stage}" stage. Please submit interview feedback first.`);
      }

      await updateCandidate(candidateId, { stage: STAGES[idx + 1] });
    },
    [candidates, updateCandidate]
  );

  // ==================== BULK UPLOAD ====================

  const bulkUpload = useCallback(async (rows: Record<string, string>[]): Promise<BulkUploadResult> => {
    const mapped = rows.map((r) => ({
      name: r.Name ?? r.name ?? "",
      email: r.Email ?? r.email ?? "",
      phone: r.Phone ?? r.phone ?? "",
      position: r.Position ?? r.position ?? "",
      department: r.Department ?? r.department ?? "",
      experience: Number(r.Experience ?? r.experience ?? 0) || 0,
      expectedSalary: r["Expected Salary"] ?? r.expectedSalary ?? r.expected_salary ?? "",
      noticePeriod: r["Notice Period"] ?? r.noticePeriod ?? r.notice_period ?? "",
      source: r.Source ?? r.source ?? "Excel Upload",
      skills: (r.Skills ?? r.skills ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
      nationality: r.Nationality ?? r.nationality ?? "",
      previousCompany: r["Previous Company"] ?? r.previousCompany ?? "",
      notes: r.Notes ?? r.notes ?? "",
    }));

    const res = await api(`${RECRUIT_URL}/bulk-upload`, {
      method: "POST",
      body: JSON.stringify({ candidates: mapped }),
    }, userEmail);

    const result: BulkUploadResult = res?.data ?? res;
    // Reload after bulk upload
    await loadAll();
    return result;
  }, [loadAll]);

  return {
    candidates,
    jobPostings,
    stats,
    loading,
    error,
    refresh: loadAll,
    addCandidate,
    updateCandidate,
    deleteCandidate,
    hireCandidate,
    generateOfferLetter,
    addInterview,
    addFeedback,
    addJob,
    updateJob,
    deleteJob,
    moveToNextStage,
    bulkUpload,
  };
}
