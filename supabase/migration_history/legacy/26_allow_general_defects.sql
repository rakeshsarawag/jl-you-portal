-- Allow defects that are not associated with a project.
-- The UI stores these records with project_id = NULL and project_name = 'General'.
ALTER TABLE public.project_defects
  ALTER COLUMN project_id DROP NOT NULL;
