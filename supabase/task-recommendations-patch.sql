-- ============================================================
-- Task recommendations patch
-- Adds recommendation source metadata to tasks and lets the
-- project forms owner manage recommendation tasks.
-- ============================================================

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_meeting_title TEXT,
  ADD COLUMN IF NOT EXISTS source_meeting_date DATE,
  ADD COLUMN IF NOT EXISTS source_created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS affects_project_progress BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_source_type_check'
      AND conrelid = 'tasks'::regclass
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_source_type_check CHECK (source_type IS NULL OR source_type IN ('recommendation'));
  END IF;
END $$;

UPDATE tasks
SET affects_project_progress = TRUE
WHERE affects_project_progress IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project_source ON tasks(project_id, source_type);
CREATE INDEX IF NOT EXISTS idx_tasks_source_created_by ON tasks(source_created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_project_progress_scope ON tasks(project_id, affects_project_progress);

CREATE OR REPLACE FUNCTION is_project_forms_owner(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND forms_owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_edit_project_forms(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT get_my_role() = 'admin'
    OR is_project_manager(p_project_id)
    OR is_project_forms_owner(p_project_id);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_manage_project_recommendations(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT get_my_role() = 'admin'
    OR is_project_manager(p_project_id)
    OR is_project_forms_owner(p_project_id);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "projects_select" ON projects;
CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (
    get_my_role() = 'admin'
    OR manager_id = auth.uid()
    OR forms_owner_id = auth.uid()
    OR is_project_member(id)
  );

DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (
    get_my_role() = 'admin'
    OR owner_id = auth.uid()
    OR is_project_manager(project_id)
    OR is_project_member(project_id)
    OR (
      source_type = 'recommendation'
      AND can_manage_project_recommendations(project_id)
    )
  );

DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (
    get_my_role() IN ('admin', 'project_manager')
    OR is_project_manager(project_id)
    OR (
      source_type = 'recommendation'
      AND can_manage_project_recommendations(project_id)
    )
  );

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (
    get_my_role() = 'admin'
    OR owner_id = auth.uid()
    OR is_project_manager(project_id)
    OR (
      source_type = 'recommendation'
      AND can_manage_project_recommendations(project_id)
    )
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR owner_id = auth.uid()
    OR is_project_manager(project_id)
    OR (
      source_type = 'recommendation'
      AND can_manage_project_recommendations(project_id)
    )
  );

DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (
    get_my_role() = 'admin'
    OR is_project_manager(project_id)
    OR (
      source_type = 'recommendation'
      AND can_manage_project_recommendations(project_id)
    )
  );

DROP POLICY IF EXISTS "task_time_entries_select" ON task_time_entries;
CREATE POLICY "task_time_entries_select" ON task_time_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM tasks
      WHERE tasks.id = task_time_entries.task_id
        AND (
          get_my_role() = 'admin'
          OR tasks.owner_id = auth.uid()
          OR is_project_manager(tasks.project_id)
          OR is_project_member(tasks.project_id)
          OR (
            tasks.source_type = 'recommendation'
            AND can_manage_project_recommendations(tasks.project_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS "task_time_entries_insert" ON task_time_entries;
CREATE POLICY "task_time_entries_insert" ON task_time_entries
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND logged_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1
        FROM tasks
        WHERE tasks.id = task_time_entries.task_id
          AND (
            get_my_role() = 'admin'
            OR is_project_manager(tasks.project_id)
            OR (
              tasks.source_type = 'recommendation'
              AND can_manage_project_recommendations(tasks.project_id)
            )
            OR (
              tasks.owner_id = auth.uid()
              AND task_time_entries.user_id = auth.uid()
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS "task_time_entries_update" ON task_time_entries;
CREATE POLICY "task_time_entries_update" ON task_time_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM tasks
      WHERE tasks.id = task_time_entries.task_id
        AND (
          get_my_role() = 'admin'
          OR is_project_manager(tasks.project_id)
          OR (
            tasks.source_type = 'recommendation'
            AND can_manage_project_recommendations(tasks.project_id)
          )
          OR (
            tasks.owner_id = auth.uid()
            AND task_time_entries.user_id = auth.uid()
            AND task_time_entries.logged_by = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tasks
      WHERE tasks.id = task_time_entries.task_id
        AND (
          get_my_role() = 'admin'
          OR is_project_manager(tasks.project_id)
          OR (
            tasks.source_type = 'recommendation'
            AND can_manage_project_recommendations(tasks.project_id)
          )
          OR (
            tasks.owner_id = auth.uid()
            AND task_time_entries.user_id = auth.uid()
            AND task_time_entries.logged_by = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "task_time_entries_delete" ON task_time_entries;
CREATE POLICY "task_time_entries_delete" ON task_time_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM tasks
      WHERE tasks.id = task_time_entries.task_id
        AND (
          get_my_role() = 'admin'
          OR is_project_manager(tasks.project_id)
          OR (
            tasks.source_type = 'recommendation'
            AND can_manage_project_recommendations(tasks.project_id)
          )
          OR (
            tasks.owner_id = auth.uid()
            AND task_time_entries.user_id = auth.uid()
            AND task_time_entries.logged_by = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "project_form_instances_delete" ON project_form_instances;
CREATE POLICY "project_form_instances_delete" ON project_form_instances
  FOR DELETE USING (
    can_edit_project_forms(project_id)
  );
