-- Keeps task expenses and project budgets non-negative while preserving existing nullable data.

UPDATE projects
SET total_budget = 0
WHERE total_budget < 0;

UPDATE tasks
SET cost = 0
WHERE cost < 0;

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_total_budget_nonnegative;

ALTER TABLE projects
  ADD CONSTRAINT projects_total_budget_nonnegative
  CHECK (total_budget IS NULL OR total_budget >= 0);

ALTER TABLE tasks
  ALTER COLUMN cost SET DEFAULT 0;

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_cost_nonnegative;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_cost_nonnegative
  CHECK (cost IS NULL OR cost >= 0);
