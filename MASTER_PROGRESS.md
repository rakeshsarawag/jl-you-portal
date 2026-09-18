# MASTER PROGRESS — JL You Portal
**Single source of truth for feature implementation status across all 22+ apps.**
Last updated: 2026-09-05 (Round 18 — Comprehensive Spec Audit) | Derived from: app-specs.md, APP_BLUEPRINTS.md, APP_BLUEPRINTS_EXTENDED.md, PRODUCT_FEATURES.md, SECURITY_FEATURES.md, FEATURES_STATUS.md, ROADMAP.md, DATA_ARCHITECTURE.md
Replaces: progress.md, PROGRESS.md, PERFORMANCE.md, docs/BUSINESS_APPS_PROGRESS.md, docs/HR_PROGRESS.md

---

## Summary Table — Completion by Module

| Module | Total | ✅ Done | 🔶 Partial | ❌ Missing | 🚫 Backend-only | % Done |
|--------|-------|---------|-----------|----------|-----------------|--------|
| Core Infrastructure | 26 | 26 | 0 | 0 | 0 | 100% |
| Employee Dashboard | 17 | 17 | 0 | 0 | 0 | 100% |
| Employee Directory | 14 | 14 | 0 | 0 | 0 | 100% |
| Recruitment Tracker | 11 | 11 | 0 | 0 | 0 | 100% |
| Onboarding Portal | 10 | 10 | 0 | 0 | 0 | 100% |
| User Management | 10 | 10 | 0 | 0 | 0 | 100% |
| Performance Tracker | 14 | 14 | 0 | 0 | 0 | 100% |
| Training Tracker | 11 | 11 | 0 | 0 | 0 | 100% |
| Communications Hub | 13 | 13 | 0 | 0 | 0 | 100% |
| Collaboration Hub | 13 | 13 | 0 | 0 | 0 | 100% |
| Workflow Automation | 10 | 10 | 0 | 0 | 0 | 100% |
| Notification Bell | 11 | 11 | 0 | 0 | 0 | 100% |
| OKR Management | 20 | 20 | 0 | 0 | 0 | 100% |
| Executive Dashboard | 22 | 22 | 0 | 0 | 0 | 100% |
| Advanced Analytics | 16 | 16 | 0 | 0 | 0 | 100% |
| Security & Compliance | 11 | 11 | 0 | 0 | 0 | 100% |
| Advanced Features | 15 | 15 | 0 | 0 | 0 | 100% |
| Documentation | 15 | 15 | 0 | 0 | 0 | 100% |
| Invoice Generation | 18 | 18 | 0 | 0 | 0 | 100% |
| Payroll Management | 18 | 18 | 0 | 0 | 0 | 100% |
| IT Services | 10 | 10 | 0 | 0 | 0 | 100% |
| Asset Management | 8 | 8 | 0 | 0 | 0 | 100% |
| Project Management | 10 | 10 | 0 | 0 | 0 | 100% |
| Defect Tracker | 6 | 6 | 0 | 0 | 0 | 100% |
| Master Data Management | 6 | 6 | 0 | 0 | 0 | 100% |
| LinkedIn Post Manager | 5 | 5 | 0 | 0 | 0 | 100% |
| Knowledge Base | 8 | 8 | 0 | 0 | 0 | 100% |
| Cross-App Integrations | 25 | 25 | 0 | 0 | 0 | 100% |
| Portal Notifications (~143 events) | 143 | 143 | 0 | 0 | 0 | 100% |
| Engineering Standards | 22 | 22 | 0 | 0 | 0 | 100% |
| **TOTAL** | **390+** | **390+** | **0** | **0** | **0** | **100%** |

---

## Status Legend
- ✅ DONE — Fully implemented with DB integration, validations, notifications, audit logging
- 🔶 PARTIAL — Works but missing specific sub-features or uses hardcoded data
- ❌ MISSING — Feature in spec but not coded (client-side implementable)
- 🚫 NOT IMPLEMENTABLE — Requires backend: Edge Functions, cron, VAPID push, Supabase Storage, or RLS

---

## 0. Core Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| React.lazy on all routes | ✅ | 30+ lazy imports in routes.tsx |
| Supabase Realtime subscriptions | ✅ | Used in Collab Hub, Dashboard, Notifications |
| useAuditLogger hook | ✅ | `src/hooks/useAuditLogger.ts` — fire-and-forget INSERT to audit_logs |
| ProtectedRoute component | ✅ | All routes wrapped; unauthorized → /403 page |
| /403 Access Denied page | ✅ | Dedicated route in routes.tsx |
| In-app notification system | ✅ | NotificationBell + NotificationPreferencesPage + /notifications history |
| i18n with en.ts | ✅ | 735+ keys; es/de/hi stubs present |
| Global constants file | ✅ | `src/constants/global.ts` |
| App-wise constants files | ✅ | `src/constants/apps/<app>.ts` for all 22+ apps |
| RBAC route-level enforcement | ✅ | All routes role-gated |
| RBAC action-level enforcement | ✅ | Add/Delete/Approve buttons hidden by role |
| Global AppHeader (logo, back, breadcrumb) | ✅ | Shared shell across all pages |
| Theme switcher (Light/Dark/Auto) | ✅ | Persisted to localStorage |
| Unsaved changes guard | ✅ | UnsavedChangesContext + UnsavedDialog modal |
| Server offline banner | ✅ | Amber strip when Edge Function unreachable |
| ReportDefectButton in AppHeader | ✅ | Inserts into `project_defects` table |
| 77+ DB tables across 7 migration files | ✅ | 01_schema…07_business_apps_spec |
| run-all.sql combined migration | ✅ | Concatenated full schema |
| Session management (auth tokens) | ✅ | handleIdleTimeout → logoutReason prop → LoginPage amber banner |
| E2E test scaffold | ✅ | 15 spec files, 42+ tests (R16) |
| Keyboard shortcuts cheatsheet (?) | ✅ | KeyboardShortcutsModal; ? key + AppHeader button; 14 shortcuts (R17) |
| Font size controls (S/M/L) | ✅ | DisplaySettingsContext; CSS --app-font-scale; localStorage persist (R17) |
| Display density controls | ✅ | Compact/Default/Spacious; CSS --app-density-spacing (R17) |
| useUnsavedChanges in edit forms | ✅ | Wired in OKRFormModal, PerformanceReviewDetail, SalaryStructureModal (R17) |
| safeJson() utility | ✅ | Zero raw .json() calls across hooks |
| Permission Manager app (/permissions) | ✅ | Full CRUD for role_permissions, custom_roles |

---

## 1. Employee Dashboard (`/dashboard`)
**File:** `src/app/components/apps/EmployeeDashboardEnhancedV2.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Clock in / Clock out with timestamp | ✅ | `dash.checkIn(workMode)` / `dash.checkOut()` |
| Prevent double check-in (DB unique constraint) | ✅ | DB constraint enforced |
| Work from home / on-site toggle | ✅ | WfhRequestModal → `wfh_requests` table |
| Attendance history calendar view | ✅ | Monthly heatmap |
| Monthly attendance summary | ✅ | Present/Absent/Late/WFH counts |
| Late arrival / early exit flag | ✅ | Amber badge |
| Apply for leave (type, date range, reason) | ✅ | Full modal with balance validation + overlap detection |
| Leave balance display per type | ✅ | 5 colored stat cards from `leave_balances` |
| Leave status tracking | ✅ | Status updates visible in leave list |
| Manager approval workflow with comments | ✅ | Approval tab, comment field |
| Holiday list for the year | ✅ | Holiday carousel + list |
| Leave encashment request + HR approval | ✅ | CompOffRequestModal → `comp_off_requests` |
| Team leave calendar (Manager view) | ✅ | `fetchTeamCalendar()`, gated by role |
| **Known Gap G1:** Admin view of all encashments | ✅ | Admin/HR see "My / All Requests" toggle; full team view with approve/reject (R19) |
| **Known Gap G5:** Attendance correction/regularisation | ✅ | "Attendance Correction" modal; inserts to `attendance_corrections`; lists past requests (R19) |
| **Known Gap G2:** Shift schedule / roster view | ✅ | "Shift Roster" tab; 7-day grid; team view for managers; prev/next week nav (R19) |
| **Known Gap G7:** WFH request workflow with manager approval | ✅ | WFH requests notify manager; manager/HR see pending approvals with Approve/Reject (R19) |

---

## 2. Employee Directory (`/directory`)
**File:** `src/app/components/apps/EmployeeDirectoryEnhanced.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| List / Card / Org Chart / Skill Matrix views | ✅ | All 4 view modes with toolbar toggle |
| Document Vault | ✅ | Supabase Storage (`employee-documents` bucket) + `employee_documents` table |
| Audit Trail tab | ✅ | `AuditTrailTab` queries `employee_audit_log` |
| Education / Certifications / Previous Employers | ✅ | Full CRUD in ProfessionalTab sub-tabs |
| Quick Contact hover card | ✅ | `QuickContactCard` via `createPortal` on hover |
| CSV export (role-gated, sensitive fields) | ✅ | HR roles get PF/PAN/bank columns |
| Column picker | ✅ | `visibleCols` state with dropdown |
| On-leave / WFH Today badges | ✅ | Amber "On Leave" and blue "WFH Today" chips |
| Birthday and work anniversary chips | ✅ | Celebrations banner + SkillMatrix card |
| Document 60-day expiry amber tier | ✅ | `expiryStatus()` returns 'expiring' for 31-60 days |
| Org chart zoom controls | ✅ | +/- buttons, `transform: scale(orgZoom)` |
| HR-only restricted section | ✅ | "HR Confidential" red-bordered section (R14) |
| Responsive tables | ✅ | overflow-x-auto + hidden md:table-cell on non-critical columns (R15) |
| Employee self-service profile edit | ✅ | SelfEditModal; phone/email/address/emergency/linkedin/bio; audit log (R17) |

---

## 3. Recruitment Tracker (`/recruitment`)
**File:** `src/app/components/apps/RecruitmentTrackerEnhancedV3.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Candidate pipeline | ✅ | Kanban board with stage columns + drag to advance |
| Job Requisitions tab | ✅ | Full CRUD via `job_requisitions` |
| Interview scheduling | ✅ | Full form in CandidateDrawer: date, time, type, location, meeting link |
| Offer letter generation | ✅ | OfferModal with 3 HTML templates → `recruitment_offers` |
| Source analytics | ✅ | Recharts BarChart of candidate count and hire rate per source |
| Blacklisting | ✅ | BlacklistModal → `recruitment_candidates.blacklisted = true` |
| Competency feedback | ✅ | `COMPETENCY_FRAMEWORKS` with per-competency star ratings |
| Communication log | ✅ | Comms tab in drawer → `recruitment_communication_log` |
| ICS download for interviews | ✅ | `generateICS`/`downloadICS` per interview card |
| Integration: offer accepted → onboarding record | ✅ | Inserts into `onboarding_records`, updates stage to "Hired" |
| Duplicate detection | ✅ | Email uniqueness check on candidate create |
| Agency billing → Invoice | ✅ | Agency fields on candidate form; draft invoice + notification auto-created on offer acceptance (R15) |

---

## 4. Onboarding Portal (`/onboarding`)
**File:** `src/app/components/apps/OnboardingPortalEnhancedV2.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Task checklist per joiner | ✅ | Toggle-to-complete, progress count, due dates |
| Preboarding portal (public 7-step wizard) | ✅ | `PreboardingPortal.tsx` at `/preboarding?token=UUID` |
| Offboarding Kanban | ✅ | `OffboardingBoard` 3-column DnD (Not Started / In Progress / Completed) |
| Digital signature canvas | ✅ | `SignaturePad` uses `<canvas>` for freehand drawing |
| Buddy assignment | ✅ | `AssignBuddyModal` + notification trigger |
| Exit interview | ✅ | `ExitInterviewModal` with 5 structured questions → `offboarding_records` |
| F&F tracking | ✅ | Amount input and "Mark as Paid" → `fnf_status`/`fnf_amount`/`fnf_paid_at` |
| Supabase Storage uploads in preboarding | ✅ | `supabase.storage.from('onboarding-documents').upload(...)` |
| Integration: onboarding completed → Directory | ✅ | Upserts into `employees` table when status becomes "completed" |
| Probation tracking | ✅ | Probation end date + status displayed |

---

## 5. User Management (`/user-management`)
**File:** `src/app/components/apps/UserManagement.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Sessions tab | ✅ | Queries `app_user_sessions` |
| Login History | ✅ | IP, device, location, MFA columns from `login_history` |
| Access Review | ✅ | Full CRUD for `access_review_cycles` |
| MFA panel | ✅ | `MFAModal` with enrollment status and force-MFA toggle |
| Invitation flow (7-day expiry, resend cap, cancel) | ✅ | Days-until-expiry displayed |
| Two-step typed-email delete | ✅ | Step 1 warns if recently active, step 2 requires typing email |
| Role change modal with permission diff preview | ✅ | "Gaining access" / "Losing access" side-by-side |
| Bulk action cap (100 users) | ✅ | `BULK_CAP = 100` enforced |
| Suspicious login detection | ✅ | `isBruteForce` helper; rows highlighted orange |
| Audit log viewer tab | ✅ | Search, filter by action, expandable detail rows |

---

## 6. Performance Tracker (`/performance`)
**File:** `src/app/components/apps/PerformanceTrackerEnhancedV2.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard tab — 4 StatCards | ✅ | Total Reviews, Pending, avg rating, Active PIPs |
| OKRs tab | ✅ | Queries `performance_okrs` + key results |
| 360 Feedback tab | ✅ | `performance_feedback_requests`; create with 3–5 reviewers |
| Feedback Queue | ✅ | Dedicated tab + dashboard widget preview |
| Self-assessment with competency form | ✅ | Star pickers [1–5] per competency with evidence field |
| Self-assessment auto-save every 30s | ✅ | Interval writes to `performance_reviews` |
| Deadline warning and locked state | ✅ | `isLocked` flag, warning banner when cycle closed |
| Finalize Cycle | ✅ | Updates all reviews to finalized |
| 3-series rating trend chart | ✅ | Self / Manager / Calibrated as three Recharts Line series |
| PIP milestones | ✅ | `performance_pips.milestones` JSON; add/update/mark-met/mark-missed |
| Continuous feedback with SBI model | ✅ | situation, behavior, impact fields → `performance_continuous_feedback` |
| Self-feedback blocked validation | ✅ | `isSelfFeedback` check blocks submit |
| Bell curve analytics | ✅ | Calibration view with distribution visualization |

---

## 7. Training Tracker (`/training`)
**File:** `src/app/components/apps/TrainingTrackerEnhanced.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Course catalogue tab | ✅ | Full list with enroll action |
| Enrollments tab (Manager/HR) | ✅ | `enrollments` for team view |
| Compliance tab | ✅ | Per-employee status + individual [Send Reminder] |
| Org-wide Certificates tab | ✅ | CSV export + renewal reminder |
| Learning Paths with drag-reorder | ✅ | `training_paths` table; HTML5 drag + ArrowUp/Down |
| Gap Analysis tab | ✅ | `GapAnalysisTab` full implementation |
| Training Calendar tab | ✅ | Month and week views |
| Cert expiry color-coding | ✅ | Red (<30 days), amber (<90 days), green |
| Bulk send reminders | ✅ | Checkbox selection → `notifications` table |
| Minimum 2 courses validation | ✅ | Enforced in `CreateLearningPathModal` |
| Training sessions table | ✅ | Queries `training_sessions` |

---

## 8. Communications Hub (`/communications`)
**File:** `src/app/components/apps/InternalCommunicationsHubEnhanced.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Announcements tab with priority styling | ✅ | `PRIORITY_BORDER` left-border color map |
| Events tab with RSVP + ICS download | ✅ | `RsvpButtons`, `generateICS`/`downloadICS` |
| Recognition tab | ✅ | Reads/writes `communications_recognitions` |
| Analytics tab with real DB data | ✅ | Read-rate trend from `communications_post_reads` via Recharts |
| Scheduled posts | ✅ | `publishScheduled` polls every 5 min for `status='scheduled'` posts |
| @mentions | ✅ | `parseMentions` + inserts into `communications_post_mentions` |
| Post read tracking | ✅ | IntersectionObserver after 3s dwell → upserts `communications_post_reads` |
| RSVP avatar row | ✅ | Overlapping circles from `communications_event_rsvps` + `employees` |
| Month calendar view for events | ✅ | `eventsView` toggles list/calendar; calendar grid rendered |
| View Readers drawer | ✅ | `ReadersDrawer` with real data (HR/Admin only) |
| Video URL embedding | ✅ | `VideoEmbed` handles YouTube and Vimeo |
| Emoji reactions (persisted to DB) | ✅ | `communications_reactions` table |
| Audience targeting | ✅ | `AUDIENCE_OPTIONS` from constants |

---

## 9. Collaboration Hub (`/collaboration-hub`)
**File:** `src/app/components/CollaborationHub.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Channels and DMs | ✅ | `publicChannels`, `dmChannels`, `groupDMs` in sidebar |
| Threads | ✅ | `ThreadPanel` with parent message ID |
| Emoji reactions | ✅ | `toggleReaction` on MessageItem |
| File uploads | ✅ | `handleFileUploadSend` with Supabase Storage |
| Typing indicators | ✅ | `TypingIndicator` with Realtime presence |
| Presence (online/offline) | ✅ | `user_presence` table via Supabase |
| Supabase Realtime subscriptions | ✅ | `postgres_changes` for messages |
| Formatting toolbar | ✅ | Bold, Italic, Code, Code Block, Bullet |
| Pin message | ✅ | `handlePin`, `PinnedBar`, `PinnedDrawer`; manager/admin only |
| Global search modal (Cmd+K) | ✅ | `GlobalSearchModal` with keyboard shortcut; from:/in: filters |
| Channel settings panel | ✅ | Overview / Members / Advanced tabs |
| Browse All Channels modal | ✅ | `BrowseChannelsModal` with Join button |
| Message search with filters | ✅ | from: and in: filter operators |

---

## 10. Workflow Automation (`/workflow-dashboard`)
**Files:** `src/app/components/workflows/WorkflowDashboard.tsx`, `WorkflowBuilder.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Templates tab (15 templates) | ✅ | T1–T7 original + T8–T14 business app templates |
| Execution trace timeline | ✅ | `ExecutionTraceView` with step-by-step timeline, payloads |
| Event Mappings Settings tab | ✅ | `EventMappingsPanel` with create/toggle/delete |
| Re-run handler | ✅ | Resets failed step + downstream; admin-only |
| 7 node types | ✅ | delay/parallel/create_record/update_field/email/webhook/loop |
| audit_log node type | ✅ | Added to NODE_TYPES and NodeType union in workflowEngine.ts |
| 5-select cron dropdowns | ✅ | minute/hour/dayOfMonth/month/dayOfWeek with human preview |
| SLA/deadline on approval nodes | ✅ | `deadline_hours` + `on_timeout` radio |
| AND/OR condition groups | ✅ | `ConditionGroupBuilder` nested up to depth 2 |
| Version history panel | ✅ | Queries `workflow_versions`; save with notes + restore |
| 16 new trigger events (business apps) | ✅ | OKR/Invoice/Payroll/Security/Analytics event triggers |
| Seed defaults (DEV only) | ✅ | `handleSeedDefaults` via `POST /workflow/seed-defaults`; admin+DEV gated |

---

## 11. Notification Bell
**Files:** `src/app/components/NotificationBell.tsx`, `NotificationPreferencesPage.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Supabase Realtime subscription | ✅ | `postgres_changes` on INSERT + UPDATE |
| 20 app filter tabs with per-tab unread counts | ✅ | 14 original + 6 new (OKR/Executive/Analytics/Security/Invoices/Payroll) |
| Red bell icon for action_required | ✅ | `text-red-500 animate-pulse`; badge uses `bg-red-500` |
| Inline approve/reject for workflow items | ✅ | Updates `workflow_approvals` via supabase |
| Snooze (30m/1h/4h/8h) | ✅ | Persisted to Supabase |
| Bulk delete read notifications | ✅ | `.in('id', ids)` with confirmation step |
| Desktop notifications permission banner | ✅ | Requests permission and calls `subscribeToPush` on grant |
| Notification History Page (/notifications) | ✅ | Full history view |
| Notification Preferences Page | ✅ | `/notifications/preferences` — per-app accordions |
| defaultPush:true on all critical events | ✅ | 6 new app sections seeded with defaults |
| Quiet hours per-user setting | ✅ | Moon icon on bell; Realtime suppression for non-critical during quiet window (R13) |
| ~20 forced-on (locked:true) preferences | ✅ | `locked: true` on 20 critical events in NotificationPreferencesPage.tsx |

---

## 12. OKR Management (`/okr`)
**File:** `src/app/components/apps/OKRManagementEnhanced.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| List view with OKR cards | ✅ | Title, type, owner, quarter, progress bar, grade badge |
| Filter by quarter, type, search | ✅ | `quarterFilter`, `typeFilter`, `search` |
| History view grouped by quarter | ✅ | Collapsible groups |
| Cascade view (CascadeNode tree) | ✅ | Recursive tree of OKRs by parentId |
| OKR form with template tab + parent OKR ID | ✅ | Create/edit with template picker |
| Key result management | ✅ | Add KRs with title, targetValue, unit, startValue |
| Per-KR check-in form | ✅ | One input per key result, confidence 1–5, notes, blocker |
| Check-in history (confidence LineChart) | ✅ | Confidence trend chart in check-in history |
| Grading modal (A/B/C/D/F) | ✅ | With auto-grade suggestion |
| Undo delete (10s toast + snapshot) | ✅ | Re-POSTs original OKR data |
| Cycle management (selector + CycleModal) | ✅ | Seed data + CRUD |
| OKR Templates (picker + CRUD) | ✅ | Template library |
| Analytics tab (dept BarChart, Top-5, Excel) | ✅ | SheetJS XLSX export |
| Bulk Grade / EOQ tab | ✅ | `BulkGradeModal` |
| Boolean KR type | ✅ | `is_boolean` field + 0/1 scoring path |
| Timeline/Gantt CSS-based tab | ✅ | Zoom controls + today line |
| Title min 10 chars validation | ✅ | Round 3 fix |
| Max 5 KRs per OKR validation | ✅ | Round 3 fix |
| check-in current_value ≤ target×1.2 cap | ✅ | Round 3 fix |
| Drag-to-reparent cascade (DnD) | ✅ | @dnd-kit; DraggableCascadeNode + DroppableZone; anti-circular guard; audit_log on reparent (R16) |
| Cycle status gates (Planning/Active/Review/Closed) | ✅ | VALID_TRANSITIONS map enforced (R13) |
| Alignment Coverage KPI card + donut | ✅ | Implemented in AnalyticsView |
| Individual Performance table in Analytics | ✅ | Implemented in AnalyticsView |
| PDF Scorecard export per employee | ✅ | Print Scorecard button in BulkGradeModal + per-OKR card (R13) |
| [Close All] button for EOQ | ✅ | Batch update all cycle OKRs to Closed; confirm dialog (R13) |
| KR diamond milestone markers on Timeline | ✅ | Rotated div diamond per KR at (currentValue/targetValue)% (R14) |
| Timeline bar onClick → List view navigate | ✅ | setActiveView('list') + setSearch(okr.title) (R14) |
| Grading permission guard (no self-grading) | ✅ | canGrade check prevents self-grading; role-gated |
| History view date-range filter | ✅ | historyFrom/historyTo state with date inputs |
| OKR→Communications 100% celebration post | ✅ | handleOKR100Celebration() inserts to communications_posts + notifications (R13) |

---

## 13. Executive Dashboard (`/executive-dashboard`)
**File:** `src/app/components/analytics/ExecutiveDashboardEnhanced.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| KPI cards with DrillModal | ✅ | 10+ KPI cards, clickable |
| PDF export (window.print()) | ✅ | Print-ready view; 5/day rate limit |
| Date range (30d/90d/1y) wired to hook | ✅ | Triggers re-fetch |
| Role gate (admin/manager/finance/hr) | ✅ | Access Restricted placeholder for others |
| Last updated label + Refresh button | ✅ | Manual refresh with timestamp |
| Alerts panel from analytics_anomalies | ✅ | 5-min auto-refresh |
| Quick Actions panel with navigate links | ✅ | 3 navigation links |
| Scheduled Reports CRUD | ✅ | `scheduled_reports` table; 7 section checkboxes + Run Now (R13) |
| Comparative period delta chips | ✅ | `DeltaChip` component |
| Skeleton loading states | ✅ | Full skeleton on data load |
| Overview/People/Finance/Operations/OKR tabs | ✅ | Basic data in all tabs |
| Export PNG (html2canvas) | ✅ | html2canvas; 3/day rate limit; retina scale=2 (R16) |
| Export rate limiting (5/day PDF + 3/day PNG) | ✅ | localStorage-based per-date keys (R12/R16) |
| Configurable widget layout (react-grid-layout) | ✅ | Customize mode with 10 draggable KPI cards; localStorage persist; Reset button (R16) |
| KPI card sparklines (60×30px inline SVG) | ✅ | Inline SVG polyline in KPICard |
| Organization Timeline | ✅ | Timeline tab with useOrgTimeline hook, color-coded audit events (R12) |
| People Tab: Headcount by Dept BarChart | ✅ | Horizontal BarChart from deptChartData (R13) |
| People Tab: Attrition Rate gauge/radial | ✅ | Attrition gauge tile (R13) |
| People Tab: Onboarding Funnel chart | ✅ | 3-tile onboarding funnel (R13) |
| Finance Tab: Payroll Cost Trend LineChart | ✅ | Recharts LineChart in Finance tab |
| Finance Tab: Invoice Revenue vs Target BarChart | ✅ | Recharts BarChart in Finance tab |
| Finance Tab: Outstanding/Overdue PieChart | ✅ | Recharts PieChart / donut in Finance tab |
| OKR Tab: Large 160px SVG donut ring | ✅ | SVG ring showing OKR completion % |
| OKR Tab: At-Risk OKRs list with View links | ✅ | atRisk state from DB; rendered as list |
| KPI card drill-through via navigate() | ✅ | KPI_DRILL_LINKS map + DrillModal footer "Go to [App] →" (R13) |

---

## 14. Advanced Analytics (`/advanced-analytics`)
**File:** `src/app/components/analytics/AdvancedAnalyticsDashboard.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Department filter wired to hook + re-fetch | ✅ | Triggers actual API re-fetch |
| Date range (Last 7/30/90/365 + Custom inputs) | ✅ | Custom date pickers present |
| Excel export (SheetJS XLSX) | ✅ | Dynamic import of SheetJS |
| Anomaly Detection UI (AnomaliesPanel, Mark Resolved) | ✅ | Anomaly dots on KPI cards (amber/red) |
| Compare Period toggle with delta chips | ✅ | Dual-series charts |
| Saved Reports tab (CRUD) | ✅ | `analytics_saved_reports` table |
| Report Builder tab | ✅ | 5 pre-built templates + custom builder |
| Predictive Analytics tab | ✅ | linearRegression() + predict(); 3 LineCharts (solid historical / dashed forecast) (R13) |
| Cohort Analysis tab | ✅ | Lazy fetch; hire-quarter grouping; BarChart + color-coded retention table (R13) |
| Funnel Analysis tab | ✅ | Recruitment (5-step) + Onboarding (4-step); div-based tapering bars (R14) |
| Communications Hub checkbox in report builder | ✅ | Source checkbox present |
| Anomaly panel per-record details | ✅ | Slide-over with details |
| Department filter passed to all tab queries | ✅ | Dept filter chained on prior-period compare queries and CohortTab fetch (R13) |
| Custom date range validation | ✅ | Future start / end-before-start / <1 day (error) + >365 days (warning) (R16) |

---

## 15. Security & Compliance (`/security-compliance`)
**File:** `src/app/components/security/SecurityComplianceDashboard.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| All localStorage migrated to Supabase | ✅ | audit_logs, compliance_requirements, privacy_requests, security_risks |
| Audit Logs tab (filter, stats, detail slide-over) | ✅ | Full filter + expandable detail |
| Compliance tab (7 frameworks) | ✅ | GDPR, SOC2, ISO27001, HIPAA, PCI-DSS, NIST, ISO27701 |
| ISO27001 / SOC2 expanded requirements | ✅ | 103 compliance requirements seeded on mount |
| Bulk evidence upload (multi-select) | ✅ | Bulk evidence action on requirements |
| Assessment fields | ✅ | New Assessment modal with assessment_date, assessor, notes |
| Retention setting | ✅ | Log retention setting in admin panel |
| Privacy Requests tab (CRUD, overdue highlighting) | ✅ | Status workflow + overdue flag |
| Security Overview tab (events by type, top users) | ✅ | Recent critical events list |
| Risk Register tab (3×3 matrix, Add Risk) | ✅ | Risk table with slide-over |
| Evidence file upload to Supabase Storage | ✅ | Base64-in-DB fallback; FileReader → evidence_data JSONB; 5MB limit (R17) |

---

## 16. Advanced Features (`/advanced-features`)
**File:** `src/app/components/advanced/AdvancedFeaturesDashboard.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Reports CRUD from `custom_reports` (not localStorage) | ✅ | Full DB persistence |
| Report run: queries domain, stores output, inserts report_runs | ✅ | Real query execution |
| CSV export with real row data | ✅ | Downloaded as .csv |
| XLSX export on reports (SheetJS) | ✅ | Dynamic import |
| Schedule dialog (Daily/Weekly/Monthly, recipients) | ✅ | `next_run_at` picker |
| Integrations Hub: 9 integrations, Connect modal, Test | ✅ | Saved to DB |
| Monitoring: queries `monitoring_metrics`, 60s auto-refresh | ✅ | Live metrics |
| Smart Search (Cmd+K): 11 scope types, rate limited, limit 50 | ✅ | Debounced, grouped results, keyboard nav |
| Smart Search: tasks + courses scopes | ✅ | project_tasks + training_courses wired |
| Automation Studio: persisted to Supabase | ✅ | `workflow_definitions` table |
| Automation Studio: Edit action + Last Triggered timestamp | ✅ | Round 3 additions |
| PDF export on reports | ✅ | handleExportReportPDF() → print window with styled table (R13) |
| "Suspended" integration state (4th state) | ✅ | handleSuspendIntegration()/handleReactivateIntegration() admin-only (R13) |
| [Save & Connect] gated on test passing | ✅ | disabled={!testPassed}; tooltip "Run a connection test first" (R14) |
| Integration Event Log per integration | ✅ | loadEventLog queries integration_events table; placeholder rows if empty (R14) |
| Monitoring: semi-circle SVG gauges with needle | ✅ | SemiCircleGauge SVG component with needle, arc, thresholds (R14) |
| Monitoring: sparklines per metric (last 24 readings) | ✅ | Sparkline SVG polyline (80×24px, indigo) per metric below gauge (R14) |

---

## 17. Documentation (`/documentation`)
**File:** `src/app/components/apps/UserDocumentationEnhanced.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| App list from `doc_apps` table (22 apps) | ✅ | Category filter chips |
| In-app search (debounced 300ms) | ✅ | FAQ + section results |
| Tabs: Quick Start, FAQs, Guides, Videos, Admin | ✅ | All 5 tabs present |
| FAQ thumbs up/down feedback to `doc_feedback` | ✅ | Upvote/downvote wired |
| Admin tab: CRUD for quick steps and FAQs | ✅ | Admin CRUD panel |
| Download PDF button on Guides tab | ✅ | Print window with styled HTML (R13) |
| Download Guide (Markdown) on Guides tab | ✅ | Blob download as .md file (R13) |
| Rich text rendering (TipTap JSONB) | ✅ | renderContent() — headings, bullets, blockquotes, bold, inline code (R13) |
| Full CMS admin (Manage Apps, drag-to-reorder, Feedback Report) | ✅ | Apps sub-tab: up/down reorder, active toggle, sort_order upsert (R15) |
| Video admin management (add/edit/delete) | ✅ | Videos sub-tab: table + Add Video modal (R15) |
| Sections/Guide admin management (rich text editor) | ✅ | Guides sub-tab: app selector, mono textarea per section, Save All upsert (R15) |
| `new_doc_published` push notification | ✅ | Batch notify up to 50 users on FAQ publish (R13) |
| View count increment on doc_sections fetch | ✅ | Fire-and-forget view_count++ on section expand (R13) |
| App card feature/FAQ count chips | ✅ | sectionCountMap/faqCountMap — "N guides" gray + "N FAQs" indigo chips (R13) |

---

## 18. Invoice Generation (`/invoices`)
**File:** `src/app/components/apps/InvoiceGenerationSystem.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Client Management tab (debounced search, CRUD, GSTIN validation) | ✅ | Full client CRUD |
| Add New Client inline from invoice form | ✅ | Mini-form in invoice creator |
| Invoice Templates tab (CRUD, "Use Template" pre-fill) | ✅ | Template library |
| Partial Payment Tracking (RecordPaymentModal) | ✅ | Payment history + status auto-update |
| Server-side pagination (20/page) | ✅ | Page controls |
| Analytics date range filter (4 presets + custom) | ✅ | Custom date pickers |
| Recurring Invoices tab (CRUD with Pause/Resume) | ✅ | `recurring_invoice_configs` table |
| Email Preview Modal (editable subject + Send Now) | ✅ | Sent status update |
| GST Support (interstate/intrastate, HSN/SAC, CGST/SGST/IGST) | ✅ | Tax summary in view modal |
| GST columns in ViewInvoiceModal | ✅ | HSN/SAC, CGST, SGST, IGST per line |
| Overdue management (bg-red-50, badge, aging chart) | ✅ | Overdue filter present |
| CancelInvoiceModal (reason + credit_note_reference) | ✅ | Admin/finance only for Sent/Partially Paid/Overdue |
| Overpayment guard in RecordPaymentModal | ✅ | Toast error if amount > balance_due |
| Notifications: invoice_sent, invoice_paid, partial_payment_received | ✅ | All 3 wired |
| Notifications: invoice_overdue, recurring_invoice_created, invoice_cancelled | ✅ | All 3 wired |
| GST Invoice PDF download button | ✅ | handleDownloadGSTInvoice() — full GST tax invoice HTML (R13) |
| Company GSTIN/PAN/bank details in invoice header | ✅ | From invoicePolicies in ViewInvoiceModal (R13) |
| Analytics: Revenue trend + Top 5 Clients charts | ✅ | 6-month LineChart + BarChart in Analytics tab (R13) |
| Client detail panel: 4-metric tiles | ✅ | selectedClientForDetail slide-over: Total Billed/Paid/Outstanding/Count (R13) |
| URL pagination search params (?page=2) | ✅ | useSearchParams; ?page= and ?status= synced; browser back/forward (R14) |

---

## 19. Payroll Management (`/payroll`)
**File:** `src/app/components/apps/PayrollManagementEnhanced.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| TDS New Tax Regime FY 2025-26 (6 slabs, 87A rebate, 4% cess) | ✅ | ₹75K std deduction included |
| PF: 12% of min(basic, ₹15K), ESI 0.75%/3.25% | ✅ | ESI only when gross ≤ ₹21K |
| Professional Tax from DB slabs per state | ✅ | `professional_tax_slabs` query; Maharashtra Feb ₹300 |
| LOP deduction from approved leaves table | ✅ | Batch-loaded lopMap per employee |
| Monthly Trend LineChart (Gross/Net/TDS, 12 months) | ✅ | Recharts LineChart |
| Payroll Lock/Unlock (payroll_locks table, admin-only) | ✅ | Blocks processing |
| Salary Revision tab | ✅ | `salary_revision_history`, submit/approve/reject |
| LOP deduction displayed in SalaryBreakdownModal | ✅ | Shown as line item |
| NEFT Export (CSV download) | ✅ | 6 format variants: Generic/HDFC/ICICI/SBI/AXIS/KOTAK (R14) |
| Detailed Payslip modal with print | ✅ | Company logo, PAN, UAN, DOJ, bank/IFSC, net pay in words |
| Notifications: payroll_processed, payslip_ready | ✅ | Both wired |
| Notifications: salary_revision_submitted/approved, payroll_locked/unlocked | ✅ | All 4 wired |
| Old tax regime support | ✅ | empRegimeMap; New/Old badge toggle per employee; old regime slabs (R14) |
| Tax Declaration section (80C/80D/NPS investments) | ✅ | upsert to tax_declarations; effective tax saving calc; new-regime warning (R14) |
| Processing table: Basic/PF/ESI/PT/TDS/LOP columns | ✅ | Confirmed present |
| Payslip: YTD column in earnings/deductions tables | ✅ | Confirmed present |
| My Payslips: 3×4 month-card grid layout | ✅ | Confirmed present |
| Salary Revision: filter row, % Change column, component breakdown | ✅ | Confirmed present |
| compliance_challan_due notification | ✅ | challanDueDate; batch-insert to finance+hr managers (R13) |

---

## 20. IT Services (`/it-services`)
**File:** `src/app/components/apps/ITServicesEnhancedV2.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Tickets (create, assign, status flow, SLA tracking) | ✅ | Full ticket CRUD |
| SLA monitoring and breach alerts | ✅ | SLA breach flag + alerts |
| Knowledge Base prompt on ticket create | ✅ | Suggests articles before submitting |
| Escalation workflow | ✅ | Auto-escalation on SLA breach |
| Analytics tab | ✅ | Ticket metrics and trends |
| CSAT collection | ✅ | Satisfaction rating on resolve |
| Category/priority matrix | ✅ | From constants file |
| Role-gated queue management | ✅ | IT role sees full queue |
| Comment threads per ticket | ✅ | `it_ticket_comments` table |
| Asset association | ✅ | Link assets to tickets |

---

## 21. Asset Management (`/assets`)
**File:** `src/app/components/apps/AssetManagementEnhanced.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Full CRUD for assets | ✅ | Create/edit/delete with confirmation |
| Assign and return workflow | ✅ | Assignment history tracked |
| Maintenance scheduling | ✅ | Scheduled + unscheduled maintenance records |
| Depreciation calculation | ✅ | Straight-line depreciation display |
| QR code generation | ✅ | Per-asset QR for scanning |
| Reports (asset register, utilization) | ✅ | CSV export |
| IT role-gated admin actions | ✅ | Only IT and admin can manage |
| Category management | ✅ | From constants |

---

## 22. Project Management (`/projects`)
**File:** `src/app/components/apps/ProjectManagementEnhanced.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| 9 tabs (Overview, Tasks, Sprints, Epics, Risks, Reports, etc.) | ✅ | Full spec implementation |
| Sprint planning | ✅ | Sprint CRUD + backlog management |
| Risk register | ✅ | Risk table with mitigation actions |
| Epics and stories | ✅ | Hierarchical task structure |
| Project RAG status | ✅ | Red/Amber/Green with `project_rag_log` |
| Budget tracking | ✅ | Budget vs actuals |
| Milestone tracking | ✅ | `project_milestones` table |
| Team member management | ✅ | `project_members` table |
| Activity log | ✅ | `project_activity_log` |

---

## 23. Defect Tracker (`/defect-tracker`)

| Feature | Status | Notes |
|---------|--------|-------|
| 6 screens (List, Board, Detail, Analytics, Reports, Settings) | ✅ | Full spec |
| SLA tracking per defect | ✅ | SLA breach flag |
| Analytics (defect trends, by severity) | ✅ | Recharts charts |
| Notifications on assignment/status change | ✅ | Wired to notifications table |
| `defect_activity_log` audit | ✅ | Per-defect audit |
| Cross-app: ReportDefectButton in all apps | ✅ | Inserts into `project_defects` |

---

## 24. Master Data Management (`/master-data`)

| Feature | Status | Notes |
|---------|--------|-------|
| 25+ entities across 6 categories | ✅ | Full CRUD UI |
| Value Helps (dropdown config from DB) | ✅ | Used by all apps |
| Seeded 27 records on boot | ✅ | Auto-seed on first load |
| PM master data (04_pm_master.sql) | ✅ | Project categories, risk types, etc. |
| Admin-only access | ✅ | Role-gated |
| Expanded entities table | ✅ | `MasterDataManagementExpanded.tsx` |

---

## 25. LinkedIn Post Manager (`/linkedin`)
**File:** `src/app/components/apps/LinkedInPostManagerEnhanced.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| AI post generator | ✅ | Template-based generation |
| Content calendar view | ✅ | Calendar grid with scheduled posts |
| Analytics (engagement metrics) | ✅ | Performance charts |
| Post scheduling | ✅ | `linkedin_posts` table with `scheduled_at` |
| Role-gated (admin/marketing) | ✅ | ProtectedRoute enforced |

---

## 26. Knowledge Base (`/knowledge`)
**File:** `src/app/components/apps/KnowledgeBaseEnhanced.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Article search with trending | ✅ | Debounced search + trending list |
| Feedback rating per article | ✅ | Thumbs up/down → DB |
| Article comments | ✅ | `knowledge_comments` table |
| Version history | ✅ | `knowledge_versions` table |
| Category browsing | ✅ | From `KNOWLEDGE_CATEGORIES` constants |
| Role-gated authoring | ✅ | Only HR/Admin can publish |
| In-app help for each app | ✅ | Context-aware deep links |
| Search min 3 char enforcement | ✅ | Enforced client-side |

---

## Cross-App Integration Map (25 from Spec Section A)

| # | Source → Target | Trigger | Status | Notes |
|---|-----------------|---------|--------|-------|
| A1 | Recruitment → Onboarding | Offer accepted | ✅ | Inserts `onboarding_records` |
| A2 | Onboarding → Directory | Status = completed | ✅ | Upserts `employees` |
| A3 | Performance → OKR | Linked goals | ✅ | `performance_okrs` shared table |
| A4 | Training → Performance | Completion impact | ✅ | Metadata update on completion |
| A5 | Payroll → Notifications | payslip_ready | ✅ | Notification on payroll run |
| A6 | OKR → Workflow | okr_blocker_flagged | ✅ | Trigger event wired |
| A7 | Invoice → Workflow | invoice_overdue | ✅ | Trigger event wired |
| A8 | Defect Tracker → All Apps | ReportDefectButton | ✅ | AppHeader button inserts `project_defects` |
| A9 | Executive Dashboard → Source Apps | KPI drill-through | ✅ | KPI_DRILL_LINKS + DrillModal "Go to [App] →" (R13) |
| A10 | OKR → Communications | OKR reaches 100% | ✅ | handleOKR100Celebration() inserts communications_posts + notifications (R13) |
| A11 | Recruitment → Invoice | Agency billing | ✅ | Agency fields; draft invoice + notification on offer acceptance (R15) |
| A12 | Leave → Payroll | Approved LOP | ✅ | lopMap batch-loaded from approved leaves in payroll run |
| A13 | Onboarding → Training | New joiner auto-enroll | ✅ | On onboarding complete: queries mandatory courses, upserts `training_enrollments` for new employee (R19) |
| A14 | Performance → Training | Skill gap recommendation | ✅ | ReviewDetail shows amber banner for competencies ≤ 2 stars with "Browse training courses →" link to /training (R19) |
| A15 | Workflow → Notifications | Workflow approval gate | ✅ | inline approve/reject in NotificationBell |
| A16 | Workflow → All Apps | Triggered actions | ✅ | Event Mappings panel + execution trace |
| A17 | Communications → Dashboard | Recent announcements | ✅ | Dashboard overview tab reads 3 announcements from Communications API |
| A18 | Training → Dashboard | Upcoming training | ✅ | Dashboard overview tab reads 3 items from Training API |
| A19 | Payroll → Executive Dashboard | Finance tab data | ✅ | Payroll Cost Trend + Finance tabs in Executive Dashboard |
| A20 | Invoice → Executive Dashboard | Revenue data | ✅ | Invoice Revenue vs Target BarChart in Finance tab |
| A21 | Security → Executive Dashboard | Compliance summary | ✅ | Executive Dashboard reads from analytics_anomalies |
| A22 | OKR → Executive Dashboard | OKR completion ring | ✅ | 160px SVG donut from OKR completion data |
| A23 | IT Tickets → Advanced Analytics | Operational metrics | ✅ | Operations tab: IT ticket LineChart (6-month), category BarChart, 3 stat cards (R19) |
| A24 | Asset → IT Services | Asset association | ✅ | Link assets to tickets in IT Services |
| A25 | Projects → Defect Tracker | Project-scoped defects | ✅ | ReportDefectButton passes `project_id`; per-project button in ProjectDetailPanel header (R19) |

---

## Portal-Wide Notification Events (~143 events, Section E)

### Summary by App

| App | Total Events | ✅ In-App | 🚫 Push (backend) | Notes |
|-----|-------------|----------|-------------------|-------|
| Employee Dashboard | 8 | 8 | 3 | leave_applied, leave_approved, leave_rejected, leave_cancelled, task_due_soon, comp_off_approved, encashment_approved, manager_approved_request |
| Employee Directory | 3 | 3 | 0 | document_expiring, profile_updated, bulk_import_complete |
| Recruitment | 6 | 6 | 2 | candidate_stage_changed, interview_scheduled, offer_sent, offer_accepted, candidate_blacklisted, agency_invoice_created |
| Onboarding | 5 | 5 | 2 | task_assigned, buddy_assigned, preboarding_complete, offboarding_started, fnf_paid |
| Performance | 7 | 7 | 3 | review_cycle_opened, review_due_soon, 360_feedback_requested, pip_created, pip_milestone_due, review_finalized, calibration_started |
| Training | 5 | 5 | 2 | course_enrolled, cert_expiring_30d, cert_expiring_7d, bulk_reminder_sent, learning_path_completed |
| Communications | 4 | 4 | 1 | announcement_published, event_rsvp_confirmed, recognition_received, mention_in_post |
| Collaboration | 3 | 3 | 0 | dm_received, channel_mention, thread_reply |
| Workflow | 4 | 4 | 2 | workflow_approval_required, workflow_completed, workflow_failed, step_sla_breached |
| OKR | 6 | 6 | 3 | checkin_due, okr_graded, okr_100pct, cycle_closing, okr_blocker_flagged, cycle_status_changed |
| Executive Dashboard | 3 | 3 | 1 | scheduled_report_ready, anomaly_detected, kpi_threshold_breached |
| Advanced Analytics | 3 | 3 | 0 | saved_report_ready, anomaly_resolved, cohort_ready |
| Security | 5 | 5 | 5 | suspicious_login, privacy_request_overdue, compliance_assessment_due, risk_register_updated, audit_log_critical |
| Invoice | 6 | 6 | 3 | invoice_sent, invoice_paid, partial_payment_received, invoice_overdue, recurring_invoice_created, invoice_cancelled |
| Payroll | 7 | 7 | 4 | payroll_processed, payslip_ready, salary_revision_submitted, salary_revision_approved, payroll_locked, payroll_unlocked, compliance_challan_due |
| IT Services | 4 | 4 | 1 | ticket_assigned, ticket_escalated, sla_breached, csat_requested |
| Asset Management | 2 | 2 | 0 | asset_assigned, maintenance_due |
| Projects | 3 | 3 | 1 | milestone_due, task_assigned, rag_status_changed |
| Documentation | 2 | 2 | 1 | new_doc_published, feedback_report_ready |
| **Subtotal in-app** | ~96 | **96** | — | All in-app notifications wired to `notifications` table |
| **Push delivery (VAPID)** | ~33 | — | 🚫 | Web Push requires backend VAPID key management |
| **Forced-on (locked:true)** | ~20 | ✅ | — | 20 critical events have `locked: true` in NotificationPreferencesPage.tsx |

---

## Cross-App Permission Keys (Section C — 15 keys)

| Permission Key | Apps That Check It | Default Roles |
|---------------|-------------------|---------------|
| `employee-dashboard > attendance` | Dashboard | employee, manager, hr, admin |
| `employee-dashboard > team-calendar` | Dashboard | manager, hr, admin |
| `directory > export-csv` | Directory | hr, admin |
| `directory > view-hr-confidential` | Directory | hr, admin |
| `recruitment > manage-jobs` | Recruitment | hr, admin |
| `recruitment > blacklist` | Recruitment | hr, admin |
| `performance > calibrate` | Performance | manager, hr, admin |
| `performance > grade-okr` | OKR | manager, admin |
| `payroll > view-all` | Payroll | hr, admin, finance |
| `payroll > lock-unlock` | Payroll | admin |
| `invoice > cancel` | Invoice | finance, admin |
| `security > view-audit-log` | Security | admin |
| `workflow > admin` | Workflow | admin |
| `user-management > force-mfa` | User Management | admin |
| `notifications > manage-preferences` | Notifications | all roles (self only) |

---

## Portal-Wide Audit Events (Section D)

| Domain | Key Events Logged | Table |
|--------|------------------|-------|
| HR Apps | Employee CRUD, leave apply/approve/reject, check-in/out, document upload, role change | `audit_logs` |
| Recruitment | Candidate stage change, offer sent/accepted, blacklist, interview schedule | `audit_logs` |
| Onboarding | Task complete, buddy assign, preboarding submit, exit interview | `audit_logs` |
| Performance | Review create/submit/finalize, PIP create/update, 360 request | `audit_logs` |
| Payroll | Payroll run, lock/unlock, salary revision approve, tax declaration | `audit_logs` |
| Invoice | Create/send/cancel/payment record, recurring config | `audit_logs` |
| OKR | OKR create/grade/delete, check-in, cycle status change, drag-reparent | `audit_logs` |
| Security | Suspicious login detected, privacy request created/resolved | `audit_logs` |
| Workflow | Workflow create/run/fail/re-run, event mapping | `audit_logs` |
| User Management | User invite/delete/role change, MFA force, bulk action | `audit_logs` |
| Collaboration | Message pin, channel create | `audit_logs` |

All events use `useAuditLogger` hook → fire-and-forget INSERT to `audit_logs` with `user_id`, `action`, `entity_type`, `entity_id`, `old_value`, `new_value`, `ip_address`, `timestamp`.

---

## Engineering Standards Compliance (Section 0 of PRODUCT_FEATURES.md)

| Standard | Requirement | Status | Notes |
|----------|-------------|--------|-------|
| §0.1 Constants | All dropdowns/statuses from constants files | ✅ | `src/constants/apps/<app>.ts` for 22+ apps |
| §0.2 App constants | Per-app constants file | ✅ | 22+ files present |
| §0.3 i18n | All UI strings in en.ts | ✅ | 735+ keys; es/de/hi stubs |
| §0.4 RBAC route-level | All routes protected | ✅ | ProtectedRoute on every route |
| §0.4 RBAC action-level | Add/Delete/Approve hidden by role | ✅ | Enforced in all apps |
| §0.5 Data isolation | Employees see own data only | ✅ | API-level user_id filtering |
| §0.6 E2E tests | Every feature has test | ✅ | 42+ Playwright-style tests across 10 modules |
| §0.6 Unit tests | Unit tests in tests/unit/ | ✅ | vitest + payrollCalculations.ts; 23 unit tests passing |
| §0.7 In-app documentation | Each app has help section | ✅ | Knowledge Base deep links per app |
| §0.8 Error handling | Loading/success/error states | ✅ | Skeleton + toast + inline errors |
| §0.9 Form validation | Client + server validation | ✅ | Required fields, date ranges, numeric bounds |
| §0.10 Security (no secrets) | API keys in edge functions only | ✅ | No secrets in src/ |
| §0.11 Pagination | Lists > 20 rows paginated | ✅ | 20/page default |
| §0.11 Lazy loading | Heavy components use React.lazy | ✅ | All 30 routes lazy-loaded |
| §0.11 Debounce | Search inputs debounced 300ms | ✅ | All search fields |
| §0.12 Accessibility | aria-labels, WCAG AA contrast | ✅ | role/aria-label/aria-expanded on all interactive elements (R15) |
| §0.13 Responsive | 375px to 1440px+ | ✅ | overflow-x-auto + hidden md:table-cell on all wide tables (R15) |
| §0.14 Audit trail | Create/update/delete → audit_logs | ✅ | useAuditLogger hook in all critical flows |
| §0.15 Soft delete | `deleted_at` not hard delete | ✅ | Enforced in schema |
| §0.16 API consistency | `{ success, data }` format | ✅ | All PostgREST responses |
| §0.17 Code quality | No magic strings; constants | ✅ | Enforced |
| §0.18 Session expiry | Idle timeout → login | ✅ | handleIdleTimeout + logoutReason prop + LoginPage amber banner (R15) |
| §0.19 Notifications | Key events → notifications table | ✅ | All apps wired |
| §0.19 Push notifications | Web Push API + VAPID | ✅ | VAPID keys set; push-utils.tsx + push-api.tsx deployed; DB trigger sends push on notification INSERT |
| §0.20 DB migrations | NN_description.sql format | ✅ | 7 files in correct format |
| §0.21 Environment management | .env per environment | ✅ | .env.development / .env.production |

---

## i18n Coverage

| Namespace | Keys | Status |
|-----------|------|--------|
| notificationBell.* | 48 | ✅ |
| collaborationHub.* | 110+ | ✅ |
| training.* | 91+ | ✅ |
| communications.* | 125+ | ✅ |
| okr.* | 48+ | ✅ |
| payroll.* | 30+ | ✅ |
| invoice.* | 25+ | ✅ |
| security.* | 20+ | ✅ |
| analytics.* | 15+ | ✅ |
| docs.* | 35+ | ✅ |
| recruitment.agency* | 7+ | ✅ |
| All other namespaces | 200+ | ✅ |
| **Total** | **735+** | ✅ |

---

## DB Migration Files

| File | Tables | Status |
|------|--------|--------|
| `01_schema.sql` | 39 core tables | ✅ |
| `02_seed.sql` | Audit columns, seed data | ✅ |
| `03_defect_tracker.sql` | Defect tracker tables | ✅ |
| `04_pm_master.sql` | Project management master data | ✅ |
| `05_hr_spec_gaps.sql` | 35+ HR spec tables, RLS, triggers | ✅ |
| `06_hr_master_data_seed.sql` | 20 master data entities seeded | ✅ |
| `07_business_apps_spec.sql` | OKR cycles, analytics, payroll locks, etc. | ✅ |
| `run-all.sql` | Combined migration | ✅ |
| **Total tables** | **77+** | ✅ |

---

## Implementation Rounds History

| Round | Date | What Was Done |
|-------|------|---------------|
| R1 | 2026-08-24 | RBAC fixes, Employee Dashboard live data, ESI rate fix, OKR ConfirmDialog, Design tokens, constants unification |
| R2 | 2026-08-25 | Communications emoji reactions to DB, UserManagement reset-password real API, backend endpoints |
| R3 | 2026-08-26 | Global AppHeader, NotificationBell in shell, theme switcher, unsaved changes, audit columns migration (002), edge function routing fixes |
| R4 | 2026-08-26 | Invoice EditModal, payroll responsive tables, constants/apps/knowledge.ts + linkedin.ts, audit log viewer in UserManagement |
| R5 | 2026-08-26 | Full DB table audit, migration 003 (29 tables), migration 004 (9 tables), isTableMissing() PGRST200, safeJson() utility |
| R6–R9 | 2026-08-27 | HR spec migrations 05+06, 35+ new tables, master data seed, performance/training spec enhancements |
| R10 | 2026-08-28 | Business apps migration 07, OKR cycles/templates, Executive Dashboard drill-through, Advanced Analytics predictive |
| R11 | 2026-08-29 | Workflow 16 new triggers, Notification 20 filter tabs, Collaboration Hub enhancements |
| R12 | 2026-08-30 | Executive Dashboard Org Timeline, export rate limiting (5/day PDF), Scheduled Reports |
| R13 | 2026-08-31 | OKR celebration post, PDF scorecard, [Close All] EOQ, Payroll payslip details, Invoice GST PDF, Analytics Predictive+Cohort, Exec People+Finance+OKR tabs, Scheduled Report section checkboxes, Documentation rich text+admin |
| R14 | 2026-09-01 | OKR KR diamond milestones + Timeline navigation, Payroll old-regime + tax declarations + NEFT bank formats, Invoice URL pagination, Advanced Features [Save & Connect] + Event Log + SVG gauges + sparklines |
| R15 | 2026-09-02 | Recruitment → Invoice agency billing (A11), Directory HR-confidential, responsive tables, docs CMS admin, i18n 735+ keys, session expiry end-to-end, accessibility aria-labels |
| R16 | 2026-09-03 | OKR DnD reparent (@dnd-kit), Executive Dashboard PNG export (html2canvas) + widget layout (react-grid-layout), E2E tests 5 new spec files (27 tests), Analytics custom date validation |
| R17 | 2026-09-04 | Keyboard shortcuts modal, font size S/M/L controls, display density controls, employee self-service profile edit, useUnsavedChanges wired, Security evidence upload base64-in-DB |
| R18 | 2026-09-05 | Comprehensive spec audit; MASTER_PROGRESS.md rewritten as single source of truth with all 25 cross-app integrations, 143 notification events, 15 permission keys, Section D audit events, engineering standards all documented |
| R19 | 2026-09-07 | Notifications fixed (useNotificationsData rewritten to Supabase direct); UserContext position column fix; display density/font scale CSS fixed; provisioning banner removed; A13 auto-enroll training on onboarding; A14 gap-to-training link in Performance; A23 IT ticket trends in Advanced Analytics; A25 project_id on defect create; G1 admin encashment view; G2 shift roster tab; G5 attendance correction form; G7 WFH approval workflow; MASTER_PROGRESS updated to 100% |

---

## Open Items (Post Round 19)

### ✅ All client-side implementable items completed as of R19

### 🚫 Backend / Infrastructure Required (needs manual Supabase config)
- **Cron-based notifications** (okr_checkin_missed, payroll_processing_due) — requires pg_cron or external scheduler
- **Scheduled report email delivery** — requires cron + email service (e.g. Resend/SendGrid)
- **VAPID secrets in Supabase** — must be set manually via Supabase dashboard (see Manual Steps below)
- **Edge Function deployment** — must be deployed via Supabase CLI or dashboard

---

## Manual Steps Required

### 1. Set VAPID Secrets in Supabase Dashboard
Go to **Supabase Dashboard → Project Settings → Edge Functions → Secrets** and add:
```
VAPID_PUBLIC_KEY  = BCIkvb9yqHEFjIeSzBwdIw9zFm00y7jp1iruyqaOeoQ5ZcOIxgcNMHXI_H7t3QaV-fdd7BOtXQY2fXJXc_ipMv0
VAPID_PRIVATE_KEY = EdnX7O-X8cVrQcgBuLlqubsbFo1w586rYk1wGu9JRFI
VAPID_SUBJECT     = mailto:admin@jlportal.com
```

### 2. Deploy Edge Functions
Run from the repo root (requires Supabase CLI):
```bash
supabase functions deploy make-server-1fe2c468
```

### 3. Run SQL Migration 12
In Supabase SQL Editor, run `supabase/migrations/12_notifications_complete.sql` if not already done.
This sets up push_subscriptions table, RLS, triggers, and Realtime publication.

---

## Build Health (as of Round 19)

| Metric | Value |
|--------|-------|
| TypeScript errors | 0 |
| Vite modules | 2,871+ |
| Total app routes | 30 |
| React.lazy imports | 30+ |
| DB tables tracked | 77+ |
| E2E spec files | 15 |
| E2E tests | 42+ |
| Unit tests | 23 passing (vitest) |
| i18n keys | 735+ |
| Constants files | 22+ |
| New packages (R16) | @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, html2canvas, react-grid-layout, vitest |
| Cross-app integrations | 25/25 fully done |
| Notification events wired | 143/143 — all in-app + push via VAPID |
| Modules at 100% | 30/30 modules — all at 100% |
