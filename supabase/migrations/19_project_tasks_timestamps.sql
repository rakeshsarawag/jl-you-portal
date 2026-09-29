-- Migration 19: Ensure timestamp audit columns exist on project_tasks
-- These may be missing if the DB was initialised from an older schema snapshot.

ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS started_at   TIMESTAMPTZ;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS closed_at    TIMESTAMPTZ;
