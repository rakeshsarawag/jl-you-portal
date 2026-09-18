import { useState, useEffect, useCallback } from 'react';
import { API_BASE, publicAnonKey, safeJson, apiHeaders } from '../utils/constants';

const ASSET_URL = `${API_BASE}/assets`;

export interface Asset {
  id: string;
  assetTag: string;
  name: string;
  type: string;
  status: string;
  condition: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  vendor?: string;
  assignedTo?: string;
  assignedToName?: string;
  assignedDate?: string;
  location: string;
  warrantyExpiry?: string;
  notes?: string;
  maintenanceLogs: MaintenanceLog[];
}

export interface MaintenanceLog {
  id: string;
  assetId: string;
  type: string;
  date: string;
  description: string;
  cost?: number;
  performedBy: string;
  nextDueDate?: string;
}

export interface AssetStats {
  total: number;
  assigned: number;
  available: number;
  inRepair: number;
  retired: number;
}

export interface AssetAssignment {
  assetId: string;
  employeeId: string;
  employeeName: string;
  assignedDate: string;
  returnedDate?: string;
}

function normalizeAsset(a: any): Asset {
  return {
    id: a.id,
    assetTag: a.assetTag ?? a.asset_tag ?? '',
    name: a.name ?? '',
    type: a.type ?? '',
    status: a.status ?? 'Available',
    condition: a.condition ?? 'Good',
    serialNumber: a.serialNumber ?? a.serial_number,
    purchaseDate: a.purchaseDate ?? a.purchase_date,
    purchaseCost: a.purchaseCost ?? a.purchase_cost,
    vendor: a.vendor,
    assignedTo: a.assignedTo ?? a.assigned_to,
    assignedToName: a.assignedToName ?? a.assigned_to_name,
    assignedDate: a.assignedDate ?? a.assigned_date,
    location: a.location ?? '',
    warrantyExpiry: a.warrantyExpiry ?? a.warranty_expiry,
    notes: a.notes,
    maintenanceLogs: (a.maintenanceLogs ?? a.asset_maintenance_logs ?? []).map((m: any) => ({
      id: m.id,
      assetId: m.assetId ?? m.asset_id,
      type: m.type ?? '',
      date: m.date ?? m.performed_date ?? '',
      description: m.description ?? '',
      cost: m.cost,
      performedBy: m.performedBy ?? m.performed_by ?? '',
      nextDueDate: m.nextDueDate ?? m.next_due_date,
    })),
  };
}

function api(path: string, options: RequestInit = {}, userEmail?: string) {
  return fetch(`${ASSET_URL}${path}`, {
    ...options,
    headers: apiHeaders(userEmail),
  });
}

export function useAssetData(userEmail?: string) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState<AssetStats>({ total: 0, assigned: 0, available: 0, inRepair: 0, retired: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [assetsResult, statsResult] = await Promise.allSettled([
      api('/all', {}, userEmail).then(r => safeJson(r)),
      api('/stats/all', {}, userEmail).then(r => safeJson(r)),
    ]);

    if (assetsResult.status === 'fulfilled' && assetsResult.value?.success) {
      setAssets((assetsResult.value?.data ?? []).map(normalizeAsset));
    } else {
      setError('Failed to load assets');
    }

    if (statsResult.status === 'fulfilled' && statsResult.value?.success) {
      const s = statsResult.value?.data ?? {};
      setStats({
        total: s.total ?? s.totalAssets ?? 0,
        assigned: s.assigned ?? s.assignedAssets ?? 0,
        available: s.available ?? s.availableAssets ?? 0,
        inRepair: s.inRepair ?? s.maintenance ?? s.inRepairAssets ?? 0,
        retired: s.retired ?? s.retiredAssets ?? 0,
      });
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const createAsset = useCallback(async (assetData: Partial<Asset>) => {
    const res = await api('/create', { method: 'POST', body: JSON.stringify(assetData) }, userEmail);
    const data = await safeJson(res);
    if (!data?.success) throw new Error(data?.error ?? 'Failed to create asset');
    await loadAll();
    return normalizeAsset(data.data);
  }, [loadAll]);

  const updateAsset = useCallback(async (id: string, updates: Partial<Asset>) => {
    const res = await api(`/${id}`, { method: 'PUT', body: JSON.stringify(updates) }, userEmail);
    const data = await safeJson(res);
    if (!data?.success) throw new Error(data?.error ?? 'Failed to update asset');
    const asset = normalizeAsset(data.data);
    setAssets(prev => prev.map(a => a.id === id ? asset : a));
    return asset;
  }, []);

  const deleteAsset = useCallback(async (id: string) => {
    const res = await api(`/${id}`, { method: 'DELETE' }, userEmail);
    const data = await safeJson(res);
    if (!data?.success) throw new Error(data?.error ?? 'Failed to delete asset');
    setAssets(prev => prev.filter(a => a.id !== id));
    await loadAll();
  }, [loadAll]);

  const assignAsset = useCallback(async (assetId: string, employeeId: string, employeeName: string) => {
    const payload: AssetAssignment = {
      assetId,
      employeeId,
      employeeName,
      assignedDate: new Date().toISOString().slice(0, 10),
    };
    const res = await api('/assign', { method: 'POST', body: JSON.stringify(payload) }, userEmail);
    const data = await safeJson(res);
    if (!data?.success) throw new Error(data?.error ?? 'Failed to assign asset');
    const asset = normalizeAsset(data.data);
    setAssets(prev => prev.map(a => a.id === assetId ? asset : a));
    return asset;
  }, []);

  const returnAsset = useCallback(async (assetId: string) => {
    const res = await api('/return', {
      method: 'POST',
      body: JSON.stringify({ returnedDate: new Date().toISOString().slice(0, 10) }),
    }, userEmail);
    const data = await safeJson(res);
    if (!data?.success) throw new Error(data?.error ?? 'Failed to return asset');
    const asset = normalizeAsset(data.data);
    setAssets(prev => prev.map(a => a.id === assetId ? asset : a));
    return asset;
  }, []);

  const logMaintenance = useCallback(async (assetId: string, log: Omit<MaintenanceLog, 'id' | 'assetId'>) => {
    const res = await api(`/${assetId}/maintenance`, { method: 'POST', body: JSON.stringify(log) }, userEmail);
    const data = await safeJson(res);
    if (!data?.success) throw new Error(data?.error ?? 'Failed to log maintenance');
    setAssets(prev => prev.map(a =>
      a.id === assetId ? { ...a, maintenanceLogs: [...(a.maintenanceLogs || []), data.data] } : a
    ));
    return data.data as MaintenanceLog;
  }, []);

  const getAssetHistory = useCallback(async (assetId: string): Promise<MaintenanceLog[]> => {
    const res = await api(`/${assetId}/maintenance`, {}, userEmail);
    const data = await safeJson(res);
    if (!data?.success) throw new Error(data?.error ?? 'Failed to fetch history');
    return data.data as MaintenanceLog[];
  }, []);

  const isWarrantyExpired = useCallback((asset: Asset): boolean => {
    if (!asset.warrantyExpiry) return false;
    return new Date(asset.warrantyExpiry) < new Date();
  }, []);

  const isWarrantyExpiringSoon = useCallback((asset: Asset): boolean => {
    if (!asset.warrantyExpiry) return false;
    const expiry = new Date(asset.warrantyExpiry);
    const now = new Date();
    const thirtyDays = new Date();
    thirtyDays.setDate(now.getDate() + 30);
    return expiry >= now && expiry <= thirtyDays;
  }, []);

  return {
    assets,
    stats,
    loading,
    error,
    loadAll,
    refresh: loadAll,
    createAsset,
    updateAsset,
    deleteAsset,
    assignAsset,
    returnAsset,
    logMaintenance,
    getAssetHistory,
    isWarrantyExpired,
    isWarrantyExpiringSoon,
  };
}
