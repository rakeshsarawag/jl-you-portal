import { useState, useEffect, useCallback } from 'react';
import { API_BASE, publicAnonKey, safeJson, apiHeaders } from '../utils/constants';

const ONB_URL = `${API_BASE}/onboarding`;

// ==================== TYPES ====================

export interface OnboardingCandidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  joiningDate: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'On Hold';
  progress: number;
  buddy: string;
  welcomeKit: WelcomeKit;
  checklist: ChecklistItem[];
  documents: DocumentItem[];
  videoWatched: boolean;
  createdAt: string;
  updatedAt: string;
  // Extended fields
  location?: string;
  manager?: string;
  employmentType?: string;
  workMode?: string;
  personalEmail?: string;
  gender?: string;
  nationality?: string;
  offeredCTC?: string;
  probationDays?: number;
  source?: 'Recruitment' | 'Direct' | 'Referral' | 'Bulk Upload' | 'Other';
  recruitmentCandidateId?: string;
  notes?: string;
  dateOfBirth?: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  assignedTo: 'HR' | 'IT' | 'Manager' | 'Employee';
  status: 'Pending' | 'In Progress' | 'Completed';
  dueDate: string;
  completedDate?: string;
  order: number;
}

export interface WelcomeKit {
  status: 'Not Ordered' | 'Ordered' | 'Shipped' | 'Delivered';
  items: string[];
  trackingNumber?: string;
  deliveryDate?: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  type: string;
  status: 'Pending' | 'Signed' | 'Approved';
  uploadedDate: string;
  signedDate?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  tasks: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

// ==================== API HELPER ====================

async function api(path: string, options: RequestInit = {}, userEmail?: string) {
  const res = await fetch(`${ONB_URL}${path}`, {
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

export function useOnboardingData(userEmail?: string) {
  const [employees, setEmployees] = useState<OnboardingCandidate[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [empResult, tplResult] = await Promise.allSettled([
      api('/employees', {}, userEmail),
      api('/templates', {}, userEmail),
    ]);

    if (empResult.status === 'fulfilled') {
      const d = empResult.value;
      setEmployees(Array.isArray(d) ? d : (d.data ?? []));
    } else {
      setError((empResult.reason as Error)?.message ?? 'Failed to load employees');
    }

    if (tplResult.status === 'fulfilled') {
      const d = tplResult.value;
      setTemplates(Array.isArray(d) ? d : (d.data ?? []));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ==================== EMPLOYEE CRUD ====================

  const createEmployee = useCallback(async (data: Partial<OnboardingCandidate>) => {
    const result = await api('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    }, userEmail);
    const emp: OnboardingCandidate = result.data ?? result;
    setEmployees(prev => [emp, ...prev]);
    return emp;
  }, []);

  const updateEmployee = useCallback(async (id: string, data: Partial<OnboardingCandidate>) => {
    const result = await api(`/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, userEmail);
    const emp: OnboardingCandidate = result.data ?? result;
    setEmployees(prev => prev.map(e => e.id === id ? emp : e));
    return emp;
  }, []);

  const deleteEmployee = useCallback(async (id: string) => {
    await api(`/employees/${id}`, { method: 'DELETE' }, userEmail);
    setEmployees(prev => prev.filter(e => e.id !== id));
  }, []);

  // ==================== TASK / CHECKLIST ====================

  const updateTask = useCallback(async (employeeId: string, taskId: string, completed: boolean) => {
    const result = await api(`/employees/${employeeId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }, userEmail);
    const emp: OnboardingCandidate = result.data ?? result;
    setEmployees(prev => prev.map(e => e.id === employeeId ? emp : e));
    return emp;
  }, []);

  // ==================== ACTIONS ====================

  const enableAccess = useCallback(async (employeeId: string, roles?: string[]) => {
    // Find the employee record to pass the required fields
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) throw new Error('Employee record not found');

    const result = await api('/enable-account', {
      method: 'POST',
      body: JSON.stringify({
        employeeId,
        name: emp.name,
        email: emp.email,
        department: emp.department,
        roles: roles?.length ? roles : ['employee'],
      }),
    }, userEmail);

    // Refresh local record to reflect portal_access_enabled = true
    if (result?.success) {
      setEmployees(prev => prev.map(e =>
        e.id === employeeId ? { ...e, portalAccessEnabled: true } : e
      ));
    }
    return result;
  }, [employees, userEmail]);

  const syncToDirectory = useCallback(async (_employeeId: string) => {
    // Server syncs all portal_access_enabled records to employees table
    return api('/sync-to-directory', { method: 'POST' }, userEmail);
  }, [userEmail]);

  const bulkUpload = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${ONB_URL}/employees/bulk-upload`, {
      method: 'POST',
      headers: apiHeaders(userEmail),
      body: formData,
    });
    if (!res.ok) throw new Error(`Bulk upload failed: ${res.statusText}`);
    const result = await safeJson(res);
    await loadAll();
    return result;
  }, [loadAll]);

  return {
    employees,
    templates,
    loading,
    error,
    loadAll,
    refresh: loadAll,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    updateTask,
    enableAccess,
    syncToDirectory,
    bulkUpload,
  };
}
