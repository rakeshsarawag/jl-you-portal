-- Add missing columns to project_tasks
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES project_sprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sprint_change_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sprint_change_history JSONB DEFAULT '[]'::jsonb;

-- Add index for sprint lookups
CREATE INDEX IF NOT EXISTS idx_project_tasks_sprint_id ON project_tasks (sprint_id);
