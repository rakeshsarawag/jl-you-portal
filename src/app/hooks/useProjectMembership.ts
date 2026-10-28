import { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import { supabase } from '../utils/constants';

export function useProjectMembership(enabled = true) {
  const { currentUser, loading: userLoading } = useUser();
  const [hasProjectMembership, setHasProjectMembership] = useState(false);
  const [membershipLoaded, setMembershipLoaded] = useState(!enabled);
  const isAdmin = currentUser?.roles?.includes('admin') || currentUser?.primaryRole === 'admin';

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      setHasProjectMembership(false);
      setMembershipLoaded(true);
      return () => {
        cancelled = true;
      };
    }

    if (userLoading) {
      setMembershipLoaded(false);
      return () => {
        cancelled = true;
      };
    }

    if (isAdmin) {
      setHasProjectMembership(true);
      setMembershipLoaded(true);
      return () => {
        cancelled = true;
      };
    }

    const employeeId = currentUser?.employeeId;
    if (!employeeId) {
      setHasProjectMembership(false);
      setMembershipLoaded(true);
      return () => {
        cancelled = true;
      };
    }

    setMembershipLoaded(false);
    const loadMembership = async () => {
      try {
        const { data, error } = await supabase
          .from('project_members')
          .select('id')
          .eq('employee_id', employeeId)
          .limit(1)
          .maybeSingle();
        if (!cancelled) setHasProjectMembership(!error && Boolean(data));
      } catch {
        if (!cancelled) setHasProjectMembership(false);
      } finally {
        if (!cancelled) setMembershipLoaded(true);
      }
    };
    void loadMembership();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.employeeId, enabled, isAdmin, userLoading]);

  return { hasProjectMembership, membershipLoaded };
}
