/**
 * seed-permissions.mjs
 *
 * One-time script to populate the role_permissions table with default
 * permissions for all roles. Safe to re-run: skips seeding if data already
 * exists (use --force to overwrite existing data).
 *
 * Usage:
 *   node scripts/seed-permissions.mjs
 *   node scripts/seed-permissions.mjs --force
 *   npm run seed:permissions
 *   npm run seed:permissions -- --force
 */

// ── Supabase config (matches utils/supabase/info.tsx) ──────────────────────
const PROJECT_ID  = 'icmexriwtsjwpswexyrb';
const ANON_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljbWV4cml3dHNqd3Bzd2V4eXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Nzg1NjQsImV4cCI6MjA4OTA1NDU2NH0.yP4FVH0bXXIvJxIXVxkhT-CM9NAw457eVxTK5Uny_c4';
const API_BASE    = `https://${PROJECT_ID}.supabase.co/functions/v1/make-server-1fe2c468`;
const PERM_URL    = `${API_BASE}/permissions`;

const FORCE = process.argv.includes('--force');

// ── Role list ───────────────────────────────────────────────────────────────
const ALL_ROLES = ['admin', 'hr', 'manager', 'finance', 'employee', 'it', 'marketing'];

// ── App-level visibility defaults per role ──────────────────────────────────
const DEFAULT_APP_VISIBILITY = {
  admin: {
    'employee-dashboard': true, directory: true, recruitment: true, onboarding: true,
    performance: true, training: true, payroll: true, invoices: true,
    'master-data': true, projects: true, okr: true, assets: true,
    'it-services': true, 'knowledge-base': true, documentation: true, communications: true,
    linkedin: true, 'executive-dashboard': true, 'workflow-dashboard': true,
    'ai-intelligence': true, 'advanced-analytics': true, 'collaboration-hub': true,
    'security-compliance': true, 'advanced-features': true, 'user-management': true,
    permissions: true,
  },
  hr: {
    'employee-dashboard': true, directory: true, recruitment: true, onboarding: true,
    performance: true, training: true, payroll: true,
    'master-data': true, projects: true, okr: true,
    'knowledge-base': true, documentation: true, communications: true,
    'executive-dashboard': true, 'workflow-dashboard': true, 'advanced-analytics': true,
    'collaboration-hub': true, 'user-management': false,
  },
  manager: {
    'employee-dashboard': true, directory: true, recruitment: true,
    performance: true, training: true, projects: true, okr: true,
    'knowledge-base': true, communications: true, 'it-services': true,
    'collaboration-hub': true, 'executive-dashboard': true,
  },
  finance: {
    'employee-dashboard': true, directory: true, payroll: true, invoices: true,
    'master-data': true, projects: true, okr: true,
    'knowledge-base': true, communications: true, 'advanced-analytics': true,
    'executive-dashboard': true, 'collaboration-hub': true,
  },
  employee: {
    'employee-dashboard': true, directory: true, performance: true, training: true,
    projects: true, okr: true, 'knowledge-base': true, communications: true,
    'it-services': true, documentation: true, 'collaboration-hub': true,
  },
  it: {
    'employee-dashboard': true, directory: true, 'it-services': true, assets: true,
    'knowledge-base': true, documentation: true, training: true, communications: true,
    'collaboration-hub': true,
  },
  marketing: {
    'employee-dashboard': true, directory: true, linkedin: true, communications: true,
    'knowledge-base': true, training: true, documentation: true, 'collaboration-hub': true,
  },
};

// ── Section-level visibility defaults per role ──────────────────────────────
const DEFAULT_SECTION_VISIBILITY = {
  admin: {
    'employee-dashboard':        { attendance: true, leave_management: true, team_calendar: true, pending_approvals: true, tasks: true, announcements: true, analytics: true },
    directory:        { view_profiles: true, edit_profiles: true, create_employee: true, delete_employee: true, emergency_contact: true, export: true, bulk_upload: true, org_chart: true, salary_field: true },
    payroll:          { view_payslips: true, process_payroll: true, approve_payroll: true, salary_structure: true, compliance: true, revision_history: true },
    'it-services':    { create_ticket: true, view_own_tickets: true, view_all_tickets: true, assign_tickets: true, resolve_tickets: true, manage_categories: true, analytics: true },
    recruitment:      { view_candidates: true, create_candidate: true, schedule_interviews: true, make_offers: true, view_salary: true, pipeline: true, export: true },
    onboarding:       { manage_onboarding: true, view_onboarding: true, portal_access: true, documents: true, export: true },
    performance:      { own_review: true, conduct_reviews: true, goals: true, team_performance: true, reports: true, feedback: true },
    projects:         { view_projects: true, create_project: true, manage_team: true, create_tasks: true, delete_tasks: true, reports: true },
    training:         { view_courses: true, enroll: true, manage_sessions: true, issue_certificates: true, reports: true },
    communications:   { view: true, create: true, manage_channels: true, send_push: true },
    'knowledge-base':        { view: true, create: true, edit: true, delete: true, manage_categories: true },
    okr:              { view: true, create: true, update_progress: true, align: true, reports: true },
    assets:           { view: true, create: true, assign: true, maintenance: true, dispose: true },
    invoices:         { view: true, create: true, approve: true, send: true, reports: true },
    'user-management':{ view_users: true, create_user: true, grant_access: true, edit_roles: true, suspend_user: true },
    'master-data':    { departments: true, locations: true, clients: true, designations: true, export: true },
  },
  hr: {
    'employee-dashboard':        { attendance: true, leave_management: true, team_calendar: true, pending_approvals: true, tasks: true, announcements: true, analytics: true },
    directory:        { view_profiles: true, edit_profiles: true, create_employee: true, delete_employee: false, emergency_contact: true, export: true, bulk_upload: true, org_chart: true, salary_field: false },
    payroll:          { view_payslips: true, process_payroll: true, approve_payroll: false, salary_structure: true, compliance: true, revision_history: true },
    'it-services':    { create_ticket: true, view_own_tickets: true, view_all_tickets: false, assign_tickets: false, resolve_tickets: false, manage_categories: false, analytics: false },
    recruitment:      { view_candidates: true, create_candidate: true, schedule_interviews: true, make_offers: true, view_salary: false, pipeline: true, export: true },
    onboarding:       { manage_onboarding: true, view_onboarding: true, portal_access: true, documents: true, export: true },
    performance:      { own_review: true, conduct_reviews: true, goals: true, team_performance: true, reports: true, feedback: true },
    projects:         { view_projects: true, create_project: false, manage_team: false, create_tasks: false, delete_tasks: false, reports: true },
    training:         { view_courses: true, enroll: true, manage_sessions: true, issue_certificates: true, reports: true },
    communications:   { view: true, create: true, manage_channels: true, send_push: false },
    'knowledge-base':        { view: true, create: true, edit: true, delete: false, manage_categories: true },
    okr:              { view: true, create: true, update_progress: true, align: true, reports: true },
    assets:           { view: true, create: false, assign: false, maintenance: false, dispose: false },
    invoices:         { view: true, create: false, approve: false, send: false, reports: true },
    'user-management':{ view_users: true, create_user: false, grant_access: true, edit_roles: false, suspend_user: false },
    'master-data':    { departments: true, locations: true, clients: false, designations: true, export: true },
  },
  manager: {
    'employee-dashboard':        { attendance: true, leave_management: true, team_calendar: true, pending_approvals: true, tasks: true, announcements: true, analytics: true },
    directory:        { view_profiles: true, edit_profiles: false, create_employee: false, delete_employee: false, emergency_contact: false, export: true, bulk_upload: false, org_chart: true, salary_field: false },
    payroll:          { view_payslips: false, process_payroll: false, approve_payroll: false, salary_structure: false, compliance: false, revision_history: false },
    'it-services':    { create_ticket: true, view_own_tickets: true, view_all_tickets: true, assign_tickets: true, resolve_tickets: false, manage_categories: false, analytics: true },
    recruitment:      { view_candidates: true, create_candidate: false, schedule_interviews: true, make_offers: false, view_salary: false, pipeline: true, export: false },
    onboarding:       { manage_onboarding: false, view_onboarding: true, portal_access: false, documents: false, export: false },
    performance:      { own_review: true, conduct_reviews: true, goals: true, team_performance: true, reports: true, feedback: true },
    projects:         { view_projects: true, create_project: true, manage_team: true, create_tasks: true, delete_tasks: true, reports: true },
    training:         { view_courses: true, enroll: true, manage_sessions: false, issue_certificates: false, reports: true },
    communications:   { view: true, create: true, manage_channels: false, send_push: false },
    'knowledge-base':        { view: true, create: true, edit: true, delete: false, manage_categories: false },
    okr:              { view: true, create: true, update_progress: true, align: true, reports: true },
    assets:           { view: true, create: false, assign: false, maintenance: false, dispose: false },
    invoices:         { view: false, create: false, approve: false, send: false, reports: false },
    'user-management':{ view_users: false, create_user: false, grant_access: false, edit_roles: false, suspend_user: false },
    'master-data':    { departments: false, locations: false, clients: false, designations: false, export: false },
  },
  finance: {
    'employee-dashboard':        { attendance: true, leave_management: true, team_calendar: false, pending_approvals: false, tasks: true, announcements: true, analytics: true },
    directory:        { view_profiles: true, edit_profiles: false, create_employee: false, delete_employee: false, emergency_contact: false, export: true, bulk_upload: false, org_chart: true, salary_field: true },
    payroll:          { view_payslips: true, process_payroll: true, approve_payroll: true, salary_structure: true, compliance: true, revision_history: true },
    'it-services':    { create_ticket: true, view_own_tickets: true, view_all_tickets: false, assign_tickets: false, resolve_tickets: false, manage_categories: false, analytics: false },
    recruitment:      { view_candidates: false, create_candidate: false, schedule_interviews: false, make_offers: false, view_salary: true, pipeline: false, export: false },
    onboarding:       { manage_onboarding: false, view_onboarding: false, portal_access: false, documents: false, export: false },
    performance:      { own_review: true, conduct_reviews: false, goals: true, team_performance: false, reports: false, feedback: true },
    projects:         { view_projects: true, create_project: false, manage_team: false, create_tasks: true, delete_tasks: false, reports: true },
    training:         { view_courses: true, enroll: true, manage_sessions: false, issue_certificates: false, reports: false },
    communications:   { view: true, create: false, manage_channels: false, send_push: false },
    'knowledge-base':        { view: true, create: false, edit: false, delete: false, manage_categories: false },
    okr:              { view: true, create: false, update_progress: true, align: false, reports: true },
    assets:           { view: true, create: false, assign: false, maintenance: false, dispose: false },
    invoices:         { view: true, create: true, approve: true, send: true, reports: true },
    'user-management':{ view_users: false, create_user: false, grant_access: false, edit_roles: false, suspend_user: false },
    'master-data':    { departments: true, locations: true, clients: true, designations: false, export: true },
  },
  employee: {
    'employee-dashboard':        { attendance: true, leave_management: true, team_calendar: false, pending_approvals: false, tasks: true, announcements: true, analytics: false },
    directory:        { view_profiles: true, edit_profiles: false, create_employee: false, delete_employee: false, emergency_contact: false, export: false, bulk_upload: false, org_chart: true, salary_field: false },
    payroll:          { view_payslips: true, process_payroll: false, approve_payroll: false, salary_structure: false, compliance: false, revision_history: false },
    'it-services':    { create_ticket: true, view_own_tickets: true, view_all_tickets: false, assign_tickets: false, resolve_tickets: false, manage_categories: false, analytics: false },
    recruitment:      { view_candidates: false, create_candidate: false, schedule_interviews: false, make_offers: false, view_salary: false, pipeline: false, export: false },
    onboarding:       { manage_onboarding: false, view_onboarding: false, portal_access: false, documents: false, export: false },
    performance:      { own_review: true, conduct_reviews: false, goals: true, team_performance: false, reports: false, feedback: true },
    projects:         { view_projects: true, create_project: false, manage_team: false, create_tasks: true, delete_tasks: false, reports: false },
    training:         { view_courses: true, enroll: true, manage_sessions: false, issue_certificates: false, reports: false },
    communications:   { view: true, create: false, manage_channels: false, send_push: false },
    'knowledge-base':        { view: true, create: false, edit: false, delete: false, manage_categories: false },
    okr:              { view: true, create: false, update_progress: true, align: false, reports: false },
    assets:           { view: false, create: false, assign: false, maintenance: false, dispose: false },
    invoices:         { view: false, create: false, approve: false, send: false, reports: false },
    'user-management':{ view_users: false, create_user: false, grant_access: false, edit_roles: false, suspend_user: false },
    'master-data':    { departments: false, locations: false, clients: false, designations: false, export: false },
  },
  it: {
    'employee-dashboard':        { attendance: true, leave_management: true, team_calendar: false, pending_approvals: false, tasks: true, announcements: true, analytics: false },
    directory:        { view_profiles: true, edit_profiles: false, create_employee: false, delete_employee: false, emergency_contact: false, export: false, bulk_upload: false, org_chart: true, salary_field: false },
    payroll:          { view_payslips: true, process_payroll: false, approve_payroll: false, salary_structure: false, compliance: false, revision_history: false },
    'it-services':    { create_ticket: true, view_own_tickets: true, view_all_tickets: true, assign_tickets: true, resolve_tickets: true, manage_categories: true, analytics: true },
    recruitment:      { view_candidates: false, create_candidate: false, schedule_interviews: false, make_offers: false, view_salary: false, pipeline: false, export: false },
    onboarding:       { manage_onboarding: false, view_onboarding: false, portal_access: false, documents: false, export: false },
    performance:      { own_review: true, conduct_reviews: false, goals: true, team_performance: false, reports: false, feedback: true },
    projects:         { view_projects: false, create_project: false, manage_team: false, create_tasks: false, delete_tasks: false, reports: false },
    training:         { view_courses: true, enroll: true, manage_sessions: false, issue_certificates: false, reports: false },
    communications:   { view: true, create: false, manage_channels: false, send_push: false },
    'knowledge-base':        { view: true, create: true, edit: true, delete: true, manage_categories: true },
    okr:              { view: false, create: false, update_progress: false, align: false, reports: false },
    assets:           { view: true, create: true, assign: true, maintenance: true, dispose: false },
    invoices:         { view: false, create: false, approve: false, send: false, reports: false },
    'user-management':{ view_users: false, create_user: false, grant_access: false, edit_roles: false, suspend_user: false },
    'master-data':    { departments: false, locations: false, clients: false, designations: false, export: false },
  },
  marketing: {
    'employee-dashboard':        { attendance: true, leave_management: true, team_calendar: false, pending_approvals: false, tasks: true, announcements: true, analytics: false },
    directory:        { view_profiles: true, edit_profiles: false, create_employee: false, delete_employee: false, emergency_contact: false, export: false, bulk_upload: false, org_chart: true, salary_field: false },
    payroll:          { view_payslips: true, process_payroll: false, approve_payroll: false, salary_structure: false, compliance: false, revision_history: false },
    'it-services':    { create_ticket: true, view_own_tickets: true, view_all_tickets: false, assign_tickets: false, resolve_tickets: false, manage_categories: false, analytics: false },
    recruitment:      { view_candidates: false, create_candidate: false, schedule_interviews: false, make_offers: false, view_salary: false, pipeline: false, export: false },
    onboarding:       { manage_onboarding: false, view_onboarding: false, portal_access: false, documents: false, export: false },
    performance:      { own_review: true, conduct_reviews: false, goals: true, team_performance: false, reports: false, feedback: true },
    projects:         { view_projects: true, create_project: false, manage_team: false, create_tasks: true, delete_tasks: false, reports: false },
    training:         { view_courses: true, enroll: true, manage_sessions: false, issue_certificates: false, reports: false },
    communications:   { view: true, create: true, manage_channels: true, send_push: false },
    'knowledge-base':        { view: true, create: true, edit: true, delete: false, manage_categories: false },
    okr:              { view: true, create: false, update_progress: true, align: false, reports: false },
    assets:           { view: false, create: false, assign: false, maintenance: false, dispose: false },
    invoices:         { view: false, create: false, approve: false, send: false, reports: false },
    'user-management':{ view_users: false, create_user: false, grant_access: false, edit_roles: false, suspend_user: false },
    'master-data':    { departments: false, locations: false, clients: false, designations: false, export: false },
  },
};

// ── Build full permission matrix ────────────────────────────────────────────
function buildMatrix() {
  const matrix = {};
  for (const role of ALL_ROLES) {
    matrix[role] = {
      app_visibility: DEFAULT_APP_VISIBILITY[role] ?? {},
      sections:       DEFAULT_SECTION_VISIBILITY[role] ?? {},
    };
  }
  return matrix;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ANON_KEY}`,
    apikey: ANON_KEY,
  };

  // 1. Check current state
  console.log('Checking current permissions in DB…');
  const getRes = await fetch(PERM_URL, { headers });

  if (getRes.status === 503) {
    const body = await getRes.json().catch(() => ({}));
    if (body?.table_missing) {
      console.error('✗ role_permissions table does not exist. Open the Permission Manager in the app and click "Create Table" first, then re-run this script.');
      process.exit(1);
    }
  }

  if (!getRes.ok) {
    console.error(`✗ Failed to reach permissions API: ${getRes.status} ${getRes.statusText}`);
    process.exit(1);
  }

  const existing = await getRes.json();
  const raw = existing?.permissionMatrix ?? {};
  const hasData = Object.keys(raw).length > 0;

  if (hasData && !FORCE) {
    console.log(`✓ DB already has permissions for roles: ${Object.keys(raw).join(', ')}`);
    console.log('  Nothing to do. Run with --force to overwrite existing data.');
    process.exit(0);
  }

  if (hasData && FORCE) {
    console.log('--force: overwriting existing permissions…');
  } else {
    console.log('DB is empty — seeding default permissions…');
  }

  // 2. Seed
  const matrix = buildMatrix();
  const postRes = await fetch(PERM_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ permissionMatrix: matrix, updatedBy: 'seed-script' }),
  });

  if (!postRes.ok) {
    const body = await postRes.text().catch(() => postRes.statusText);
    console.error(`✗ Seed failed: ${postRes.status} — ${body}`);
    process.exit(1);
  }

  console.log(`✓ Seeded permissions for ${ALL_ROLES.length} roles: ${ALL_ROLES.join(', ')}`);
  console.log('  All future changes should be made in the Permission Manager UI (permissions app).');
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
