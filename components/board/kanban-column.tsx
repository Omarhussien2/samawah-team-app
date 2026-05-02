"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanCard } from "./kanban-card";
import { cn } from "@/lib/utils";
import { Plus, MoreHorizontal, AlertCircle } from "lucide-react";
import type { Profile, Task } from "@/lib/supabase/types";

interface ColumnDef {
  id: string;
  label: string;
  color: string;
  limit?: number;
}

interface Props {
  column: ColumnDef;
  tasks: (Task & { 
    owner?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
    project?: { id: string; name: string } | null;
  })[];
  onTaskClick: (task: Props["tasks"][0]) => void;
  projectId: string;
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
}

export function KanbanColumn({ column, tasks, onTaskClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const isOverLimit = column.limit && tasks.length > column.limit;

  return (
    <div className="flex-shrink-0 w-80 flex flex-col h-full max-h-full">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className={cn("w-2.5 h-2.5 rounded-full", column.color)} />
          <h3 className="font-bold text-sm text-slate-800">{column.label}</h3>
          <span className="text-xs text-slate-500 font-medium bg-slate-200/60 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
          {isOverLimit && (
            <span className="text-[10px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded flex items-center gap-0.5" title="تم تجاوز الحد المسموح (WIP Limit)">
              <AlertCircle size={10} /> حد أقصى {column.limit}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 hover:opacity-100 transition-opacity">
          <button className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors">
            <Plus size={16} />
          </button>
          <button className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors">
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Drop Zone & Cards */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 bg-slate-100/60 rounded-2xl p-2 transition-colors space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 min-h-[150px]",
          isOver ? "bg-indigo-50/50 border-2 border-indigo-300 border-dashed" : "border-2 border-transparent"
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} onTaskClick={onTaskClick} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="h-20 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl m-2">
            اسحب المهام هنا
          </div>
        )}
        
        {/* Quick Add Button inline */}
        <button className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 w-full p-2 rounded-lg transition-colors font-medium">
          <Plus size={16} /> أضف مهمة
        </button>
      </div>
    </div>
  );
}
