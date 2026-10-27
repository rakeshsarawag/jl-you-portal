-- ============================================================
-- MIGRATION 11: Drop Collaboration Hub (chat) tables
-- The Collaboration Hub feature has been removed from the app.
-- This migration cleans up all chat-related tables and indexes.
-- Safe to run multiple times — all statements use IF EXISTS guards.
-- ============================================================

DROP TABLE IF EXISTS chat_message_attachments  CASCADE;
DROP TABLE IF EXISTS chat_message_reactions     CASCADE;
DROP TABLE IF EXISTS chat_messages              CASCADE;
DROP TABLE IF EXISTS chat_channel_members       CASCADE;
DROP TABLE IF EXISTS chat_channels              CASCADE;
DROP TABLE IF EXISTS user_presence              CASCADE;
