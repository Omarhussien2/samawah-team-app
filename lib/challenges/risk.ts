import type { Challenge, Project } from "@/lib/supabase/types";

export type ChallengeKind = "challenge" | "risk" | "issue";
export type ChallengeResponseStrategy = "mitigate" | "avoid" | "transfer" | "accept" | "monitor";
export type ChallengeRiskLevel = "low" | "medium" | "high" | "critical";

export type ChallengeRiskInput = Pick<
  Challenge,
  "probability_score" | "impact_score" | "risk_score" | "risk_level" | "status"
> &
  Partial<Pick<Challenge, "kind" | "project_id">>;
export type RiskRegisterProjectInput = Pick<Project, "id" | "status">;

export const CHALLENGE_KIND_LABELS: Record<ChallengeKind, string> = {
  challenge: "تحدي",
  risk: "مخاطر",
  issue: "عائق قائم",
};

export const RESPONSE_STRATEGY_LABELS: Record<ChallengeResponseStrategy, string> = {
  mitigate: "تخفيف الأثر",
  avoid: "تجنب",
  transfer: "نقل/تصعيد",
  accept: "قبول ومراقبة",
  monitor: "مراقبة",
};

export const RISK_LEVEL_LABELS: Record<ChallengeRiskLevel, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
  critical: "حرج",
};

export function clampRiskScore(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 3;
  return Math.max(1, Math.min(5, Math.round(Number(value))));
}

export function calculateRiskScore(probability: number | null | undefined, impact: number | null | undefined) {
  return clampRiskScore(probability) * clampRiskScore(impact);
}

export function getRiskLevel(score: number | null | undefined): ChallengeRiskLevel {
  const value = Number(score ?? 0);
  if (value >= 20) return "critical";
  if (value >= 12) return "high";
  if (value >= 6) return "medium";
  return "low";
}

export function getChallengeRiskScore(challenge: ChallengeRiskInput) {
  return challenge.risk_score ?? calculateRiskScore(challenge.probability_score, challenge.impact_score);
}

export function getChallengeRiskLevel(challenge: ChallengeRiskInput) {
  return (challenge.risk_level as ChallengeRiskLevel | null) ?? getRiskLevel(getChallengeRiskScore(challenge));
}

export function isOpenChallenge(challenge: Pick<Challenge, "status">) {
  return challenge.status === "open" || challenge.status === "in_progress";
}

export function isCriticalChallenge(challenge: ChallengeRiskInput) {
  return isOpenChallenge(challenge) && getChallengeRiskLevel(challenge) === "critical";
}

export function calculateRiskCoverage(challenges: ChallengeRiskInput[]) {
  const open = challenges.filter(isOpenChallenge);
  if (open.length === 0) return 100;

  const handled = open.filter((challenge) => {
    const level = getChallengeRiskLevel(challenge);
    return level === "low" || challenge.status === "in_progress";
  });

  return Math.round((handled.length / open.length) * 100);
}

export function calculateRiskRegisterCoverage(
  challenges: ChallengeRiskInput[],
  projects: RiskRegisterProjectInput[]
) {
  const activeProjects = projects.filter((project) => project.status === "active");
  if (activeProjects.length === 0) return 0;

  const activeProjectIds = new Set(activeProjects.map((project) => project.id));
  const projectsWithRiskRegister = new Set(
    challenges
      .filter(isRiskRecord)
      .map((challenge) => challenge.project_id)
      .filter((projectId): projectId is string => Boolean(projectId))
      .filter((projectId) => activeProjectIds.has(projectId))
  );

  return Math.round((projectsWithRiskRegister.size / activeProjects.length) * 100);
}

export function summarizeChallenges(challenges: ChallengeRiskInput[]) {
  const open = challenges.filter(isOpenChallenge);
  const critical = challenges.filter(isCriticalChallenge);
  const averageRiskScore = open.length
    ? Math.round(open.reduce((sum, challenge) => sum + getChallengeRiskScore(challenge), 0) / open.length)
    : 0;

  return {
    total: challenges.length,
    open: open.length,
    critical: critical.length,
    averageRiskScore,
    riskCoverage: calculateRiskCoverage(challenges),
  };
}

function isRiskRecord(challenge: ChallengeRiskInput) {
  return challenge.kind === "risk";
}
