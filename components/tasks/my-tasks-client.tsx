"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Clock, CalendarCheck, List, Search, X } from "lucide-react";
import { formatDateShort, getPriorityLabel, getStatusColor, getStatusLabel, isOverdue, isDueToday, cn } from "@/lib/utils";
import { recalcProjectProgress } from "@/lib/utils/recalc-progress";
import { createSearchMatcher } from "@/lib/utils/search";
import { TaskModal } from "./task-modal";
import { useRealtimeSubscription } from "@/lib/supabase/realtime";
import {
  applyMyTaskRealtimeChange,
  applyTaskToTaskQueries,
  fetchMyTasks,
  markTaskDone,
  taskKeys,
  type TaskWithRelations,
} from "@/lib/queries/tasks";
import type { Profile } from "@/lib/supabase/types";

type Filter = "all" | "today" | "week" | "overdue" | "done";

interface Props {
  tasks: TaskWithRelations[];
  currentUser: Profile;
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
}

const FILTERS: { key: Filter; label: string; icon: React.ElementType }[] = [
  { key: "all", label: "الكل", icon: List },
  { key: "today", label: "اليوم", icon: CalendarCheck },
  { key: "week", label: "هذا الأسبوع", icon: Clock },
  { key: "overdue", label: "المتأخرة", icon: AlertCircle },
  { key: "done", label: "المكتملة", icon: CheckCircle2 },
];

export function MyTasksClient({ tasks: initialTasks, currentUser, profiles }: Props) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data: tasks = initialTasks } = useQuery({
    queryKey: taskKeys.myTasks(currentUser.id),
    queryFn: () => fetchMyTasks(currentUser.id),
    initialData: initialTasks,
  });

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  const handleTaskChange = useCallback(
    (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
      const changedTask = (payload.eventType === "DELETE" ? payload.old : payload.new) as unknown as TaskWithRelations;
      applyMyTaskRealtimeChange(queryClient, currentUser.id, payload.eventType, changedTask);
      queryClient.invalidateQueries({ queryKey: taskKeys.myTasks(currentUser.id) });
      if (payload.eventType === "DELETE" && selectedTaskId === changedTask.id) {
        setSelectedTaskId(null);
      }
    },
    [queryClient, currentUser.id, selectedTaskId]
  );
  useRealtimeSubscription("tasks", `owner_id=eq.${currentUser.id}`, handleTaskChange);

  const markDoneMutation = useMutation({
    mutationFn: markTaskDone,
    onSuccess: (updatedTask) => {
      applyTaskToTaskQueries(queryClient, updatedTask);
      applyMyTaskRealtimeChange(queryClient, currentUser.id, "UPDATE", updatedTask);
      toast.success("خلّصت المهمة! 🎉");
      recalcProjectProgress(updatedTask.project_id);
    },
    onError: () => {
      toast.error("فشل التحديث");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });

  const weekEnd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }, []);

  const filtered = useMemo(() => {
    const matchesSearch = createSearchMatcher(search);

    return tasks.filter((t) => {
      const matchesFilter =
        filter === "today"
          ? t.due_date && isDueToday(t.due_date) && !["Done", "Cancelled"].includes(t.status)
          : filter === "week"
            ? t.due_date && new Date(t.due_date) <= weekEnd && !["Done", "Cancelled"].includes(t.status)
            : filter === "overdue"
              ? isOverdue(t.due_date, t.status)
              : filter === "done"
                ? t.status === "Done"
                : true;

      if (!matchesFilter) return false;

      return matchesSearch([
        t.title,
        t.sub_task,
        t.project?.name,
        t.owner?.full_name,
        t.owner_name,
        t.category,
        t.status,
        getStatusLabel(t.status),
        t.priority,
        getPriorityLabel(t.priority),
        t.alert_level,
        t.alert_message,
      ]);
    });
  }, [tasks, filter, search, weekEnd]);

  const counts = useMemo(
    () => ({
      all: tasks.length,
      today: tasks.filter((t) => t.due_date && isDueToday(t.due_date) && !["Done", "Cancelled"].includes(t.status)).length,
      week: tasks.filter((t) => t.due_date && new Date(t.due_date) <= weekEnd && !["Done", "Cancelled"].includes(t.status)).length,
      overdue: tasks.filter((t) => isOverdue(t.due_date, t.status)).length,
      done: tasks.filter((t) => t.status === "Done").length,
    }),
    [tasks, weekEnd]
  );

  const handleMarkDone = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    markDoneMutation.mutate(taskId);
  };

  const handleNeedHelp = async (task: TaskWithRelations, e: React.MouseEvent) => {
    e.stopPropagation();
    const supabase = createClient();
    const { error } = await supabase.from("challenges").insert({
      project_id: task.project_id,
      task_id: task.id,
      title: `أبغى مساعدة: ${task.title}`,
      status: "open",
      owner_id: currentUser?.id ?? "",
    });
    if (error) toast.error("ما نجح إنشاء التحدي");
    else toast.success("تم إنشاء طلب المساعدة");
  };

  return (
    <>
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">مهامي</h1>
          <p className="text-muted-foreground text-sm mt-1">مهامك الشخصية المسندة إليك</p>
        </div>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="ابحث في مهامك..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {search && (
          <button
            type="button"
            aria-label="مسح البحث"
            onClick={() => setSearch("")}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {FILTERS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              filter === key
                ? "bg-primary text-white shadow-sm"
                : "bg-white border border-border text-muted-foreground hover:bg-accent"
            )}
          >
            <Icon size={15} />
            {label}
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center",
                filter === key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              )}
            >
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="text-5xl mb-4">✓</div>
          <p className="font-medium">
            {search ? "لا توجد مهام مطابقة للبحث في هذه الفئة" : "ما فيه مهام في هذه الفئة"}
          </p>
          <p className="text-sm mt-1">
            {search ? "جرّب كلمة أخرى أو امسح البحث لعرض القائمة." : "يعطيك العافية! كمّل شغلك"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => {
            const overdueTask = isOverdue(task.due_date, task.status);
            return (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={cn(
                  "bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all",
                  overdueTask ? "border-red-200" : "border-border hover:border-primary/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", getStatusColor(task.status))}>
                        {getStatusLabel(task.status)}
                      </span>
                      {task.project && (
                        <span className="text-xs text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
                          {task.project.name}
                        </span>
                      )}
                      {overdueTask && (
                        <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertCircle size={10} /> متأخرة
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-foreground">{task.title}</p>
                    {task.sub_task && <p className="text-sm text-muted-foreground mt-0.5">{task.sub_task}</p>}

                    <div className="flex items-center gap-4 mt-2">
                      {task.due_date && (
                        <span className={cn("text-xs flex items-center gap-1", overdueTask ? "text-red-600" : "text-muted-foreground")}>
                          <CalendarCheck size={12} />
                          {formatDateShort(task.due_date)}
                        </span>
                      )}
                      {(task.progress ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-muted rounded-full">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${task.progress}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{task.progress}%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {task.status !== "Done" && task.status !== "Cancelled" && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => handleMarkDone(task.id, e)}
                        disabled={markDoneMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs rounded-lg hover:bg-green-100 transition-colors font-medium disabled:opacity-60"
                      >
                        <CheckCircle2 size={13} />
                        أنجزت
                      </button>
                      <button
                        onClick={(e) => handleNeedHelp(task, e)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs rounded-lg hover:bg-amber-100 transition-colors font-medium"
                      >
                        <AlertCircle size={13} />
                        أحتاج مساعدة
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          profiles={profiles}
          onClose={() => setSelectedTaskId(null)}
          myTasksOwnerId={currentUser.id}
        />
      )}
    </>
  );
}
