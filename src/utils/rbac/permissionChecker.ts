/**
 * Permission Checker Utility
 * Check if a user has permission to perform actions
 */

import { UserRole, ApplicationId, PermissionAction, PermissionCheck } from '../../types/rbac';
import { ROLE_DEFINITIONS } from './roleDefinitions';

/**
 * Check if user has permission to access an application
 */
export function canAccessApp(
  userRoles: UserRole[],
  appId: ApplicationId
): PermissionCheck {
  // Admin always has access
  if (userRoles.includes('admin')) {
    return { granted: true };
  }

  // Check if any of the user's roles has access to this app
  for (const roleId of userRoles) {
    const role = ROLE_DEFINITIONS[roleId];
    if (!role) continue;

    const permission = role.permissions.find(p => p.app === appId);
    if (permission && permission.actions.length > 0) {
      return { granted: true };
    }
  }

  return {
    granted: false,
    reason: 'You do not have permission to access this application',
    requiredRole: getRequiredRoles(appId),
  };
}

/**
 * Check if user has permission to perform a specific action
 */
export function canPerformAction(
  userRoles: UserRole[],
  appId: ApplicationId,
  action: PermissionAction
): PermissionCheck {
  // Admin always has all permissions
  if (userRoles.includes('admin')) {
    return { granted: true };
  }

  // Check if any of the user's roles has this permission
  for (const roleId of userRoles) {
    const role = ROLE_DEFINITIONS[roleId];
    if (!role) continue;

    const permission = role.permissions.find(p => p.app === appId);
    if (permission && permission.actions.includes(action)) {
      return { granted: true };
    }
  }

  return {
    granted: false,
    reason: `You do not have permission to ${action} in this application`,
    requiredRole: getRequiredRolesForAction(appId, action),
  };
}

/**
 * Get all apps accessible by user roles
 */
export function getAccessibleApps(userRoles: UserRole[]): ApplicationId[] {
  const accessibleApps = new Set<ApplicationId>();

  for (const roleId of userRoles) {
    const role = ROLE_DEFINITIONS[roleId];
    if (!role) continue;

    for (const permission of role.permissions) {
      if (permission.actions.length > 0) {
        accessibleApps.add(permission.app);
      }
    }
  }

  return Array.from(accessibleApps);
}

/**
 * Get allowed actions for an app
 */
export function getAllowedActions(
  userRoles: UserRole[],
  appId: ApplicationId
): PermissionAction[] {
  const allowedActions = new Set<PermissionAction>();

  for (const roleId of userRoles) {
    const role = ROLE_DEFINITIONS[roleId];
    if (!role) continue;

    const permission = role.permissions.find(p => p.app === appId);
    if (permission) {
      permission.actions.forEach(action => allowedActions.add(action));
    }
  }

  return Array.from(allowedActions);
}

/**
 * Get roles that have access to an app
 */
function getRequiredRoles(appId: ApplicationId): UserRole[] {
  const roles: UserRole[] = [];

  for (const [roleId, roleDef] of Object.entries(ROLE_DEFINITIONS)) {
    const hasAccess = roleDef.permissions.some(
      p => p.app === appId && p.actions.length > 0
    );
    if (hasAccess) {
      roles.push(roleId as UserRole);
    }
  }

  return roles;
}

/**
 * Get roles that can perform a specific action
 */
function getRequiredRolesForAction(
  appId: ApplicationId,
  action: PermissionAction
): UserRole[] {
  const roles: UserRole[] = [];

  for (const [roleId, roleDef] of Object.entries(ROLE_DEFINITIONS)) {
    const hasPermission = roleDef.permissions.some(
      p => p.app === appId && p.actions.includes(action)
    );
    if (hasPermission) {
      roles.push(roleId as UserRole);
    }
  }

  return roles;
}

/**
 * Check if user is admin
 */
export function isAdmin(userRoles: UserRole[]): boolean {
  return userRoles.includes('admin');
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(userRoles: UserRole[], requiredRoles: UserRole[]): boolean {
  return requiredRoles.some(role => userRoles.includes(role));
}

/**
 * Check if user has all of the specified roles
 */
export function hasAllRoles(userRoles: UserRole[], requiredRoles: UserRole[]): boolean {
  return requiredRoles.every(role => userRoles.includes(role));
}

/**
 * Get user's primary role (first non-employee role, or employee if that's all they have)
 */
export function getPrimaryRole(userRoles: UserRole[]): UserRole {
  if (userRoles.includes('admin')) return 'admin';
  if (userRoles.includes('hr')) return 'hr';
  if (userRoles.includes('finance')) return 'finance';
  if (userRoles.includes('manager')) return 'manager';
  if (userRoles.includes('it')) return 'it';
  if (userRoles.includes('marketing')) return 'marketing';
  if (userRoles.includes('employee')) return 'employee';
  return 'guest';
}
