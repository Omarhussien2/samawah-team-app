import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile, Project } from "@/lib/supabase/types";

export const PROJECT_LIST_SCOPE_PARAM = "scope";
export const PROJECT_LIST_SCOPES = ["mine", "all"] as const;
export const PROJECT_WITH_MANAGER_SELECT = "*, manager:profiles!projects_manager_id_fkey(id,full_name,avatar_url)";

export type ProjectListScope = (typeof PROJECT_LIST_SCOPES)[number];
export type ProjectAccessProfile = Pick<Profile, "id" | "role">;
export type ProjectWorkspaceReference = Pick<Project, "id" | "manager_id" | "forms_owner_id">;
export type ProjectDateField = "created_at" | "updated_at";
export type ProjectWithManager = Project & {
  manager?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
};

interface ScopedProjectOptions {
  select?: string;
  status?: Project["status"];
  sortField?: ProjectDateField;
}

export function canViewAllProjects(profile: Pick<Profile, "role">) {
  return profile.role === "admin";
}

export function normalizeProjectListScope(scope: string | null | undefined, profile: Pick<Profile, "role">): ProjectListScope {
  return canViewAllProjects(profile) && scope === "all" ? "all" : "mine";
}

export function isProjectInUserWorkspace(
  project: ProjectWorkspaceReference,
  userId: string,
  memberProjectIds: Iterable<string> = []
) {
  const memberProjectIdSet = memberProjectIds instanceof Set ? memberProjectIds : new Set(memberProjectIds);
  return project.manager_id === userId || project.forms_owner_id === userId || memberProjectIdSet.has(project.id);
}

export function uniqueProjectIds(projectIds: Iterable<string | null | undefined>) {
  return [...new Set([...projectIds].filter((projectId): projectId is string => Boolean(projectId)))];
}

export function dedupeProjectsById<T extends Pick<Project, "id" | "created_at"> & Partial<Pick<Project, "updated_at">>>(
  projects: T[],
  sortField: ProjectDateField = "created_at"
) {
  const projectMap = new Map<string, T>();
  for (const project of projects) {
    if (!projectMap.has(project.id)) projectMap.set(project.id, project);
  }
  return [...projectMap.values()].sort(
    (a, b) => new Date(b[sortField] ?? b.created_at).getTime() - new Date(a[sortField] ?? a.created_at).getTime()
  );
}

export async function getWorkspaceMemberProjectIds(supabase: SupabaseClient<Database>, userId: string) {
  const { data: memberships } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", userId);

  return uniqueProjectIds((memberships ?? []).map((membership) => membership.project_id));
}

function buildProjectQuery(supabase: SupabaseClient<Database>, select: string, status?: Project["status"]) {
  const query = supabase.from("projects").select(select);
  return status ? query.eq("status", status) : query;
}

export async function getWorkspaceProjects<
  T extends ProjectWorkspaceReference & Pick<Project, "created_at"> & Partial<Pick<Project, "updated_at">>,
>(supabase: SupabaseClient<Database>, userId: string, options: ScopedProjectOptions = {}) {
  const { select = "*", status, sortField = "created_at" } = options;
  const memberProjectIds = await getWorkspaceMemberProjectIds(supabase, userId);
  const memberProjectsQuery = memberProjectIds.length
    ? buildProjectQuery(supabase, select, status).in("id", memberProjectIds)
    : null;

  const projectResults = await Promise.all([
    buildProjectQuery(supabase, select, status).eq("manager_id", userId),
    buildProjectQuery(supabase, select, status).eq("forms_owner_id", userId),
    ...(memberProjectsQuery ? [memberProjectsQuery] : []),
  ]);

  return dedupeProjectsById(projectResults.flatMap((result) => (result.data ?? []) as unknown as T[]), sortField);
}

export async function getScopedProjects<
  T extends ProjectWorkspaceReference & Pick<Project, "created_at"> & Partial<Pick<Project, "updated_at">>,
>(
  supabase: SupabaseClient<Database>,
  user: ProjectAccessProfile,
  scope: ProjectListScope,
  options: ScopedProjectOptions = {}
) {
  const { select = "*", status, sortField = "created_at" } = options;
  if (scope === "all") {
    const { data } = await buildProjectQuery(supabase, select, status).order(sortField, { ascending: false });
    return (data ?? []) as unknown as T[];
  }

  return getWorkspaceProjects<T>(supabase, user.id, { select, status, sortField });
}
