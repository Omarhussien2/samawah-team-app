import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { ProjectsClient } from "@/components/projects/projects-client";
import {
  PROJECT_WITH_MANAGER_SELECT,
  getScopedProjects,
  normalizeProjectListScope,
  type ProjectWithManager,
} from "@/lib/projects/project-access";
import { attachProjectTypes } from "@/lib/projects/project-type-store";

type ProjectsPageSearchParams = Promise<{ scope?: string | string[] | undefined }>;

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProjectsPage({ searchParams }: { searchParams: ProjectsPageSearchParams }) {
  const { user } = await getUser();
  const supabase = await createClient();
  const params = await searchParams;
  const projectScope = normalizeProjectListScope(firstSearchParam(params.scope), user);

  const [projects, { data: profiles }, { data: templates }] = await Promise.all([
    getScopedProjects<ProjectWithManager>(supabase, user, projectScope, {
      select: PROJECT_WITH_MANAGER_SELECT,
      sortField: "created_at",
    }),
    supabase.from("profiles").select("id, full_name, email, avatar_url").eq("active", true),
    supabase.from("project_templates").select("*, task_templates(*)"),
  ]);

  const projectsWithTypes = await attachProjectTypes(projects);

  return (
    <div className="page-container">
      <ProjectsClient
        projects={projectsWithTypes}
        profiles={profiles ?? []}
        templates={templates ?? []}
        currentUser={user}
        projectScope={projectScope}
      />
    </div>
  );
}
