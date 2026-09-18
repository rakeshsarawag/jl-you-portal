import { useState, useEffect, useCallback } from 'react';
import { projectId, publicAnonKey, safeJson } from '../utils/constants';
import { toast } from 'sonner';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-1fe2c468`;

interface UseDatabasePersistenceOptions {
  keyPrefix: string;
  initialData?: any;
  autoSave?: boolean;
}

export function useDatabasePersistence<T = any>({
  keyPrefix,
  initialData,
  autoSave = true,
}: UseDatabasePersistenceOptions) {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load data from database on mount
  useEffect(() => {
    loadFromDatabase();
  }, [keyPrefix]);

  const loadFromDatabase = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${SERVER_URL}/master-data/get/${keyPrefix}`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (response.ok) {
        const result = await safeJson(response);
        if (result?.data) {
          setData(result.data);
        } else {
          // No data in database, use initial data
          setData(initialData);
          if (autoSave && initialData) {
            // Save initial data to database
            await saveToDatabase(initialData);
          }
        }
      } else {
        console.error('Failed to load from database:', await response.text());
        setData(initialData);
      }
    } catch (error) {
      console.error('Error loading from database:', error);
      setData(initialData);
    } finally {
      setLoading(false);
    }
  };

  const saveToDatabase = async (dataToSave: T) => {
    try {
      setSaving(true);
      const response = await fetch(`${SERVER_URL}/master-data/save`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: keyPrefix,
          data: dataToSave,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to save to database:', errorText);
        toast.error('Failed to save data');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error saving to database:', error);
      toast.error('Failed to save data');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateData = useCallback(async (newData: T | ((prev: T) => T)) => {
    const updatedData = typeof newData === 'function' 
      ? (newData as (prev: T) => T)(data) 
      : newData;
    
    setData(updatedData);
    
    if (autoSave) {
      await saveToDatabase(updatedData);
    }
    
    return updatedData;
  }, [data, autoSave]);

  const refresh = useCallback(async () => {
    await loadFromDatabase();
  }, [keyPrefix]);

  const manualSave = useCallback(async () => {
    return await saveToDatabase(data);
  }, [data]);

  return {
    data,
    setData: updateData,
    loading,
    saving,
    refresh,
    save: manualSave,
  };
}
