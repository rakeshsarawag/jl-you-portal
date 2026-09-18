/**
 * Permission Sections — canonical definition of every section/feature
 * inside each app, and the strategic defaults per role.
 *
 * This file is the single source of truth consumed by:
 *  • PermissionManager UI  (to render the editor)
 *  • usePermissions hook   (fallback when DB has no entry)
 *  • SectionGuard component (to gate UI sections)
 */

export type UserRole = 'admin' | 'hr' | 'manager' | 'finance' | 'employee' | 'it' | 'marketing';
export const ALL_ROLES: UserRole[] = ['admin', 'hr', 'manager', 'finance', 'employee', 'it', 'marketing'];

// ── Section definition ─────────────────────────────────────────────────────

export interface SectionDef {
  id: string;
  label: string;
  description: string;
}

export interface AppSectionConfig {
  appId: string;
  label: string;
  sections: SectionDef[];
}

// ── Per-app section catalog ────────────────────────────────────────────────

export const APP_SECTION_CONFIG: AppSectionConfig[] = [
  {
    appId: 'employee-dashboard',
    label: 'Employee Dashboard',
    sections: [
      { id: 'attendance',       label: 'Attendance',          description: 'Clock in/out and attendance history' },
      { id: 'leave_management', label: 'Leave Management',    description: 'Apply for leaves and view balances' },
      { id: 'team_calendar',    label: 'Team Calendar',       description: 'Team attendance and leave overview' },
      { id: 'pending_approvals',label: 'Pending Approvals',   description: 'Leave/task approvals queue' },
      { id: 'tasks',            label: 'My Tasks',            description: 'Personal task list and reminders' },
      { id: 'announcements',    label: 'Announcements',       description: 'Company announcements widget' },
      { id: 'analytics',        label: 'Analytics Widgets',   description: 'Departmental KPI and trend widgets' },
    ],
  },
  {
    appId: 'directory',
    label: 'Employee Directory',
    sections: [
      { id: 'view_profiles',    label: 'View Profiles',       description: 'Browse employee cards and details' },
      { id: 'edit_profiles',    label: 'Edit Profiles',       description: 'Update employee information' },
      { id: 'create_employee',  label: 'Create Employee',     description: 'Add new employees to the directory' },
      { id: 'delete_employee',  label: 'Delete Employee',     description: 'Remove employees from the directory' },
      { id: 'emergency_contact',label: 'Emergency Contact',   description: 'View and edit emergency contact details' },
      { id: 'export',           label: 'Export Data',         description: 'Download employee data as CSV' },
      { id: 'bulk_upload',      label: 'Bulk Upload',         description: 'Import multiple employees from Excel/CSV' },
      { id: 'org_chart',        label: 'Org Chart',           description: 'View organisational hierarchy' },
      { id: 'salary_field',     label: 'Salary Info',         description: 'View salary and compensation fields' },
    ],
  },
  {
    appId: 'payroll',
    label: 'Payroll',
    sections: [
      { id: 'view_payslips',    label: 'My Payslips',         description: 'View own payslip history' },
      { id: 'process_payroll',  label: 'Process Payroll',     description: 'Run monthly payroll processing' },
      { id: 'approve_payroll',  label: 'Approve Payroll',     description: 'Approve payroll runs for release' },
      { id: 'salary_structure', label: 'Salary Structures',   description: 'Manage grade and pay structures' },
      { id: 'compliance',       label: 'Compliance',          description: 'Tax and statutory compliance reports' },
      { id: 'revision_history', label: 'Revision History',    description: 'Payroll change history and audit' },
    ],
  },
  {
    appId: 'it-services',
    label: 'IT Services',
    sections: [
      { id: 'create_ticket',    label: 'Submit Tickets',      description: 'Create new IT support tickets' },
      { id: 'view_own_tickets', label: 'My Tickets',          description: 'View own submitted tickets' },
      { id: 'view_all_tickets', label: 'All Tickets',         description: 'See all company tickets (IT/Admin)' },
      { id: 'assign_tickets',   label: 'Assign Tickets',      description: 'Assign tickets to technicians' },
      { id: 'resolve_tickets',  label: 'Resolve Tickets',     description: 'Mark tickets as resolved or closed' },
      { id: 'manage_categories',label: 'Manage Categories',   description: 'Add/edit ticket categories' },
      { id: 'analytics',        label: 'IT Analytics',        description: 'SLA and ticket volume dashboards' },
      { id: 'kb_view',          label: 'View Knowledge Base', description: 'Read KB articles and search' },
      { id: 'kb_manage',        label: 'Manage Knowledge Base', description: 'Create, edit, and publish KB articles' },
      { id: 'manage_sla',       label: 'Manage SLA Policies', description: 'Configure SLA tiers and thresholds' },
      { id: 'linked_items',     label: 'Linked Items',        description: 'Link tickets to backlog items and defects' },
    ],
  },
  {
    appId: 'recruitment',
    label: 'Recruitment',
    sections: [
      { id: 'view_candidates',  label: 'View Candidates',     description: 'Browse candidate database' },
      { id: 'create_candidate', label: 'Add Candidates',      description: 'Create new candidate records' },
      { id: 'schedule_interviews',label: 'Schedule Interviews',description: 'Book and manage interviews' },
      { id: 'make_offers',      label: 'Make Offers',         description: 'Send and negotiate job offers' },
      { id: 'view_salary',      label: 'View Offer Salary',   description: 'See compensation in offers' },
      { id: 'pipeline',         label: 'Manage Pipeline',     description: 'Update recruitment stages' },
      { id: 'export',           label: 'Export Reports',      description: 'Export recruitment data' },
    ],
  },
  {
    appId: 'onboarding',
    label: 'Onboarding',
    sections: [
      { id: 'manage_onboarding',label: 'Manage Onboarding',  description: 'Create and edit onboarding flows' },
      { id: 'view_onboarding',  label: 'View Onboarding',    description: 'Read-only access to onboarding status' },
      { id: 'portal_access',    label: 'Grant Portal Access',description: 'Enable portal logins for employees' },
      { id: 'documents',        label: 'Onboarding Docs',    description: 'Upload and manage welcome documents' },
      { id: 'export',           label: 'Export',             description: 'Export onboarding reports' },
    ],
  },
  {
    appId: 'performance',
    label: 'Performance',
    sections: [
      { id: 'own_review',       label: 'My Review',          description: 'View own performance review' },
      { id: 'conduct_reviews',  label: 'Conduct Reviews',    description: 'Start and submit reviews for reports' },
      { id: 'goals',            label: 'Goals',              description: 'Create and track goals' },
      { id: 'team_performance', label: 'Team Performance',   description: 'See team-level performance data' },
      { id: 'reports',          label: 'Reports',            description: 'Generate company performance reports' },
      { id: 'feedback',         label: 'Feedback',           description: 'Give and receive peer feedback' },
    ],
  },
  {
    appId: 'projects',
    label: 'Projects',
    sections: [
      { id: 'view_projects',     label: 'View Projects',       description: 'Browse all accessible projects' },
      { id: 'create_project',    label: 'Create Projects',     description: 'Start new projects' },
      { id: 'delete_project',    label: 'Delete Projects',     description: 'Remove projects and all associated data' },
      { id: 'manage_team',       label: 'Manage Team',         description: 'Add/remove project members and roles' },
      { id: 'create_tasks',      label: 'Create Tasks',        description: 'Add and assign tasks to sprints' },
      { id: 'delete_tasks',      label: 'Delete Tasks',        description: 'Remove tasks from projects' },
      { id: 'manage_backlog',    label: 'Manage Backlog',      description: 'Create and edit backlog items, user stories' },
      { id: 'manage_sprints',    label: 'Manage Sprints',      description: 'Create, start, and complete sprints' },
      { id: 'manage_defects',    label: 'Manage Defects',      description: 'Log, update, and track defects in Projects' },
      { id: 'time_logs',         label: 'Time Logging',        description: 'Log work hours against tasks' },
      { id: 'reports',           label: 'Project Reports',     description: 'Export and view project analytics and Gantt' },
      { id: 'manage_milestones', label: 'Manage Milestones',   description: 'Create and update project milestones' },
      { id: 'view_all_projects', label: 'View All Projects',   description: 'Access projects outside your direct membership' },
    ],
  },
  {
    appId: 'defect-tracker',
    label: 'Defect Tracker',
    sections: [
      { id: 'view_defects',     label: 'View Defects',       description: 'Browse defects across projects' },
      { id: 'log_defect',       label: 'Log Defects',        description: 'Create new defect reports' },
      { id: 'update_defects',   label: 'Update Defects',     description: 'Edit defect details and status' },
      { id: 'delete_defects',   label: 'Delete Defects',     description: 'Remove defect records' },
      { id: 'manage_sla',       label: 'Manage SLA',         description: 'Pause/resume SLA clocks and override policies' },
      { id: 'escalate',         label: 'Escalate',           description: 'Trigger escalation for breached SLAs' },
      { id: 'analytics',        label: 'Analytics',          description: 'View defect analytics and reports' },
      { id: 'export',           label: 'Export',             description: 'Export defect data to CSV/PDF' },
    ],
  },
  {
    appId: 'training',
    label: 'Training',
    sections: [
      { id: 'view_courses',     label: 'View Courses',       description: 'Browse available training' },
      { id: 'enroll',           label: 'Enroll',             description: 'Self-enroll in courses' },
      { id: 'manage_sessions',  label: 'Manage Sessions',    description: 'Create and schedule training sessions' },
      { id: 'issue_certificates',label: 'Issue Certificates',description: 'Award training certificates' },
      { id: 'reports',          label: 'Reports',            description: 'Training completion reports' },
    ],
  },
  {
    appId: 'payroll',
    label: 'Payroll',
    sections: [
      { id: 'view_payslips',    label: 'My Payslips',        description: 'View own payslip history' },
      { id: 'process_payroll',  label: 'Process Payroll',    description: 'Run monthly payroll' },
      { id: 'approve_payroll',  label: 'Approve Payroll',    description: 'Approve payroll runs' },
      { id: 'salary_structure', label: 'Salary Structures',  description: 'Manage pay grades' },
      { id: 'compliance',       label: 'Compliance',         description: 'Statutory compliance reports' },
    ],
  },
  {
    appId: 'communications',
    label: 'Communications',
    sections: [
      { id: 'view',             label: 'View Announcements', description: 'Read company announcements' },
      { id: 'create',           label: 'Post Announcements', description: 'Create and send announcements' },
      { id: 'manage_channels',  label: 'Manage Channels',   description: 'Create/edit announcement channels' },
      { id: 'send_push',        label: 'Push Notifications', description: 'Send push notifications to users' },
    ],
  },
  {
    appId: 'okr',
    label: 'OKR Management',
    sections: [
      { id: 'view',             label: 'View OKRs',          description: 'Browse objectives and key results' },
      { id: 'create',           label: 'Create OKRs',        description: 'Set new objectives' },
      { id: 'update_progress',  label: 'Update Progress',    description: 'Log key result progress' },
      { id: 'align',            label: 'Align OKRs',         description: 'Link team/company OKRs' },
      { id: 'reports',          label: 'Reports',            description: 'OKR analytics and export' },
    ],
  },
  {
    appId: 'assets',
    label: 'Asset Management',
    sections: [
      { id: 'view',             label: 'View Assets',        description: 'Browse asset inventory' },
      { id: 'create',           label: 'Add Assets',         description: 'Register new assets' },
      { id: 'assign',           label: 'Assign Assets',      description: 'Allocate assets to employees' },
      { id: 'maintenance',      label: 'Maintenance',        description: 'Log and schedule maintenance' },
      { id: 'dispose',          label: 'Dispose Assets',     description: 'Mark assets as disposed' },
      { id: 'documents',        label: 'Asset Documents',    description: 'Upload and download asset documents' },
      { id: 'reports',          label: 'Asset Reports',      description: 'View depreciation and warranty reports' },
    ],
  },
  {
    appId: 'invoices',
    label: 'Invoices',
    sections: [
      { id: 'view',             label: 'View Invoices',      description: 'Browse invoice list' },
      { id: 'create',           label: 'Create Invoices',    description: 'Generate new invoices' },
      { id: 'approve',          label: 'Approve Invoices',   description: 'Approve before sending' },
      { id: 'send',             label: 'Send Invoices',      description: 'Email invoices to clients' },
      { id: 'reports',          label: 'Financial Reports',  description: 'Revenue and payment reports' },
    ],
  },
  {
    appId: 'user-management',
    label: 'User Management',
    sections: [
      { id: 'view_users',       label: 'View Users',         description: 'Browse user list' },
      { id: 'create_user',      label: 'Create Users',       description: 'Add new portal users' },
      { id: 'grant_access',     label: 'Grant Portal Access',description: 'Provision employee logins' },
      { id: 'edit_roles',       label: 'Edit Roles',         description: 'Change user roles' },
      { id: 'suspend_user',     label: 'Suspend Users',      description: 'Disable user accounts' },
    ],
  },
  {
    appId: 'master-data',
    label: 'Master Data',
    sections: [
      { id: 'departments',      label: 'Departments',        description: 'Manage department list' },
      { id: 'locations',        label: 'Locations',          description: 'Manage office locations' },
      { id: 'clients',          label: 'Clients',            description: 'Manage client database' },
      { id: 'designations',     label: 'Designations',       description: 'Manage job titles/designations' },
      { id: 'export',           label: 'Export',             description: 'Export master data' },
    ],
  },
];

// Deduplicate (payroll appeared twice above)
const seen = new Set<string>();
export const SECTION_CONFIG: AppSectionConfig[] = APP_SECTION_CONFIG.filter(a => {
  if (seen.has(a.appId)) return false;
  seen.add(a.appId);
  return true;
});

/** App-level visibility defaults per role (which apps appear in launchpad) */
export const DEFAULT_APP_VISIBILITY: Record<UserRole, Record<string, boolean>> = {
  admin: {
    'employee-dashboard': true, 'directory': true, 'recruitment': true, 'onboarding': true,
    'performance': true, 'training': true, 'payroll': true, 'invoices': true,
    'master-data': true, 'projects': true, 'okr': true, 'assets': true,
    'it-services': true, 'documentation': true, 'communications': true,
    'linkedin': true, 'executive-dashboard': true, 'workflow-dashboard': true,
    'advanced-analytics': true, 'collaboration-hub': true,
    'security-compliance': true, 'advanced-features': true, 'user-management': true,
    'permissions': true, 'defect-tracker': true,
  },
  hr: {
    'employee-dashboard': true, 'directory': true, 'recruitment': true, 'onboarding': true,
    'performance': true, 'training': true, 'payroll': true,
    'master-data': true, 'projects': true, 'okr': true,
    'documentation': true, 'communications': true,
    'executive-dashboard': true, 'workflow-dashboard': true, 'advanced-analytics': true,
    'collaboration-hub': true, 'user-management': false, 'defect-tracker': false,
  },
  manager: {
    'employee-dashboard': true, 'directory': true, 'recruitment': true,
    'performance': true, 'training': true, 'projects': true, 'okr': true,
    'communications': true, 'it-services': true,
    'collaboration-hub': true, 'executive-dashboard': true, 'defect-tracker': true,
  },
  finance: {
    'employee-dashboard': true, 'directory': true, 'payroll': true, 'invoices': true,
    'master-data': true, 'projects': true, 'okr': true,
    'communications': true, 'advanced-analytics': true,
    'executive-dashboard': true, 'collaboration-hub': true, 'defect-tracker': false,
  },
  employee: {
    'employee-dashboard': true, 'directory': true, 'performance': true, 'training': true,
    'projects': true, 'okr': true, 'communications': true,
    'it-services': true, 'documentation': true, 'collaboration-hub': true, 'defect-tracker': false,
  },
  it: {
    'employee-dashboard': true, 'directory': true, 'it-services': true, 'assets': true,
    'documentation': true, 'training': true, 'communications': true,
    'collaboration-hub': true, 'defect-tracker': true,
  },
  marketing: {
    'employee-dashboard': true, 'directory': true, 'linkedin': true, 'communications': true,
    'training': true, 'documentation': true, 'collaboration-hub': true,
    'defect-tracker': false,
  },
};

/**
 * Section-level visibility defaults per role.
 * true = visible/accessible; false = hidden for this role.
 */
export const DEFAULT_SECTION_VISIBILITY: Record<UserRole, Record<string, Record<string, boolean>>> = {
  admin: {
    'employee-dashboard': { attendance: true, leave_management: true, team_calendar: true, pending_approvals: true, tasks: true, announcements: true, analytics: true },
    directory:      { view_profiles: true, edit_profiles: true, create_employee: true, delete_employee: true, emergency_contact: true, export: true, bulk_upload: true, org_chart: true, salary_field: true },
    payroll:        { view_payslips: true, process_payroll: true, approve_payroll: true, salary_structure: true, compliance: true, revision_history: true },
    'it-services':  { create_ticket: true, view_own_tickets: true, view_all_tickets: true, assign_tickets: true, resolve_tickets: true, manage_categories: true, analytics: true, kb_view: true, kb_manage: true, manage_sla: true, linked_items: true },
    recruitment:    { view_candidates: true, create_candidate: true, schedule_interviews: true, make_offers: true, view_salary: true, pipeline: true, export: true },
    onboarding:     { manage_onboarding: true, view_onboarding: true, portal_access: true, documents: true, export: true },
    performance:    { own_review: true, conduct_reviews: true, goals: true, team_performance: true, reports: true, feedback: true },
    projects:       { view_projects: true, create_project: true, delete_project: true, manage_team: true, create_tasks: true, delete_tasks: true, manage_backlog: true, manage_sprints: true, manage_defects: true, time_logs: true, reports: true, manage_milestones: true, view_all_projects: true },
    training:       { view_courses: true, enroll: true, manage_sessions: true, issue_certificates: true, reports: true },
    communications: { view: true, create: true, manage_channels: true, send_push: true },
    okr:            { view: true, create: true, update_progress: true, align: true, reports: true },
    assets:         { view: true, create: true, assign: true, maintenance: true, dispose: true, documents: true, reports: true },
    invoices:       { view: true, create: true, approve: true, send: true, reports: true },
    'user-management': { view_users: true, create_user: true, grant_access: true, edit_roles: true, suspend_user: true },
    'master-data':  { departments: true, locations: true, clients: true, designations: true, export: true },
    'defect-tracker': { view_defects: true, log_defect: true, update_defects: true, delete_defects: true, manage_sla: true, escalate: true, analytics: true, export: true },
  },
  hr: {
    'employee-dashboard': { attendance: true, leave_management: true, team_calendar: true, pending_approvals: true, tasks: true, announcements: true, analytics: true },
    directory:      { view_profiles: true, edit_profiles: true, create_employee: true, delete_employee: false, emergency_contact: true, export: true, bulk_upload: true, org_chart: true, salary_field: false },
    payroll:        { view_payslips: true, process_payroll: true, approve_payroll: false, salary_structure: true, compliance: true, revision_history: true },
    'it-services':  { create_ticket: true, view_own_tickets: true, view_all_tickets: false, assign_tickets: false, resolve_tickets: false, manage_categories: false, analytics: false, kb_view: true, kb_manage: false, manage_sla: false, linked_items: false },
    recruitment:    { view_candidates: true, create_candidate: true, schedule_interviews: true, make_offers: true, view_salary: false, pipeline: true, export: true },
    onboarding:     { manage_onboarding: true, view_onboarding: true, portal_access: true, documents: true, export: true },
    performance:    { own_review: true, conduct_reviews: true, goals: true, team_performance: true, reports: true, feedback: true },
    projects:       { view_projects: true, create_project: false, delete_project: false, manage_team: false, create_tasks: false, delete_tasks: false, manage_backlog: false, manage_sprints: false, manage_defects: false, time_logs: true, reports: true, manage_milestones: false, view_all_projects: false },
    training:       { view_courses: true, enroll: true, manage_sessions: true, issue_certificates: true, reports: true },
    communications: { view: true, create: true, manage_channels: true, send_push: false },
    okr:            { view: true, create: true, update_progress: true, align: true, reports: true },
    assets:         { view: true, create: false, assign: false, maintenance: false, dispose: false, documents: true, reports: true },
    invoices:       { view: true, create: false, approve: false, send: false, reports: true },
    'user-management': { view_users: true, create_user: false, grant_access: true, edit_roles: false, suspend_user: false },
    'master-data':  { departments: true, locations: true, clients: false, designations: true, export: true },
    'defect-tracker': { view_defects: false, log_defect: false, update_defects: false, delete_defects: false, manage_sla: false, escalate: false, analytics: false, export: false },
  },
  manager: {
    'employee-dashboard': { attendance: true, leave_management: true, team_calendar: true, pending_approvals: true, tasks: true, announcements: true, analytics: true },
    directory:      { view_profiles: true, edit_profiles: false, create_employee: false, delete_employee: false, emergency_contact: false, export: true, bulk_upload: false, org_chart: true, salary_field: false },
    payroll:        { view_payslips: false, process_payroll: false, approve_payroll: false, salary_structure: false, compliance: false, revision_history: false },
    'it-services':  { create_ticket: true, view_own_tickets: true, view_all_tickets: true, assign_tickets: true, resolve_tickets: false, manage_categories: false, analytics: true, kb_view: true, kb_manage: false, manage_sla: false, linked_items: false },
    recruitment:    { view_candidates: true, create_candidate: false, schedule_interviews: true, make_offers: false, view_salary: false, pipeline: true, export: false },
    onboarding:     { manage_onboarding: false, view_onboarding: true, portal_access: false, documents: false, export: false },
    performance:    { own_review: true, conduct_reviews: true, goals: true, team_performance: true, reports: true, feedback: true },
    projects:       { view_projects: true, create_project: true, delete_project: true, manage_team: true, create_tasks: true, delete_tasks: true, manage_backlog: true, manage_sprints: true, manage_defects: true, time_logs: true, reports: true, manage_milestones: true, view_all_projects: true },
    training:       { view_courses: true, enroll: true, manage_sessions: false, issue_certificates: false, reports: true },
    communications: { view: true, create: true, manage_channels: false, send_push: false },
    okr:            { view: true, create: true, update_progress: true, align: true, reports: true },
    assets:         { view: true, create: false, assign: false, maintenance: false, dispose: false, documents: true, reports: true },
    invoices:       { view: false, create: false, approve: false, send: false, reports: false },
    'user-management': { view_users: false, create_user: false, grant_access: false, edit_roles: false, suspend_user: false },
    'master-data':  { departments: false, locations: false, clients: false, designations: false, export: false },
    'defect-tracker': { view_defects: true, log_defect: true, update_defects: true, delete_defects: false, manage_sla: true, escalate: true, analytics: true, export: true },
  },
  finance: {
    'employee-dashboard': { attendance: true, leave_management: true, team_calendar: false, pending_approvals: false, tasks: true, announcements: true, analytics: true },
    directory:      { view_profiles: true, edit_profiles: false, create_employee: false, delete_employee: false, emergency_contact: false, export: true, bulk_upload: false, org_chart: true, salary_field: true },
    payroll:        { view_payslips: true, process_payroll: true, approve_payroll: true, salary_structure: true, compliance: true, revision_history: true },
    'it-services':  { create_ticket: true, view_own_tickets: true, view_all_tickets: false, assign_tickets: false, resolve_tickets: false, manage_categories: false, analytics: false, kb_view: true, kb_manage: false, manage_sla: false, linked_items: false },
    recruitment:    { view_candidates: false, create_candidate: false, schedule_interviews: false, make_offers: false, view_salary: true, pipeline: false, export: false },
    onboarding:     { manage_onboarding: false, view_onboarding: false, portal_access: false, documents: false, export: false },
    performance:    { own_review: true, conduct_reviews: false, goals: true, team_performance: false, reports: false, feedback: true },
    projects:       { view_projects: true, create_project: false, delete_project: false, manage_team: false, create_tasks: true, delete_tasks: false, manage_backlog: false, manage_sprints: false, manage_defects: true, time_logs: true, reports: true, manage_milestones: false, view_all_projects: false },
    training:       { view_courses: true, enroll: true, manage_sessions: false, issue_certificates: false, reports: false },
    communications: { view: true, create: false, manage_channels: false, send_push: false },
    okr:            { view: true, create: false, update_progress: true, align: false, reports: true },
    assets:         { view: true, create: false, assign: false, maintenance: false, dispose: false, documents: false, reports: false },
    invoices:       { view: true, create: true, approve: true, send: true, reports: true },
    'user-management': { view_users: false, create_user: false, grant_access: false, edit_roles: false, suspend_user: false },
    'master-data':  { departments: true, locations: true, clients: true, designations: false, export: true },
    'defect-tracker': { view_defects: false, log_defect: false, update_defects: false, delete_defects: false, manage_sla: false, escalate: false, analytics: false, export: false },
  },
  employee: {
    'employee-dashboard': { attendance: true, leave_management: true, team_calendar: false, pending_approvals: false, tasks: true, announcements: true, analytics: false },
    directory:      { view_profiles: true, edit_profiles: false, create_employee: false, delete_employee: false, emergency_contact: false, export: false, bulk_upload: false, org_chart: true, salary_field: false },
    payroll:        { view_payslips: true, process_payroll: false, approve_payroll: false, salary_structure: false, compliance: false, revision_history: false },
    'it-services':  { create_ticket: true, view_own_tickets: true, view_all_tickets: false, assign_tickets: false, resolve_tickets: false, manage_categories: false, analytics: false, kb_view: true, kb_manage: false, manage_sla: false, linked_items: false },
    recruitment:    { view_candidates: false, create_candidate: false, schedule_interviews: false, make_offers: false, view_salary: false, pipeline: false, export: false },
    onboarding:     { manage_onboarding: false, view_onboarding: false, portal_access: false, documents: false, export: false },
    performance:    { own_review: true, conduct_reviews: false, goals: true, team_performance: false, reports: false, feedback: true },
    projects:       { view_projects: true, create_project: false, delete_project: false, manage_team: false, create_tasks: true, delete_tasks: false, manage_backlog: false, manage_sprints: false, manage_defects: false, time_logs: true, reports: false, manage_milestones: false, view_all_projects: false },
    training:       { view_courses: true, enroll: true, manage_sessions: false, issue_certificates: false, reports: false },
    communications: { view: true, create: false, manage_channels: false, send_push: false },
    okr:            { view: true, create: false, update_progress: true, align: false, reports: false },
    assets:         { view: false, create: false, assign: false, maintenance: false, dispose: false, documents: false, reports: false },
    invoices:       { view: false, create: false, approve: false, send: false, reports: false },
    'user-management': { view_users: false, create_user: false, grant_access: false, edit_roles: false, suspend_user: false },
    'master-data':  { departments: false, locations: false, clients: false, designations: false, export: false },
    'defect-tracker': { view_defects: true, log_defect: true, update_defects: false, delete_defects: false, manage_sla: false, escalate: false, analytics: false, export: false },
  },
  it: {
    'employee-dashboard': { attendance: true, leave_management: true, team_calendar: false, pending_approvals: false, tasks: true, announcements: true, analytics: false },
    directory:      { view_profiles: true, edit_profiles: false, create_employee: false, delete_employee: false, emergency_contact: false, export: false, bulk_upload: false, org_chart: true, salary_field: false },
    payroll:        { view_payslips: true, process_payroll: false, approve_payroll: false, salary_structure: false, compliance: false, revision_history: false },
    'it-services':  { create_ticket: true, view_own_tickets: true, view_all_tickets: true, assign_tickets: true, resolve_tickets: true, manage_categories: true, analytics: true, kb_view: true, kb_manage: true, manage_sla: true, linked_items: true },
    recruitment:    { view_candidates: false, create_candidate: false, schedule_interviews: false, make_offers: false, view_salary: false, pipeline: false, export: false },
    onboarding:     { manage_onboarding: false, view_onboarding: false, portal_access: false, documents: false, export: false },
    performance:    { own_review: true, conduct_reviews: false, goals: true, team_performance: false, reports: false, feedback: true },
    projects:       { view_projects: false, create_project: false, delete_project: false, manage_team: false, create_tasks: false, delete_tasks: false, manage_backlog: false, manage_sprints: false, manage_defects: false, time_logs: false, reports: false, manage_milestones: false, view_all_projects: false },
    training:       { view_courses: true, enroll: true, manage_sessions: false, issue_certificates: false, reports: false },
    communications: { view: true, create: false, manage_channels: false, send_push: false },
    okr:            { view: false, create: false, update_progress: false, align: false, reports: false },
    assets:         { view: true, create: true, assign: true, maintenance: true, dispose: false, documents: true, reports: true },
    invoices:       { view: false, create: false, approve: false, send: false, reports: false },
    'user-management': { view_users: false, create_user: false, grant_access: false, edit_roles: false, suspend_user: false },
    'master-data':  { departments: false, locations: false, clients: false, designations: false, export: false },
    'defect-tracker': { view_defects: true, log_defect: true, update_defects: true, delete_defects: false, manage_sla: true, escalate: true, analytics: true, export: true },
  },
  marketing: {
    'employee-dashboard': { attendance: true, leave_management: true, team_calendar: false, pending_approvals: false, tasks: true, announcements: true, analytics: false },
    directory:      { view_profiles: true, edit_profiles: false, create_employee: false, delete_employee: false, emergency_contact: false, export: false, bulk_upload: false, org_chart: true, salary_field: false },
    payroll:        { view_payslips: true, process_payroll: false, approve_payroll: false, salary_structure: false, compliance: false, revision_history: false },
    'it-services':  { create_ticket: true, view_own_tickets: true, view_all_tickets: false, assign_tickets: false, resolve_tickets: false, manage_categories: false, analytics: false, kb_view: true, kb_manage: false, manage_sla: false, linked_items: false },
    recruitment:    { view_candidates: false, create_candidate: false, schedule_interviews: false, make_offers: false, view_salary: false, pipeline: false, export: false },
    onboarding:     { manage_onboarding: false, view_onboarding: false, portal_access: false, documents: false, export: false },
    performance:    { own_review: true, conduct_reviews: false, goals: true, team_performance: false, reports: false, feedback: true },
    projects:       { view_projects: true, create_project: false, delete_project: false, manage_team: false, create_tasks: true, delete_tasks: false, manage_backlog: false, manage_sprints: false, manage_defects: false, time_logs: true, reports: false, manage_milestones: false, view_all_projects: false },
    training:       { view_courses: true, enroll: true, manage_sessions: false, issue_certificates: false, reports: false },
    communications: { view: true, create: true, manage_channels: true, send_push: false },
    okr:            { view: true, create: false, update_progress: true, align: false, reports: false },
    assets:         { view: false, create: false, assign: false, maintenance: false, dispose: false, documents: false, reports: false },
    invoices:       { view: false, create: false, approve: false, send: false, reports: false },
    'user-management': { view_users: false, create_user: false, grant_access: false, edit_roles: false, suspend_user: false },
    'master-data':  { departments: false, locations: false, clients: false, designations: false, export: false },
    'defect-tracker': { view_defects: false, log_defect: false, update_defects: false, delete_defects: false, manage_sla: false, escalate: false, analytics: false, export: false },
  },
};

/** Build the full default permission blob for a given role */
export function buildDefaultPermissions(role: UserRole) {
  return {
    app_visibility: DEFAULT_APP_VISIBILITY[role] ?? {},
    sections: DEFAULT_SECTION_VISIBILITY[role] ?? {},
  };
}

