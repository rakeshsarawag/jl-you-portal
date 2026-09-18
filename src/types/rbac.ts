/**
 * Role-Based Access Control (RBAC) Type Definitions
 * Defines roles, permissions, and user access structures
 */

// User Roles
export type UserRole = 
  | 'admin'           // Full system access
  | 'hr'              // HR operations
  | 'finance'         // Finance operations
  | 'manager'         // Team management
  | 'employee'        // Basic employee access
  | 'it'              // IT operations
  | 'marketing'       // Marketing operations
  | 'developer'       // Software development
  | 'guest';          // Read-only access

// Application IDs matching your tiles
export type ApplicationId =
  | 'onboarding'
  | 'employee-dashboard'
  | 'recruitment'
  | 'performance'
  | 'documentation'
  | 'it-services'
  | 'training'
  | 'invoices'
  | 'linkedin'
  | 'master-data'
  | 'payroll'
  | 'projects'
  | 'communications'
  | 'assets'
  | 'okr'
  | 'directory'
  | 'knowledge-base';

// Permission Types
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export';

export interface Permission {
  app: ApplicationId;
  actions: PermissionAction[];
}

// Role Definition
export interface RoleDefinition {
  id: UserRole;
  name: string;
  description: string;
  permissions: Permission[];
  color: string;
  icon: string;
}

// User with Role
export interface UserWithRole {
  id: string;
  email: string;
  name: string;
  roles: UserRole[];
  primaryRole: UserRole;
  department?: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  lastLogin?: string;
  employeeId?: string | null;
}

// Permission Check Result
export interface PermissionCheck {
  granted: boolean;
  reason?: string;
  requiredRole?: UserRole[];
}

// Audit Log Entry
export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}

// Role Assignment Request
export interface RoleAssignmentRequest {
  userId: string;
  roles: UserRole[];
  assignedBy: string;
  reason: string;
}