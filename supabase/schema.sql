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
  project_type      TEXT NOT NULL DEFAULT 'external' CHECK (project_type IN ('internal', 'external')),
  manager_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  manager_name      TEXT,
  path              TEXT,
  current_stage     TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  start_date        DATE,
  end_date          DATE,
  total_budget      NUMERIC DEFAULT 0 CHECK (total_budget IS NULL OR total_budget >= 0),
  description       TEXT,
  logo_url          TEXT,
  forms_owner_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  progress          NUMERIC DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS forms_owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

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
  cost            NUMERIC DEFAULT 0 CHECK (cost IS NULL OR cost >= 0),
  planned_hours   NUMERIC NOT NULL DEFAULT 0 CHECK (planned_hours >= 0),
  actual_hours    NUMERIC NOT NULL DEFAULT 0 CHECK (actual_hours >= 0),
  quantity_total  NUMERIC,
  quantity_done   NUMERIC,
  progress_mode   TEXT NOT NULL DEFAULT 'manual' CHECK (progress_mode IN ('manual', 'quantity')),
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

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS progress_mode TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS planned_hours NUMERIC NOT NULL DEFAULT 0 CHECK (planned_hours >= 0),
  ADD COLUMN IF NOT EXISTS actual_hours NUMERIC NOT NULL DEFAULT 0 CHECK (actual_hours >= 0);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_progress_mode_check'
      AND conrelid = 'tasks'::regclass
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_progress_mode_check CHECK (progress_mode IN ('manual', 'quantity'));
  END IF;
END $$;

-- ============================================================
-- 4.1. Task time entries
-- ============================================================
CREATE TABLE IF NOT EXISTS task_time_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  work_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  hours       NUMERIC NOT NULL CHECK (hours > 0 AND hours <= 24),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  kind        TEXT NOT NULL DEFAULT 'challenge' CHECK (kind IN ('challenge','risk','issue')),
  risk_impact TEXT,
  risk_type   TEXT,
  probability_score SMALLINT NOT NULL DEFAULT 3 CHECK (probability_score BETWEEN 1 AND 5),
  impact_score      SMALLINT NOT NULL DEFAULT 3 CHECK (impact_score BETWEEN 1 AND 5),
  risk_score        SMALLINT GENERATED ALWAYS AS (probability_score * impact_score) STORED,
  risk_level        TEXT GENERATED ALWAYS AS (
    CASE
      WHEN probability_score * impact_score >= 20 THEN 'critical'
      WHEN probability_score * impact_score >= 12 THEN 'high'
      WHEN probability_score * impact_score >= 6 THEN 'medium'
      ELSE 'low'
    END
  ) STORED,
  response_strategy TEXT NOT NULL DEFAULT 'mitigate' CHECK (response_strategy IN ('mitigate','avoid','transfer','accept','monitor')),
  mitigation_plan   TEXT,
  contingency_plan  TEXT,
  due_date          DATE,
  identified_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  resolved_at       TIMESTAMPTZ,
  kpi_id            UUID,
  resolution  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE challenges ADD COLUMN IF NOT EXISTS form_instance_id UUID;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'challenge' CHECK (kind IN ('challenge','risk','issue'));
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS probability_score SMALLINT NOT NULL DEFAULT 3 CHECK (probability_score BETWEEN 1 AND 5);
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS impact_score SMALLINT NOT NULL DEFAULT 3 CHECK (impact_score BETWEEN 1 AND 5);
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS risk_score SMALLINT GENERATED ALWAYS AS (probability_score * impact_score) STORED;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS risk_level TEXT GENERATED ALWAYS AS (
  CASE
    WHEN probability_score * impact_score >= 20 THEN 'critical'
    WHEN probability_score * impact_score >= 12 THEN 'high'
    WHEN probability_score * impact_score >= 6 THEN 'medium'
    ELSE 'low'
  END
) STORED;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS response_strategy TEXT NOT NULL DEFAULT 'mitigate' CHECK (response_strategy IN ('mitigate','avoid','transfer','accept','monitor'));
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS mitigation_plan TEXT;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS contingency_plan TEXT;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS identified_at DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS kpi_id UUID;

-- ============================================================
-- 6. جدول المستندات (documents)
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  form_instance_id UUID,
  title       TEXT NOT NULL,
  url         TEXT,
  file_path   TEXT,
  file_name   TEXT,
  file_type   TEXT,
  file_size   BIGINT,
  stage       TEXT,
  type        TEXT,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6.1. جداول نماذج المشروع (project forms)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_form_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  description       TEXT,
  category          TEXT,
  stage             TEXT,
  applies_to_path   TEXT,
  template_kind     TEXT NOT NULL DEFAULT 'form' CHECK (template_kind IN ('form', 'docx', 'xlsx', 'hybrid')),
  schema_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_file_path  TEXT,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order        INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_form_instances (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  template_id           UUID NOT NULL REFERENCES project_form_templates(id) ON DELETE CASCADE,
  assigned_owner_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'draft', 'completed')),
  data_json             JSONB NOT NULL DEFAULT '{}'::jsonb,
  completion_percentage NUMERIC DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  created_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, template_id)
);

CREATE TABLE IF NOT EXISTS project_form_shares (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_instance_id    UUID NOT NULL REFERENCES project_form_instances(id) ON DELETE CASCADE,
  shared_with_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  permission          TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(form_instance_id, shared_with_user_id)
);

-- ============================================================
-- 6.2. جداول مركز المؤشرات (KPI Center)
-- ============================================================
CREATE TABLE IF NOT EXISTS kpi_definitions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT UNIQUE NOT NULL,
  name               TEXT NOT NULL,
  description        TEXT,
  perspective        TEXT NOT NULL,
  strategic_goal     TEXT,
  measurement_label  TEXT,
  target_value       NUMERIC,
  target_text        TEXT,
  target_unit        TEXT,
  direction          TEXT NOT NULL DEFAULT 'higher_is_better'
    CHECK (direction IN ('higher_is_better', 'lower_is_better')),
  calculation_method TEXT NOT NULL DEFAULT 'manual'
    CHECK (calculation_method IN ('auto', 'manual', 'semi_auto')),
  auto_source        TEXT,
  frequency          TEXT NOT NULL DEFAULT 'monthly'
    CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  visibility         TEXT NOT NULL DEFAULT 'management'
    CHECK (visibility IN ('management', 'project_managers', 'team')),
  owner_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order         INTEGER DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kpi_values (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id        UUID NOT NULL REFERENCES kpi_definitions(id) ON DELETE CASCADE,
  period_type   TEXT NOT NULL DEFAULT 'monthly'
    CHECK (period_type IN ('monthly', 'quarterly')),
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  actual_value  NUMERIC,
  actual_text   TEXT,
  target_value  NUMERIC,
  status        TEXT CHECK (status IN ('green', 'yellow', 'red', 'neutral')),
  trend         TEXT CHECK (trend IN ('up', 'down', 'flat', 'unknown')),
  source        TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('auto', 'manual', 'semi_auto')),
  notes         TEXT,
  updated_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(kpi_id, period_type, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS kpi_share_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL DEFAULT 'رابط مجلس الإدارة',
  token_hash     TEXT UNIQUE NOT NULL,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at     TIMESTAMPTZ,
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_viewed_at TIMESTAMPTZ,
  views_count    INTEGER NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indicator_products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id         UUID REFERENCES kpi_definitions(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  category       TEXT,
  description    TEXT,
  current_value  NUMERIC NOT NULL DEFAULT 0,
  target_value   NUMERIC,
  unit           TEXT,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  owner_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes          TEXT,
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, kpi_id)
);

CREATE TABLE IF NOT EXISTS project_performance_updates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  period_type      TEXT NOT NULL DEFAULT 'monthly'
    CHECK (period_type IN ('monthly', 'quarterly')),
  period_start     DATE NOT NULL,
  period_end       DATE NOT NULL,
  planned_progress NUMERIC NOT NULL DEFAULT 0 CHECK (planned_progress >= 0 AND planned_progress <= 100),
  actual_progress  NUMERIC NOT NULL DEFAULT 0 CHECK (actual_progress >= 0 AND actual_progress <= 100),
  actual_cost      NUMERIC NOT NULL DEFAULT 0 CHECK (actual_cost >= 0),
  notes            TEXT,
  updated_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, period_type, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS revenue_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date   DATE NOT NULL,
  revenue_type TEXT NOT NULL CHECK (revenue_type IN ('government', 'non_government', 'product')),
  client_name  TEXT,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  amount       NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  status       TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('expected', 'confirmed', 'collected')),
  notes        TEXT,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_opportunities (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name        TEXT NOT NULL,
  client_type        TEXT,
  record_type        TEXT NOT NULL CHECK (record_type IN ('strategic_client', 'new_client', 'proposal', 'repeat_client', 'satisfaction')),
  project_id         UUID REFERENCES projects(id) ON DELETE SET NULL,
  opportunity_value  NUMERIC,
  status             TEXT NOT NULL DEFAULT 'contacted' CHECK (status IN ('contacted', 'proposal_submitted', 'won', 'lost', 'repeat')),
  submitted_at       DATE,
  satisfaction_score NUMERIC CHECK (satisfaction_score >= 0 AND satisfaction_score <= 100),
  notes              TEXT,
  created_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audience_metrics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date       DATE NOT NULL,
  platform          TEXT NOT NULL,
  subscribers       NUMERIC NOT NULL DEFAULT 0 CHECK (subscribers >= 0),
  paid_views_avg    NUMERIC NOT NULL DEFAULT 0 CHECK (paid_views_avg >= 0),
  organic_views_avg NUMERIC NOT NULL DEFAULT 0 CHECK (organic_views_avg >= 0),
  top_episode_views NUMERIC NOT NULL DEFAULT 0 CHECK (top_episode_views >= 0),
  influencer_reach  NUMERIC NOT NULL DEFAULT 0 CHECK (influencer_reach >= 0),
  notes             TEXT,
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_outputs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  output_type   TEXT NOT NULL CHECK (output_type IN ('podcast', 'youtube_program', 'media_report', 'other')),
  name          TEXT NOT NULL,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  quantity      NUMERIC NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  status        TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  delivery_date DATE,
  notes         TEXT,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partnership_activities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type  TEXT NOT NULL CHECK (activity_type IN ('award', 'sponsorship', 'event', 'partnership', 'speaker', 'product_sponsor')),
  entity_name    TEXT NOT NULL,
  activity_date  DATE,
  status         TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'contacted', 'confirmed', 'completed', 'cancelled')),
  impact_value   NUMERIC,
  notes          TEXT,
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS form_instance_id UUID;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS stage TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_form_instance_id_fkey'
      AND conrelid = 'documents'::regclass
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_form_instance_id_fkey
      FOREIGN KEY (form_instance_id) REFERENCES project_form_instances(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'challenges_form_instance_id_fkey'
      AND conrelid = 'challenges'::regclass
  ) THEN
    ALTER TABLE challenges
      ADD CONSTRAINT challenges_form_instance_id_fkey
      FOREIGN KEY (form_instance_id) REFERENCES project_form_instances(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'challenges_kpi_id_fkey'
      AND conrelid = 'challenges'::regclass
  ) THEN
    ALTER TABLE challenges
      ADD CONSTRAINT challenges_kpi_id_fkey
      FOREIGN KEY (kpi_id) REFERENCES kpi_definitions(id) ON DELETE SET NULL;
  END IF;
END $$;

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
-- 7.1. جدول اللقطات اليومية لتحليلات المشاريع (project_daily_snapshots)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_daily_snapshots (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  total_tasks          INTEGER NOT NULL DEFAULT 0 CHECK (total_tasks >= 0),
  completed_tasks      INTEGER NOT NULL DEFAULT 0 CHECK (completed_tasks >= 0),
  open_tasks           INTEGER NOT NULL DEFAULT 0 CHECK (open_tasks >= 0),
  overdue_tasks        INTEGER NOT NULL DEFAULT 0 CHECK (overdue_tasks >= 0),
  backlog_tasks        INTEGER NOT NULL DEFAULT 0 CHECK (backlog_tasks >= 0),
  todo_tasks           INTEGER NOT NULL DEFAULT 0 CHECK (todo_tasks >= 0),
  in_progress_tasks    INTEGER NOT NULL DEFAULT 0 CHECK (in_progress_tasks >= 0),
  review_tasks         INTEGER NOT NULL DEFAULT 0 CHECK (review_tasks >= 0),
  cancelled_tasks      INTEGER NOT NULL DEFAULT 0 CHECK (cancelled_tasks >= 0),
  planned_progress     NUMERIC NOT NULL DEFAULT 0 CHECK (planned_progress >= 0 AND planned_progress <= 100),
  actual_progress      NUMERIC NOT NULL DEFAULT 0 CHECK (actual_progress >= 0 AND actual_progress <= 100),
  total_budget         NUMERIC NOT NULL DEFAULT 0 CHECK (total_budget >= 0),
  planned_cost         NUMERIC NOT NULL DEFAULT 0 CHECK (planned_cost >= 0),
  estimated_cost       NUMERIC NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  open_risks           INTEGER NOT NULL DEFAULT 0 CHECK (open_risks >= 0),
  critical_risks       INTEGER NOT NULL DEFAULT 0 CHECK (critical_risks >= 0),
  high_risks           INTEGER NOT NULL DEFAULT 0 CHECK (high_risks >= 0),
  medium_risks         INTEGER NOT NULL DEFAULT 0 CHECK (medium_risks >= 0),
  low_risks            INTEGER NOT NULL DEFAULT 0 CHECK (low_risks >= 0),
  source               TEXT NOT NULL DEFAULT 'daily_cron' CHECK (source IN ('daily_cron', 'manual', 'system')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, snapshot_date)
);

-- ============================================================
-- 8. جدول الإشعارات (notifications)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  task_id    UUID REFERENCES tasks(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  form_instance_id UUID REFERENCES project_form_instances(id) ON DELETE CASCADE,
  kpi_id     UUID REFERENCES kpi_definitions(id) ON DELETE SET NULL,
  category   TEXT,
  priority   TEXT NOT NULL DEFAULT 'medium',
  type       TEXT,
  title      TEXT,
  body       TEXT,
  action_url TEXT,
  metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT,
  status     TEXT NOT NULL DEFAULT 'active',
  sent_via   TEXT DEFAULT 'in_app',
  sent_at    TIMESTAMPTZ,
  read_at    TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS form_instance_id UUID REFERENCES project_form_instances(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS kpi_id UUID REFERENCES kpi_definitions(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE notifications ALTER COLUMN sent_via SET DEFAULT 'in_app';

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
-- 9.1. جدول تفضيلات الإشعارات (notification_preferences)
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id               UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  in_app_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  important_email_only  BOOLEAN NOT NULL DEFAULT TRUE,
  daily_digest_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_digest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start     TEXT,
  quiet_hours_end       TEXT,
  timezone              TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

DROP TRIGGER IF EXISTS update_task_time_entries_updated_at ON task_time_entries;
CREATE TRIGGER update_task_time_entries_updated_at
  BEFORE UPDATE ON task_time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_form_templates_updated_at ON project_form_templates;
CREATE TRIGGER update_project_form_templates_updated_at
  BEFORE UPDATE ON project_form_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_form_instances_updated_at ON project_form_instances;
CREATE TRIGGER update_project_form_instances_updated_at
  BEFORE UPDATE ON project_form_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kpi_definitions_updated_at ON kpi_definitions;
CREATE TRIGGER update_kpi_definitions_updated_at
  BEFORE UPDATE ON kpi_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kpi_values_updated_at ON kpi_values;
CREATE TRIGGER update_kpi_values_updated_at
  BEFORE UPDATE ON kpi_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kpi_share_links_updated_at ON kpi_share_links;
CREATE TRIGGER update_kpi_share_links_updated_at
  BEFORE UPDATE ON kpi_share_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_indicator_products_updated_at ON indicator_products;
CREATE TRIGGER update_indicator_products_updated_at
  BEFORE UPDATE ON indicator_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_performance_updates_updated_at ON project_performance_updates;
CREATE TRIGGER update_project_performance_updates_updated_at
  BEFORE UPDATE ON project_performance_updates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_daily_snapshots_updated_at ON project_daily_snapshots;
CREATE TRIGGER update_project_daily_snapshots_updated_at
  BEFORE UPDATE ON project_daily_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_revenue_entries_updated_at ON revenue_entries;
CREATE TRIGGER update_revenue_entries_updated_at
  BEFORE UPDATE ON revenue_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_opportunities_updated_at ON client_opportunities;
CREATE TRIGGER update_client_opportunities_updated_at
  BEFORE UPDATE ON client_opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_audience_metrics_updated_at ON audience_metrics;
CREATE TRIGGER update_audience_metrics_updated_at
  BEFORE UPDATE ON audience_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_service_outputs_updated_at ON service_outputs;
CREATE TRIGGER update_service_outputs_updated_at
  BEFORE UPDATE ON service_outputs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_partnership_activities_updated_at ON partnership_activities;
CREATE TRIGGER update_partnership_activities_updated_at
  BEFORE UPDATE ON partnership_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_challenges_updated_at ON challenges;
CREATE TRIGGER update_challenges_updated_at
  BEFORE UPDATE ON challenges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
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
  IF NEW.status = 'Done' THEN
    NEW.progress = 100;
  ELSIF NEW.progress_mode = 'quantity' AND NEW.quantity_total IS NOT NULL AND NEW.quantity_total > 0 THEN
    NEW.progress = LEAST(100, GREATEST(0, ROUND((COALESCE(NEW.quantity_done, 0) / NEW.quantity_total) * 100)));
  ELSIF NEW.progress_mode = 'manual' THEN
    NEW.progress = COALESCE(NEW.progress, 0);
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
-- Guard: actual_hours is derived from task_time_entries only
-- ============================================================
CREATE OR REPLACE FUNCTION protect_task_actual_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.actual_hours := COALESCE(NEW.actual_hours, 0);

    IF NEW.actual_hours <> 0 THEN
      RAISE EXCEPTION 'actual_hours is managed from task_time_entries';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.actual_hours IS DISTINCT FROM OLD.actual_hours
    AND current_setting('app.recalculating_task_hours', true) IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION 'actual_hours is managed from task_time_entries';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_task_actual_hours_insert_trigger ON tasks;
CREATE TRIGGER protect_task_actual_hours_insert_trigger
  BEFORE INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION protect_task_actual_hours();

DROP TRIGGER IF EXISTS protect_task_actual_hours_update_trigger ON tasks;
CREATE TRIGGER protect_task_actual_hours_update_trigger
  BEFORE UPDATE OF actual_hours ON tasks
  FOR EACH ROW EXECUTE FUNCTION protect_task_actual_hours();

-- ============================================================
-- Trigger: recalculate actual task hours from time entries
-- ============================================================
CREATE OR REPLACE FUNCTION recalc_task_actual_hours()
RETURNS TRIGGER AS $$
DECLARE
  affected_task_id UUID;
BEGIN
  affected_task_id := COALESCE(NEW.task_id, OLD.task_id);
  PERFORM set_config('app.recalculating_task_hours', 'on', true);

  IF TG_OP = 'UPDATE' AND OLD.task_id IS DISTINCT FROM NEW.task_id THEN
    UPDATE tasks
    SET actual_hours = COALESCE((
      SELECT SUM(hours)
      FROM task_time_entries
      WHERE task_id = OLD.task_id
    ), 0)
    WHERE id = OLD.task_id;
  END IF;

  UPDATE tasks
  SET actual_hours = COALESCE((
    SELECT SUM(hours)
    FROM task_time_entries
    WHERE task_id = affected_task_id
  ), 0)
  WHERE id = affected_task_id;

  PERFORM set_config('app.recalculating_task_hours', 'off', true);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recalc_task_actual_hours_trigger ON task_time_entries;
CREATE TRIGGER recalc_task_actual_hours_trigger
  AFTER INSERT OR UPDATE OR DELETE ON task_time_entries
  FOR EACH ROW EXECUTE FUNCTION recalc_task_actual_hours();

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_id ON tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_board_column ON tasks(board_column);
CREATE INDEX IF NOT EXISTS idx_task_time_entries_task ON task_time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_task_time_entries_user ON task_time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_task_time_entries_work_date ON task_time_entries(work_date);
CREATE INDEX IF NOT EXISTS idx_projects_project_type ON projects(project_type);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_form_templates_active ON project_form_templates(active);
CREATE INDEX IF NOT EXISTS idx_project_form_instances_project ON project_form_instances(project_id);
CREATE INDEX IF NOT EXISTS idx_project_form_instances_template ON project_form_instances(template_id);
CREATE INDEX IF NOT EXISTS idx_project_form_instances_owner ON project_form_instances(assigned_owner_id);
CREATE INDEX IF NOT EXISTS idx_project_form_shares_instance ON project_form_shares(form_instance_id);
CREATE INDEX IF NOT EXISTS idx_project_form_shares_user ON project_form_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_perspective ON kpi_definitions(perspective);
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_visibility ON kpi_definitions(visibility);
CREATE INDEX IF NOT EXISTS idx_kpi_values_kpi_period ON kpi_values(kpi_id, period_type, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_kpi_values_updated_at ON kpi_values(updated_at);
CREATE INDEX IF NOT EXISTS idx_kpi_share_links_hash ON kpi_share_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_kpi_share_links_active ON kpi_share_links(active);
CREATE INDEX IF NOT EXISTS idx_indicator_products_kpi ON indicator_products(kpi_id);
CREATE INDEX IF NOT EXISTS idx_indicator_products_status ON indicator_products(status);
CREATE INDEX IF NOT EXISTS idx_project_performance_updates_project ON project_performance_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_project_performance_updates_period ON project_performance_updates(period_type, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_revenue_entries_type_date ON revenue_entries(revenue_type, entry_date);
CREATE INDEX IF NOT EXISTS idx_client_opportunities_type_status ON client_opportunities(record_type, status);
CREATE INDEX IF NOT EXISTS idx_audience_metrics_platform_date ON audience_metrics(platform, metric_date);
CREATE INDEX IF NOT EXISTS idx_service_outputs_type_status ON service_outputs(output_type, status);
CREATE INDEX IF NOT EXISTS idx_partnership_activities_type_status ON partnership_activities(activity_type, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_project ON notifications(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON notifications(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_project ON challenges(project_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_risk_level ON challenges(risk_level);
CREATE INDEX IF NOT EXISTS idx_challenges_kpi ON challenges(kpi_id);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_stage ON documents(stage);
CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_project_daily_snapshots_project ON project_daily_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_project_daily_snapshots_date ON project_daily_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_project_daily_snapshots_project_date ON project_daily_snapshots(project_id, snapshot_date DESC);

-- ============================================================
-- Data API grants for authenticated users
-- ============================================================
GRANT SELECT ON project_form_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_form_instances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_form_shares TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON challenges TO authenticated;
GRANT SELECT ON kpi_definitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON kpi_values TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON kpi_share_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON indicator_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_performance_updates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON revenue_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON client_opportunities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON audience_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON service_outputs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON partnership_activities TO authenticated;
GRANT SELECT, UPDATE ON notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON task_time_entries TO authenticated;
GRANT SELECT ON project_daily_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_daily_snapshots TO service_role;
