/**
 * ValueHelpsContext — loads all master_value_helps rows once at app startup.
 * All components call useVH('entity', 'field') to get dropdown options.
 * Avoids per-component API calls for dropdown data.
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { API_BASE, publicAnonKey } from '../utils/constants';

export interface VHOption {
  label: string;
  value: string;
  sort_order?: number;
  is_active?: boolean;
}

interface VHRow {
  id: string;
  entity: string;
  field: string;
  label: string;
  value: string;
  sort_order: number;
  is_active: boolean;
}

// Grouped: map[entity][field] = sorted active options
type VHMap = Record<string, Record<string, VHOption[]>>;

interface ValueHelpsContextType {
  /** Get dropdown options for an entity+field. Returns [] while loading. */
  getOptions: (entity: string, field: string) => VHOption[];
  /** All rows grouped as map[entity][field] */
  vhMap: VHMap;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ValueHelpsContext = createContext<ValueHelpsContextType>({
  getOptions: () => [],
  vhMap: {},
  loading: true,
  refresh: async () => {},
});

export function ValueHelpsProvider({ children }: { children: ReactNode }) {
  const [vhMap, setVhMap] = useState<VHMap>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/master-data/value-helps`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      const rows: VHRow[] = json?.data ?? json ?? [];

      const map: VHMap = {};
      for (const row of rows) {
        if (!row.is_active) continue;
        const entity = row.entity;
        const field = row.field;
        if (!map[entity]) map[entity] = {};
        if (!map[entity][field]) map[entity][field] = [];
        map[entity][field].push({
          label: row.label,
          value: row.value,
          sort_order: row.sort_order,
          is_active: row.is_active,
        });
      }

      // Sort each field's options by sort_order
      for (const entity of Object.keys(map)) {
        for (const field of Object.keys(map[entity])) {
          map[entity][field].sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));
        }
      }

      setVhMap(map);
    } catch {
      // Silently keep empty map; components fall back to static arrays
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('masterDataUpdated', handler);
    return () => window.removeEventListener('masterDataUpdated', handler);
  }, [load]);

  function getOptions(entity: string, field: string): VHOption[] {
    return vhMap[entity]?.[field] ?? [];
  }

  return (
    <ValueHelpsContext.Provider value={{ getOptions, vhMap, loading, refresh: load }}>
      {children}
    </ValueHelpsContext.Provider>
  );
}

export function useVH(entity: string, field: string): VHOption[] {
  const { getOptions } = useContext(ValueHelpsContext);
  return getOptions(entity, field);
}

export function useValueHelps() {
  return useContext(ValueHelpsContext);
}

/** Convenience: get a flat string array of values for a field */
export function useVHValues(entity: string, field: string): string[] {
  return useVH(entity, field).map(o => o.value);
}

/**
 * SelectOptions — renders <option> elements from a VH entity+field.
 * Usage: <SelectOptions entity="leave" field="type" placeholder="Select leave type" />
 */
export function SelectOptions({
  entity,
  field,
  placeholder,
  fallback,
}: {
  entity: string;
  field: string;
  placeholder?: string;
  fallback?: string[];
}) {
  const options = useVH(entity, field);
  const items = options.length > 0 ? options : (fallback ?? []).map(v => ({ label: v, value: v }));
  return (
    <>
      {placeholder && <option value="">{placeholder}</option>}
      {items.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </>
  );
}
