-- Allows users with role "project_manager" to update project rows,
-- including changing manager_id/manager_name from the app.
DROP POLICY IF EXISTS "projects_update" ON projects;
CREATE POLICY "projects_update" ON projects
  FOR UPDATE
  USING (
    get_my_role() = 'admin'
    OR get_my_role() = 'project_manager'
    OR manager_id = auth.uid()
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR get_my_role() = 'project_manager'
    OR manager_id = auth.uid()
  );
