/**
 * User Context
 * Source of truth for the current user's identity and roles.
 * Roles are fetched from app_users (DB), not just user_metadata (JWT),
 * so role changes in User Management take effect immediately on next load.
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { UserRole } from '../../types/rbac';
import { projectId, publicAnonKey, supabase } from '../utils/constants';
import { getPrimaryRole } from '../../utils/rbac/permissionChecker';
import { toast } from 'sonner';

function detectDeviceType(ua: string): string {
  if (/mobile|android|iphone|ipad|tablet/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
}

async function recordLoginEvent(appUserId: string, email: string, accessToken: string) {
  const ua = navigator.userAgent;
  const deviceType = detectDeviceType(ua);
  const now = new Date().toISOString();
  // Use a hash of the access token as a stable session identifier
  const tokenHash = btoa(accessToken.slice(-32)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);

  void supabase.from('login_history').insert([{
    user_id: appUserId,
    email,
    user_agent: ua,
    device_type: deviceType,
    success: true,
    mfa_used: false,
    logged_in_at: now,
  }]);

  // Upsert session record (idempotent on token hash)
  void supabase.from('app_user_sessions').upsert([{
    user_id: appUserId,
    session_token: tokenHash,
    user_agent: ua,
    device_type: deviceType,
    started_at: now,
    last_seen_at: now,
    revoked: false,
  }], { onConflict: 'session_token', ignoreDuplicates: false });
}

export interface CurrentUser {
  id: string;
  /** app_users.id — used for notification queries and audit logs */
  appUserId?: string;
  email: string;
  name: string;
  roles: UserRole[];
  primaryRole: UserRole;
  department?: string;
  position?: string;
  status: 'active' | 'inactive' | 'suspended';
  avatar?: string;
  employeeId?: string | null;
  permissionOverrides?: any[];
  /** True when the auth user has no provisioned app_users record */
  notProvisioned?: boolean;
}

interface UserContextType {
  currentUser: CurrentUser | null;
  loading: boolean;
  setCurrentUser: (user: CurrentUser | null) => void;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
  accessToken: string;
}

export function UserProvider({ children, accessToken }: UserProviderProps) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const recordedTokenRef = useRef<string | null>(null);

  const fetchCurrentUser = async () => {
    try {
      setLoading(true);
      // 1. Verify the session with Supabase Auth
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !authUser) throw new Error('Could not verify user session');

      // 2. Fetch authoritative profile + roles from app_users (DB)
      const VALID_ROLES: UserRole[] = ['admin', 'hr', 'manager', 'finance', 'employee', 'it', 'marketing'];
      let dbRoles: UserRole[] | null = null;
      let dbName: string | null = null;
      let dbDept: string | null = null;
      let dbStatus: CurrentUser['status'] = 'active';
      let dbEmployeeId: string | null = null;
      let dbOverrides: any[] = [];
      let foundInAppUsers = false;

      let dbAppUserId: string | undefined;
      try {
        // Fetch app_users row directly — Edge Functions are unavailable
        const { data: row, error: rowError } = await supabase
          .from('app_users')
          .select('id, name, roles, department, status, employee_id, permission_overrides')
          .eq('email', authUser.email ?? '')
          .single();
        console.log('[UserCtx] app_users row:', row?.id, 'error:', rowError?.message);
        if (row) {
          foundInAppUsers = true;
          dbAppUserId = row.id;
          dbRoles = Array.isArray(row.roles) && row.roles.length > 0
            ? (row.roles as string[]).filter(r => VALID_ROLES.includes(r as UserRole)) as UserRole[]
            : ['employee'];
          dbName = row.name || null;
          dbDept = row.department || null;
          dbStatus = (row.status as CurrentUser['status']) || 'active';
          dbEmployeeId = row.employee_id || null;
          dbOverrides = row.permission_overrides ?? [];
        }
      } catch {
        // Network error — fall through to metadata fallback
      }

      // Role priority: DB app_users row → validated JWT metadata → default employee
      // Metadata is only trusted as a fallback when the DB is unreachable or the user
      // has no app_users row yet (e.g. an admin created directly in Supabase Auth).
      let roles: UserRole[];
      if (dbRoles !== null) {
        roles = dbRoles;
      } else {
        const metaRoles = authUser.user_metadata?.roles as string[] | undefined;
        const validatedMeta = Array.isArray(metaRoles)
          ? metaRoles.filter(r => VALID_ROLES.includes(r as UserRole)) as UserRole[]
          : [];
        roles = validatedMeta.length > 0 ? validatedMeta : ['employee'];
      }

      const user: CurrentUser = {
        id: authUser.id,
        appUserId: dbAppUserId,
        email: authUser.email || '',
        name: dbName || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
        roles,
        primaryRole: getPrimaryRole(roles),
        department: dbDept || authUser.user_metadata?.department,
        position: authUser.user_metadata?.position,
        status: dbStatus,
        avatar: authUser.user_metadata?.avatar_url || authUser.user_metadata?.avatar,
        employeeId: dbEmployeeId,
        permissionOverrides: dbOverrides,
        notProvisioned: !foundInAppUsers,
      };

      setCurrentUser(user);

      // Record login event once per access token (fire-and-forget)
      if (dbAppUserId && accessToken && recordedTokenRef.current !== accessToken) {
        recordedTokenRef.current = accessToken;
        void recordLoginEvent(dbAppUserId, authUser.email || '', accessToken);
      }
    } catch (error: any) {
      console.error('Error fetching current user:', error);
      setCurrentUser(null);
      toast.error('Failed to load user profile', {
        description: 'Please contact your administrator if this persists.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) fetchCurrentUser();
  }, [accessToken]);

  return (
    <UserContext.Provider value={{ currentUser, loading, setCurrentUser, refreshUser: fetchCurrentUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within a UserProvider');
  return ctx;
}
