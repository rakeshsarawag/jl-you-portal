/**
 * EmployeesContext — fetches the full active-employee directory once at app startup
 * and makes it available to all components. Eliminates the 10+ independent
 * `fetch(${API_BASE}/directory/employees)` calls scattered across the codebase.
 *
 * Usage:
 *   const { employees, loading, refresh } = useEmployees();
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { API_BASE, publicAnonKey, safeJson } from '../utils/constants';

export interface Employee {
  id: string;
  employee_id?: string;
  employee_code?: string | null;
  name: string;
  email?: string;
  department?: string;
  designation?: string | null;
  job_title?: string | null;
  status?: string;
  manager_id?: string | null;
  phone?: string | null;
  location?: string | null;
  joining_date?: string | null;
  profile_picture?: string | null;
  [key: string]: unknown;
}

interface EmployeesContextValue {
  employees: Employee[];
  activeEmployees: Employee[];
  loading: boolean;
  refresh: () => Promise<void>;
  /** Find a single employee by id */
  byId: (id: string) => Employee | undefined;
  /** Find a single employee by email (case-insensitive) */
  byEmail: (email: string) => Employee | undefined;
}

const EmployeesContext = createContext<EmployeesContextValue>({
  employees: [],
  activeEmployees: [],
  loading: true,
  refresh: async () => {},
  byId: () => undefined,
  byEmail: () => undefined,
});

const HEADERS = { Authorization: `Bearer ${publicAnonKey}` };

// Module-level cache so navigating between apps never re-fetches within a session
let _cache: Employee[] | null = null;
let _cacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function EmployeesProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(_cache ?? []);
  const [loading, setLoading] = useState(!_cache);

  const load = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && _cache && now - _cacheTs < CACHE_TTL) {
      setEmployees(_cache);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/directory/employees`, { headers: HEADERS });
      const json = await safeJson(res);
      const list: Employee[] = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json)
        ? json
        : [];
      _cache = list;
      _cacheTs = Date.now();
      setEmployees(list);
    } catch {
      // Keep existing data on transient errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeEmployees = employees.filter(
    e => !e.status || e.status === 'active',
  );

  const byId = useCallback(
    (id: string) => employees.find(e => e.id === id),
    [employees],
  );

  const byEmail = useCallback(
    (email: string) => {
      const lower = email.toLowerCase();
      return employees.find(e => e.email?.toLowerCase() === lower);
    },
    [employees],
  );

  return (
    <EmployeesContext.Provider
      value={{
        employees,
        activeEmployees,
        loading,
        refresh: () => load(true),
        byId,
        byEmail,
      }}
    >
      {children}
    </EmployeesContext.Provider>
  );
}

export function useEmployees() {
  return useContext(EmployeesContext);
}
