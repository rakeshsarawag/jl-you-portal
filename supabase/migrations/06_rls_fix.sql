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
