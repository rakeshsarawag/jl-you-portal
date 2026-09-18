# App Blueprints — Extended (8 Additional Apps)

> **Purpose:** Authoritative current-state blueprint for 8 apps to support spec-driven enhancement.
> **Last Updated:** 2026-09-04
> **Scope:** OKR Management, Executive Dashboard, Advanced Analytics, Security & Compliance, Advanced Features, Documentation, Invoice Generation, Payroll Management

---

## 12. OKR Management

**File:** `src/app/components/apps/OKRManagementEnhanced.tsx`
**Hook:** `useOKRData`
**Route:** `/okr`
**DB Tables:** `okrs`, `key_results`, `okr_progress` (via `${API_BASE}/okr`)

### Screens & Tabs

| Screen / Tab | Path / Toggle | Purpose |
|---|---|---|
| List view | `activeView = 'list'` | Card grid of OKRs with progress rings; default view |
| History view | `activeView = 'history'` | OKRs grouped by quarter/year; collapsible groups |
| Cascade view | Manager overlay (`showCascade = true`) | Recursive tree of OKRs by `parentId`; manager-only |
| OKR Form Modal | `showOKRForm` | Create or edit an OKR |
| Key Result Modal | `addKROKR` | Add a key result to an OKR |
| Check-In Modal | `checkInOKR` | Record a progress update with confidence and notes |
| Detail Modal | `viewingOKR` | Read-only deep view of OKR, key results, and update history |
| Grade Modal | `gradingOKR` | Manager assigns A/B/C/D/F grade with comment |
| Confirm Delete Dialog | `confirmDeleteOKR` | Admin-only deletion confirmation with undo toast |

### Features Implemented

**List View**
- OKR cards display title, type (personal/team/company), owner, quarter, progress bar, and grade badge if set
- Filter by quarter (`quarterFilter`), type (`typeFilter`), and free-text search (`search`)
- Employee role sees own OKRs only; manager sees all; admin adds delete capability

**History View**
- OKRs sorted and grouped by `year` → `quarter` heading, each group collapsible
- Shows number of OKRs per group inline

**Cascade View (manager)**
- Recursive `CascadeNode` component traverses `parentId` relationships
- Visualises hierarchical OKR alignment across the organisation

**Key Result Management**
- Add key results with `title`, `targetValue`, `unit`, and `startValue`
- Progress check-ins update `currentValue` and store snapshot in `updates[]`

**Grading**
- Managers can grade completed OKRs (A/B/C/D/F) with an optional `grade_comment`
- Grade displayed as colour-coded badge on card

**Undo Delete**
- On deletion, a toast with an "Undo" action re-POSTs the original OKR data

### API Endpoints Used

```
GET    ${API_BASE}/okr/okrs                              # list OKRs
POST   ${API_BASE}/okr/okrs                              # create OKR
PUT    ${API_BASE}/okr/okrs/{id}                         # update OKR (grade, fields)
DELETE ${API_BASE}/okr/okrs/{id}                         # delete OKR (admin only)
POST   ${API_BASE}/okr/okrs/{id}/key-results             # add key result
PUT    ${API_BASE}/okr/okrs/{id}/key-results/{krId}/progress  # update KR progress
POST   ${API_BASE}/okr/okrs/{id}/checkin                 # record check-in
```

### Key State Variables

```ts
activeView: 'list' | 'history'
quarterFilter: string       // e.g. 'Q1 2026'
typeFilter: string          // 'personal' | 'team' | 'company' | ''
search: string
showCascade: boolean        // manager-only cascade overlay
showOKRForm: boolean
editingOKR: OKR | null
viewingOKR: OKR | null
checkInOKR: OKR | null
addKROKR: OKR | null
gradingOKR: OKR | null
confirmDeleteOKR: OKR | null
```

### Known Gaps

| # | Gap | Severity |
|---|---|---|
| 1 | Cascade view is display-only — no drag-and-drop to re-parent OKRs | Medium |
| 2 | No due-date / timeline visualisation (Gantt or roadmap) | Low |
| 3 | Check-in confidence level captured but not charted over time | Low |
| 4 | Undo delete re-POSTs without restoring key results or progress history | Medium |
| 5 | History view has no date-range filter beyond the quarter grouping | Low |
| 6 | No bulk-grade or bulk-close workflow for end-of-quarter | Low |

---

## 13. Executive Dashboard

**File:** `src/app/components/analytics/ExecutiveDashboardEnhanced.tsx`
**Hook:** `useExecutiveDashboardData(dateRange)`
**Route:** `/executive-dashboard`
**DB Tables:** none directly — aggregated across all backend domains via hook

### Screens & Tabs

| Screen / Tab | Path / Toggle | Purpose |
|---|---|---|
| Overview | `activeTab = 'overview'` | Cross-domain KPI summary; default tab |
| People | `activeTab = 'people'` | Headcount, onboarding pipeline, training |
| Finance | `activeTab = 'finance'` | Payroll cost, invoice revenue and outstanding |
| Operations | `activeTab = 'operations'` | IT tickets, assets, recruitment pipeline |
| OKR | `activeTab = 'okr'` | Average OKR progress and risk distribution |
| Access Restricted | role guard | Shown to non-admin/manager/finance/hr users |

### Features Implemented

**Role Gate**
- Only `admin`, `manager`, `finance`, `hr` roles can view the dashboard; all others see an "Access Restricted" placeholder

**Date Range Controls**
- Toggle between `'30d'`, `'90d'`, `'1y'` (passed to `useExecutiveDashboardData`)
- Manual "Refresh" button with `lastUpdated` timestamp

**Overview Tab**
- KPI cards: headcount, payroll cost, active candidates, training completion %, open IT tickets, outstanding invoices
- Onboarding status bar (by stage)
- Performance rating distribution bar

**People Tab**
- Headcount breakdown table, onboarding funnel table, training enrolled vs certified counts

**Finance Tab**
- Payroll cost / average salary / employees processed
- Invoice revenue, outstanding balance, overdue amount
- Cost-vs-revenue comparison bar chart

**Operations Tab**
- IT services: open, SLA-breached, and average resolution time
- Assets: total, assigned, in-maintenance counts
- Recruitment mini-cards per pipeline stage

**OKR Tab**
- Average progress displayed as a donut-style percentage
- On-track and at-risk counts, progress distribution bars

### API Endpoints Used

```
# All data fetched by useExecutiveDashboardData — no direct fetch calls in the component
# Hook aggregates from the same ${API_BASE} backend domains used by other apps
```

### Key State Variables

```ts
dateRange: '30d' | '90d' | '1y'
activeTab: 'overview' | 'people' | 'finance' | 'operations' | 'okr'
```

### Known Gaps

| # | Gap | Severity |
|---|---|---|
| 1 | No drill-through — KPI cards are not clickable to source apps | Medium |
| 2 | No PDF or image export for the executive summary | Medium |
| 3 | Date range controls pass the value to the hook but there is no evidence the backend honours it for all domains | High |
| 4 | No configurable widget layout; tab order and content are fully hardcoded | Low |
| 5 | Onboarding status bar and recruitment pipeline use hardcoded stage labels | Low |

---

## 14. Advanced Analytics

**File:** `src/app/components/analytics/AdvancedAnalyticsDashboard.tsx`
**Hook:** `useAdvancedAnalyticsData`
**Route:** `/advanced-analytics`
**DB Tables:** none directly — hook returns `allStats` aggregated from all backend domains

### Screens & Tabs

| Screen / Tab | Path / Toggle | Purpose |
|---|---|---|
| Overview | `activeTab = 'overview'` | 12 KPI cards with drill-down modals; default tab |
| People | `activeTab = 'people'` | Headcount, recruitment, performance, training |
| Finance | `activeTab = 'finance'` | Payroll, invoices, assets |
| Operations | `activeTab = 'operations'` | IT tickets, projects, OKR health |
| Reports | `activeTab = 'reports'` | Pre-built templates and custom report builder |

### Features Implemented

**Overview Tab**
- 12 KPI cards spanning all domains; 6 are drillable: Headcount, Monthly Payroll, Active Candidates, Open IT Tickets, Training Completion, Invoice Revenue
- `DrillDownModal` shows category breakdown from nested data arrays when available, or flat metrics otherwise

**Filtering Controls**
- Department dropdown: `['All', 'Engineering', 'HR', 'Finance', 'Marketing', 'Operations']` — UI only; does not pass a filter parameter to the hook
- Date range dropdown triggers `refresh()` but the date value is not passed to the hook

**People Tab**
- Headcount breakdown table, recruitment pipeline horizontal bars, performance rating distribution, training completion stats

**Finance Tab**
- Payroll summary cards, invoice overview bars, asset overview grid

**Operations Tab**
- IT ticket distribution stacked bar, project status (active/completed/on-hold), OKR health progress bars

**Reports Tab**
- Five pre-built templates (Headcount Summary, Recruitment Pipeline, Training Report, Invoice Summary, Payroll Report): select → run → view table → download CSV
- Custom Report Builder: choose domain → pick metrics → generate → export CSV
- Additional exports: Excel (`.xls` via TSV content trick), PDF via `window.print()`

### API Endpoints Used

```
# All data fetched inside useAdvancedAnalyticsData; component calls refresh() only
# Report runner fetches from ${API_BASE}/<domain> per selected template domain
```

### Key State Variables

```ts
activeTab: 'overview' | 'people' | 'finance' | 'operations' | 'reports'
refreshing: boolean
dateRange: string           // dropdown value; not forwarded to hook
department: string          // dropdown value; not forwarded to hook
drillDownKPI: string | null // which KPI card opened the DrillDownModal
```

### Known Gaps

| # | Gap | Severity |
|---|---|---|
| 1 | Department filter is a UI stub — API data is never filtered by department | High |
| 2 | Date range dropdown does not pass the selected date to `useAdvancedAnalyticsData` | High |
| 3 | DrillDownModal falls back to flat metrics when nested arrays are absent (most KPIs) | Medium |
| 4 | Excel export uses TSV content in a `.xls` file; not a real Excel binary | Low |
| 5 | PDF export relies on `window.print()` — print styles are not defined | Low |
| 6 | Custom Report Builder has no save/schedule functionality | Medium |

---

## 15. Security & Compliance

**File:** `src/app/components/security/SecurityComplianceDashboard.tsx`
**Hook:** none — uses `AuditLogService` and `ComplianceService` static class methods
**Route:** `/security-compliance`
**DB Tables:** none — data stored in `localStorage` via `AuditLogService` and `ComplianceService`

### Screens & Tabs

| Screen / Tab | Path / Toggle | Purpose |
|---|---|---|
| Audit Logs | `activeTab = 'audit'` | Searchable/filterable event log table; default tab |
| Compliance | `activeTab = 'compliance'` | Framework picker, requirement list, status updates |
| Privacy Requests | `activeTab = 'privacy'` | GDPR/CCPA data subject request tracking |
| Security Overview | `activeTab = 'security'` | Events-by-type bar chart and top active users |

### Features Implemented

**Overview Cards (always visible)**
- Total audit events, critical events count, compliance rate % for the selected framework, pending privacy requests

**Audit Logs Tab**
- Full `AuditLog` table: timestamp, user, event type, action, resource, severity badge, status
- Search by action / user / resource (`logSearchQuery`)
- Filter by event type (`selectedEventType`) and severity (`selectedSeverity`)
- Export filtered results to CSV via `AuditLogService.exportLogs('csv', filter)`

**Compliance Tab**
- Framework picker: GDPR, HIPAA, SOC2, ISO27001, PCI-DSS, CCPA, NIST
- Stats cards: compliant / partial / in-progress / non-compliant counts for the selected framework
- Requirements list with inline status dropdown to update each requirement (`ComplianceService.updateRequirement`)
- Export compliance report as JSON (`ComplianceService.exportReport(framework)`)

**Privacy Requests Tab**
- Lists all `DataPrivacyRequest` records (access / deletion / rectification / portability / objection)
- Inline status dropdown updates each request (`ComplianceService.updatePrivacyRequest`)

**Security Overview Tab**
- Bar chart of events grouped by event type
- Top 5 most active users ranked by event count

**Data Persistence**
- `AuditLogService` persists to `localStorage` key `audit_logs`; 90-day retention cleanup runs on a 24 h interval
- `ComplianceService` persists to `localStorage` keys `compliance_requirements`, `compliance_assessments`, `privacy_requests`

### API Endpoints Used

```
# No network API calls — all data managed by local service classes
AuditLogService.getLogs(filter)
AuditLogService.getStatistics()
AuditLogService.exportLogs('csv', filter)
ComplianceService.getAllRequirements(framework)
ComplianceService.getStatistics(framework)
ComplianceService.updateRequirement(id, updates)
ComplianceService.getPrivacyRequests()
ComplianceService.updatePrivacyRequest(id, updates)
ComplianceService.exportReport(framework)   // returns JSON string
```

### Key State Variables

```ts
auditLogs: AuditLog[]
filteredLogs: AuditLog[]
logSearchQuery: string
selectedEventType: AuditEventType | ''
selectedSeverity: AuditSeverity | ''
auditStats: AuditStats
selectedFramework: ComplianceFramework
requirements: ComplianceRequirement[]
complianceStats: ReturnType<typeof ComplianceService.getStatistics>
privacyRequests: DataPrivacyRequest[]
activeTab: 'audit' | 'compliance' | 'privacy' | 'security'
```

### Known Gaps

| # | Gap | Severity |
|---|---|---|
| 1 | Data lives in localStorage — lost on browser clear, not shared across users or devices | High |
| 2 | Audit events are not automatically written when actions occur in other apps | High |
| 3 | Compliance framework data for HIPAA, ISO27001, PCI-DSS, CCPA, NIST is not pre-seeded; only GDPR and SOC2 have sample requirements | High |
| 4 | No ability to create new privacy requests from within the UI | Medium |
| 5 | Assessment history and findings (from `ComplianceAssessment`) are not surfaced in any tab | Medium |
| 6 | Date-range filter for audit logs is defined in `AuditFilter` but no date picker is rendered in the UI | Medium |
| 7 | "Add Evidence" capability exists in `ComplianceService` but has no UI entry point | Low |

---

## 16. Advanced Features

**File:** `src/app/components/advanced/AdvancedFeaturesDashboard.tsx`
**Hook:** none — uses `ReportingService` static class methods
**Route:** `/advanced-features`
**DB Tables:** none — data stored in `localStorage` via `ReportingService`

### Screens & Tabs

| Screen / Tab | Path / Toggle | Purpose |
|---|---|---|
| Hero / Feature Cards | always visible | Six feature-category cards; "Explore →" buttons are no-ops |
| Reports | `activeTab = 'reports'` | Manage reports: list, create, favorite, run, export, delete; default tab |
| Templates | `activeTab = 'templates'` | Pre-built template cards; "Use Template" creates a report |
| Integrations | `activeTab = 'integrations'` | Six hardcoded integration cards; action buttons are no-ops |
| Monitoring | `activeTab = 'monitoring'` | Four hardcoded system-health metrics and four hardcoded activity events |

### Features Implemented

**Hero Section**
- Six feature category cards (Advanced Reporting, API Integration Hub, Automation Studio, Advanced Analytics, Smart Search, System Monitoring) with descriptive icons and "Explore →" CTA; no navigation attached

**Reports Tab**
- Stats bar: total reports / favorites / scheduled / recently run (all derived from `ReportingService`)
- Searchable report list filtered by `searchQuery`
- Per-report actions: toggle favorite, run (logs a run timestamp), export CSV (downloads column headers + row data), delete
- "Create Report" button opens `showCreateDialog` modal: enter name, description, type (`table` | `chart` | `dashboard`)

**Templates Tab**
- Pre-built template cards grouped by category: HR, Sales, Projects, Finance, Compliance
- "Use Template" creates a new report from the template definition via `ReportingService`
- "Preview" button is a no-op

**Integrations Tab**
- Six hardcoded cards: Salesforce (connected), Slack (connected), Google Workspace (available), Microsoft 365 (available), Stripe (available), Custom API (available)
- "Configure" (connected) and "Connect" (available) buttons are no-ops

**Monitoring Tab**
- System Health: four hardcoded metrics (API Response Time, Database Load, Memory Usage, Error Rate) with static values
- Recent Activity: four hardcoded log entries

### API Endpoints Used

```
# No network API calls — all data managed by ReportingService (localStorage)
ReportingService.getReports()
ReportingService.createReport(data)
ReportingService.updateReport(id, updates)
ReportingService.deleteReport(id)
ReportingService.runReport(id)
ReportingService.getTemplates()
ReportingService.createReportFromTemplate(templateId)
```

### Key State Variables

```ts
reports: Report[]
templates: ReportTemplate[]
selectedReport: Report | null
searchQuery: string
showCreateDialog: boolean
reportStats: { total; favorites; scheduled; recentlyRun }
newReportName: string
newReportDescription: string
newReportType: 'table' | 'chart' | 'dashboard'
activeTab: 'reports' | 'templates' | 'integrations' | 'monitoring'
```

### Known Gaps

| # | Gap | Severity |
|---|---|---|
| 1 | Reports live in localStorage — not persisted server-side or shared across users | High |
| 2 | "Explore →" hero buttons and integration action buttons are all no-ops | High |
| 3 | Monitoring tab shows entirely static/hardcoded data — no live metrics | High |
| 4 | "Preview" on template cards does nothing | Medium |
| 5 | Scheduled reports stat card is shown but scheduling is not implemented | Medium |
| 6 | Report "run" only updates a timestamp; no actual data query is performed | High |
| 7 | CSV export outputs column headers from the report's field definitions but no real row data | Medium |

---

## 17. Documentation

**File:** `src/app/components/apps/UserDocumentationEnhanced.tsx`
**Hook:** none
**Route:** `/documentation`
**DB Tables:** none — all content is hardcoded static data in `appDocumentation` array

### Screens & Tabs

| Screen / Tab | Path / Toggle | Purpose |
|---|---|---|
| App List | `selectedApp = null` | Searchable grid of 22 app cards filtered by user role |
| App Detail — Quick Start | `selectedApp` + `activeSubTab = 'quickstart'` | Numbered steps and role access notice |
| App Detail — Features | `selectedApp` + `activeSubTab = 'features'` | Feature list with required-role badges |
| App Detail — FAQs | `selectedApp` + `activeSubTab = 'faqs'` | Categorised FAQs (basic / technical / troubleshooting) |
| App Detail — Guides | `selectedApp` + `activeSubTab = 'guides'` | Section docs + placeholder video tutorials |

### Features Implemented

**App List View**
- Search by app name or description (`searchQuery`)
- Cards filtered by user role via `roleAccess[]` on each app definition
- Each card shows app icon, description, feature count, and FAQ count

**Quick Start Sub-tab**
- Numbered step list from `quickStart[]`
- Access level notice derived from the current user's role

**Features Sub-tab**
- Feature list from `features[]`; each item shows required role badge
- Step-by-step instructions rendered when `steps[]` is provided on a feature

**FAQs Sub-tab**
- FAQ list from `faqs[]`; filterable by category: basic / technical / troubleshooting

**Guides Sub-tab**
- "Video Tutorials" section: "Coming soon" placeholder
- "Detailed Documentation" from `sections[]` array on the app definition
- "Download Guide" and "Download PDF" buttons render but are non-functional

### API Endpoints Used

```
# No API calls — all content is static in the component file
```

### Key State Variables

```ts
searchQuery: string
selectedApp: AppDoc | null
selectedCategory: 'basic' | 'technical' | 'troubleshooting' | 'all'
activeSubTab: 'quickstart' | 'features' | 'faqs' | 'guides'
```

### Known Gaps

| # | Gap | Severity |
|---|---|---|
| 1 | All 22 app documents are hardcoded strings — no CMS or admin edit interface | High |
| 2 | Video tutorial placeholders never link to real content | Medium |
| 3 | Download Guide / Download PDF buttons are non-functional | Medium |
| 4 | Documentation content is not localised via `t()` even though the rest of the app uses i18n | Low |
| 5 | No search within a single app's detail view (FAQs, sections) | Low |
| 6 | `sections[]` in the app definition has no standardised schema — content quality varies per app | Low |

---

## 18. Invoice Generation

**File:** `src/app/components/apps/InvoiceGenerationSystem.tsx`
**Hook:** `useInvoiceData`
**Route:** `/invoices`
**DB Tables:** `invoices`, `invoice_items` (via `${API_BASE}/invoices`)

### Screens & Tabs

| Screen / Tab | Path / Toggle | Purpose |
|---|---|---|
| Invoices | `activeTab = 'invoices'` | Searchable / filterable invoice list with per-status actions; default tab |
| Create | `activeTab = 'create'` | Invoice creation form with line items |
| Analytics | `activeTab = 'analytics'` | Revenue KPIs and status breakdown chart |
| View Modal | `viewingInvoice` | Read-only invoice detail with line items table |
| Edit Modal | `editingInvoice` | Editable invoice fields and line items |
| Delete Confirm | `confirmDeleteId` | Admin / finance role confirmation dialog |

### Features Implemented

**Invoices Tab**
- Search by invoice number or client name
- Filter by status: Draft / Sent / Paid / Unpaid / Overdue / Cancelled
- Per-row actions gated by status:
  - View: all statuses
  - Edit + Send: Draft only
  - Mark Paid: Sent or Overdue
  - Delete: admin or finance role only

**View Modal**
- Read-only display of all invoice fields plus a line items table (description, qty, rate, subtotal)
- Shows tax, discount, and grand total

**Edit Modal**
- Change client, due date, status, line items (add / remove rows), tax rate, notes
- Save persists via PUT to the API

**Create Tab**
- Client picker from `billToClients` dropdown (pre-populated list from the hook)
- Invoice date and due date pickers
- Dynamic line items: description, quantity, rate; subtotal computed live
- Tax % field; notes textarea
- Two save actions: "Save as Draft" (status = Draft) or "Save & Send" (status = Sent)

**Analytics Tab**
- Four KPI cards: total revenue (paid invoices), total outstanding, total overdue, paid this month
- Horizontal bar chart of invoice counts by status
- Summary row: total invoices / paid count / overdue count

### API Endpoints Used

```
GET    ${API_BASE}/invoices           # list all invoices
POST   ${API_BASE}/invoices           # create invoice
PUT    ${API_BASE}/invoices/{id}      # update invoice (edit / mark paid / send)
DELETE ${API_BASE}/invoices/{id}      # delete invoice (admin/finance only)
```

### Key State Variables

```ts
activeTab: 'invoices' | 'create' | 'analytics'
search: string
statusFilter: string          // '' | 'Draft' | 'Sent' | 'Paid' | 'Unpaid' | 'Overdue' | 'Cancelled'
viewingInvoice: Invoice | null
editingInvoice: Invoice | null
confirmDeleteId: string | null
isAdminOrFinance: boolean     // derived from user role
```

### Known Gaps

| # | Gap | Severity |
|---|---|---|
| 1 | No recurring invoice or invoice template functionality | Medium |
| 2 | No email preview before "Save & Send" — send is instant with no confirmation | Medium |
| 3 | Client list (`billToClients`) is pre-populated from the hook; no ability to add new clients from within the invoice form | Medium |
| 4 | Analytics tab has no date range filter — figures are all-time totals | Medium |
| 5 | No partial payment tracking; an invoice is either fully Paid or outstanding | Medium |
| 6 | No pagination on the invoice list; all records load at once | Low |

---

## 19. Payroll Management

**File:** `src/app/components/apps/PayrollManagementEnhanced.tsx`
**Hook:** `usePayrollData` (payslip records), plus direct fetch for salary structures
**Route:** `/payroll`
**DB Tables:** `payroll_records`, `salary_structures` (via `${API_BASE}/payroll`)

### Screens & Tabs

| Screen / Tab | Path / Toggle | Purpose |
|---|---|---|
| My Payslips | `activeTab = 'payslips'` | Employee's own payslip records; default tab |
| Processing | `activeTab = 'processing'` (perm: `process_payroll`) | Run payroll for a month; approve / reject pending records |
| Summary | `activeTab = 'summary'` | KPI cards and status breakdown across all records |
| Salary Structure | `activeTab = 'salary-structure'` (perm: `salary_structure`) | Manage per-employee salary component definitions |
| Salary Revision | `activeTab = 'salary-revision'` (perm: `revision_history\|salary_structure`) | History of basic-pay changes derived from salary structures |
| Payslip Viewer | `activeTab = 'payslip-viewer'` | Browse all payslips for a chosen month/year |
| Compliance | `activeTab = 'compliance'` (perm: `approve_payroll + compliance`) | PF / ESI / TDS challan tables with CSV download |
| Salary Breakdown Modal | `breakdownRecord` | Quick breakdown popup per payslip record |
| Detailed Payslip Modal | `viewerRecord` | Printable full payslip with all components |
| Salary Structure Modal | `showStructModal` | Create / edit a salary structure entry |

### Features Implemented

**My Payslips Tab**
- Table of the logged-in employee's own payslip records
- Click row to open `SalaryBreakdownModal` (quick view) or `DetailedPayslipModal` (printable)

**Processing Tab**
- Month / year picker; "Process Payroll" button triggers calculation for all active employees:
  - Fetches salary structures and active employee list
  - Computes gross, PF (12 %), ESI (employee 0.75 %, employer 3.25 % if gross ≤ ₹21,000), Professional Tax (₹200/month), TDS (10 % annual income > ₹5 L), net pay
  - Creates or updates payroll records via POST/PUT
- Pending Approvals section: approve (with `approvingId` confirmation) or reject (with `rejectReason` text input)
- NEFT CSV export for all approved records in the selected period

**Summary Tab**
- KPI cards: total payroll cost, average salary, headcount processed
- Status breakdown (Pending / Approved / Rejected / Processed)
- Monthly trend chart is present in source but disabled with `{false && ...}` — never rendered

**Salary Structure Tab**
- Table listing all salary structure records with components and computed deductions
- Add new or edit existing via `SalaryStructureModal`
- Employee picker uses typeahead search against the employee directory

**Salary Revision History Tab**
- Derived by sorting salary structures by `effective_from` per employee
- Displays old basic vs new basic for each revision event

**Payslip Viewer Tab**
- Month / year filter; shows all payslip records for that period
- Opens `DetailedPayslipModal` with print support (`window.print()`)

**Compliance Tab**
- PF Challan: employee PF (12 % of basic) + employer PF (12 %) per employee
- ESI Challan: only for employees with gross ≤ ₹21,000 (employee 0.75 %, employer 3.25 %)
- TDS Summary: annual TDS deducted per employee
- All three downloadable as separate CSV files

**Indian Statutory Constants**
```
PF_RATE = 0.12
ESI_GROSS_LIMIT = 21000
ESI_EMPLOYEE_RATE = 0.0075   (0.75 %)
ESI_EMPLOYER_RATE = 0.0325   (3.25 %)
PROF_TAX = 200               (₹/month)
TDS_ANNUAL_THRESHOLD = 500000
TDS_RATE = 0.10
```

### API Endpoints Used

```
GET    ${API_BASE}/payroll                    # list payslip records (usePayrollData)
POST   ${API_BASE}/payroll                    # create payroll record during processing
PUT    ${API_BASE}/payroll/{id}               # update record (approve / reject)
GET    ${API_BASE}/payroll/salary-structures  # fetch all salary structures
POST   ${API_BASE}/payroll/salary-structures  # create salary structure
PUT    ${API_BASE}/payroll/salary-structures/{id}  # update salary structure
GET    ${API_BASE}/directory                  # employee list for typeahead and payroll run
```

### Key State Variables

```ts
activeTab: string
selectedRecord: PayrollRecord | null   // for SalaryBreakdownModal
breakdownRecord: PayrollRecord | null
processMonth: number
processYear: number
processing: boolean
salaryStructures: SalaryStructure[]
structLoading: boolean
showStructModal: boolean
editingStruct: SalaryStructure | null
viewerMonth: number
viewerYear: number
viewerRecord: PayrollRecord | null     // for DetailedPayslipModal
rejectingId: string | null
rejectReason: string
approvingId: string | null
```

### Known Gaps

| # | Gap | Severity |
|---|---|---|
| 1 | Monthly trend chart in Summary tab is hidden behind `{false && ...}` — never rendered | Medium |
| 2 | PF statutory cap (₹1,800/month on ₹15,000 wage ceiling) is not implemented; PF is computed on full basic | High |
| 3 | Professional Tax slab varies by state; the component uses a fixed ₹200 with no state configurability | Medium |
| 4 | TDS calculation uses a flat 10 % above threshold; standard deduction, HRA, and other exemptions are not modelled | High |
| 5 | No payroll lock — re-running "Process Payroll" for the same month overwrites existing approved records | High |
| 6 | Salary Revision History is client-derived; it does not store a proper revision audit trail on the server | Medium |
| 7 | NEFT export format is a generic CSV; bank-specific NEFT file formats (e.g. HDFC, ICICI templates) are not supported | Low |
| 8 | No leave-loss-of-pay (LOP) deduction integration with the attendance / leave management module | Medium |
