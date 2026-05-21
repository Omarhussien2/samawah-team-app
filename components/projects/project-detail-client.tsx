"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Wallet, Target, Activity, Users, MoreHorizontal, Pencil, Trash2, Clock } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { formatDateShort, getProjectStatusLabel, cn, getAvatarUrl } from "@/lib/utils";
import { KanbanBoard } from "@/components/board/kanban-board";
import { TasksTable } from "@/components/tasks/tasks-table";
import { TasksTimelineChart } from "@/components/tasks/tasks-timeline-chart";
import { ChallengesList } from "@/components/challenges/challenges-list";
import { DocumentsList } from "@/components/documents/documents-list";
import { ProjectFormsTab } from "@/components/project-forms/project-forms-tab";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, X } from "lucide-react";
import { fetchTasks, taskKeys, type TaskWithRelations } from "@/lib/queries/tasks";
import { summarizeChallenges } from "@/lib/challenges/risk";
import { formatHours } from "@/lib/tasks/hours";
import type { Profile, Project, Challenge, Document, KpiDefinition } from "@/lib/supabase/types";

const TABS = [
  { key: "overview", label: "نظرة عامة" },
  { key: "tasks", label: "المهام" },
  { key: "timeline", label: "المخطط الزمني" },
  { key: "board", label: "اللوحة" },
  { key: "challenges", label: "التحديات" },
  { key: "forms", label: "نماذج المشروع" },
  { key: "documents", label: "المستندات" },
  { key: "members", label: "الأعضاء" },
];

const editSchema = z.object({
  name: z.string().min(1, "اسم المشروع مطلوب"),
  status: z.enum(["active", "paused", "completed", "cancelled"]),
  current_stage: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  total_budget: z.number().optional(),
  description: z.string().optional(),
  manager_id: z.string().optional(),
});

type EditFormData = z.infer<typeof editSchema>;

interface Props {
  project: Project & { manager?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null };
  tasks: TaskWithRelations[];
  challenges: (Challenge & {
    owner?: Pick<Profile, "id" | "full_name"> | null;
    kpi?: Pick<KpiDefinition, "id" | "name" | "code"> | null;
  })[];
  documents: (Document & { creator?: Pick<Profile, "id" | "full_name"> | null })[];
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  kpiDefinitions: KpiDefinition[];
  currentUser: Profile;
}

export function ProjectDetailClient({ project, tasks: initialTasks, challenges, documents, profiles, kpiDefinitions, currentUser }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";
  const { data: tasks = initialTasks } = useQuery({
    queryKey: taskKeys.byProject(project.id),
    queryFn: () => fetchTasks({ projectId: project.id }),
    initialData: initialTasks,
  });
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: project.name,
      status: project.status as "active" | "paused" | "completed" | "cancelled",
      current_stage: project.current_stage ?? "",
      start_date: project.start_date ?? "",
      end_date: project.end_date ?? "",
      total_budget: project.total_budget ?? 0,
      description: project.description ?? "",
      manager_id: project.manager_id ?? "",
    },
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleEdit = async (data: EditFormData) => {
    setSaving(true);
    const supabase = createClient();
    const budget = typeof data.total_budget === "number" && !isNaN(data.total_budget) ? data.total_budget : 0;
    const manager = profiles.find((p) => p.id === data.manager_id);

    const { error } = await supabase.from("projects").update({
      name: data.name,
      status: data.status,
      current_stage: data.current_stage || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      total_budget: budget,
      description: data.description || null,
      manager_id: data.manager_id || null,
      manager_name: manager?.full_name ?? null,
    }).eq("id", project.id);

    if (error) {
      toast.error(`فشل التحديث: ${error.message}`);
    } else {
      toast.success("تم تحديث المشروع بنجاح");
      setEditOpen(false);
      router.refresh();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    if (error) {
      toast.error(`فشل الحذف: ${error.message}`);
    } else {
      toast.success("تم حذف المشروع");
      router.push("/projects");
    }
    setDeleting(false);
  };

  const openEdit = () => {
    reset({
      name: project.name,
      status: project.status as "active" | "paused" | "completed" | "cancelled",
      current_stage: project.current_stage ?? "",
      start_date: project.start_date ?? "",
      end_date: project.end_date ?? "",
      total_budget: project.total_budget ?? 0,
      description: project.description ?? "",
      manager_id: project.manager_id ?? "",
    });
    setMenuOpen(false);
    setEditOpen(true);
  };

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && TABS.some(t => t.key === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    router.replace(`${pathname}?tab=${key}`, { scroll: false });
  };

  const progress = Math.round(project.progress ?? 0);
  const challengeSummary = summarizeChallenges(challenges);
  const hourTotals = tasks.reduce(
    (totals, task) => {
      const planned = task.planned_hours ?? 0;
      const actual = task.actual_hours ?? 0;
      return {
        planned: totals.planned + planned,
        actual: totals.actual + actual,
        overPlanCount: totals.overPlanCount + (planned > 0 && actual > planned ? 1 : 0),
      };
    },
    { planned: 0, actual: 0, overPlanCount: 0 }
  );
  const hourVariance = hourTotals.actual - hourTotals.planned;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 p-6 lg:p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6 font-medium">
        <Link href="/projects" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          المشاريع
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-800">{project.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 mb-8 shadow-sm relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {project.logo_url ? (
              <Image src={project.logo_url} alt="" width={64} height={64} className="w-16 h-16 rounded-2xl object-cover shadow-sm border border-slate-100" />
            ) : (
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-sm bg-gradient-to-br from-indigo-500 to-indigo-600">
                {project.name[0]}
              </div>
            )}
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold font-heading text-slate-900">{project.name}</h1>
                <span className={cn("text-xs px-2.5 py-1 rounded-md font-bold border",
                  project.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                  project.status === "paused" ? "bg-amber-50 text-amber-700 border-amber-100" :
                  "bg-slate-100 text-slate-600 border-slate-200"
                )}>
                  {getProjectStatusLabel(project.status)}
                </span>
                {project.current_stage && (
                  <span className="text-xs bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md text-slate-600 font-medium">
                    {project.current_stage}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                <span>بواسطة:</span>
                {project.manager ? (
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                    <Image
                      src={project.manager.avatar_url ?? getAvatarUrl(project.manager.full_name)}
                      alt="" width={16} height={16}
                      className="w-4 h-4 rounded-full object-cover"
                    />
                    <span className="text-xs text-slate-700">{project.manager.full_name}</span>
                  </div>
                ) : (
                  <span className="text-slate-400">بدون مدير</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8 bg-slate-50/80 border border-slate-100 rounded-2xl p-4">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">نسبة الإنجاز</span>
                <span className="text-2xl font-black text-slate-800">{progress}%</span>
              </div>
              <div className="relative w-14 h-14 flex items-center justify-center">
                <svg className="transform -rotate-90 w-14 h-14">
                  <circle cx="28" cy="28" r={radius} className="stroke-slate-200" strokeWidth="5" fill="none" />
                  <circle
                    cx="28"
                    cy="28"
                    r={radius}
                    className="stroke-indigo-600 transition-all duration-1000 ease-out"
                    strokeWidth="5"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
            
            <div className="w-px h-10 bg-slate-200 hidden sm:block" />
            
            <div className="hidden sm:flex items-center gap-2 relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors shadow-sm"
              >
                <MoreHorizontal size={20} />
              </button>
              {menuOpen && (
                <div className="absolute top-12 left-0 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px] z-50">
                  <button
                    onClick={openEdit}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                  >
                    <Pencil size={16} />
                    تعديل المشروع
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); setDeleteOpen(true); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={16} />
                    حذف المشروع
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto custom-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              "px-5 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all flex items-center gap-2",
              activeTab === tab.key
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            )}
          >
            {tab.label}
            {tab.key === "tasks" && <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", activeTab === tab.key ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500")}>{tasks.length}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content Area */}
      <div className="flex-1">
        
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
            {/* Description */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold font-heading text-slate-800 mb-3">وصف المشروع</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                {project.description || <span className="text-slate-400 italic">لا يوجد وصف متاح للمشروع.</span>}
              </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3 text-indigo-600">
                  <div className="p-2 bg-indigo-50 rounded-lg"><CalendarDays size={18} /></div>
                  <span className="font-semibold text-sm">الجدول الزمني</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-slate-500">البداية:</span> <span className="font-medium">{formatDateShort(project.start_date)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">الانتهاء:</span> <span className="font-medium text-slate-800">{formatDateShort(project.end_date)}</span></div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3 text-emerald-600">
                  <div className="p-2 bg-emerald-50 rounded-lg"><Wallet size={18} /></div>
                  <span className="font-semibold text-sm">الميزانية</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{project.total_budget?.toLocaleString("ar") ?? "—"} <span className="text-sm text-slate-500 font-medium">ر.س</span></p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3 text-blue-600">
                  <div className="p-2 bg-blue-50 rounded-lg"><Target size={18} /></div>
                  <span className="font-semibold text-sm">المهام</span>
                </div>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-black text-slate-800">{tasks.length}</p>
                  <p className="text-sm font-medium text-slate-500 mb-1">إجمالي</p>
                </div>
                <p className="text-xs text-slate-400 mt-1">{tasks.filter(t => t.status === "Done").length} مكتملة</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3 text-amber-600">
                  <div className="p-2 bg-amber-50 rounded-lg"><Activity size={18} /></div>
                  <span className="font-semibold text-sm">التحديات</span>
                </div>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-black text-slate-800">{challengeSummary.open}</p>
                  <p className="text-sm font-medium text-slate-500 mb-1">مفتوحة</p>
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {challengeSummary.critical} حرجة، تغطية المخاطر {challengeSummary.riskCoverage}%
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3 text-indigo-600">
                  <div className="p-2 bg-indigo-50 rounded-lg"><Clock size={18} /></div>
                  <div>
                    <h3 className="font-bold text-slate-800">ملخص الساعات</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">الساعات لا تؤثر على نسبة الإنجاز الحالية</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">المخطط</p>
                    <p className="mt-1 text-lg font-black text-slate-800">{formatHours(hourTotals.planned)} س</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">الفعلي</p>
                    <p className="mt-1 text-lg font-black text-slate-800">{formatHours(hourTotals.actual)} س</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">الفرق</p>
                    <p className={cn("mt-1 text-lg font-black", hourVariance > 0 ? "text-red-600" : "text-emerald-600")}>
                      {hourVariance > 0 ? "+" : hourVariance < 0 ? "-" : ""}{formatHours(Math.abs(hourVariance))} س
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">تجاوزت المخطط</p>
                    <p className="mt-1 text-lg font-black text-slate-800">{hourTotals.overPlanCount}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BOARD TAB */}
        {activeTab === "board" && (
          <div className="animate-in fade-in duration-300">
            <KanbanBoard tasks={tasks} projectId={project.id} profiles={profiles} />
          </div>
        )}

        {/* TASKS TAB */}
        {activeTab === "tasks" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
            <TasksTable tasks={tasks} profiles={profiles} projectId={project.id} />
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === "timeline" && (
          <div className="animate-in fade-in duration-300">
            <TasksTimelineChart tasks={tasks} profiles={profiles} />
          </div>
        )}

        {/* CHALLENGES TAB */}
        {activeTab === "challenges" && (
          <div className="animate-in fade-in duration-300">
            <ChallengesList
              challenges={challenges}
              profiles={profiles}
              projectId={project.id}
              currentUser={currentUser}
              kpiDefinitions={kpiDefinitions}
            />
          </div>
        )}

        {/* FORMS TAB */}
        {activeTab === "forms" && (
          <ProjectFormsTab project={project} profiles={profiles} currentUser={currentUser} />
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === "documents" && (
          <div className="animate-in fade-in duration-300">
            <DocumentsList documents={documents} projectId={project.id} currentUser={currentUser} />
          </div>
        )}

        {/* MEMBERS TAB */}
        {activeTab === "members" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold font-heading text-slate-800 flex items-center gap-2">
                <Users size={20} className="text-indigo-600" />
                أعضاء المشروع
              </h3>
            </div>
            {/* Simple Grid of Members from Tasks owners + Manager */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from(new Set([project.manager_id, ...tasks.map(t => t.owner_id).filter(Boolean)])).map(userId => {
                const p = profiles.find(profile => profile.id === userId);
                if (!p) return null;
                const isManager = p.id === project.manager_id;
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                    <Image src={p.avatar_url ?? getAvatarUrl(p.full_name)} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">{p.full_name}</p>
                      <p className="text-[11px] font-medium text-slate-500">{isManager ? "مدير المشروع" : "عضو"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold">تعديل المشروع</h2>
              <button onClick={() => setEditOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit(handleEdit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">اسم المشروع *</label>
                <input {...register("name")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">الحالة</label>
                <select {...register("status")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                  <option value="active">نشط</option>
                  <option value="paused">متوقف</option>
                  <option value="completed">مكتمل</option>
                  <option value="cancelled">ملغي</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">مدير المشروع</label>
                <select {...register("manager_id")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                  <option value="">اختر المدير</option>
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">المرحلة الحالية</label>
                <input {...register("current_stage")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="مثال: التخطيط، التنفيذ..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">تاريخ البداية</label>
                  <input type="date" {...register("start_date")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">تاريخ الانتهاء</label>
                  <input type="date" {...register("end_date")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">الميزانية الإجمالية</label>
                <input type="number" {...register("total_budget", { valueAsNumber: true })} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="0" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">الوصف</label>
                <textarea {...register("description")} rows={3} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="وصف المشروع..." />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditOpen(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm hover:bg-accent transition-colors">
                  إلغاء
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 mb-2">حذف المشروع</h2>
              <p className="text-sm text-slate-500 mb-6">
                {/* eslint-disable-next-line react/no-unescaped-entities */}
                هل أنت متأكد من حذف مشروع <span className="font-bold text-slate-700">"{project.name}"</span>؟
                سيتم حذف جميع المهام والتحديات والمستندات المرتبطة بهذا المشروع.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteOpen(false)} className="flex-1 py-2.5 border border-border rounded-lg text-sm hover:bg-accent transition-colors">
                  إلغاء
                </button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2">
                  {deleting && <Loader2 size={16} className="animate-spin" />}
                  حذف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
