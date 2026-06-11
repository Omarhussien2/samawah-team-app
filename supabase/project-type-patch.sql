-- Add internal/external classification to projects on existing Supabase projects.
-- Run after the base schema/RLS files if the database already exists.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'external';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_project_type_check'
      AND conrelid = 'projects'::regclass
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_project_type_check CHECK (project_type IN ('internal', 'external'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_project_type ON projects(project_type);
