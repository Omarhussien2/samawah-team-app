"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Plus, Search, FolderKanban, Clock, X } from "lucide-react";
import { ProjectCard } from "./project-card";
import { ProjectRow } from "./project-row";
import { CreateProjectModal } from "./create-project-modal";
import { PROJECT_TYPE_OPTIONS, getProjectStatusLabel, getProjectType, getProjectTypeLabel } from "@/lib/utils";
import {
  PROJECTS_FILTER_STORAGE_KEY,
  PROJECT_STATUSES,
  coerceProjectFiltersSnapshot,
  hasProjectFilterParams,
  isDefaultProjectFilters,
  projectFiltersToParams,
  readProjectFiltersFromParams,
  type ProjectFilters,
  type ProjectView,
} from "@/lib/projects/project-filters";
import { createSearchMatcher } from "@/lib/utils/search";
import type { Profile, Project, ProjectTemplate, ProjectType } from "@/lib/supabase/types";

interface Props {
  projects: (Project & { manager?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null })[];
  profiles: Pick<Profile, "id" | "full_name" | "email" | "avatar_url">[];
  templates: (ProjectTemplate & { task_templates: { id: string; title: string }[] })[];
  currentUser: Profile;
}

function readStoredProjectFilters(): ProjectFilters | null {
  try {
    const stored = window.localStorage.getItem(PROJECTS_FILTER_STORAGE_KEY);
    if (!stored) return null;
    return coerceProjectFiltersSnapshot(JSON.parse(stored));
  } catch {
    return null;
  }
}

export function ProjectsClient({ projects, profiles, templates, currentUser }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [view, setView] = useState<ProjectView>("card");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<ProjectFilters["status"]>("");
  const [filterType, setFilterType] = useState<ProjectType | "">("");
  const [filterManager, setFilterManager] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const canCreateProject = currentUser.role === "admin" || currentUser.role === "project_manager";
  const activeFilters: ProjectFilters = useMemo(
    () => ({
      search,
      status: filterStatus,
      type: filterType,
      manager: filterManager,
      view,
    }),
    [search, filterStatus, filterType, filterManager, view]
  );
  const projectsListHref = useMemo(() => {
    const params = projectFiltersToParams(activeFilters);
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }, [activeFilters, pathname]);

  useEffect(() => {
    const nextFilters = hasProjectFilterParams(searchParams)
      ? readProjectFiltersFromParams(searchParams)
      : readStoredProjectFilters();

    if (nextFilters) {
      setSearch(nextFilters.search);
      setFilterStatus(nextFilters.status);
      setFilterType(nextFilters.type);
      setFilterManager(nextFilters.manager);
      setView(nextFilters.view);

      if (!hasProjectFilterParams(searchParams)) {
        const params = projectFiltersToParams(nextFilters);
        const query = params.toString();
        if (query) router.replace(`${pathname}?${query}`, { scroll: false });
      }
    }

    setFiltersLoaded(true);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!filtersLoaded) return;

    if (isDefaultProjectFilters(activeFilters)) {
      window.localStorage.removeItem(PROJECTS_FILTER_STORAGE_KEY);
    } else {
      window.localStorage.setItem(PROJECTS_FILTER_STORAGE_KEY, JSON.stringify(activeFilters));
    }

    const nextQuery = projectFiltersToParams(activeFilters).toString();
    if (nextQuery !== searchParams.toString()) {
      router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`, { scroll: false });
    }
  }, [activeFilters, filtersLoaded, pathname, router, searchParams]);

  const getProjectHref = (projectId: string) =>
    `/projects/${projectId}?returnTo=${encodeURIComponent(projectsListHref)}`;

  const filtered = useMemo(() => {
    const matchesSearch = createSearchMatcher(search);

    return projects.filter((p) => {
      if (
        !matchesSearch([
          p.name,
          p.manager?.full_name,
          p.manager_name,
          p.path,
          p.current_stage,
          p.description,
          p.status,
          getProjectStatusLabel(p.status),
          getProjectTypeLabel(getProjectType(p)),
        ])
      ) {
        return false;
      }
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterType && getProjectType(p) !== filterType) return false;
      if (filterManager && p.manager_id !== filterManager) return false;
      return true;
    });
  }, [projects, search, filterStatus, filterType, filterManager]);

  const managers = useMemo(() => {
    const ids = new Set(projects.map((p) => p.manager_id).filter(Boolean));
    return profiles.filter((p) => ids.has(p.id));
  }, [projects, profiles]);

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
            <FolderKanban size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading text-slate-900 tracking-tight">المشاريع</h1>
            <p className="text-slate-500 text-sm font-medium mt-0.5">{filtered.length} مشروع متاح</p>
          </div>
        </div>
        {canCreateProject && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium text-sm transition-colors shadow-sm active:scale-95"
          >
            <Plus size={18} />
            مشروع جديد
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-8 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="البحث في المشاريع..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-9 py-2 text-sm bg-slate-50 border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all placeholder:text-slate-400"
          />
          {search && (
            <button
              type="button"
              aria-label="مسح البحث"
              onClick={() => setSearch("")}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as ProjectFilters["status"])}
          className="px-3 py-2 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white cursor-pointer hover:border-slate-300 transition-colors"
        >
          <option value="">كل الحالات</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>{getProjectStatusLabel(s)}</option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as ProjectType | "")}
          className="px-3 py-2 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white cursor-pointer hover:border-slate-300 transition-colors"
        >
          <option value="">كل أنواع المشاريع</option>
          {PROJECT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select
          value={filterManager}
          onChange={(e) => setFilterManager(e.target.value)}
          className="px-3 py-2 text-sm font-medium border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white cursor-pointer hover:border-slate-300 transition-colors"
        >
          <option value="">كل المديرين</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>{m.full_name}</option>
          ))}
        </select>

        <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />

        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
          <button
            onClick={() => setView("card")}
            className={`p-1.5 rounded-lg transition-colors ${view === "card" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            title="عرض كبطاقات"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setView("list")}
            className={`p-1.5 rounded-lg transition-colors ${view === "list" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            title="عرض كقائمة"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setView("timeline")}
            className={`p-1.5 rounded-lg transition-colors ${view === "timeline" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            title="الخط الزمني (قيد التطوير)"
          >
            <Clock size={16} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center bg-white rounded-3xl border border-slate-200 shadow-sm border-dashed">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <FolderKanban size={32} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">لا توجد مشاريع</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              {canCreateProject
                ? "لم يتم العثور على مشاريع مطابقة للبحث أو الفلتر، يمكنك إنشاء مشروع جديد."
                : "لا توجد مشاريع ظاهرة لك حاليا. ستظهر هنا المشاريع التي تديرها أو تشارك فيها."}
            </p>
          </div>
        ) : view === "card" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((project) => (
              <ProjectCard key={project.id} project={project} href={getProjectHref(project.id)} />
            ))}
          </div>
        ) : view === "list" ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-600">المشروع</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 hidden md:table-cell">المدير</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 hidden lg:table-cell">المرحلة</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">الحالة</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">الإنجاز</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 hidden lg:table-cell">تاريخ الانتهاء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((project) => (
                  <ProjectRow key={project.id} project={project} href={getProjectHref(project.id)} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-slate-500 font-medium">عرض الخط الزمني (Gantt) قيد التطوير</p>
          </div>
        )}
      </div>

      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        profiles={profiles}
        currentUser={currentUser}
        templates={templates}
      />
    </div>
  );
}
