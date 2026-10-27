-- ============================================================
-- MIGRATION 08: Communications Hub column additions
-- ============================================================

-- communications_posts: add likes tracking
-- (image_urls, file_attachment_urls, is_pinned, scheduled_at already added in 01_schema.sql ALTER TABLE)
ALTER TABLE communications_posts
  ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes_by JSONB DEFAULT '[]'::jsonb;

-- communications_polls: add voters tracking for dedup / already-voted checks
ALTER TABLE communications_polls
  ADD COLUMN IF NOT EXISTS voters JSONB DEFAULT '[]'::jsonb;

-- communications_channels: add member_count for display
ALTER TABLE communications_channels
  ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;

-- communications_event_rsvps: the component identifies users via user_id (not employee_id)
-- Add user_id column so upsert ON CONFLICT (event_id, user_id) works
ALTER TABLE communications_event_rsvps
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Unique constraint matching the component's onConflict target
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'communications_event_rsvps_event_id_user_id_key'
  ) THEN
    ALTER TABLE communications_event_rsvps
      ADD CONSTRAINT communications_event_rsvps_event_id_user_id_key
      UNIQUE (event_id, user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_comm_event_rsvps_user ON communications_event_rsvps(event_id, user_id);
