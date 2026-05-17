"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  formatDateShort,
  getStatusLabel,
  getStatusColor,
  getPriorityColor,
  getPriorityLabel,
  getAlertLevelColor,
  cn,
} from "@/lib/utils";
import { createSearchMatcher } from "@/lib/utils/search";
import { TaskModal } from "./task-modal";
import { fetchTasks, taskKeys, type TaskWithRelations } from "@/lib/queries/tasks";
import {
  Search,
  Filter,
  X,
  Calendar,
  User,
  FolderKanban,
  ChevronDown,
} from "lucide-react";
import type { Profile } from "@/lib/supabase/types";

interface Props {
  tasks: TaskWithRelations[];
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  projects?: { id: string; name: string }[];
  projectId?: string;
}

export function TasksTable({
  tasks: initialTasks,
  profiles,
  projects,
  projectId,
}: Props) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const taskQueryKey = useMemo(() => (projectId ? taskKeys.byProject(projectId) : taskKeys.list()), [projectId]);
  const { data: tasks = initialTasks } = useQuery({
    queryKey: taskQueryKey,
    queryFn: () => fetchTasks({ projectId }),
    initialData: initialTasks,
  });

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  const activeFilterCount = [
    filterStatus,
    filterOwner,
    filterProject,
    filterPriority,
    dateFrom,
    dateTo,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterStatus("");
    setFilterOwner("");
    setFilterProject("");
    setFilterPriority("");
    setDateFrom("");
    setDateTo("");
  };

  const uniqueProjects = useMemo(() => {
    if (projects) return projects;
    const map = new Map<string, string>();
    tasks.forEach((t) => {
      if (t.project?.id && t.project?.name) map.set(t.project.id, t.project.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks, projects]);

  const filtered = useMemo(() => {
    const matchesSearch = createSearchMatcher(search);

    return tasks.filter((t) => {
      if (
        !matchesSearch([
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
        ])
      )
        return false;
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterOwner && t.owner_id !== filterOwner) return false;
      if (filterProject && t.project_id !== filterProject) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (dateFrom && t.due_date && t.due_date < dateFrom) return false;
      if (dateTo && t.due_date && t.due_date > dateTo) return false;
      return true;
    });
  }, [tasks, search, filterStatus, filterOwner, filterProject, filterPriority, dateFrom, dateTo]);

  return (
    <>
      <div>
        <div className="flex gap-3 mb-3">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
               placeholder="ابحث في المهام..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-9 pl-9 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
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

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
          >
            <option value="">كل الحالات</option>
            {[
              "Backlog",
              "To Do",
              "In Progress",
              "Review",
              "Done",
              "Cancelled",
            ].map((s) => (
              <option key={s} value={s}>
                {getStatusLabel(s)}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors",
              showFilters || activeFilterCount > 0
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:bg-accent"
            )}
          >
            <Filter size={15} />
            فلاتر
            {activeFilterCount > 0 && (
              <span className="bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              size={14}
              className={cn(
                "transition-transform",
                showFilters && "rotate-180"
              )}
            />
          </button>
        </div>

        {showFilters && (
          <div className="bg-white border border-border rounded-xl p-4 mb-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Filter size={14} />
                فلاتر متقدمة
              </h3>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
                >
                  <X size={12} />
                  مسح الكل ({activeFilterCount})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <User size={12} /> المسؤول
                </label>
                <select
                  value={filterOwner}
                  onChange={(e) => setFilterOwner(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                >
                  <option value="">كل المسؤولين</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name ?? p.id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <FolderKanban size={12} /> المشروع
                </label>
                <select
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                >
                  <option value="">كل المشاريع</option>
                  {uniqueProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  الأولوية
                </label>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                >
                  <option value="">كل الأولويات</option>
                  {["critical", "high", "medium", "low"].map((p) => (
                    <option key={p} value={p}>
                      {getPriorityLabel(p)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Calendar size={12} /> تاريخ الاستحقاق
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="flex-1 px-2 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="من"
                  />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="flex-1 px-2 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="إلى"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
              <span>
                يعرض {filtered.length} من {tasks.length} مهمة
              </span>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-red-600 hover:text-red-800 font-medium"
                >
                  إعادة تعيين
                </button>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                  المهمة
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                  الحالة
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                  المسؤول
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                  الإنجاز
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                  الاستحقاق
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">
                  الأولوية
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-10 text-muted-foreground"
                  >
                    ما فيه مهام مطابقة للفلاتر
                  </td>
                </tr>
              ) : (
                filtered.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground line-clamp-1">
                        {task.title}
                      </p>
                      {task.sub_task && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {task.sub_task}
                        </p>
                      )}
                      {task.alert_level && task.alert_level !== "Low" && (
                        <span
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded-full mt-1 inline-block",
                            getAlertLevelColor(task.alert_level)
                          )}
                        >
                          {task.alert_level}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span
                        className={cn(
                          "text-xs px-2 py-1 rounded-full font-medium",
                          getStatusColor(task.status)
                        )}
                      >
                        {getStatusLabel(task.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {task.owner?.full_name ?? task.owner_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-muted rounded-full">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${task.progress ?? 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {task.progress ?? 0}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {formatDateShort(task.due_date)}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          getPriorityColor(task.priority)
                        )}
                      >
                        {getPriorityLabel(task.priority)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          profiles={profiles}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </>
  );
}
