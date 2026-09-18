import { useState, useCallback } from 'react';
import { API_BASE, apiHeaders } from '../utils/constants';

const PM_HEADERS = () => apiHeaders();

async function pmApi(path: string, body?: unknown) {
  const isDelete = body === null;
  const res = await fetch(`${API_BASE}/projects${path}`, {
    method: isDelete ? 'DELETE' : body !== undefined ? 'POST' : 'GET',
    headers: PM_HEADERS(),
    body: body && !isDelete ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

async function pmApiPut(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}/projects${path}`, {
    method: 'PUT',
    headers: PM_HEADERS(),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

async function pmApiDelete(path: string) {
  const res = await fetch(`${API_BASE}/projects${path}`, {
    method: 'DELETE',
    headers: PM_HEADERS(),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectMember {
  id: string;
  employeeId: string;
  employeeName: string;
  role: string;
  joinedDate: string;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  taskType?: string;
  assigneeId?: string;
  assigneeName?: string;
  dueDate?: string;
  startDate?: string;
  estimatedHours?: number;
  loggedHours?: number;
  sprintId?: string;
  sprintChangeReason?: string;
  sprintChangeHistory?: Array<{ from: string | null; to: string | null; reason: string; changedAt: string; changedBy?: string }>;
  createdAt?: string;
  startedAt?: string;
  completedDate?: string;
  closedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  ragStatus: string;
  startDate: string;
  endDate: string;
  budget?: number;
  spent?: number;
  managerId: string;
  managerName: string;
  members: ProjectMember[];
  tasks: ProjectTask[];
  progress: number;
}

export interface ProjectStats {
  total: number;
  active: number;
  completed: number;
  onHold: number;
  overdue: number;
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeTask(t: any): ProjectTask {
  return {
    id: t.id,
    projectId: t.project_id ?? t.projectId ?? '',
    title: t.title ?? '',
    description: t.description ?? '',
    status: t.status ?? 'Todo',
    priority: t.priority ?? 'Medium',
    assigneeId: t.assignee_id ?? t.assigneeId,
    assigneeName: t.assignee_name ?? t.assigneeName,
    taskType: t.task_type ?? t.taskType,
    dueDate: t.due_date ?? t.dueDate,
    startDate: t.start_date ?? t.startDate,
    estimatedHours: t.estimated_hours ?? t.estimatedHours,
    loggedHours: t.actual_hours ?? t.logged_hours ?? t.loggedHours,
    createdAt: t.created_at ?? t.createdAt,
    startedAt: t.started_at ?? t.startedAt,
    completedDate: t.completed_date ?? t.completedDate,
    closedAt: t.closed_at ?? t.closedAt,
    sprintId: t.sprint_id ?? t.sprintId,
    sprintChangeReason: t.sprint_change_reason ?? t.sprintChangeReason,
    sprintChangeHistory: t.sprint_change_history ?? t.sprintChangeHistory ?? [],
  };
}

function normalizeMember(m: any): ProjectMember {
  return {
    id: m.id,
    employeeId: m.employee_id ?? m.employeeId ?? '',
    employeeName: m.employee_name ?? m.employeeName ?? '',
    role: m.role ?? 'Member',
    joinedDate: m.joined_at ?? m.joined_date ?? m.joinedDate ?? '',
  };
}

function normalizeProject(p: any, members: any[] = [], tasks: any[] = []): Project {
  const today = new Date().toISOString().split('T')[0];
  const pTasks = tasks.length > 0 ? tasks : (p.project_tasks ?? p.tasks ?? []);
  const pMembers = members.length > 0 ? members : (p.project_members ?? p.members ?? []);
  const doneTasks = pTasks.filter((t: any) => (t.status ?? '') === 'Done').length;
  const progress = pTasks.length > 0 ? Math.round((doneTasks / pTasks.length) * 100) : (p.progress ?? 0);
  return {
    id: p.id,
    name: p.name ?? '',
    description: p.description ?? '',
    category: p.category ?? '',
    status: p.status ?? 'Planning',
    priority: p.priority ?? 'Medium',
    ragStatus: p.rag_status ?? p.ragStatus ?? 'Green',
    startDate: p.start_date ?? p.startDate ?? '',
    endDate: p.end_date ?? p.endDate ?? '',
    budget: p.budget,
    spent: p.spent,
    managerId: p.manager_id ?? p.managerId ?? '',
    managerName: p.manager_name ?? p.managerName ?? '',
    members: pMembers.map(normalizeMember),
    tasks: pTasks.map(normalizeTask),
    progress,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProjectData(_userEmail?: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ProjectStats>({
    total: 0, active: 0, completed: 0, onHold: 0, overdue: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const computeStats = (projs: Project[]): ProjectStats => {
    const today = new Date().toISOString().split('T')[0];
    return {
      total: projs.length,
      active: projs.filter(p => p.status === 'Active').length,
      completed: projs.filter(p => p.status === 'Completed').length,
      onHold: projs.filter(p => p.status === 'On Hold').length,
      overdue: projs.filter(p => p.endDate && p.endDate < today && !['Completed', 'Cancelled'].includes(p.status)).length,
    };
  };

  const loadAll = useCallback(async (userId?: string, userRole?: string, employeeId?: string, userName?: string) => {
    setLoading(true);
    setError(null);
    try {
      const json = await pmApi('/all');
      let data = (json.data ?? []).map((p: any) => normalizeProject(p, p.project_members ?? [], p.project_tasks ?? []));

      // Non-admin users only see projects they are assigned to.
      // Match by employee UUID (employees table), auth UUID (fallback), or name (last resort).
      const isEmployee = userRole === 'employee';
      if (isEmployee) {
        const nameLower = (userName ?? '').toLowerCase();
        data = data.filter((p: Project) =>
          (employeeId && (p.managerId === employeeId || p.members.some(m => m.employeeId === employeeId))) ||
          (userId && (p.managerId === userId || p.members.some(m => m.employeeId === userId))) ||
          (nameLower && p.members.some(m => m.employeeName?.toLowerCase() === nameLower))
        );
      }
      setProjects(data);
      setStats(computeStats(data));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = useCallback(async (data: Partial<Project>): Promise<Project> => {
    const json = await pmApi('/create', {
      name: data.name,
      description: data.description ?? '',
      category: data.category ?? '',
      status: data.status ?? 'Planning',
      priority: data.priority ?? 'Medium',
      managerId: data.managerId || null,
      managerName: data.managerName ?? '',
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      budget: data.budget ?? null,
      ragStatus: data.ragStatus ?? 'Green',
      members: (data.members ?? []).map((m: any) => ({ employeeName: m.employeeName ?? m.name, role: m.role ?? 'Member' })),
    });
    const raw = json.data;
    const project = normalizeProject(raw, raw?.project_members ?? [], raw?.project_tasks ?? []);
    setProjects(prev => {
      const updated = [project, ...prev];
      setStats(computeStats(updated));
      return updated;
    });
    return project;
  }, []);

  const updateProject = useCallback(async (id: string, updates: Partial<Project>): Promise<Project> => {
    const json = await pmApi('/update', {
      id,
      name: updates.name,
      description: updates.description,
      category: updates.category,
      status: updates.status,
      priority: updates.priority,
      ragStatus: updates.ragStatus,
      startDate: updates.startDate,
      endDate: updates.endDate,
      budget: updates.budget,
      managerName: updates.managerName,
      managerId: updates.managerId,
      progress: updates.progress,
    });
    // /update returns the raw row without nested members/tasks; reload from /all snapshot
    const project = normalizeProject(json.data, [], []);
    setProjects(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, ...project } : p);
      setStats(computeStats(updated));
      return updated;
    });
    return project;
  }, []);

  const deleteProject = useCallback(async (id: string): Promise<void> => {
    await pmApiDelete(`/${id}`);
    setProjects(prev => {
      const updated = prev.filter(p => p.id !== id);
      setStats(computeStats(updated));
      return updated;
    });
  }, []);

  const addMember = useCallback(async (projectId: string, member: Partial<ProjectMember>): Promise<Project> => {
    const json = await pmApi(`/${projectId}/members`, {
      employeeId: member.employeeId || null,
      employeeName: member.employeeName ?? '',
      role: member.role ?? 'Member',
    });
    const project = normalizeProject(json.data, json.data?.project_members ?? [], json.data?.project_tasks ?? []);
    setProjects(prev => prev.map(p => p.id === projectId ? project : p));
    return project;
  }, []);

  const removeMember = useCallback(async (projectId: string, memberId: string): Promise<void> => {
    await pmApiDelete(`/${projectId}/members/${memberId}`);
    setProjects(prev => prev.map(p =>
      p.id === projectId
        ? { ...p, members: p.members.filter(m => m.id !== memberId) }
        : p
    ));
  }, []);

  const createTask = useCallback(async (projectId: string, task: Partial<ProjectTask>): Promise<ProjectTask> => {
    const json = await pmApi('/tasks/create', {
      projectId,
      title: task.title ?? '',
      description: task.description ?? '',
      status: task.status ?? 'Todo',
      priority: task.priority ?? 'Medium',
      taskType: task.taskType ?? 'task',
      assigneeId: task.assigneeId || null,
      assigneeName: task.assigneeName ?? '',
      dueDate: task.dueDate || null,
      estimatedHours: task.estimatedHours ?? null,
    });
    const created = normalizeTask(json.data);
    setProjects(prev => prev.map(p =>
      p.id === projectId
        ? { ...p, tasks: [...(p.tasks ?? []), created] }
        : p
    ));
    return created;
  }, []);

  const updateTask = useCallback(async (projectId: string, taskId: string, updates: Partial<ProjectTask>): Promise<ProjectTask> => {
    const now = new Date().toISOString();
    const json = await pmApiPut(`/tasks/${taskId}`, {
      title: updates.title,
      description: updates.description,
      status: updates.status,
      priority: updates.priority,
      taskType: updates.taskType,
      assigneeName: updates.assigneeName,
      assigneeId: updates.assigneeId,
      dueDate: updates.dueDate,
      startDate: updates.startDate,
      estimatedHours: updates.estimatedHours,
      actualHours: updates.loggedHours,
      sprintId: (updates as any).sprintId,
      sprintChangeReason: (updates as any).sprintChangeReason,
      // Audit timestamps driven by status transitions
      startedAt: updates.status === 'In Progress' ? now : undefined,
      completedAt: updates.status === 'Done' ? now : undefined,
      closedAt: updates.status === 'Cancelled' ? now : undefined,
    });
    const task = normalizeTask(json.data);
    setProjects(prev => prev.map(p =>
      p.id === projectId
        ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? task : t) }
        : p
    ));
    return task;
  }, []);

  const deleteTask = useCallback(async (projectId: string, taskId: string): Promise<void> => {
    await pmApiDelete(`/tasks/${taskId}`);
    setProjects(prev => prev.map(p =>
      p.id === projectId
        ? { ...p, tasks: p.tasks.filter(t => t.id !== taskId) }
        : p
    ));
  }, []);

  const logTime = useCallback(async (
    taskId: string, hours: number, type: string, description: string,
    opts?: { logDate?: string; billable?: boolean; employeeName?: string; projectId?: string }
  ): Promise<void> => {
    // Update task's accumulated actual_hours
    await pmApiPut(`/tasks/${taskId}`, { additionalHours: hours });
    // Create a dedicated time log entry via the /time-logs endpoint
    await pmApi('/time-logs', {
      taskId,
      projectId: opts?.projectId || null,
      hours,
      logType: type,
      comment: description,
      logDate: opts?.logDate ?? new Date().toISOString().split('T')[0],
      billable: opts?.billable ?? true,
      employeeName: opts?.employeeName ?? '',
    });
    // Update local state with new logged hours
    setProjects(prev => prev.map(p => ({
      ...p,
      tasks: p.tasks.map(t => t.id === taskId
        ? { ...t, loggedHours: (t.loggedHours ?? 0) + hours }
        : t
      ),
    })));
  }, []);

  const updateRAG = useCallback(async (projectId: string, ragStatus: string): Promise<Project> => {
    return updateProject(projectId, { ragStatus });
  }, [updateProject]);

  return {
    projects,
    stats,
    loading,
    error,
    loadAll,
    refresh: loadAll,
    createProject,
    updateProject,
    deleteProject,
    addMember,
    removeMember,
    createTask,
    updateTask,
    deleteTask,
    logTime,
    updateRAG,
  };
}
