import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { attachProjectTypes, attachRelationProjectTypes } from "@/lib/projects/project-type-store";

export default async function DashboardAnalyticsPage() {
  const { user } = await getUser();
  const supabase = await createClient();

  const [{ data: projects }, { data: tasks }, { data: projectMembers }, { data: challenges }, { data: comments }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("*, manager:profiles!projects_manager_id_fkey(id,full_name,avatar_url)")
        .order("updated_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("*, owner:profiles(id,full_name,avatar_url), project:projects(id,name)")
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("project_members").select("project_id,user_id,role_in_project"),
      supabase
        .from("challenges")
        .select("*, owner:profiles(id,full_name), project:projects(id,name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("comments")
        .select("id, body, created_at, task_id, user:profiles(full_name), task:tasks(id,title,project_id)")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

  const [projectsWithTypes, tasksWithTypes, challengesWithTypes] = await Promise.all([
    attachProjectTypes(projects ?? []),
    attachRelationProjectTypes(tasks ?? []),
    attachRelationProjectTypes(challenges ?? []),
  ]);

  return (
    <div className="min-h-full bg-slate-50/50 p-6 lg:p-8">
      <DashboardClient
        mode="analytics"
        user={user}
        projects={projectsWithTypes}
        tasks={tasksWithTypes}
        projectMembers={projectMembers ?? []}
        challenges={challengesWithTypes}
        comments={comments ?? []}
      />
    </div>
  );
}
