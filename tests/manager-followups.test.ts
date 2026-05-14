import { describe, expect, it } from "vitest";
import { buildManagerFollowups } from "../lib/notifications/manager-followups";

const today = new Date("2026-05-14T08:00:00.000Z");

function project(overrides = {}) {
  return {
    id: "project-1",
    name: "مشروع تجريبي",
    manager_id: "manager-1",
    path: "media",
    current_stage: "execution",
    status: "active" as const,
    end_date: "2026-05-20",
    total_budget: 0,
    progress: 50,
    updated_at: "2026-05-01T08:00:00.000Z",
    ...overrides,
  };
}

describe("buildManagerFollowups", () => {
  it("creates manager findings without treating zero budget as a generic project problem", () => {
    const followups = buildManagerFollowups({
      today,
      projects: [project()],
      tasks: [],
      challenges: [],
      forms: [],
      performanceUpdates: [
        {
          id: "perf-1",
          project_id: "project-1",
          period_start: "2026-05-01",
          planned_progress: 60,
          actual_progress: 40,
          actual_cost: 500,
        },
      ],
    });

    expect(followups).toHaveLength(1);
    expect(followups[0].findings.some((finding) => finding.title.includes("الميزانية"))).toBe(true);
    expect(followups[0].findings.some((finding) => finding.title === "المشروع ناقص بيانات أساسية")).toBe(false);
  });

  it("marks important overdue tasks as critical follow-up findings", () => {
    const followups = buildManagerFollowups({
      today,
      projects: [project({ total_budget: 100000, updated_at: "2026-05-12T08:00:00.000Z" })],
      tasks: [
        {
          id: "task-1",
          project_id: "project-1",
          title: "مهمة متأخرة",
          owner_id: "member-1",
          status: "In Progress",
          priority: "critical",
          due_date: "2026-05-10",
          updated_at: "2026-05-13T08:00:00.000Z",
        },
      ],
      challenges: [],
      forms: [],
      performanceUpdates: [
        {
          id: "perf-1",
          project_id: "project-1",
          period_start: "2026-05-01",
          planned_progress: 50,
          actual_progress: 50,
          actual_cost: 50000,
        },
      ],
    });

    expect(followups[0].findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "tasks",
          priority: "critical",
          title: "مهام متأخرة",
        }),
      ])
    );
  });
});
