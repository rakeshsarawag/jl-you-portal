/**
 * Role Definitions and Permission Mappings
 * Defines what each role can access and do
 */

import { RoleDefinition, Permission } from '../../types/rbac';

// Permission shortcuts for easier reading
const CRUD: Permission['actions'] = ['create', 'read', 'update', 'delete'];
const READ: Permission['actions'] = ['read'];
const READ_CREATE: Permission['actions'] = ['read', 'create'];
const READ_UPDATE: Permission['actions'] = ['read', 'update'];
const FULL: Permission['actions'] = ['create', 'read', 'update', 'delete', 'approve', 'export'];

/**
 * Role Definitions
 * Each role specifies which apps they can access and what actions they can perform
 */
export const ROLE_DEFINITIONS: Record<string, RoleDefinition> = {
  admin: {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access - can manage all applications and users',
    color: 'bg-red-500',
    icon: 'Shield',
    permissions: [
      { app: 'onboarding', actions: FULL },
      { app: 'employee-dashboard', actions: FULL },
      { app: 'recruitment', actions: FULL },
      { app: 'performance', actions: FULL },
      { app: 'documentation', actions: FULL },
      { app: 'it-services', actions: FULL },
      { app: 'training', actions: FULL },
      { app: 'invoices', actions: FULL },
      { app: 'linkedin', actions: FULL },
      { app: 'master-data', actions: FULL },
      { app: 'payroll', actions: FULL },
      { app: 'projects', actions: FULL },
      { app: 'communications', actions: FULL },
      { app: 'assets', actions: FULL },
      { app: 'okr', actions: FULL },
      { app: 'directory', actions: FULL },
      { app: 'knowledge-base', actions: FULL },
    ],
  },

  hr: {
    id: 'hr',
    name: 'HR Manager',
    description: 'Manage HR operations, recruitment, performance, and employee data',
    color: 'bg-blue-500',
    icon: 'Users',
    permissions: [
      { app: 'onboarding', actions: FULL },
      { app: 'employee-dashboard', actions: READ_UPDATE },
      { app: 'recruitment', actions: FULL },
      { app: 'performance', actions: FULL },
      { app: 'documentation', actions: READ_CREATE },
      { app: 'it-services', actions: READ_CREATE },
      { app: 'training', actions: FULL },
      { app: 'invoices', actions: READ },
      { app: 'linkedin', actions: READ },
      { app: 'master-data', actions: FULL },
      { app: 'payroll', actions: FULL },
      { app: 'projects', actions: READ },
      { app: 'communications', actions: FULL },
      { app: 'assets', actions: READ_UPDATE },
      { app: 'okr', actions: READ_UPDATE },
      { app: 'directory', actions: FULL },
      { app: 'knowledge-base', actions: FULL },
    ],
  },

  finance: {
    id: 'finance',
    name: 'Finance Manager',
    description: 'Manage financial operations, invoices, and payroll',
    color: 'bg-green-500',
    icon: 'DollarSign',
    permissions: [
      { app: 'onboarding', actions: READ },
      { app: 'employee-dashboard', actions: READ },
      { app: 'recruitment', actions: READ },
      { app: 'performance', actions: READ },
      { app: 'documentation', actions: READ_CREATE },
      { app: 'it-services', actions: READ_CREATE },
      { app: 'training', actions: READ },
      { app: 'invoices', actions: FULL },
      { app: 'linkedin', actions: READ },
      { app: 'master-data', actions: FULL },
      { app: 'payroll', actions: FULL },
      { app: 'projects', actions: READ_UPDATE },
      { app: 'communications', actions: READ },
      { app: 'assets', actions: READ_UPDATE },
      { app: 'okr', actions: READ },
      { app: 'directory', actions: READ },
      { app: 'knowledge-base', actions: READ_CREATE },
    ],
  },

  manager: {
    id: 'manager',
    name: 'Manager',
    description: 'Manage team performance, projects, and OKRs',
    color: 'bg-purple-500',
    icon: 'Briefcase',
    permissions: [
      { app: 'onboarding', actions: READ },
      { app: 'employee-dashboard', actions: READ_UPDATE },
      { app: 'recruitment', actions: READ_CREATE },
      { app: 'performance', actions: FULL },
      { app: 'documentation', actions: READ_CREATE },
      { app: 'it-services', actions: READ_CREATE },
      { app: 'training', actions: READ_UPDATE },
      { app: 'invoices', actions: READ },
      { app: 'linkedin', actions: READ_CREATE },
      { app: 'master-data', actions: READ },
      { app: 'payroll', actions: READ },
      { app: 'projects', actions: FULL },
      { app: 'communications', actions: READ_CREATE },
      { app: 'assets', actions: READ },
      { app: 'okr', actions: FULL },
      { app: 'directory', actions: READ },
      { app: 'knowledge-base', actions: FULL },
    ],
  },

  employee: {
    id: 'employee',
    name: 'Employee',
    description: 'Basic employee access to personal dashboard and company resources',
    color: 'bg-cyan-500',
    icon: 'User',
    permissions: [
      { app: 'onboarding', actions: READ },
      { app: 'employee-dashboard', actions: READ_CREATE },
      { app: 'recruitment', actions: READ },
      { app: 'performance', actions: READ },
      { app: 'documentation', actions: READ },
      { app: 'it-services', actions: READ_CREATE },
      { app: 'training', actions: READ_CREATE },
      { app: 'invoices', actions: READ },
      { app: 'linkedin', actions: READ },
      { app: 'master-data', actions: READ },
      { app: 'payroll', actions: READ },
      { app: 'projects', actions: READ_UPDATE },
      { app: 'communications', actions: READ },
      { app: 'assets', actions: READ },
      { app: 'okr', actions: READ },
      { app: 'directory', actions: READ },
      { app: 'knowledge-base', actions: READ_CREATE },
    ],
  },

  it: {
    id: 'it',
    name: 'IT Administrator',
    description: 'Manage IT services, assets, and technical infrastructure',
    color: 'bg-indigo-500',
    icon: 'Laptop',
    permissions: [
      { app: 'onboarding', actions: READ_UPDATE },
      { app: 'employee-dashboard', actions: READ },
      { app: 'recruitment', actions: READ },
      { app: 'performance', actions: READ },
      { app: 'documentation', actions: FULL },
      { app: 'it-services', actions: FULL },
      { app: 'training', actions: READ },
      { app: 'invoices', actions: READ },
      { app: 'linkedin', actions: READ },
      { app: 'master-data', actions: READ_UPDATE },
      { app: 'payroll', actions: READ },
      { app: 'projects', actions: READ },
      { app: 'communications', actions: READ },
      { app: 'assets', actions: FULL },
      { app: 'okr', actions: READ },
      { app: 'directory', actions: READ_UPDATE },
      { app: 'knowledge-base', actions: FULL },
    ],
  },

  marketing: {
    id: 'marketing',
    name: 'Marketing Manager',
    description: 'Manage marketing content and communications',
    color: 'bg-pink-500',
    icon: 'Share2',
    permissions: [
      { app: 'onboarding', actions: READ },
      { app: 'employee-dashboard', actions: READ },
      { app: 'recruitment', actions: READ },
      { app: 'performance', actions: READ },
      { app: 'documentation', actions: READ_CREATE },
      { app: 'it-services', actions: READ_CREATE },
      { app: 'training', actions: READ },
      { app: 'invoices', actions: READ },
      { app: 'linkedin', actions: FULL },
      { app: 'master-data', actions: READ_CREATE },
      { app: 'payroll', actions: READ },
      { app: 'projects', actions: READ_UPDATE },
      { app: 'communications', actions: FULL },
      { app: 'assets', actions: READ },
      { app: 'okr', actions: READ_UPDATE },
      { app: 'directory', actions: READ },
      { app: 'knowledge-base', actions: FULL },
    ],
  },

  guest: {
    id: 'guest',
    name: 'Guest',
    description: 'Read-only access to public information',
    color: 'bg-gray-500',
    icon: 'Eye',
    permissions: [
      { app: 'onboarding', actions: [] },
      { app: 'employee-dashboard', actions: [] },
      { app: 'recruitment', actions: [] },
      { app: 'performance', actions: [] },
      { app: 'documentation', actions: READ },
      { app: 'it-services', actions: [] },
      { app: 'training', actions: READ },
      { app: 'invoices', actions: [] },
      { app: 'linkedin', actions: [] },
      { app: 'master-data', actions: [] },
      { app: 'payroll', actions: [] },
      { app: 'projects', actions: [] },
      { app: 'communications', actions: READ },
      { app: 'assets', actions: [] },
      { app: 'okr', actions: [] },
      { app: 'directory', actions: READ },
      { app: 'knowledge-base', actions: READ },
    ],
  },
};

/**
 * Get role definition by ID
 */
export function getRoleDefinition(roleId: string): RoleDefinition | undefined {
  return ROLE_DEFINITIONS[roleId];
}

/**
 * Get all role definitions as an array
 */
export function getAllRoles(): RoleDefinition[] {
  return Object.values(ROLE_DEFINITIONS);
}

/**
 * Get role color
 */
export function getRoleColor(roleId: string): string {
  return ROLE_DEFINITIONS[roleId]?.color || 'bg-gray-500';
}

/**
 * Get role name
 */
export function getRoleName(roleId: string): string {
  return ROLE_DEFINITIONS[roleId]?.name || 'Unknown Role';
}
