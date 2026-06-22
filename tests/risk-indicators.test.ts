import { describe, expect, it } from "vitest";
import { buildRiskIndicatorData } from "../lib/risk-indicators/metrics";
import type {
  RiskIndicatorChallenge,
  RiskIndicatorProject,
  RiskIndicatorTask,
} from "../lib/risk-indicators/metrics";

const today = new Date("2026-06-22T12:00:00.000Z");

function project(overrides: Partial<RiskIndicatorProject>): RiskIndicatorProject {
  return {
    id: "project-1",
    name: "مشروع",
    status: "active",
    manager_name: "مدير المشروع",
    updated_at: "2026-06-20T00:00:00.000Z",
    ...overrides,
  };
}

function risk(overrides: Partial<RiskIndicatorChallenge>): RiskIndicatorChallenge {
  return {
    id: "risk-1",
    project_id: "project-1",
    task_id: "task-1",
    title: "خطر",
    status: "open",
    kind: "risk",
    risk_level: "high",
    risk_score: 12,
    probability_score: 3,
    impact_score: 4,
    mitigation_plan: "خطة معالجة",
    created_at: "2026-06-10T00:00:00.000Z",
    updated_at: "2026-06-20T00:00:00.000Z",
    ...overrides,
  };
}

function task(overrides: Partial<RiskIndicatorTask>): RiskIndicatorTask {
  return {
    id: "task-1",
    project_id: "project-1",
    status: "In Progress",
    ...overrides,
  };
}

describe("risk indicator metrics", () => {
  it("calculates register coverage from active projects with updated risk records", () => {
    const data = buildRiskIndicatorData({
      today,
      projects: [
        project({ id: "project-1", name: "مشروع لديه سجل" }),
        project({ id: "project-2", name: "مشروع بلا سجل" }),
        project({ id: "project-3", name: "مشروع مكتمل", status: "completed" }),
      ],
      tasks: [task({ project_id: "project-1" }), task({ id: "task-2", project_id: "project-2" })],
      challenges: [risk({ project_id: "project-1" })],
    });

    expect(data.summary.activeProjects).toBe(2);
    expect(data.summary.compliantProjects).toBe(1);
    expect(data.summary.registerCoverageRate).toBe(50);
    expect(data.projects.find((item) => item.id === "project-2")?.registerStatus).toBe("missing");
  });

  it("uses open risks divided by all risks for the open risk rate", () => {
    const data = buildRiskIndicatorData({
      today,
      projects: [project({ id: "project-1" })],
      tasks: [task({ id: "task-1" })],
      challenges: [
        risk({ id: "risk-open", status: "open", task_id: null }),
        risk({ id: "risk-closed", status: "closed", risk_level: "low" }),
      ],
    });

    expect(data.summary.openRisks).toBe(1);
    expect(data.summary.totalRisks).toBe(2);
    expect(data.summary.openRiskRate).toBe(50);
    expect(data.summary.unlinkedOpenRisks).toBe(1);
  });

  it("counts active challenges that are linked to tasks", () => {
    const data = buildRiskIndicatorData({
      today,
      projects: [project({ id: "project-1" })],
      tasks: [task({ id: "task-1" })],
      challenges: [
        risk({ id: "risk-open" }),
        risk({ id: "challenge-linked", kind: "challenge", task_id: "task-1" }),
        risk({ id: "challenge-unlinked", kind: "issue", task_id: null }),
      ],
    });

    expect(data.summary.activeChallenges).toBe(2);
    expect(data.summary.linkedActiveChallenges).toBe(1);
    expect(data.summary.challengeTaskLinkRate).toBe(50);
  });
});
