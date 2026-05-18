import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const { user } = await getUser();
  const supabase = await createClient();

  const [
    { data: projects },
    { data: tasks },
    { data: comments },
  ] = await Promise.all([
    supabase.from("projects").select("id, name, status, progress, end_date"),
    supabase.from("tasks").select("id, title, sub_task, category, status, due_date, priority, alert_level, owner_id, project_id, planned_hours, actual_hours, created_at, updated_at"),
    supabase.from("comments").select("id, body, created_at, task_id, user:profiles(full_name)").order("created_at", { ascending: false }).limit(10),
  ]);

  return (
    <div className="min-h-full bg-slate-50/50 p-6 lg:p-8">
      <DashboardClient 
        user={user} 
        projects={projects ?? []} 
        tasks={tasks ?? []} 
        comments={comments ?? []}
      />
    </div>
  );
}
