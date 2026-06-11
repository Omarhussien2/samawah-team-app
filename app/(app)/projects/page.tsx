import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { ProjectsClient } from "@/components/projects/projects-client";
import { attachProjectTypes } from "@/lib/projects/project-type-store";

export default async function ProjectsPage() {
  const { user } = await getUser();
  const supabase = await createClient();

  const [{ data: projects }, { data: profiles }, { data: templates }] = await Promise.all([
    supabase
      .from("projects")
      .select("*, manager:profiles!projects_manager_id_fkey(id,full_name,avatar_url)")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email, avatar_url").eq("active", true),
    supabase.from("project_templates").select("*, task_templates(*)"),
  ]);

  const projectsWithTypes = await attachProjectTypes(projects ?? []);

  return (
    <div className="page-container">
      <ProjectsClient
        projects={projectsWithTypes}
        profiles={profiles ?? []}
        templates={templates ?? []}
        currentUser={user}
      />
    </div>
  );
}
