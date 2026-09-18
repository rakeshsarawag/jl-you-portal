import { useUser } from '../app/context/UserContext';
import { supabase } from '../app/utils/constants';

interface LogParams {
  event_type: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical' | 'info';
  status?: 'success' | 'failure' | 'partial';
  metadata?: Record<string, unknown>;
}

export function useAuditLogger() {
  const { currentUser } = useUser();

  const log = ({
    event_type,
    action,
    resource_type,
    resource_id,
    severity = 'info',
    status = 'success',
    metadata = {},
  }: LogParams) => {
    void supabase.from('audit_logs').insert([{
      event_type,
      action,
      resource_type,
      resource_id,
      severity,
      status,
      metadata,
      user_id: currentUser?.id,
      user_email: currentUser?.email,
      user_role: currentUser?.primaryRole,
      timestamp: new Date().toISOString(),
    }]);
  };

  return { log };
}

export default useAuditLogger;
