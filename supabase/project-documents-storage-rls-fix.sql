-- Project documents Storage RLS hotfix.
-- Run this once in the Supabase SQL Editor if uploads fail with:
-- "new row violates row-level security policy".

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE OR REPLACE FUNCTION can_read_project_document_storage(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    get_my_role() = 'admin'
    OR is_project_manager(p_project_id)
    OR is_project_member(p_project_id);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_write_project_document_storage(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    get_my_role() = 'admin'
    OR is_project_manager(p_project_id)
    OR is_project_member(p_project_id);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_delete_project_document_storage(p_object_name TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM projects p
    LEFT JOIN documents d ON d.file_path = p_object_name
    WHERE p.id::text = (storage.foldername(p_object_name))[2]
      AND (
        get_my_role() = 'admin'
        OR is_project_manager(p.id)
        OR d.created_by = auth.uid()
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "documents_storage_select" ON storage.objects;
CREATE POLICY "documents_storage_select" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'projects'
    AND can_read_project_document_storage(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS "documents_storage_insert" ON storage.objects;
CREATE POLICY "documents_storage_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'projects'
    AND can_write_project_document_storage(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS "documents_storage_delete" ON storage.objects;
CREATE POLICY "documents_storage_delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'projects'
    AND can_delete_project_document_storage(name)
  );
