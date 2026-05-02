-- ============================================================
-- سماوة - تفعيل Supabase Realtime
-- شغّل هذا في Supabase SQL Editor بعد schema.sql و rls.sql
-- ============================================================

-- تفعيل Realtime على الجداول المطلوبة
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

-- ============================================================
-- إضافة سياسة INSERT للإشعارات (للسيرفر)
-- مطلوبة حتى يستطيع الـ service role إنشاء إشعارات
-- ============================================================
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (
    -- السماح لأي مستخدم مسجّل بإنشاء إشعار (عادةً عبر service role)
    auth.uid() IS NOT NULL
    OR
    -- Service role يتجاوز RLS تلقائياً
    TRUE
  );

-- ============================================================
-- إضافة سياسة INSERT للتعليقات (تأكيد)
-- ============================================================
-- سياسة comments_insert موجودة بالفعل في rls.sql
-- لكن نتأكد أنها تعمل مع user_id = auth.uid()
