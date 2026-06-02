-- ============================================================
-- سماوة - تفعيل اللقطات اليومية لتحليلات المشاريع
-- تشغيله على قاعدة قائمة بعد schema.sql و rls.sql
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

CREATE INDEX IF NOT EXISTS idx_project_daily_snapshots_project ON project_daily_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_project_daily_snapshots_date ON project_daily_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_project_daily_snapshots_project_date ON project_daily_snapshots(project_id, snapshot_date DESC);

DROP TRIGGER IF EXISTS update_project_daily_snapshots_updated_at ON project_daily_snapshots;
CREATE TRIGGER update_project_daily_snapshots_updated_at
  BEFORE UPDATE ON project_daily_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

GRANT SELECT ON project_daily_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_daily_snapshots TO service_role;

ALTER TABLE project_daily_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_daily_snapshots_select" ON project_daily_snapshots;
CREATE POLICY "project_daily_snapshots_select" ON project_daily_snapshots
  FOR SELECT USING (
    get_my_role() = 'admin'
    OR is_project_manager(project_id)
    OR is_project_member(project_id)
    OR EXISTS (
      SELECT 1
      FROM tasks
      WHERE tasks.project_id = project_daily_snapshots.project_id
        AND tasks.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "project_daily_snapshots_insert" ON project_daily_snapshots;
CREATE POLICY "project_daily_snapshots_insert" ON project_daily_snapshots
  FOR INSERT WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "project_daily_snapshots_update" ON project_daily_snapshots;
CREATE POLICY "project_daily_snapshots_update" ON project_daily_snapshots
  FOR UPDATE USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "project_daily_snapshots_delete" ON project_daily_snapshots;
CREATE POLICY "project_daily_snapshots_delete" ON project_daily_snapshots
  FOR DELETE USING (get_my_role() = 'admin');
