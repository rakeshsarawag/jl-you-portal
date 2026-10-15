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
