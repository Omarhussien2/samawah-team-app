-- Allow project members to update challenges and risks in their projects.
-- Use this on existing Supabase projects when regular users can see
-- challenges/risks but get blocked while editing or changing status.

DROP POLICY IF EXISTS "challenges_update" ON challenges;
CREATE POLICY "challenges_update" ON challenges
  FOR UPDATE USING (
    get_my_role() = 'admin'
    OR owner_id = auth.uid()
    OR is_project_manager(project_id)
    OR is_project_member(project_id)
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR owner_id = auth.uid()
    OR is_project_manager(project_id)
    OR is_project_member(project_id)
  );
