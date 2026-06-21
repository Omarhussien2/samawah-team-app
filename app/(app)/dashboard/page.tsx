import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { attachProjectTypes, attachRelationProjectTypes } from "@/lib/projects/project-type-store";
import { getDashboardWorkspaceData } from "@/lib/dashboard/dashboard-data";
import { normalizeProjectListScope } from "@/lib/projects/project-access";

type DashboardPageSearchParams = Promise<{ scope?: string | string[] | undefined }>;

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardPage({ searchParams }: { searchParams: DashboardPageSearchParams }) {
  const { user } = await getUser();
  const supabase = await createClient();
  const params = await searchParams;
  const projectScope = normalizeProjectListScope(firstSearchParam(params.scope), user);

  const { projects, tasks, projectMembers, challenges, comments } = await getDashboardWorkspaceData(
    supabase,
    user,
    projectScope
  );

  const [projectsWithTypes, tasksWithTypes, challengesWithTypes] = await Promise.all([
    attachProjectTypes(projects),
    attachRelationProjectTypes(tasks),
    attachRelationProjectTypes(challenges),
  ]);

  return (
    <div className="min-h-full bg-slate-50/50 p-6 lg:p-8">
      <DashboardClient 
        mode="home"
        user={user} 
        projects={projectsWithTypes}
        tasks={tasksWithTypes}
        projectMembers={projectMembers}
        challenges={challengesWithTypes}
        comments={comments}
        projectScope={projectScope}
      />
    </div>
  );
}
