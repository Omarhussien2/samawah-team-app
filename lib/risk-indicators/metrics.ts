import type { Challenge, Project, Task } from "@/lib/supabase/types";

export const RISK_REGISTER_TARGET = 80;
export const RISK_REGISTER_STALE_DAYS = 30;
export const OPEN_RISK_WARNING_RATE = 40;

export type RiskRegisterStatus = "updated" | "stale" | "missing";
export type RiskSeverity = "critical" | "high" | "medium" | "low";

export type RiskIndicatorProject = Pick<Project, "id" | "name" | "status" | "manager_name" | "updated_at">;

export type RiskIndicatorTask = Pick<Task, "id" | "project_id" | "status">;

export type RiskIndicatorChallenge = Pick<
  Challenge,
  | "id"
  | "project_id"
  | "task_id"
  | "title"
  | "status"
  | "kind"
  | "risk_level"
  | "risk_score"
  | "probability_score"
  | "impact_score"
  | "mitigation_plan"
  | "created_at"
  | "updated_at"
>;

export type ProjectRiskIndicatorRow = {
  id: string;
  name: string;
  managerName: string | null;
  registerStatus: RiskRegisterStatus;
  lastRiskUpdate: string | null;
  totalTasks: number;
  openTasks: number;
  openRisks: number;
  closedRisks: number;
  totalRisks: number;
  openBySeverity: Record<RiskSeverity, number>;
  linkedRiskTasks: number;
  unlinkedOpenRisks: number;
  activeChallenges: number;
  linkedActiveChallenges: number;
  nextAction: string;
};

export type RiskIndicatorSummary = {
  activeProjects: number;
  compliantProjects: number;
  projectsNeededForTarget: number;
  registerCoverageRate: number;
  openRisks: number;
  closedRisks: number;
  totalRisks: number;
  openRiskRate: number;
  unlinkedOpenRisks: number;
  criticalOpenRisks: number;
  highOpenRisks: number;
  totalTasks: number;
  openTasks: number;
  activeChallenges: number;
  linkedActiveChallenges: number;
  challengeTaskLinkRate: number;
};

export type RiskIndicatorData = {
  summary: RiskIndicatorSummary;
  severityTotals: Record<RiskSeverity, number>;
  projects: ProjectRiskIndicatorRow[];
  actionQueue: ProjectRiskIndicatorRow[];
};

const severityOrder: RiskSeverity[] = ["critical", "high", "medium", "low"];

export function buildRiskIndicatorData({
  projects,
  tasks,
  challenges,
  today = new Date(),
}: {
  projects: RiskIndicatorProject[];
  tasks: RiskIndicatorTask[];
  challenges: RiskIndicatorChallenge[];
  today?: Date;
}): RiskIndicatorData {
  const activeProjects = projects.filter((project) => project.status === "active");
  const activeProjectIds = new Set(activeProjects.map((project) => project.id));
  const tasksByProject = groupByProject(tasks.filter((task) => activeProjectIds.has(task.project_id)));
  const risksByProject = groupByProject(
    challenges.filter((challenge) => activeProjectIds.has(challenge.project_id) && challenge.kind === "risk"),
  );
  const challengeItemsByProject = groupByProject(
    challenges.filter((challenge) => activeProjectIds.has(challenge.project_id) && challenge.kind !== "risk"),
  );

  const rows = activeProjects.map((project) => {
    const projectRisks = risksByProject.get(project.id) ?? [];
    const projectTasks = tasksByProject.get(project.id) ?? [];
    const projectChallenges = challengeItemsByProject.get(project.id) ?? [];
    const openRiskItems = projectRisks.filter(isOpenStatus);
    const closedRiskItems = projectRisks.filter((risk) => !isOpenStatus(risk));
    const openChallengeItems = projectChallenges.filter(isOpenStatus);
    const lastRiskUpdate = latestDate(projectRisks.map((risk) => risk.updated_at ?? risk.created_at));
    const registerStatus = getRegisterStatus(projectRisks.length, lastRiskUpdate, today);
    const openBySeverity = emptySeverityCounts();

    for (const risk of openRiskItems) {
      openBySeverity[getRiskSeverity(risk)] += 1;
    }

    return {
      id: project.id,
      name: project.name,
      managerName: project.manager_name,
      registerStatus,
      lastRiskUpdate,
      totalTasks: projectTasks.length,
      openTasks: projectTasks.filter((task) => task.status !== "Done" && task.status !== "Cancelled").length,
      openRisks: openRiskItems.length,
      closedRisks: closedRiskItems.length,
      totalRisks: projectRisks.length,
      openBySeverity,
      linkedRiskTasks: countDistinct(projectRisks.map((risk) => risk.task_id).filter(Boolean)),
      unlinkedOpenRisks: openRiskItems.filter((risk) => !risk.task_id).length,
      activeChallenges: openChallengeItems.length,
      linkedActiveChallenges: openChallengeItems.filter((challenge) => Boolean(challenge.task_id)).length,
      nextAction: getNextAction(registerStatus, openBySeverity, openRiskItems),
    } satisfies ProjectRiskIndicatorRow;
  });

  const severityTotals = rows.reduce((totals, row) => {
    for (const severity of severityOrder) totals[severity] += row.openBySeverity[severity];
    return totals;
  }, emptySeverityCounts());

  const compliantProjects = rows.filter((row) => row.registerStatus === "updated").length;
  const openRisks = rows.reduce((total, row) => total + row.openRisks, 0);
  const closedRisks = rows.reduce((total, row) => total + row.closedRisks, 0);
  const totalRisks = openRisks + closedRisks;
  const activeChallenges = rows.reduce((total, row) => total + row.activeChallenges, 0);
  const linkedActiveChallenges = rows.reduce((total, row) => total + row.linkedActiveChallenges, 0);
  const targetProjectCount = Math.ceil(rows.length * (RISK_REGISTER_TARGET / 100));

  return {
    summary: {
      activeProjects: rows.length,
      compliantProjects,
      projectsNeededForTarget: Math.max(targetProjectCount - compliantProjects, 0),
      registerCoverageRate: percentage(compliantProjects, rows.length),
      openRisks,
      closedRisks,
      totalRisks,
      openRiskRate: percentage(openRisks, totalRisks),
      unlinkedOpenRisks: rows.reduce((total, row) => total + row.unlinkedOpenRisks, 0),
      criticalOpenRisks: severityTotals.critical,
      highOpenRisks: severityTotals.high,
      totalTasks: rows.reduce((total, row) => total + row.totalTasks, 0),
      openTasks: rows.reduce((total, row) => total + row.openTasks, 0),
      activeChallenges,
      linkedActiveChallenges,
      challengeTaskLinkRate: percentage(linkedActiveChallenges, activeChallenges),
    },
    severityTotals,
    projects: rows.sort(compareProjectRows),
    actionQueue: rows.filter(needsAttention).sort(compareAttentionRows).slice(0, 5),
  };
}

export function isOpenStatus(item: Pick<RiskIndicatorChallenge, "status">) {
  return item.status === "open" || item.status === "in_progress";
}

function groupByProject<T extends { project_id: string }>(items: T[]) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    grouped.set(item.project_id, [...(grouped.get(item.project_id) ?? []), item]);
  }
  return grouped;
}

function latestDate(values: Array<string | null | undefined>) {
  const latest = values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  return latest ?? null;
}

function getRegisterStatus(riskCount: number, lastRiskUpdate: string | null, today: Date): RiskRegisterStatus {
  if (riskCount === 0 || !lastRiskUpdate) return "missing";

  const ageMs = today.getTime() - new Date(lastRiskUpdate).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays <= RISK_REGISTER_STALE_DAYS ? "updated" : "stale";
}

function emptySeverityCounts(): Record<RiskSeverity, number> {
  return { critical: 0, high: 0, medium: 0, low: 0 };
}

function getRiskSeverity(risk: RiskIndicatorChallenge): RiskSeverity {
  if (risk.risk_level) return risk.risk_level;

  const score = risk.risk_score ?? clampRiskScore(risk.probability_score) * clampRiskScore(risk.impact_score);
  if (score >= 20) return "critical";
  if (score >= 12) return "high";
  if (score >= 6) return "medium";
  return "low";
}

function clampRiskScore(value: number | null | undefined) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 3;
  return Math.max(1, Math.min(5, Math.round(parsed)));
}

function countDistinct(values: Array<string | null | undefined>) {
  return new Set(values.filter((value): value is string => Boolean(value))).size;
}

function percentage(numerator: number, denominator: number) {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function getNextAction(
  registerStatus: RiskRegisterStatus,
  openBySeverity: Record<RiskSeverity, number>,
  openRisks: RiskIndicatorChallenge[],
) {
  if (registerStatus === "missing") return "إنشاء سجل مخاطر للمشروع أو توثيق عدم وجود مخاطر حالية.";
  if (registerStatus === "stale") return "تحديث سجل المخاطر لأن آخر مراجعة تجاوزت 30 يومًا.";
  if (openBySeverity.critical > 0) return "مراجعة المخاطر الحرجة وتحديد إجراء معالجة واضح.";
  if (openRisks.some((risk) => !risk.task_id)) return "ربط المخاطر المفتوحة بمهام معالجة داخل المشروع.";
  return "متابعة دورية للسجل وإغلاق البنود المكتملة.";
}

function needsAttention(row: ProjectRiskIndicatorRow) {
  return (
    row.registerStatus !== "updated" ||
    row.unlinkedOpenRisks > 0 ||
    row.openBySeverity.critical > 0 ||
    row.openBySeverity.high > 0
  );
}

function compareProjectRows(a: ProjectRiskIndicatorRow, b: ProjectRiskIndicatorRow) {
  if (a.registerStatus !== b.registerStatus) {
    const statusRank: Record<RiskRegisterStatus, number> = { missing: 0, stale: 1, updated: 2 };
    return statusRank[a.registerStatus] - statusRank[b.registerStatus];
  }
  return b.openRisks - a.openRisks || a.name.localeCompare(b.name, "ar");
}

function compareAttentionRows(a: ProjectRiskIndicatorRow, b: ProjectRiskIndicatorRow) {
  return (
    b.openBySeverity.critical - a.openBySeverity.critical ||
    b.openBySeverity.high - a.openBySeverity.high ||
    b.unlinkedOpenRisks - a.unlinkedOpenRisks ||
    a.name.localeCompare(b.name, "ar")
  );
}
