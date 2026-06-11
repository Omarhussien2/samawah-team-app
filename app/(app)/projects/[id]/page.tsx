import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { notFound } from "next/navigation";
import { ProjectDetailClient } from "@/components/projects/project-detail-client";
import { attachProjectTypes } from "@/lib/projects/project-type-store";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getUser();
  const supabase = await createClient();

  const [
    { data: project },
    { data: tasks },
    { data: challenges },
    { data: documents },
    { data: profiles },
    { data: kpiDefinitions },
    { data: projectSnapshots },
  ] = await Promise.all([
    supabase.from("projects").select("*, manager:profiles!projects_manager_id_fkey(id,full_name,avatar_url)").eq("id", id).single(),
    supabase.from("tasks").select("*, owner:profiles(id,full_name,avatar_url)").eq("project_id", id).order("sort_order"),
    supabase
      .from("challenges")
      .select("*, owner:profiles(id,full_name), kpi:kpi_definitions(id,name,code)")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("documents").select("*, creator:profiles(id,full_name)").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id,full_name,avatar_url").eq("active", true),
    supabase.from("kpi_definitions").select("*").eq("active", true).eq("perspective", "العمليات والمشاريع").order("sort_order", { ascending: true }),
    supabase
      .from("project_daily_snapshots")
      .select("*")
      .eq("project_id", id)
      .order("snapshot_date", { ascending: false })
      .limit(120),
  ]);

  if (!project) notFound();
  const [projectWithType] = await attachProjectTypes([project]);

  return (
    <div className="page-container">
      <ProjectDetailClient
        project={projectWithType}
        tasks={tasks ?? []}
        challenges={challenges ?? []}
        documents={documents ?? []}
        profiles={profiles ?? []}
        kpiDefinitions={kpiDefinitions ?? []}
        projectSnapshots={projectSnapshots ?? []}
        currentUser={user}
      />
    </div>
  );
}
