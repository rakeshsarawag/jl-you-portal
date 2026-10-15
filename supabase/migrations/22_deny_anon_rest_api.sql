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
