"use client";

import { useState, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { TaskModal } from "@/components/tasks/task-modal";
import { QuickAddTaskModal } from "@/components/tasks/quick-add-task-modal";
import { TasksTimelineChart } from "@/components/tasks/tasks-timeline-chart";
import { useTasksSubscription } from "@/lib/supabase/realtime";
import {
  applyTaskListChange,
  applyTaskToTaskQueries,
  fetchTasks,
  taskKeys,
  updateTask,
  type TaskWithRelations,
} from "@/lib/queries/tasks";
import { Search, Filter, LayoutGrid, List, Calendar, Plus, X } from "lucide-react";
import { recalcProjectProgress } from "@/lib/utils/recalc-progress";
import { PROJECT_TYPE_OPTIONS, getPriorityLabel, getProjectTypeLabel, getStatusLabel } from "@/lib/utils";
import { createSearchMatcher } from "@/lib/utils/search";
import type { Profile, Task } from "@/lib/supabase/types";

export const COLUMNS = [
  { id: "Backlog",     label: "متراكم",           color: "bg-slate-400" },
  { id: "To Do",       label: "يُنتظر",            color: "bg-blue-500" },
  { id: "In Progress", label: "جاري العمل",       color: "bg-orange-500", limit: 5 },
  { id: "Review",      label: "تحت المراجعة",      color: "bg-purple-500" },
  { id: "Done",        label: "مخلّص",             color: "bg-emerald-500" },
];

interface Props {
  tasks: TaskWithRelations[];
  projectId: string;
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
}

export function KanbanBoard({ tasks: initialTasks, projectId, profiles }: Props) {
  const queryClient = useQueryClient();
  const taskQueryKey = useMemo(() => (projectId ? taskKeys.byProject(projectId) : taskKeys.list()), [projectId]);
  const { data: tasks = initialTasks } = useQuery({
    queryKey: taskQueryKey,
    queryFn: () => fetchTasks({ projectId: projectId || null }),
    initialData: initialTasks,
  });
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectTypeFilter, setProjectTypeFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"board" | "list" | "calendar">("board");

  const activeTask = useMemo(
    () => tasks.find((task) => task.id === activeTaskId) ?? null,
    [tasks, activeTaskId]
  );
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // --- Realtime Subscription ---
  const handleTaskChange = useCallback(
    (payload: { eventType: string; task: Record<string, unknown> }) => {
      const changedTask = payload.task as unknown as TaskWithRelations;

      applyTaskListChange(queryClient, taskQueryKey, payload.eventType, changedTask, {
        projectId: projectId || null,
      });
      queryClient.invalidateQueries({ queryKey: taskQueryKey });

      if (payload.eventType === "DELETE" && selectedTaskId === changedTask.id) {
        setSelectedTaskId(null);
      }
    },
    [queryClient, taskQueryKey, projectId, selectedTaskId]
  );

  useTasksSubscription(projectId || null, handleTaskChange);

  const moveTaskMutation = useMutation({
    mutationFn: ({ task, targetColumn }: { task: TaskWithRelations; targetColumn: Task["status"] }) =>
      updateTask(task.id, {
        board_column: targetColumn,
        status: targetColumn,
        ...(targetColumn === "Done" ? { progress: 100 } : {}),
      }),
    onSuccess: (updatedTask) => {
      applyTaskToTaskQueries(queryClient, updatedTask);
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      recalcProjectProgress(updatedTask.project_id);
    },
    onError: () => {
      toast.error("ما نجح تحديث حالة المهمة");
    },
  });

  const handleTaskCreated = useCallback(
    (task: TaskWithRelations) => {
      applyTaskListChange(queryClient, taskQueryKey, "INSERT", task, { projectId: projectId || null });
      queryClient.invalidateQueries({ queryKey: taskQueryKey });
    },
    [queryClient, taskQueryKey, projectId]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTaskId(task?.id ?? null);
  }, [tasks]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTaskId(null);
    if (!over) return;

    const draggedTask = tasks.find((t) => t.id === active.id);
    if (!draggedTask) return;

    // Determine target column
    let targetColumn = over.id as string;
    if (!COLUMNS.find((c) => c.id === targetColumn)) {
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) targetColumn = overTask.board_column;
    }

    if (draggedTask.board_column === targetColumn) return;

    const oldStatus = draggedTask.status;
    const newStatus = targetColumn as Task["status"];

    try {
      await moveTaskMutation.mutateAsync({ task: draggedTask, targetColumn: newStatus });
      try {
        await fetch("/api/task-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_id: draggedTask.id,
            task_title: draggedTask.title,
            project_id: draggedTask.project_id,
            old_status: oldStatus,
            new_status: newStatus,
          }),
        });
      } catch {}
    } catch {}
  }, [tasks, moveTaskMutation]);

  // Filtering
  const filteredTasks = useMemo(() => {
    const matchesSearch = createSearchMatcher(searchQuery);

    return tasks.filter((task) =>
      (projectTypeFilter === "all" || task.project?.project_type === projectTypeFilter) &&
      matchesSearch([
        task.title,
        task.sub_task,
        task.project?.name,
        getProjectTypeLabel(task.project?.project_type),
        task.owner?.full_name,
        task.owner_name,
        task.category,
        task.status,
        getStatusLabel(task.status),
        task.priority,
        getPriorityLabel(task.priority),
        task.alert_level,
        task.alert_message,
      ])
    );
  }, [projectTypeFilter, tasks, searchQuery]);

  const tasksByColumn = COLUMNS.reduce<Record<string, typeof tasks>>((acc, col) => {
    acc[col.id] = filteredTasks.filter((t) => t.board_column === col.id);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      {/* Board Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
               placeholder="ابحث في المهام..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="مسح البحث"
                onClick={() => setSearchQuery("")}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {!projectId && (
            <select
              value={projectTypeFilter}
              onChange={(event) => setProjectTypeFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">كل أنواع المشاريع</option>
              {PROJECT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          )}
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-medium">
            <Filter size={16} className="text-slate-500" /> فلترة
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
            <button onClick={() => setViewMode("board")} className={`p-1.5 rounded-md transition-colors ${viewMode === "board" ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-100"}`} title="لوحة Kanban">
              <LayoutGrid size={16} />
            </button>
            <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-100"}`} title="قائمة المهام">
              <List size={16} />
            </button>
            <button onClick={() => setViewMode("calendar")} className={`p-1.5 rounded-md transition-colors ${viewMode === "calendar" ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-100"}`} title="التقويم">
              <Calendar size={16} />
            </button>
          </div>
          <button
            onClick={() => setShowQuickAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm hover:shadow active:scale-95"
          >
            <Plus size={16} /> مهمة جديدة
          </button>
        </div>
      </div>

      {/* Kanban Board Area */}
      {viewMode === "board" ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 flex gap-5 overflow-x-auto pb-6 px-1">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                tasks={tasksByColumn[col.id]}
                onTaskClick={(task) => setSelectedTaskId(task.id)}
                projectId={projectId}
                profiles={profiles}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask && (
              <KanbanCard task={activeTask} onTaskClick={() => {}} isDragging />
            )}
          </DragOverlay>
        </DndContext>
      ) : viewMode === "calendar" ? (
        <TasksTimelineChart tasks={filteredTasks} profiles={profiles} />
      ) : (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center text-slate-500">
           <p>عرض ({viewMode}) قيد التطوير...</p>
        </div>
      )}

      {/* Modals */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          profiles={profiles}
          onClose={() => setSelectedTaskId(null)}
          onTaskDeleted={() => setSelectedTaskId(null)}
        />
      )}
      <QuickAddTaskModal
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        defaultProjectId={projectId || undefined}
        onTaskCreated={handleTaskCreated}
      />
    </div>
  );
}
