/**
 * useRBAC Hook
 * Manage role-based access control in components
 */

import { useCallback, useMemo } from 'react';
import { UserRole, ApplicationId, PermissionAction, PermissionCheck } from '../../types/rbac';
import {
  canAccessApp,
  canPerformAction,
  getAccessibleApps,
  getAllowedActions,
  isAdmin,
  hasAnyRole,
  getPrimaryRole,
} from '../../utils/rbac/permissionChecker';

interface UseRBACOptions {
  userRoles: UserRole[];
}

export function useRBAC({ userRoles }: UseRBACOptions) {
  /**
   * Check if user can access an application
   */
  const checkAppAccess = useCallback(
    (appId: ApplicationId): PermissionCheck => {
      return canAccessApp(userRoles, appId);
    },
    [userRoles]
  );

  /**
   * Check if user can perform an action
   */
  const checkAction = useCallback(
    (appId: ApplicationId, action: PermissionAction): PermissionCheck => {
      return canPerformAction(userRoles, appId, action);
    },
    [userRoles]
  );

  /**
   * Get all accessible apps
   */
  const accessibleApps = useMemo(() => {
    return getAccessibleApps(userRoles);
  }, [userRoles]);

  /**
   * Get allowed actions for an app
   */
  const getAppActions = useCallback(
    (appId: ApplicationId): PermissionAction[] => {
      return getAllowedActions(userRoles, appId);
    },
    [userRoles]
  );

  /**
   * Check if user is admin
   */
  const userIsAdmin = useMemo(() => {
    return isAdmin(userRoles);
  }, [userRoles]);

  /**
   * Check if user has any of the specified roles
   */
  const checkAnyRole = useCallback(
    (requiredRoles: UserRole[]): boolean => {
      return hasAnyRole(userRoles, requiredRoles);
    },
    [userRoles]
  );

  /**
   * Get primary role
   */
  const primaryRole = useMemo(() => {
    return getPrimaryRole(userRoles);
  }, [userRoles]);

  /**
   * Can create in app
   */
  const canCreate = useCallback(
    (appId: ApplicationId): boolean => {
      return canPerformAction(userRoles, appId, 'create').granted;
    },
    [userRoles]
  );

  /**
   * Can read in app
   */
  const canRead = useCallback(
    (appId: ApplicationId): boolean => {
      return canPerformAction(userRoles, appId, 'read').granted;
    },
    [userRoles]
  );

  /**
   * Can update in app
   */
  const canUpdate = useCallback(
    (appId: ApplicationId): boolean => {
      return canPerformAction(userRoles, appId, 'update').granted;
    },
    [userRoles]
  );

  /**
   * Can delete in app
   */
  const canDelete = useCallback(
    (appId: ApplicationId): boolean => {
      return canPerformAction(userRoles, appId, 'delete').granted;
    },
    [userRoles]
  );

  /**
   * Can approve in app
   */
  const canApprove = useCallback(
    (appId: ApplicationId): boolean => {
      return canPerformAction(userRoles, appId, 'approve').granted;
    },
    [userRoles]
  );

  /**
   * Can export from app
   */
  const canExport = useCallback(
    (appId: ApplicationId): boolean => {
      return canPerformAction(userRoles, appId, 'export').granted;
    },
    [userRoles]
  );

  return {
    // Core checks
    checkAppAccess,
    checkAction,
    accessibleApps,
    getAppActions,
    
    // Role checks
    isAdmin: userIsAdmin,
    checkAnyRole,
    primaryRole,
    
    // Action shortcuts
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    canApprove,
    canExport,
  };
}
