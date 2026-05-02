"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDateShort, getAlertLevelColor, getPriorityColor, getAvatarUrl, cn } from "@/lib/utils";
import { CalendarDays, AlertTriangle } from "lucide-react";
import Image from "next/image";
import type { Profile, Task } from "@/lib/supabase/types";

interface Props {
  task: Task & { owner?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null };
  onTaskClick: (task: Props["task"]) => void;
  isDragging?: boolean;
}

export function KanbanCard({ task, onTaskClick, isDragging }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onTaskClick(task)}
      className={cn(
        "bg-white rounded-lg border border-border p-3 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all",
        isDragging && "shadow-xl rotate-2"
      )}
    >
      {/* Alert badge */}
      {task.alert_level && task.alert_level !== "Low" && (
        <div className={cn("text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 mb-2", getAlertLevelColor(task.alert_level))}>
          <AlertTriangle size={10} />
          {task.alert_level}
        </div>
      )}

      {/* Title */}
      <p className="text-sm font-medium text-foreground line-clamp-2 mb-1">{task.title}</p>
      {task.sub_task && (
        <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{task.sub_task}</p>
      )}

      {/* Progress */}
      {(task.progress ?? 0) > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-0.5">
            <span>الإنجاز</span>
            <span>{task.progress}%</span>
          </div>
          <div className="w-full h-1 bg-muted rounded-full">
            <div className="h-full bg-primary rounded-full" style={{ width: `${task.progress}%` }} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          {task.owner && (
            <Image
              src={task.owner.avatar_url ?? getAvatarUrl(task.owner.full_name)} width={24} height={24}
              alt={task.owner.full_name ?? ""}
              title={task.owner.full_name ?? ""}
              className="w-6 h-6 rounded-full border border-white shadow-sm object-cover"
            />
          )}
          {task.priority !== "medium" && (
            <span className={cn("text-xs px-1.5 py-0.5 rounded-full", getPriorityColor(task.priority))}>
              {task.priority === "high" ? "عالي" : task.priority === "critical" ? "حرج" : "منخفض"}
            </span>
          )}
        </div>
        {task.due_date && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays size={11} />
            <span>{formatDateShort(task.due_date)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
