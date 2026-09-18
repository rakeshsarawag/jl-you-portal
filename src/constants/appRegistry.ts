/**
 * APP_REGISTRY — single source of truth for every application in the system.
 *
 * Each entry drives:
 *   • Route protection  (routes.tsx reads requiredRoles)
 *   • Launchpad tiles   (LaunchpadEnhanced reads icon, label, description)
 *   • Permission checks (permissionChecker reads appId against ROLE_DEFINITIONS)
 *
 * To add a new app: add one entry here. Nothing else needs changing.
 */

import { UserRole } from '../types/rbac';

export interface AppEntry {
  /** Matches the `app` key used in ROLE_DEFINITIONS permissions */
  appId: string;
  /** React Router path, used in routes.tsx */
  path: string;
  /** Display name shown on Launchpad */
  label: string;
  /** Short description shown on Launchpad tile */
  description: string;
  /** Lucide icon name */
  icon: string;
  /** Roles allowed to access this app — empty means all authenticated users */
  requiredRoles: UserRole[];
  /** Launchpad category for grouping */
  category: 'core' | 'hr' | 'finance' | 'analytics' | 'admin' | 'collaboration';
  /** Colour used for the tile accent */
  color: string;
}

export const APP_REGISTRY: AppEntry[] = [
  {
    appId: 'employee-dashboard',
    path: '/dashboard',
    label: 'Employee Dashboard',
    description: 'Attendance, leaves, tasks and personal overview',
    icon: 'LayoutDashboard',
    requiredRoles: ['employee', 'admin', 'hr', 'manager', 'finance', 'it', 'marketing'],
    category: 'core',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    appId: 'directory',
    path: '/directory',
    label: 'Employee Directory',
    description: 'Search and manage employee profiles',
    icon: 'Users',
    requiredRoles: ['employee', 'admin', 'hr', 'manager', 'finance', 'it', 'marketing'],
    category: 'hr',
    color: 'from-violet-500 to-purple-600',
  },
  {
    appId: 'onboarding',
    path: '/onboarding',
    label: 'Onboarding Portal',
    description: 'Manage new hire onboarding workflows',
    icon: 'UserPlus',
    requiredRoles: ['admin', 'hr'],
    category: 'hr',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    appId: 'recruitment',
    path: '/recruitment',
    label: 'Recruitment Tracker',
    description: 'Track job openings, candidates, and hiring pipeline',
    icon: 'ClipboardList',
    requiredRoles: ['admin', 'hr', 'manager'],
    category: 'hr',
    color: 'from-orange-500 to-red-500',
  },
  {
    appId: 'performance',
    path: '/performance',
    label: 'Performance Tracker',
    description: 'Goals, reviews, and team performance metrics',
    icon: 'TrendingUp',
    requiredRoles: ['admin', 'hr', 'manager', 'employee'],
    category: 'hr',
    color: 'from-yellow-500 to-orange-500',
  },
  {
    appId: 'training',
    path: '/training',
    label: 'Training & Learning',
    description: 'Courses, certifications, and learning paths',
    icon: 'BookOpen',
    requiredRoles: ['employee', 'admin', 'hr', 'manager', 'it', 'marketing', 'finance'],
    category: 'hr',
    color: 'from-blue-500 to-indigo-500',
  },
  {
    appId: 'payroll',
    path: '/payroll',
    label: 'Payroll Management',
    description: 'Salary structures, payslips, and payroll runs',
    icon: 'DollarSign',
    requiredRoles: ['admin', 'hr', 'finance'],
    category: 'finance',
    color: 'from-green-500 to-emerald-600',
  },
  {
    appId: 'invoices',
    path: '/invoices',
    label: 'Invoice Management',
    description: 'Create, track, and manage client invoices',
    icon: 'FileText',
    requiredRoles: ['admin', 'finance'],
    category: 'finance',
    color: 'from-lime-500 to-green-500',
  },
  {
    appId: 'master-data',
    path: '/master-data',
    label: 'Master Data',
    description: 'Departments, locations, designations, and lookup tables',
    icon: 'Database',
    requiredRoles: ['admin', 'hr', 'finance'],
    category: 'admin',
    color: 'from-slate-500 to-gray-600',
  },
  {
    appId: 'projects',
    path: '/projects',
    label: 'Project Management',
    description: 'Tasks, milestones, and project tracking',
    icon: 'Kanban',
    requiredRoles: ['admin', 'manager', 'employee', 'finance'],
    category: 'collaboration',
    color: 'from-blue-600 to-violet-600',
  },
  {
    appId: 'defect-tracker',
    path: '/defect-tracker',
    label: 'Defect Tracker',
    description: 'Track and resolve defects with SLA monitoring',
    icon: 'Bug',
    requiredRoles: ['employee', 'admin', 'hr', 'manager', 'finance', 'it', 'marketing'],
    category: 'core',
    color: 'from-red-500 to-rose-600',
  },
  {
    appId: 'okr',
    path: '/okr',
    label: 'OKR Management',
    description: 'Objectives, key results, and alignment tracking',
    icon: 'Target',
    requiredRoles: ['admin', 'manager', 'employee', 'hr'],
    category: 'analytics',
    color: 'from-fuchsia-500 to-pink-500',
  },
  {
    appId: 'assets',
    path: '/assets',
    label: 'Asset Management',
    description: 'Track company hardware, software, and equipment',
    icon: 'Monitor',
    requiredRoles: ['admin', 'it'],
    category: 'admin',
    color: 'from-indigo-500 to-blue-600',
  },
  {
    appId: 'it-services',
    path: '/it-services',
    label: 'IT Services',
    description: 'Submit and track IT support tickets',
    icon: 'Wrench',
    requiredRoles: ['employee', 'admin', 'hr', 'manager', 'it', 'finance', 'marketing'],
    category: 'collaboration',
    color: 'from-sky-500 to-cyan-500',
  },
  {
    appId: 'documentation',
    path: '/documentation',
    label: 'Documentation',
    description: 'Personal and team document management',
    icon: 'FolderOpen',
    requiredRoles: ['employee', 'admin', 'hr', 'manager', 'it', 'marketing', 'finance'],
    category: 'collaboration',
    color: 'from-teal-500 to-emerald-500',
  },
  {
    appId: 'communications',
    path: '/communications',
    label: 'Communications Hub',
    description: 'Announcements, messaging, and company updates',
    icon: 'MessageSquare',
    requiredRoles: ['employee', 'admin', 'hr', 'manager', 'it', 'marketing', 'finance'],
    category: 'collaboration',
    color: 'from-rose-500 to-pink-600',
  },
  {
    appId: 'linkedin',
    path: '/linkedin',
    label: 'LinkedIn Post Manager',
    description: 'Draft and schedule LinkedIn content',
    icon: 'Linkedin',
    requiredRoles: ['admin', 'marketing', 'hr'],
    category: 'collaboration',
    color: 'from-blue-700 to-blue-500',
  },
  {
    appId: 'executive-dashboard',
    path: '/executive-dashboard',
    label: 'Analytics Dashboard',
    description: 'Company-wide KPIs, deep-dive reports, predictive, cohort and funnel analytics',
    icon: 'BarChart3',
    requiredRoles: ['admin', 'manager', 'finance', 'hr'],
    category: 'analytics',
    color: 'from-violet-600 to-indigo-600',
  },
  {
    appId: 'workflow-dashboard',
    path: '/workflow-dashboard',
    label: 'Workflow Dashboard',
    description: 'Automated workflows and process management',
    icon: 'GitBranch',
    requiredRoles: ['admin', 'manager', 'hr', 'finance'],
    category: 'analytics',
    color: 'from-purple-500 to-violet-600',
  },
  {
    appId: 'security-compliance',
    path: '/security-compliance',
    label: 'Security & Compliance',
    description: 'Audit logs, policies, and compliance tracking',
    icon: 'ShieldCheck',
    requiredRoles: ['admin'],
    category: 'admin',
    color: 'from-red-600 to-rose-600',
  },
  {
    appId: 'advanced-features',
    path: '/advanced-features',
    label: 'Advanced Features',
    description: 'Power tools and experimental capabilities',
    icon: 'Zap',
    requiredRoles: ['admin', 'manager'],
    category: 'admin',
    color: 'from-yellow-600 to-orange-600',
  },
  {
    appId: 'user-management',
    path: '/user-management',
    label: 'User Management',
    description: 'Manage users, roles, and portal access',
    icon: 'UserCog',
    requiredRoles: ['admin'],
    category: 'admin',
    color: 'from-gray-600 to-slate-700',
  },
  {
    appId: 'permissions',
    path: '/permissions',
    label: 'Permission Manager',
    description: 'Configure role-based access control',
    icon: 'Lock',
    requiredRoles: ['admin'],
    category: 'admin',
    color: 'from-red-700 to-red-500',
  },
];

/** Quick lookup by path */
export const APP_BY_PATH: Record<string, AppEntry> = Object.fromEntries(
  APP_REGISTRY.map(a => [a.path, a])
);

/** Quick lookup by appId */
export const APP_BY_ID: Record<string, AppEntry> = Object.fromEntries(
  APP_REGISTRY.map(a => [a.appId, a])
);

/**
 * Returns true if the user has at least one of the app's required roles.
 * Empty requiredRoles = open to all authenticated users.
 */
export function userCanAccessApp(userRoles: UserRole[], app: AppEntry): boolean {
  if (userRoles.includes('admin')) return true;
  if (app.requiredRoles.length === 0) return true;
  return app.requiredRoles.some(r => userRoles.includes(r));
}
