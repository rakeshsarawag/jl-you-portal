# App Blueprints — Current State

> **Purpose:** Authoritative current-state blueprint for 11 apps before spec-driven enhancement.
> **Last Updated:** 2026-09-04
> **Scope:** Employee Dashboard, Employee Directory, Recruitment, Onboarding, User Management, Performance, Training, Communications, Collaboration, Workflow Automation, Notification Bell

---

## How to Read This Document

Each app section contains:
- **File & Route** — exact path in codebase
- **Screens / Tabs** — what exists today
- **Data Layer** — DB tables, API endpoints, hooks
- **State Inventory** — key React state variables
- **Known Gaps** — confirmed missing or broken features

---

## 1. Employee Dashboard

**File:** `src/app/components/apps/EmployeeDashboardEnhancedV2.tsx` (1,929 lines)
**Hook:** `useEmployeeDashboard`
**Route:** `/dashboard`
**DB Tables:** `employees`, `attendance`, `leaves`, `leave_balances`

### Screens & Tabs

| Tab ID | Label | Who Sees It |
|--------|-------|-------------|
| `overview` | Overview | All roles |
| `attendance` | Attendance | Permission-gated (`employee-dashboard > attendance`) |
| `leaves` | My Leaves | All roles |
| `approvals` | Approvals *(badge count)* | Manager / HR only |
| `tasks` | Tasks | All roles |
| `holidays` | Holidays | All roles |
| `calendar` | Team Calendar | Manager + team-calendar permission |

### Features Implemented

**Overview Tab**
- Clock In / Clock Out with timestamp
- WFH / On-site toggle
- Attendance summary strip (present, absent, late, WFH counts for current month)
- Quick stats: leave balance per type
- Upcoming holidays carousel (next 3)
- Recent announcements (reads from Communications API — 3 items)
- Upcoming training (reads from Training API — 3 items)
- Manager name display

**Attendance Tab**
- Monthly calendar heatmap (green = present, amber = late, red = absent, blue = WFH)
- Attendance history table with check-in/out timestamps
- Late arrival and early exit badges

**Leaves Tab**
- Leave balance cards per leave type (earned, sick, casual, etc.)
- Apply for leave form (type, date range, reason, attachment note)
- Leave history list with status chips
- Cancel pending leave action
- Withdraw approved leave (with confirmation)
- Leave encashment request form + history (employee-facing)

**Approvals Tab** *(Manager / HR only)*
- Pending leave requests from direct reports
- Approve / Reject with optional comment
- Pending task count badge on tab

**Tasks Tab**
- Personal task list (create, toggle complete, delete)
- Task priority indicator (Low / Medium / High / Urgent)
- Due date with overdue highlight
- Task edit modal

**Holidays Tab**
- Full year holiday list (public + restricted holidays)
- Month filter

**Team Calendar Tab** *(Manager only)*
- Month grid view
- Team leaves plotted as colored chips per date
- Navigate months (prev / next)

### API Endpoints Used

```
GET/POST   /employee-dashboard/attendance
POST       /attendance/check-in
POST       /attendance/check-out
GET        /attendance/today/{userId}
GET        /attendance/{userId}
GET/POST   /employee-dashboard/leaves/{userId}
POST       /leaves/apply
PUT        /leaves/approve
PUT        /leaves/reject
GET        /leaves/pending
GET        /employee-dashboard/leave-balance/{userId}
POST       /leave-balance/initialize
GET        /employee-dashboard/manager/{userId}
GET/POST/PUT/DELETE /employee-dashboard/tasks/{userId}
POST       /notifications          ← fires to manager on leave apply
GET        /training?userId=...&limit=3
GET        /communications/announcements?limit=3
```

### Key State Variables

```
tab, workMode, showLeaveForm, showTaskForm, editingTask, deletingTask,
leaveFilter, approvalTarget, cancellingLeaveId, withdrawTarget,
holidays, encashmentRequests, showEncashForm, encashForm,
managerName, elevatedStats, calendarMonth, teamLeaves
```

### Known Gaps

| # | Gap | Severity |
|---|-----|----------|
| G1 | No admin view for all employees' leave encashments — only the employee's own requests are shown | Medium |
| G2 | No shift schedule or roster view — attendance is free-form check-in/out only | Medium |
| G3 | No payslip panel in dashboard (payroll is fully separate) | Low |
| G4 | Team Calendar visible to managers only; employees see no calendar at all | Low |
| G5 | Attendance correction / regularisation request not implemented | Medium |
| G6 | No overtime / comp-off tracking | Low |
| G7 | No WFH request workflow — WFH toggle is self-service without manager approval | Medium |

---

## 2. Employee Directory

**File:** `src/app/components/apps/EmployeeDirectoryEnhanced.tsx` (1,798 lines)
**Hook:** `useDirectoryData`
**Route:** `/directory`
**DB Tables:** `employees`

### Screens & View Modes

| View Mode | Description |
|-----------|-------------|
| `list` | Searchable table with inline actions |
| `card` | Grid of avatar cards |
| `orgchart` | Recursive tree by `reports_to` hierarchy |

### Employee Detail Drawer Tabs

| Tab | Content |
|-----|---------|
| `profile` | Full profile: name, dept, designation, manager, join date, skills, lifecycle status |
| `documents` | Upload / list employee documents (type, file name, notes) — metadata only |
| `emergency` | Emergency contact (name, phone, email, relationship) — editable inline |

### Features Implemented

- Add employee modal (full form, ComboBox dropdowns from MasterData)
- Edit employee modal (all fields)
- Delete with confirmation dialog
- Bulk import via CSV with validation + result summary
- Search by name / department / designation
- Filter chips: department, location, status
- Org chart: recursive tree rendering from `reports_to` field
- Employee lifecycle status badge (Active, Inactive, Probation, Exit)
- Skills tags per employee

### API Endpoints Used

```
GET/POST/PUT/DELETE ${API_BASE}/directory/employees
GET/POST/PUT/DELETE ${API_BASE}/directory/employees/{id}/documents
GET/POST/PUT        ${API_BASE}/directory/employees/{id}/emergency-contact
```

### Key State Variables

```
viewMode (list|card|orgchart), showForm, showBulkUpload,
editingEmployee, deletingId, selectedEmployee, query,
deptFilter, locationFilter, statusFilter
```

### Known Gaps

| # | Gap | Severity |
|---|-----|----------|
| G1 | Org chart is read-only rendering — no drag-to-reassign reporting line | Medium |
| G2 | Document upload stores metadata only (file name / size as text) — no actual file binary stored in Supabase Storage | High |
| G3 | No CSV export from directory | Medium |
| G4 | No column picker / configurable table columns | Low |
| G5 | No history / audit trail of profile changes per employee | Medium |
| G6 | No "on-leave today" badge on employee cards | Low |
| G7 | Birthday / anniversary reminder not surfaced in directory (only in launchpad) | Low |

---

## 3. Recruitment

**File:** `src/app/components/apps/RecruitmentTrackerEnhancedV3.tsx` (2,344 lines)
**Hook:** `useRecruitmentData`
**Route:** `/recruitment`
**DB Tables:** `recruitment_candidates`, `recruitment_jobs`, `recruitment_interviews`, `recruitment_feedback`

> **Note:** `RecruitmentTrackerEnhancedV2.tsx` (875 lines) is **dead code** — not imported anywhere; safe to delete.

### Screens & Tabs

| Tab | Content |
|-----|---------|
| `pipeline` | Kanban-style candidate cards per stage; candidate detail drawer |
| `jobs` | Job postings list; create / edit / delete job form |
| `analytics` | Stage funnel, time-to-hire chart, department hire breakdown |

### Candidate Detail Drawer Sub-tabs

| Sub-tab | Content |
|---------|---------|
| `info` | Full candidate profile (name, source, position, dept, notice period, expected CTC, etc.) |
| `interviews` | Interview schedule list; add interview modal (date, time, interviewer, meeting link) |
| `feedback` | Structured scorecard feedback form (ratings per criterion, recommendation) |
| `attachments` | Attachment name + URL list; add attachment form |

### Features Implemented

- Kanban board by recruitment stage (Applied → Screening → Interview → Offer → Hired / Rejected)
- Drag stage — click action to move to next stage (no drag-and-drop)
- Stage filter chips (filter candidates by current stage)
- Search by name / position
- Bulk upload candidates via CSV
- Duplicate detection (email / phone / name similarity) — warning badge on candidate
- Job posting management: create/edit/delete job with status (Open / On Hold / Filled)
- Analytics: stage funnel (client-side), avg time-to-hire, dept breakdown
- **On "Hire":** auto-posts to `${API_BASE}/onboarding/employees` to create onboarding record

### API Endpoints Used

```
GET/POST/PUT/DELETE ${API_BASE}/recruitment/candidates
GET/POST/PUT/DELETE ${API_BASE}/recruitment/jobs
POST ${API_BASE}/recruitment/candidates/{id}/interviews
POST ${API_BASE}/recruitment/candidates/{id}/feedback
POST ${API_BASE}/onboarding/employees   ← on Hire action
```

### Key State Variables

```
activeTab, stageFilter, search, showCandidateForm, editingCandidate,
selectedCandidateId, confirmDelete, confirmHire, showBulkUpload,
showJobForm, editingJob, viewingJobId
```

### Known Gaps

| # | Gap | Severity |
|---|-----|----------|
| G1 | No email or calendar integration — interview scheduling stores URL only | High |
| G2 | No offer letter generation within Recruitment (flows into Onboarding but no template builder here) | Medium |
| G3 | Analytics computed entirely client-side — no server-side aggregation | Medium |
| G4 | No requisition approval workflow before job goes live | Medium |
| G5 | No source-of-hire tracking on candidates (LinkedIn / referral / job portal) in analytics | Low |
| G6 | No candidate communication log (who called / emailed candidate and when) | Medium |
| G7 | Feedback scorecard is unstructured — no per-role competency framework | Medium |
| G8 | Dead code: `RecruitmentTrackerEnhancedV2.tsx` must be deleted | Low |

---

## 4. Onboarding

**File:** `src/app/components/apps/OnboardingPortalEnhancedV2.tsx` (1,656 lines)
**Hook:** `useOnboardingData`
**Route:** `/onboarding`
**DB Tables:** `onboarding_records`, `onboarding_tasks`, `onboarding_documents`, `onboarding_welcome_kits`

### Screens & View Modes

| Mode | Description |
|------|-------------|
| `list` | Searchable table of onboarding candidates |
| `kanban` | Board by onboarding stage |

### Candidate Detail Drawer Tabs

| Tab | Content |
|-----|---------|
| `checklist` | Per-candidate task checklist (toggle complete, busy-state per item) |
| `documents` | Document list + digital signature canvas pad |
| `welcome-kit` | Welcome message, buddy assignment, IT access provisioning status |

### Features Implemented

- Add onboarding record manually or sync from Recruitment (hired candidates)
- Kanban board by stage (Documents Pending → HR Verification → IT Setup → Completed)
- Per-task checklist with completion toggle (persisted to API)
- Digital signature canvas: employee can draw signature → stored as metadata
- Probation tracking: confirmation dialog when probation date passes
- Buddy assignment: ComboBox over employee list
- "Enable Access" action: calls API → returns temp login + email for new joiner
- Bulk upload via CSV
- `sourceFilter` toggle (show only recruitment-sourced hires vs manually added)

### API Endpoints Used

```
GET/POST/PUT/DELETE ${API_BASE}/onboarding/employees
POST ${API_BASE}/onboarding/employees/bulk-upload
POST ${API_BASE}/onboarding/employees/{id}/enable-access
PUT  ${API_BASE}/onboarding/employees/{id}/tasks/{taskId}
GET  ${API_BASE}/onboarding/employees/{id}/signature-requests
POST ${API_BASE}/onboarding/employees/{id}/request-signature
```

### Key State Variables

```
view (list|kanban), showForm, editingEmployee, detailEmployee,
deleteTarget, enableTarget, search, sourceFilter, tab,
confirmSync, confirmAccess, accessResult, busyTask,
confirmingProbation, showAssignBuddy, sigRequests,
signingRequest, requestingDocId
```

### Known Gaps

| # | Gap | Severity |
|---|-----|----------|
| G1 | Digital signatures stored as metadata only — no PDF embedding or DocuSign integration | High |
| G2 | Welcome kit tab is static text/decoration — no automated email to new joiner | Medium |
| G3 | No automated email workflow on "Enable Access" beyond returning temp credentials | Medium |
| G4 | No offboarding module — onboarding only handles the inward journey | High |
| G5 | No pre-boarding portal (candidate-facing link before Day 1) | Medium |
| G6 | Checklist templates are not configurable per department / role | Medium |
| G7 | No IT ticket auto-creation for hardware provisioning on Enable Access | Medium |

---

## 5. User Management

**File:** `src/app/components/apps/UserManagement.tsx` (1,232 lines)
**Hook:** `useUserManagement`
**Route:** `/user-management`
**DB Tables:** `app_users`, `audit_logs` (via Supabase Auth for signUp / passwordReset)

### Screens & Tabs

| Tab | Content |
|-----|---------|
| `users` | User list; create / edit / deactivate / delete; bulk role assignment |
| `audit` | Audit log viewer — searchable by user / action / detail |

### Features Implemented

- Create user: picks from un-activated employees; assigns roles; sets password (custom or auto-generated)
- Edit user: name, department, job title
- Role change modal: multi-select role assignment
- Password reset: `supabase.auth.resetPasswordForEmail`
- Deactivate / delete with confirmation dialogs
- Bulk role assignment: select multiple users → assign role
- Audit log: expandable rows showing before/after JSON diff
- Filter: by role, by status (Active / Inactive)

### API Endpoints Used

```
GET/POST/PUT/DELETE ${API_BASE}/users
supabase.auth.signUp(...)             ← direct Supabase Auth
supabase.auth.resetPasswordForEmail(...)  ← direct Supabase Auth
```

### Key State Variables

```
activeTab, search, filterRole, filterStatus,
showCreateForm, editingUser, roleModalUser, resetPwUser,
confirmAction, selectedUsers, bulkRole, bulkAssigning,
logs, auditSearch, actionFilter, expandedId
```

### Known Gaps

| # | Gap | Severity |
|---|-----|----------|
| G1 | No MFA / 2FA configuration panel | Medium |
| G2 | Audit log is read-only — no CSV export | Low |
| G3 | "Deactivate" vs "Delete" distinction unclear in UX; no disabled visual state in user list | Medium |
| G4 | No session management — cannot force-logout a specific active user | Medium |
| G5 | No "last login" column in user list | Low |
| G6 | No self-service profile edit (users cannot update their own profile picture / phone) | Medium |
| G7 | No invitation-by-email flow — user must be created by admin directly | Medium |

---

## 6. Performance Tracker

**File:** `src/app/components/apps/PerformanceTrackerEnhancedV2.tsx` (1,821 lines)
**Hook:** `usePerformanceData`
**Route:** `/performance`
**DB Tables:** `performance_reviews`, `performance_goals`, `performance_feedback`, `performance_pips`

### Screens & Tabs

| Tab | Content |
|-----|---------|
| `reviews` | Performance review list; create / edit / view; self-assessment sub-panel |
| `goals` | Goal list with progress %; create / edit goals |
| `feedback` | 360° feedback list; create feedback form |
| `pips` | Performance Improvement Plans list; create / edit PIPs |
| `analytics` | Rating distribution, goal completion, department average charts |
| `cycles` | Review cycle management; calibration grid |

### Features Implemented

**Reviews**
- Create / edit review: employee, review period, overall rating (star picker), qualitative comments
- Self-assessment text field inline on review detail
- Filter by period, search by employee name

**Goals**
- Create goal: title, description, target date, progress %
- Edit progress slider
- Status: On Track / At Risk / Behind / Completed

**360° Feedback**
- Create feedback: select reviewer + reviewee, write feedback, rate overall
- List view by reviewer

**PIPs**
- Create PIP: employee, start/end date, improvement areas, milestones text, support plan
- PIP status: Active / Completed / Extended / Closed

**Analytics**
- Rating distribution bar chart (client-side)
- Goal completion by department
- Average rating by department heatmap

**Cycles**
- Create review cycle (name, period start/end, type: annual/mid-year/quarterly)
- Calibration grid: table of all employees in cycle, editable manager rating override per row

### API Endpoints Used

```
GET/POST/PUT/DELETE ${API_BASE}/performance/reviews
GET/POST/PUT/DELETE ${API_BASE}/performance/goals
GET/POST/DELETE     ${API_BASE}/performance/feedback360
GET/POST/PUT/DELETE ${API_BASE}/performance/pips
GET/POST/PUT        ${API_BASE}/performance/cycles
```

### Key State Variables

```
tab, periodFilter, search, reviewFormOpen, editingReview, viewingReview,
goalFormOpen, editingGoal, feedbackFormOpen, feedbackTarget,
pipFormOpen, editingPIP, confirmState,
cycles, cyclesLoading, calibrations
```

### Known Gaps

| # | Gap | Severity |
|---|-----|----------|
| G1 | Calibration grid has no bulk submission or "Finalize Cycle" action — saves row by row only | Medium |
| G2 | No automated notification to employee / manager when PIP is created | Medium |
| G3 | 360° feedback has no workflow gating — anyone can give feedback on anyone | Medium |
| G4 | No bell-curve forced distribution enforcement in calibration | Low |
| G5 | No rating history trend chart (employee score over time across multiple cycles) | Medium |
| G6 | Self-assessment is a text field only — no structured form per competency | Medium |
| G7 | No analytics export (CSV / PDF) | Low |
| G8 | Peer review requests not tracked — no "pending my feedback" queue for reviewees | High |

---

## 7. Training Tracker

**File:** `src/app/components/apps/TrainingTrackerEnhanced.tsx` (1,972 lines)
**Hook:** `useTrainingData`
**Route:** `/training`
**DB Tables:** `training_courses`, `training_enrollments`, `training_certificates`

### Screens & Tabs

| Tab | Content |
|-----|---------|
| `my-training` | Employee's own enrollments: progress, status, certificate download |
| `catalogue` | Full course catalogue; enroll action; search + category filter |
| `team` | Manager's team enrollment view (filter by employee, category, status) |
| `compliance` | Mandatory course tracking (role-gated) |
| `learning-paths` | Learning path browse + enroll; admin: create path |

### Features Implemented

- Course CRUD: title, description, category, duration, provider, level, mandatory flag
- Enroll in a course: select employee + course + due date
- Progress update: slider per enrollment (saves %)
- Auto-certificate: `PUT /progress` with 100% triggers certificate record
- Certificate download: API call returning URL
- Team enrollment view: manager sees all direct reports, filterable
- Compliance tab: list of employees with overdue mandatory courses
- Learning paths: browse path cards; create path (title, courses list, target role, estimated hours)

### API Endpoints Used

```
GET/POST/PUT/DELETE ${API_BASE}/training/courses
GET/POST/DELETE     ${API_BASE}/training/enrollments
PUT                 ${API_BASE}/training/enrollments/{id}/progress
GET                 ${API_BASE}/training/enrollments/{id}/certificate
```

### Key State Variables

```
activeTab, search, catFilter, teamEmpFilter, teamCatFilter, teamStatusFilter,
progressEnrollment, showCourseForm, editCourse,
showEnrollTeam, confirmDelete, confirmUnenroll,
paths (local useState — NOT persisted), pathEnrollments (local)
```

### Known Gaps

| # | Gap | Severity |
|---|-----|----------|
| **G1** | **Learning paths are in-memory only (`useState`) — not persisted to any API. Page refresh loses all paths.** | **Critical** |
| G2 | Certificate generation is API-side but no template or design is visible — front end only gets a URL | Medium |
| G3 | Compliance tab has no reminder / escalation email feature | Medium |
| G4 | No pre-built course content / SCORM player — external URLs only | Low |
| G5 | No training needs analysis tool (gap between required vs completed per role) | Medium |
| G6 | No manager approval step before employee self-enrolls in non-mandatory courses | Low |
| G7 | No expiry / renewal tracking for time-limited certifications | Medium |

---

## 8. Communications Hub

**File:** `src/app/components/apps/InternalCommunicationsHubEnhanced.tsx` (1,134 lines)
**Hook:** `useCommunicationsData`
**Route:** `/communications`
**DB Tables:** `communications_posts` (posts, announcements, events, polls, channels — all via same API)

### Screens & Tabs

| Tab | Content |
|-----|---------|
| `Feed` | Social-style post feed; compose post; emoji reactions; comment threads |
| `Announcements` | Create / edit / delete announcements; audience targeting; priority |
| `Events` | Create / delete company events (title, date, location, description) |
| `Polls` | Create polls with N options; vote; view results bar chart |
| `Channels` | Create public/private channel; list channels |
| `Analytics` | Post performance table + engagement stats (admin-gated) |

### Features Implemented

**Feed**
- Compose post with text + optional audience (All / Dept)
- Emoji reactions with per-emoji count + per-user state
- Comment thread per post: expand / collapse, add reply
- Pin / unpin post (admin)
- Search posts (client-side filter)

**Announcements**
- Create announcement: title, body, audience (All / department), priority (Low / Medium / High / Critical)
- Edit / delete (admin only)
- `POST /notifications` fired on announcement create
- Priority color badges

**Events**
- Create event: title, date, location, description
- Delete event
- No RSVP / attendee list yet

**Polls**
- Create poll: question + N options (add/remove option)
- Vote on a poll option
- View results as horizontal bar chart (% per option)

**Channels**
- Create channel: name, description, type (public / private)
- List all channels with member count badge

**Analytics** *(admin only)*
- Table of posts with: author, date, views, reactions, comment count
- No chart rendering — table format only

### API Endpoints Used

```
GET/POST/PUT/DELETE ${API_BASE}/communications/posts
GET/POST/PUT/DELETE ${API_BASE}/communications/announcements
GET/POST/DELETE     ${API_BASE}/communications/events
GET/POST/PUT        ${API_BASE}/communications/polls
GET/POST            ${API_BASE}/communications/channels
POST                ${API_BASE}/notifications
```

### Key State Variables

```
activeTab, postContent, showAnnouncementModal, showEventModal,
showPollModal, showChannelModal,
rxnCounts, userRxns, expandedComments, commentsCache,
commentInput, commentPosting
```

### Known Gaps

| # | Gap | Severity |
|---|-----|----------|
| G1 | Channels tab only lists/creates channels — no in-channel messaging UI (that lives in Collaboration Hub) | High |
| G2 | Analytics is a plain table — no chart rendering | Medium |
| G3 | No direct-message feature | Medium |
| G4 | Event RSVP / attendee management not implemented | Medium |
| G5 | No file / image attachment on posts | Medium |
| G6 | No read-receipt tracking — reactions system is the only engagement signal | Medium |
| G7 | No scheduled post / publish-at-date feature | Low |
| G8 | No @mention support in post composer | Low |

---

## 9. Collaboration Hub

**File:** `src/app/components/collaboration/CollaborationHub.tsx` (624 lines)
**Services:** `ChatService` (localStorage), `FileSharingService` (localStorage)
**Route:** `/collaboration-hub`
**DB Tables:** ⚠️ **None — all data is localStorage only, not server-persisted**

### Screens & Layout

**Left panel:** Channel list sidebar
**Right panel:** Per-selected-channel tabbed view

| Tab | Content |
|-----|---------|
| `chat` | Message thread; emoji reactions; message input box |
| `files` | Shared files list; file search; upload metadata |
| `activity` | Activity feed for the channel |

### Features Implemented

- Channel create modal (name, description, public / private)
- Member count badge per channel
- Message list with sender avatar, timestamp
- Emoji reaction on messages
- File "upload" metadata entry (name, size, type, uploader) — no binary storage
- File search (client-side filter over localStorage)
- Activity feed (stub entries per channel)

### Data Layer

```
ChatService      → localStorage-backed singleton. No server calls.
FileSharingService → localStorage-backed singleton. No server calls.
```

### Key State Variables

```
channels, selectedChannel, messages, messageInput, users,
activityFeed, sharedFiles, searchQuery, showChannelModal,
showFileUpload, newChannelName, newChannelDesc, channelType
```

### Known Gaps

| # | Gap | Severity |
|---|-----|----------|
| **G1** | **All chat data is localStorage-only — not shared between users, lost on browser clear, no real-time sync** | **Critical** |
| **G2** | **No server-side persistence — this feature is essentially non-functional in a multi-user environment** | **Critical** |
| G3 | No Supabase Realtime / WebSocket subscription for live message delivery | Critical |
| G4 | No direct message (DM) threads — channels only | High |
| G5 | File upload stores metadata only — no binary file storage | High |
| G6 | No member management (add / remove members from channel) | High |
| G7 | No message search across channels | Medium |
| G8 | No typing indicators, online presence, or read receipts | Medium |
| G9 | No thread / reply on individual messages | Low |
| G10 | No integration with Communications Hub channels | Medium |

---

## 10. Workflow Automation

**Files:**
- `src/app/components/workflows/WorkflowDashboard.tsx` (837 lines) — main entry point
- `src/app/components/workflows/WorkflowBuilder.tsx` (533 lines) — modal step builder

**Hook:** `useWorkflow`
**Route:** `/workflow-dashboard`

### WorkflowDashboard Tabs

| Tab | Content |
|-----|---------|
| `overview` | KPI cards (total, active, running instances, pending approvals); recent instances |
| `workflows` | Workflow definition list; create / edit / delete / activate / deactivate; manual trigger |
| `templates` | Pre-built template library; install to create new workflow from template |
| `instances` | All running / completed / failed / cancelled instances; cancel action |
| `analytics` | Bar chart of instances by status; recent instances table |

**Pending Approvals banner** — shown at top when `pendingApprovals.length > 0`:
- Approve / Reject each approval inline
- Rejection requires a reason textarea

### WorkflowBuilder Modal

Configure:
- Name, description
- Trigger type: `manual` / `schedule` / `event-based`

Workflow nodes (add / reorder / delete):
| Node Type | Config Fields |
|-----------|---------------|
| `approval` | Approver (employee picker), escalation timeout |
| `notification` | Recipients, message template |
| `condition` | Field + operator + value (if/else branch) |
| `action` | Status update target + new status value |

### API Endpoints Used

```
GET  ${API_BASE}/workflow/definitions
GET  ${API_BASE}/workflow/instances
GET  ${API_BASE}/workflow/approvals/my?user_id=...
GET  ${API_BASE}/workflow/stats
POST ${API_BASE}/workflow/definitions
PUT  ${API_BASE}/workflow/definitions/{id}
DELETE ${API_BASE}/workflow/definitions/{id}
POST ${API_BASE}/workflow/trigger
POST ${API_BASE}/workflow/instances
POST ${API_BASE}/workflow/instances/{id}/cancel
POST ${API_BASE}/workflow/approvals/{id}/respond
POST ${API_BASE}/workflow/seed-defaults  ← dev convenience, exposed in UI
```

### Key State Variables

```
WorkflowDashboard: showBuilder, editingWorkflow, selectedInstance, confirmState, seeding
WorkflowBuilder:   name, description, nodes, selectedNode, triggerType, saving
```

### Known Gaps

| # | Gap | Severity |
|---|-----|----------|
| G1 | No per-instance step-level execution trace / log viewer | High |
| G2 | Schedule trigger type has no cron expression builder UI — option exists in select but renders nothing | High |
| G3 | Template "install" only copies fields to builder — no versioning or update propagation | Medium |
| G4 | `seed-defaults` button is a developer convenience exposed in production UI | Medium |
| G5 | No event-based trigger configuration UI (what event → what entity) | High |
| G6 | Condition node is single condition only — no AND/OR grouping | Medium |
| G7 | No workflow version history | Low |
| G8 | No cross-app workflow trigger mapping (e.g. "when leave is applied → run this workflow") | High |
| G9 | No SLA / deadline enforcement on approval nodes (escalation timeout is configured but unclear if executed) | Medium |

---

## 11. Notification Bell (Global Component)

**File:** `src/app/components/NotificationBell.tsx` (258 lines)
**Hook:** `useNotifications` + `usePushNotifications`
**Mount point:** `AppHeader` — always visible on all pages
**DB Tables:** `notifications` (reads + mutates via API)

### UI Elements

| Element | Description |
|---------|-------------|
| Bell icon | Unread count badge (red dot) |
| Dropdown panel | App filter tabs + notification list |
| Per-notification | Title, body, dot color by type, timestamp, delete button |
| Footer | "Mark all read" action |

### App Filter Tabs Currently Wired

```
all            ← all notifications regardless of source
it-services    ← IT ticket notifications
assets         ← Asset management notifications
projects       ← Project management notifications
```

> ⚠️ Notifications from **leave, recruitment, onboarding, performance, training, communications** are received and shown in `all` but have no dedicated filter tab.

### API Endpoints Used

```
GET    ${API_BASE}/notifications?userId=...   ← polled every 15 seconds
PUT    ${API_BASE}/notifications/{id}/read
PUT    ${API_BASE}/notifications/read-all
DELETE ${API_BASE}/notifications/{id}
```

### Push Notification Support

- `usePushNotifications` hook: Web Push API + VAPID key setup
- `navigator.serviceWorker` registration
- Browser `Notification` permission request on mount
- Fires browser notification for newly arrived unread items
- Requires VAPID keys configured in environment — may not work in all environments

### Key State Variables

```
open, appFilter
```

### Known Gaps

| # | Gap | Severity |
|---|-----|----------|
| G1 | Only 3 app filter tabs (IT, Assets, Projects) — 8+ other apps produce notifications without a filter | High |
| G2 | No "mark individual as read" button — only delete or navigate (marks read on click) | Medium |
| G3 | Polling interval 15 seconds — no WebSocket / Supabase Realtime push | Medium |
| G4 | No notification preferences / settings panel (which events to receive per app) | High |
| G5 | No notification categories (Info / Warning / Action Required) | Medium |
| G6 | No "snooze" or "remind later" on notifications | Low |
| G7 | Push notification VAPID setup depends on env config not confirmed to be set | Medium |
| G8 | No in-app notification history page — only the dropdown panel (max ~50 shown) | Low |
| G9 | No bulk delete (delete all read) | Low |

---

## Cross-Cutting Architecture Notes

### Shared Stack

| Concern | Current Implementation |
|---------|----------------------|
| API | REST via `${API_BASE}` (Supabase Edge Function URL) — per-app hooks |
| Auth | Supabase Auth — `useUser` context for current user + role |
| RBAC | `useUser.role` checked in components; `ROUTE_ROLES` in `src/constants/roles.ts` |
| Dropdowns | `ValueHelpsContext` + `MasterDataContext` |
| i18n | `t("key")` helper, all strings in `src/i18n/locales/en.ts` |
| Styling | Tailwind CSS v4 |

### Critical Architecture Gaps

| App | Gap | Severity |
|-----|-----|----------|
| Collaboration Hub | **Entire chat layer is localStorage** — no server persistence, no multi-user sync | Critical |
| Training Tracker | **Learning Paths are in-memory state** — lost on page refresh | Critical |
| All apps | No WebSocket / Supabase Realtime — live collaboration requires polling or refresh | High |
| Notification Bell | Only 3 of 11 apps have dedicated filter tabs | High |
| Recruitment | Dead code (`V2` file) still in repository | Low |

---

*Blueprint version: 1.0 — Generated 2026-09-04 — Ready for spec-driven enhancement.*
