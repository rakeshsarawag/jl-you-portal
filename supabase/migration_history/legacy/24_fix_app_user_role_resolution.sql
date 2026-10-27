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
      WHEN roles ? 'employee' THEN 'employee'
      WHEN primary_role IN (
        'admin', 'hr', 'finance', 'manager', 'it', 'marketing', 'employee'
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
        WHEN roles ? 'employee' THEN 'employee'
        WHEN primary_role IN (
          'admin', 'hr', 'finance', 'manager', 'it', 'marketing', 'employee'
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
