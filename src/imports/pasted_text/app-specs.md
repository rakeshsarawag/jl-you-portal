Providing the spec for the following apps fpr implementation:

OKR Management
Executive Dashboard
Analytics
Securities & Compliance
Advance Features
Documentation
Invoices
Payroll
Workflow Automation
Notification Feature on menu bar


Each value in the app must be stored in DB and retrieved from DB

If required use constants User Master Data app for config data, value helps

Use permissions app to control the access based on roles

If required create tables, schemas, edge functions and try to stores the values in rows instead of json like values

Store all the texts in the i18n files which are used for translation

Must sync with Defects trackers app for defects

Each feature explained in the attached file must be implemented

Create or use existing progress.md file for tracking the implementation and progress of each feature

Do not miss any feature explained in the attached file. Refer the attached file properly

If required use multiple agents, multiple batches or use to do list to complete the tasks and implement all features

You can schedule batches also if required

Implement notifications and workflow properly

Don't display the texts that it's coming from DB

App must be responsive in nature accessible on mobile, tablet, desktops

If required workflow must be used and integrated

Notifications must be set up




Following is the summary of specs files:


Section A — Cross-App Integration Map (25 integrations + Group 1 confirmations)
All 25 numbered integrations are documented with the full 7-column format (Source | Target | Trigger | Action | Data Passed | Sync Type | Bidirectional). Covers all Group 1 x Group 2 pairs, Group 2 internal integrations, and confirms the key intra-HR-App flows (A26).

Section B — Master Data Shared Config Matrix
18 config entities documented in a table, with two additions beyond the prompt (KPI_THRESHOLDS, ANALYTICS_ANOMALY_RULES, RECRUITMENT_AGENCY_CONFIG) to cover gaps referenced in the integrations.

Section C — Cross-App Permission Keys
15 permission keys documented with the apps that check each key and the default roles granted.

Section D — Portal-Wide Audit Events
Full HR App event list confirmed (D1), all Business App events listed by domain (D2), and the audit_logs table schema provided for reference (D3) including the append-only RLS policy note.

Section E — Notification Bell Event Catalog
Summary table as provided, plus per-app event breakdowns for all 7 Business Apps with in-app vs. web-push classification for each event.

Section F — App Merge / Simplification Recommendations
5 recommendations documented: OKR+Performance merge (recommended before launch), Advanced Features + Documentation (keep separate), Exec Dashboard + Analytics (keep separate, drill-through), Notification Bell clarification (not a separate app), Workflow Automation (extend, not duplicate).

Section G — Complete Portal Sitemap
All 11 HR App routes, all 8 Business App routes, 4 shared/utility routes, and an API route conventions reference section.

All 6 agents completed successfully. Here's the full output summary:

All 6 Spec Files Written to Downloads
File	Apps Covered
Portal_Spec_Part1_OKR_ExecDashboard.txt	OKR Management + Executive Dashboard
Portal_Spec_Part2_Analytics_Security.txt	Advanced Analytics + Security & Compliance
Portal_Spec_Part3_AdvancedFeatures_Documentation.txt	Advanced Features + Documentation
Portal_Spec_Part4_Invoice_Payroll.txt	Invoice Generation + Payroll Management
Portal_Spec_Part5_Workflow_Notifications.txt	Workflow extensions + Notification extensions
Portal_Spec_Part6_CrossApp_Integration.txt	Full cross-app integration map + sitemap
Key highlights across all specs
Critical fixes covered:

Security & Compliance: full localStorage → Supabase migration (audit_logs, compliance_requirements, privacy_requests, security_risks tables)
Advanced Features: reports migrated from localStorage; real report execution with SheetJS Excel export
Payroll: PF capped at ₹1,800, proper TDS with new regime slabs (FY 2025-26) + 87A rebate + cess, state-wise PT slabs seeded for 7 states, payroll lock/unlock flow
Analytics: department filter and date range now wired to backend; anomaly detection; scheduled reports with email delivery
New tables added: 40+ across all specs (payroll_locks, salary_revision_history, audit_logs, compliance_frameworks, compliance_requirements, privacy_requests, security_risks, clients, invoice_payments, recurring_invoice_configs, okr_checkins, okr_cycles, custom_reports, monitoring_metrics, integrations_config, doc_apps, doc_sections, doc_faqs, and more)

Notifications: ~143 total portal-wide push notification events, ~90 web push enabled, ~39 forced-on (cannot be disabled by users)

Merge recommendation: OKR Management → merge into Performance app before launch (avoids data duplication); "Notification Feature on menu bar" = the existing Notification Bell component (no separate app needed)

Complete portal sitemap with 19 routes + shared utility routes documented in Part 6.