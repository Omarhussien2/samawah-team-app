import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, NotificationPriority } from "@/lib/supabase/types";
import { defaultNotificationPreferences } from "@/lib/notifications/preferences";
import { upsertNotification } from "@/lib/notifications/upsert-notification";
import { buildNotificationDedupeKey } from "@/lib/notifications/rule-utils";

type Project = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  "id" | "name" | "manager_id" | "path" | "current_stage" | "status" | "end_date" | "total_budget" | "progress" | "updated_at"
>;
type Task = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  "id" | "project_id" | "title" | "owner_id" | "status" | "priority" | "due_date" | "updated_at"
>;
type Challenge = Pick<
  Database["public"]["Tables"]["challenges"]["Row"],
  "id" | "project_id" | "title" | "status" | "owner_id" | "risk_impact" | "updated_at"
>;
type FormInstance = Pick<
  Database["public"]["Tables"]["project_form_instances"]["Row"],
  "id" | "project_id" | "assigned_owner_id" | "status" | "completion_percentage" | "updated_at"
>;
type PerformanceUpdate = Pick<
  Database["public"]["Tables"]["project_performance_updates"]["Row"],
  "id" | "project_id" | "period_start" | "planned_progress" | "actual_progress" | "actual_cost"
>;

type FollowupCategory = "tasks" | "projects" | "challenges" | "forms" | "kpis";

export interface FollowupFinding {
  category: FollowupCategory;
  projectId: string;
  projectName: string;
  priority: NotificationPriority;
  title: string;
  count: number;
  actionUrl: string;
}

export interface ManagerFollowup {
  managerId: string;
  findings: FollowupFinding[];
}

export interface ManagerFollowupResult {
  managersChecked: number;
  notificationsCreated: number;
  findingsCreated: number;
}

interface BuildInput {
  projects: Project[];
  tasks: Task[];
  challenges: Challenge[];
  forms: FormInstance[];
  performanceUpdates: PerformanceUpdate[];
  today: Date;
}

const doneTaskStatuses = new Set(["Done", "Cancelled"]);
const importantTaskPriorities = new Set(["high", "critical"]);
const activeChallengeStatuses = new Set(["open", "in_progress"]);
const highImpactValues = new Set(["high", "critical", "عالي", "عال", "مرتفع", "حرج", "حرجة"]);

function toDateOnly(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysAgo(date: Date, days: number): string {
  return addDays(date, -days).toISOString();
}

function monthStart(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().split("T")[0];
}

function priorityScore(priority: NotificationPriority): number {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function maxPriority(findings: FollowupFinding[]): NotificationPriority {
  return findings.reduce<NotificationPriority>(
    (current, finding) => (priorityScore(finding.priority) > priorityScore(current) ? finding.priority : current),
    "low"
  );
}

function countByProject<T extends { project_id: string }>(records: T[]): Map<string, T[]> {
  return records.reduce((acc, record) => {
    acc.set(record.project_id, [...(acc.get(record.project_id) ?? []), record]);
    return acc;
  }, new Map<string, T[]>());
}

function createFinding(
  category: FollowupCategory,
  project: Project,
  priority: NotificationPriority,
  title: string,
  count: number,
  actionUrl = `/projects/${project.id}`
): FollowupFinding | null {
  if (count <= 0) return null;

  return {
    category,
    projectId: project.id,
    projectName: project.name,
    priority,
    title,
    count,
    actionUrl,
  };
}

function pushFinding(findings: FollowupFinding[], finding: FollowupFinding | null) {
  if (finding) findings.push(finding);
}

function buildProjectFindings(project: Project, currentMonthUpdates: PerformanceUpdate[], today: Date): FollowupFinding[] {
  const findings: FollowupFinding[] = [];
  const todayStr = toDateOnly(today);
  const twoWeeksLater = toDateOnly(addDays(today, 14));
  const staleCutoff = daysAgo(today, 7);
  const progress = project.progress ?? 0;
  const missingFields = [project.path, project.current_stage, project.end_date].filter((value) => !value).length;

  pushFinding(
    findings,
    createFinding("projects", project, "medium", "المشروع يحتاج تحديث بياناته", project.updated_at < staleCutoff ? 1 : 0)
  );
  pushFinding(
    findings,
    createFinding(
      "projects",
      project,
      "high",
      "المشروع قريب من الانتهاء والتقدم أقل من 80%",
      project.end_date && project.end_date >= todayStr && project.end_date <= twoWeeksLater && progress < 80 ? 1 : 0
    )
  );
  pushFinding(
    findings,
    createFinding(
      "projects",
      project,
      "critical",
      "المشروع تجاوز تاريخ الانتهاء ولم يكتمل",
      project.end_date && project.end_date < todayStr && progress < 100 ? 1 : 0
    )
  );
  pushFinding(findings, createFinding("projects", project, "low", "المشروع ناقص بيانات أساسية", missingFields));
  pushFinding(
    findings,
    createFinding("kpis", project, "medium", "لا يوجد تحديث أداء شهري للمشروع", currentMonthUpdates.length === 0 ? 1 : 0, "/kpis")
  );

  return findings;
}

function buildTaskFindings(project: Project, tasks: Task[], today: Date): FollowupFinding[] {
  const findings: FollowupFinding[] = [];
  const todayStr = toDateOnly(today);
  const threeDaysLater = toDateOnly(addDays(today, 3));
  const staleCutoff = daysAgo(today, 5);
  const activeTasks = tasks.filter((task) => !doneTaskStatuses.has(task.status));

  const overdue = activeTasks.filter((task) => task.due_date && task.due_date < todayStr);
  const importantOverdue = overdue.filter((task) => importantTaskPriorities.has(task.priority));
  const dueSoon = activeTasks.filter((task) => task.due_date && task.due_date >= todayStr && task.due_date <= threeDaysLater);
  const staleInProgress = activeTasks.filter((task) => task.status === "In Progress" && task.updated_at < staleCutoff);
  const withoutOwner = activeTasks.filter((task) => !task.owner_id);
  const withoutDueDate = activeTasks.filter((task) => !task.due_date);

  pushFinding(findings, createFinding("tasks", project, importantOverdue.length > 0 ? "critical" : "high", "مهام متأخرة", overdue.length));
  pushFinding(findings, createFinding("tasks", project, "medium", "مهام تستحق خلال 3 أيام", dueSoon.length));
  pushFinding(findings, createFinding("tasks", project, "medium", "مهام قيد العمل دون تحديث", staleInProgress.length));
  pushFinding(findings, createFinding("tasks", project, "medium", "مهام بلا مسؤول", withoutOwner.length));
  pushFinding(findings, createFinding("tasks", project, "low", "مهام بلا تاريخ استحقاق", withoutDueDate.length));

  return findings;
}

function buildChallengeFindings(project: Project, challenges: Challenge[], today: Date): FollowupFinding[] {
  const findings: FollowupFinding[] = [];
  const staleCutoff = daysAgo(today, 3);
  const activeChallenges = challenges.filter((challenge) => activeChallengeStatuses.has(challenge.status));
  const stale = activeChallenges.filter((challenge) => challenge.updated_at < staleCutoff);
  const withoutOwner = activeChallenges.filter((challenge) => !challenge.owner_id);
  const highImpact = activeChallenges.filter((challenge) => highImpactValues.has((challenge.risk_impact ?? "").trim().toLowerCase()));

  pushFinding(findings, createFinding("challenges", project, "high", "تحديات مفتوحة دون تحديث", stale.length));
  pushFinding(findings, createFinding("challenges", project, "medium", "تحديات بلا مسؤول", withoutOwner.length));
  pushFinding(findings, createFinding("challenges", project, "critical", "تحديات عالية التأثير تحتاج متابعة", highImpact.length));
  pushFinding(findings, createFinding("challenges", project, "high", "عدد كبير من التحديات المفتوحة في المشروع", activeChallenges.length >= 5 ? activeChallenges.length : 0));

  return findings;
}

function buildFormFindings(project: Project, forms: FormInstance[], today: Date): FollowupFinding[] {
  const findings: FollowupFinding[] = [];
  const draftStaleCutoff = daysAgo(today, 5);
  const notStarted = forms.filter((form) => form.status === "not_started");
  const staleDrafts = forms.filter((form) => form.status === "draft" && form.updated_at < draftStaleCutoff);
  const lowCompletion = forms.filter((form) => form.status !== "completed" && (form.completion_percentage ?? 0) > 0 && (form.completion_percentage ?? 0) < 80);

  pushFinding(findings, createFinding("forms", project, "low", "نماذج لم تبدأ بعد", notStarted.length, `/projects/${project.id}?tab=forms`));
  pushFinding(findings, createFinding("forms", project, "medium", "نماذج مسودة قديمة", staleDrafts.length, `/projects/${project.id}?tab=forms`));
  pushFinding(findings, createFinding("forms", project, "medium", "نماذج نسبة اكتمالها أقل من 80%", lowCompletion.length, `/projects/${project.id}?tab=forms`));

  return findings;
}

function buildPerformanceFindings(project: Project, updates: PerformanceUpdate[]): FollowupFinding[] {
  const findings: FollowupFinding[] = [];
  const budget = project.total_budget ?? 0;

  for (const update of updates) {
    const planned = update.planned_progress;
    const actual = update.actual_progress;
    const actualCost = update.actual_cost;

    if (planned <= 0 || actualCost <= 0 || budget <= 0) {
      const missingParts = [
        planned <= 0 ? "نسبة التخطيط" : null,
        actualCost <= 0 ? "التكلفة الفعلية" : null,
        budget <= 0 ? "الميزانية" : null,
      ].filter(Boolean);
      pushFinding(
        findings,
        createFinding("kpis", project, "low", `أداء المشروع يحتاج تحقق: ${missingParts.join("، ")}`, 1, "/kpis")
      );
      continue;
    }

    const ev = budget * (actual / 100);
    const cpi = ev / actualCost;
    const spi = actual / planned;

    pushFinding(findings, createFinding("kpis", project, "high", "CPI أقل من 0.85", cpi < 0.85 ? 1 : 0, "/kpis"));
    pushFinding(findings, createFinding("kpis", project, "high", "SPI أقل من 0.85", spi < 0.85 ? 1 : 0, "/kpis"));
  }

  return findings;
}

export function buildManagerFollowups(input: BuildInput): ManagerFollowup[] {
  const projectsByManager = input.projects
    .filter((project) => project.status === "active" && project.manager_id)
    .reduce((acc, project) => {
      const managerId = project.manager_id as string;
      acc.set(managerId, [...(acc.get(managerId) ?? []), project]);
      return acc;
    }, new Map<string, Project[]>());

  const tasksByProject = countByProject(input.tasks);
  const challengesByProject = countByProject(input.challenges);
  const formsByProject = countByProject(input.forms);
  const performanceByProject = countByProject(input.performanceUpdates);
  const startOfMonth = monthStart(input.today);

  return [...projectsByManager.entries()].map(([managerId, projects]) => {
    const findings = projects.flatMap((project) => {
      const currentMonthUpdates = (performanceByProject.get(project.id) ?? []).filter((update) => update.period_start >= startOfMonth);
      return [
        ...buildProjectFindings(project, currentMonthUpdates, input.today),
        ...buildTaskFindings(project, tasksByProject.get(project.id) ?? [], input.today),
        ...buildChallengeFindings(project, challengesByProject.get(project.id) ?? [], input.today),
        ...buildFormFindings(project, formsByProject.get(project.id) ?? [], input.today),
        ...buildPerformanceFindings(project, currentMonthUpdates),
      ];
    });

    return { managerId, findings };
  }).filter((followup) => followup.findings.length > 0);
}

function buildNotificationBody(findings: FollowupFinding[]): string {
  return findings
    .slice()
    .sort((a, b) => priorityScore(b.priority) - priorityScore(a.priority))
    .slice(0, 8)
    .map((finding) => `${finding.projectName}: ${finding.title} (${finding.count})`)
    .join("\n");
}

function buildMetadata(findings: FollowupFinding[]): Json {
  const byCategory = findings.reduce<Record<FollowupCategory, number>>(
    (acc, finding) => ({ ...acc, [finding.category]: acc[finding.category] + finding.count }),
    { tasks: 0, projects: 0, challenges: 0, forms: 0, kpis: 0 }
  );

  return {
    findings_count: findings.length,
    by_category: byCategory,
    projects: [...new Set(findings.map((finding) => finding.projectId))].length,
  };
}

export async function runManagerFollowups(
  supabase: SupabaseClient<Database>,
  today = new Date()
): Promise<ManagerFollowupResult> {
  const [{ data: projects }, { data: tasks }, { data: challenges }, { data: forms }, { data: performanceUpdates }, { data: preferences }] = await Promise.all([
    supabase.from("projects").select("id, name, manager_id, path, current_stage, status, end_date, total_budget, progress, updated_at").eq("status", "active"),
    supabase.from("tasks").select("id, project_id, title, owner_id, status, priority, due_date, updated_at").not("status", "in", '("Done","Cancelled")'),
    supabase.from("challenges").select("id, project_id, title, status, owner_id, risk_impact, updated_at").in("status", ["open", "in_progress"]),
    supabase.from("project_form_instances").select("id, project_id, assigned_owner_id, status, completion_percentage, updated_at").neq("status", "completed"),
    supabase.from("project_performance_updates").select("id, project_id, period_start, planned_progress, actual_progress, actual_cost").gte("period_start", monthStart(today)),
    supabase.from("notification_preferences").select("user_id, in_app_enabled"),
  ]);

  const followups = buildManagerFollowups({
    projects: projects ?? [],
    tasks: tasks ?? [],
    challenges: challenges ?? [],
    forms: forms ?? [],
    performanceUpdates: performanceUpdates ?? [],
    today,
  });

  const todayKey = toDateOnly(today);
  const preferenceMap = new Map((preferences ?? []).map((preference) => [preference.user_id, preference]));
  let notificationsCreated = 0;

  for (const followup of followups) {
    const managerPreferences = preferenceMap.get(followup.managerId);
    if ((managerPreferences?.in_app_enabled ?? defaultNotificationPreferences.in_app_enabled) === false) {
      continue;
    }

    const priority = maxPriority(followup.findings);
    await upsertNotification({
      user_id: followup.managerId,
      type: "manager_followup",
      category: "digest",
      priority,
      title: `لديك ${followup.findings.length} عنصر متابعة يحتاج انتباهك`,
      body: buildNotificationBody(followup.findings),
      action_url: "/notifications?important=true",
      metadata: buildMetadata(followup.findings),
      dedupe_key: buildNotificationDedupeKey("manager-followups", followup.managerId, todayKey),
      sent_via: "in_app",
    });
    notificationsCreated++;
  }

  return {
    managersChecked: followups.length,
    notificationsCreated,
    findingsCreated: followups.reduce((sum, followup) => sum + followup.findings.length, 0),
  };
}
