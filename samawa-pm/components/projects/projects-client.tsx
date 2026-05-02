"use client";

import { useState, useMemo } from "react";
import { LayoutGrid, List, Plus, Search, Filter } from "lucide-react";
import { ProjectCard } from "./project-card";
import { ProjectRow } from "./project-row";
import { CreateProjectModal } from "./create-project-modal";
import { getProjectStatusLabel } from "@/lib/utils";
import type { Profile, Project, ProjectTemplate } from "@/lib/supabase/types";

interface Props {
  projects: (Project & { manager?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null })[];
  profiles: Pick<Profile, "id" | "full_name" | "email" | "avatar_url">[];
  templates: (ProjectTemplate & { task_templates: { id: string; title: string }[] })[];
  currentUser: Profile;
}

const STATUSES = ["active", "paused", "completed", "cancelled"];

export function ProjectsClient({ projects, profiles, templates, currentUser }: Props) {
  const [view, setView] = useState<"card" | "list">("card");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterManager, setFilterManager] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterManager && p.manager_id !== filterManager) return false;
      return true;
    });
  }, [projects, search, filterStatus, filterManager]);

  const managers = useMemo(() => {
    const ids = new Set(projects.map((p) => p.manager_id).filter(Boolean));
    return profiles.filter((p) => ids.has(p.id));
  }, [projects, profiles]);

  return (
    <>
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">المشاريع</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} مشروع</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium text-sm"
        >
          <Plus size={16} />
          مشروع جديد
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="البحث بالاسم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
        >
          <option value="">كل الحالات</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{getProjectStatusLabel(s)}</option>
          ))}
        </select>

        <select
          value={filterManager}
          onChange={(e) => setFilterManager(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
        >
          <option value="">كل المديرين</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>{m.full_name}</option>
          ))}
        </select>

        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setView("card")}
            className={`p-2 transition-colors ${view === "card" ? "bg-primary text-white" : "bg-white text-muted-foreground hover:bg-accent"}`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setView("list")}
            className={`p-2 transition-colors ${view === "list" ? "bg-primary text-white" : "bg-white text-muted-foreground hover:bg-accent"}`}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="text-4xl mb-3">📋</div>
          <p className="font-medium">لا توجد مشاريع</p>
          <p className="text-sm mt-1">ابدأ بإنشاء مشروع جديد</p>
        </div>
      ) : view === "card" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">المشروع</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">المدير</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">المرحلة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الإنجاز</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">تاريخ الانتهاء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        profiles={profiles}
        templates={templates}
      />
    </>
  );
}
