"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Database,
  Layers3,
  ListFilter,
  type LucideIcon,
  MousePointerClick,
  ShieldAlert,
  SlidersHorizontal,
  TrendingUp,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  cn,
  formatDateShort,
  getPriorityColor,
  getPriorityLabel,
  getStatusColor,
  getStatusLabel,
} from "@/lib/utils";
import { getProjectBudgetSummary, getTaskExpense, normalizeMoney } from "@/lib/projects/budget";
import type { Challenge, Profile, Project, ProjectDailySnapshot, Task } from "@/lib/supabase/types";

type BurnMode = "burndown" | "burnup";
type AnalyticsFocus = "tasks" | "risks" | null;
type AnalyticsChart = "burn" | "progress" | "budget" | "flow" | "risks";
type TaskStatusFilter = Task["status"] | "all";
type TaskPriorityFilter = Task["priority"] | "all";
type PeriodFilter = "all" | "today" | "week" | "month" | "overdue";

type AnalyticsTask = Task & {
  owner?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
};

type AnalyticsChallenge = Challenge & {
  owner?: Pick<Profile, "id" | "full_name"> | null;
};

interface Props {
  project: Project;
  tasks: AnalyticsTask[];
  challenges: AnalyticsChallenge[];
  snapshots?: ProjectDailySnapshot[];
}

interface TimelineEntry {
  date: string;
  label: string;
  pointMs: number;
  المخطط: number;
  الفعلي: number;
  "الإنجاز المخطط": number;
  "الإنجاز الفعلي": number;
  "الميزانية المخططة": number;
  "التكلفة المقدرة": number;
}

interface ChartOption {
  id: AnalyticsChart;
  title: string;
  description: string;
  insight: string;
  icon: LucideIcon;
  tone: "neutral" | "good" | "warning" | "risk";
}

const TASK_STATUSES: Task["status"][] = ["Backlog", "To Do", "In Progress", "Review", "Done", "Cancelled"];
const TASK_PRIORITIES: Task["priority"][] = ["critical", "high", "medium", "low"];
const OPEN_TASK_STATUSES: Task["status"][] = ["Backlog", "To Do", "In Progress", "Review"];
const OPEN_CHALLENGE_STATUSES = ["open", "in_progress"];
const ANALYTICS_CHARTS: AnalyticsChart[] = ["burn", "progress", "budget", "flow", "risks"];

const STATUS_COLORS: Record<Task["status"], string> = {
  Backlog: "#a78bfa",
  "To Do": "#94a3b8",
  "In Progress": "#60a5fa",
  Review: "#f59e0b",
  Done: "#22c55e",
  Cancelled: "#cbd5e1",
};

const TOOLTIP_STYLE = {
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 10px 24px rgb(15 23 42 / 0.08)",
  direction: "rtl" as const,
};

function dateValue(date: string | null | undefined) {
  if (!date) return null;
  const value = new Date(date).getTime();
  return Number.isNaN(value) ? null : value;
}

function dateKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function getTodayKey() {
  return dateKey(new Date());
}

function getRange(project: Project, tasks: AnalyticsTask[]) {
  const candidates = [
    dateValue(project.start_date),
    dateValue(project.end_date),
    ...tasks.flatMap((task) => [
      dateValue(task.start_date),
      dateValue(task.due_date),
      dateValue(task.created_at),
      dateValue(task.updated_at),
    ]),
  ].filter((value): value is number => value !== null);

  const today = new Date();
  const start = project.start_date ? new Date(project.start_date) : new Date(Math.min(...candidates, today.getTime()));
  const fallbackEnd = new Date(start);
  fallbackEnd.setDate(fallbackEnd.getDate() + 30);
  const end = project.end_date ? new Date(project.end_date) : new Date(Math.max(...candidates, fallbackEnd.getTime()));

  if (end.getTime() <= start.getTime()) {
    const adjusted = new Date(start);
    adjusted.setDate(adjusted.getDate() + 30);
    return { start, end: adjusted };
  }

  return { start, end };
}

function makePoints(start: Date, end: Date) {
  const pointCount = 8;
  const startMs = start.getTime();
  const endMs = end.getTime();

  return Array.from({ length: pointCount }).map((_, index) => {
    const ratio = index / (pointCount - 1);
    return new Date(startMs + (endMs - startMs) * ratio);
  });
}

function pct(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function taskRelevantDate(task: AnalyticsTask) {
  return dateValue(task.due_date) ?? dateValue(task.start_date) ?? dateValue(task.created_at) ?? 0;
}

function taskCompletedBy(task: AnalyticsTask, pointMs: number) {
  return task.status === "Done" && (dateValue(task.updated_at) ?? 0) <= pointMs;
}

function isOpenTask(task: AnalyticsTask) {
  return OPEN_TASK_STATUSES.includes(task.status);
}

function isTaskOverdue(task: AnalyticsTask, todayKey: string) {
  return Boolean(task.due_date && task.due_date < todayKey && isOpenTask(task));
}

function isDateInPeriod(date: string | null | undefined, period: PeriodFilter, todayKey: string) {
  if (period === "all") return true;
  if (!date) return false;
  if (period === "today") return date === todayKey;

  const target = new Date(date);
  const today = new Date(todayKey);
  const days = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);

  if (period === "week") return days >= 0 && days <= 7;
  if (period === "month") return days >= 0 && days <= 30;
  if (period === "overdue") return date < todayKey;
  return true;
}

function taskMatchesPeriod(task: AnalyticsTask, period: PeriodFilter, todayKey: string) {
  if (period === "overdue") return isTaskOverdue(task, todayKey);
  return isDateInPeriod(task.due_date ?? task.start_date ?? task.created_at, period, todayKey);
}

function challengeMatchesPeriod(challenge: AnalyticsChallenge, period: PeriodFilter, todayKey: string) {
  if (period === "overdue") {
    return Boolean(
      challenge.due_date &&
        challenge.due_date < todayKey &&
        OPEN_CHALLENGE_STATUSES.includes(challenge.status)
    );
  }

  return isDateInPeriod(challenge.due_date ?? challenge.identified_at ?? challenge.created_at, period, todayKey);
}

function ownerName(task: AnalyticsTask) {
  return task.owner?.full_name ?? task.owner_name ?? "غير مسند";
}

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString("ar")} ر.س`;
}

function parseRiskCell(value: string | null) {
  if (!value) return null;
  const [impactRaw, probabilityRaw] = value.split("-");
  const impact = Number(impactRaw);
  const probability = Number(probabilityRaw);

  if (!Number.isInteger(impact) || !Number.isInteger(probability)) return null;
  if (impact < 1 || impact > 5 || probability < 1 || probability > 5) return null;
  return { impact, probability };
}

function timelinePayload(event: unknown) {
  const payload = (event as { activePayload?: Array<{ payload?: TimelineEntry }> } | null)?.activePayload;
  return payload?.[0]?.payload ?? null;
}

export function ProjectOverviewAnalytics({ project, tasks, challenges, snapshots = [] }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [burnMode, setBurnMode] = useState<BurnMode>("burndown");

  const todayKey = getTodayKey();
  const statusParam = searchParams.get("analyticsStatus") as Task["status"] | null;
  const statusFilter: TaskStatusFilter = statusParam && TASK_STATUSES.includes(statusParam) ? statusParam : "all";
  const priorityParam = searchParams.get("analyticsPriority") as Task["priority"] | null;
  const priorityFilter: TaskPriorityFilter =
    priorityParam && TASK_PRIORITIES.includes(priorityParam) ? priorityParam : "all";
  const periodParam = searchParams.get("analyticsPeriod") as PeriodFilter | null;
  const periodFilter: PeriodFilter =
    periodParam && ["all", "today", "week", "month", "overdue"].includes(periodParam) ? periodParam : "all";
  const ownerParam = searchParams.get("analyticsOwner") ?? "all";
  const focusParam = searchParams.get("analyticsFocus") as AnalyticsFocus;
  const focus: AnalyticsFocus = focusParam === "tasks" || focusParam === "risks" ? focusParam : null;
  const selectedDate = searchParams.get("analyticsDate");
  const selectedRiskCell = parseRiskCell(searchParams.get("analyticsRisk"));
  const chartParam = searchParams.get("analyticsChart") as AnalyticsChart | null;
  const activeChart: AnalyticsChart =
    chartParam && ANALYTICS_CHARTS.includes(chartParam)
      ? chartParam
      : focus === "risks" || selectedRiskCell
        ? "risks"
        : "burn";

  const setQuery = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "overview");
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    });
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const ownerOptions = useMemo(() => {
    const owners = new Map<string, string>();

    tasks.forEach((task) => {
      owners.set(task.owner_id ?? "unassigned", ownerName(task));
    });

    challenges.forEach((challenge) => {
      owners.set(challenge.owner_id ?? "unassigned", challenge.owner?.full_name ?? "غير مسند");
    });

    return Array.from(owners, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [challenges, tasks]);

  const selectedOwner = ownerOptions.some((owner) => owner.id === ownerParam) ? ownerParam : "all";

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (selectedOwner !== "all" && (task.owner_id ?? "unassigned") !== selectedOwner) return false;
      if (!taskMatchesPeriod(task, periodFilter, todayKey)) return false;
      return true;
    });
  }, [periodFilter, priorityFilter, selectedOwner, statusFilter, tasks, todayKey]);

  const riskSource = useMemo(() => {
    return challenges.filter((challenge) => {
      if (!OPEN_CHALLENGE_STATUSES.includes(challenge.status)) return false;
      if (selectedOwner !== "all" && (challenge.owner_id ?? "unassigned") !== selectedOwner) return false;
      if (!challengeMatchesPeriod(challenge, periodFilter, todayKey)) return false;
      return true;
    });
  }, [challenges, periodFilter, selectedOwner, todayKey]);

  const filteredRisks = useMemo(() => {
    if (!selectedRiskCell) return riskSource;
    return riskSource.filter(
      (challenge) =>
        challenge.impact_score === selectedRiskCell.impact &&
        challenge.probability_score === selectedRiskCell.probability
    );
  }, [riskSource, selectedRiskCell]);

  const historicalSnapshots = useMemo(() => {
    return [...snapshots]
      .filter((snapshot) => snapshot.project_id === project.id)
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
  }, [project.id, snapshots]);

  const hasTaskTimelineFilters =
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    selectedOwner !== "all" ||
    periodFilter !== "all";
  const useHistoricalTimeline = historicalSnapshots.length >= 2 && !hasTaskTimelineFilters;
  const timelineSourceLabel = useHistoricalTimeline
    ? `بيانات تاريخية من ${historicalSnapshots.length} لقطة يومية`
    : "تقدير من تواريخ المهام الحالية";
  const sourceTone = useHistoricalTimeline
    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
    : "border-amber-100 bg-amber-50 text-amber-700";
  const filterChips = [
    statusFilter !== "all" && {
      key: "status",
      label: getStatusLabel(statusFilter),
      onRemove: () => setQuery({ analyticsStatus: null }),
    },
    priorityFilter !== "all" && {
      key: "priority",
      label: getPriorityLabel(priorityFilter),
      onRemove: () => setQuery({ analyticsPriority: null }),
    },
    selectedOwner !== "all" && {
      key: "owner",
      label: ownerOptions.find((owner) => owner.id === selectedOwner)?.name ?? "عضو محدد",
      onRemove: () => setQuery({ analyticsOwner: null }),
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
      onRemove: () => setQuery({ analyticsPeriod: null }),
    },
  ].filter(Boolean) as Array<{ key: string; label: string; onRemove: () => void }>;

  const { start, end } = useMemo(() => getRange(project, filteredTasks), [filteredTasks, project]);
  const timeline = useMemo<TimelineEntry[]>(() => {
    if (useHistoricalTimeline) {
      return historicalSnapshots.map((snapshot) => {
        const pointMs = dateValue(snapshot.snapshot_date) ?? 0;
        const plannedDone = Math.round((snapshot.total_tasks * snapshot.planned_progress) / 100);

        return {
          date: snapshot.snapshot_date,
          label: formatDateShort(snapshot.snapshot_date),
          pointMs,
          المخطط: burnMode === "burndown" ? Math.max(snapshot.total_tasks - plannedDone, 0) : plannedDone,
          الفعلي:
            burnMode === "burndown"
              ? Math.max(snapshot.total_tasks - snapshot.completed_tasks, 0)
              : snapshot.completed_tasks,
          "الإنجاز المخطط": Math.round(snapshot.planned_progress),
          "الإنجاز الفعلي": Math.round(snapshot.actual_progress),
          "الميزانية المخططة": Math.round(snapshot.planned_cost),
          "التكلفة المقدرة": Math.round(snapshot.estimated_cost),
          [getStatusLabel("Backlog")]: snapshot.backlog_tasks,
          [getStatusLabel("To Do")]: snapshot.todo_tasks,
          [getStatusLabel("In Progress")]: snapshot.in_progress_tasks,
          [getStatusLabel("Review")]: snapshot.review_tasks,
          [getStatusLabel("Done")]: snapshot.completed_tasks,
          [getStatusLabel("Cancelled")]: snapshot.cancelled_tasks,
        };
      });
    }

    const points = makePoints(start, end);
    const totalTasks = filteredTasks.length;
    const totalBudget = normalizeMoney(project.total_budget);
    const duration = Math.max(end.getTime() - start.getTime(), 1);

    return points.map((point) => {
      const pointMs = point.getTime();
      const progressRatio = Math.min(Math.max((pointMs - start.getTime()) / duration, 0), 1);
      const plannedDone = filteredTasks.filter((task) => taskRelevantDate(task) <= pointMs).length;
      const actualDone = filteredTasks.filter((task) => taskCompletedBy(task, pointMs)).length;
      const costByDate = filteredTasks
        .filter((task) => taskCompletedBy(task, pointMs) || taskRelevantDate(task) <= pointMs)
        .reduce((sum, task) => sum + getTaskExpense(task), 0);

      const statusCounts = TASK_STATUSES.reduce<Record<Task["status"], number>>((acc, status) => {
        acc[status] = filteredTasks.filter((task) => task.status === status && taskRelevantDate(task) <= pointMs).length;
        return acc;
      }, {
        Backlog: 0,
        "To Do": 0,
        "In Progress": 0,
        Review: 0,
        Done: 0,
        Cancelled: 0,
      });

      return {
        date: dateKey(point),
        label: formatDateShort(point),
        pointMs,
        المخطط: burnMode === "burndown" ? Math.max(totalTasks - plannedDone, 0) : plannedDone,
        الفعلي: burnMode === "burndown" ? Math.max(totalTasks - actualDone, 0) : actualDone,
        "الإنجاز المخطط": pct(plannedDone, totalTasks),
        "الإنجاز الفعلي": pct(actualDone, totalTasks),
        "الميزانية المخططة": Math.round(totalBudget * progressRatio),
        "التكلفة المقدرة": Math.round(costByDate),
        ...Object.fromEntries(TASK_STATUSES.map((status) => [getStatusLabel(status), statusCounts[status]])),
      };
    });
  }, [burnMode, end, filteredTasks, historicalSnapshots, project.total_budget, start, useHistoricalTimeline]);

  const riskMatrix = useMemo(() => {
    const matrix = Array.from({ length: 5 }).map((_, impactIndex) =>
      Array.from({ length: 5 }).map((__, probabilityIndex) => ({
        impact: 5 - impactIndex,
        probability: probabilityIndex + 1,
        count: 0,
      }))
    );

    riskSource.forEach((challenge) => {
      const impact = Math.min(Math.max(challenge.impact_score ?? 1, 1), 5);
      const probability = Math.min(Math.max(challenge.probability_score ?? 1, 1), 5);
      matrix[5 - impact][probability - 1].count += 1;
    });

    return matrix;
  }, [riskSource]);

  const selectedPointMs = selectedDate ? timeline.find((point) => point.date === selectedDate)?.pointMs ?? null : null;
  const drillDownTasks = selectedPointMs
    ? filteredTasks.filter((task) => taskRelevantDate(task) <= selectedPointMs)
    : filteredTasks;
  const doneCount = filteredTasks.filter((task) => task.status === "Done").length;
  const overdueCount = filteredTasks.filter((task) => isTaskOverdue(task, todayKey)).length;
  const budgetSummary = getProjectBudgetSummary(project, filteredTasks);
  const totalCost = budgetSummary.spent;
  const budgetUsage = budgetSummary.usagePct ?? 0;
  const hasFilters =
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    selectedOwner !== "all" ||
    periodFilter !== "all" ||
    Boolean(focus || selectedDate || selectedRiskCell);
  const chartOptions: ChartOption[] = [
    {
      id: "burn",
      title: burnMode === "burndown" ? "منحنى المتبقي" : "منحنى المنجز",
      description: "يعرض هل العمل يسير أسرع أو أبطأ من المخطط.",
      insight: `${filteredTasks.length} مهمة`,
      icon: TrendingUp,
      tone: overdueCount > 0 ? "warning" : "neutral",
    },
    {
      id: "progress",
      title: "S-Curve للإنجاز",
      description: "يقارن الإنجاز المخطط بالإنجاز الفعلي عبر الزمن.",
      insight: `${pct(doneCount, filteredTasks.length)}% إنجاز`,
      icon: Activity,
      tone: "good",
    },
    {
      id: "budget",
      title: "منحنى الميزانية",
      description: "يتابع الميزانية المخططة مقابل المصروفات المسجلة.",
      insight: `${budgetUsage}% استهلاك`,
      icon: Wallet,
      tone: budgetUsage > 100 ? "risk" : budgetUsage >= 80 ? "warning" : "good",
    },
    {
      id: "flow",
      title: "تدفق الحالات",
      description: "يوضح تراكم المهام حسب الحالة لاكتشاف الاختناقات.",
      insight: `${filteredTasks.length - doneCount} مفتوحة`,
      icon: Layers3,
      tone: "neutral",
    },
    {
      id: "risks",
      title: "خريطة المخاطر",
      description: "تعرض المخاطر حسب الأثر والاحتمال وتفتح تفاصيلها بالضغط.",
      insight: `${riskSource.length} مفتوحة`,
      icon: ShieldAlert,
      tone: riskSource.length > 0 ? "risk" : "good",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                <Activity size={18} />
              </span>
              <span className={cn("flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold", sourceTone)}>
                <Database size={13} />
                {useHistoricalTimeline ? "مصدر تاريخي" : "مصدر تقديري"}
              </span>
            </div>
            <h3 className="mt-3 font-bold text-slate-900 font-heading">تحليلات نظرة المشروع</h3>
            <p className="mt-1 max-w-2xl text-xs font-medium leading-5 text-slate-500">
              {timelineSourceLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <span className="flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-sm font-bold text-slate-700 shadow-sm">
              <SlidersHorizontal size={15} />
              الفلاتر
            </span>
            <select
              value={statusFilter}
              onChange={(event) => setQuery({ analyticsStatus: event.target.value, analyticsFocus: "tasks", analyticsDate: null })}
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
              onChange={(event) => setQuery({ analyticsPriority: event.target.value, analyticsFocus: "tasks", analyticsDate: null })}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">كل الأولويات</option>
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {getPriorityLabel(priority)}
                </option>
              ))}
            </select>
            <select
              value={selectedOwner}
              onChange={(event) => setQuery({ analyticsOwner: event.target.value, analyticsFocus: "tasks", analyticsDate: null })}
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
              onChange={(event) =>
                setQuery({ analyticsPeriod: event.target.value, analyticsFocus: "tasks", analyticsDate: null, analyticsRisk: null })
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">كل الفترات</option>
              <option value="today">اليوم</option>
              <option value="week">خلال أسبوع</option>
              <option value="month">خلال شهر</option>
              <option value="overdue">متأخرة</option>
            </select>
            {hasFilters && (
              <button
                onClick={() =>
                  setQuery({
                    analyticsStatus: null,
                    analyticsPriority: null,
                    analyticsOwner: null,
                    analyticsPeriod: null,
                    analyticsFocus: null,
                    analyticsDate: null,
                    analyticsRisk: null,
                  })
                }
                className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                <X size={15} />
                مسح
              </button>
            )}
          </div>
        </div>

        {filterChips.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
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

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <AnalyticsStat icon={ListFilter} label="المهام المعروضة" value={filteredTasks.length} hint={`${tasks.length} إجمالي`} />
          <AnalyticsStat icon={CheckCircle2} label="نسبة الإنجاز" value={`${pct(doneCount, filteredTasks.length)}%`} hint={`${doneCount} مكتملة`} />
          <AnalyticsStat icon={AlertTriangle} label="المتأخرة" value={overdueCount} hint="مهام مفتوحة" tone="risk" />
          <AnalyticsStat icon={ShieldAlert} label="المخاطر المفتوحة" value={riskSource.length} hint={`${filteredRisks.length} مطابقة`} tone="warning" />
          <AnalyticsStat icon={Wallet} label="استهلاك الميزانية" value={`${budgetUsage}%`} hint={formatCurrency(totalCost)} tone={budgetUsage > 100 ? "risk" : "good"} />
        </div>
      </div>

      {focus && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h3 className="font-bold text-slate-900 font-heading">
                {focus === "tasks" ? "تفاصيل المهام" : "تفاصيل المخاطر"}
              </h3>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {selectedDate ? `حتى ${formatDateShort(selectedDate)}` : selectedRiskCell ? `أثر ${selectedRiskCell.impact} / احتمال ${selectedRiskCell.probability}` : "حسب الفلاتر الحالية"}
              </p>
            </div>
            <button
              onClick={() => setQuery({ analyticsFocus: null, analyticsDate: null, analyticsRisk: null })}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>

          {focus === "tasks" ? (
            <TaskDetails tasks={drillDownTasks} projectId={project.id} />
          ) : (
            <RiskDetails risks={filteredRisks} projectId={project.id} />
          )}
        </div>
      )}

      <ChartSelector
        options={chartOptions}
        activeChart={activeChart}
        onSelect={(chart) =>
          setQuery({
            analyticsChart: chart,
            analyticsFocus: null,
            analyticsDate: null,
            analyticsRisk: null,
          })
        }
      />

      {activeChart === "burn" && (
        <AnalyticsCard
          title={burnMode === "burndown" ? "منحنى المتبقي" : "منحنى المنجز"}
          subtitle={timelineSourceLabel}
          icon={TrendingUp}
          action={
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
              <button
                onClick={() => setBurnMode("burndown")}
                className={cn("rounded-md px-3 py-1.5", burnMode === "burndown" ? "bg-white text-primary shadow-sm" : "text-slate-500")}
              >
                Burn-down
              </button>
              <button
                onClick={() => setBurnMode("burnup")}
                className={cn("rounded-md px-3 py-1.5", burnMode === "burnup" ? "bg-white text-primary shadow-sm" : "text-slate-500")}
              >
                Burn-up
              </button>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={320}>
            <LineChart
              data={timeline}
              margin={{ top: 8, right: 10, left: 8, bottom: 8 }}
              onClick={(event) => {
                const entry = timelinePayload(event);
                if (entry) setQuery({ analyticsChart: "burn", analyticsFocus: "tasks", analyticsDate: entry.date, analyticsRisk: null });
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
              <Line type="monotone" dataKey="المخطط" stroke="#94a3b8" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="الفعلي" stroke="#4f46e5" strokeWidth={3} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </AnalyticsCard>
      )}

      {activeChart === "progress" && (
        <AnalyticsCard title="S-Curve للإنجاز" subtitle={timelineSourceLabel} icon={Activity}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart
              data={timeline}
              margin={{ top: 8, right: 10, left: 8, bottom: 8 }}
              onClick={(event) => {
                const entry = timelinePayload(event);
                if (entry) setQuery({ analyticsChart: "progress", analyticsFocus: "tasks", analyticsDate: entry.date, analyticsRisk: null });
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} fontSize={11} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number | string) => `${value}%`} />
              <Legend />
              <Line type="monotone" dataKey="الإنجاز المخطط" stroke="#94a3b8" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="الإنجاز الفعلي" stroke="#10b981" strokeWidth={3} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </AnalyticsCard>
      )}

      {activeChart === "budget" && (
        <AnalyticsCard
          title="منحنى الميزانية"
          subtitle={`استهلاك تقديري ${budgetUsage}% من الميزانية`}
          icon={Wallet}
        >
          <ResponsiveContainer width="100%" height={320}>
            <LineChart
              data={timeline}
              margin={{ top: 8, right: 10, left: 8, bottom: 8 }}
              onClick={(event) => {
                const entry = timelinePayload(event);
                if (entry) setQuery({ analyticsChart: "budget", analyticsFocus: "tasks", analyticsDate: entry.date, analyticsRisk: null });
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number | string) => formatCurrency(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="الميزانية المخططة" stroke="#94a3b8" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="التكلفة المقدرة" stroke="#10b981" strokeWidth={3} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </AnalyticsCard>
      )}

      {activeChart === "flow" && (
        <AnalyticsCard title="Cumulative Flow" subtitle={timelineSourceLabel} icon={Layers3}>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={timeline} margin={{ top: 8, right: 10, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
              {TASK_STATUSES.map((status) => (
                <Area
                  key={status}
                  type="monotone"
                  dataKey={getStatusLabel(status)}
                  stackId="1"
                  stroke={STATUS_COLORS[status]}
                  fill={STATUS_COLORS[status]}
                  fillOpacity={0.7}
                  onClick={() => setQuery({ analyticsChart: "flow", analyticsStatus: status, analyticsFocus: "tasks", analyticsDate: null })}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </AnalyticsCard>
      )}

      {activeChart === "risks" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-50 p-2 text-red-600">
                <ShieldAlert size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 font-heading">خريطة المخاطر</h3>
                <p className="mt-1 text-xs font-medium text-slate-500">{riskSource.length} مخاطر وتحديات مفتوحة ضمن الفلاتر الحالية</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <span>الأثر</span>
              <span className="h-px w-8 bg-slate-200" />
              <span>الاحتمال</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid min-w-[560px] gap-2">
              {riskMatrix.map((row) => (
                <div key={row[0].impact} className="grid grid-cols-5 gap-2">
                  {row.map((cell) => {
                    const score = cell.impact * cell.probability;
                    const active =
                      selectedRiskCell?.impact === cell.impact &&
                      selectedRiskCell.probability === cell.probability;
                    const color =
                      score >= 16
                        ? "bg-red-100 text-red-800 border-red-200"
                        : score >= 9
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-100";

                    return (
                      <button
                        key={`${cell.impact}-${cell.probability}`}
                        onClick={() =>
                          setQuery({
                            analyticsChart: "risks",
                            analyticsFocus: "risks",
                            analyticsRisk: `${cell.impact}-${cell.probability}`,
                            analyticsDate: null,
                          })
                        }
                        className={cn(
                          "flex min-h-16 flex-col items-center justify-center rounded-xl border text-center transition-all hover:shadow-sm",
                          color,
                          active && "ring-2 ring-primary ring-offset-2"
                        )}
                      >
                        <span className="text-lg font-black">{cell.count}</span>
                        <span className="text-[11px] font-bold">أثر {cell.impact} / احتمال {cell.probability}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChartSelector({
  options,
  activeChart,
  onSelect,
}: {
  options: ChartOption[];
  activeChart: AnalyticsChart;
  onSelect: (chart: AnalyticsChart) => void;
}) {
  const toneClass = {
    neutral: "bg-slate-50 text-slate-600 border-slate-200",
    good: "bg-emerald-50 text-emerald-700 border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    risk: "bg-red-50 text-red-700 border-red-100",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-900 font-heading">اختر التشارت الذي تحتاجه</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            التشارتس لا تظهر كلها دفعة واحدة لتوفير المساحة والتركيز على القرار الحالي.
          </p>
        </div>
        <span className="flex w-fit items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500">
          <MousePointerClick size={14} />
          اضغط للعرض
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {options.map((option) => {
          const Icon = option.icon;
          const active = activeChart === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              className={cn(
                "rounded-xl border p-3 text-right transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                active
                  ? "border-primary/30 bg-indigo-50/70 shadow-sm ring-1 ring-primary/10"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", toneClass[option.tone])}>
                  <Icon size={17} />
                </span>
                <span className={cn("rounded-lg px-2 py-1 text-[11px] font-black", active ? "bg-primary text-white" : "bg-white text-slate-500")}>
                  {active ? "معروض" : "عرض"}
                </span>
              </div>
              <p className="mt-3 text-sm font-black text-slate-900">{option.title}</p>
              <p className="mt-1 line-clamp-2 min-h-10 text-xs font-medium leading-5 text-slate-500">{option.description}</p>
              <p className="mt-3 text-xs font-bold text-primary">{option.insight}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AnalyticsStat({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint: string;
  tone?: "neutral" | "good" | "warning" | "risk";
}) {
  const toneClass = {
    neutral: "bg-slate-50 text-slate-600",
    good: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    risk: "bg-red-50 text-red-600",
  }[tone];
  const accentClass = {
    neutral: "bg-slate-400",
    good: "bg-emerald-500",
    warning: "bg-amber-500",
    risk: "bg-red-500",
  }[tone];

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <span className={cn("absolute inset-x-0 top-0 h-1", accentClass)} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
        </div>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", toneClass)}>
          <Icon size={17} />
        </span>
      </div>
      <p className="mt-2 text-[11px] font-medium text-slate-500">{hint}</p>
    </div>
  );
}

function TaskDetails({ tasks, projectId }: { tasks: AnalyticsTask[]; projectId: string }) {
  if (tasks.length === 0) {
    return <EmptyState label="لا توجد مهام مطابقة للفلاتر الحالية" />;
  }

  return (
    <div className="grid gap-3 p-5 md:grid-cols-2">
      {tasks.slice(0, 30).map((task) => (
        <Link
          key={task.id}
          href={`/projects/${projectId}?tab=tasks`}
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-white"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-black text-slate-900">{task.title}</p>
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500">
                <UserRound size={12} />
                {ownerName(task)}
              </p>
            </div>
            <span className={cn("rounded-full px-2 py-1 text-[11px] font-bold", getPriorityColor(task.priority))}>
              {getPriorityLabel(task.priority)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className={cn("rounded-full px-2 py-1 font-bold", getStatusColor(task.status))}>{getStatusLabel(task.status)}</span>
            <span className="flex items-center gap-1 rounded-full bg-white px-2 py-1 font-bold text-slate-500 ring-1 ring-slate-200">
              <CalendarDays size={12} />
              {formatDateShort(task.due_date)}
            </span>
            <span className="rounded-full bg-white px-2 py-1 font-bold text-slate-500 ring-1 ring-slate-200">
              تكلفة {formatCurrency(getTaskExpense(task))}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function RiskDetails({ risks, projectId }: { risks: AnalyticsChallenge[]; projectId: string }) {
  if (risks.length === 0) {
    return <EmptyState label="لا توجد مخاطر مطابقة للفلاتر الحالية" />;
  }

  return (
    <div className="grid gap-3 p-5 md:grid-cols-2">
      {risks.slice(0, 30).map((risk) => (
        <Link
          key={risk.id}
          href={`/projects/${projectId}?tab=challenges`}
          className="rounded-xl border border-red-100 bg-red-50/60 p-4 transition-colors hover:bg-red-50"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-black text-red-900">{risk.title}</p>
              <p className="mt-1 text-xs font-medium text-red-700">
                {risk.owner?.full_name ?? "غير مسند"} · {formatDateShort(risk.due_date)}
              </p>
            </div>
            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-red-700 ring-1 ring-red-100">
              {risk.risk_score}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-red-700">
            <span className="rounded-full bg-white px-2 py-1 ring-1 ring-red-100">الأثر {risk.impact_score}</span>
            <span className="rounded-full bg-white px-2 py-1 ring-1 ring-red-100">الاحتمال {risk.probability_score}</span>
            <span className="rounded-full bg-white px-2 py-1 ring-1 ring-red-100">{risk.risk_level}</span>
          </div>
        </Link>
      ))}
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

function AnalyticsCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
            <Icon size={18} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 font-heading">{title}</h3>
            <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <MousePointerClick size={15} />
          </span>
          {action}
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="h-[320px] min-w-[520px]" dir="ltr">
          {children}
        </div>
      </div>
    </div>
  );
}
