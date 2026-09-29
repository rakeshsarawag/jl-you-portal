-- Add expertise column to recruitment_candidates
ALTER TABLE recruitment_candidates
  ADD COLUMN IF NOT EXISTS expertise TEXT;
