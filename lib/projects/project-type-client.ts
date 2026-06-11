import { getProjectType } from "@/lib/utils";
import type { ProjectType } from "@/lib/supabase/types";
import type { ProjectTypeReference } from "@/lib/projects/project-type-store";

async function fetchProjectTypes(projectIds: string[]): Promise<Map<string, ProjectType>> {
  const ids = Array.from(new Set(projectIds.filter(Boolean)));
  const map = new Map<string, ProjectType>();
  if (ids.length === 0) return map;

  const params = new URLSearchParams({ ids: ids.join(",") });
  const response = await fetch(`/api/projects/types?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) return map;

  const data = (await response.json().catch(() => null)) as { types?: Record<string, ProjectType> } | null;
  for (const [id, type] of Object.entries(data?.types ?? {})) {
    map.set(id, type);
  }

  return map;
}

export async function attachProjectTypesFromApi<T extends ProjectTypeReference>(
  projects: T[]
): Promise<Array<T & { project_type: ProjectType }>> {
  const typeMap = await fetchProjectTypes(projects.map((project) => project.id ?? ""));
  return projects.map((project) => ({
    ...project,
    project_type: project.id ? typeMap.get(project.id) ?? getProjectType(project) : getProjectType(project),
  }));
}

export async function attachRelationProjectTypesFromApi<T extends { project?: ProjectTypeReference | null }>(
  rows: T[]
): Promise<T[]> {
  const typeMap = await fetchProjectTypes(rows.map((row) => row.project?.id ?? ""));
  return rows.map((row) => {
    if (!row.project?.id) return row;
    return {
      ...row,
      project: {
        ...row.project,
        project_type: typeMap.get(row.project.id) ?? getProjectType(row.project),
      },
    };
  });
}
