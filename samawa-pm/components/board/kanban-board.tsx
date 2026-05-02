"use client";

import { useState, useCallback } from "react";
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
import type { Profile, Task } from "@/lib/supabase/types";

export const COLUMNS = [
  { id: "Backlog",     label: "الأعمال المتراكمة", color: "bg-purple-100 text-purple-700" },
  { id: "To Do",       label: "قيد الانتظار",      color: "bg-gray-100 text-gray-600" },
  { id: "In Progress", label: "قيد التنفيذ",       color: "bg-blue-100 text-blue-700" },
  { id: "Review",      label: "تحت المراجعة",      color: "bg-amber-100 text-amber-700" },
  { id: "Done",        label: "مكتمل",             color: "bg-green-100 text-green-700" },
  { id: "Cancelled",   label: "ملغي",              color: "bg-gray-100 text-gray-400" },
];

interface Props {
  tasks: (Task & { owner?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null })[];
  projectId: string;
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
}

export function KanbanBoard({ tasks: initialTasks, projectId, profiles }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [activeTask, setActiveTask] = useState<typeof initialTasks[0] | null>(null);
  const [selectedTask, setSelectedTask] = useState<typeof initialTasks[0] | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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

    // Determine the target column
    let targetColumn = over.id as string;
    if (!COLUMNS.find((c) => c.id === targetColumn)) {
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) targetColumn = overTask.board_column;
    }

    if (draggedTask.board_column === targetColumn) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === draggedTask.id
          ? { ...t, board_column: targetColumn, status: targetColumn as Task["status"] }
          : t
      )
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("tasks")
      .update({ board_column: targetColumn, status: targetColumn as Task["status"] })
      .eq("id", draggedTask.id);

    if (error) {
      toast.error("فشل تحديث حالة المهمة");
      setTasks(initialTasks);
    } else {
      router.refresh();
    }
  }, [tasks, initialTasks, router]);

  const tasksByColumn = COLUMNS.reduce<Record<string, typeof tasks>>((acc, col) => {
    acc[col.id] = tasks.filter((t) => t.board_column === col.id);
    return acc;
  }, {});

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
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

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          profiles={profiles}
          onClose={() => {
            setSelectedTask(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
