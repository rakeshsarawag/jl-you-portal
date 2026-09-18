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
--   01_schema.sql                 — ALL DDL: extensions, tables, indexes,
--                                   constraints, functions, triggers, RLS
--   02_seed_data.sql              — ALL seed/master/lookup/demo data
--   03_notifications_and_push.sql — Notification system & push subscriptions
--
-- All statements use IF NOT EXISTS / ON CONFLICT guards and are safe
-- to run multiple times.
-- ============================================================

-- Run order: 01_schema.sql → 02_seed_data.sql → 03_notifications_and_push.sql
\i 01_schema.sql
\i 02_seed_data.sql
\i 03_notifications_and_push.sql

-- ============================================================
-- Done. All migrations applied.
-- ============================================================
