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
