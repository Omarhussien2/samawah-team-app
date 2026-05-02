"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanCard } from "./kanban-card";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile, Task } from "@/lib/supabase/types";

interface ColumnDef {
  id: string;
  label: string;
  color: string;
}

interface Props {
  column: ColumnDef;
  tasks: (Task & { owner?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null })[];
  onTaskClick: (task: Props["tasks"][0]) => void;
  projectId: string;
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
}

export function KanbanColumn({ column, tasks, onTaskClick, projectId }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex-shrink-0 w-72">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", column.color)}>
            {column.label}
          </span>
          <span className="text-xs text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[400px] rounded-xl p-2 transition-colors space-y-2",
          isOver ? "bg-primary/5 border-2 border-primary/30 border-dashed" : "bg-muted/30"
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} onTaskClick={onTaskClick} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">
            اسحب المهام هنا
          </div>
        )}
      </div>
    </div>
  );
}
