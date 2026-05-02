"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatDateShort, getStatusLabel, getStatusColor, getPriorityColor, getPriorityLabel, getAlertLevelColor, cn } from "@/lib/utils";
import { TaskModal } from "./task-modal";
import { Search } from "lucide-react";
import type { Profile, Task } from "@/lib/supabase/types";

interface Props {
  tasks: (Task & { owner?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null })[];
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  projectId?: string;
}

export function TasksTable({ tasks: initialTasks, profiles, projectId: _projectId }: Props) {
  const router = useRouter();
  const [tasks] = useState(initialTasks);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedTask, setSelectedTask] = useState<typeof initialTasks[0] | null>(null);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      return true;
    });
  }, [tasks, search, filterStatus]);

  return (
    <>
      <div>
        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="البحث..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-9 pl-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
            <option value="">كل الحالات</option>
            {["Backlog","To Do","In Progress","Review","Done","Cancelled"].map((s) => (
              <option key={s} value={s}>{getStatusLabel(s)}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">المهمة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">الحالة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">المسؤول</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">الإنجاز</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">الاستحقاق</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">الأولوية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">لا توجد مهام</td></tr>
              ) : filtered.map((task) => (
                <tr key={task.id} className="hover:bg-accent/50 cursor-pointer transition-colors" onClick={() => setSelectedTask(task)}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground line-clamp-1">{task.title}</p>
                    {task.sub_task && <p className="text-xs text-muted-foreground line-clamp-1">{task.sub_task}</p>}
                    {task.alert_level && task.alert_level !== "Low" && (
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full mt-1 inline-block", getAlertLevelColor(task.alert_level))}>
                        {task.alert_level}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={cn("text-xs px-2 py-1 rounded-full font-medium", getStatusColor(task.status))}>
                      {getStatusLabel(task.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {task.owner?.full_name ?? task.owner_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-muted rounded-full">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${task.progress ?? 0}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{task.progress ?? 0}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {formatDateShort(task.due_date)}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", getPriorityColor(task.priority))}>
                      {getPriorityLabel(task.priority)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTask && (
        <TaskModal task={selectedTask} profiles={profiles} onClose={() => { setSelectedTask(null); router.refresh(); }} />
      )}
    </>
  );
}
