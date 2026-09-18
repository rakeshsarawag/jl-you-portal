-- Migration 10: Drop FK on chat_messages.sender_id so any UUID (auth or employee) can send messages.
-- The sender's name is resolved at read time from app_users / employees, not via FK join.
ALTER TABLE chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_sender_id_fkey;

-- Also drop the FK on chat_message_reactions.employee_id for the same reason
ALTER TABLE chat_message_reactions
  DROP CONSTRAINT IF EXISTS chat_message_reactions_employee_id_fkey;

-- And chat_channels.created_by (already done in 09 but guard with IF EXISTS)
ALTER TABLE chat_channels
  DROP CONSTRAINT IF EXISTS chat_channels_created_by_fkey;
