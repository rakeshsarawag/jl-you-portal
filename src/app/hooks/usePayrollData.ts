import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { API_BASE, publicAnonKey, safeJson, apiHeaders } from '../utils/constants';
import { useUser } from '../context/UserContext';

const PAYROLL_URL = `${API_BASE}/payroll`;

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  email?: string;
  department?: string;
  designation?: string;
  month: string;
  year: number;
  basicSalary: number;
  hra: number;
  transportAllowance: number;
  medicalAllowance: number;
  otherAllowances: number;
  grossSalary: number;
  pfDeduction: number;
  taxDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  lopDays: number;
  lopDeduction: number;
  workingDays: number;
  presentDays: number;
  status: 'Draft' | 'Processed' | 'Approved' | 'Rejected' | 'Paid' | 'On Hold';
  paymentDate?: string;
  paymentMethod?: string;
  bankAccount?: string;
  notes?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollStats {
  totalRecords: number;
  paidRecords: number;
  totalPayout: number;
}

function api(method: string, path: string, body?: unknown, userEmail?: string) {
  return fetch(`${PAYROLL_URL}${path}`, {
    method,
    headers: apiHeaders(userEmail),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then((r) => safeJson(r));
}

export function usePayrollData() {
  const { currentUser } = useUser();
  const userEmail = currentUser?.email;
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [stats, setStats] = useState<PayrollStats | null>(null);
  const [loading, setLoading] = useState(true);

  const isPrivileged =
    currentUser?.primaryRole === 'admin' ||
    currentUser?.primaryRole === 'hr' ||
    currentUser?.primaryRole === 'manager';

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [recordsResult, statsResult] = await Promise.allSettled([
        api('GET', '/records', undefined, userEmail),
        api('GET', '/stats', undefined, userEmail),
      ]);

      if (recordsResult.status === 'fulfilled' && recordsResult.value?.data) {
        let rows: PayrollRecord[] = recordsResult.value.data;
        if (!isPrivileged && currentUser?.id) {
          rows = rows.filter((r) => r.employeeId === currentUser.id);
        }
        setRecords(rows);
      }

      if (statsResult.status === 'fulfilled' && statsResult.value?.data) {
        setStats(statsResult.value.data);
      }
    } catch (err) {
      console.error('usePayrollData fetch error:', err);
      toast.error('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, isPrivileged, userEmail]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const processPayroll = useCallback(
    async (month: string, year: number) => {
      try {
        const res = await api('POST', '/process', { month, year }, userEmail);
        if (res?.error) throw new Error(res.error);
        await fetchAll();
        // Return the raw response so the caller can show specific counts
        return res as { created: number; skipped: number; noStructure: number; total: number } | null;
      } catch (err: any) {
        toast.error('Failed to process payroll', { description: err?.message });
        throw err;
      }
    },
    [fetchAll, userEmail]
  );

  const addRecord = useCallback(
    async (record: Omit<PayrollRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        const res = await api('POST', '/records', record, userEmail);
        if (res?.error) throw new Error(res.error);
        toast.success('Payroll record created');
        await fetchAll();
        return res?.data;
      } catch (err: any) {
        toast.error('Failed to create record', { description: err?.message });
        throw err;
      }
    },
    [fetchAll, userEmail]
  );

  const updateRecord = useCallback(
    async (id: string, updates: Partial<PayrollRecord>) => {
      try {
        const res = await api('PUT', `/records/${id}`, updates, userEmail);
        if (res?.error) throw new Error(res.error);
        toast.success('Record updated');
        setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...res.data } : r)));
        return res?.data;
      } catch (err: any) {
        toast.error('Failed to update record', { description: err?.message });
        throw err;
      }
    },
    [userEmail]
  );

  const deleteRecord = useCallback(async (id: string) => {
    try {
      const res = await api('DELETE', `/records/${id}`, undefined, userEmail);
      if (res?.error) throw new Error(res.error);
      toast.success('Record deleted');
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      toast.error('Failed to delete record', { description: err?.message });
      throw err;
    }
  }, [userEmail]);

  return {
    records,
    stats,
    loading,
    processPayroll,
    addRecord,
    updateRecord,
    deleteRecord,
    refresh: fetchAll,
  };
}
