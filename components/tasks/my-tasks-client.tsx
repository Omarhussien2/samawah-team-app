"use client";

import { useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Clock, CalendarCheck, List } from "lucide-react";
import { formatDateShort, getStatusColor, getStatusLabel, isOverdue, isDueToday, cn } from "@/lib/utils";
import { TaskModal } from "./task-modal";
import { useRealtimeSubscription } from "@/lib/supabase/realtime";
import type { Profile, Task } from "@/lib/supabase/types";

type Filter = "all" | "today" | "week" | "overdue" | "done";

interface Props {
  tasks: (Task & {
    project?: { id: string; name: string } | null;
    owner?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
  })[];
  currentUser: Profile;
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
}

const FILTERS: { key: Filter; label: string; icon: React.ElementType }[] = [
  { key: "all",     label: "الكل",       icon: List },
  { key: "today",   label: "اليوم",      icon: CalendarCheck },
  { key: "week",    label: "هذا الأسبوع", icon: Clock },
  { key: "overdue", label: "المتأخرة",   icon: AlertCircle },
  { key: "done",    label: "المكتملة",   icon: CheckCircle2 },
];

export function MyTasksClient({ tasks: initialTasks, currentUser: _currentUser, profiles }: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedTask, setSelectedTask] = useState<typeof initialTasks[0] | null>(null);

  // --- Realtime: live updates for user's tasks ---
  const handleTaskChange = useCallback(
    (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
      if (payload.eventType === "UPDATE") {
        const updated = payload.new as unknown as Task;
        setTasks((prev) =>
          prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
        );
      } else if (payload.eventType === "DELETE") {
        const deleted = payload.old as unknown as Task;
        setTasks((prev) => prev.filter((t) => t.id !== deleted.id));
      } else if (payload.eventType === "INSERT") {
        const inserted = payload.new as unknown as typeof initialTasks[0];
        setTasks((prev) => {
          if (prev.some((t) => t.id === inserted.id)) return prev;
          return [...prev, inserted];
        });
      }
    },
    [initialTasks]
  );
  useRealtimeSubscription("tasks", `owner_id=eq.${_currentUser.id}`, handleTaskChange);

  const weekEnd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }, []);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === "today") return t.due_date && isDueToday(t.due_date) && !["Done","Cancelled"].includes(t.status);
      if (filter === "week") return t.due_date && new Date(t.due_date) <= weekEnd && !["Done","Cancelled"].includes(t.status);
      if (filter === "overdue") return isOverdue(t.due_date, t.status);
      if (filter === "done") return t.status === "Done";
      return true;
    });
  }, [tasks, filter, weekEnd]);

  const counts = useMemo(() => ({
    all: tasks.length,
    today: tasks.filter((t) => t.due_date && isDueToday(t.due_date) && !["Done","Cancelled"].includes(t.status)).length,
    week: tasks.filter((t) => t.due_date && new Date(t.due_date) <= weekEnd && !["Done","Cancelled"].includes(t.status)).length,
    overdue: tasks.filter((t) => isOverdue(t.due_date, t.status)).length,
    done: tasks.filter((t) => t.status === "Done").length,
  }), [tasks, weekEnd]);

  const handleMarkDone = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const supabase = createClient();
    const { error } = await supabase.from("tasks").update({ status: "Done", board_column: "Done", progress: 100 }).eq("id", taskId);
    if (error) toast.error("فشل التحديث");
    else {
      toast.success("تم إنجاز المهمة! 🎉");
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: "Done" as const, board_column: "Done", progress: 100 } : t));
    }
  };

  const handleNeedHelp = async (task: typeof initialTasks[0], e: React.MouseEvent) => {
    e.stopPropagation();
    const supabase = createClient();
    const { error } = await supabase.from("challenges").insert({
      project_id: task.project_id,
      task_id: task.id,
      title: `أحتاج مساعدة: ${task.title}`,
      status: "open",
      owner_id: _currentUser?.id ?? "",
    });
    if (error) toast.error("فشل إنشاء التحدي");
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

      {/* Filter Tabs */}
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
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center",
              filter === key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
            )}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Tasks List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="text-5xl mb-4">✅</div>
          <p className="font-medium">لا توجد مهام في هذه الفئة</p>
          <p className="text-sm mt-1">أحسنت! استمر في العمل</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => {
            const overdueTask = isOverdue(task.due_date, task.status);
            return (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
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

                  {/* Action Buttons */}
                  {task.status !== "Done" && task.status !== "Cancelled" && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => handleMarkDone(task.id, e)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs rounded-lg hover:bg-green-100 transition-colors font-medium"
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
        <TaskModal task={selectedTask} profiles={profiles} onClose={() => setSelectedTask(null)} />
      )}
    </>
  );
}
