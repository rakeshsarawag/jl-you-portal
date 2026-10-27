-- Temporary Access Grants (M-24: RBAC time-limited permissions)
-- Note: FK constraints to app_users omitted for portability;
-- referential integrity enforced at application layer.

CREATE TABLE IF NOT EXISTS temporary_access_grants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  granted_by    UUID,
  app_id        TEXT NOT NULL,
  section_id    TEXT,
  reason        TEXT NOT NULL DEFAULT '',
  expires_at    TIMESTAMPTZ NOT NULL,
  is_revoked    BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_by    UUID,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_temp_grants_user    ON temporary_access_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_temp_grants_app     ON temporary_access_grants(app_id);
CREATE INDEX IF NOT EXISTS idx_temp_grants_expires ON temporary_access_grants(expires_at);

-- RLS
ALTER TABLE temporary_access_grants ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "admin_all_temp_grants" ON temporary_access_grants;
CREATE POLICY "admin_all_temp_grants"
  ON temporary_access_grants
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Auto-updated timestamp
CREATE OR REPLACE FUNCTION update_temp_grants_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_temp_grants_updated_at ON temporary_access_grants;
CREATE TRIGGER trg_temp_grants_updated_at
  BEFORE UPDATE ON temporary_access_grants
  FOR EACH ROW EXECUTE FUNCTION update_temp_grants_updated_at();
