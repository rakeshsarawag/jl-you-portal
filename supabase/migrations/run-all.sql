-- ============================================================
-- Jeshan Labs HR Portal — Full Migration Suite
--
-- HOW TO RUN (psql):
--   psql "<connection-string>" -f run-all.sql
--
-- In the Supabase SQL Editor, \i is not supported — instead paste
-- the contents of each file below, in order, one at a time.
--
-- Migration files (in order):
--   01_schema.sql                   — ALL DDL: extensions, tables, indexes,
--                                     constraints, functions, triggers, RLS
--                                     (already incorporates 07–10 changes)
--   02_seed_data.sql                — ALL seed/master/lookup/demo data
--   03_notifications_and_push.sql   — Notification system & push subscriptions
--   04_analytics_anomalies.sql      — Analytics anomalies & scheduled reports
--   05_rls_security.sql             — RLS enforcement, drop anon policies
--   06_rls_fix.sql                  — Authenticated-only access, grant fixes
--   07_project_tasks_columns.sql    — sprint_id + change history on project_tasks
--   08_communications_columns.sql   — likes, voters, member_count, event RSVPs
--   09_chat_members_user_id.sql     — (kept for history) chat FK changes; superseded by 11
--   10_chat_messages_sender_fk.sql  — (kept for history) chat FK changes; superseded by 11
--   11_drop_chat_tables.sql         — Drop all Collaboration Hub / chat tables
--
-- All statements use IF NOT EXISTS / ON CONFLICT guards and are safe
-- to run multiple times.
-- ============================================================

-- Run order: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 11
-- NOTE: 09 and 10 modified chat tables that are dropped by 11.
--       They are kept as files for audit history but not run on fresh installs.
\i 01_schema.sql
\i 02_seed_data.sql
\i 03_notifications_and_push.sql
\i 04_analytics_anomalies.sql
\i 05_rls_security.sql
\i 06_rls_fix.sql
\i 07_project_tasks_columns.sql
\i 08_communications_columns.sql
\i 11_drop_chat_tables.sql

-- ============================================================
-- Done. All migrations applied.
-- ============================================================
