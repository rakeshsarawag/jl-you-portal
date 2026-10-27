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
