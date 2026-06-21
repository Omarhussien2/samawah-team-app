import { PROJECT_TYPE_OPTIONS } from "@/lib/utils";
import type { ProjectType } from "@/lib/supabase/types";

export const PROJECTS_FILTER_STORAGE_KEY = "samawah:projects:filters";
export const PROJECT_FILTER_PARAM_KEYS = ["q", "status", "type", "manager", "view"] as const;
export const PROJECT_STATUSES = ["active", "paused", "completed", "cancelled"] as const;
export const PROJECT_VIEWS = ["card", "list", "timeline"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectView = (typeof PROJECT_VIEWS)[number];
export type ProjectFilters = {
  search: string;
  status: ProjectStatus | "";
  type: ProjectType | "";
  manager: string;
  view: ProjectView;
};

type SearchParamsReader = Pick<URLSearchParams, "get" | "has">;

export function isProjectView(value: string | null): value is ProjectView {
  return PROJECT_VIEWS.includes(value as ProjectView);
}

export function isProjectType(value: string | null): value is ProjectType {
  return PROJECT_TYPE_OPTIONS.some((option) => option.value === value);
}

export function isProjectStatus(value: string | null): value is ProjectStatus {
  return PROJECT_STATUSES.includes(value as ProjectStatus);
}

export function coerceProjectFiltersSnapshot(snapshot: unknown): ProjectFilters {
  const filters = snapshot && typeof snapshot === "object" ? (snapshot as Partial<ProjectFilters>) : {};
  const type = typeof filters.type === "string" ? filters.type : null;
  const view = typeof filters.view === "string" ? filters.view : null;
  const status = typeof filters.status === "string" ? filters.status : null;

  return {
    search: typeof filters.search === "string" ? filters.search : "",
    status: isProjectStatus(status) ? status : "",
    type: isProjectType(type) ? type : "",
    manager: typeof filters.manager === "string" ? filters.manager : "",
    view: isProjectView(view) ? view : "card",
  };
}

export function readProjectFiltersFromParams(searchParams: SearchParamsReader): ProjectFilters {
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const view = searchParams.get("view");

  return {
    search: searchParams.get("q") ?? "",
    status: isProjectStatus(status) ? status : "",
    type: isProjectType(type) ? type : "",
    manager: searchParams.get("manager") ?? "",
    view: isProjectView(view) ? view : "card",
  };
}

export function projectFiltersToParams(filters: ProjectFilters) {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.type) params.set("type", filters.type);
  if (filters.manager) params.set("manager", filters.manager);
  if (filters.view !== "card") params.set("view", filters.view);
  return params;
}

export function hasProjectFilterParams(searchParams: SearchParamsReader) {
  return PROJECT_FILTER_PARAM_KEYS.some((key) => searchParams.has(key));
}

export function isDefaultProjectFilters(filters: ProjectFilters) {
  return projectFiltersToParams(filters).toString() === "";
}
