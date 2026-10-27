-- Migration 09: Make chat_channel_members work for users without employee records.
-- The employee_id FK blocks DMs for users whose app_users.employee_id is null.
-- Solution: drop the FK, add a user_id column (auth UUID) as alternative identifier.

-- Drop FK so any UUID can be stored
ALTER TABLE chat_channel_members
  DROP CONSTRAINT IF EXISTS chat_channel_members_employee_id_fkey;

-- Drop the UNIQUE constraint on (channel_id, employee_id) — will recreate below
ALTER TABLE chat_channel_members
  DROP CONSTRAINT IF EXISTS chat_channel_members_channel_id_employee_id_key;

-- Add user_id column (Supabase auth UUID or app_users.id)
ALTER TABLE chat_channel_members
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Back-fill user_id from app_users for existing rows
UPDATE chat_channel_members ccm
SET user_id = au.id
FROM app_users au
WHERE au.employee_id = ccm.employee_id
  AND ccm.user_id IS NULL;

-- New unique constraint covers both scenarios
ALTER TABLE chat_channel_members
  DROP CONSTRAINT IF EXISTS chat_channel_members_channel_user_unique;

ALTER TABLE chat_channel_members
  ADD CONSTRAINT chat_channel_members_channel_user_unique
  UNIQUE (channel_id, user_id);

CREATE INDEX IF NOT EXISTS idx_chat_channel_members_user_id
  ON chat_channel_members(user_id);

-- Also do the same for chat_channels created_by (drop employee FK)
ALTER TABLE chat_channels
  DROP CONSTRAINT IF EXISTS chat_channels_created_by_fkey;
