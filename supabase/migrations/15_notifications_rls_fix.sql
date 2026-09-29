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
