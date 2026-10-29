-- ============================================================
-- JESHAN LABS HR PORTAL - 04_security_and_access.sql
-- RLS, grants, JWT role claims, and anonymous-access lockdown.
-- Consolidated in effective execution order from legacy security migrations.
-- Idempotent: policies are dropped/replaced or guarded before creation.
-- ============================================================

-- >>> LEGACY SOURCE: 05_rls_security.sql

-- ──────────────────────────────────────────────────────────────────────────────
-- Migration: Enforce authentication on all RLS policies
-- Remove all policies that allow the anon role to access sensitive tables.
-- After this migration, every table in the application requires a valid
-- Supabase user session (authenticated role) to read or write data.
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Drop the explicitly permissive anonymous read policy on employees.
DROP POLICY IF EXISTS "Allow anonymous read on employees" ON employees;

-- 2. Revoke all direct privileges from the anon role on sensitive tables.
--    This is a belt-and-suspenders control on top of RLS — even if a policy
--    has USING (true) with no role restriction, the anon role can't access the
--    table without a privilege grant.
DO $$
DECLARE
  tbl TEXT;
  sensitive_tables TEXT[] := ARRAY[
    'employees',
    'payroll_records',
    'payroll_components',
    'payroll_run_items',
    'payroll_runs',
    'it_tickets',
    'it_ticket_updates',
    'training_courses',
    'training_enrollments',
    'performance_reviews',
    'performance_goals',
    'projects',
    'project_tasks',
    'project_sprints',
    'project_time_logs',
    'project_comments',
    'defect_tracker_projects',
    'defect_tracker_defects',
    'assets',
    'asset_assignments',
    'asset_maintenance',
    'okr',
    'key_results',
    'okr_check_ins',
    'invoices',
    'invoice_items',
    'invoice_payments',
    'recruitment_jobs',
    'recruitment_candidates',
    'recruitment_applications',
    'onboarding_tasks',
    'onboarding_assignments',
    'employee_documents',
    'employee_notes',
    'employee_leaves',
    'leave_requests',
    'communications',
    'communication_participants',
    'notifications',
    'push_subscriptions',
    'workflow_definitions',
    'workflow_instances',
    'workflow_approvals',
    'knowledge_articles',
    'knowledge_categories',
    'master_data_config',
    'app_permissions',
    'audit_logs',
    'analytics_anomalies',
    'scheduled_reports'
  ];
BEGIN
  FOREACH tbl IN ARRAY sensitive_tables LOOP
    -- Only revoke if the table actually exists to avoid errors on partial schemas.
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('REVOKE ALL ON %I FROM anon', tbl);
    END IF;
  END LOOP;
END $$;

-- 3. Drop any remaining policies on sensitive tables that do not restrict to
--    the authenticated role (i.e., policies that implicitly include anon).
--    We identify them by checking pg_policies.roles — if it's empty/null or
--    contains 'public', it applies to all roles including anon.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (roles IS NULL OR roles = '{}' OR 'public' = ANY(roles))
      AND tablename NOT IN ('preboarding_submissions')  -- intentionally public
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 4. Re-create standard authenticated-only policies for the tables that had
--    their policies dropped above. These grant full access to any authenticated
--    user; row-level filtering is handled in application queries.

DO $$
DECLARE
  tbl TEXT;
  standard_tables TEXT[] := ARRAY[
    'employees',
    'payroll_records',
    'payroll_components',
    'payroll_run_items',
    'payroll_runs',
    'it_tickets',
    'it_ticket_updates',
    'training_courses',
    'training_enrollments',
    'performance_reviews',
    'performance_goals',
    'projects',
    'project_tasks',
    'project_sprints',
    'project_time_logs',
    'project_comments',
    'defect_tracker_projects',
    'defect_tracker_defects',
    'assets',
    'asset_assignments',
    'asset_maintenance',
    'okr',
    'key_results',
    'okr_check_ins',
    'invoices',
    'invoice_items',
    'invoice_payments',
    'recruitment_jobs',
    'recruitment_candidates',
    'recruitment_applications',
    'onboarding_tasks',
    'onboarding_assignments',
    'employee_documents',
    'employee_notes',
    'employee_leaves',
    'leave_requests',
    'communications',
    'communication_participants',
    'notifications',
    'push_subscriptions',
    'workflow_definitions',
    'workflow_instances',
    'workflow_approvals',
    'knowledge_articles',
    'knowledge_categories',
    'master_data_config',
    'app_permissions',
    'audit_logs',
    'analytics_anomalies',
    'scheduled_reports'
  ];
BEGIN
  FOREACH tbl IN ARRAY standard_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      -- Ensure RLS is enabled on the table.
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

      -- Create authenticated all-access policy only if none exists yet.
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = tbl
          AND policyname = 'Authenticated users full access'
      ) THEN
        EXECUTE format(
          'CREATE POLICY "Authenticated users full access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
          tbl
        );
      END IF;
    END IF;
  END LOOP;
END $$;

-- 5. preboarding_submissions stays accessible to anon so that candidates can
--    submit their pre-boarding form before they have a Supabase account.
--    All other tables require authentication.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'preboarding_submissions'
  ) THEN
    ALTER TABLE preboarding_submissions ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'preboarding_submissions'
        AND policyname = 'Preboarding submissions public insert'
    ) THEN
      CREATE POLICY "Preboarding submissions public insert"
        ON preboarding_submissions FOR INSERT TO anon WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'preboarding_submissions'
        AND policyname = 'Preboarding submissions authenticated read'
    ) THEN
      CREATE POLICY "Preboarding submissions authenticated read"
        ON preboarding_submissions FOR SELECT TO authenticated USING (true);
    END IF;
  END IF;
END $$;

-- >>> LEGACY SOURCE: 06_rls_fix.sql

-- ──────────────────────────────────────────────────────────────────────────────
-- Migration 06: Enforce authenticated-only access on all sensitive tables.
-- Uses direct SQL statements (no loops) to avoid deadlocks.
-- Run each section separately in the SQL editor if needed.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── SECTION 1: Enable RLS on every sensitive table ───────────────────────────
ALTER TABLE IF EXISTS employees               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payroll_records         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payroll_components      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payroll_run_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payroll_runs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS it_tickets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS it_ticket_updates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS training_courses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS training_enrollments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS performance_reviews     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS performance_goals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS projects                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_sprints         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_time_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS defect_tracker_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS defect_tracker_defects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_defects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assets                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS asset_assignments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS asset_maintenance       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS okr                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS key_results             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS okr_check_ins           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoice_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoice_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recruitment_jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recruitment_candidates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recruitment_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS onboarding_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS onboarding_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employee_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employee_notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employee_leaves         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leave_requests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS communications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS communication_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS push_subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_definitions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_instances      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_approvals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS knowledge_articles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS knowledge_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS master_data_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS app_permissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS analytics_anomalies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scheduled_reports       ENABLE ROW LEVEL SECURITY;

-- ── SECTION 2: Revoke anon access / grant authenticated only ─────────────────
-- REVOKE has no IF EXISTS, so we check table existence first.
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'employees', 'it_tickets', 'payroll_records', 'training_enrollments',
    'performance_reviews', 'projects', 'project_tasks', 'assets',
    'okr', 'key_results', 'invoices', 'recruitment_jobs',
    'recruitment_candidates', 'payroll_components', 'payroll_run_items',
    'payroll_runs', 'it_ticket_updates', 'training_courses',
    'performance_goals', 'project_sprints', 'project_time_logs',
    'project_comments', 'defect_tracker_projects', 'defect_tracker_defects', 'project_defects',
    'asset_assignments', 'asset_maintenance', 'okr_check_ins',
    'invoice_items', 'invoice_payments', 'recruitment_applications',
    'onboarding_tasks', 'onboarding_assignments', 'employee_documents',
    'employee_notes', 'employee_leaves', 'leave_requests',
    'communications', 'communication_participants', 'notifications',
    'push_subscriptions', 'workflow_definitions', 'workflow_instances',
    'workflow_approvals', 'knowledge_articles', 'knowledge_categories',
    'master_data_config', 'app_permissions', 'audit_logs',
    'analytics_anomalies', 'scheduled_reports'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I FROM anon', tbl);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO authenticated', tbl);
    END IF;
  END LOOP;
END $$;

-- ── SECTION 3: Drop known permissive anon policies ───────────────────────────
DO $$
DECLARE
  rec TEXT[];
  known TEXT[][] := ARRAY[
    ARRAY['employees',               'Allow anonymous read on employees'],
    ARRAY['employees',               'Allow all operations on employees'],
    ARRAY['employees',               'Enable read access for all users'],
    ARRAY['it_tickets',              'Allow all operations on it_tickets'],
    ARRAY['payroll_records',         'Allow all operations on payroll_records'],
    ARRAY['training_enrollments',    'Allow all operations on training_enrollments'],
    ARRAY['performance_reviews',     'Allow all operations on performance_reviews'],
    ARRAY['projects',                'Allow all operations on projects'],
    ARRAY['project_tasks',           'Allow all operations on project_tasks'],
    ARRAY['assets',                  'Allow all operations on assets'],
    ARRAY['okr',                     'Allow all operations on okr'],
    ARRAY['key_results',             'Allow all operations on key_results'],
    ARRAY['invoices',                'Allow all operations on invoices'],
    ARRAY['recruitment_jobs',        'Allow all operations on recruitment_jobs'],
    ARRAY['recruitment_candidates',  'Allow all operations on recruitment_candidates']
  ];
BEGIN
  FOREACH rec SLICE 1 IN ARRAY known LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = rec[1]
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', rec[2], rec[1]);
    END IF;
  END LOOP;
END $$;

-- ── SECTION 4: Create authenticated-only policies (skip if already exists) ───
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employees' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='it_tickets' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON it_tickets FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payroll_records' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON payroll_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='training_enrollments' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON training_enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='performance_reviews' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON performance_reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_tasks' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON project_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='assets' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON assets FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='okr')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='okr' AND policyname='Authenticated users full access')
  THEN
    CREATE POLICY "Authenticated users full access" ON okr FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='key_results')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='key_results' AND policyname='Authenticated users full access')
  THEN
    CREATE POLICY "Authenticated users full access" ON key_results FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recruitment_jobs' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON recruitment_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recruitment_candidates' AND policyname='Authenticated users full access') THEN
    CREATE POLICY "Authenticated users full access" ON recruitment_candidates FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_defects')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_defects' AND policyname='Authenticated users full access')
  THEN
    CREATE POLICY "Authenticated users full access" ON project_defects FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── SECTION 5: Diagnostic — verify the fix ───────────────────────────────────
-- Run this after the migration. anon_has_select should be FALSE for all rows.
SELECT
  t.table_name,
  c.relrowsecurity AS rls_enabled,
  EXISTS (
    SELECT 1 FROM information_schema.role_table_grants g
    WHERE g.table_schema = 'public'
      AND g.table_name = t.table_name
      AND g.grantee = 'anon'
      AND g.privilege_type = 'SELECT'
  ) AS anon_has_select
FROM information_schema.tables t
JOIN pg_class c ON c.relname = t.table_name AND c.relnamespace = 'public'::regnamespace
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name IN (
    'employees','it_tickets','payroll_records','training_enrollments',
    'performance_reviews','projects','project_tasks','assets','okr',
    'key_results','invoices','recruitment_jobs','recruitment_candidates'
  )
ORDER BY t.table_name;

-- >>> LEGACY SOURCE: 15_notifications_rls_fix.sql

-- Migration 15: Fix notifications RLS — allow authenticated users to update
-- and delete their own notifications.
--
-- Root cause: the base notifications table uses user_id TEXT (matching either
-- auth.users.id or app_users.id). We widen the UPDATE policy (already done in
-- migration 03, but re-applied here for idempotency) and add a DELETE policy
-- so the bell tray delete/delete-all-read operations actually persist to the DB.

-- ── UPDATE ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can update notifications" ON notifications;

CREATE POLICY "Authenticated users can update notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── DELETE ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can delete notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

CREATE POLICY "Authenticated users can delete notifications"
  ON notifications FOR DELETE TO authenticated
  USING (true);

-- >>> LEGACY SOURCE: 20_enforce_auth_rls.sql

-- Migration 20: Enforce authenticated-only access across ALL tables
-- Drops any remaining open policies (USING (true) without a role restriction)
-- and ensures every table requires auth.uid() IS NOT NULL before returning data.

-- ── 1. Fix task_comments (migration 18 left these open to anon) ──────────────
DROP POLICY IF EXISTS "task_comments_select" ON task_comments;
DROP POLICY IF EXISTS "task_comments_insert" ON task_comments;
DROP POLICY IF EXISTS "task_comments_update" ON task_comments;
DROP POLICY IF EXISTS "task_comments_delete" ON task_comments;

CREATE POLICY "task_comments_select" ON task_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_comments_insert" ON task_comments
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "task_comments_update" ON task_comments
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "task_comments_delete" ON task_comments
  FOR DELETE TO authenticated USING (true);

-- ── 2. Ensure RLS is enabled and authenticated-only on every table ────────────
-- This loop runs over ALL user tables, enables RLS if not already on,
-- drops any open anon-accessible policies, and adds a catch-all authenticated
-- policy if none exists yet. Tables with existing fine-grained policies keep them.
DO $$
DECLARE
  tbl  TEXT;
  pol  TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    -- Exclude Supabase internal tables
    AND tablename NOT IN (
      'schema_migrations', 'spatial_ref_sys', 'geography_columns',
      'geometry_columns', 'raster_columns', 'raster_overviews'
    )
  LOOP
    -- Enable RLS (idempotent)
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    -- Drop policies that are open to anon / public (no role or TO public/anon)
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND (roles = '{public}' OR roles = '{anon}' OR roles IS NULL OR roles = '{}')
        -- Keep preboarding_submissions anon INSERT (external candidates)
        AND NOT (tbl = 'preboarding_submissions' AND cmd = 'INSERT')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, tbl);
    END LOOP;

    -- Add a default authenticated catch-all if the table has NO policies at all
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format(
        'CREATE POLICY "Authenticated users full access" ON %I
         FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- ── 3. Revoke anon SELECT on all public tables ────────────────────────────────
-- Belt-and-suspenders: even if a policy is misconfigured, the anon role
-- has no table-level SELECT grant.
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    AND tablename NOT IN ('preboarding_submissions')
  LOOP
    EXECUTE format('REVOKE SELECT, INSERT, UPDATE, DELETE ON %I FROM anon', tbl);
  END LOOP;
END $$;

-- ── 4. Grant authenticated role full access on all tables ─────────────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated', tbl
    );
  END LOOP;
END $$;

-- >>> LEGACY SOURCE: 21_auth_hook_and_row_rls.sql

-- Migration 21: Auth Hook + Row-Level RLS Policies
--
-- PART A: Supabase Custom Access Token Hook
--   Embeds the user's role and employee_id into the JWT on every login.
--   After applying this SQL, enable the hook manually in the Supabase Dashboard:
--     Authentication → Hooks → Custom Access Token → select function
--     "public.custom_access_token_hook"
--
-- PART B: Row-level RLS policies for sensitive tables
--   Employees can only read their OWN data (payroll, leaves, performance,
--   attendance). HR/admin/finance/manager can read all rows.

-- ============================================================
-- PART A — Custom Access Token Hook
-- ============================================================

-- Allow the supabase_auth_admin role to call this function
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims      jsonb;
  user_role   text;
  emp_id      text;
BEGIN
  -- Guard: if event is somehow null, return a minimal valid object
  IF event IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  -- COALESCE ensures claims is always an object even if the key is absent
  claims := COALESCE(event -> 'claims', '{}'::jsonb);

  -- Inner block so a DB lookup failure does not abort the whole hook
  BEGIN
    SELECT
      COALESCE(primary_role, 'employee'),
      employee_id::text
    INTO user_role, emp_id
    FROM public.app_users
    WHERE auth_user_id = (event ->> 'user_id')::uuid
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    user_role := 'employee';
    emp_id    := NULL;
  END;

  user_role := COALESCE(user_role, 'employee');

  claims := jsonb_set(claims, '{app_role}',   to_jsonb(user_role),         true);
  claims := jsonb_set(claims, '{app_emp_id}', to_jsonb(COALESCE(emp_id, '')), true);

  RETURN jsonb_set(event, '{claims}', claims, true);

EXCEPTION WHEN OTHERS THEN
  -- Outer safety net: never return NULL — always return event unmodified
  RETURN COALESCE(event, '{}'::jsonb);
END;
$$;

-- Grant execute to supabase_auth_admin so the hook can call it
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- ============================================================
-- PART B — Row-Level RLS Policies for sensitive tables
-- Uses auth.jwt() claims set by the hook above.
-- Falls back to a permissive policy for admin/hr/finance/manager.
-- ============================================================

-- Helper: returns the app_role claim from the JWT
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(auth.jwt() ->> 'app_role', 'employee');
$$;

-- Helper: returns the employee_id claim from the JWT
CREATE OR REPLACE FUNCTION public.get_my_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT (auth.jwt() ->> 'app_emp_id')::uuid;
$$;

-- Helper: true if the current user is an elevated role
CREATE OR REPLACE FUNCTION public.is_elevated()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT public.get_my_role() IN ('admin', 'hr', 'finance', 'manager');
$$;

-- ── payroll_records ──────────────────────────────────────────────────────────
-- Employees see only their own payroll record. HR/finance/admin/manager see all.
DROP POLICY IF EXISTS "Authenticated users full access" ON payroll_records;
DROP POLICY IF EXISTS "payroll_own_read" ON payroll_records;
DROP POLICY IF EXISTS "payroll_elevated_read" ON payroll_records;
DROP POLICY IF EXISTS "payroll_write" ON payroll_records;

CREATE POLICY "payroll_elevated_read" ON payroll_records
  FOR SELECT TO authenticated
  USING (public.is_elevated());

CREATE POLICY "payroll_own_read" ON payroll_records
  FOR SELECT TO authenticated
  USING (
    NOT public.is_elevated()
    AND employee_id = public.get_my_employee_id()
  );

CREATE POLICY "payroll_write" ON payroll_records
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'hr', 'finance'))
  WITH CHECK (public.get_my_role() IN ('admin', 'hr', 'finance'));

-- ── leaves ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users full access" ON leaves;
DROP POLICY IF EXISTS "leaves_own_read" ON leaves;
DROP POLICY IF EXISTS "leaves_elevated_read" ON leaves;
DROP POLICY IF EXISTS "leaves_write" ON leaves;

CREATE POLICY "leaves_elevated_read" ON leaves
  FOR SELECT TO authenticated USING (public.is_elevated());

CREATE POLICY "leaves_own_read" ON leaves
  FOR SELECT TO authenticated
  USING (
    NOT public.is_elevated()
    AND employee_id = public.get_my_employee_id()
  );

CREATE POLICY "leaves_write" ON leaves
  FOR ALL TO authenticated
  USING (
    public.get_my_role() IN ('admin', 'hr', 'manager')
    OR employee_id = public.get_my_employee_id()
  )
  WITH CHECK (
    public.get_my_role() IN ('admin', 'hr', 'manager')
    OR employee_id = public.get_my_employee_id()
  );

-- ── attendance ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users full access" ON attendance;
DROP POLICY IF EXISTS "attendance_own_read" ON attendance;
DROP POLICY IF EXISTS "attendance_elevated_read" ON attendance;
DROP POLICY IF EXISTS "attendance_write" ON attendance;

CREATE POLICY "attendance_elevated_read" ON attendance
  FOR SELECT TO authenticated USING (public.is_elevated());

CREATE POLICY "attendance_own_read" ON attendance
  FOR SELECT TO authenticated
  USING (
    NOT public.is_elevated()
    AND employee_id = public.get_my_employee_id()
  );

CREATE POLICY "attendance_write" ON attendance
  FOR ALL TO authenticated
  USING (
    public.get_my_role() IN ('admin', 'hr')
    OR employee_id = public.get_my_employee_id()
  )
  WITH CHECK (
    public.get_my_role() IN ('admin', 'hr')
    OR employee_id = public.get_my_employee_id()
  );

-- ── performance_reviews ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users full access" ON performance_reviews;
DROP POLICY IF EXISTS "perf_own_read" ON performance_reviews;
DROP POLICY IF EXISTS "perf_elevated_read" ON performance_reviews;
DROP POLICY IF EXISTS "perf_write" ON performance_reviews;

CREATE POLICY "perf_elevated_read" ON performance_reviews
  FOR SELECT TO authenticated USING (public.is_elevated());

CREATE POLICY "perf_own_read" ON performance_reviews
  FOR SELECT TO authenticated
  USING (
    NOT public.is_elevated()
    AND employee_id = public.get_my_employee_id()
  );

CREATE POLICY "perf_write" ON performance_reviews
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'hr', 'manager'))
  WITH CHECK (public.get_my_role() IN ('admin', 'hr', 'manager'));

-- ── salary_structures / salary_revision_history ──────────────────────────────
DROP POLICY IF EXISTS "Authenticated users full access" ON salary_structures;
DROP POLICY IF EXISTS "salary_own_read" ON salary_structures;
DROP POLICY IF EXISTS "salary_elevated_all" ON salary_structures;

CREATE POLICY "salary_elevated_all" ON salary_structures
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'hr', 'finance'))
  WITH CHECK (public.get_my_role() IN ('admin', 'hr', 'finance'));

CREATE POLICY "salary_own_read" ON salary_structures
  FOR SELECT TO authenticated
  USING (
    NOT public.get_my_role() IN ('admin', 'hr', 'finance')
    AND employee_id = public.get_my_employee_id()
  );

DROP POLICY IF EXISTS "Authenticated users full access" ON salary_revision_history;
DROP POLICY IF EXISTS "sal_rev_own_read" ON salary_revision_history;
DROP POLICY IF EXISTS "sal_rev_elevated_all" ON salary_revision_history;

CREATE POLICY "sal_rev_elevated_all" ON salary_revision_history
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'hr', 'finance'))
  WITH CHECK (public.get_my_role() IN ('admin', 'hr', 'finance'));

CREATE POLICY "sal_rev_own_read" ON salary_revision_history
  FOR SELECT TO authenticated
  USING (
    NOT public.get_my_role() IN ('admin', 'hr', 'finance')
    AND employee_id = public.get_my_employee_id()
  );

-- ── payslips ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users full access" ON payslips;
DROP POLICY IF EXISTS "payslips_own_read" ON payslips;
DROP POLICY IF EXISTS "payslips_elevated_all" ON payslips;

CREATE POLICY "payslips_elevated_all" ON payslips
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'hr', 'finance'))
  WITH CHECK (public.get_my_role() IN ('admin', 'hr', 'finance'));

CREATE POLICY "payslips_own_read" ON payslips
  FOR SELECT TO authenticated
  USING (
    NOT public.get_my_role() IN ('admin', 'hr', 'finance')
    AND employee_id = public.get_my_employee_id()
  );

-- ── audit_logs — admin/hr only ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users full access" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_admin_hr" ON audit_logs;

CREATE POLICY "audit_logs_admin_hr" ON audit_logs
  FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'hr'))
  WITH CHECK (public.get_my_role() IN ('admin', 'hr'));

-- ── app_users — admin only for sensitive operations ──────────────────────────
DROP POLICY IF EXISTS "Authenticated users full access" ON app_users;
DROP POLICY IF EXISTS "app_users_admin_all" ON app_users;
DROP POLICY IF EXISTS "app_users_self_read" ON app_users;

CREATE POLICY "app_users_admin_all" ON app_users
  FOR ALL TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Every user can read their own app_users record
CREATE POLICY "app_users_self_read" ON app_users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- ── role_permissions / custom_roles — admin only ──────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Service role can manage role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "role_permissions_admin" ON role_permissions;

CREATE POLICY "role_permissions_admin" ON role_permissions
  FOR ALL TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "Authenticated users full access" ON custom_roles;
DROP POLICY IF EXISTS "custom_roles_admin" ON custom_roles;

CREATE POLICY "custom_roles_admin" ON custom_roles
  FOR ALL TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ============================================================
-- PART B done.
-- ============================================================
-- REMINDER: After applying this migration, go to:
--   Supabase Dashboard → Authentication → Hooks
--   → Custom Access Token → set function to: public.custom_access_token_hook
-- This embeds app_role + app_emp_id into the JWT so RLS policies above
-- work without any DB lookup per row.
-- ============================================================

-- >>> LEGACY SOURCE: 22_deny_anon_rest_api.sql

-- Migration 22: Explicit anon denial on Supabase REST API
--
-- Locks down the Supabase REST API (/rest/v1/) so the anon key alone
-- cannot read any application data. Uses pg_policies (roles name[])
-- instead of pg_catalog.pg_policy (polroles oid[]) to avoid type errors.

-- ── Step 1: Drop all anon/public policies and add explicit DENY ───────────────
DO $$
DECLARE
  tbl  TEXT;
  pol  TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT IN ('preboarding_submissions')
  LOOP
    -- Drop policies that apply to the anon role or the PUBLIC pseudo-role.
    -- pg_policies.roles is name[] so @> works correctly here.
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND (
          roles @> ARRAY['anon']::name[]
          OR roles @> ARRAY['public']::name[]
        )
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, tbl);
    END LOOP;

    -- Add an explicit DENY policy for anon (belt-and-suspenders on top of REVOKE)
    BEGIN
      EXECUTE format(
        'CREATE POLICY "deny_anon_all" ON %I
         FOR ALL TO anon
         USING (false)
         WITH CHECK (false)',
        tbl
      );
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- already exists from a previous run, that is fine
    END;
  END LOOP;
END $$;

-- ── Step 2: Revoke all table-level grants from anon ───────────────────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I FROM anon', tbl);
  END LOOP;
END $$;

-- ── Step 3: Revoke sequence access from anon ──────────────────────────────────
DO $$
DECLARE seq TEXT;
BEGIN
  FOR seq IN
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON SEQUENCE %I FROM anon', seq);
  END LOOP;
END $$;

-- ── Step 4: Revoke schema introspection from anon ─────────────────────────────
-- Prevents PostgREST from exposing table definitions to unauthenticated callers.
REVOKE USAGE ON SCHEMA public FROM anon;

-- Grant schema access back only to authenticated roles
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- ── Step 5: Restore grants for authenticated users on all tables ──────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO authenticated',
      tbl
    );
  END LOOP;
END $$;

-- Restore sequence access for authenticated users
DO $$
DECLARE seq TEXT;
BEGIN
  FOR seq IN
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format(
      'GRANT USAGE, SELECT ON SEQUENCE %I TO authenticated',
      seq
    );
  END LOOP;
END $$;

-- ── Step 6: Restore minimal anon access for the preboarding form only ─────────
-- External candidates submit through this table without logging in.
GRANT USAGE ON SCHEMA public TO anon;
GRANT INSERT ON TABLE preboarding_submissions TO anon;

DROP POLICY IF EXISTS "deny_anon_all" ON preboarding_submissions;
DROP POLICY IF EXISTS "Preboarding submissions public insert" ON preboarding_submissions;

CREATE POLICY "Preboarding submissions public insert"
  ON preboarding_submissions FOR INSERT TO anon
  WITH CHECK (true);

-- >>> LEGACY SOURCE: 23_close_remaining_anon_surfaces.sql

-- Migration 23: Close anonymous access through views, RPCs, and future objects.
--
-- Migration 22 secures current public tables. This migration also covers views
-- (which do not appear in pg_tables), functions exposed through /rest/v1/rpc,
-- and objects created by later migrations.

-- PUBLIC privileges are inherited by anon, so revoke from both roles.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Prevent newly created tables, sequences, and functions from becoming
-- anonymously accessible through PostgreSQL's default privileges.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Existing application RPCs remain available only to authenticated sessions.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- The sole intentional anonymous operation is submitting the external
-- preboarding form. It has INSERT only: no SELECT means Prefer:
-- return=representation cannot disclose the inserted or existing rows.
GRANT USAGE ON SCHEMA public TO anon;
GRANT INSERT ON TABLE public.preboarding_submissions TO anon;

REVOKE SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.preboarding_submissions FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- >>> LEGACY SOURCE: 24_fix_app_user_role_resolution.sql

-- Migration 24: Reconcile app_users with Supabase Auth and issue correct roles.
--
-- Legacy app_users records can have a NULL auth_user_id or a stale
-- primary_role even though roles contains an elevated role. That made the UI
-- show an administrator while API/RLS authorization treated the same user as
-- an employee.

-- Link unambiguous legacy app_users rows to auth.users by normalized email.
UPDATE public.app_users AS app_user
SET auth_user_id = auth_user.id,
    updated_at = NOW()
FROM auth.users AS auth_user
WHERE app_user.auth_user_id IS NULL
  AND auth_user.email IS NOT NULL
  AND LOWER(app_user.email) = LOWER(auth_user.email)
  AND NOT EXISTS (
    SELECT 1
    FROM public.app_users AS linked
    WHERE linked.auth_user_id = auth_user.id
  )
  AND (
    SELECT COUNT(*)
    FROM public.app_users AS candidate
    WHERE LOWER(candidate.email) = LOWER(auth_user.email)
  ) = 1;

-- Keep the stored primary role consistent with the priority already used by
-- the frontend. The JSONB `?` operator checks array membership.
UPDATE public.app_users
SET primary_role = CASE
      WHEN roles ? 'admin' THEN 'admin'
      WHEN roles ? 'hr' THEN 'hr'
      WHEN roles ? 'finance' THEN 'finance'
      WHEN roles ? 'manager' THEN 'manager'
      WHEN roles ? 'it' THEN 'it'
      WHEN roles ? 'marketing' THEN 'marketing'
      WHEN roles ? 'client' THEN 'client'
      WHEN roles ? 'employee' THEN 'employee'
      WHEN primary_role IN (
        'admin', 'hr', 'finance', 'manager', 'it', 'marketing', 'client', 'employee'
      ) THEN primary_role
      ELSE 'employee'
    END,
    updated_at = NOW()
WHERE roles IS NOT NULL;

-- Issue app_role/app_emp_id from the reconciled database record. UUID matching
-- remains preferred; verified JWT email is a fallback for any row that could
-- not be backfilled.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims      jsonb;
  user_role   text;
  emp_id      text;
  jwt_email   text;
BEGIN
  IF event IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  claims := COALESCE(event -> 'claims', '{}'::jsonb);
  jwt_email := claims ->> 'email';

  BEGIN
    SELECT
      CASE
        WHEN roles ? 'admin' THEN 'admin'
        WHEN roles ? 'hr' THEN 'hr'
        WHEN roles ? 'finance' THEN 'finance'
        WHEN roles ? 'manager' THEN 'manager'
        WHEN roles ? 'it' THEN 'it'
        WHEN roles ? 'marketing' THEN 'marketing'
        WHEN roles ? 'client' THEN 'client'
        WHEN roles ? 'employee' THEN 'employee'
        WHEN primary_role IN (
          'admin', 'hr', 'finance', 'manager', 'it', 'marketing', 'client', 'employee'
        ) THEN primary_role
        ELSE 'employee'
      END,
      employee_id::text
    INTO user_role, emp_id
    FROM public.app_users
    WHERE auth_user_id = (event ->> 'user_id')::uuid
       OR (
         auth_user_id IS NULL
         AND
         jwt_email IS NOT NULL
         AND LOWER(email) = LOWER(jwt_email)
       )
    ORDER BY (auth_user_id = (event ->> 'user_id')::uuid) DESC
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    user_role := 'employee';
    emp_id := NULL;
  END;

  user_role := COALESCE(user_role, 'employee');
  claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role), true);
  claims := jsonb_set(
    claims,
    '{app_emp_id}',
    to_jsonb(COALESCE(emp_id, '')),
    true
  );

  RETURN jsonb_set(event, '{claims}', claims, true);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(event, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb)
  TO supabase_auth_admin;

-- >>> LEGACY SOURCE: 25_authenticated_permission_reads.sql

-- Migration 25: Permission definitions drive authenticated UI access.
--
-- All authenticated users need SELECT access to role_permissions so the
-- portal can decide which apps and sections to show. Mutations remain limited
-- to the existing admin policy and service role.

DROP POLICY IF EXISTS "Authenticated users can read role_permissions"
  ON public.role_permissions;

CREATE POLICY "Authenticated users can read role_permissions"
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON TABLE public.role_permissions TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- DEFECT TRACKER: PROJECT MEMBERSHIP ACCESS
-- Admins can access every defect. Other authenticated users can access defects
-- only when their linked employee record is present in project_members.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.defect_tracker_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users AS app_user
    WHERE (
      app_user.auth_user_id = auth.uid()
      OR (
        app_user.auth_user_id IS NULL
        AND LOWER(app_user.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      )
    )
    AND (
      app_user.roles ? 'admin'
      OR app_user.primary_role = 'admin'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.defect_tracker_current_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT app_user.employee_id
      FROM public.app_users AS app_user
      WHERE (
        app_user.auth_user_id = auth.uid()
        OR LOWER(app_user.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      )
      ORDER BY (app_user.auth_user_id = auth.uid()) DESC NULLS LAST
      LIMIT 1
    ),
    (
      SELECT employee.id
      FROM public.employees AS employee
      WHERE (
        employee.auth_user_id = auth.uid()
        OR LOWER(employee.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      )
      ORDER BY (employee.auth_user_id = auth.uid()) DESC NULLS LAST
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.defect_tracker_can_access_project(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.defect_tracker_is_admin()
    OR (
      target_project_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.project_members AS membership
        WHERE membership.project_id = target_project_id
          AND membership.employee_id = public.defect_tracker_current_employee_id()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.defect_tracker_is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.defect_tracker_current_employee_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.defect_tracker_can_access_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.defect_tracker_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.defect_tracker_current_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.defect_tracker_can_access_project(uuid) TO authenticated;

DROP POLICY IF EXISTS "Authenticated users full access" ON public.project_defects;
DROP POLICY IF EXISTS "project_defects_open_access" ON public.project_defects;
DROP POLICY IF EXISTS "project_defects_project_access" ON public.project_defects;
CREATE POLICY "project_defects_project_access"
  ON public.project_defects
  FOR ALL
  TO authenticated
  USING (public.defect_tracker_can_access_project(project_id))
  WITH CHECK (public.defect_tracker_can_access_project(project_id));

DROP POLICY IF EXISTS "Authenticated users full access" ON public.project_members;
DROP POLICY IF EXISTS "project_members_authenticated_read" ON public.project_members;
DROP POLICY IF EXISTS "project_members_admin_write" ON public.project_members;
CREATE POLICY "project_members_authenticated_read"
  ON public.project_members
  FOR SELECT
  TO authenticated
  USING (
    public.defect_tracker_is_admin()
    OR employee_id = public.defect_tracker_current_employee_id()
  );
CREATE POLICY "project_members_admin_write"
  ON public.project_members
  FOR ALL
  TO authenticated
  USING (public.defect_tracker_is_admin())
  WITH CHECK (public.defect_tracker_is_admin());

DO $$
DECLARE
  child_table text;
  child_tables text[] := ARRAY[
    'defect_comments',
    'defect_activity_log',
    'defect_linked_items',
    'defect_sla_events'
  ];
BEGIN
  FOREACH child_table IN ARRAY child_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', child_table || '_open_access', child_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', child_table || '_project_access', child_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
       USING (
         EXISTS (
           SELECT 1 FROM public.project_defects AS defect
           WHERE defect.id = %I.defect_id
             AND public.defect_tracker_can_access_project(defect.project_id)
         )
       )
       WITH CHECK (
         EXISTS (
           SELECT 1 FROM public.project_defects AS defect
           WHERE defect.id = %I.defect_id
             AND public.defect_tracker_can_access_project(defect.project_id)
         )
       )',
      child_table || '_project_access',
      child_table,
      child_table,
      child_table
    );
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- REUSABLE ENTITY ATTACHMENTS
-- Unknown entity types are denied by default. Add an explicit branch here when
-- another app integrates the shared attachment component.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.portal_attachment_can_access(
  target_entity_type TEXT,
  target_entity_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_entity_type = 'defect' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.project_defects AS defect
      WHERE defect.id::TEXT = target_entity_id
        AND public.defect_tracker_can_access_project(defect.project_id)
    );
  END IF;

  RETURN FALSE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.portal_attachment_can_access(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_attachment_can_access(TEXT, TEXT) TO authenticated;

ALTER TABLE public.entity_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.entity_attachments;
DROP POLICY IF EXISTS "entity_attachments_project_read" ON public.entity_attachments;
DROP POLICY IF EXISTS "entity_attachments_project_insert" ON public.entity_attachments;
DROP POLICY IF EXISTS "entity_attachments_owner_delete" ON public.entity_attachments;

CREATE POLICY "entity_attachments_project_read"
  ON public.entity_attachments
  FOR SELECT TO authenticated
  USING (public.portal_attachment_can_access(entity_type, entity_id));

CREATE POLICY "entity_attachments_project_insert"
  ON public.entity_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()::TEXT
    AND storage_bucket = 'portal-attachments'
    AND public.portal_attachment_can_access(entity_type, entity_id)
  );

CREATE POLICY "entity_attachments_owner_delete"
  ON public.entity_attachments
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()::TEXT
    OR public.defect_tracker_is_admin()
    OR (
      entity_type = 'defect'
      AND public.portal_attachment_can_access(entity_type, entity_id)
      AND EXISTS (
        SELECT 1
        FROM public.project_defects AS defect
        WHERE defect.id::TEXT = entity_id
          AND defect.status = 'Closed'
      )
    )
  );

GRANT SELECT, INSERT, DELETE ON TABLE public.entity_attachments TO authenticated;
REVOKE UPDATE ON TABLE public.entity_attachments FROM authenticated;

DROP POLICY IF EXISTS "portal_attachments_project_read" ON storage.objects;
DROP POLICY IF EXISTS "portal_attachments_project_insert" ON storage.objects;
DROP POLICY IF EXISTS "portal_attachments_owner_delete" ON storage.objects;

CREATE POLICY "portal_attachments_project_read"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'portal-attachments'
    AND public.portal_attachment_can_access(
      (storage.foldername(name))[1],
      (storage.foldername(name))[2]
    )
  );

CREATE POLICY "portal_attachments_project_insert"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'portal-attachments'
    AND public.portal_attachment_can_access(
      (storage.foldername(name))[1],
      (storage.foldername(name))[2]
    )
  );

CREATE POLICY "portal_attachments_owner_delete"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'portal-attachments'
    AND (
      owner_id = auth.uid()::TEXT
      OR public.defect_tracker_is_admin()
      OR (
        (storage.foldername(name))[1] = 'defect'
        AND public.portal_attachment_can_access(
          (storage.foldername(name))[1],
          (storage.foldername(name))[2]
        )
        AND EXISTS (
          SELECT 1
          FROM public.project_defects AS defect
          WHERE defect.id::TEXT = (storage.foldername(name))[2]
            AND defect.status = 'Closed'
        )
      )
    )
  );
