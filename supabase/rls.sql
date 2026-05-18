-- ============================================================
-- سماوة - سياسات Row Level Security
-- تشغيله بعد schema.sql في Supabase SQL Editor
-- ============================================================

-- تفعيل RLS على جميع الجداول
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges       ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_form_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_form_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_values      ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicator_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_performance_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE partnership_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper Functions
-- ============================================================

-- دالة للتحقق من دور المستخدم
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- دالة للتحقق من عضوية المستخدم في المشروع
CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- دالة للتحقق من كون المستخدم مدير المشروع
CREATE OR REPLACE FUNCTION is_project_manager(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND manager_id = auth.uid()
);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_project_forms_owner(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND forms_owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_edit_project_forms(p_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT is_project_manager(p_project_id);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION has_project_form_share(p_form_instance_id UUID, p_permission TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_form_shares
    WHERE form_instance_id = p_form_instance_id
      AND shared_with_user_id = auth.uid()
      AND (p_permission IS NULL OR permission = p_permission)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Profiles Policies
-- ============================================================
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin يمكنه تعديل أي profile
DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
CREATE POLICY "profiles_admin_update" ON profiles
  FOR UPDATE USING (get_my_role() = 'admin');

-- ============================================================
-- Projects Policies
-- ============================================================

-- القراءة: Admin يرى الكل، Project Manager يرى مشاريعه، Member يرى ما هو عضو فيه
DROP POLICY IF EXISTS "projects_select" ON projects;
CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (
    get_my_role() = 'admin'
    OR manager_id = auth.uid()
    OR is_project_member(id)
  );

-- الإنشاء: Admin و Project Manager فقط
DROP POLICY IF EXISTS "projects_insert" ON projects;
CREATE POLICY "projects_insert" ON projects
  FOR INSERT WITH CHECK (
    get_my_role() IN ('admin', 'project_manager')
  );

-- التحديث: Admin أو مدير المشروع
DROP POLICY IF EXISTS "projects_update" ON projects;
CREATE POLICY "projects_update" ON projects
  FOR UPDATE USING (
    get_my_role() = 'admin'
    OR manager_id = auth.uid()
  );

-- الحذف: Admin فقط
DROP POLICY IF EXISTS "projects_delete" ON projects;
CREATE POLICY "projects_delete" ON projects
  FOR DELETE USING (get_my_role() = 'admin');

-- ============================================================
-- Project Members Policies
-- ============================================================
DROP POLICY IF EXISTS "project_members_select" ON project_members;
CREATE POLICY "project_members_select" ON project_members
  FOR SELECT USING (
    get_my_role() = 'admin'
    OR user_id = auth.uid()
    OR is_project_manager(project_id)
  );

DROP POLICY IF EXISTS "project_members_insert" ON project_members;
CREATE POLICY "project_members_insert" ON project_members
  FOR INSERT WITH CHECK (
    get_my_role() = 'admin'
    OR is_project_manager(project_id)
  );

DROP POLICY IF EXISTS "project_members_delete" ON project_members;
CREATE POLICY "project_members_delete" ON project_members
  FOR DELETE USING (
    get_my_role() = 'admin'
    OR is_project_manager(project_id)
  );

-- ============================================================
-- Tasks Policies
-- ============================================================
DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (
    get_my_role() = 'admin'
    OR owner_id = auth.uid()
    OR is_project_manager(project_id)
    OR is_project_member(project_id)
  );

DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (
    get_my_role() IN ('admin', 'project_manager')
    OR is_project_manager(project_id)
  );

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (
    get_my_role() = 'admin'
    OR owner_id = auth.uid()
    OR is_project_manager(project_id)
  );

DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (
    get_my_role() = 'admin'
    OR is_project_manager(project_id)
  );

-- ============================================================
-- Task Time Entries Policies
-- ============================================================
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
            tasks.owner_id = auth.uid()
            AND task_time_entries.user_id = auth.uid()
            AND task_time_entries.logged_by = auth.uid()
          )
        )
    )
  );

-- ============================================================
-- Challenges Policies
-- ============================================================
DROP POLICY IF EXISTS "challenges_select" ON challenges;
CREATE POLICY "challenges_select" ON challenges
  FOR SELECT USING (
    get_my_role() = 'admin'
    OR owner_id = auth.uid()
    OR is_project_manager(project_id)
    OR is_project_member(project_id)
  );

DROP POLICY IF EXISTS "challenges_insert" ON challenges;
CREATE POLICY "challenges_insert" ON challenges
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "challenges_update" ON challenges;
CREATE POLICY "challenges_update" ON challenges
  FOR UPDATE USING (
    get_my_role() = 'admin'
    OR owner_id = auth.uid()
    OR is_project_manager(project_id)
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR owner_id = auth.uid()
    OR is_project_manager(project_id)
  );

DROP POLICY IF EXISTS "challenges_delete" ON challenges;
CREATE POLICY "challenges_delete" ON challenges
  FOR DELETE USING (
    get_my_role() = 'admin'
    OR is_project_manager(project_id)
  );

-- ============================================================
-- Documents Policies
-- ============================================================
DROP POLICY IF EXISTS "documents_select" ON documents;
CREATE POLICY "documents_select" ON documents
  FOR SELECT USING (
    get_my_role() = 'admin'
    OR created_by = auth.uid()
    OR is_project_manager(project_id)
    OR is_project_member(project_id)
  );

DROP POLICY IF EXISTS "documents_insert" ON documents;
CREATE POLICY "documents_insert" ON documents
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND (
      get_my_role() = 'admin'
      OR is_project_manager(project_id)
      OR is_project_member(project_id)
    )
  );

DROP POLICY IF EXISTS "documents_update" ON documents;
CREATE POLICY "documents_update" ON documents
  FOR UPDATE USING (
    get_my_role() = 'admin'
    OR created_by = auth.uid()
    OR is_project_manager(project_id)
  )
  WITH CHECK (
    (
      get_my_role() = 'admin'
      OR created_by = auth.uid()
      OR is_project_manager(project_id)
    )
    AND (
      get_my_role() = 'admin'
      OR is_project_manager(project_id)
      OR is_project_member(project_id)
    )
  );

DROP POLICY IF EXISTS "documents_delete" ON documents;
CREATE POLICY "documents_delete" ON documents
  FOR DELETE USING (
    get_my_role() = 'admin'
    OR created_by = auth.uid()
    OR is_project_manager(project_id)
  );

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

-- ============================================================
-- Document Storage Policies
-- ============================================================
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

-- ============================================================
-- Project Forms Policies
-- ============================================================
DROP POLICY IF EXISTS "project_form_templates_select" ON project_form_templates;
CREATE POLICY "project_form_templates_select" ON project_form_templates
  FOR SELECT USING (auth.uid() IS NOT NULL AND active = TRUE);

DROP POLICY IF EXISTS "project_form_templates_admin_insert" ON project_form_templates;
CREATE POLICY "project_form_templates_admin_insert" ON project_form_templates
  FOR INSERT WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "project_form_templates_admin_update" ON project_form_templates;
CREATE POLICY "project_form_templates_admin_update" ON project_form_templates
  FOR UPDATE USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "project_form_instances_select" ON project_form_instances;
CREATE POLICY "project_form_instances_select" ON project_form_instances
  FOR SELECT USING (
    get_my_role() = 'admin'
    OR is_project_manager(project_id)
    OR is_project_member(project_id)
    OR assigned_owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "project_form_instances_insert" ON project_form_instances;
CREATE POLICY "project_form_instances_insert" ON project_form_instances
  FOR INSERT WITH CHECK (
    can_edit_project_forms(project_id)
  );

DROP POLICY IF EXISTS "project_form_instances_update" ON project_form_instances;
CREATE POLICY "project_form_instances_update" ON project_form_instances
  FOR UPDATE USING (
    can_edit_project_forms(project_id)
  );

DROP POLICY IF EXISTS "project_form_instances_delete" ON project_form_instances;
CREATE POLICY "project_form_instances_delete" ON project_form_instances
  FOR DELETE USING (
    get_my_role() = 'admin'
    OR is_project_manager(project_id)
  );

DROP POLICY IF EXISTS "project_form_shares_select" ON project_form_shares;
CREATE POLICY "project_form_shares_select" ON project_form_shares
  FOR SELECT USING (
    shared_with_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_form_instances pfi
      WHERE pfi.id = project_form_shares.form_instance_id
        AND (
          can_edit_project_forms(pfi.project_id)
          OR is_project_member(pfi.project_id)
        )
    )
  );

DROP POLICY IF EXISTS "project_form_shares_insert" ON project_form_shares;
CREATE POLICY "project_form_shares_insert" ON project_form_shares
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_form_instances pfi
      WHERE pfi.id = form_instance_id
        AND can_edit_project_forms(pfi.project_id)
    )
  );

DROP POLICY IF EXISTS "project_form_shares_update" ON project_form_shares;
CREATE POLICY "project_form_shares_update" ON project_form_shares
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM project_form_instances pfi
      WHERE pfi.id = form_instance_id
        AND can_edit_project_forms(pfi.project_id)
    )
  );

DROP POLICY IF EXISTS "project_form_shares_delete" ON project_form_shares;
CREATE POLICY "project_form_shares_delete" ON project_form_shares
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_form_instances pfi
      WHERE pfi.id = form_instance_id
        AND can_edit_project_forms(pfi.project_id)
    )
  );

-- ============================================================
-- KPI Center Policies
-- ============================================================
DROP POLICY IF EXISTS "kpi_definitions_select" ON kpi_definitions;
CREATE POLICY "kpi_definitions_select" ON kpi_definitions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND active = TRUE
    AND (
      get_my_role() = 'admin'
      OR visibility = 'team'
      OR (
        get_my_role() = 'project_manager'
        AND visibility IN ('project_managers', 'team')
      )
    )
  );

DROP POLICY IF EXISTS "kpi_definitions_admin_insert" ON kpi_definitions;
CREATE POLICY "kpi_definitions_admin_insert" ON kpi_definitions
  FOR INSERT WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "kpi_definitions_admin_update" ON kpi_definitions;
CREATE POLICY "kpi_definitions_admin_update" ON kpi_definitions
  FOR UPDATE USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "kpi_definitions_admin_delete" ON kpi_definitions;
CREATE POLICY "kpi_definitions_admin_delete" ON kpi_definitions
  FOR DELETE USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "kpi_values_select" ON kpi_values;
CREATE POLICY "kpi_values_select" ON kpi_values
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM kpi_definitions kd
      WHERE kd.id = kpi_values.kpi_id
        AND kd.active = TRUE
        AND (
          get_my_role() = 'admin'
          OR kd.visibility = 'team'
          OR (
            get_my_role() = 'project_manager'
            AND kd.visibility IN ('project_managers', 'team')
          )
        )
    )
  );

DROP POLICY IF EXISTS "kpi_values_admin_insert" ON kpi_values;
DROP POLICY IF EXISTS "kpi_values_manage_insert" ON kpi_values;
CREATE POLICY "kpi_values_manage_insert" ON kpi_values
  FOR INSERT WITH CHECK (
    get_my_role() = 'admin'
    OR (
      get_my_role() = 'project_manager'
      AND EXISTS (
        SELECT 1
        FROM kpi_definitions kd
        WHERE kd.id = kpi_values.kpi_id
          AND kd.active = TRUE
          AND kd.visibility IN ('project_managers', 'team')
      )
    )
  );

DROP POLICY IF EXISTS "kpi_values_admin_update" ON kpi_values;
DROP POLICY IF EXISTS "kpi_values_manage_update" ON kpi_values;
CREATE POLICY "kpi_values_manage_update" ON kpi_values
  FOR UPDATE USING (
    get_my_role() = 'admin'
    OR (
      get_my_role() = 'project_manager'
      AND EXISTS (
        SELECT 1
        FROM kpi_definitions kd
        WHERE kd.id = kpi_values.kpi_id
          AND kd.active = TRUE
          AND kd.visibility IN ('project_managers', 'team')
      )
    )
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR (
      get_my_role() = 'project_manager'
      AND EXISTS (
        SELECT 1
        FROM kpi_definitions kd
        WHERE kd.id = kpi_values.kpi_id
          AND kd.active = TRUE
          AND kd.visibility IN ('project_managers', 'team')
      )
    )
  );

DROP POLICY IF EXISTS "kpi_values_admin_delete" ON kpi_values;
CREATE POLICY "kpi_values_admin_delete" ON kpi_values
  FOR DELETE USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "kpi_share_links_admin_select" ON kpi_share_links;
CREATE POLICY "kpi_share_links_admin_select" ON kpi_share_links
  FOR SELECT USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "kpi_share_links_admin_insert" ON kpi_share_links;
CREATE POLICY "kpi_share_links_admin_insert" ON kpi_share_links
  FOR INSERT WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "kpi_share_links_admin_update" ON kpi_share_links;
CREATE POLICY "kpi_share_links_admin_update" ON kpi_share_links
  FOR UPDATE USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "kpi_share_links_admin_delete" ON kpi_share_links;
CREATE POLICY "kpi_share_links_admin_delete" ON kpi_share_links
  FOR DELETE USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "indicator_products_select" ON indicator_products;
CREATE POLICY "indicator_products_select" ON indicator_products
  FOR SELECT USING (
    get_my_role() IN ('admin', 'project_manager')
    OR EXISTS (
      SELECT 1
      FROM kpi_definitions kd
      WHERE kd.id = indicator_products.kpi_id
        AND kd.visibility = 'team'
    )
  );

DROP POLICY IF EXISTS "indicator_products_manage" ON indicator_products;
CREATE POLICY "indicator_products_manage" ON indicator_products
  FOR ALL USING (get_my_role() IN ('admin', 'project_manager'))
  WITH CHECK (get_my_role() IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "project_performance_updates_select" ON project_performance_updates;
CREATE POLICY "project_performance_updates_select" ON project_performance_updates
  FOR SELECT USING (
    get_my_role() = 'admin'
    OR is_project_manager(project_id)
    OR is_project_member(project_id)
  );

DROP POLICY IF EXISTS "project_performance_updates_insert" ON project_performance_updates;
CREATE POLICY "project_performance_updates_insert" ON project_performance_updates
  FOR INSERT WITH CHECK (
    get_my_role() = 'admin'
    OR is_project_manager(project_id)
  );

DROP POLICY IF EXISTS "project_performance_updates_update" ON project_performance_updates;
CREATE POLICY "project_performance_updates_update" ON project_performance_updates
  FOR UPDATE USING (
    get_my_role() = 'admin'
    OR is_project_manager(project_id)
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR is_project_manager(project_id)
  );

DROP POLICY IF EXISTS "project_performance_updates_delete" ON project_performance_updates;
CREATE POLICY "project_performance_updates_delete" ON project_performance_updates
  FOR DELETE USING (
    get_my_role() = 'admin'
    OR is_project_manager(project_id)
  );

DROP POLICY IF EXISTS "revenue_entries_admin_manage" ON revenue_entries;
CREATE POLICY "revenue_entries_admin_manage" ON revenue_entries
  FOR ALL USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "client_opportunities_select" ON client_opportunities;
CREATE POLICY "client_opportunities_select" ON client_opportunities
  FOR SELECT USING (get_my_role() IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "client_opportunities_manage" ON client_opportunities;
CREATE POLICY "client_opportunities_manage" ON client_opportunities
  FOR ALL USING (get_my_role() IN ('admin', 'project_manager'))
  WITH CHECK (get_my_role() IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "audience_metrics_select" ON audience_metrics;
CREATE POLICY "audience_metrics_select" ON audience_metrics
  FOR SELECT USING (get_my_role() IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "audience_metrics_manage" ON audience_metrics;
CREATE POLICY "audience_metrics_manage" ON audience_metrics
  FOR ALL USING (get_my_role() IN ('admin', 'project_manager'))
  WITH CHECK (get_my_role() IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "service_outputs_select" ON service_outputs;
CREATE POLICY "service_outputs_select" ON service_outputs
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "service_outputs_manage" ON service_outputs;
CREATE POLICY "service_outputs_manage" ON service_outputs
  FOR ALL USING (get_my_role() IN ('admin', 'project_manager'))
  WITH CHECK (get_my_role() IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "partnership_activities_select" ON partnership_activities;
CREATE POLICY "partnership_activities_select" ON partnership_activities
  FOR SELECT USING (get_my_role() IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "partnership_activities_manage" ON partnership_activities;
CREATE POLICY "partnership_activities_manage" ON partnership_activities
  FOR ALL USING (get_my_role() IN ('admin', 'project_manager'))
  WITH CHECK (get_my_role() IN ('admin', 'project_manager'));

-- ============================================================
-- Comments Policies
-- ============================================================
DROP POLICY IF EXISTS "comments_select" ON comments;
CREATE POLICY "comments_select" ON comments
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "comments_insert" ON comments;
CREATE POLICY "comments_insert" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_delete" ON comments;
CREATE POLICY "comments_delete" ON comments
  FOR DELETE USING (
    get_my_role() = 'admin'
    OR user_id = auth.uid()
  );

-- ============================================================
-- Notifications Policies
-- ============================================================
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (user_id = auth.uid() OR get_my_role() = 'admin');

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Notification Preferences Policies
-- ============================================================
DROP POLICY IF EXISTS "notification_preferences_select" ON notification_preferences;
CREATE POLICY "notification_preferences_select" ON notification_preferences
  FOR SELECT USING (user_id = auth.uid() OR get_my_role() = 'admin');

DROP POLICY IF EXISTS "notification_preferences_insert" ON notification_preferences;
CREATE POLICY "notification_preferences_insert" ON notification_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_preferences_update" ON notification_preferences;
CREATE POLICY "notification_preferences_update" ON notification_preferences
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Automation Logs - Admin فقط
-- ============================================================
DROP POLICY IF EXISTS "automation_logs_select" ON automation_logs;
CREATE POLICY "automation_logs_select" ON automation_logs
  FOR SELECT USING (get_my_role() = 'admin');

-- ============================================================
-- Templates - قراءة للجميع، كتابة للـ Admin
-- ============================================================
DROP POLICY IF EXISTS "project_templates_select" ON project_templates;
CREATE POLICY "project_templates_select" ON project_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "project_templates_insert" ON project_templates;
CREATE POLICY "project_templates_insert" ON project_templates
  FOR INSERT WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "task_templates_select" ON task_templates;
CREATE POLICY "task_templates_select" ON task_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "task_templates_insert" ON task_templates;
CREATE POLICY "task_templates_insert" ON task_templates
  FOR INSERT WITH CHECK (get_my_role() = 'admin');
