import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { Database, Json, Project, Task, Challenge } from "@/lib/supabase/types";

type SnapshotInsert = Database["public"]["Tables"]["project_daily_snapshots"]["Insert"];
type SnapshotProject = Pick<Project, "id" | "status" | "start_date" | "end_date" | "total_budget" | "progress">;
type SnapshotTask = Pick<Task, "project_id" | "status" | "due_date" | "cost">;
type SnapshotChallenge = Pick<Challenge, "project_id" | "status" | "risk_level">;

const OPEN_TASK_STATUSES: Task["status"][] = ["Backlog", "To Do", "In Progress", "Review"];
const OPEN_CHALLENGE_STATUSES: Challenge["status"][] = ["open", "in_progress"];

function dateKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function dateValue(date: string | null | undefined) {
  if (!date) return null;
  const value = new Date(date).getTime();
  return Number.isNaN(value) ? null : value;
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function plannedProgress(project: SnapshotProject, snapshotDate: string) {
  const startMs = dateValue(project.start_date);
  const endMs = dateValue(project.end_date);
  const todayMs = dateValue(snapshotDate);

  if (todayMs === null) return Math.round(Number(project.progress ?? 0));
  if (startMs === null || endMs === null || endMs <= startMs) {
    return Math.round(Number(project.progress ?? 0));
  }

  if (todayMs <= startMs) return 0;
  if (todayMs >= endMs) return 100;

  return Math.round(((todayMs - startMs) / (endMs - startMs)) * 100);
}

function buildSnapshot(
  project: SnapshotProject,
  projectTasks: SnapshotTask[],
  projectChallenges: SnapshotChallenge[],
  snapshotDate: string
): SnapshotInsert {
  const totalTasks = projectTasks.length;
  const completedTasks = projectTasks.filter((task) => task.status === "Done").length;
  const openTasks = projectTasks.filter((task) => OPEN_TASK_STATUSES.includes(task.status)).length;
  const totalBudget = Number(project.total_budget ?? 0);
  const planned = plannedProgress(project, snapshotDate);
  const estimatedCost = projectTasks
    .filter((task) => task.status === "Done" || Boolean(task.due_date && task.due_date <= snapshotDate))
    .reduce((sum, task) => sum + Number(task.cost ?? 0), 0);
  const openRisks = projectChallenges.filter((challenge) =>
    OPEN_CHALLENGE_STATUSES.includes(challenge.status)
  );

  return {
    project_id: project.id,
    snapshot_date: snapshotDate,
    total_tasks: totalTasks,
    completed_tasks: completedTasks,
    open_tasks: openTasks,
    overdue_tasks: projectTasks.filter(
      (task) => Boolean(task.due_date && task.due_date < snapshotDate) && OPEN_TASK_STATUSES.includes(task.status)
    ).length,
    backlog_tasks: projectTasks.filter((task) => task.status === "Backlog").length,
    todo_tasks: projectTasks.filter((task) => task.status === "To Do").length,
    in_progress_tasks: projectTasks.filter((task) => task.status === "In Progress").length,
    review_tasks: projectTasks.filter((task) => task.status === "Review").length,
    cancelled_tasks: projectTasks.filter((task) => task.status === "Cancelled").length,
    planned_progress: planned,
    actual_progress: project.progress !== null ? Math.round(Number(project.progress)) : percent(completedTasks, totalTasks),
    total_budget: totalBudget,
    planned_cost: Math.round(totalBudget * (planned / 100)),
    estimated_cost: Math.round(estimatedCost),
    open_risks: openRisks.length,
    critical_risks: openRisks.filter((risk) => risk.risk_level === "critical").length,
    high_risks: openRisks.filter((risk) => risk.risk_level === "high").length,
    medium_risks: openRisks.filter((risk) => risk.risk_level === "medium").length,
    low_risks: openRisks.filter((risk) => risk.risk_level === "low").length,
    source: "daily_cron",
    updated_at: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const snapshotDate = dateKey(new Date());
  let logId: string | null = null;

  try {
    const { data: log } = await supabase
      .from("automation_logs")
      .insert({ type: "project-snapshots", status: "running", payload: { date: snapshotDate } })
      .select("id")
      .single();

    logId = log?.id ?? null;

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id,status,start_date,end_date,total_budget,progress")
      .in("status", ["active", "paused", "completed"]);

    if (projectsError) throw projectsError;

    if (!projects || projects.length === 0) {
      const payload: Json = { date: snapshotDate, projects: 0, snapshots: 0 };
      if (logId) await supabase.from("automation_logs").update({ status: "success", payload }).eq("id", logId);
      return NextResponse.json({ success: true, snapshots: 0 });
    }

    const projectIds = projects.map((project) => project.id);
    const [{ data: tasks, error: tasksError }, { data: challenges, error: challengesError }] = await Promise.all([
      supabase.from("tasks").select("project_id,status,due_date,cost").in("project_id", projectIds),
      supabase.from("challenges").select("project_id,status,risk_level").in("project_id", projectIds),
    ]);

    if (tasksError) throw tasksError;
    if (challengesError) throw challengesError;

    const tasksByProject = new Map<string, SnapshotTask[]>();
    const challengesByProject = new Map<string, SnapshotChallenge[]>();

    (tasks ?? []).forEach((task) => {
      const list = tasksByProject.get(task.project_id) ?? [];
      list.push(task);
      tasksByProject.set(task.project_id, list);
    });

    (challenges ?? []).forEach((challenge) => {
      const list = challengesByProject.get(challenge.project_id) ?? [];
      list.push(challenge);
      challengesByProject.set(challenge.project_id, list);
    });

    const snapshots = projects.map((project) =>
      buildSnapshot(
        project,
        tasksByProject.get(project.id) ?? [],
        challengesByProject.get(project.id) ?? [],
        snapshotDate
      )
    );

    const { error: upsertError } = await supabase
      .from("project_daily_snapshots")
      .upsert(snapshots, { onConflict: "project_id,snapshot_date" });

    if (upsertError) throw upsertError;

    const payload: Json = {
      date: snapshotDate,
      projects: projects.length,
      snapshots: snapshots.length,
    };

    if (logId) await supabase.from("automation_logs").update({ status: "success", payload }).eq("id", logId);

    return NextResponse.json({ success: true, snapshots: snapshots.length });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (logId) {
      await supabase.from("automation_logs").update({ status: "error", error: errorMessage }).eq("id", logId);
    } else {
      await supabase
        .from("automation_logs")
        .insert({ type: "project-snapshots", status: "error", error: errorMessage });
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
