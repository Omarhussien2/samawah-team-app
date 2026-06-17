import type { Task } from "@/lib/supabase/types";

export const RECOMMENDATION_SOURCE_TYPE = "recommendation" as const;
export const RECOMMENDATION_CATEGORY = "توصية إدارية";
export const DEFAULT_RECOMMENDATION_STATUS = "To Do" as const;
export const DEFAULT_RECOMMENDATION_PRIORITY = "high" as const;

export interface RecommendationImportInputRow {
  projectName: string;
  text: string;
}

export interface RecommendationProjectReference {
  id: string;
  name: string;
}

export interface MatchedRecommendationImportRow extends RecommendationImportInputRow {
  projectId: string | null;
  matchedProjectName: string | null;
  matchStatus: "matched" | "unmatched" | "ambiguous";
}

export function isRecommendationTask(task: Pick<Task, "source_type" | "category">) {
  return task.source_type === RECOMMENDATION_SOURCE_TYPE || task.category === RECOMMENDATION_CATEGORY;
}

export function splitRecommendationBullets(input: string): string[] {
  return input
    .replace(/\r/g, "\n")
    .replace(/[•●▪]/g, "\n")
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)،-])\s+/, "").trim())
    .filter(Boolean);
}

export function parseRecommendationImportText(input: string): RecommendationImportInputRow[] {
  const rows: RecommendationImportInputRow[] = [];
  const lines = input
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let currentProjectName = "";

  for (const line of lines) {
    if (isHeaderLine(line)) continue;

    const inlineBulletIndex = line.search(/[•●▪]/);
    if (inlineBulletIndex > 0) {
      const projectName = line.slice(0, inlineBulletIndex).trim();
      const recommendations = line.slice(inlineBulletIndex);
      addRecommendationRows(rows, projectName, recommendations);
      currentProjectName = projectName;
      continue;
    }

    const delimited = splitDelimitedRecommendationRow(line);
    if (delimited) {
      addRecommendationRows(rows, delimited.projectName, delimited.recommendations);
      currentProjectName = delimited.projectName;
      continue;
    }

    if (looksLikeRecommendationLine(line) && currentProjectName) {
      addRecommendationRows(rows, currentProjectName, line);
      continue;
    }

    currentProjectName = line;
  }

  return rows;
}

export function matchRecommendationRowsToProjects(
  rows: RecommendationImportInputRow[],
  projects: RecommendationProjectReference[]
): MatchedRecommendationImportRow[] {
  return rows.map((row) => {
    const matches = findProjectMatches(row.projectName, projects);
    if (matches.length === 1) {
      return {
        ...row,
        projectId: matches[0].id,
        matchedProjectName: matches[0].name,
        matchStatus: "matched" as const,
      };
    }

    return {
      ...row,
      projectId: null,
      matchedProjectName: null,
      matchStatus: matches.length > 1 ? "ambiguous" as const : "unmatched" as const,
    };
  });
}

export function buildRecommendationDedupeKey({
  projectId,
  text,
  meetingTitle,
  meetingDate,
}: {
  projectId: string;
  text: string;
  meetingTitle?: string | null;
  meetingDate?: string | null;
}) {
  return [
    projectId,
    normalizeDateKey(meetingDate),
    normalizeSearchValue(meetingTitle ?? ""),
    normalizeSearchValue(text),
  ].join("|");
}

export function getExistingRecommendationKeys(
  tasks: Pick<Task, "project_id" | "title" | "source_meeting_title" | "source_meeting_date">[]
) {
  return new Set(
    tasks.map((task) =>
      buildRecommendationDedupeKey({
        projectId: task.project_id,
        text: task.title,
        meetingTitle: task.source_meeting_title,
        meetingDate: task.source_meeting_date,
      })
    )
  );
}

function addRecommendationRows(rows: RecommendationImportInputRow[], projectName: string, recommendations: string) {
  const cleanProjectName = projectName.trim();
  if (!cleanProjectName) return;

  for (const text of splitRecommendationBullets(recommendations)) {
    rows.push({ projectName: cleanProjectName, text });
  }
}

function splitDelimitedRecommendationRow(line: string) {
  const tabParts = line.split(/\t+/).map((part) => part.trim()).filter(Boolean);
  if (tabParts.length >= 2) {
    return { projectName: tabParts[0], recommendations: tabParts.slice(1).join(" ") };
  }

  const pipeParts = line.split(/\s*\|\s*/).map((part) => part.trim()).filter(Boolean);
  if (pipeParts.length >= 2) {
    return { projectName: pipeParts[0], recommendations: pipeParts.slice(1).join(" ") };
  }

  return null;
}

function isHeaderLine(line: string) {
  const normalized = normalizeSearchValue(line);
  return normalized === "المشروع التوصيات" || normalized === "project recommendations";
}

function looksLikeRecommendationLine(line: string) {
  return /^[\s]*(?:[-*]|\d+[.)،-])\s+/.test(line) || /^[\s]*[•●▪]/.test(line);
}

function findProjectMatches(projectName: string, projects: RecommendationProjectReference[]) {
  const normalized = normalizeSearchValue(projectName);
  if (!normalized) return [];

  const exact = projects.filter((project) => normalizeSearchValue(project.name) === normalized);
  if (exact.length > 0) return exact;

  if (normalized.length < 4) return [];

  return projects.filter((project) => {
    const projectValue = normalizeSearchValue(project.name);
    return projectValue.includes(normalized) || normalized.includes(projectValue);
  });
}

function normalizeDateKey(value?: string | null) {
  return value?.slice(0, 10) ?? "";
}

function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
