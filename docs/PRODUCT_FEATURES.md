# JL You Portal — Product Feature Reference

> **Purpose:** Single source of truth for product scope, features, build status, validations, and implementation roadmap.
> **Last Updated:** 2026-09-04
> **Version:** 2.0 — merged from PROGRESS.md + progress.md + PRODUCT_FEATURES.md

## Implementation Summary (as of 2026-09-04)

| Status | Count |
|--------|-------|
| ✅ Complete | 200+ features across 22 apps |
| 🔄 In Progress | 0 |
| 🔲 External dependency / Future | 6 features |

**Total apps:** 22 live + 5 placeholder shells  
**DB migrations:** 4 files (01_schema + 02_seed + 03_defect_tracker + 04_pm_master)

---

## 0. Non-Negotiable Engineering Standards

These rules apply to **every feature, every app, every change**. No exceptions.

### 0.1 Configurable Settings
- All dropdown values, status lists, categories, and fixed values come from **constants files** — never hardcoded in components.
- Admin-configurable runtime settings are stored in DB and editable via Master Data app.
- Only `admin` role can modify configuration. Configuration UI is RBAC-gated.
- **Files:** `src/constants/global.ts`, `src/constants/roles.ts`, `src/constants/apps/<app>.ts`

### 0.2 App-wise Constants
- Every app has `src/constants/apps/<app>.ts` — statuses, types, categories, prefixes, rates.
- Never define magic strings in component files. Always import from `src/constants/`.

### 0.3 Internationalisation (i18n)
- Every user-visible string defined in `src/i18n/locales/en.ts`. Use `t("key")` helper in components.
- Never hardcode display text in JSX. New language = add `src/i18n/locales/<lang>.ts`.
- Keys follow namespace pattern: `"appName.featureArea.label"` e.g. `"pm.risks.title"`.
- **Current coverage:** 700+ keys in en.ts; stubs in es/de/hi.

### 0.4 Role-Based Access Control (RBAC)
- Every route protected by roles in `src/constants/roles.ts → ROUTE_ROLES`.
- No route accessible without authentication. Unauthenticated → redirect to login.
- Unauthorised role → "Access Denied" page (never blank screen or 404).
- Action-level RBAC: Add/Delete/Approve buttons hidden/disabled for unauthorised roles.
- App documentation only accessible if user has app access.

### 0.5 Data Isolation (User Privacy)
- Employees see only their own data (attendance, leaves, tickets, tasks, payslips).
- Managers see direct reports' data. HR/Admin see all.
- API-level enforcement: queries filter by `user_id` or `employee_id` for scoped data.
- No employee can access another's personal records without explicit RBAC grant.
- **Project Management:** Employees see only projects they are a member of.

### 0.6 Automation Testing
- Every feature in this document has a test in `tests/`.
- E2E: `tests/e2e/<app>/<feature>.spec.ts` (Playwright). Unit: `tests/unit/` (Vitest).
- Run tests after every significant change before deploying.
- Test both positive (allowed) and negative (blocked) paths for every RBAC rule.
- Test fixtures/personas: `tests/e2e/shared/fixtures.ts`

### 0.7 In-App Documentation
- Each app has a help section accessible from within it, served from the Knowledge Base.
- Documentation is role-gated — user sees docs only for apps they can access.

### 0.8 Error Handling & User Feedback
- Every API call handles: **loading** (skeleton/spinner) + **success** (toast) + **error** (human message).
- Destructive actions (delete, deactivate, reject) require a confirmation dialog.
- Network failures offer a **Retry** option. Form errors appear inline next to the field.
- All messages defined in `src/i18n/locales/en.ts` — never hardcoded.

### 0.9 Form Validation
- Required fields validated client-side on submit and server-side on API.
- Email format, date ranges (end ≥ start), numeric min/max, file type/size all validated.
- Server-side validation errors surface back to the specific form field.

### 0.10 Security
- No secrets in frontend. API/service-role keys live only in edge function env vars.
- All user input sanitised before rendering. No `dangerouslySetInnerHTML` with unsanitised data.
- API endpoints verify caller identity via Supabase auth token.
- Sensitive fields (salary, PAN, Aadhaar, bank details) never appear in logs or error messages.
- Bulk operations logged to `audit_logs`. CSP and X-Frame-Options set at edge function level.

### 0.11 Performance
- Lists > 20 rows use **pagination** (default in `src/constants/global.ts`).
- Heavy components (charts, PDFs) lazy-loaded with `React.lazy()` + `Suspense`.
- Search inputs debounced 300ms. Large datasets use server-side pagination.
- Repeated identical API calls cached in component state/context.

### 0.12 Accessibility (a11y)
- Every interactive element has `aria-label` or visible text. Colour never the sole status indicator.
- Keyboard navigable forms and modals. Focus trapped inside open modals.
- WCAG AA contrast (4.5:1 normal, 3:1 large text). Toasts/alerts use `role="alert"`.

### 0.13 Responsive Design
- All pages usable from 375px (mobile) through desktop 1440px+.
- Tailwind responsive prefixes only — no fixed pixel widths.
- Wide tables scroll horizontally (`overflow-x-auto`). Modals scrollable. Touch targets ≥ 44×44px.
- Mobile nav: hamburger overlay pattern. SideNavs collapse on small screens.

### 0.14 Audit Trail
- Create/update/delete/status-change on critical records logged to `audit_logs` with: who, what, which record, when, before, after.
- Audit logs are append-only. HR/Admin can view from User Management.
- **Project Management:** Uses `project_activity_log` and `project_rag_log` for project-scoped audit.
- **Defect Tracker:** Uses `defect_activity_log` for defect-scoped audit.

### 0.15 Data Integrity
- **Soft delete** for business records — `deleted_at` timestamp, never hard delete.
- Tasks with logged hours: archive flag (`archived = true`), not physical delete.
- Multi-table writes in DB transactions. Unique constraints at DB level. FK constraints in schema.

### 0.16 API Design Consistency
- All responses: `{ success: true, data: ... }` or `{ success: false, error: "..." }`.
- Correct HTTP codes (200, 201, 400, 401, 403, 404, 500). ISO 8601 dates. UUID IDs. kebab-case paths.
- List endpoints support `?page=`, `?limit=`, `?search=`, `?status=` consistently.
- **Note:** Supabase Edge Function `make-server-1fe2c468` is NOT deployed. All apps use Supabase JS client direct queries (PostgREST).

### 0.17 Code Quality
- Component files ≤ 300 lines. Single responsibility per component and hook.
- No magic numbers — name every constant. No dead code.
- Naming: PascalCase components, camelCase hooks, UPPER_SNAKE_CASE constants.
- No inline `style={{}}` except computed runtime values (e.g. dynamic colors). Tailwind classes everywhere else.

### 0.18 Session & Authentication
- Sessions expire after configurable idle timeout (default 8h in `src/constants/global.ts`).
- Session expiry → redirect to login with "session expired" message.
- Auth tokens never in `localStorage`. After login, redirect to last visited page.

### 0.19 Notifications
- Key system events trigger in-app notifications persisted to `project_notifications` / `notifications` tables.
- Notification preferences configurable per user. Critical events also send push (Web Push API + VAPID).
- Notifications viewable in a notification panel — not just ephemeral toasts.
- PM-specific events: task assigned, Red RAG, Risk Triggered, Milestone Missed, Budget threshold.

### 0.20 Versioning & Deployment
- Every deployment increments `APP_VERSION` in `src/constants/global.ts`.
- DB changes = new migration files (format `NN_description.sql`). Never edit existing migrations.
- `run-all.sql` concatenates all migrations in order for full-schema re-runs.

### 0.21 Environment Management
- Three environments: dev (local), staging (QA), production.
- Config in `.env.development`, `.env.staging`, `.env.production`. Never commit `.env` files.
- Feature flags in `src/constants/global.ts → FEATURES` object.

### 0.22 File Structure Reference

| Concern | Location |
|---------|----------|
| Global constants | `src/constants/global.ts` |
| Role & route definitions | `src/constants/roles.ts` |
| App-wise constants | `src/constants/apps/<app>.ts` |
| All display strings | `src/i18n/locales/en.ts` |
| i18n loader & `t()` | `src/i18n/index.ts` |
| Shared UI components | `src/app/components/ui/` |
| E2E tests | `tests/e2e/<app>/` |
| Unit tests | `tests/unit/` |
| Test fixtures/personas | `tests/e2e/shared/fixtures.ts` |
| DB schema (core) | `supabase/migrations/01_schema.sql` |
| DB seed data | `supabase/migrations/02_seed.sql` |
| DB defect tracker | `supabase/migrations/03_defect_tracker.sql` |
| DB PM master data | `supabase/migrations/04_pm_master.sql` |
| Full migration suite | `supabase/migrations/run-all.sql` |

---

## 1. Product Overview

**JL You Portal** is a unified HR & Enterprise SaaS platform for mid-to-large organisations. It covers the complete employee lifecycle — recruit → onboard → perform → develop → support → pay — plus operational tools for finance, IT, assets, projects, defect tracking, and knowledge management, all under one authenticated portal with RBAC, a shared employee identity layer, and a relational PostgreSQL database (Supabase).

---

## 2. Personas & Their Needs

| Persona | Role Key | Core Needs |
|---------|----------|-----------|
| **Employee** | `employee` | Dashboard, attendance, leaves, payslips, training, IT tickets, knowledge base, org announcements, assigned project tasks |
| **HR Manager** | `hr` | End-to-end hiring, onboarding, directory management, leave approvals, payroll processing, compliance reports |
| **Line Manager** | `manager` | Team performance, OKR tracking, project oversight, leave/WFH approvals, training assignment, team analytics, sprint management |
| **IT Admin** | `it` | Ticket queue management, SLA monitoring, asset inventory, hardware assignments |
| **Finance** | `finance` | Invoice creation/tracking, payroll reports, expense approvals, executive financial dashboard |
| **Marketing** | `marketing` | LinkedIn content calendar, AI post generation, social analytics |
| **Super Admin** | `admin` | All of the above + user management, RBAC configuration, master data, audit logs, system settings, delete projects, override budget alerts |

---

## 3. Implementation Status Summary

> **Last build pass:** 2026-09-04 — 0 TypeScript errors, Vite builds clean (2871 modules)

| Category | Status |
|----------|--------|
| Relational DB schema (50+ tables, 4 migration files) | ✅ Done |
| App-wise constants files | ✅ Done (all 22+ apps) |
| i18n text file (English, 700+ keys) | ✅ Done |
| Shared UI components | ✅ Done |
| Frontend components (all 22+ apps) | ✅ Full UI with live Supabase data |
| RBAC enforcement (route + action level) | ✅ Done |
| Notifications system (in-app + push + project-specific) | ✅ Done |
| Defect Tracker (full spec, 6 screens) | ✅ Done |
| Project Management (full spec, 9 tabs + dashboard) | ✅ Done |
| IT Services (tickets, SLA, KB, analytics) | ✅ Done |
| Asset Management (CRUD, maintenance, depreciation, reports) | ✅ Done |
| Payroll (salary structure, PF/ESI/TDS, approval, NEFT) | ✅ Done |
| Invoice (GST, revenue analytics, overdue alerts) | ✅ Done |

---

## 4. Implementation Order

```
Phase 1 — Foundation ✅ COMPLETE
  1. Launchpad / Home          ✅ Persona-specific, live stats, WFH toggle, announcements feed
  2. Employee Dashboard        ✅ Attendance, leaves, tasks, holiday list

Phase 2 — People Core ✅ COMPLETE
  3. Employee Directory        ✅ Full CRUD, org chart, CSV export, emergency contacts
  4. User Management           ✅ CRUD, role picker, password reset, audit log, bulk role assignment
  5. Permission Manager        ✅ Permission matrix UI, DB-persisted, custom roles

Phase 3 — Talent Lifecycle ✅ COMPLETE
  6. Recruitment Tracker       ✅ Pipeline, interviews, analytics, duplicate detection
  7. Onboarding Portal         ✅ Checklists, buddy assignment, digital signature, probation tracking
  8. Performance Tracker       ✅ Reviews, goals, 360°, PIPs, calibration, bell curve analytics
  9. Training Tracker          ✅ Courses, enrollments, certificates, compliance report, learning paths

Phase 4 — Operations ✅ COMPLETE
  10. IT Services              ✅ Tickets, SLA tracking, KB prompt, escalation, analytics, CSAT
  11. Asset Management         ✅ CRUD, assign/return, maintenance, depreciation, QR, reports
  12. Project Management       ✅ Full spec — 9 tabs, sprint planning, risks, epics, reports (see Section 5.11)
  13. OKR Management           ✅ OKRs, KRs, check-ins, history, grading, CSV export
  14. Defect Tracker           ✅ Full spec — 6 screens, SLA, analytics, notifications (see Section 5.12)

Phase 5 — Finance & Comms ✅ COMPLETE
  15. Payroll Management       ✅ Salary, PF/ESI/TDS, payslip PDF, approval, NEFT export
  16. Invoice Generation       ✅ GST, revenue analytics, overdue alerts, approval workflow
  17. Communications Hub       ✅ Pinned posts, audience targeting, emoji reactions, comment threads
  18. LinkedIn Post Manager    ✅ AI generator, calendar, analytics, relational DB

Phase 6 — Intelligence & Admin ✅ COMPLETE
  19. Knowledge Base           ✅ Search, trending, feedback rating, article comments, version history
  20. Master Data Management   ✅ 25+ entities, 6 categories, Value Helps, PM master data
  21. Executive Dashboard      ✅ Live DB aggregations, date/dept filters, PDF/Excel export
  22. Advanced Analytics       ✅ Custom reports, 5 templates, CSV export, chart types
  23. Notifications System     ✅ In-app bell, DB-backed, Web Push API + VAPID

Phase 7–10 — Robustness, Cross-App, Standards ✅ COMPLETE
  - Shared ConfirmDialog, constants completeness, cross-app triggers, pagination,
    session timeout, leave encashment, emergency contacts, birthday/anniversary,
    document store, buddy assignment, digital signature, learning paths, CSAT,
    file attachments, system health panel, E2E test scaffold
```

---

## 5. App-by-App Feature Specification

---

### APP 1 — Launchpad / Home (`/`)
**Roles:** All | **Status:** ✅ Complete

| Feature | Priority | Status |
|---------|----------|--------|
| Persona-specific dashboard layout | P0 | ✅ |
| Live stats per persona (real Supabase data) | P0 | ✅ |
| Quick action shortcuts | P0 | ✅ |
| Org announcements feed | P1 | ✅ |
| Notification bell with unread count | P0 | ✅ |
| Upcoming holidays calendar | P1 | ✅ |
| System health panel (Admin) | P2 | ✅ |
| Birthday / work anniversary alerts | P2 | ✅ |

---

### APP 2 — Employee Dashboard (`/dashboard`)
**Roles:** Employee, Manager, HR, Admin | **DB:** `attendance`, `leaves`, `leave_balances`, `employee_tasks`

| Feature | Priority | Status |
|---------|----------|--------|
| Clock in / Clock out with timestamp | P0 | ✅ |
| Prevent double check-in (DB unique constraint) | P0 | ✅ |
| Work from home / on-site toggle | P1 | ✅ |
| Attendance history calendar view | P0 | ✅ |
| Monthly attendance summary | P0 | ✅ |
| Late arrival / early exit flag (amber/badge) | P1 | ✅ |
| Apply for leave (type, date range, reason) | P0 | ✅ |
| Leave balance display per type | P0 | ✅ |
| Leave status tracking | P0 | ✅ |
| Manager approval workflow with comments | P0 | ✅ |
| Holiday list for the year | P1 | ✅ |
| Leave encashment request + HR approval | P2 | ✅ |
| Team leave calendar (Manager view) | P1 | ✅ |

**Validation Rules:**
- Check-in: once per day per employee (DB unique constraint)
- Leave: end date ≥ start date; cannot apply for past dates without manager override
- Leave balance: system warns if insufficient balance (does not hard-block)

---

### APP 3 — Employee Directory (`/directory`)
**Roles:** All | **DB:** `employees`

| Feature | Priority | Status |
|---------|----------|--------|
| Employee list with search and filters | P0 | ✅ |
| Add / Edit / Delete employee | P0 | ✅ |
| Employee profile card | P0 | ✅ |
| Org chart (reporting structure) | P1 | ✅ |
| Export to CSV | P1 | ✅ |
| Bulk import employees from CSV | P1 | ✅ |
| Emergency contact management (RBAC display) | P1 | ✅ |
| Birthday / work anniversary reminders | P2 | ✅ |
| Employee document store (per employee) | P2 | ✅ |

---

### APP 4 — Recruitment Tracker (`/recruitment`)
**Roles:** HR, Admin | **DB:** `recruitment_candidates`, `recruitment_jobs`, `recruitment_interviews`, `recruitment_feedback`

| Feature | Priority | Status |
|---------|----------|--------|
| Candidate list + pipeline stage view | P0 | ✅ |
| Add / Edit / Delete candidate | P0 | ✅ |
| Job postings management | P0 | ✅ |
| Stage pipeline (Applied → Hired/Rejected) | P0 | ✅ |
| Schedule interviews (relational rows) | P0 | ✅ |
| Interview feedback / rating | P0 | ✅ |
| Bulk upload candidates via CSV | P0 | ✅ |
| Offer letter generation | P1 | ✅ |
| Auto-create Onboarding record on "Hired" | P0 | ✅ |
| Recruitment analytics tab | P1 | ✅ |
| Duplicate detection (email/phone/name similarity) | P2 | ✅ |
| Email candidate from portal | P2 | 🔲 Requires email provider |

---

### APP 5 — Onboarding Portal (`/onboarding`)
**Roles:** HR, Admin | **DB:** `onboarding_records`, `onboarding_tasks`, `onboarding_documents`, `onboarding_welcome_kits`

| Feature | Priority | Status |
|---------|----------|--------|
| New joiner record creation | P0 | ✅ |
| Checklist / task management | P0 | ✅ |
| Document upload / verification tracking | P0 | ✅ |
| Welcome kit assignment | P0 | ✅ |
| Progress calculation (auto from tasks) | P0 | ✅ |
| Enable portal access | P0 | ✅ |
| Sync to Employee Directory | P0 | ✅ |
| Bulk upload joiners via CSV | P0 | ✅ |
| Auto-enrol in mandatory training on completion | P1 | ✅ |
| Manager notification when joiner completes | P1 | ✅ |
| Probation period tracking (90-day, confirm, banner) | P1 | ✅ |
| Buddy assignment | P2 | ✅ |
| Digital signature for documents | P2 | ✅ |

---

### APP 6 — Performance Tracker (`/performance`)
**Roles:** Manager, Admin; Employee views own | **DB:** `performance_reviews`, `performance_goals`, `performance_feedback`, `performance_pips`

| Feature | Priority | Status |
|---------|----------|--------|
| Performance reviews (CRUD) | P0 | ✅ |
| Goals management | P0 | ✅ |
| 360-degree peer feedback | P0 | ✅ |
| Performance Improvement Plans (PIPs) | P0 | ✅ |
| Analytics overview / rating distribution | P0 | ✅ |
| Self-assessment form | P1 | ✅ |
| Review cycle management | P1 | ✅ |
| Calibration workflow | P1 | ✅ |
| Bell curve / rating distribution analytics | P1 | ✅ |
| Department heatmap analytics | P1 | ✅ |

---

### APP 7 — Training Tracker (`/training`)
**Roles:** All | **DB:** `training_courses`, `training_enrollments`, `training_certificates`

| Feature | Priority | Status |
|---------|----------|--------|
| Course catalogue (CRUD) | P0 | ✅ |
| Enroll employee in course | P0 | ✅ |
| Progress tracking | P0 | ✅ |
| Auto-issue certificate at 100% | P0 | ✅ |
| Mandatory training flags with due dates | P0 | ✅ |
| Auto-enrol on onboarding completion | P1 | ✅ |
| Certificate expiry tracking (60-day banner) | P1 | ✅ |
| Compliance training report tab (CSV export) | P1 | ✅ |
| Learning paths / course sequences | P1 | ✅ |

---

### APP 8 — IT Services (`/it-services`)
**Roles:** All (Employee = own tickets; IT Admin = all) | **DB:** `it_tickets`, `it_ticket_comments`

| Feature | Priority | Status |
|---------|----------|--------|
| Raise IT ticket | P0 | ✅ |
| View / edit / close ticket | P0 | ✅ |
| Ticket comments thread | P0 | ✅ |
| Auto ticket number (INC-xxx) | P0 | ✅ |
| Category / priority / status filters | P0 | ✅ |
| SLA tracking per priority (visual bar) | P1 | ✅ |
| Assign ticket to IT agent | P1 | ✅ |
| KB article prompt on ticket resolution | P1 | ✅ |
| Ticket escalation on SLA breach | P1 | ✅ |
| IT analytics tab (resolution time, breach rate, volume) | P1 | ✅ |
| CSAT rating on resolution (5-star) | P2 | ✅ |
| Table / Kanban view toggle | P1 | ✅ |
| Knowledge Base tab (search, article grid, create) | P1 | ✅ |
| Linked Items panel (Backlog / Defects / Related Tickets) | P2 | ✅ |
| Assigned To filter | P1 | 📋 Planned |

---

### APP 9 — Payroll Management (`/payroll`)
**Roles:** Finance, HR, Admin | **DB:** `payroll_records`, `salary_structures`

| Feature | Priority | Status |
|---------|----------|--------|
| View payroll records | P0 | ✅ |
| Bulk process payroll | P0 | ✅ |
| Salary structure (Basic, HRA, Allowances) | P0 | ✅ |
| PF / ESI / TDS calculation (constants-driven) | P0 | ✅ |
| Payslip viewer with print-to-PDF | P0 | ✅ |
| Payroll approval workflow (HR → Finance) | P1 | ✅ |
| NEFT bank transfer file export | P1 | ✅ |
| Salary revision history tab | P1 | ✅ |
| Leave deduction integration | P1 | ✅ |
| Statutory compliance reports | P1 | ✅ |

---

### APP 10 — Invoice Generation (`/invoices`)
**Roles:** Finance, Admin | **DB:** `invoices`, `invoice_clients`, `invoice_line_items`

| Feature | Priority | Status |
|---------|----------|--------|
| Create / edit invoice | P0 | ✅ |
| Line items management | P0 | ✅ |
| Auto invoice number (JSN###) | P0 | ✅ |
| PDF viewer and download | P0 | ✅ |
| Payment status tracking | P0 | ✅ |
| GST tax calculation (configurable rate) | P1 | ✅ |
| Revenue analytics tab | P1 | ✅ |
| Overdue alert banner + Send Reminder | P1 | ✅ |
| Invoice approval workflow | P1 | ✅ |
| Email invoice to client | P1 | 🔲 Requires email provider |

---

### APP 11 — Project Management (`/projects`)
**Roles:** Manager, Admin; Employee = assigned projects only  
**DB Tables:** `projects`, `project_members`, `project_tasks`, `project_backlog_items`, `project_defects`, `project_milestones`, `project_sprints`, `project_sprint_backlog`, `project_epics`, `project_risks`, `project_time_logs`, `project_backlog_dependencies`, `project_budget_line_items`, `project_rag_log`, `project_activity_log`, `pm_saved_views`, `project_notifications`  
**Master Data:** `pm_project_categories`, `pm_methodologies`, `pm_task_types`, `pm_story_point_scales`, `pm_risk_categories`, `pm_budget_categories`, `pm_health_metrics`  
**Hook:** `useProjectData.ts` → Supabase direct  
**Status:** ✅ Full spec implemented (2026-09-04)

#### Dashboard View
| Feature | Priority | Status |
|---------|----------|--------|
| 4 KPI cards (Active, Due Today, Overdue, At Risk) | P0 | ✅ |
| My Tasks panel with Today / This Week / Overdue tabs | P0 | ✅ |
| Active Projects 3-column card grid | P0 | ✅ |
| Team Workload stacked bar chart | P1 | ✅ |
| Sprint Burndown mini chart (live data) | P1 | ✅ |
| Gantt Timeline (zoom: Month/Quarter/Year, RAG colors, click→detail, hover tooltip) | P1 | ✅ |
| SideNav badges: overdue tasks (red), at-risk projects (amber) | P1 | ✅ |

#### Projects List
| Feature | Priority | Status |
|---------|----------|--------|
| Grid view (ProjectCard with health badge, RAG dot, progress, category color) | P0 | ✅ |
| Table view toggle | P1 | ✅ |
| Search + multi-filter bar (status, category, manager, methodology) | P1 | ✅ |
| 3-step Create Project wizard (Basic Info → Dates & Budget → Team) | P0 | ✅ |

#### Project Detail (9 tabs)
| Tab | Feature | Status |
|-----|---------|--------|
| **Overview** | Description, Key Metrics row, Milestones timeline strip | ✅ |
| | Recent Activity feed (from `project_activity_log`) | ✅ |
| | Project Info card, Budget card with burn rate | ✅ |
| | Health Score (5-dimension) with dimension bars | ✅ |
| | RAG history log (last 5 changes) | ✅ |
| | Team member avatars | ✅ |
| **Backlog** | Table / Kanban / Epics view toggle | ✅ |
| | Epic pill filter row + epic chips on rows | ✅ |
| | Advanced filters (Epic, Sprint, Type, Priority, Assignee, Points range) | ✅ |
| | Active filter chips + Clear All | ✅ |
| | Saved views (persisted to `pm_saved_views`) | ✅ |
| | AddBacklogSlideOver (type, priority, sprint, epic, acceptance criteria, dependencies) | ✅ |
| | Epic management (AddEpicSlideOver, color picker, progress bar) | ✅ |
| | Dependency tracking (Blocks / Blocked By / Relates To) | ✅ |
| | "Blocked" chip on rows | ✅ |
| **Tasks** | Kanban board (To Do / In Progress / In Review / Done) | ✅ |
| | Sprint filter + Swimlane toggle (by Assignee/Priority) | ✅ |
| | Task detail modal with inline edit | ✅ |
| | Log Time modal | ✅ |
| **Sprints** | Sprint list sidebar + sprint detail | ✅ |
| | PLANNING: two-panel Sprint Planning (backlog ↔ sprint, capacity bar) | ✅ |
| | ACTIVE: days countdown, mini burndown, progress bar | ✅ |
| | Complete Sprint modal (move incomplete items) | ✅ |
| | Velocity calculation on sprint complete | ✅ |
| | Analytics sub-tab (velocity bar chart + sprint comparison table) | ✅ |
| **Milestones** | Timeline view (diamond markers, RAG colors, Today line) | ✅ |
| | Table view toggle | ✅ |
| | Milestone slide-over (type, owner, linked items, notes) | ✅ |
| | Auto-flag Missed (past due, still Pending/At Risk) | ✅ |
| **Defects** | KPI row (Total, Open, SLA Breached, Fixed This Sprint) | ✅ |
| | Bidirectional sync with Defect Tracker app | ✅ |
| | "Open in Defect Tracker ↗" link | ✅ |
| | Table / Kanban views, severity badges, SLA countdown | ✅ |
| **Risks** | KPI row (Total, High, Mitigated) | ✅ |
| | 3×4 Risk heat map (Likelihood × Impact, click to filter) | ✅ |
| | Risk table sorted by score DESC | ✅ |
| | AddRisk slide-over (live score calculator) | ✅ |
| **Reports** | Burndown sub-tab (SVG, sprint selector, ideal + actual lines) | ✅ |
| | Velocity sub-tab (grouped bars, rolling avg line, comparison table) | ✅ |
| | Time Log sub-tab (filter table, donut chart, CSV export) | ✅ |
| | Budget sub-tab (overview card, category table, bar chart, burn rate) | ✅ |
| | Defect Trends sub-tab (opened/closed line, root cause chart) | ✅ |

#### My Tasks View
| Feature | Priority | Status |
|---------|----------|--------|
| List view (grouped by project/due/priority/sprint) | P0 | ✅ |
| Kanban view (4 columns, all projects) | P1 | ✅ |
| Calendar view (month grid, priority-colored chips) | P1 | ✅ |
| Filter bar (project, priority, status) | P1 | ✅ |
| Overdue section pinned at top | P0 | ✅ |

#### Business Rules & Validations — Project Management

**Projects:**
- Name: required, 3–100 chars, unique within org
- Start Date must be ≤ End Date
- Manager: required
- Budget if entered: must be > 0
- Cannot delete project with active sprint (must complete or cancel first)
- Only `admin` can delete projects
- Budget alerts: toast warning at 70%, 90%; error at 100%

**Sprints:**
- Only one sprint can be Active per project at a time
- Cannot start sprint without sprint goal (required)
- Sprint dates cannot overlap with another sprint in same project
- Sprint must have at least 1 backlog item committed before start
- Complete Sprint: all In Progress items must be moved — cannot abandon mid-item
- Velocity = story points of items moved to Done status before sprint end
- Reopening a completed sprint: admin only

**Backlog Items:**
- Story points must be from selected `pm_story_point_scales` values
- Epic link: one item can only belong to one epic
- Moving item from Active sprint: allowed only for manager/admin
- Adding item to Active sprint: allowed, flagged as "Added mid-sprint"
- Circular dependency detection: shows error on save

**Milestones:**
- Due date must be within project start/end range
- Cannot mark Achieved before due date without confirmation
- Auto-flagged Missed when due date passes and status is still Pending/At Risk (on component load)

**Risks:**
- Risk Score = PM_RISK_LIKELIHOODS.value × PM_RISK_IMPACTS.value (DB computed column)
- Status cannot go back to 'Identified' from 'Mitigated' or 'Closed'
- 'Triggered' status: triggers `notifyPM` to project manager

**Tasks:**
- Due date cannot be before project start date
- Estimated hours: max 200 per task
- Logged hours: cannot log future date
- Deleting a task with logged hours: soft delete only (archive flag)
- Assigning a task: `notifyPM` fires to assignee

**Budget:**
- Alert at 70%: toast warning to project manager
- Alert at 90%: toast warning — notify admin
- Alert at 100%: toast error — block billable time logging (warn, allow manager override)

**Role Enforcement:**
| Action | Employee | Manager | Admin |
|--------|----------|---------|-------|
| View own projects | ✅ | ✅ | ✅ |
| View all projects | ❌ | ✅ | ✅ |
| Create project | ❌ | ✅ | ✅ |
| Delete project | ❌ | ❌ | ✅ |
| Change RAG status | ❌ | ✅ | ✅ |
| Start/Complete sprint | ❌ | ✅ | ✅ |
| Add team members | ❌ | ✅ | ✅ |
| Log time (own tasks) | ✅ | ✅ | ✅ |
| Manage risks/milestones | ❌ | ✅ | ✅ |
| Override budget alert | ❌ | ✅ | ✅ |

---

### APP 12 — Defect Tracker (`/defect-tracker`)
**Roles:** All (Employee = view own reported; IT/QA/Manager = team; Admin = all)  
**DB Tables:** `project_defects`, `defect_activity_log`, `defect_comments`, `defect_linked_items`, `defect_sla_events`, `defect_sla_policies`, `defect_resolution_codes`, `defect_root_cause_categories`, `defect_rejection_reasons`, `defect_labels`, `defect_escalation_rules`, `defect_saved_filters`  
**Hook:** `useDefectTrackerData.ts` → Supabase direct  
**Status:** ✅ Full spec implemented (~97%)

#### Screen 1 — Dashboard
| Feature | Status |
|---------|--------|
| 5 KPI cards (Total Open, Very High, SLA Breached, Fixed Today, Pending Verify) | ✅ |
| Very High Alert Banner with pulse animation | ✅ |
| Severity donut chart | ✅ |
| By-Project stacked bar chart (clickable) | ✅ |
| SLA Compliance table | ✅ |
| 30-day Open Trend (Opened + Closed + Net, 3 lines) | ✅ |
| Recent Activity feed | ✅ |
| Week-over-week delta on Total Open KPI | ✅ |

#### Screen 2 — All Defects
| Feature | Status |
|---------|--------|
| Table / Kanban / Timeline view toggle | ✅ |
| Primary filters: Severity chips, Status chips, Search | ✅ |
| More Filters: Environment, Priority, Reporter, Sprint, Label, Regression, SLA Status, Date range | ✅ |
| Active filter chips + Clear All | ✅ |
| Sort + Group By (Project/Severity/Status) | ✅ |
| Export CSV | ✅ |
| Bulk action bar | ✅ |
| Pagination 50/page | ✅ |
| Saved Filters (4 prebuilt + save current) | ✅ |

#### Screen 3 — Defect Detail
| Feature | Status |
|---------|--------|
| Header: ID, Severity, Regression chip, Title, Status dropdown | ✅ |
| Change Severity (with manager approval modal for Very High) | ✅ |
| Reassign modal (employee picker) | ✅ |
| SLA Banner — 3 progress bars + Pause/Resume | ✅ |
| Description, Steps to Reproduce, Expected/Actual | ✅ |
| Environment Details, Fix Details with Code Reference | ✅ |
| Verification card with Evidence URL | ✅ |
| Linked Items panel | ✅ |
| Activity + Comments with @mention support | ✅ |
| Watchers panel | ✅ |
| Duplicate badge (shows "Duplicate of {ID}") | ✅ |

#### Screen 4 — SLA Tracker
| Feature | Status |
|---------|--------|
| SLA Summary Matrix, At-Risk Panel, Breached Panel | ✅ |
| SLA Timeline Chart (7-day stacked area) | ✅ |
| By-Project SLA table | ✅ |
| Export CSV, date range filter, project filter | ✅ |

#### Screen 5 — By Project
| Feature | Status |
|---------|--------|
| Accordion list with severity chips, progress bar, SLA badge | ✅ |
| Active Sprint chip on project row | ✅ |
| Expanded mini-table (5 critical defects) | ✅ |
| Search bar, sort dropdown | ✅ |

#### Screen 6 — Analytics
| Feature | Status |
|---------|--------|
| Defect Velocity + Intro Rate charts | ✅ |
| Root Cause Breakdown pie | ✅ |
| Regression Rate gauge | ✅ |
| Defect Aging bar chart | ✅ |
| Avg Fix Time vs SLA Target | ✅ |
| Top Reporters + Top Assignees tables | ✅ |
| Sprint filter | ✅ |

#### Defect Business Rules & Validations
- Severity levels: Very High / High / Medium / Low (not S1-S4)
- SLA breach: Very High = 4h, High = 8h, Medium = 24h, Low = 72h (configurable in `defect_sla_policies`)
- Status transitions: defined in `VALID_TRANSITIONS` map; invalid transitions blocked
- Regression: auto-flagged when a Closed defect is reopened
- Very High defect created: notifies team immediately
- Duplicate detection: mark as duplicate + link to original
- Won't Fix: requires reason selection from `defect_rejection_reasons`
- Resolution: must select code from `defect_resolution_codes`
- SLA pause/resume: logged to `defect_sla_events`

---

### APP 13 — Asset Management (`/assets`)
**Roles:** IT Admin, Admin | **DB:** `assets`, `asset_assignments`, `asset_maintenance`

| Feature | Priority | Status |
|---------|----------|--------|
| Asset catalogue (CRUD) | P0 | ✅ |
| Assign asset to employee (5-step wizard) | P0 | ✅ |
| Return asset | P0 | ✅ |
| Assignment history tab | P0 | ✅ |
| Maintenance log tab | P0 | ✅ |
| Asset stats dashboard | P0 | ✅ |
| Warranty expiry alerts (90/60/30d configurable) | P1 | ✅ |
| Maintenance calendar (monthly grid, color-coded) | P1 | ✅ |
| Recurring maintenance scheduler | P1 | ✅ |
| Reports (Inventory/Depreciation/Warranty/Maintenance/Assignment) | P1 | ✅ |
| QR code generation (print + PNG download) | P2 | ✅ |
| Straight-line depreciation (book value, EOL status) | P2 | ✅ |
| Documents tab (per asset, upload metadata) | P2 | ✅ |

---

### APP 14 — OKR Management (`/okr`)
**Roles:** Manager, Admin; Employee = own OKRs | **DB:** `okrs`, `okr_key_results`, `okr_updates`

| Feature | Priority | Status |
|---------|----------|--------|
| Create OKR with key results | P0 | ✅ |
| Progress updates on key results | P0 | ✅ |
| Auto-recalculate parent OKR from KRs | P0 | ✅ |
| Status tracking (On Track / At Risk / Behind) | P0 | ✅ |
| Cascading OKRs tree view | P1 | ✅ |
| OKR history by quarter | P1 | ✅ |
| OKR grading / scoring (A–F) | P1 | ✅ |
| OKR history CSV export | P2 | ✅ |

---

### APP 15 — Knowledge Base (`/knowledge`)
**Roles:** All | **DB:** `knowledge_articles`

| Feature | Priority | Status |
|---------|----------|--------|
| Article CRUD (rich text) | P0 | ✅ |
| Category management + tag filtering | P0 | ✅ |
| Full-text search | P0 | ✅ |
| Feedback rating (helpful / not helpful) | P1 | ✅ |
| Most viewed / trending articles | P1 | ✅ |
| Comment / discussion thread per article | P2 | ✅ |
| Article version history | P2 | ✅ |

---

### APP 16 — Communications Hub (`/communications`)
**Roles:** All | **DB:** `communications_posts`

| Feature | Priority | Status |
|---------|----------|--------|
| Post announcements (rich text) | P0 | ✅ |
| Audience targeting (dept/role) | P1 | ✅ |
| Emoji reactions | P1 | ✅ |
| Pinned announcements | P1 | ✅ |
| Comment threads per announcement | P1 | ✅ |
| File / image attachments | P2 | ✅ |
| Analytics (reach, read rate, engagement) | P2 | ✅ |

---

### APP 17 — LinkedIn Post Manager (`/linkedin`)
**Roles:** Marketing, Admin

| Feature | Priority | Status |
|---------|----------|--------|
| Create / edit post | P0 | ✅ |
| AI post generator | P0 | ✅ |
| Schedule post with date/time | P0 | ✅ |
| Content calendar view | P1 | ✅ |
| Post analytics | P1 | ✅ |
| LinkedIn API live publishing | P1 | 🔲 Requires LinkedIn OAuth |

---

### APP 18 — User Management (`/user-management`)
**Roles:** Admin only | **DB:** `app_users`, `audit_logs`

| Feature | Priority | Status |
|---------|----------|--------|
| List / search / filter users | P0 | ✅ |
| Create / edit / deactivate user | P0 | ✅ |
| Role assignment + bulk role assignment | P0 | ✅ |
| Audit log viewer (searchable) | P0 | ✅ |
| Password reset modal | P0 | ✅ |
| CSV export, Last Login column | P1 | ✅ |
| Custom role creation + permission audit log | P1 | ✅ |

---

### APP 19 — Permission Manager (`/permissions`)
**Roles:** Admin only | **DB:** `role_permissions`

| Feature | Priority | Status |
|---------|----------|--------|
| Role-based permission matrix UI | P0 | ✅ |
| Toggle permissions per role | P0 | ✅ |
| Persist permissions to DB | P0 | ✅ |
| Custom role creation | P1 | ✅ |
| Permission audit log | P1 | ✅ |

---

### APP 20 — Master Data Management (`/master-data`)
**Roles:** Admin, Finance, HR | **Status:** ✅ 25+ entities, 6 categories

**PM-specific master data (from `04_pm_master.sql`):**
| Table | Seeded Values |
|-------|---------------|
| `pm_project_categories` | Product Development, IT Infrastructure, Business Process, Research & Innovation, Compliance, Marketing, Operations, Client Delivery, Internal Tools |
| `pm_methodologies` | Scrum (sprints+points), Kanban, SAFe, Waterfall, Hybrid |
| `pm_task_types` | Story, Bug, Task, Epic, Sub-task, Spike, Improvement |
| `pm_story_point_scales` | Fibonacci [1,2,3,5,8,13,21], T-Shirt [XS–XXL], Linear [1–10] |
| `pm_risk_categories` | Technical, Resource, Schedule, Scope, Budget, External/Vendor, Compliance |
| `pm_budget_categories` | Personnel, Infrastructure, Software/Licenses, Travel, Training, Contingency, Other |
| `pm_health_metrics` | Schedule, Scope, Quality, Velocity, Budget (with green/yellow thresholds + weights) |

**Defect Tracker master data:**
| Table | Seeded Values |
|-------|---------------|
| `defect_sla_policies` | Very High (4h), High (8h), Medium (24h), Low (72h) |
| `defect_resolution_codes` | 9 codes (Fixed, Workaround, By Design, Cannot Reproduce, etc.) |
| `defect_root_cause_categories` | 9 categories |
| `defect_rejection_reasons` | 5 reasons |
| `defect_labels` | 10 labels |
| `defect_escalation_rules` | 5 rules |

---

### APP 21 — Executive Dashboard (`/executive-dashboard`)
**Roles:** Admin, Manager, Finance, HR

| Feature | Priority | Status |
|---------|----------|--------|
| Headcount, Recruitment, Training, Payroll, Invoice KPIs (live) | P0 | ✅ |
| Date range + dept filters | P0 | ✅ |
| Export PDF / Excel | P1 | ✅ |
| KPI drill-down | P2 | ✅ |

---

### APP 22 — Advanced Analytics (`/advanced-analytics`)

| Feature | Priority | Status |
|---------|----------|--------|
| Custom report builder | P1 | ✅ |
| 5 pre-built report templates | P1 | ✅ |
| Chart types: bar, line, pie, funnel | P1 | ✅ |
| Filter by dept, location, date, role | P1 | ✅ |
| Export CSV / Excel / PDF | P1 | ✅ |

---

### APP 23–27 — Placeholder Apps (Future Phase)

| App | Route | Status |
|-----|-------|--------|
| Workflow Automation | `/workflow-dashboard` | 📋 Planned |
| AI Intelligence Center | `/ai-intelligence-dashboard` | 📋 Planned |
| Collaboration Hub | `/collaboration-hub` | 📋 Planned |
| Security & Compliance | `/security-compliance` | 📋 Planned |
| User Documentation | `/documentation` | 📋 Planned |

---

## 6. Cross-App Feature Connections

| Trigger | Source App | Target App | Action | Status |
|---------|-----------|-----------|--------|--------|
| Candidate marked "Hired" | Recruitment | Onboarding | Auto-create onboarding record | ✅ |
| Onboarding "Enable Access" | Onboarding | Directory + User Mgmt | Create employee + app_user atomically | ✅ |
| Onboarding completed | Onboarding | Training | Auto-enrol in mandatory courses | ✅ |
| Onboarding completed | Onboarding | Notifications | Notify manager | ✅ |
| IT ticket resolved | IT Services | Knowledge Base | Prompt: "Create KB article?" | ✅ |
| Leave approved | Dashboard | Payroll | Deduct unpaid leave from salary + LOP notify | ✅ |
| New article published | Knowledge Base | Communications | Auto-post announcement (toast action) | ✅ |
| Payroll processed | Payroll | Dashboard | Employee notified, payslip available | ✅ |
| Asset assigned | Assets | Onboarding | Mark welcome kit item fulfilled + notify employee | ✅ |
| Task assigned (PM) | Projects | Notifications | Notify assignee via `project_notifications` | ✅ |
| Red RAG change (PM) | Projects | Notifications | Notify admin via `project_notifications` | ✅ |
| Risk Triggered (PM) | Projects | Notifications | Notify project manager | ✅ |
| Defect created in Projects | Projects | Defect Tracker | Shared `project_defects` table — appears in both apps | ✅ |
| S1/S2 defect in Defect Tracker | Defect Tracker | Projects | Badge shown on project card in Projects app | ✅ |
| Sprint started/completed | Projects | Activity Log | Logged to `project_activity_log` | ✅ |

---

## 7. DB Tables Reference

| App | Key Tables |
|-----|-----------|
| Projects | `projects`, `project_members`, `project_tasks`, `project_backlog_items`, `project_sprints`, `project_sprint_backlog`, `project_milestones`, `project_epics`, `project_risks`, `project_defects`, `project_time_logs`, `project_backlog_dependencies`, `project_budget_line_items`, `project_rag_log`, `project_activity_log`, `pm_saved_views`, `project_notifications` |
| Defect Tracker | `project_defects` (shared), `defect_activity_log`, `defect_comments`, `defect_linked_items`, `defect_sla_events`, `defect_sla_policies`, `defect_resolution_codes`, `defect_root_cause_categories`, `defect_rejection_reasons`, `defect_labels`, `defect_escalation_rules`, `defect_saved_filters` |
| Recruitment | `recruitment_candidates`, `recruitment_jobs`, `recruitment_interviews`, `recruitment_feedback` |
| Onboarding | `onboarding_records`, `onboarding_tasks`, `onboarding_documents`, `onboarding_welcome_kits` |
| Performance | `performance_reviews`, `performance_goals`, `performance_feedback`, `performance_pips` |
| Training | `training_courses`, `training_enrollments`, `training_certificates` |
| IT Services | `it_tickets`, `it_ticket_comments` |
| Payroll | `payroll_records`, `salary_structures` |
| Invoices | `invoices`, `invoice_clients`, `invoice_line_items` |
| Assets | `assets`, `asset_assignments`, `asset_maintenance` |
| OKR | `okrs`, `okr_key_results`, `okr_updates` |
| Knowledge Base | `knowledge_articles` |
| Communications | `communications_posts` |
| LinkedIn | `linkedin_posts`, `linkedin_templates`, `linkedin_events` |
| User Management | `app_users`, `audit_logs` |
| Notifications | `notifications`, `push_subscriptions`, `project_notifications` |
| Master Data PM | `pm_project_categories`, `pm_methodologies`, `pm_task_types`, `pm_story_point_scales`, `pm_risk_categories`, `pm_budget_categories`, `pm_health_metrics` |
| Permissions | `role_permissions` |

---

## 8. Remaining Work & External Dependencies

### External Dependencies (cannot build without third-party API)
1. **Email candidate** — requires SendGrid / Resend / SMTP integration
2. **Email invoice to client** — requires email provider integration
3. **LinkedIn API live publishing** — requires LinkedIn OAuth + API credentials
4. **SLA scheduled checks** — require Supabase cron (auto-breach detection without user action)

### Completed (previously deferred, now done — 2026-09-04)
- ✅ **@mention dropdown** in PM task/backlog/bug descriptions (employees table lookup)
- ✅ **Watcher system** for defects (follow/unfollow, notifications on status change)
- ✅ **Per-user PM notification preferences UI** (9 toggle types, persisted to `notification_preferences`)
- ✅ **Sprint Kanban drag-and-drop** between columns (HTML5 drag API, ring highlight, Supabase update)
- ✅ **Gantt milestone diamonds** on project bars (◇ positioned by date, color by status, hover tooltip)
- ✅ **IT Services → Asset bidirectional linking** (linked asset section in ticket detail, reverse badge in asset detail)
- ✅ **IT Ticket category from Master Data** (`master_value_helps` query, fallback to constants)
- ✅ **IT Assigned-To filter** dropdown (IT staff from `app_users`, includes Unassigned option)
- ✅ **PDF export in Defect Tracker Analytics** (opens print window with analytics HTML)
- ✅ **E2E test coverage expanded** — 6 new spec files: Performance, Training, Communications, Collaboration, Payroll, User Management
- ✅ **Multi-language translations** — `es.ts`, `de.ts`, `hi.ts` expanded from 1138 → 2030 lines each
- ✅ **ReportBuilder real DB data** — preview now queries Supabase directly (no more Math.random())
- ✅ **Duplicate i18n key fixed** — `validation.channel.name` deduplication

---

*Last updated: 2026-09-04 | Build: ✅ Zero TypeScript errors | 2868 modules | Updated by: Claude Code*
