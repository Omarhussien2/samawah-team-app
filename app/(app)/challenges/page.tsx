import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { ChallengesPageClient } from "@/components/challenges/challenges-page-client";
import { attachProjectTypes, attachRelationProjectTypes } from "@/lib/projects/project-type-store";

export default async function ChallengesPage() {
  const { user } = await getUser();
  const supabase = await createClient();

  const [{ data: challenges }, { data: profiles }, { data: projects }, { data: kpiDefinitions }] = await Promise.all([
    supabase
      .from("challenges")
      .select("*, owner:profiles(id,full_name), project:projects(id,name), task:tasks(id,title), kpi:kpi_definitions(id,name,code)")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id,full_name,avatar_url").eq("active", true),
    supabase.from("projects").select("id,name").eq("status", "active"),
    supabase.from("kpi_definitions").select("*").eq("active", true).eq("perspective", "العمليات والمشاريع").order("sort_order", { ascending: true }),
  ]);

  const [challengesWithTypes, projectsWithTypes] = await Promise.all([
    attachRelationProjectTypes(challenges ?? []),
    attachProjectTypes(projects ?? []),
  ]);

  return (
    <div className="page-container">
      <ChallengesPageClient
        challenges={challengesWithTypes}
        profiles={profiles ?? []}
        projects={projectsWithTypes}
        kpiDefinitions={kpiDefinitions ?? []}
        currentUser={user}
      />
    </div>
  );
}
