-- ============================================================
-- سماوة - نظام إدارة المشاريع
-- Schema SQL - تشغيله في Supabase SQL Editor
-- ============================================================

-- تفعيل UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. جدول الملفات الشخصية (profiles)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  email       TEXT UNIQUE,
  avatar_url  TEXT,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'project_manager', 'member')),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. جدول المشاريع (projects)
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_project_id TEXT UNIQUE,
  name              TEXT NOT NULL,
  manager_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  manager_name      TEXT,
  path              TEXT,
  current_stage     TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  start_date        DATE,
  end_date          DATE,
  total_budget      NUMERIC DEFAULT 0,
  description       TEXT,
  logo_url          TEXT,
  progress          NUMERIC DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. جدول أعضاء المشروع (project_members)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_in_project TEXT NOT NULL DEFAULT 'member',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

-- ============================================================
-- 4. جدول المهام (tasks)
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_task_id  TEXT UNIQUE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  sub_task        TEXT,
  category        TEXT,
  owner_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  owner_name      TEXT,
  status          TEXT NOT NULL DEFAULT 'To Do' CHECK (status IN ('Backlog','To Do','In Progress','Review','Done','Cancelled')),
  board_column    TEXT NOT NULL DEFAULT 'To Do',
  priority        TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  start_date      DATE,
  due_date        DATE,
  cost            NUMERIC,
  quantity_total  NUMERIC,
  quantity_done   NUMERIC,
  progress        NUMERIC DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  schedule_status TEXT,
  alert_level     TEXT CHECK (alert_level IN ('Low','Medium','High','Critical')),
  alert_message   TEXT,
  alert_action    TEXT,
  days_to_due     INTEGER,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. جدول التحديات (challenges)
-- ============================================================
CREATE TABLE IF NOT EXISTS challenges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  owner_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  risk_impact TEXT,
  risk_type   TEXT,
  resolution  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. جدول المستندات (documents)
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  url         TEXT,
  file_path   TEXT,
  type        TEXT,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. جدول التعليقات (comments)
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. جدول الإشعارات (notifications)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  task_id    UUID REFERENCES tasks(id) ON DELETE CASCADE,
  type       TEXT,
  title      TEXT,
  body       TEXT,
  sent_via   TEXT,
  sent_at    TIMESTAMPTZ,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. جدول سجلات الأتمتة (automation_logs)
-- ============================================================
CREATE TABLE IF NOT EXISTS automation_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT,
  status     TEXT,
  payload    JSONB,
  error      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. جدول قوالب المشاريع (project_templates)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. جدول قوالب المهام (task_templates)
-- ============================================================
CREATE TABLE IF NOT EXISTS task_templates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id          UUID NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  sub_task             TEXT,
  category             TEXT,
  default_duration_days INTEGER,
  default_priority     TEXT NOT NULL DEFAULT 'medium',
  sort_order           INTEGER DEFAULT 0
);

-- ============================================================
-- Triggers: تحديث updated_at تلقائياً
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_challenges_updated_at ON challenges;
CREATE TRIGGER update_challenges_updated_at
  BEFORE UPDATE ON challenges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Trigger: إنشاء profile تلقائياً عند تسجيل مستخدم جديد
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Trigger: حساب progress من quantity تلقائياً
-- ============================================================
CREATE OR REPLACE FUNCTION calc_task_progress()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity_total IS NOT NULL AND NEW.quantity_total > 0 THEN
    NEW.progress = ROUND((COALESCE(NEW.quantity_done, 0) / NEW.quantity_total) * 100);
  ELSIF NEW.status = 'Done' THEN
    NEW.progress = 100;
  END IF;
  -- تفعيل تنبيه التأخر التلقائي
  IF NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE AND NEW.status NOT IN ('Done', 'Cancelled') THEN
    NEW.alert_level = 'High';
    IF NEW.alert_message IS NULL THEN
      NEW.alert_message = 'المهمة متأخرة عن موعدها';
    END IF;
  END IF;
  -- حساب days_to_due
  IF NEW.due_date IS NOT NULL THEN
    NEW.days_to_due = NEW.due_date - CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Trigger: تحديث progress المشروع تلقائياً
-- ============================================================
CREATE OR REPLACE FUNCTION update_project_progress()
RETURNS TRIGGER AS $$
DECLARE
  proj_id UUID;
  total_count INT;
  done_count INT;
BEGIN
  proj_id := COALESCE(NEW.project_id, OLD.project_id);
  IF proj_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'Done')
  INTO total_count, done_count
  FROM tasks WHERE project_id = proj_id;

  UPDATE projects SET progress = CASE WHEN total_count > 0 THEN ROUND((done_count::NUMERIC / total_count) * 100) ELSE 0 END
  WHERE id = proj_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_project_progress_trigger ON tasks;
CREATE TRIGGER update_project_progress_trigger
  AFTER INSERT OR UPDATE OF status OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_project_progress();

DROP TRIGGER IF EXISTS calc_task_progress_trigger ON tasks;
CREATE TRIGGER calc_task_progress_trigger
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION calc_task_progress();

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_id ON tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_board_column ON tasks(board_column);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_project ON challenges(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);
