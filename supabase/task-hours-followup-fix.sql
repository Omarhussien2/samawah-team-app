-- Follow-up patch for task planned/actual hours.
-- Run after the task_time_entries table and task hour columns from PR #35 exist.

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
