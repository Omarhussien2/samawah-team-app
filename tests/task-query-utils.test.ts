import { describe, expect, it } from "vitest";
import { applyTaskChangeToList, type TaskWithRelations } from "../lib/queries/tasks";

function makeTask(overrides: Partial<TaskWithRelations> = {}): TaskWithRelations {
  return {
    id: "task-1",
    legacy_task_id: null,
    project_id: "project-1",
    title: "Task",
    sub_task: null,
    category: null,
    owner_id: "user-1",
    owner_name: "User One",
    status: "To Do",
    board_column: "To Do",
    priority: "medium",
    start_date: null,
    due_date: null,
    cost: null,
    planned_hours: 0,
    actual_hours: 0,
    quantity_total: null,
    quantity_done: null,
    progress_mode: "manual",
    progress: 0,
    schedule_status: null,
    alert_level: null,
    alert_message: null,
    alert_action: null,
    days_to_due: null,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("task query list helpers", () => {
  it("merges updates without duplicating tasks", () => {
    const task = makeTask();
    const updated = makeTask({ title: "Updated task", progress: 40 });

    const result = applyTaskChangeToList([task], "UPDATE", updated, { projectId: "project-1" });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "task-1", title: "Updated task", progress: 40 });
  });

  it("removes tasks that no longer match a project-scoped list", () => {
    const task = makeTask();
    const moved = makeTask({ project_id: "project-2" });

    const result = applyTaskChangeToList([task], "UPDATE", moved, { projectId: "project-1" });

    expect(result).toEqual([]);
  });

  it("removes deleted tasks from cached lists", () => {
    const task = makeTask();
    const otherTask = makeTask({ id: "task-2" });

    const result = applyTaskChangeToList([task, otherTask], "DELETE", task);

    expect(result).toEqual([otherTask]);
  });
});
