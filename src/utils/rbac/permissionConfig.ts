/**
 * Permission Configuration System
 * Centralized, editable permission matrix for all applications
 */

import { UserRole, ApplicationId, PermissionAction } from '../../types/rbac';

export interface FeaturePermission {
  feature: string;
  label: string;
  description: string;
  actions: PermissionAction[];
}

export interface AppPermissionConfig {
  appId: ApplicationId;
  appName: string;
  features: FeaturePermission[];
}

export interface RolePermissionMatrix {
  [key: string]: { // role
    [key: string]: { // appId
      [key: string]: PermissionAction[]; // feature: actions[]
    };
  };
}

// Define all features for each application
export const APP_FEATURES: Record<ApplicationId, FeaturePermission[]> = {
  'onboarding': [
    { feature: 'tasks', label: 'Onboarding Tasks', description: 'Manage onboarding task lists', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'documents', label: 'Documents', description: 'Upload and manage onboarding documents', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'schedule', label: 'Schedule', description: 'Set up onboarding schedules', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'employees', label: 'New Employees', description: 'Manage new employee records', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'export', label: 'Export Data', description: 'Export onboarding reports', actions: ['export'] },
  ],
  'dashboard': [
    { feature: 'view', label: 'View Dashboard', description: 'Access personal dashboard', actions: ['read'] },
    { feature: 'widgets', label: 'Customize Widgets', description: 'Add/remove dashboard widgets', actions: ['create', 'update', 'delete'] },
    { feature: 'tasks', label: 'Personal Tasks', description: 'Manage personal task list', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'announcements', label: 'Announcements', description: 'View company announcements', actions: ['read'] },
    { feature: 'export', label: 'Export Dashboard', description: 'Export dashboard data', actions: ['export'] },
  ],
  'recruitment': [
    { feature: 'candidates', label: 'Candidates', description: 'Manage candidate database', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'interviews', label: 'Interviews', description: 'Schedule and manage interviews', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'jobs', label: 'Job Postings', description: 'Create and manage job postings', actions: ['create', 'read', 'update', 'delete', 'approve'] },
    { feature: 'offers', label: 'Job Offers', description: 'Send and manage job offers', actions: ['create', 'read', 'update', 'approve'] },
    { feature: 'pipeline', label: 'Recruitment Pipeline', description: 'Manage recruitment stages', actions: ['read', 'update'] },
    { feature: 'export', label: 'Export Reports', description: 'Export recruitment data', actions: ['export'] },
  ],
  'performance': [
    { feature: 'reviews', label: 'Performance Reviews', description: 'Conduct performance reviews', actions: ['create', 'read', 'update', 'approve'] },
    { feature: 'goals', label: 'Goals', description: 'Set and track employee goals', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'feedback', label: 'Feedback', description: 'Give and receive feedback', actions: ['create', 'read'] },
    { feature: 'ratings', label: 'Ratings', description: 'Rate employee performance', actions: ['create', 'read', 'update'] },
    { feature: 'reports', label: 'Reports', description: 'Generate performance reports', actions: ['read', 'export'] },
  ],
  'documentation': [
    { feature: 'articles', label: 'Documentation Articles', description: 'Create help articles', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'categories', label: 'Categories', description: 'Organize documentation', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'search', label: 'Search', description: 'Search documentation', actions: ['read'] },
    { feature: 'feedback', label: 'Feedback', description: 'Rate documentation quality', actions: ['create', 'read'] },
    { feature: 'export', label: 'Export Docs', description: 'Export documentation', actions: ['export'] },
  ],
  'it-services': [
    { feature: 'tickets', label: 'IT Tickets', description: 'Create and manage IT support tickets', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'assign', label: 'Assign Tickets', description: 'Assign tickets to IT staff', actions: ['update'] },
    { feature: 'resolve', label: 'Resolve Tickets', description: 'Mark tickets as resolved', actions: ['update', 'approve'] },
    { feature: 'categories', label: 'Ticket Categories', description: 'Manage ticket categories', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'reports', label: 'IT Reports', description: 'Generate IT service reports', actions: ['read', 'export'] },
  ],
  'training': [
    { feature: 'sessions', label: 'Training Sessions', description: 'Schedule training sessions', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'enrollments', label: 'Enrollments', description: 'Enroll employees in training', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'materials', label: 'Training Materials', description: 'Upload training materials', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'certificates', label: 'Certificates', description: 'Issue training certificates', actions: ['create', 'read', 'approve'] },
    { feature: 'reports', label: 'Training Reports', description: 'Generate training reports', actions: ['read', 'export'] },
  ],
  'invoices': [
    { feature: 'invoices', label: 'Invoices', description: 'Create and manage invoices', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'approve', label: 'Approve Invoices', description: 'Approve invoices for payment', actions: ['approve'] },
    { feature: 'send', label: 'Send Invoices', description: 'Email invoices to clients', actions: ['update'] },
    { feature: 'payments', label: 'Payments', description: 'Track invoice payments', actions: ['create', 'read', 'update'] },
    { feature: 'reports', label: 'Financial Reports', description: 'Generate invoice reports', actions: ['read', 'export'] },
  ],
  'linkedin': [
    { feature: 'posts', label: 'LinkedIn Posts', description: 'Create LinkedIn content', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'schedule', label: 'Schedule Posts', description: 'Schedule posts for later', actions: ['create', 'update'] },
    { feature: 'approve', label: 'Approve Posts', description: 'Approve posts before publishing', actions: ['approve'] },
    { feature: 'analytics', label: 'Analytics', description: 'View post analytics', actions: ['read'] },
    { feature: 'templates', label: 'Templates', description: 'Manage post templates', actions: ['create', 'read', 'update', 'delete'] },
  ],
  'master-data': [
    { feature: 'clients', label: 'Clients', description: 'Manage client database', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'employees', label: 'Employees', description: 'Manage employee records', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'departments', label: 'Departments', description: 'Manage departments', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'locations', label: 'Locations', description: 'Manage office locations', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'export', label: 'Export Data', description: 'Export master data', actions: ['export'] },
  ],
  'payroll': [
    { feature: 'payroll', label: 'Payroll Processing', description: 'Process monthly payroll', actions: ['create', 'read', 'update'] },
    { feature: 'approve', label: 'Approve Payroll', description: 'Approve payroll for payment', actions: ['approve'] },
    { feature: 'salaries', label: 'Salary Management', description: 'Manage employee salaries', actions: ['read', 'update'] },
    { feature: 'deductions', label: 'Deductions', description: 'Manage payroll deductions', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'reports', label: 'Payroll Reports', description: 'Generate payroll reports', actions: ['read', 'export'] },
  ],
  'projects': [
    { feature: 'projects', label: 'Projects', description: 'Manage project database', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'tasks', label: 'Tasks', description: 'Create and assign tasks', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'milestones', label: 'Milestones', description: 'Track project milestones', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'team', label: 'Team Management', description: 'Assign team members', actions: ['create', 'update', 'delete'] },
    { feature: 'reports', label: 'Project Reports', description: 'Generate project reports', actions: ['read', 'export'] },
  ],
  'communications': [
    { feature: 'announcements', label: 'Announcements', description: 'Create company announcements', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'approve', label: 'Approve Content', description: 'Approve announcements', actions: ['approve'] },
    { feature: 'categories', label: 'Categories', description: 'Manage announcement categories', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'notifications', label: 'Notifications', description: 'Send push notifications', actions: ['create'] },
    { feature: 'analytics', label: 'Analytics', description: 'View engagement analytics', actions: ['read'] },
  ],
  'assets': [
    { feature: 'assets', label: 'Assets', description: 'Manage company assets', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'assign', label: 'Assign Assets', description: 'Assign assets to employees', actions: ['create', 'update'] },
    { feature: 'maintenance', label: 'Maintenance', description: 'Track asset maintenance', actions: ['create', 'read', 'update'] },
    { feature: 'depreciation', label: 'Depreciation', description: 'Calculate asset depreciation', actions: ['read', 'update'] },
    { feature: 'reports', label: 'Asset Reports', description: 'Generate asset reports', actions: ['read', 'export'] },
  ],
  'okr': [
    { feature: 'objectives', label: 'Objectives', description: 'Set company objectives', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'key-results', label: 'Key Results', description: 'Define key results', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'progress', label: 'Track Progress', description: 'Update OKR progress', actions: ['update'] },
    { feature: 'align', label: 'Alignment', description: 'Align team OKRs', actions: ['read', 'update'] },
    { feature: 'reports', label: 'OKR Reports', description: 'Generate OKR reports', actions: ['read', 'export'] },
  ],
  'directory': [
    { feature: 'profiles', label: 'Employee Profiles', description: 'View employee profiles', actions: ['read'] },
    { feature: 'edit', label: 'Edit Profiles', description: 'Edit employee information', actions: ['update'] },
    { feature: 'search', label: 'Search Directory', description: 'Search for employees', actions: ['read'] },
    { feature: 'org-chart', label: 'Org Chart', description: 'View organization chart', actions: ['read'] },
    { feature: 'export', label: 'Export Directory', description: 'Export employee directory', actions: ['export'] },
  ],
  'knowledge': [
    { feature: 'articles', label: 'Knowledge Articles', description: 'Create knowledge base articles', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'categories', label: 'Categories', description: 'Organize knowledge base', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'search', label: 'Search', description: 'Search knowledge base', actions: ['read'] },
    { feature: 'comments', label: 'Comments', description: 'Comment on articles', actions: ['create', 'read', 'update', 'delete'] },
    { feature: 'export', label: 'Export Wiki', description: 'Export knowledge base', actions: ['export'] },
  ],
};

// Default permission matrix (can be overridden by database)
export const DEFAULT_PERMISSION_MATRIX: RolePermissionMatrix = {
  'admin': {
    // Admin has all permissions for all apps and features
    ...Object.keys(APP_FEATURES).reduce((acc, appId) => ({
      ...acc,
      [appId]: APP_FEATURES[appId as ApplicationId].reduce((featureAcc, feature) => ({
        ...featureAcc,
        [feature.feature]: feature.actions,
      }), {}),
    }), {}),
  },
  'hr': {
    'onboarding': {
      'tasks': ['create', 'read', 'update', 'delete'],
      'documents': ['create', 'read', 'update', 'delete'],
      'schedule': ['create', 'read', 'update', 'delete'],
      'employees': ['create', 'read', 'update', 'delete'],
      'export': ['export'],
    },
    'dashboard': {
      'view': ['read'],
      'widgets': ['create', 'update', 'delete'],
      'tasks': ['create', 'read', 'update', 'delete'],
      'announcements': ['read'],
      'export': ['export'],
    },
    'recruitment': {
      'candidates': ['create', 'read', 'update', 'delete'],
      'interviews': ['create', 'read', 'update', 'delete'],
      'jobs': ['create', 'read', 'update', 'delete', 'approve'],
      'offers': ['create', 'read', 'update', 'approve'],
      'pipeline': ['read', 'update'],
      'export': ['export'],
    },
    'performance': {
      'reviews': ['create', 'read', 'update', 'approve'],
      'goals': ['create', 'read', 'update', 'delete'],
      'feedback': ['create', 'read'],
      'ratings': ['create', 'read', 'update'],
      'reports': ['read', 'export'],
    },
    'documentation': {
      'articles': ['create', 'read', 'update', 'delete'],
      'categories': ['create', 'read', 'update', 'delete'],
      'search': ['read'],
      'feedback': ['create', 'read'],
      'export': ['export'],
    },
    'it-services': {
      'tickets': ['create', 'read', 'update'],
      'categories': ['read'],
      'reports': ['read'],
    },
    'training': {
      'sessions': ['create', 'read', 'update', 'delete'],
      'enrollments': ['create', 'read', 'update', 'delete'],
      'materials': ['create', 'read', 'update', 'delete'],
      'certificates': ['create', 'read', 'approve'],
      'reports': ['read', 'export'],
    },
    'master-data': {
      'clients': ['create', 'read', 'update', 'delete'],
      'employees': ['create', 'read', 'update', 'delete'],
      'departments': ['create', 'read', 'update', 'delete'],
      'locations': ['create', 'read', 'update', 'delete'],
      'export': ['export'],
    },
    'payroll': {
      'payroll': ['read'],
      'salaries': ['read'],
      'reports': ['read', 'export'],
    },
    'communications': {
      'announcements': ['create', 'read', 'update', 'delete'],
      'approve': ['approve'],
      'categories': ['create', 'read', 'update', 'delete'],
      'notifications': ['create'],
      'analytics': ['read'],
    },
    'directory': {
      'profiles': ['read'],
      'edit': ['update'],
      'search': ['read'],
      'org-chart': ['read'],
      'export': ['export'],
    },
    'knowledge': {
      'articles': ['create', 'read', 'update', 'delete'],
      'categories': ['create', 'read', 'update', 'delete'],
      'search': ['read'],
      'comments': ['create', 'read', 'update', 'delete'],
      'export': ['export'],
    },
  },
  'finance': {
    'dashboard': {
      'view': ['read'],
      'widgets': ['create', 'update', 'delete'],
      'tasks': ['create', 'read', 'update', 'delete'],
      'announcements': ['read'],
    },
    'invoices': {
      'invoices': ['create', 'read', 'update', 'delete'],
      'approve': ['approve'],
      'send': ['update'],
      'payments': ['create', 'read', 'update'],
      'reports': ['read', 'export'],
    },
    'payroll': {
      'payroll': ['create', 'read', 'update'],
      'approve': ['approve'],
      'salaries': ['read', 'update'],
      'deductions': ['create', 'read', 'update', 'delete'],
      'reports': ['read', 'export'],
    },
    'master-data': {
      'clients': ['create', 'read', 'update', 'delete'],
      'employees': ['read'],
      'export': ['export'],
    },
    'projects': {
      'projects': ['read', 'update'],
      'tasks': ['read'],
      'reports': ['read', 'export'],
    },
    'assets': {
      'assets': ['create', 'read', 'update', 'delete'],
      'assign': ['create', 'update'],
      'maintenance': ['create', 'read', 'update'],
      'depreciation': ['read', 'update'],
      'reports': ['read', 'export'],
    },
  },
  'manager': {
    'onboarding': {
      'tasks': ['read'],
      'documents': ['read'],
      'schedule': ['read'],
      'employees': ['read'],
    },
    'dashboard': {
      'view': ['read'],
      'widgets': ['create', 'update', 'delete'],
      'tasks': ['create', 'read', 'update', 'delete'],
      'announcements': ['read'],
    },
    'recruitment': {
      'candidates': ['read', 'update'],
      'interviews': ['create', 'read', 'update'],
      'jobs': ['read'],
      'pipeline': ['read'],
    },
    'performance': {
      'reviews': ['create', 'read', 'update', 'approve'],
      'goals': ['create', 'read', 'update', 'delete'],
      'feedback': ['create', 'read'],
      'ratings': ['create', 'read', 'update'],
      'reports': ['read', 'export'],
    },
    'documentation': {
      'articles': ['create', 'read', 'update'],
      'search': ['read'],
      'feedback': ['create', 'read'],
    },
    'it-services': {
      'tickets': ['create', 'read', 'update'],
      'reports': ['read'],
    },
    'training': {
      'sessions': ['read', 'update'],
      'enrollments': ['create', 'read', 'update'],
      'materials': ['read'],
      'reports': ['read'],
    },
    'linkedin': {
      'posts': ['read', 'update'],
      'approve': ['approve'],
      'analytics': ['read'],
    },
    'projects': {
      'projects': ['create', 'read', 'update', 'delete'],
      'tasks': ['create', 'read', 'update', 'delete'],
      'milestones': ['create', 'read', 'update', 'delete'],
      'team': ['create', 'update', 'delete'],
      'reports': ['read', 'export'],
    },
    'communications': {
      'announcements': ['create', 'read'],
      'categories': ['read'],
      'analytics': ['read'],
    },
    'okr': {
      'objectives': ['create', 'read', 'update', 'delete'],
      'key-results': ['create', 'read', 'update', 'delete'],
      'progress': ['update'],
      'align': ['read', 'update'],
      'reports': ['read', 'export'],
    },
    'directory': {
      'profiles': ['read'],
      'search': ['read'],
      'org-chart': ['read'],
    },
    'knowledge': {
      'articles': ['create', 'read', 'update'],
      'search': ['read'],
      'comments': ['create', 'read', 'update'],
    },
  },
  'employee': {
    'dashboard': {
      'view': ['read'],
      'widgets': ['create', 'update', 'delete'],
      'tasks': ['create', 'read', 'update', 'delete'],
      'announcements': ['read'],
    },
    'documentation': {
      'articles': ['read'],
      'search': ['read'],
      'feedback': ['create', 'read'],
    },
    'it-services': {
      'tickets': ['create', 'read', 'update'],
    },
    'training': {
      'sessions': ['read'],
      'enrollments': ['create', 'read'],
      'materials': ['read'],
    },
    'projects': {
      'projects': ['read'],
      'tasks': ['create', 'read', 'update'],
      'reports': ['read'],
    },
    'communications': {
      'announcements': ['read'],
      'analytics': ['read'],
    },
    'okr': {
      'objectives': ['read'],
      'key-results': ['read'],
      'progress': ['update'],
    },
    'directory': {
      'profiles': ['read'],
      'search': ['read'],
      'org-chart': ['read'],
    },
    'knowledge': {
      'articles': ['read'],
      'search': ['read'],
      'comments': ['create', 'read'],
    },
  },
  'it': {
    'dashboard': {
      'view': ['read'],
      'widgets': ['create', 'update', 'delete'],
      'tasks': ['create', 'read', 'update', 'delete'],
      'announcements': ['read'],
    },
    'documentation': {
      'articles': ['create', 'read', 'update', 'delete'],
      'categories': ['create', 'read', 'update', 'delete'],
      'search': ['read'],
      'export': ['export'],
    },
    'it-services': {
      'tickets': ['create', 'read', 'update', 'delete'],
      'assign': ['update'],
      'resolve': ['update', 'approve'],
      'categories': ['create', 'read', 'update', 'delete'],
      'reports': ['read', 'export'],
    },
    'assets': {
      'assets': ['create', 'read', 'update', 'delete'],
      'assign': ['create', 'update'],
      'maintenance': ['create', 'read', 'update'],
      'reports': ['read', 'export'],
    },
    'directory': {
      'profiles': ['read'],
      'edit': ['update'],
      'search': ['read'],
    },
    'knowledge': {
      'articles': ['create', 'read', 'update', 'delete'],
      'categories': ['create', 'read', 'update', 'delete'],
      'search': ['read'],
      'comments': ['create', 'read', 'update', 'delete'],
    },
  },
  'marketing': {
    'dashboard': {
      'view': ['read'],
      'widgets': ['create', 'update', 'delete'],
      'tasks': ['create', 'read', 'update', 'delete'],
      'announcements': ['read'],
    },
    'linkedin': {
      'posts': ['create', 'read', 'update', 'delete'],
      'schedule': ['create', 'update'],
      'analytics': ['read'],
      'templates': ['create', 'read', 'update', 'delete'],
    },
    'communications': {
      'announcements': ['create', 'read', 'update', 'delete'],
      'categories': ['create', 'read', 'update', 'delete'],
      'notifications': ['create'],
      'analytics': ['read'],
    },
    'knowledge': {
      'articles': ['create', 'read', 'update', 'delete'],
      'categories': ['create', 'read', 'update', 'delete'],
      'search': ['read'],
      'comments': ['create', 'read', 'update', 'delete'],
    },
  },
  'guest': {
    'documentation': {
      'articles': ['read'],
      'search': ['read'],
    },
    'training': {
      'sessions': ['read'],
      'materials': ['read'],
    },
    'communications': {
      'announcements': ['read'],
    },
    'directory': {
      'profiles': ['read'],
      'search': ['read'],
    },
    'knowledge': {
      'articles': ['read'],
      'search': ['read'],
    },
  },
};

// Helper function to check if user has permission for a specific feature action
export function hasFeaturePermission(
  userRoles: UserRole[],
  appId: ApplicationId,
  feature: string,
  action: PermissionAction,
  customMatrix?: RolePermissionMatrix
): boolean {
  const matrix = customMatrix || DEFAULT_PERMISSION_MATRIX;

  // Admin always has access
  if (userRoles.includes('admin')) {
    return true;
  }

  // Check each role
  for (const role of userRoles) {
    const rolePermissions = matrix[role];
    if (!rolePermissions) continue;

    const appPermissions = rolePermissions[appId];
    if (!appPermissions) continue;

    const featurePermissions = appPermissions[feature];
    if (!featurePermissions) continue;

    if (featurePermissions.includes(action)) {
      return true;
    }
  }

  return false;
}

// Helper to get all permissions for a user in an app
export function getUserAppPermissions(
  userRoles: UserRole[],
  appId: ApplicationId,
  customMatrix?: RolePermissionMatrix
): Record<string, PermissionAction[]> {
  const matrix = customMatrix || DEFAULT_PERMISSION_MATRIX;
  const allPermissions: Record<string, Set<PermissionAction>> = {};

  // Admin gets all permissions
  if (userRoles.includes('admin')) {
    const features = APP_FEATURES[appId] || [];
    return features.reduce((acc, feature) => ({
      ...acc,
      [feature.feature]: feature.actions,
    }), {});
  }

  // Aggregate permissions from all roles
  for (const role of userRoles) {
    const rolePermissions = matrix[role];
    if (!rolePermissions) continue;

    const appPermissions = rolePermissions[appId];
    if (!appPermissions) continue;

    for (const [feature, actions] of Object.entries(appPermissions)) {
      if (!allPermissions[feature]) {
        allPermissions[feature] = new Set();
      }
      actions.forEach(action => allPermissions[feature].add(action));
    }
  }

  // Convert sets to arrays
  return Object.entries(allPermissions).reduce((acc, [feature, actionsSet]) => ({
    ...acc,
    [feature]: Array.from(actionsSet),
  }), {});
}
