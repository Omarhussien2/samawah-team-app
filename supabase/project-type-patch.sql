-- Add internal/external classification to projects on existing Supabase projects.
-- Run after the base schema/RLS files if the database already exists.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'internal';

ALTER TABLE projects
  ALTER COLUMN project_type SET DEFAULT 'internal';

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

UPDATE projects
SET project_type = CASE
  WHEN btrim(name) IN (
    'أكوا',
    'البنك المركزي',
    'رصد - هداية ثون',
    'هاكاثون هداية',
    'مؤسسة الجفالي',
    'مبرة منى، مشروع الأمير متعب'
  ) THEN 'external'
  ELSE 'internal'
END;

CREATE INDEX IF NOT EXISTS idx_projects_project_type ON projects(project_type);

NOTIFY pgrst, 'reload schema';
SELECT pg_notification_queue_usage();
