"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { TaskModal } from "@/components/tasks/task-modal";
import { QuickAddTaskModal } from "@/components/tasks/quick-add-task-modal";
import { useTasksSubscription } from "@/lib/supabase/realtime";
import { Search, Filter, LayoutGrid, List, Calendar, Plus } from "lucide-react";
import { recalcProjectProgress } from "@/lib/utils/recalc-progress";
import type { Profile, Task } from "@/lib/supabase/types";

export const COLUMNS = [
  { id: "Backlog",     label: "متراكم",           color: "bg-slate-400" },
  { id: "To Do",       label: "يُنتظر",            color: "bg-blue-500" },
  { id: "In Progress", label: "جاري العمل",       color: "bg-orange-500", limit: 5 },
  { id: "Review",      label: "تحت المراجعة",      color: "bg-purple-500" },
  { id: "Done",        label: "مخلّص",             color: "bg-emerald-500" },
];

interface Props {
  tasks: (Task & { 
    owner?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
    project?: { id: string; name: string } | null;
  })[];
  projectId: string;
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
}

export function KanbanBoard({ tasks: initialTasks, projectId, profiles }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [activeTask, setActiveTask] = useState<typeof initialTasks[0] | null>(null);
  const [selectedTask, setSelectedTask] = useState<typeof initialTasks[0] | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"board" | "list" | "calendar">("board");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // --- Realtime Subscription ---
  const handleTaskChange = useCallback(
    (payload: { eventType: string; task: Record<string, unknown> }) => {
      const { eventType, task: changedTask } = payload;
      const taskId = changedTask.id as string;

      if (eventType === "INSERT") {
        setTasks((prev) => {
          if (prev.some((t) => t.id === taskId)) return prev;
          return [...prev, changedTask as unknown as typeof initialTasks[0]];
        });
      } else if (eventType === "UPDATE") {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, ...changedTask } as typeof initialTasks[0] : t
          )
        );
      } else if (eventType === "DELETE") {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      }
    },
    [initialTasks]
  );

  useTasksSubscription(projectId || null, handleTaskChange);

  const handleTaskSaved = useCallback((updatedTask: Task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t))
    );
    setSelectedTask((prev) => (prev?.id === updatedTask.id ? { ...prev, ...updatedTask } : prev));
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }, [tasks]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
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

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === draggedTask.id
          ? { ...t, board_column: targetColumn, status: targetColumn as Task["status"] }
          : t
      )
    );

    const supabase = createClient();
    const doneFix = targetColumn === "Done" ? { progress: 100 } : {};
    const { error } = await supabase
      .from("tasks")
      .update({ board_column: targetColumn, status: targetColumn as Task["status"], ...doneFix })
      .eq("id", draggedTask.id);

    if (error) {
      toast.error("ما نجح تحديث حالة المهمة");
      setTasks(initialTasks);
    } else {
      recalcProjectProgress(draggedTask.project_id);
      try {
        await fetch("/api/task-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_id: draggedTask.id,
            task_title: draggedTask.title,
            project_id: draggedTask.project_id,
            old_status: oldStatus,
            new_status: targetColumn,
          }),
        });
      } catch {}
      router.refresh();
    }
  }, [tasks, initialTasks, router]);

  // Filtering
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => 
      !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.project?.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tasks, searchQuery]);

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
              className="pl-3 pr-9 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-64 shadow-sm"
            />
          </div>
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
                onTaskClick={setSelectedTask}
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
          onClose={() => {
            setSelectedTask(null);
            router.refresh();
          }}
          onTaskSaved={handleTaskSaved}
        />
      )}
      <QuickAddTaskModal open={showQuickAdd} onClose={() => setShowQuickAdd(false)} />
    </div>
  );
}
