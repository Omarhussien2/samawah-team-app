"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDateShort, getAlertLevelColor, getAvatarUrl, cn } from "@/lib/utils";
import { formatHours, getTaskHourSummary } from "@/lib/tasks/hours";
import { getTaskDateDuration } from "@/lib/tasks/duration";
import { CalendarDays, AlertTriangle, CheckSquare } from "lucide-react";
import Image from "next/image";
import { TaskTitleStack } from "@/components/tasks/task-title-stack";
import type { Profile, Task } from "@/lib/supabase/types";

interface Props {
  task: Task & { 
    owner?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
    project?: { id: string; name: string } | null;
  };
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

  // Determine due date color
  const today = new Date().toISOString().split("T")[0];
  let dueDateColor = "text-slate-500 bg-slate-100";
  if (task.due_date) {
    if (task.due_date < today) dueDateColor = "text-red-600 bg-red-50 border-red-100";
    else if (task.due_date === today) dueDateColor = "text-amber-600 bg-amber-50 border-amber-100";
    else dueDateColor = "text-emerald-600 bg-emerald-50 border-emerald-100";
  }

  // Priority Dot
  const priorityColors = {
    low: "bg-slate-400",
    medium: "bg-blue-500",
    high: "bg-orange-500",
    critical: "bg-red-500",
  };
  const priorityColor = priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.medium;
  const hourSummary = getTaskHourSummary({
    plannedHours: task.planned_hours,
    actualHours: task.actual_hours,
  });
  const dateDuration = getTaskDateDuration({
    startDate: task.start_date,
    endDate: task.due_date,
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onTaskClick(task)}
      className={cn(
        "group bg-white rounded-xl border border-slate-200 p-3 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all",
        isDragging && "shadow-2xl rotate-2 ring-2 ring-indigo-500 border-transparent z-50",
        task.status === "Done" && "opacity-75 bg-slate-50"
      )}
    >
      {/* Top Header: Project Badge & Priority */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {task.project && (
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
              {task.project.name}
            </span>
          )}
          {task.alert_level && task.alert_level !== "Low" && (
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-0.5", getAlertLevelColor(task.alert_level))}>
              <AlertTriangle size={10} />
              {task.alert_level}
            </span>
          )}
        </div>
      </div>

      <TaskTitleStack
        title={task.title}
        subTask={task.sub_task}
        category={task.category}
        done={task.status === "Done"}
        className="mb-2"
        primaryClassName="text-sm text-slate-800"
        secondaryClassName="text-[11px] text-slate-500"
      />

      {/* Progress Bar (Thin) */}
      {(task.progress ?? 0) > 0 && task.status !== "Done" && (
        <div className="mb-3 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${task.progress}%` }} />
        </div>
      )}

      {(hourSummary.hasPlan || hourSummary.actual > 0) && (
        <div
          className={cn(
            "mb-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold",
            hourSummary.isOverPlan ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"
          )}
        >
          {formatHours(hourSummary.actual)} / {hourSummary.hasPlan ? formatHours(hourSummary.planned) : "بدون مخطط"} س
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
        
        {/* Left side: Avatar & Priority Dot */}
        <div className="flex items-center gap-2">
          {task.owner ? (
            <Image
              src={task.owner.avatar_url ?? getAvatarUrl(task.owner.full_name)} 
              width={24} height={24}
              alt={task.owner.full_name ?? ""}
              title={task.owner.full_name ?? ""}
              className="w-6 h-6 rounded-full border-2 border-white shadow-sm object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full border-2 border-white border-dashed bg-slate-100 flex items-center justify-center">
              <span className="text-[10px] text-slate-400">?</span>
            </div>
          )}
          <div className={cn("w-2 h-2 rounded-full", priorityColor)} title={`الأولوية: ${task.priority}`} />
        </div>

        {/* Right side: Indicators */}
        <div className="flex items-center gap-2">
          {/* Due Date */}
          {task.due_date && (
            <div className={cn("flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border", dueDateColor)}>
              <CalendarDays size={11} />
              <span>{formatDateShort(task.due_date)}</span>
            </div>
          )}
          {dateDuration.hasBothDates && (
            <div
              className={cn(
                "rounded border px-1.5 py-0.5 text-[11px] font-medium",
                dateDuration.isValidRange ? "bg-indigo-50 text-indigo-600 border-indigo-100" : "bg-red-50 text-red-600 border-red-100"
              )}
            >
              {dateDuration.isValidRange ? dateDuration.label : "راجع التواريخ"}
            </div>
          )}
          
          {/* Subtasks / Comments (Mocked or real if we add to query later) */}
          <div className="flex items-center gap-2 text-slate-400">
            {task.sub_task && (
              <div className="flex items-center gap-0.5 text-[11px]">
                <CheckSquare size={12} />
              </div>
            )}
            {/* If we had comment counts: 
            <div className="flex items-center gap-0.5 text-[11px]">
              <MessageSquare size={12} />
              <span>3</span>
            </div> 
            */}
          </div>
        </div>
      </div>
    </div>
  );
}
