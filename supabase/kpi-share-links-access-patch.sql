-- ============================================================
-- سماوة - توسيع صلاحية روابط مشاركة KPI للمستخدمين المؤقتين المسموحين
-- تشغيله على قاعدة قائمة بعد rls.sql
-- ============================================================

DROP POLICY IF EXISTS "kpi_share_links_admin_select" ON kpi_share_links;
DROP POLICY IF EXISTS "kpi_share_links_select" ON kpi_share_links;
CREATE POLICY "kpi_share_links_select" ON kpi_share_links
  FOR SELECT USING (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.id IN (
            '36185351-6c30-4e3d-9558-c8a7d5387762',
            'a03b7fc6-1e64-4af5-acb0-7971c5668fd2',
            'b2f49f37-7ab4-43b6-a853-6ced991f7177'
          )
          OR lower(trim(profiles.email)) IN (
            'd.fahad@samawah1.sa',
            'omarsamawah@gmail.com',
            'm.barhma@samawah1.sa'
          )
          OR trim(profiles.full_name) IN ('دانة', 'عمر', 'محمد بارحمة')
        )
    )
  );

DROP POLICY IF EXISTS "kpi_share_links_admin_insert" ON kpi_share_links;
DROP POLICY IF EXISTS "kpi_share_links_insert" ON kpi_share_links;
CREATE POLICY "kpi_share_links_insert" ON kpi_share_links
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND (
      get_my_role() = 'admin'
      OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
          AND (
            profiles.id IN (
              '36185351-6c30-4e3d-9558-c8a7d5387762',
              'a03b7fc6-1e64-4af5-acb0-7971c5668fd2',
              'b2f49f37-7ab4-43b6-a853-6ced991f7177'
            )
            OR lower(trim(profiles.email)) IN (
              'd.fahad@samawah1.sa',
              'omarsamawah@gmail.com',
              'm.barhma@samawah1.sa'
            )
            OR trim(profiles.full_name) IN ('دانة', 'عمر', 'محمد بارحمة')
          )
      )
    )
  );

DROP POLICY IF EXISTS "kpi_share_links_admin_update" ON kpi_share_links;
DROP POLICY IF EXISTS "kpi_share_links_update" ON kpi_share_links;
CREATE POLICY "kpi_share_links_update" ON kpi_share_links
  FOR UPDATE USING (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.id IN (
            '36185351-6c30-4e3d-9558-c8a7d5387762',
            'a03b7fc6-1e64-4af5-acb0-7971c5668fd2',
            'b2f49f37-7ab4-43b6-a853-6ced991f7177'
          )
          OR lower(trim(profiles.email)) IN (
            'd.fahad@samawah1.sa',
            'omarsamawah@gmail.com',
            'm.barhma@samawah1.sa'
          )
          OR trim(profiles.full_name) IN ('دانة', 'عمر', 'محمد بارحمة')
        )
    )
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.id IN (
            '36185351-6c30-4e3d-9558-c8a7d5387762',
            'a03b7fc6-1e64-4af5-acb0-7971c5668fd2',
            'b2f49f37-7ab4-43b6-a853-6ced991f7177'
          )
          OR lower(trim(profiles.email)) IN (
            'd.fahad@samawah1.sa',
            'omarsamawah@gmail.com',
            'm.barhma@samawah1.sa'
          )
          OR trim(profiles.full_name) IN ('دانة', 'عمر', 'محمد بارحمة')
        )
    )
  );

DROP POLICY IF EXISTS "kpi_share_links_admin_delete" ON kpi_share_links;
DROP POLICY IF EXISTS "kpi_share_links_delete" ON kpi_share_links;
CREATE POLICY "kpi_share_links_delete" ON kpi_share_links
  FOR DELETE USING (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.id IN (
            '36185351-6c30-4e3d-9558-c8a7d5387762',
            'a03b7fc6-1e64-4af5-acb0-7971c5668fd2',
            'b2f49f37-7ab4-43b6-a853-6ced991f7177'
          )
          OR lower(trim(profiles.email)) IN (
            'd.fahad@samawah1.sa',
            'omarsamawah@gmail.com',
            'm.barhma@samawah1.sa'
          )
          OR trim(profiles.full_name) IN ('دانة', 'عمر', 'محمد بارحمة')
        )
    )
  );
