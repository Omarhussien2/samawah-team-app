"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  CheckSquare,
  Clock,
  FolderKanban,
  Gauge,
  Layers3,
  ListFilter,
  MousePointerClick,
  ShieldAlert,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  cn,
  formatDateShort,
  getAlertLevelColor,
  getPriorityColor,
  getPriorityLabel,
  getProjectStatusLabel,
  getStatusColor,
  getStatusLabel,
} from "@/lib/utils";
import { recalcProjectProgress } from "@/lib/utils/recalc-progress";
import { getProjectBudgetSummary, normalizeMoney } from "@/lib/projects/budget";
import { TaskTitleStack } from "@/components/tasks/task-title-stack";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Challenge, Profile, Project, Task } from "@/lib/supabase/types";

type DashboardViewMode = "portfolio" | "managed_projects" | "my_work";
type ProjectUserRole = "manager" | "member";
type ProjectHealth = "good" | "watch" | "risk";
type FocusType = "today" | "overdue" | "critical" | "budget" | "tasks" | "projects" | null;
type TaskStatusFilter = Task["status"] | "all";
type TaskPriorityFilter = Task["priority"] | "all";
type PeriodFilter = "all" | "today" | "week" | "month" | "overdue";
type ProjectStatusFilter = Project["status"] | "all";
type AnalyticsTab = "progress" | "tasks" | "team" | "budget" | "risks";

type DashboardProject = Project & {
  manager?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
};

type DashboardTask = Task & {
  owner?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
  project?: Pick<Project, "id" | "name"> | null;
};

type DashboardChallenge = Challenge & {
  owner?: Pick<Profile, "id" | "full_name"> | null;
  project?: Pick<Project, "id" | "name"> | null;
};

interface DashboardComment {
  id: string;
  body: string;
  created_at: string;
  task_id: string;
  user?: Pick<Profile, "full_name"> | null;
  task?: Pick<Task, "id" | "title" | "project_id"> | null;
}

interface DashboardProjectMember {
  project_id: string;
  user_id: string;
  role_in_project: string;
}

interface Props {
  user: Profile;
  projects: DashboardProject[];
  tasks: DashboardTask[];
  projectMembers: DashboardProjectMember[];
  challenges: DashboardChallenge[];
  comments: DashboardComment[];
  mode?: "home" | "analytics";
}

interface ProjectInfo {
  project: DashboardProject;
  role: ProjectUserRole | null;
  tasks: DashboardTask[];
  challenges: DashboardChallenge[];
  overdueTasks: number;
  myTasks: number;
  spent: number;
  budgetUsedPct: number | null;
  health: ProjectHealth;
  healthReason: string;
}

interface ProjectHealthChartEntry {
  id: string;
  name: string;
  الإنجاز: number;
  المتأخرة: number;
  health: ProjectHealth;
}

interface TaskStatusChartEntry {
  name: string;
  rawStatus: Task["status"];
  value: number;
  color: string;
  percent?: number;
}

interface BudgetChartEntry {
  id: string;
  name: string;
  الميزانية: number;
  التكلفة: number;
  الاستهلاك: number;
}

interface WorkloadChartEntry {
  id: string;
  name: string;
  مفتوحة: number;
  منجزة: number;
  متأخرة: number;
  مخطط: number;
  فعلي: number;
}

const TASK_STATUSES: Task["status"][] = ["Backlog", "To Do", "In Progress", "Review", "Done", "Cancelled"];
const PROJECT_STATUSES: Project["status"][] = ["active", "paused", "completed", "cancelled"];
const OPEN_TASK_STATUSES: Task["status"][] = ["Backlog", "To Do", "In Progress", "Review"];
const TASK_PRIORITIES: Task["priority"][] = ["critical", "high", "medium", "low"];
const OPEN_CHALLENGE_STATUSES = ["open", "in_progress"];
const DASHBOARD_VIEW_STORAGE_KEY = "samawah_dashboard_view";

const TASK_STATUS_COLORS: Record<Task["status"], string> = {
  Backlog: "#a78bfa",
  "To Do": "#94a3b8",
  "In Progress": "#60a5fa",
  Review: "#f59e0b",
  Done: "#22c55e",
  Cancelled: "#cbd5e1",
};

const TASK_PRIORITY_COLORS: Record<Task["priority"], string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#60a5fa",
  low: "#94a3b8",
};

const HEALTH_LABELS: Record<ProjectHealth, string> = {
  good: "مستقر",
  watch: "يحتاج متابعة",
  risk: "خطر",
};

const HEALTH_COLORS: Record<ProjectHealth, string> = {
  good: "bg-emerald-50 text-emerald-700 border-emerald-100",
  watch: "bg-amber-50 text-amber-700 border-amber-100",
  risk: "bg-red-50 text-red-700 border-red-100",
};

const CHART_TOOLTIP_STYLE = {
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 10px 24px rgb(15 23 42 / 0.08)",
  direction: "rtl" as const,
};

function getDateKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function getTodayKey() {
  return getDateKey(new Date());
}

function isOpenTask(task: DashboardTask) {
  return OPEN_TASK_STATUSES.includes(task.status);
}

function isTaskOverdue(task: DashboardTask, todayKey: string) {
  return Boolean(task.due_date && task.due_date < todayKey && isOpenTask(task));
}

function isTaskDueToday(task: DashboardTask, todayKey: string) {
  return task.due_date === todayKey && isOpenTask(task);
}

function isTaskInPeriod(task: DashboardTask, period: PeriodFilter, todayKey: string) {
  if (period === "all") return true;
  if (period === "today") return isTaskDueToday(task, todayKey);
  if (period === "overdue") return isTaskOverdue(task, todayKey);
  if (!task.due_date) return false;

  const dueDate = new Date(task.due_date);
  const today = new Date(todayKey);
  const days = Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000);

  if (period === "week") return days >= 0 && days <= 7;
  if (period === "month") return days >= 0 && days <= 30;
  return true;
}

function getDaysUntil(date: string | null) {
  if (!date) return null;
  const today = new Date(getTodayKey());
  const target = new Date(date);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString("ar")} ر.س`;
}

function shortName(name: string, max = 18) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function getProjectHealth(info: {
  project: DashboardProject;
  overdueTasks: number;
  criticalChallenges: number;
  budgetUsedPct: number | null;
}): { health: ProjectHealth; reason: string } {
  const progress = Math.round(info.project.progress ?? 0);
  const daysUntilEnd = getDaysUntil(info.project.end_date);
  const isPastEnd = daysUntilEnd !== null && daysUntilEnd < 0 && progress < 100;
  const isDueSoonBehind = daysUntilEnd !== null && daysUntilEnd <= 14 && daysUntilEnd >= 0 && progress < 80;
  const isBudgetRisk = info.budgetUsedPct !== null && info.budgetUsedPct > 100;
  const isBudgetWatch = info.budgetUsedPct !== null && info.budgetUsedPct >= 80;

  if (info.criticalChallenges > 0) return { health: "risk", reason: "مخاطر حرجة مفتوحة" };
  if (isPastEnd) return { health: "risk", reason: "تجاوز تاريخ الانتهاء" };
  if (isBudgetRisk) return { health: "risk", reason: "تجاوز في الميزانية" };
  if (info.overdueTasks >= 3) return { health: "risk", reason: "تراكم مهام متأخرة" };
  if (info.overdueTasks > 0) return { health: "watch", reason: "توجد مهام متأخرة" };
  if (isDueSoonBehind) return { health: "watch", reason: "قريب من الانتهاء والإنجاز منخفض" };
  if (isBudgetWatch) return { health: "watch", reason: "استهلاك ميزانية مرتفع" };
  return { health: "good", reason: "المؤشرات مستقرة" };
}

export function DashboardClient({ user, projects, tasks, projectMembers, challenges, comments, mode = "home" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [localTasks, setLocalTasks] = useState<DashboardTask[]>(tasks);
  const isAnalyticsPage = mode === "analytics";

  const todayKey = getTodayKey();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "صباح الخير" : hour < 18 ? "مساء الخير" : "طاب مساؤك";
  const firstName = user.full_name?.split(" ")[0] || "هلا";

  const defaultView: DashboardViewMode =
    user.role === "admin" ? "portfolio" : user.role === "project_manager" ? "managed_projects" : "my_work";
  const allowedViews = useMemo<DashboardViewMode[]>(() => {
    if (user.role === "admin") return ["portfolio", "managed_projects", "my_work"];
    if (user.role === "project_manager") return ["managed_projects", "my_work"];
    return ["my_work"];
  }, [user.role]);

  const viewParam = searchParams.get("view") as DashboardViewMode | null;
  const selectedView = viewParam && allowedViews.includes(viewParam) ? viewParam : defaultView;
  const focusParam = searchParams.get("focus") as FocusType;
  const focus: FocusType = ["today", "overdue", "critical", "budget", "tasks", "projects"].includes(focusParam ?? "")
    ? focusParam
    : null;
  const statusParam = searchParams.get("status") as Task["status"] | null;
  const statusFilter: TaskStatusFilter = statusParam && TASK_STATUSES.includes(statusParam) ? statusParam : "all";
  const priorityParam = searchParams.get("priority") as Task["priority"] | null;
  const priorityFilter: TaskPriorityFilter =
    priorityParam && TASK_PRIORITIES.includes(priorityParam) ? priorityParam : "all";
  const projectStatusParam = searchParams.get("projectStatus") as Project["status"] | null;
  const projectStatusFilter: ProjectStatusFilter =
    projectStatusParam && PROJECT_STATUSES.includes(projectStatusParam) ? projectStatusParam : "all";
  const periodParam = searchParams.get("period") as PeriodFilter | null;
  const periodFilter: PeriodFilter =
    periodParam && ["all", "today", "week", "month", "overdue"].includes(periodParam) ? periodParam : "all";
  const analyticsParam = searchParams.get("analytics") as AnalyticsTab | null;
  const analyticsTab: AnalyticsTab =
    analyticsParam && ["progress", "tasks", "team", "budget", "risks"].includes(analyticsParam)
      ? analyticsParam
      : focus === "budget"
        ? "budget"
        : focus === "critical"
          ? "risks"
          : focus === "tasks" || focus === "today" || focus === "overdue"
            ? "tasks"
            : "progress";
  const showAnalytics = isAnalyticsPage;
  const ownerFilter = searchParams.get("owner") ?? "all";
  const projectParam = searchParams.get("project");
  const projectFilter = projectParam && projects.some((project) => project.id === projectParam) ? projectParam : "all";

  const setQuery = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    });
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const buildAnalyticsHref = useCallback((updates: Record<string, string | null> = {}) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    });
    const query = params.toString();
    return `/dashboard/analytics${query ? `?${query}` : ""}`;
  }, [searchParams]);

  const applyAnalyticsFilter = useCallback((updates: Record<string, string | null>) => {
    if (isAnalyticsPage) {
      setQuery(updates);
      return;
    }
    router.push(buildAnalyticsHref(updates));
  }, [buildAnalyticsHref, isAnalyticsPage, router, setQuery]);

  useEffect(() => {
    if (!viewParam) {
      const storedView = window.localStorage.getItem(DASHBOARD_VIEW_STORAGE_KEY) as DashboardViewMode | null;
      if (storedView && allowedViews.includes(storedView) && storedView !== defaultView) {
        setQuery({ view: storedView });
      }
    }
  }, [allowedViews, defaultView, setQuery, viewParam]);

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_VIEW_STORAGE_KEY, selectedView);
  }, [selectedView]);

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const rolesByProject = useMemo(() => {
    const roles = new Map<string, ProjectUserRole>();

    projects.forEach((project) => {
      if (project.manager_id === user.id) roles.set(project.id, "manager");
    });

    projectMembers.forEach((member) => {
      if (member.user_id === user.id && roles.get(member.project_id) !== "manager") {
        roles.set(member.project_id, "member");
      }
    });

    localTasks.forEach((task) => {
      if (task.owner_id === user.id && roles.get(task.project_id) !== "manager") {
        roles.set(task.project_id, "member");
      }
    });

    return roles;
  }, [localTasks, projectMembers, projects, user.id]);

  const personalProjectIds = useMemo(() => new Set(rolesByProject.keys()), [rolesByProject]);

  const scopedProjects = useMemo(() => {
    if (selectedView === "portfolio" && user.role === "admin") return projects;
    return projects.filter((project) => personalProjectIds.has(project.id));
  }, [personalProjectIds, projects, selectedView, user.role]);

  const scopedProjectIds = useMemo(() => new Set(scopedProjects.map((project) => project.id)), [scopedProjects]);

  const baseScopedTasks = useMemo(() => {
    return selectedView === "my_work"
      ? localTasks.filter((task) => task.owner_id === user.id)
      : localTasks.filter((task) => scopedProjectIds.has(task.project_id));
  }, [localTasks, scopedProjectIds, selectedView, user.id]);

  const ownerOptions = useMemo(() => {
    const owners = new Map<string, string>();
    baseScopedTasks.forEach((task) => {
      const ownerId = task.owner_id ?? "unassigned";
      owners.set(ownerId, task.owner?.full_name ?? task.owner_name ?? "غير مسند");
    });
    return Array.from(owners, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [baseScopedTasks]);

  const selectedOwner = ownerOptions.some((owner) => owner.id === ownerFilter) ? ownerFilter : "all";

  const scopedTasks = useMemo(() => {
    return baseScopedTasks.filter((task) => {
      if (projectFilter !== "all" && task.project_id !== projectFilter) return false;
      if (projectStatusFilter !== "all" && projectMap.get(task.project_id)?.status !== projectStatusFilter) return false;
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (selectedOwner !== "all" && (task.owner_id ?? "unassigned") !== selectedOwner) return false;
      if (!isTaskInPeriod(task, periodFilter, todayKey)) return false;
      return true;
    });
  }, [baseScopedTasks, periodFilter, priorityFilter, projectFilter, projectMap, projectStatusFilter, selectedOwner, statusFilter, todayKey]);

  const scopedChallenges = useMemo(() => {
    return challenges.filter((challenge) => {
      if (!scopedProjectIds.has(challenge.project_id)) return false;
      if (projectFilter !== "all" && challenge.project_id !== projectFilter) return false;
      if (projectStatusFilter !== "all" && projectMap.get(challenge.project_id)?.status !== projectStatusFilter) return false;
      return true;
    });
  }, [challenges, projectFilter, projectMap, projectStatusFilter, scopedProjectIds]);

  const projectInfos = useMemo<ProjectInfo[]>(() => {
    return scopedProjects
      .filter((project) => projectFilter === "all" || project.id === projectFilter)
      .filter((project) => projectStatusFilter === "all" || project.status === projectStatusFilter)
      .map((project) => {
        const projectTasks = localTasks.filter((task) => task.project_id === project.id);
        const projectChallenges = challenges.filter((challenge) => challenge.project_id === project.id);
        const overdueTasks = projectTasks.filter((task) => isTaskOverdue(task, todayKey)).length;
        const criticalChallenges = projectChallenges.filter(
          (challenge) => OPEN_CHALLENGE_STATUSES.includes(challenge.status) && challenge.risk_level === "critical"
        ).length;
        const budgetSummary = getProjectBudgetSummary(project, projectTasks);
        const spent = budgetSummary.spent;
        const budgetUsedPct = budgetSummary.usagePct;
        const health = getProjectHealth({ project, overdueTasks, criticalChallenges, budgetUsedPct });

        return {
          project,
          role: rolesByProject.get(project.id) ?? null,
          tasks: projectTasks,
          challenges: projectChallenges,
          overdueTasks,
          myTasks: projectTasks.filter((task) => task.owner_id === user.id && isOpenTask(task)).length,
          spent,
          budgetUsedPct,
          health: health.health,
          healthReason: health.reason,
        };
      });
  }, [challenges, localTasks, projectFilter, projectStatusFilter, rolesByProject, scopedProjects, todayKey, user.id]);

  const todayTasks = useMemo(
    () => scopedTasks.filter((task) => isTaskDueToday(task, todayKey)),
    [scopedTasks, todayKey]
  );
  const overdueTasks = useMemo(
    () => scopedTasks.filter((task) => isTaskOverdue(task, todayKey)),
    [scopedTasks, todayKey]
  );
  const criticalChallenges = scopedChallenges.filter(
    (challenge) => OPEN_CHALLENGE_STATUSES.includes(challenge.status) && challenge.risk_level === "critical"
  );
  const activeProjects = projectInfos.filter((info) => info.project.status === "active");
  const managedCount = projects.filter((project) => project.manager_id === user.id).length;
  const memberCount = Array.from(personalProjectIds).filter((id) => rolesByProject.get(id) === "member").length;
  const averageProgress =
    projectInfos.length > 0
      ? Math.round(projectInfos.reduce((sum, info) => sum + Number(info.project.progress ?? 0), 0) / projectInfos.length)
      : 0;
  const totalBudget = projectInfos.reduce((sum, info) => sum + normalizeMoney(info.project.total_budget), 0);
  const totalSpent = projectInfos.reduce((sum, info) => sum + info.spent, 0);
  const budgetUsage = getProjectBudgetSummary({ total_budget: totalBudget }, [{ cost: totalSpent }]).usagePct ?? 0;

  const statusCounts = useMemo(() => {
    return TASK_STATUSES.map((status) => ({
      name: getStatusLabel(status),
      rawStatus: status,
      value: scopedTasks.filter((task) => task.status === status).length,
      color: TASK_STATUS_COLORS[status],
    })).filter((item) => item.value > 0);
  }, [scopedTasks]);

  const priorityCounts = useMemo(() => {
    return TASK_PRIORITIES.map((priority) => ({
      name: getPriorityLabel(priority),
      rawPriority: priority,
      value: scopedTasks.filter((task) => task.priority === priority).length,
      color: TASK_PRIORITY_COLORS[priority],
    })).filter((item) => item.value > 0);
  }, [scopedTasks]);

  const projectStatusData = useMemo(() => {
    return PROJECT_STATUSES.map((status) => ({
      name: getProjectStatusLabel(status),
      rawStatus: status,
      value: scopedProjects.filter((project) => project.status === status).length,
    }));
  }, [scopedProjects]);

  const weeklyData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - (6 - index));
      const dateKey = getDateKey(day);
      return {
        name: format(day, "EEEE", { locale: ar }),
        جديدة: scopedTasks.filter((task) => task.created_at?.startsWith(dateKey)).length,
        مكتملة: scopedTasks.filter((task) => task.status === "Done" && task.updated_at?.startsWith(dateKey)).length,
      };
    });
  }, [scopedTasks]);

  const workloadData = useMemo(() => {
    const owners = new Map<string, WorkloadChartEntry>();
    scopedTasks.forEach((task) => {
      const ownerId = task.owner_id ?? "unassigned";
      const owner = owners.get(ownerId) ?? {
        id: ownerId,
        name: task.owner?.full_name ?? task.owner_name ?? "غير مسند",
        مفتوحة: 0,
        منجزة: 0,
        متأخرة: 0,
        مخطط: 0,
        فعلي: 0,
      };
      if (task.status === "Done") owner.منجزة += 1;
      else owner.مفتوحة += 1;
      if (isTaskOverdue(task, todayKey)) owner.متأخرة += 1;
      owner.مخطط += Number(task.planned_hours ?? 0);
      owner.فعلي += Number(task.actual_hours ?? 0);
      owners.set(ownerId, owner);
    });

    return Array.from(owners.values())
      .sort((a, b) => b.متأخرة + b.مفتوحة - (a.متأخرة + a.مفتوحة))
      .slice(0, 8)
      .map((owner) => ({ ...owner, name: shortName(owner.name, 14) }));
  }, [scopedTasks, todayKey]);

  const projectHealthData = useMemo(() => {
    return projectInfos
      .slice()
      .sort((a, b) => {
        const weight: Record<ProjectHealth, number> = { risk: 3, watch: 2, good: 1 };
        return weight[b.health] - weight[a.health] || b.overdueTasks - a.overdueTasks;
      })
      .slice(0, 8)
      .map((info) => ({
        id: info.project.id,
        name: shortName(info.project.name, 16),
        الإنجاز: Math.round(info.project.progress ?? 0),
        المتأخرة: info.overdueTasks,
        health: info.health,
      }));
  }, [projectInfos]);

  const budgetData = useMemo(() => {
    return projectInfos
      .filter((info) => normalizeMoney(info.project.total_budget) > 0 || info.spent > 0)
      .sort((a, b) => normalizeMoney(b.project.total_budget) - normalizeMoney(a.project.total_budget))
      .slice(0, 8)
      .map((info) => ({
        id: info.project.id,
        name: shortName(info.project.name, 14),
        الميزانية: normalizeMoney(info.project.total_budget),
        التكلفة: info.spent,
        الاستهلاك: info.budgetUsedPct ?? 0,
      }));
  }, [projectInfos]);

  const priorityItems = useMemo(() => {
    const challengeItems = criticalChallenges.slice(0, 4).map((challenge) => ({
      id: `challenge-${challenge.id}`,
      type: "critical" as const,
      title: challenge.title,
      meta: `${projectMap.get(challenge.project_id)?.name ?? "مشروع"} · خطر حرج`,
      filters: { project: challenge.project_id, focus: "critical" },
      severity: 4,
    }));

    const taskItems = overdueTasks.slice(0, 5).map((task) => ({
      id: `task-${task.id}`,
      type: "overdue" as const,
      title: task.title,
      meta: `${projectMap.get(task.project_id)?.name ?? "مشروع"} · مستحقة ${formatDateShort(task.due_date)}`,
      filters: { project: task.project_id, focus: "overdue", period: "overdue" },
      severity: task.priority === "critical" ? 4 : task.priority === "high" ? 3 : 2,
    }));

    const budgetItems = projectInfos
      .filter((info) => info.budgetUsedPct !== null && info.budgetUsedPct >= 80)
      .slice(0, 3)
      .map((info) => ({
        id: `budget-${info.project.id}`,
        type: "budget" as const,
        title: info.project.name,
        meta: `استهلاك الميزانية ${info.budgetUsedPct}%`,
        filters: { project: info.project.id, focus: "budget" },
        severity: info.budgetUsedPct && info.budgetUsedPct > 100 ? 4 : 3,
      }));

    return [...challengeItems, ...taskItems, ...budgetItems].sort((a, b) => b.severity - a.severity).slice(0, 6);
  }, [criticalChallenges, overdueTasks, projectInfos, projectMap]);

  const filteredComments = useMemo(() => {
    const scopedTaskIds = new Set(scopedTasks.map((task) => task.id));
    const scopedIds = scopedProjectIds;
    return comments.filter((comment) => {
      if (scopedTaskIds.has(comment.task_id)) return true;
      if (comment.task?.project_id && scopedIds.has(comment.task.project_id)) return true;
      return false;
    });
  }, [comments, scopedProjectIds, scopedTasks]);

  const focusTasks =
    focus === "today" ? todayTasks : focus === "overdue" ? overdueTasks : focus === "tasks" ? scopedTasks : [];
  const focusProjects = focus === "budget" || focus === "projects" ? projectInfos : [];
  const highlightedProjects = useMemo(() => {
    const weight: Record<ProjectHealth, number> = { risk: 3, watch: 2, good: 1 };
    return projectInfos
      .slice()
      .sort((a, b) => {
        return (
          weight[b.health] - weight[a.health] ||
          b.overdueTasks - a.overdueTasks ||
          Number(b.project.progress ?? 0) - Number(a.project.progress ?? 0)
        );
      });
  }, [projectInfos]);
  const urgentTasks = useMemo(() => {
    const seen = new Set<string>();
    return todayTasks
      .concat(overdueTasks)
      .filter((task) => {
        if (seen.has(task.id)) return false;
        seen.add(task.id);
        return true;
      })
      .slice(0, 6);
  }, [overdueTasks, todayTasks]);
  const analyticsProjectResults = focusProjects.length > 0 ? focusProjects : highlightedProjects;
  const analyticsTaskResults = focusTasks.length > 0 ? focusTasks : scopedTasks;
  const focusResultCount =
    focus === "critical"
      ? criticalChallenges.length
      : focus === "budget" || focus === "projects"
        ? focusProjects.length
        : focus
          ? focusTasks.length
          : 0;

  const statCards = [
    {
      label: "المشاريع النشطة",
      value: activeProjects.length,
      hint: `${projectInfos.length} مشروع ضمن العرض`,
      icon: FolderKanban,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      accent: "bg-indigo-500",
      action: () => applyAnalyticsFilter({ projectStatus: "active", focus: "projects", analytics: "progress" }),
    },
    {
      label: "مهام اليوم",
      value: todayTasks.length,
      hint: "مفتوحة ومستحقة اليوم",
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      accent: "bg-amber-500",
      action: () => applyAnalyticsFilter({ focus: "today", period: "today", status: null, analytics: "tasks" }),
    },
    {
      label: "مهام متأخرة",
      value: overdueTasks.length,
      hint: "تحتاج متابعة",
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
      accent: "bg-red-500",
      action: () => applyAnalyticsFilter({ focus: "overdue", period: "overdue", status: null, analytics: "tasks" }),
    },
    {
      label: "مخاطر حرجة",
      value: criticalChallenges.length,
      hint: "مفتوحة الآن",
      icon: ShieldAlert,
      color: "text-rose-600",
      bg: "bg-rose-50",
      accent: "bg-rose-500",
      action: () => applyAnalyticsFilter({ focus: "critical", analytics: "risks" }),
    },
  ];

  const viewOptions: Record<DashboardViewMode, { label: string; description: string; icon: typeof BarChart3 }> = {
    portfolio: { label: "محفظة المشاريع", description: "نظرة الإدارة الشاملة", icon: BarChart3 },
    managed_projects: { label: "مشاريعي", description: "ما أديره أو أشارك فيه", icon: FolderKanban },
    my_work: { label: "مهامي", description: "العمل المسند لي", icon: CheckSquare },
  };
  const selectedViewOption = viewOptions[selectedView];
  const SelectedViewIcon = selectedViewOption.icon;
  const roleLabel =
    user.role === "admin" ? "مدير منصة" : user.role === "project_manager" ? "مدير مشاريع" : "عضو فريق";
  const homeHref = selectedView === defaultView ? "/dashboard" : `/dashboard?view=${selectedView}`;
  const riskProjectsCount = projectInfos.filter((info) => info.health === "risk").length;
  const watchProjectsCount = projectInfos.filter((info) => info.health === "watch").length;
  const focusLabels: Record<Exclude<FocusType, null>, string> = {
    today: "مهام اليوم",
    overdue: "المهام المتأخرة",
    critical: "المخاطر الحرجة",
    budget: "مشاريع الميزانية",
    tasks: "المهام المفلترة",
    projects: "المشاريع المفلترة",
  };
  const filterChips = [
    projectFilter !== "all" && {
      key: "project",
      label: projectMap.get(projectFilter)?.name ?? "مشروع محدد",
      onRemove: () => setQuery({ project: null }),
    },
    statusFilter !== "all" && {
      key: "status",
      label: getStatusLabel(statusFilter),
      onRemove: () => setQuery({ status: null }),
    },
    priorityFilter !== "all" && {
      key: "priority",
      label: getPriorityLabel(priorityFilter),
      onRemove: () => setQuery({ priority: null }),
    },
    projectStatusFilter !== "all" && {
      key: "projectStatus",
      label: getProjectStatusLabel(projectStatusFilter),
      onRemove: () => setQuery({ projectStatus: null }),
    },
    selectedOwner !== "all" && {
      key: "owner",
      label: ownerOptions.find((owner) => owner.id === selectedOwner)?.name ?? "عضو محدد",
      onRemove: () => setQuery({ owner: null }),
    },
    periodFilter !== "all" && {
      key: "period",
      label:
        periodFilter === "today"
          ? "اليوم"
          : periodFilter === "week"
            ? "خلال أسبوع"
            : periodFilter === "month"
              ? "خلال شهر"
              : "متأخرة",
      onRemove: () => setQuery({ period: null }),
    },
  ].filter(Boolean) as Array<{ key: string; label: string; onRemove: () => void }>;

  const handleMarkDone = async (taskId: string, projectId?: string) => {
    setLocalTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status: "Done", board_column: "Done", progress: 100 } : task))
    );
    toast.success("تم إغلاق المهمة");
    const supabase = createClient();
    await supabase.from("tasks").update({ status: "Done", board_column: "Done", progress: 100 }).eq("id", taskId);
    if (projectId) recalcProjectProgress(projectId);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 fade-in-0">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 border-b border-slate-100 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600">
                {roleLabel}
              </span>
              {isAnalyticsPage && (
                <span className="rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                  <SelectedViewIcon className="ml-1 inline" size={13} />
                  {selectedViewOption.label}
                </span>
              )}
              <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
                {format(new Date(), "EEEE، d MMMM yyyy", { locale: ar })}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-black text-slate-950 font-heading">
              {isAnalyticsPage ? "التحليلات" : `${greeting}، ${firstName}`}
            </h1>
            {isAnalyticsPage && (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                قراءة مركزة للمشاريع والمهام والميزانية والفريق حسب الفلاتر الحالية.
              </p>
            )}
          </div>

          <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 lg:max-w-[430px]">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                <p className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-400">
                  <Briefcase size={12} />
                  أديرها
                </p>
                <p className="mt-1 text-lg font-black text-blue-600">{managedCount}</p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                <p className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-400">
                  <Users size={12} />
                  أشارك
                </p>
                <p className="mt-1 text-lg font-black text-sky-600">{memberCount}</p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                <p className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-400">
                  <Gauge size={12} />
                  الإنجاز
                </p>
                <p className="mt-1 text-lg font-black text-emerald-600">{averageProgress}%</p>
              </div>
            </div>
            {isAnalyticsPage && (
              <div className="mt-2 rounded-lg bg-white px-3 py-2 text-center shadow-sm">
                <p className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-400">
                  <Wallet size={12} />
                  استهلاك الميزانية
                </p>
                <p
                  className={cn(
                    "mt-1 text-lg font-black",
                    budgetUsage > 100 ? "text-red-600" : budgetUsage >= 80 ? "text-amber-600" : "text-slate-700"
                  )}
                >
                  {budgetUsage}%
                </p>
              </div>
            )}
          </div>
        </div>

        {isAnalyticsPage && (
          <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-end">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
              <Link
                href={homeHref}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 text-sm font-bold text-primary hover:bg-primary/15"
              >
                <FolderKanban size={16} />
                العودة للرئيسية
              </Link>
              <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
                {allowedViews.map((view) => {
                  const option = viewOptions[view];
                  const Icon = option.icon;
                  const active = selectedView === view;
                  return (
                    <button
                      key={view}
                      onClick={() =>
                        setQuery({
                          view,
                          focus: null,
                          status: null,
                          priority: null,
                          owner: null,
                          period: null,
                          project: null,
                          projectStatus: null,
                          insights: null,
                          analytics: null,
                        })
                      }
                      className={cn(
                        "flex min-w-[132px] items-center gap-2 rounded-lg px-3 py-2 text-right text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                        active
                          ? "bg-white text-primary shadow-sm"
                          : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                      )}
                    >
                      <Icon size={17} />
                      <span>
                        <span className="block font-bold">{option.label}</span>
                        <span className="block text-[11px] opacity-75">{option.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {!isAnalyticsPage && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((stat) => (
            <button
              key={stat.label}
              onClick={stat.action}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 text-right shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <span className={cn("absolute inset-x-0 top-0 h-1", stat.accent)} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-500">{stat.label}</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{stat.value}</p>
                </div>
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", stat.bg, stat.color)}>
                  <stat.icon size={20} />
                </span>
              </div>
              <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-500 group-hover:text-primary">
                <MousePointerClick size={12} />
                {stat.hint}
              </p>
            </button>
          ))}
        </div>
      )}

      {isAnalyticsPage && (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-9 items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-bold text-slate-700">
              <SlidersHorizontal size={15} />
              الفلاتر
            </span>
            <select
              value={projectFilter}
              onChange={(event) => setQuery({ project: event.target.value, focus: null })}
              className="h-9 min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">كل المشاريع</option>
              {scopedProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setQuery({ status: event.target.value, focus: "tasks" })}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">كل حالات المهام</option>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(event) => setQuery({ priority: event.target.value, focus: "tasks" })}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">كل الأولويات</option>
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {getPriorityLabel(priority)}
                </option>
              ))}
            </select>
            <details className="group">
              <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 hover:bg-slate-50">
                <ListFilter size={15} />
                فلاتر متقدمة
              </summary>
              <div className="mt-2 flex flex-wrap gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
                <select
                  value={projectStatusFilter}
                  onChange={(event) => setQuery({ projectStatus: event.target.value, focus: "projects" })}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">كل حالات المشاريع</option>
                  {PROJECT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {getProjectStatusLabel(status)}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedOwner}
                  onChange={(event) => setQuery({ owner: event.target.value, focus: "tasks" })}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">كل الأعضاء</option>
                  {ownerOptions.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name}
                    </option>
                  ))}
                </select>
                <select
                  value={periodFilter}
                  onChange={(event) => setQuery({ period: event.target.value, focus: "tasks" })}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">كل الفترات</option>
                  <option value="today">اليوم</option>
                  <option value="week">خلال أسبوع</option>
                  <option value="month">خلال شهر</option>
                  <option value="overdue">متأخرة</option>
                </select>
              </div>
            </details>
            </div>
          </div>

          {(filterChips.length > 0 || focus) && (
            <button
              onClick={() =>
                setQuery({
                  project: null,
                  projectStatus: null,
                  status: null,
                  priority: null,
                  owner: null,
                  period: null,
                  focus: null,
                  insights: null,
                  analytics: null,
                })
              }
              className="flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <X size={15} />
              مسح الفلاتر
            </button>
          )}
        </div>

        {(filterChips.length > 0 || focus) && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            {focus && (
              <button
                onClick={() => setQuery({ focus: null })}
                className="flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"
              >
                {focusLabels[focus]}
                <X size={12} />
              </button>
            )}
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                onClick={chip.onRemove}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-white"
              >
                {chip.label}
                <X size={12} />
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {isAnalyticsPage && focus && (
        <div className="rounded-xl border border-primary/15 bg-white shadow-sm ring-1 ring-primary/5">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-primary">نتائج التفاعل</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900 font-heading">
                {focus === "today" && "مهام اليوم"}
                {focus === "overdue" && "المهام المتأخرة"}
                {focus === "critical" && "المخاطر الحرجة"}
                {focus === "budget" && "مشاريع الميزانية"}
                {focus === "tasks" && "المهام حسب الفلتر"}
                {focus === "projects" && "المشاريع حسب الفلتر"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {focusResultCount.toLocaleString("ar")} نتيجة مرتبطة بالنطاق والفلاتر الحالية.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setQuery({ focus: null })} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
          </div>

          {(focus === "today" || focus === "overdue" || focus === "tasks") && (
            <TaskDrillDown
              tasks={focusTasks}
              projects={projectMap}
              onOpenTask={(task) => router.push(`/projects/${task.project_id}?tab=tasks`)}
              onMarkDone={handleMarkDone}
            />
          )}

          {focus === "critical" && (
            <div className="grid gap-3 p-5 md:grid-cols-2">
              {criticalChallenges.length === 0 ? (
                <EmptyState label="لا توجد مخاطر حرجة ضمن هذا العرض" />
              ) : (
                criticalChallenges.map((challenge) => (
                  <Link
                    key={challenge.id}
                    href={`/projects/${challenge.project_id}?tab=challenges`}
                    className="rounded-xl border border-red-100 bg-red-50/60 p-4 transition-colors hover:bg-red-50"
                  >
                    <p className="text-sm font-bold text-red-800">{challenge.title}</p>
                    <p className="mt-2 text-xs text-red-700">
                      {projectMap.get(challenge.project_id)?.name ?? "مشروع"} · درجة الخطر {challenge.risk_score}
                    </p>
                  </Link>
                ))
              )}
            </div>
          )}

          {(focus === "budget" || focus === "projects") && (
            <ProjectDrillDown infos={focusProjects} onSelect={(projectId) => setQuery({ project: projectId, focus: "projects" })} />
          )}
        </div>
      )}

      <div className="space-y-4">
        <section className="space-y-4">
          {!isAnalyticsPage && (
            <>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 font-heading">الأولوية الآن</h2>
                      <p className="mt-1 text-sm text-slate-500">أهم إشارات تحتاج قرار أو متابعة، مرتبة حسب الأثر.</p>
                    </div>
                    <TrendingUp className="text-primary" size={20} />
                  </div>
                  {priorityItems.length === 0 ? (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                      لا توجد إشارات حرجة حاليا. الوضع مستقر ضمن هذا العرض.
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {priorityItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => applyAnalyticsFilter({ ...item.filters, analytics: item.type === "budget" ? "budget" : item.type === "critical" ? "risks" : "tasks" })}
                          className={cn(
                            "rounded-xl border p-4 text-right transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                            item.type === "critical"
                              ? "border-red-100 bg-red-50/60 hover:bg-red-50"
                              : item.type === "budget"
                                ? "border-amber-100 bg-amber-50/60 hover:bg-amber-50"
                                : "border-slate-200 bg-slate-50 hover:bg-white"
                          )}
                        >
                          <p className="line-clamp-1 text-sm font-bold text-slate-900">{item.title}</p>
                          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-500">
                            <MousePointerClick size={12} />
                            {item.meta}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <HomeTaskPanel tasks={urgentTasks} projects={projectMap} onMarkDone={handleMarkDone} />
                  <RecentUpdatesPanel comments={filteredComments} />
                </div>
              </div>

              <ProjectCards
                infos={highlightedProjects}
                onFilterProject={(projectId) => applyAnalyticsFilter({ project: projectId, focus: "projects", analytics: "progress" })}
                onFilterTasks={(projectId) => applyAnalyticsFilter({ project: projectId, owner: user.id, focus: "tasks", analytics: "tasks" })}
                onFilterOverdue={(projectId) => applyAnalyticsFilter({ project: projectId, focus: "overdue", period: "overdue", analytics: "tasks" })}
              />
            </>
          )}

          {showAnalytics && (
            <Tabs
              value={analyticsTab}
              onValueChange={(value) => setQuery({ analytics: value })}
              dir="rtl"
              className="space-y-4"
            >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-heading">التحليلات</h2>
                <p className="mt-1 text-sm text-slate-500">قراءة مركزة حسب زاوية التحليل والفلتر الحالي.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-lg bg-slate-100 p-1 lg:w-auto">
                  <TabsTrigger value="progress" className="rounded-md px-3 py-2 text-xs font-bold">
                    التقدم
                  </TabsTrigger>
                  <TabsTrigger value="tasks" className="rounded-md px-3 py-2 text-xs font-bold">
                    المهام
                  </TabsTrigger>
                  <TabsTrigger value="team" className="rounded-md px-3 py-2 text-xs font-bold">
                    الفريق
                  </TabsTrigger>
                  <TabsTrigger value="budget" className="rounded-md px-3 py-2 text-xs font-bold">
                    الميزانية
                  </TabsTrigger>
                  <TabsTrigger value="risks" className="rounded-md px-3 py-2 text-xs font-bold">
                    المخاطر
                  </TabsTrigger>
                </TabsList>
                <Link
                  href={homeHref}
                  className="flex h-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-500 hover:bg-slate-50"
                >
                  العودة للرئيسية
                </Link>
              </div>
            </div>

            <TabsContent value="progress" className="mt-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <ChartCard title="صحة المشاريع" subtitle="الإنجاز والصحة العامة للمشاريع ضمن العرض." height={340}>
                  {projectHealthData.length === 0 ? (
                    <EmptyState label="لا توجد مشاريع لعرض صحتها" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projectHealthData} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} fontSize={11} />
                        <YAxis type="category" dataKey="name" width={86} fontSize={11} />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: number | string) => [`${value}`, ""]} />
                        <Bar
                          dataKey="الإنجاز"
                          radius={[0, 6, 6, 0]}
                          onClick={(entry: ProjectHealthChartEntry) =>
                            setQuery({ project: entry.id, focus: "projects", analytics: "progress" })
                          }
                        >
                          {projectHealthData.map((entry) => (
                            <Cell
                              key={entry.id}
                              fill={entry.health === "risk" ? "#ef4444" : entry.health === "watch" ? "#f59e0b" : "#22c55e"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4">
                    <h3 className="font-bold text-slate-900 font-heading">نتائج المشاريع</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">الأولوية للمشاريع ذات الخطر أو التأخر.</p>
                  </div>
                  <ProjectResultList
                    infos={analyticsProjectResults}
                    onSelect={(projectId) => setQuery({ project: projectId, focus: "projects", analytics: "progress" })}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {projectStatusData.map((entry) => (
                  <button
                    key={entry.rawStatus}
                    type="button"
                    onClick={() => setQuery({ projectStatus: entry.rawStatus, focus: "projects", analytics: "progress" })}
                    className="rounded-xl border border-slate-200 bg-white p-4 text-right shadow-sm transition-colors hover:border-primary/20 hover:bg-indigo-50/30"
                  >
                    <p className="text-xs font-bold text-slate-500">{entry.name}</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{entry.value}</p>
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <ChartCard title="توزيع المهام" subtitle="حجم العمل حسب حالة المهمة." height={340}>
                  {statusCounts.length === 0 ? (
                    <EmptyState label="لا توجد مهام ضمن هذا العرض" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statusCounts} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" allowDecimals={false} fontSize={11} />
                        <YAxis type="category" dataKey="name" width={90} fontSize={11} />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: number | string) => [`${value} مهمة`, ""]} />
                        <Bar
                          dataKey="value"
                          radius={[0, 6, 6, 0]}
                          onClick={(entry: TaskStatusChartEntry) =>
                            setQuery({ status: entry.rawStatus, focus: "tasks", analytics: "tasks" })
                          }
                        >
                          {statusCounts.map((entry) => (
                            <Cell key={entry.rawStatus} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-4">
                      <h3 className="font-bold text-slate-900 font-heading">الأولوية</h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">أعلى الأولويات ضمن الفلتر الحالي.</p>
                    </div>
                    <div className="grid gap-2">
                      {priorityCounts.length === 0 ? (
                        <EmptyState label="لا توجد أولويات مسجلة" />
                      ) : (
                        priorityCounts.map((entry) => (
                          <button
                            key={entry.rawPriority}
                            type="button"
                            onClick={() => setQuery({ priority: entry.rawPriority, focus: "tasks", analytics: "tasks" })}
                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right transition-colors hover:bg-white"
                          >
                            <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                              {entry.name}
                            </span>
                            <span className="text-sm font-black text-slate-900">{entry.value}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-4">
                      <h3 className="font-bold text-slate-900 font-heading">نتائج المهام</h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">أقرب عناصر مطابقة للفلتر الحالي.</p>
                    </div>
                    <TaskResultList
                      tasks={analyticsTaskResults}
                      projects={projectMap}
                      onOpenTask={(task) => router.push(`/projects/${task.project_id}?tab=tasks`)}
                      onMarkDone={handleMarkDone}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <ChartCard title="أداء الأسبوع" subtitle="اتجاه سريع: مهام جديدة مقابل مكتملة" height={260}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyData} margin={{ top: 8, right: 10, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      <Legend />
                      <Line type="monotone" dataKey="مكتملة" stroke="#22c55e" strokeWidth={3} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="جديدة" stroke="#4f46e5" strokeWidth={3} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </TabsContent>

            <TabsContent value="team" className="mt-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <ChartCard title="عبء الفريق" subtitle="توزيع العمل المفتوح والمنجز والمتأخر." height={340}>
                  {workloadData.length === 0 ? (
                    <EmptyState label="لا توجد مهام مسندة ضمن هذا العرض" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={workloadData} margin={{ top: 8, right: 10, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                        <Legend />
                        <Bar
                          dataKey="مفتوحة"
                          stackId="tasks"
                          fill="#60a5fa"
                          radius={[6, 6, 0, 0]}
                          onClick={(entry: WorkloadChartEntry) => setQuery({ owner: entry.id, focus: "tasks", analytics: "team" })}
                        />
                        <Bar
                          dataKey="منجزة"
                          stackId="tasks"
                          fill="#22c55e"
                          radius={[6, 6, 0, 0]}
                          onClick={(entry: WorkloadChartEntry) => setQuery({ owner: entry.id, focus: "tasks", analytics: "team" })}
                        />
                        <Bar
                          dataKey="متأخرة"
                          stackId="tasks"
                          fill="#ef4444"
                          radius={[6, 6, 0, 0]}
                          onClick={(entry: WorkloadChartEntry) => setQuery({ owner: entry.id, focus: "tasks", analytics: "team" })}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4">
                    <h3 className="font-bold text-slate-900 font-heading">مهام الفريق</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">تتغير عند اختيار عضو من الرسم.</p>
                  </div>
                  <TaskResultList
                    tasks={analyticsTaskResults}
                    projects={projectMap}
                    onOpenTask={(task) => router.push(`/projects/${task.project_id}?tab=tasks`)}
                    onMarkDone={handleMarkDone}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="budget" className="mt-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <ChartCard title="مؤشرات الميزانية" subtitle="مقارنة الميزانية بالتكلفة المسجلة." height={340}>
                  {budgetData.length === 0 ? (
                    <EmptyState label="لا توجد ميزانيات مسجلة لهذا العرض" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={budgetData} margin={{ top: 8, right: 10, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis fontSize={11} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: number | string) => formatCurrency(Number(value))} />
                        <Legend />
                        <Bar
                          dataKey="الميزانية"
                          fill="#94a3b8"
                          radius={[6, 6, 0, 0]}
                          onClick={(entry: BudgetChartEntry) => setQuery({ project: entry.id, focus: "budget", analytics: "budget" })}
                        />
                        <Bar
                          dataKey="التكلفة"
                          fill="#10b981"
                          radius={[6, 6, 0, 0]}
                          onClick={(entry: BudgetChartEntry) => setQuery({ project: entry.id, focus: "budget", analytics: "budget" })}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4">
                    <h3 className="font-bold text-slate-900 font-heading">مشاريع الميزانية</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">الأعلى استهلاكا يظهر أولا.</p>
                  </div>
                  <ProjectResultList
                    infos={analyticsProjectResults}
                    onSelect={(projectId) => setQuery({ project: projectId, focus: "budget", analytics: "budget" })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="risks" className="mt-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="grid content-start gap-3 md:grid-cols-3 xl:grid-cols-1">
                  <button
                    type="button"
                    onClick={() => setQuery({ focus: "critical", analytics: "risks" })}
                    className="rounded-xl border border-red-100 bg-red-50 p-5 text-right shadow-sm transition-colors hover:bg-red-100/50"
                  >
                    <p className="text-xs font-bold text-red-600">تحتاج قرار</p>
                    <p className="mt-2 text-3xl font-black text-red-700">{riskProjectsCount}</p>
                    <p className="mt-2 text-xs font-semibold text-red-700/80">مشاريع أو مخاطر حرجة مفتوحة.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuery({ focus: "projects", analytics: "risks" })}
                    className="rounded-xl border border-amber-100 bg-amber-50 p-5 text-right shadow-sm transition-colors hover:bg-amber-100/50"
                  >
                    <p className="text-xs font-bold text-amber-600">تحت المتابعة</p>
                    <p className="mt-2 text-3xl font-black text-amber-700">{watchProjectsCount}</p>
                    <p className="mt-2 text-xs font-semibold text-amber-700/80">تأخر أو ميزانية أو موعد قريب.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuery({ projectStatus: "active", focus: "projects", analytics: "risks" })}
                    className="rounded-xl border border-emerald-100 bg-emerald-50 p-5 text-right shadow-sm transition-colors hover:bg-emerald-100/50"
                  >
                    <p className="text-xs font-bold text-emerald-600">مستقرة</p>
                    <p className="mt-2 text-3xl font-black text-emerald-700">
                      {Math.max(projectInfos.length - riskProjectsCount - watchProjectsCount, 0)}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-emerald-700/80">لا تظهر عليها إشارات خطر حاليا.</p>
                  </button>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4">
                    <h3 className="font-bold text-slate-900 font-heading">مشاريع تحتاج انتباه</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">مرتبة حسب الخطر ثم التأخر.</p>
                  </div>
                  <ProjectResultList
                    infos={analyticsProjectResults.filter((info) => info.health !== "good")}
                    onSelect={(projectId) => setQuery({ project: projectId, focus: "projects", analytics: "risks" })}
                  />
                </div>
              </div>
            </TabsContent>
            </Tabs>
          )}
        </section>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  height = 280,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  height?: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 font-heading">{title}</h3>
          <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <MousePointerClick size={15} />
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[460px]" dir="ltr" style={{ height }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm font-medium text-slate-400">
      {label}
    </div>
  );
}

function HomeTaskPanel({
  tasks,
  projects,
  onMarkDone,
}: {
  tasks: DashboardTask[];
  projects: Map<string, DashboardProject>;
  onMarkDone: (taskId: string, projectId?: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-heading">عملي القريب</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">مهام اليوم والمتأخر فقط.</p>
        </div>
        <Link href="/my-tasks" className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80">
          عرض الكل <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <EmptyState label="لا توجد مهام مستعجلة" />
        ) : (
          tasks.map((task) => (
            <div
              key={`${task.id}-${task.due_date}`}
              className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors hover:bg-white"
            >
              <button
                type="button"
                onClick={() => onMarkDone(task.id, task.project_id)}
                className="mt-1 text-slate-300 transition-colors hover:text-emerald-500"
                aria-label="إغلاق المهمة"
              >
                <CheckCircle2 size={17} />
              </button>
              <Link href={`/projects/${task.project_id}?tab=tasks`} className="min-w-0 flex-1">
                <TaskTitleStack
                  title={task.title}
                  subTask={task.sub_task}
                  category={task.category}
                  primaryClassName="line-clamp-1 text-sm font-bold text-slate-800"
                />
                <p className="mt-1 text-xs text-slate-500">
                  {projects.get(task.project_id)?.name ?? "مشروع"} · {formatDateShort(task.due_date)}
                </p>
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RecentUpdatesPanel({ comments }: { comments: DashboardComment[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-heading">آخر تحديث</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">مختصر بدون إطالة.</p>
        </div>
        <Activity className="text-primary" size={18} />
      </div>
      <div className="space-y-3">
        {comments.length === 0 ? (
          <EmptyState label="لا توجد تحديثات حديثة" />
        ) : (
          comments.slice(0, 3).map((comment) => (
            <div key={comment.id} className="border-r-2 border-primary/20 pr-3">
              <p className="text-xs font-bold text-slate-700">{comment.user?.full_name ?? "عضو الفريق"}</p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{comment.body}</p>
              <p className="mt-1 text-[11px] text-slate-400">{formatDateShort(comment.created_at)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProjectResultList({
  infos,
  onSelect,
  limit = 6,
}: {
  infos: ProjectInfo[];
  onSelect: (projectId: string) => void;
  limit?: number;
}) {
  if (infos.length === 0) return <EmptyState label="لا توجد مشاريع مطابقة" />;

  return (
    <div className="space-y-2">
      {infos.slice(0, limit).map((info) => (
        <button
          key={info.project.id}
          type="button"
          onClick={() => onSelect(info.project.id)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-right transition-colors hover:border-primary/20 hover:bg-white"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-black text-slate-900">{info.project.name}</p>
              <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">{info.healthReason}</p>
            </div>
            <span className={cn("shrink-0 rounded-md border px-2 py-1 text-[11px] font-bold", HEALTH_COLORS[info.health])}>
              {HEALTH_LABELS[info.health]}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-bold text-slate-500">
            <span className="rounded-lg bg-white p-2">إنجاز {Math.round(info.project.progress ?? 0)}%</span>
            <span className="rounded-lg bg-white p-2 text-red-600">متأخر {info.overdueTasks}</span>
            <span className="rounded-lg bg-white p-2">ميزانية {info.budgetUsedPct ?? 0}%</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function TaskResultList({
  tasks,
  projects,
  onOpenTask,
  onMarkDone,
  limit = 7,
}: {
  tasks: DashboardTask[];
  projects: Map<string, DashboardProject>;
  onOpenTask: (task: DashboardTask) => void;
  onMarkDone: (taskId: string, projectId?: string) => void;
  limit?: number;
}) {
  if (tasks.length === 0) return <EmptyState label="لا توجد مهام مطابقة" />;

  return (
    <div className="space-y-2">
      {tasks.slice(0, limit).map((task) => (
        <div
          key={task.id}
          className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-right transition-colors hover:border-primary/20 hover:bg-white"
        >
          <button
            type="button"
            onClick={() => onMarkDone(task.id, task.project_id)}
            className="mt-1 text-slate-300 transition-colors hover:text-emerald-500"
            aria-label="إغلاق المهمة"
          >
            <CheckCircle2 size={17} />
          </button>
          <button type="button" onClick={() => onOpenTask(task)} className="min-w-0 flex-1 text-right">
            <TaskTitleStack
              title={task.title}
              subTask={task.sub_task}
              category={task.category}
              done={task.status === "Done"}
              primaryClassName="line-clamp-1 text-sm font-bold text-slate-800"
            />
            <p className="mt-1 text-xs text-slate-500">
              {projects.get(task.project_id)?.name ?? "مشروع"} · {formatDateShort(task.due_date)}
            </p>
          </button>
        </div>
      ))}
    </div>
  );
}

function ProjectCards({
  infos,
  onFilterProject,
  onFilterTasks,
  onFilterOverdue,
}: {
  infos: ProjectInfo[];
  onFilterProject: (projectId: string) => void;
  onFilterTasks: (projectId: string) => void;
  onFilterOverdue: (projectId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-heading">مشاريعي والمشاريع المعروضة</h2>
          <p className="mt-1 text-sm text-slate-500">أهم المشاريع أولا حسب الصحة والتأخر.</p>
        </div>
        <Layers3 className="text-primary" size={20} />
      </div>

      {infos.length === 0 ? (
        <div className="p-5">
          <EmptyState label="لا توجد مشاريع مرتبطة بهذا العرض" />
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {infos.slice(0, 6).map((info) => (
            <div
              key={info.project.id}
              role="button"
              tabIndex={0}
              onClick={() => onFilterProject(info.project.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onFilterProject(info.project.id);
              }}
              className="grid gap-3 px-5 py-4 text-right transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 lg:grid-cols-[minmax(0,1.6fr)_minmax(180px,0.8fr)_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/projects/${info.project.id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="line-clamp-1 text-sm font-black text-slate-900 hover:text-primary"
                  >
                    {info.project.name}
                  </Link>
                  <span className={cn("rounded-md border px-2 py-1 text-[11px] font-bold", HEALTH_COLORS[info.health])}>
                    {HEALTH_LABELS[info.health]}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
                  <span>{info.role === "manager" ? "مدير المشروع" : info.role === "member" ? "عضو" : "ضمن المحفظة"}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span>{getProjectStatusLabel(info.project.status)}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span className="line-clamp-1">{info.healthReason}</span>
                </div>
              </div>

              <div className="self-center">
                <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>الإنجاز</span>
                  <span>{Math.round(info.project.progress ?? 0)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(info.project.progress ?? 0)}%` }} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-center text-xs">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onFilterTasks(info.project.id);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  مهامي {info.myTasks}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onFilterOverdue(info.project.id);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-bold text-red-600 transition-colors hover:border-red-200 hover:bg-red-50"
                >
                  متأخر {info.overdueTasks}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onFilterProject(info.project.id);
                  }}
                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-primary"
                  aria-label="تصفية المشروع"
                >
                  <ListFilter size={16} />
                </button>
                <Link
                  href={`/projects/${info.project.id}?tab=tasks`}
                  onClick={(event) => event.stopPropagation()}
                  className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 font-bold text-primary hover:bg-primary/15"
                >
                  فتح
                </Link>
                <span className="w-full text-[11px] font-bold text-slate-400 sm:w-auto">
                  النهاية {formatDateShort(info.project.end_date)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskDrillDown({
  tasks,
  projects,
  onOpenTask,
  onMarkDone,
}: {
  tasks: DashboardTask[];
  projects: Map<string, DashboardProject>;
  onOpenTask: (task: DashboardTask) => void;
  onMarkDone: (taskId: string, projectId?: string) => void;
}) {
  if (tasks.length === 0) return <EmptyState label="لا توجد مهام مطابقة لهذا العرض" />;

  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50">
          <tr>
            <th className="px-5 py-3 text-right font-semibold text-slate-500">المهمة</th>
            <th className="hidden px-5 py-3 text-right font-semibold text-slate-500 md:table-cell">المشروع</th>
            <th className="hidden px-5 py-3 text-right font-semibold text-slate-500 lg:table-cell">الحالة</th>
            <th className="hidden px-5 py-3 text-right font-semibold text-slate-500 lg:table-cell">الأولوية</th>
            <th className="px-5 py-3 text-right font-semibold text-slate-500">الاستحقاق</th>
            <th className="px-5 py-3 text-right font-semibold text-slate-500">إجراء</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.slice(0, 40).map((task) => (
            <tr key={task.id} className="cursor-pointer transition-colors hover:bg-slate-50" onClick={() => onOpenTask(task)}>
              <td className="px-5 py-3">
                <TaskTitleStack
                  title={task.title}
                  subTask={task.sub_task}
                  category={task.category}
                  done={task.status === "Done"}
                  primaryClassName="line-clamp-1 text-slate-800"
                />
                {task.alert_level && task.alert_level !== "Low" && (
                  <span className={cn("mt-1 inline-block rounded-full px-1.5 py-0.5 text-xs", getAlertLevelColor(task.alert_level))}>
                    {task.alert_level}
                  </span>
                )}
              </td>
              <td className="hidden px-5 py-3 text-slate-600 md:table-cell">{projects.get(task.project_id)?.name ?? "—"}</td>
              <td className="hidden px-5 py-3 lg:table-cell">
                <span className={cn("rounded-full px-2 py-1 text-xs font-bold", getStatusColor(task.status))}>{getStatusLabel(task.status)}</span>
              </td>
              <td className="hidden px-5 py-3 lg:table-cell">
                <span className={cn("rounded-full px-2 py-1 text-xs font-bold", getPriorityColor(task.priority))}>
                  {getPriorityLabel(task.priority)}
                </span>
              </td>
              <td className="px-5 py-3 text-slate-600">{formatDateShort(task.due_date)}</td>
              <td className="px-5 py-3">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onMarkDone(task.id, task.project_id);
                  }}
                  disabled={task.status === "Done"}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  إغلاق
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectDrillDown({ infos, onSelect }: { infos: ProjectInfo[]; onSelect: (projectId: string) => void }) {
  if (infos.length === 0) return <EmptyState label="لا توجد مشاريع مطابقة لهذا العرض" />;

  return (
    <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
      {infos.map((info) => (
        <button
          key={info.project.id}
          onClick={() => onSelect(info.project.id)}
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-right transition-colors hover:bg-white"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="line-clamp-1 text-sm font-black text-slate-900">{info.project.name}</p>
              <p className="mt-1 text-xs text-slate-500">{info.healthReason}</p>
            </div>
            <span className={cn("rounded-md border px-2 py-1 text-[11px] font-bold", HEALTH_COLORS[info.health])}>
              {HEALTH_LABELS[info.health]}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <span className="rounded-lg bg-white p-2">إنجاز {Math.round(info.project.progress ?? 0)}%</span>
            <span className="rounded-lg bg-white p-2">متأخر {info.overdueTasks}</span>
            <span className="rounded-lg bg-white p-2">ميزانية {info.budgetUsedPct ?? 0}%</span>
          </div>
        </button>
      ))}
    </div>
  );
}
