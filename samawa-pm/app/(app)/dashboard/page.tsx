import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import { DashboardStats } from "@/components/dashboard/stats";
import { DashboardCharts } from "@/components/dashboard/charts";
import { RecentChallenges } from "@/components/dashboard/recent-challenges";
import { TopTasks } from "@/components/dashboard/top-tasks";
import { RecentDocuments } from "@/components/dashboard/recent-documents";

export default async function DashboardPage() {
  const { user } = await getUser();
  const supabase = await createClient();

  const [
    { data: projects },
    { data: tasks },
    { data: challenges },
    { data: documents },
  ] = await Promise.all([
    supabase.from("projects").select("id, name, status, progress, end_date"),
    supabase.from("tasks").select("id, title, status, due_date, priority, alert_level, owner_id, project_id"),
    supabase.from("challenges").select("id, title, status, risk_impact, created_at, project_id").eq("status", "open").order("created_at", { ascending: false }).limit(5),
    supabase.from("documents").select("id, title, type, created_at, project_id").order("created_at", { ascending: false }).limit(5),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const activeProjects = projects?.filter((p) => p.status === "active").length ?? 0;
  const pausedProjects = projects?.filter((p) => p.status === "paused").length ?? 0;
  const openTasks = tasks?.filter((t) => !["Done", "Cancelled"].includes(t.status)).length ?? 0;
  const overdueTasks = tasks?.filter((t) => t.due_date && t.due_date < today && !["Done", "Cancelled"].includes(t.status)).length ?? 0;
  const todayTasks = tasks?.filter((t) => t.due_date === today && !["Done", "Cancelled"].includes(t.status)).length ?? 0;

  const topTasks = tasks
    ?.filter((t) => t.due_date && !["Done", "Cancelled"].includes(t.status))
    .sort((a, b) => {
      if (a.alert_level === "High" && b.alert_level !== "High") return -1;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      return 0;
    })
    .slice(0, 5) ?? [];

  return (
    <div className="page-container space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-muted-foreground text-sm mt-1">مرحباً، {user.full_name}</p>
      </div>

      <DashboardStats
        activeProjects={activeProjects}
        pausedProjects={pausedProjects}
        openTasks={openTasks}
        overdueTasks={overdueTasks}
        todayTasks={todayTasks}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DashboardCharts tasks={tasks ?? []} projects={projects ?? []} />
        </div>
        <div className="space-y-6">
          <TopTasks tasks={topTasks} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RecentChallenges challenges={challenges ?? []} />
        <RecentDocuments documents={documents ?? []} />
      </div>
    </div>
  );
}
