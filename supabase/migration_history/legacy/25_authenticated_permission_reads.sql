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
