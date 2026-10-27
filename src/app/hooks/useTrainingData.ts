import { useState, useCallback } from 'react';
import { API_BASE, publicAnonKey, safeJson, apiHeaders } from '../utils/constants';
import { TRAINING_STATUSES } from '../../constants/apps/training';

const TRAIN_URL = `${API_BASE}/training`;

type TrainingStatus = (typeof TRAINING_STATUSES)[number];

const COURSE_TITLE_ALIASES: Record<string, string> = {
  'information security awareness': 'information security, phishing & account protection',
  'prevention of sexual harassment (posh)': 'prevention of sexual harassment & respectful workplace',
  'code of conduct & ethics': 'code of conduct, ethics & acceptable use',
  'data privacy & gdpr compliance': 'data privacy & secure data handling',
};

function canonicalCourseKey(title: string) {
  const normalized = title.trim().toLowerCase();
  return COURSE_TITLE_ALIASES[normalized] || normalized;
}

function dedupeCourses(items: Course[]) {
  const coursesByTopic = new Map<string, Course>();
  for (const course of items) {
    const key = canonicalCourseKey(course.title);
    const existing = coursesByTopic.get(key);
    const quality = (course.content?.length || 0) * 10 + (course.assessmentRequired ? 5 : 0);
    const existingQuality = existing
      ? (existing.content?.length || 0) * 10 + (existing.assessmentRequired ? 5 : 0)
      : -1;
    if (!existing || quality > existingQuality) coursesByTopic.set(key, course);
  }
  return [...coursesByTopic.values()];
}

function enrollmentStrength(enrollment: Enrollment) {
  const completed = enrollment.status === 'Completed' ? 1 : 0;
  return (
    (enrollment.assessmentPassed ? 1_000_000 : 0) +
    completed * 100_000 +
    (enrollment.progress ?? 0) * 100 +
    (enrollment.bestScore ?? enrollment.score ?? 0)
  );
}

/**
 * Legacy seed data can contain equivalent courses under old and new titles.
 * Keep one enrollment per employee/topic and point it at the canonical course
 * used by the catalogue, without deleting the underlying enrollment history.
 */
export function dedupeTrainingEnrollments(
  items: Enrollment[],
  canonicalCourses: Course[] = [],
) {
  const courseByTopic = new Map(
    canonicalCourses.map(course => [canonicalCourseKey(course.title), course]),
  );
  const enrollmentByEmployeeAndTopic = new Map<string, Enrollment>();

  for (const enrollment of items) {
    const topic = canonicalCourseKey(enrollment.courseName);
    const employee = enrollment.employeeId || enrollment.employeeName.trim().toLowerCase();
    const key = `${employee}::${topic}`;
    const canonicalCourse = courseByTopic.get(topic);
    const normalized = canonicalCourse
      ? { ...enrollment, courseId: canonicalCourse.id, courseName: canonicalCourse.title }
      : enrollment;
    const existing = enrollmentByEmployeeAndTopic.get(key);

    if (!existing || enrollmentStrength(normalized) > enrollmentStrength(existing)) {
      enrollmentByEmployeeAndTopic.set(key, normalized);
    }
  }

  return [...enrollmentByEmployeeAndTopic.values()];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  mode: string;
  duration: string;
  instructor: string;
  mandatory: boolean;
  assessmentRequired: boolean;
  passingScore: number;
  deadlineDays: number;
  renewalMonths: number;
  content: Array<{ title: string; body: string; bullets?: string[] }>;
  standardReferences: Array<{ name: string; url: string }>;
  enrolledCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Enrollment {
  id: string;
  courseId: string;
  courseName: string;
  employeeId: string;
  employeeName: string;
  status: TrainingStatus;
  progress: number;
  mandatory: boolean;
  assessmentRequired: boolean;
  dueDate?: string;
  startDate: string;
  completedDate?: string;
  score?: number;
  bestScore?: number;
  assessmentPassed: boolean;
  assessmentAttempts: number;
  passingScore?: number;
}

export interface AssessmentQuestion {
  id: string;
  question: string;
  options: string[];
  explanation?: string;
  sort_order: number;
}

export interface Assessment {
  course: Course;
  questions: AssessmentQuestion[];
}

export interface AssessmentResult {
  enrollment: Enrollment;
  score: number;
  passingScore: number;
  passed: boolean;
  correct: number;
  total: number;
}

export interface Certificate {
  id: string;
  courseId: string;
  courseName: string;
  employeeId: string;
  employeeName: string;
  completedDate: string;
  score: number;
  certificateUrl: string;
  createdAt: string;
}



async function apiFetch<T>(url: string, options?: RequestInit, userEmail?: string): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: apiHeaders(userEmail),
  });
  const json = await safeJson(res);
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error ?? json?.message ?? `Request failed: ${res.status}`);
  }
  return (json?.data ?? json) as T;
}

export function useTrainingData(userEmail?: string) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async (userId?: string) => {
    setLoading(true);
    setError(null);

    const enrollQuery = userId ? `?employeeId=${userId}` : '';
    const certQuery = userId ? `?employeeId=${userId}` : '';

    const [coursesRes, enrollmentsRes, certificatesRes] = await Promise.allSettled([
      apiFetch<Course[]>(`${TRAIN_URL}/courses`, {}, userEmail),
      apiFetch<Enrollment[]>(`${TRAIN_URL}/enrollments${enrollQuery}`, {}, userEmail),
      apiFetch<Certificate[]>(`${TRAIN_URL}/certificates${certQuery}`, {}, userEmail),
    ]);

    const canonicalCourses = coursesRes.status === 'fulfilled'
      ? dedupeCourses(coursesRes.value)
      : [];

    if (coursesRes.status === 'fulfilled') {
      setCourses(canonicalCourses);
    } else {
      setError((coursesRes.reason as Error)?.message ?? 'Failed to load courses');
    }

    if (enrollmentsRes.status === 'fulfilled') {
      setEnrollments(dedupeTrainingEnrollments(enrollmentsRes.value, canonicalCourses));
    }
    if (certificatesRes.status === 'fulfilled') setCertificates(certificatesRes.value);

    setLoading(false);
  }, []);

  const createCourse = useCallback(async (courseData: Partial<Course>): Promise<Course> => {
    const created = await apiFetch<Course>(`${TRAIN_URL}/courses`, {
      method: 'POST',
      body: JSON.stringify(courseData),
    }, userEmail);
    setCourses((prev) => dedupeCourses([created, ...prev]));
    return created;
  }, []);

  const updateCourse = useCallback(async (id: string, updates: Partial<Course>): Promise<Course> => {
    const updated = await apiFetch<Course>(`${TRAIN_URL}/courses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }, userEmail);
    setCourses((prev) => dedupeCourses(prev.map((c) => (c.id === id ? updated : c))));
    return updated;
  }, []);

  const deleteCourse = useCallback(async (id: string): Promise<void> => {
    await apiFetch<unknown>(`${TRAIN_URL}/courses/${id}`, { method: 'DELETE' }, userEmail);
    setCourses((prev) => prev.filter((c) => c.id !== id));
    setEnrollments((prev) => prev.filter((e) => e.courseId !== id));
  }, []);

  const enrollEmployee = useCallback(
    async (courseId: string, employeeId: string, employeeName: string): Promise<Enrollment> => {
      const enrollment = await apiFetch<Enrollment>(`${TRAIN_URL}/enrollments`, {
        method: 'POST',
        body: JSON.stringify({ courseId, employeeId, employeeName }),
      }, userEmail);
      setEnrollments((prev) => dedupeTrainingEnrollments([enrollment, ...prev], courses));
      setCourses((prev) =>
        prev.map((c) =>
          c.id === courseId ? { ...c, enrolledCount: (c.enrolledCount ?? 0) + 1 } : c,
        ),
      );
      return enrollment;
    },
    [courses],
  );

  const updateProgress = useCallback(
    async (enrollmentId: string, progress: number): Promise<Enrollment> => {
      const updated = await apiFetch<Enrollment>(
        `${TRAIN_URL}/enrollments/${enrollmentId}/progress`,
        { method: 'PUT', body: JSON.stringify({ progress }) },
        userEmail);
      setEnrollments((prev) => prev.map((e) => (e.id === enrollmentId ? updated : e)));
      return updated;
    },
    [],
  );

  const unenroll = useCallback(async (enrollmentId: string): Promise<void> => {
    await apiFetch<unknown>(`${TRAIN_URL}/enrollments/${enrollmentId}`, { method: 'DELETE' }, userEmail);
    setEnrollments((prev) => prev.filter((e) => e.id !== enrollmentId));
  }, []);

  const issueCertificate = useCallback(async (enrollmentId: string): Promise<Certificate> => {
    const cert = await apiFetch<Certificate>(
      `${TRAIN_URL}/enrollments/${enrollmentId}/certificate`,
      { method: 'POST' },
      userEmail);
    setCertificates((prev) => [cert, ...prev]);
    return cert;
  }, []);

  const getAssessment = useCallback(async (courseId: string): Promise<Assessment> =>
    apiFetch<Assessment>(`${TRAIN_URL}/courses/${courseId}/assessment`, {}, userEmail), []);

  const submitAssessment = useCallback(async (
    enrollmentId: string,
    answers: Record<string, number>,
  ): Promise<AssessmentResult> => {
    const result = await apiFetch<AssessmentResult>(
      `${TRAIN_URL}/enrollments/${enrollmentId}/assessment`,
      { method: 'POST', body: JSON.stringify({ answers }) },
      userEmail,
    );
    setEnrollments((prev) => prev.map((item) =>
      item.id === enrollmentId ? result.enrollment : item
    ));
    return result;
  }, []);

  return {
    courses,
    enrollments,
    certificates,
    loading,
    error,
    loadAll,
    refresh: loadAll,
    createCourse,
    updateCourse,
    deleteCourse,
    enrollEmployee,
    updateProgress,
    unenroll,
    issueCertificate,
    getAssessment,
    submitAssessment,
  };
}
