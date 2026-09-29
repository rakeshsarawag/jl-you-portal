/**
 * Shared Data Hook
 * Provides centralized access to master data and value helps
 * All apps use this hook to get dropdowns and reference data
 */

import { useState, useEffect, useCallback } from 'react';
import DataService from '../services/dataService';
import { API_BASE, publicAnonKey, safeJson, apiHeaders } from '../utils/constants';
import { useEmployees } from '../context/EmployeesContext';
// Re-export useUser so any stale import from this file still resolves
export { useUser } from '../context/UserContext';

interface ValueHelpOption {
  value: string;
  label: string;
  description?: string;
}

interface ValueHelp {
  type: string;
  label: string;
  options: ValueHelpOption[];
}

interface MasterDataItem {
  id: string;
  name: string;
  [key: string]: any;
}

export function useValueHelps() {
  const [valueHelps, setValueHelps] = useState<ValueHelp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadValueHelps = useCallback(async () => {
    try {
      setLoading(true);
      const result = await DataService.getValueHelps();
      setValueHelps(result.data || []);
      setError(null);
    } catch (err) {
      console.error('Error loading value helps:', err);
      setError('Failed to load dropdown options');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadValueHelps();

    // Listen for master data updates
    const handleUpdate = () => loadValueHelps();
    window.addEventListener('masterDataUpdated', handleUpdate);
    return () => window.removeEventListener('masterDataUpdated', handleUpdate);
  }, [loadValueHelps]);

  const getOptions = useCallback((type: string): ValueHelpOption[] => {
    const valueHelp = valueHelps.find(vh => vh.type === type);
    return valueHelp?.options || [];
  }, [valueHelps]);

  return { valueHelps, loading, error, getOptions, refresh: loadValueHelps };
}

export function useMasterData(category: string) {
  const [data, setData] = useState<MasterDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await DataService.getMasterData(category);
      // Unwrap { data: [...] } envelope if present
      const raw = Array.isArray(result) ? result : (result?.data ?? result?.items ?? []);
      setData(Array.isArray(raw) ? raw : []);
      setError(null);
    } catch (err) {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    loadData();

    // Listen for master data updates
    const handleUpdate = () => loadData();
    window.addEventListener('masterDataUpdated', handleUpdate);
    return () => window.removeEventListener('masterDataUpdated', handleUpdate);
  }, [loadData]);

  const save = useCallback(async (newData: MasterDataItem[]) => {
    try {
      await DataService.saveMasterData(category, newData);
      setData(newData);
      DataService.refreshMasterDataCache();
      return true;
    } catch (err) {
      console.error(`Error saving master data for ${category}:`, err);
      return false;
    }
  }, [category]);

  return { data, loading, error, save, refresh: loadData };
}

export function useAllMasterData() {
  const [masterData, setMasterData] = useState<Record<string, MasterDataItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await DataService.getAllMasterData();
      setMasterData(result);
      setError(null);
    } catch (err) {
      console.error('Error loading all master data:', err);
      setError('Failed to load master data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();

    // Listen for master data updates
    const handleUpdate = () => loadAllData();
    window.addEventListener('masterDataUpdated', handleUpdate);
    return () => window.removeEventListener('masterDataUpdated', handleUpdate);
  }, [loadAllData]);

  return { masterData, loading, error, refresh: loadAllData };
}

// Helper hook to get dropdown options from master data
export function useMasterDataOptions(category: string) {
  const { data, loading } = useMasterData(category);
  
  // Ensure data is always an array before mapping
  const safeData = Array.isArray(data) ? data : [];
  
  const options = safeData.map(item => ({
    value: item.id || item.name,
    label: item.name,
    ...item
  }));

  return { options, loading };
}

// Helper to get employees for dropdowns — delegates to EmployeesContext (cached, deduplicated)
export function useEmployeeOptions() {
  const { employees, loading } = useEmployees();

  const options = employees.map(emp => {
    const fullName = emp.name || `${(emp as any).firstName || ''} ${(emp as any).lastName || ''}`.trim();
    const jobTitle = emp.designation || emp.position || (emp as any).jobTitle || (emp as any).title || '';
    const employeeCode = emp.employee_code || (emp as any).employeeCode || '';

    return {
      value: emp.id,
      label: employeeCode ? `${fullName} (${employeeCode})` : fullName,
      displayLabel: employeeCode ? `${fullName} · ${employeeCode}` : fullName,
      email: emp.email,
      department: emp.department,
      jobTitle,
      phone: emp.phone || (emp as any).phoneNumber || '',
      location: emp.location || '',
      employeeCode,
    };
  }).filter(opt => opt.label && opt.label.trim());

  const uniqueByEmail = options.filter((opt, index, self) =>
    index === self.findIndex(t => t.email?.toLowerCase() === opt.email?.toLowerCase())
  );

  return { options: uniqueByEmail, employees, loading };
}

export function useClientOptions() {
  const { options, loading } = useMasterDataOptions('clients');
  return { options, loading };
}

const FALLBACK_DEPARTMENTS = [
  'Engineering', 'Human Resources', 'Finance', 'Marketing', 'Sales',
  'Operations', 'Design', 'Product', 'Legal', 'Administration',
  'Customer Success', 'IT & Infrastructure',
].map(d => ({ value: d, label: d }));

export function useDepartmentOptions() {
  const { options, loading } = useMasterDataOptions('departments');
  const resolved = options.length > 0 ? options : (loading ? [] : FALLBACK_DEPARTMENTS);
  return { options: resolved, loading };
}

// Helper to get job titles for dropdowns
export function useJobTitleOptions() {
  const { options, loading } = useMasterDataOptions('job-titles');
  return { options, loading };
}

const FALLBACK_LOCATIONS = [
  'Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Hyderabad',
  'Chennai', 'Kolkata', 'Remote',
].map(l => ({ value: l, label: l }));

// Helper to get locations for dropdowns
export function useLocationOptions() {
  const { options, loading } = useMasterDataOptions('locations');
  const resolved = options.length > 0 ? options : (loading ? [] : FALLBACK_LOCATIONS);
  return { options: resolved, loading };
}

// Module-level in-memory TTL cache for useMasterDataDirect — no localStorage
interface DirectCacheEntry { data: any[]; ts: number; }
const _directCache = new Map<string, DirectCacheEntry>();
const DIRECT_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Invalidate all entries when master data is mutated
if (typeof window !== 'undefined') {
  window.addEventListener('masterDataUpdated', () => _directCache.clear());
}

// Direct hook for master data DB endpoints (Phase 6)
export function useMasterDataDirect(endpoint: string, userEmail?: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const masterDataBase = `${API_BASE}/master-data`;

  const load = useCallback(async (force = false) => {
    const url = `${masterDataBase}/${endpoint}`;
    const cached = _directCache.get(url);
    if (!force && cached && Date.now() - cached.ts < DIRECT_CACHE_TTL) {
      setData(cached.data);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(url, { headers: apiHeaders(userEmail) });
      if (!response.ok) { setData([]); return; }
      const result = await safeJson(response);
      const rows = result?.data || result || [];
      _directCache.set(url, { data: rows, ts: Date.now() });
      setData(rows);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, masterDataBase, userEmail]);

  useEffect(() => {
    load();
    const handleUpdate = () => load(true);
    window.addEventListener("masterDataUpdated", handleUpdate);
    return () => window.removeEventListener("masterDataUpdated", handleUpdate);
  }, [load]);

  return { data, loading, refresh: () => load(true) };
}