-- ============================================================
-- JESHAN LABS HR PORTAL — NOTIFICATIONS & PUSH
-- Source: 12_notifications_complete.sql
-- Fully idempotent: safe to run multiple times.
-- ============================================================

-- ============================================================
-- 12_notifications_complete.sql
-- Complete notification system setup — idempotent, safe to re-run.
-- Supersedes and merges: 08, 09, 10, 11 migrations.
-- ============================================================

-- ============================================================
-- SECTION 1: Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- SECTION 2: push_subscriptions table
-- user_id TEXT to match notifications.user_id
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text        NOT NULL,
  endpoint   text        NOT NULL UNIQUE,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can manage their own push subscriptions"
  ON push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Service role can manage push_subscriptions" ON push_subscriptions;
CREATE POLICY "Service role can manage push_subscriptions"
  ON push_subscriptions FOR ALL TO service_role USING (true);

-- ============================================================
-- SECTION 3: notifications table — add missing columns
-- The base table exists in 01_schema.sql; this adds columns
-- that the frontend depends on.
-- ============================================================
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS is_read       boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS app_filter    text        DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS severity      text        DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS deep_link     text,
  ADD COLUMN IF NOT EXISTS action_data   jsonb,
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz,
  ADD COLUMN IF NOT EXISTS read_at       timestamptz,
  ADD COLUMN IF NOT EXISTS metadata      jsonb;

-- Keep legacy "read" boolean and new is_read in sync.
-- "read" is a reserved keyword and must be double-quoted.
CREATE OR REPLACE FUNCTION sync_notification_read_columns()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_read IS TRUE THEN
      NEW."read" := TRUE;
    ELSIF NEW."read" IS TRUE THEN
      NEW.is_read := TRUE;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_read IS DISTINCT FROM OLD.is_read THEN
      NEW."read" := NEW.is_read;
    ELSIF NEW."read" IS DISTINCT FROM OLD."read" THEN
      NEW.is_read := NEW."read";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_read_cols ON notifications;
CREATE TRIGGER sync_read_cols
  BEFORE INSERT OR UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION sync_notification_read_columns();

-- ============================================================
-- SECTION 4: notification_preferences table
-- Already exists from 05_hr_spec_gaps.sql with employee_id.
-- Add user_id TEXT + quiet-hours columns if missing.
-- ============================================================
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS user_id             text,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start   text    DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_end     text    DEFAULT '07:00';

-- Unique index on user_id (partial — only for non-null values)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_notif_prefs_user_id'
  ) THEN
    CREATE UNIQUE INDEX idx_notif_prefs_user_id
      ON notification_preferences(user_id)
      WHERE user_id IS NOT NULL;
  END IF;
END;
$$;

-- ============================================================
-- SECTION 5: RLS policies
--
-- notifications:
--   - INSERT: any authenticated user (inserts target other users)
--   - SELECT/UPDATE: open to authenticated (app layer filters by user_id;
--     user_id is inserted inconsistently as auth UUID / app_users.id /
--     employee_id so a column-level policy cannot reliably match all cases)
--
-- app_users:
--   - SELECT: open to authenticated (roles/names are internal, not sensitive)
-- ============================================================

-- Drop any existing conflicting notification policies
DO $$
DECLARE pol text;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'notifications' AND schemaname = 'public'
      AND policyname NOT IN ('Service role can manage notifications')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON notifications', pol);
  END LOOP;
END;
$$;

CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read notifications"
  ON notifications FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (true);

-- Drop any existing app_users SELECT policies and create a clean one
DO $$
DECLARE pol text;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'app_users' AND schemaname = 'public'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON app_users', pol);
  END LOOP;
END;
$$;

CREATE POLICY "Authenticated users can read app_users"
  ON app_users FOR SELECT TO authenticated
  USING (true);

-- ============================================================
-- SECTION 6: push notification functions + trigger
-- ============================================================
CREATE OR REPLACE FUNCTION send_push_to_user(
  p_user_id text,
  p_title   text,
  p_body    text,
  p_link    text DEFAULT '/'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sub     record;
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object('title', p_title, 'body', p_body, 'link', p_link);
  FOR v_sub IN
    SELECT endpoint FROM push_subscriptions WHERE user_id = p_user_id
  LOOP
    PERFORM net.http_post(
      url     := v_sub.endpoint,
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body    := v_payload::text
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_push_on_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  BEGIN
    PERFORM send_push_to_user(
      NEW.user_id,
      NEW.title,
      COALESCE(NEW.message, ''),
      COALESCE(NEW.metadata->>'link', '/')
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_on_notification_insert ON notifications;
CREATE TRIGGER push_on_notification_insert
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION trigger_push_on_notification();

-- ============================================================
-- SECTION 7: Realtime — add notifications to publication
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END;
$$;

-- ============================================================
-- SECTION 8: Rebuild index on notifications
-- ============================================================
DROP INDEX IF EXISTS idx_notifications_user;
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, is_read, created_at DESC);

-- ============================================================
-- VAPID private key: run ONCE manually if not already stored:
--
--   SELECT vault.create_secret(
--     'EdnX7O-X8cVrQcgBuLlqubsbFo1w586rYk1wGu9JRFI',
--     'vapid_private_key'
--   );
-- ============================================================
