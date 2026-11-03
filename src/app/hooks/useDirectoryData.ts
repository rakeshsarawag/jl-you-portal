/**
 * Employee Directory Hook
 * Wired to relational DB via /directory API.
 * HR/Admin: full CRUD. Manager: read + export. Employee: read only.
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { API_BASE, publicAnonKey, safeJson, apiHeaders, supabase, apiFetch }from '../utils/constants';
import { DEPARTMENTS, EMPLOYEE_STATUSES, LIFECYCLE_STATUSES } from '../../constants/apps/directory';

export { LIFECYCLE_STATUSES };

const DIR_URL = `${API_BASE}/directory`;

async function api(path: string, options: RequestInit = {}, userEmail?: string) {
  const res = await apiFetch(`${DIR_URL}${path}`, {
    ...options,
    headers: apiHeaders(userEmail),
  });
  const json = await safeJson(res);
  if (!res.ok) throw new Error(json?.error || `API error ${res.status}`);
  return json;
}

/**
 * Normalize a raw API employee record to the DirectoryEmployee shape.
 * The deployed backend returns some fields as camelCase; we normalise to
 * snake_case (what the type and form use) while keeping both for safety.
 */
function normalizeEmployee(emp: any): DirectoryEmployee {
  const rawManagerId = emp.manager_id ?? emp.managerId;
  const managerId = typeof rawManagerId === 'object' ? rawManagerId?.id : rawManagerId;
  return {
    ...emp,
    // Canonical snake_case fields (form state uses these)
    employee_code: emp.employee_code || emp.employeeCode || '',
    manager_id: String(managerId || '').trim(),
    manager_name: emp.manager_name || emp.managerName || '',
    department: emp.department || '',
    location: emp.location || '',
    join_date: emp.join_date || emp.joinDate || '',
    profile_picture: emp.profile_picture || emp.profilePicture || '',
    lifecycleStatus: emp.lifecycle_status || emp.lifecycleStatus || 'Active',
    date_of_birth: emp.date_of_birth || emp.dateOfBirth || '',
    // Backend returns emergencyContact (camelCase from GET serialization); DB column is emergency_contact
    emergencyContact: emp.emergencyContact ?? emp.emergency_contact ?? undefined,
    designation: emp.designation || emp.job_title || '',
    skills: emp.skills || [],
    status: emp.status || 'Active',
  };
}

/**
 * Map the DirectoryEmployee (snake_case form state) to the payload shape
 * the deployed backend expects (camelCase for some fields).
 */
function toApiPayload(data: Partial<DirectoryEmployee>): Record<string, any> {
  const payload: Record<string, any> = { ...data };
  // Always send both forms so either backend version accepts it
  if (data.manager_id !== undefined) payload.managerId = data.manager_id;
  if (data.join_date !== undefined) payload.joinDate = data.join_date;
  if (data.profile_picture !== undefined) payload.profilePicture = data.profile_picture;
  if (data.emergencyContact !== undefined) {
    payload.emergencyContact = data.emergencyContact;
    payload.emergency_contact = data.emergencyContact;
  }
  return payload;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  alternate_phone?: string;
  email?: string;
}

export const EMERGENCY_RELATIONSHIPS = ['Spouse', 'Parent', 'Sibling', 'Friend', 'Other'] as const;

export interface DirectoryEmployee {
  id: string;
  employee_code?: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  manager_id?: string;
  manager_name?: string;
  location: string;
  join_date: string;
  profile_picture?: string;
  skills: string[];
  status: typeof EMPLOYEE_STATUSES[number];
  lifecycleStatus?: typeof LIFECYCLE_STATUSES[number];
  emergencyContact?: EmergencyContact;
  date_of_birth?: string;
  created_at: string;
  updated_at: string;
}

export interface OrgNode {
  id: string;
  employee_code?: string;
  name: string;
  designation: string;
  department: string;
  profile_picture?: string;
  reports: OrgNode[];
}

export function buildOrgTree(list: DirectoryEmployee[]): OrgNode[] {
  const nodeMap = new Map<string, OrgNode>();
  const parentById = new Map<string, string>();

  list.forEach(employee => nodeMap.set(employee.id, {
    id: employee.id,
    employee_code: employee.employee_code,
    name: employee.name,
    designation: employee.designation,
    department: employee.department,
    profile_picture: employee.profile_picture,
    reports: [],
  }));

  list.forEach(employee => {
    const managerId = String(employee.manager_id || '').trim();
    if (managerId && managerId !== employee.id && nodeMap.has(managerId)) {
      parentById.set(employee.id, managerId);
    }
  });

  // Break invalid circular reporting chains so at least one employee in each
  // cycle becomes a root and the hierarchy remains renderable.
  for (const employeeId of parentById.keys()) {
    const seen = new Set([employeeId]);
    let managerId: string | undefined = parentById.get(employeeId);
    while (managerId) {
      if (seen.has(managerId)) {
        parentById.delete(employeeId);
        break;
      }
      seen.add(managerId);
      managerId = parentById.get(managerId);
    }
  }

  const roots: OrgNode[] = [];
  list.forEach(employee => {
    const node = nodeMap.get(employee.id);
    if (!node) return;
    const managerId = parentById.get(employee.id);
    if (managerId) {
      nodeMap.get(managerId)?.reports.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export function useDirectoryData(userEmail?: string) {
  const [employees, setEmployees] = useState<DirectoryEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api('/employees', {}, userEmail);
      const normalizedRows: DirectoryEmployee[] = (res.data ?? []).map(normalizeEmployee);
      const employeeNames = new Map(normalizedRows.map(employee => [employee.id, employee.name]));
      const normalized = normalizedRows.map(employee => ({
        ...employee,
        manager_name: employee.manager_id ? employeeNames.get(employee.manager_id) ?? '' : '',
      }));

      // The deployed edge function's GET doesn't always return emergencyContact.
      // Supplement by reading emergency_contact directly from PostgREST (anon SELECT is allowed).
      try {
        const { data: ecRows } = await supabase
          .from('employees')
          .select('id, emergency_contact');
        if (ecRows && ecRows.length > 0) {
          const ecMap = new Map<string, any>(ecRows.map((r: any) => [r.id, r.emergency_contact]));
          setEmployees(normalized.map(emp => ({
            ...emp,
            emergencyContact: emp.emergencyContact ?? (ecMap.has(emp.id) ? ecMap.get(emp.id) ?? undefined : undefined),
          })));
          return;
        }
      } catch {
        // PostgREST supplementation failed — fall through with edge function data only
      }

      setEmployees(normalized);
    } catch (err: any) {
      setError(err.message);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const createEmployee = async (data: Partial<DirectoryEmployee>) => {
    try {
      const res = await api('/employees', { method: 'POST', body: JSON.stringify(toApiPayload(data)) }, userEmail);
      toast.success('Employee added successfully');
      await loadEmployees();
      return res.data;
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to add employee');
      throw err;
    }
  };

  const updateEmployee = async (id: string, data: Partial<DirectoryEmployee>) => {
    try {
      const payload = toApiPayload(data);
      await api(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, userEmail);
      toast.success('Employee updated successfully');
      await loadEmployees();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update employee');
      throw err;
    }
  };

  const updateEmergencyContact = async (id: string, contact: EmergencyContact | null) => {
    try {
      // Use the PUT endpoint which now persists emergency_contact
      await api(`/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ emergencyContact: contact, emergency_contact: contact }),
      }, userEmail);

      toast.success('Emergency contact saved');
      await loadEmployees();
    } catch (err: any) {
      const msg = err.message ?? 'Failed to save emergency contact';
      toast.error(msg);
      throw err;
    }
  };

  const bulkUploadEmployees = async (rows: Record<string, string>[]): Promise<{ successCount: number; failureCount: number; failed: Array<{ row: number; name: string; error: string }> }> => {
    let successCount = 0;
    let failureCount = 0;
    const failed: Array<{ row: number; name: string; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const skillsRaw = r.Skills ?? r.skills ?? '';
        const skills = skillsRaw ? skillsRaw.split(',').map((s: string) => s.trim()).filter(Boolean) : [];

        // Resolve manager by email if provided
        let manager_id: string | undefined;
        const managerEmail = (r['Manager Email'] ?? r.manager_email ?? '').trim().toLowerCase();
        if (managerEmail) {
          const mgr = employees.find(e => e.email.toLowerCase() === managerEmail);
          if (mgr) manager_id = mgr.id;
        }

        const payload: Partial<DirectoryEmployee> = {
          name: (r.Name ?? r.name ?? '').trim(),
          email: (r.Email ?? r.email ?? '').trim(),
          phone: (r.Phone ?? r.phone ?? '').trim(),
          department: (r.Department ?? r.department ?? '').trim(),
          designation: (r.Designation ?? r.designation ?? r['Job Title'] ?? '').trim(),
          location: (r.Location ?? r.location ?? '').trim(),
          status: ((r.Status ?? r.status ?? 'Active').trim() as any) || 'Active',
          lifecycleStatus: ((r['Lifecycle Status'] ?? r.lifecycle_status ?? 'Active').trim() as any) || 'Active',
          join_date: (r['Join Date'] ?? r.join_date ?? new Date().toISOString().split('T')[0]).trim(),
          date_of_birth: (r['Date of Birth'] ?? r.date_of_birth ?? '').trim() || undefined,
          skills,
          manager_id,
          emergencyContact: {
            name: (r['Emergency Contact Name'] ?? r.emergency_contact_name ?? '').trim(),
            relationship: (r['Emergency Contact Relationship'] ?? r.emergency_contact_relationship ?? 'Spouse').trim() || 'Spouse',
            phone: (r['Emergency Contact Phone'] ?? r.emergency_contact_phone ?? '').trim(),
          },
        };

        await api('/employees', { method: 'POST', body: JSON.stringify(toApiPayload(payload)) }, userEmail);
        successCount++;
      } catch (err: any) {
        failureCount++;
        failed.push({ row: i + 2, name: r.Name ?? r.name ?? `Row ${i + 2}`, error: err.message ?? 'Unknown error' });
      }
    }

    if (successCount > 0) await loadEmployees();
    return { successCount, failureCount, failed };
  };

  const deleteEmployee = async (id: string) => {
    try {
      await api(`/employees/${id}`, { method: 'DELETE' }, userEmail);
      toast.success('Employee removed from directory');
      await loadEmployees();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to delete employee');
      throw err;
    }
  };

  // CSV export — columns per spec: Employee ID, Name, Email, Designation, Department, Location, Join Date, Status, Manager
  const exportCSV = (list: DirectoryEmployee[]) => {
    const headers = [
      'Employee ID', 'Name', 'Email', 'Designation', 'Department',
      'Location', 'Join Date', 'Status', 'Lifecycle Status', 'Manager',
    ];
    const rows = list.map(e => [
      e.id,
      e.name,
      e.email,
      e.designation,
      e.department,
      e.location,
      e.join_date,
      e.status,
      e.lifecycleStatus ?? '',
      e.manager_name ?? '',
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employee-directory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${list.length} employees to CSV`);
  };

  // Filtered view
  const filtered = employees.filter(e => {
    const matchSearch = !search || [e.name, e.email, e.designation, e.department].some(f =>
      f.toLowerCase().includes(search.toLowerCase())
    );
    const matchDept = !filterDept || e.department === filterDept;
    const matchStatus = !filterStatus || e.status === filterStatus;
    return matchSearch && matchDept && matchStatus;
  });

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))].sort();
  const orgTree = buildOrgTree(employees);

  return {
    employees, filtered, loading, error,
    search, setSearch, filterDept, setFilterDept, filterStatus, setFilterStatus,
    departments, orgTree,
    createEmployee, updateEmployee, updateEmergencyContact, deleteEmployee,
    bulkUploadEmployees, exportCSV, refresh: loadEmployees,
  };
}
