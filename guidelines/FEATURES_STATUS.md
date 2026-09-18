# Portal Jeshan Labs — Feature Implementation Status
Last updated: 2026-08-26 (Batch 2)

---

## ✅ Implemented Applications (26 total)

| App | Route | DB Persistence | RBAC | Design Tokens | Constants | Responsive |
|-----|-------|---------------|------|---------------|-----------|------------|
| Employee Dashboard | /dashboard | ✅ API | ✅ employee/admin/hr/manager | ✅ | ✅ | ✅ |
| Employee Directory | /directory | ✅ API | ✅ employee/admin/hr/manager | ✅ | ✅ | ✅ |
| Recruitment Tracker | /recruitment | ✅ API | ✅ admin/hr | ✅ | ✅ | ⚠️ Kanban no overflow-x |
| Onboarding Portal | /onboarding | ✅ API | ✅ admin/hr | ✅ | ✅ | ✅ |
| Performance Tracker | /performance | ✅ API | ✅ admin/manager/hr | ✅ | ✅ | ✅ |
| Training Tracker | /training | ✅ API | ✅ employee/admin/hr/manager | ✅ | ✅ | ✅ |
| IT Services | /it-services | ✅ API | ✅ employee/admin/hr/manager/it | ✅ | ✅ | ✅ |
| Payroll Management | /payroll | ✅ API | ✅ employee/admin/hr/finance/manager | ✅ | ✅ | ⚠️ Compliance tables no sm: |
| Invoice Generation | /invoices | ✅ API | ✅ admin/finance | ✅ | ✅ | ❌ No edit modal for draft invoices |
| Asset Management | /assets | ✅ API | ✅ admin/it | ✅ | ✅ | ✅ |
| OKR Management | /okr | ✅ API | ✅ admin/manager | ✅ | ✅ | ✅ |
| Project Management | /projects | ✅ API | ✅ admin/manager | ✅ | ✅ | ✅ |
| Communications Hub | /communications | ✅ API (reactions DB) | ✅ employee/admin/hr/manager | ✅ | ✅ | ✅ |
| Knowledge Base | /knowledge | ✅ API | ✅ employee/admin/hr/manager | ✅ | ⚠️ No constants file | ✅ |
| User Management | /user-management | ✅ API (reset-pw real) | ✅ admin only | ✅ | ✅ | ✅ |
| Permission Manager | /permissions | ✅ API | ✅ admin only | ✅ | ✅ | ✅ |
| Executive Dashboard | /executive-dashboard | ✅ API | ✅ admin/hr/manager/finance | ✅ | ✅ | ✅ |
| Master Data Mgmt | /master-data | ✅ API | ✅ admin/finance/hr | ✅ | ✅ | ✅ |
| Workflow Dashboard | /workflow-dashboard | ✅ API | ✅ admin/manager/hr/finance | ✅ | ✅ | ✅ |
| Collaboration Hub | /collaboration-hub | ✅ API | ✅ all roles | ✅ | ✅ | ✅ |
| Security & Compliance | /security-compliance | ✅ API | ✅ admin only | ✅ | ✅ | ✅ |
| AI Intelligence | /ai-intelligence-dashboard | ✅ API | ✅ admin/manager/hr/finance | ✅ | ✅ | ✅ |
| Advanced Analytics | /advanced-analytics | ✅ API | ✅ admin/manager/finance | ✅ | ✅ | ✅ |
| Advanced Features | /advanced-features | ✅ API | ✅ admin only | ✅ | ✅ | ✅ |
| LinkedIn Post Manager | /linkedin | ✅ API (linkedin-api.tsx) | ✅ admin/marketing | ✅ | ❌ No constants file | ✅ |
| Documentation | /documentation | ✅ API | ✅ all roles | ✅ | ✅ | ✅ |

---

## ✅ Global Shell / UX (Implemented 2026-08-26)

| Feature | Status | Notes |
|---------|--------|-------|
| Global fixed header (AppHeader) | ✅ | h-12, `max-w-7xl` aligned with content |
| Jeshan Labs logo + brand | ✅ | Matches login screen SVG, animated green dot |
| Logo click → home with unsaved guard | ✅ | All pages |
| Back button on inner pages | ✅ | Arrow + "Back" text, unsaved guard |
| Page breadcrumb | ✅ | All 26 routes mapped |
| Search apps field in header | ✅ | Home page only; syncs to Launchpad via CustomEvent |
| Notification bell in header | ✅ | Live unread count badge, dropdown panel |
| Notification dropdown | ✅ | Read/unread, mark-all-read, delete, navigate |
| User avatar initials + name | ✅ | Header button, shows first name |
| User settings dropdown | ✅ | Theme (Light/Dark/Auto), Language, Sign out |
| Theme switching | ✅ | Persists to localStorage, applies `.dark` class |
| Unsaved changes guard | ✅ | UnsavedChangesContext + UnsavedDialog modal |
| Per-page logout buttons removed | ✅ | 9 files cleaned; global sign-out in user menu |
| Server offline banner | ✅ | Amber strip when Edge Function unreachable |

---

## ✅ Backend API Coverage (27 endpoints)

- `asset-api.tsx` — full CRUD for assets
- `communications-api.tsx` — posts, announcements, polls, events, channels, comments, **reactions**
- `demo-data-api.tsx` — demo/seed data
- `directory-api.tsx` — employees, departments
- `employee-api.tsx` — employee records
- `employee-dashboard-api.tsx` — dashboard stats
- `invoice-api.tsx` — invoices, analytics
- `it-services-api.tsx` — tickets, assets, SLAs
- `knowledge-api.tsx` — articles, categories, versions
- `lifecycle-api.tsx` — employee lifecycle
- `linkedin-api.tsx` — LinkedIn post generation
- `master-data-api.tsx` — value helps, config
- `notifications-api.tsx` — push notifications
- `okr-api.tsx` — OKRs, key results, check-ins
- `onboarding-api.tsx` — onboarding records, tasks
- `payroll-api.tsx` — payroll runs, payslips, compliance
- `performance-api.tsx` — reviews, goals, PIPs, feedback
- `project-management-api.tsx` — projects, tasks, sprints
- `recruitment-api.tsx` — candidates, jobs, pipeline
- `training-api.tsx` — courses, enrollments, certificates
- `users.ts` — user management, RBAC, **reset-password**
- `workflow-api.tsx` — workflow templates, executions

---

## ✅ RBAC Implementation

All routes use `<ProtectedRoute requiredRoles={[...]}>` with lowercase role keys:
- `'admin'` — full access to all apps
- `'hr'` — onboarding, recruitment, performance, training, payroll, communications, directory
- `'manager'` — performance, training, payroll, OKR, projects, employee dashboard
- `'finance'` — invoices, payroll, executive dashboard, advanced analytics
- `'it'` — IT services, assets
- `'marketing'` — LinkedIn post manager
- `'employee'` — dashboard, directory, IT services, training, payroll (payslips), communications, knowledge

---

## ✅ Recently Completed (2026-08-26 Batch 2)

| # | Item | Status |
|---|------|--------|
| 1 | Invoice edit modal for draft invoices | ✅ EditInvoiceModal with line items, status promotion, updateInvoice wired |
| 2 | Recruitment Kanban `overflow-x-auto` | ✅ Already present; verified |
| 3 | Payroll compliance tables responsive | ✅ UAN/Insurance hidden at sm:, PF%/ESI% columns hidden at md: |
| 4 | `constants/apps/knowledge.ts` | ✅ ARTICLE_STATUSES, KNOWLEDGE_SORT_OPTIONS, KNOWLEDGE_CATEGORIES |
| 5 | `constants/apps/linkedin.ts` | ✅ LINKEDIN_POST_TYPES, LINKEDIN_TONES, MAX_POST_LENGTH |
| 6 | Training role strings → lowercase | ✅ Fixed in CreateLearningPathModal |
| 7 | Audit log viewer | ✅ Audit Log tab in User Management — search, filter by action, expandable rows |

## ❌ Pending Implementation

### P1 — Remaining

| # | Item | App | Effort |
|---|------|-----|--------|
| 1 | `useUnsavedChanges(isDirty)` wired in edit-heavy forms | All edit forms | M |
| 2 | Employee self-service profile edit | Directory / Dashboard | M |
| 3 | Config panels as admin-editable DB values | Master Data / Settings | L |

### P2 — New features

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 4 | Push notification delivery | Backend `push-api.tsx` exists; browser push not wired | L |
| 5 | Dark mode polish | Hard-coded colours in chart fills won't adapt | S |

---

## 🔍 Infrastructure Audit — 2026-08-26

### Edge Function Route Coverage

| Status | Count | Notes |
|--------|-------|-------|
| ✅ Routed APIs | 22 | All core APIs registered in index.ts |
| ✅ Fixed — added routes | 3 | `employee-api.tsx` → `/employees`, `lifecycle-api.tsx` → root, `demo-data-api.tsx` → `/demo` |
| ✅ Helper files (no route needed) | 3 | `audit-helpers.ts`, `kv_store.tsx`, `push-utils.tsx` |

### DB Table Coverage

| Status | Tables |
|--------|--------|
| ✅ In migration 001 (39 tables) | employees, app_users, audit_logs, recruitment_*, onboarding_*, attendance, leaves, leave_balances, employee_tasks, performance_*, training_*, it_tickets, it_ticket_comments, invoice_*, payroll_records, projects, project_members, project_tasks, assets, asset_*, okrs, okr_*, knowledge_articles |
| ✅ In migration 002 | Audit columns (`created_by`, `updated_by`) added to all 39 tables |
| ✅ In migration 003 (29 tables) | communications_*, announcement_*, notifications, push_subscriptions, workflow_*, linkedin_*, master_*, role_permissions, custom_roles, permission_audit_log, leave_policies, holidays, email_templates, learning_paths, path_enrollments |
| ✅ In migration 004 (9 tables) | knowledge_comments, knowledge_versions, salary_structures, leave_encashment_requests, onboarding_signature_requests, performance_cycles, project_milestones, project_sprints, employee_documents |
| ⚠️ KV-store only (no migration needed) | `kv_store_1fe2c468` — managed by Supabase KV, not SQL schema |

**Total tracked tables: 77**

---

## 📋 Fix History

### 2026-08-26 Batch 4 — Infrastructure audit & fixes
- ✅ Full edge function route audit — 22 routed + 3 newly wired (employee, lifecycle, demo)
- ✅ Full DB table audit — 77 tables across 4 migrations, 0 gaps remaining
- ✅ Migration `003_missing_tables.sql` — 29 tables: communications, notifications, workflow, linkedin, master data, permissions, HR config, learning paths
- ✅ Migration `004_remaining_tables.sql` — 9 tables: knowledge_comments/versions, salary_structures, leave_encashment_requests, onboarding_signature_requests, performance_cycles, project_milestones, project_sprints, employee_documents
- ✅ `isTableMissing()` — added `PGRST200` schema-cache error code; all APIs now return `[]` gracefully for missing tables instead of `[object Object]`
- ✅ `useWorkflow.ts` — fixed wrong BASE URL (was stripping function name via regex, calling `/functions/v1/workflow` instead of `/functions/v1/make-server-1fe2c468/workflow`)
- ✅ Employee Dashboard attendance — fixed check-in state not restoring on refresh (backend was returning raw record, hook expected `{ data: record }`)
- ✅ Service worker — localhost bypasses cache so dev server stop is immediately visible
- ✅ Supabase Edge Function routing — Hono receives full path including function name; routes now use `const base = "/make-server-1fe2c468"` prefix

### 2026-08-26 Batch 3 — Audit columns
- ✅ Migration `002_audit_columns.sql` — adds `created_by` + `updated_by` to all 38 tables; adds missing `updated_at` to 10 tables; adds indexes on `created_by` for audit queries
- ✅ Backend `audit-helpers.ts` — `getUserEmail(c)`, `auditCreate(c)`, `auditUpdate(c)` shared helpers
- ✅ All 16 backend API files — every INSERT spread `auditCreate(c)`, every UPDATE spread `auditUpdate(c)` (~90 call sites)
- ✅ Frontend `apiHeaders(userEmail?)` helper in `constants.ts` — sends `x-user-email` header
- ✅ All 20 frontend hooks — use `apiHeaders(userEmail)` on every fetch call; hooks with internal `useUser()` derive email automatically

### 2026-08-26 Batch 2
- ✅ Invoice edit modal — EditInvoiceModal with line-item editing, status promotion, updateInvoice wired
- ✅ Payroll compliance tables — UAN/Insurance col hidden at sm:, PF%/ESI% cols hidden at md:
- ✅ constants/apps/knowledge.ts — ARTICLE_STATUSES, KNOWLEDGE_SORT_OPTIONS, KNOWLEDGE_CATEGORIES
- ✅ constants/apps/linkedin.ts — LINKEDIN_POST_TYPES, LINKEDIN_TONES, MAX_POST_LENGTH
- ✅ Training CreateLearningPathModal role values → lowercase
- ✅ Audit Log viewer — tab in User Management with search, action filter, expandable detail rows

### 2026-08-26 Batch 1 (Session 3)
- ✅ Global AppHeader: Jeshan Labs logo, back button, breadcrumb, unsaved-changes guard
- ✅ Notification bell moved to shell header — full dropdown panel with read/delete
- ✅ User avatar initials + settings dropdown (theme, language, sign out)
- ✅ Theme switcher — Light / Dark / Auto with localStorage persistence
- ✅ Search apps field moved into header bar (CustomEvent bridge to Launchpad)
- ✅ Header content constrained to `max-w-7xl` to align with app content width
- ✅ Removed per-page logout buttons from 9 app components
- ✅ `safeJson()` utility — zero raw `.json()` calls across all hooks and components
- ✅ UnsavedChangesContext + useUnsavedChanges hook

### 2026-08-25 (Session 2)
- ✅ Communications emoji reactions now persist to Supabase DB (was localStorage)
- ✅ UserManagement reset-password now calls real `POST /users/:id/reset-password` API
- ✅ Backend: added reactions endpoints to `communications-api.tsx`
- ✅ Backend: added reset-password endpoint to `users.ts`

### 2026-08-24 (Session 1)
- ✅ Route RBAC: Performance +hr, Payroll +employee+manager, IT Services +it
- ✅ Employee Dashboard: 5 broken nav links fixed, manager/HR stat tiles now live data
- ✅ ESI employee rate fixed (0.75% not 3.25%)
- ✅ Training RBAC lowercase role keys
- ✅ Training cert validity uses CERTIFICATE_VALIDITY_YEARS constant
- ✅ OKR: window.confirm() replaced with ConfirmDialog + toast actions
- ✅ Launchpad: 5 missing app tiles added
- ✅ Executive Dashboard: dateRange now wired to hook
- ✅ Design tokens applied to all 22 apps
- ✅ Communications AUDIENCE_OPTIONS unified
- ✅ Invoice INVOICE_STATUSES from constants
- ✅ Payroll MONTHS from PAYROLL_MONTHS constant
- ✅ Performance COMPETENCIES from constants
