import { createContext, useContext, useRef, useCallback, useEffect, type ReactNode } from 'react';

interface UnsavedChangesContextValue {
  register: (key: string) => void;
  unregister: (key: string) => void;
  hasUnsaved: () => boolean;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue>({
  register: () => {},
  unregister: () => {},
  hasUnsaved: () => false,
});

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const dirtyKeys = useRef<Set<string>>(new Set());

  const register = useCallback((key: string) => {
    dirtyKeys.current.add(key);
  }, []);

  const unregister = useCallback((key: string) => {
    dirtyKeys.current.delete(key);
  }, []);

  const hasUnsaved = useCallback(() => dirtyKeys.current.size > 0, []);

  return (
    <UnsavedChangesContext.Provider value={{ register, unregister, hasUnsaved }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

/**
 * Register unsaved state from any component.
 * Pass `isDirty = true` when there are unsaved changes.
 * Automatically cleans up on unmount.
 *
 * Usage:
 *   const [form, setForm] = useState(initialForm);
 *   const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm);
 *   useUnsavedChanges(isDirty);
 */
export function useUnsavedChanges(isDirty: boolean) {
  const { register, unregister } = useContext(UnsavedChangesContext);
  const key = useRef(`unsaved-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (isDirty) {
      register(key.current);
      return () => unregister(key.current);
    } else {
      unregister(key.current);
    }
  }, [isDirty, register, unregister]);

  // Always unregister on unmount
  useEffect(() => {
    return () => unregister(key.current);
  }, [unregister]);
}

export function useUnsavedChangesContext() {
  return useContext(UnsavedChangesContext);
}
