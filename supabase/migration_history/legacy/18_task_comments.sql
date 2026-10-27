-- Migration 18: Task comments for project_tasks
-- Allows users to add threaded comments on individual tasks

CREATE TABLE IF NOT EXISTS task_comments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id      UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  author_id    UUID REFERENCES employees(id) ON DELETE SET NULL,
  author_name  TEXT NOT NULL DEFAULT '',
  content      TEXT NOT NULL,
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments(task_id, created_at DESC);

-- Enable RLS to match project_tasks pattern
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_comments_select" ON task_comments FOR SELECT USING (true);
CREATE POLICY "task_comments_insert" ON task_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "task_comments_update" ON task_comments FOR UPDATE USING (true);
CREATE POLICY "task_comments_delete" ON task_comments FOR DELETE USING (true);
