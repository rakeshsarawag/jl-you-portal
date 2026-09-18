import { useState, useCallback } from 'react';
import { API_BASE, publicAnonKey, safeJson, apiHeaders } from '../utils/constants';
import { TRAINING_STATUSES } from '../../constants/apps/training';

const TRAIN_URL = `${API_BASE}/training`;

type TrainingStatus = (typeof TRAINING_STATUSES)[number];

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
  dueDate?: string;
  startDate: string;
  completedDate?: string;
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
    throw new Error(json?.message ?? `Request failed: ${res.status}`);
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

    if (coursesRes.status === 'fulfilled') {
      setCourses(coursesRes.value);
    } else {
      setError((coursesRes.reason as Error)?.message ?? 'Failed to load courses');
    }

    if (enrollmentsRes.status === 'fulfilled') setEnrollments(enrollmentsRes.value);
    if (certificatesRes.status === 'fulfilled') setCertificates(certificatesRes.value);

    setLoading(false);
  }, []);

  const createCourse = useCallback(async (courseData: Partial<Course>): Promise<Course> => {
    const created = await apiFetch<Course>(`${TRAIN_URL}/courses`, {
      method: 'POST',
      body: JSON.stringify(courseData),
    }, userEmail);
    setCourses((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateCourse = useCallback(async (id: string, updates: Partial<Course>): Promise<Course> => {
    const updated = await apiFetch<Course>(`${TRAIN_URL}/courses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }, userEmail);
    setCourses((prev) => prev.map((c) => (c.id === id ? updated : c)));
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
      setEnrollments((prev) => [enrollment, ...prev]);
      setCourses((prev) =>
        prev.map((c) =>
          c.id === courseId ? { ...c, enrolledCount: (c.enrolledCount ?? 0) + 1 } : c,
        ),
      );
      return enrollment;
    },
    [],
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
  };
}
