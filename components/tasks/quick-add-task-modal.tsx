"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { X, Loader2, Zap } from "lucide-react";
import { recalcProjectProgress } from "@/lib/utils/recalc-progress";
import {
  applyCreatedTaskToTaskQueries,
  createTask,
  taskKeys,
  type TaskWithRelations,
} from "@/lib/queries/tasks";
import { getTaskDateDuration } from "@/lib/tasks/duration";
import { normalizeMoney } from "@/lib/projects/budget";
import { attachProjectTypesFromApi } from "@/lib/projects/project-type-client";
import { PROJECT_TYPE_OPTIONS, getProjectType, getProjectTypeLabel } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(1, "اسم المهمة مطلوب"),
  project_id: z.string().min(1, "المشروع مطلوب"),
  owner_id: z.string().optional(),
  start_date: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  planned_hours: z.preprocess(
    (value) => {
      const numericValue = Number(value);
      return value === "" || value === undefined || Number.isNaN(numericValue) ? 0 : numericValue;
    },
    z.number().min(0).default(0)
  ),
  cost: z.preprocess(
    (value) => {
      const numericValue = Number(value);
      return value === "" || value === undefined || Number.isNaN(numericValue) ? 0 : numericValue;
    },
    z.number().min(0, "مصروف المهمة يجب أن يكون صفرا أو أكثر").default(0)
  ),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  onTaskCreated?: (task: TaskWithRelations) => void;
}

export function QuickAddTaskModal({ open, onClose, defaultProjectId, onTaskCreated }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [projects, setProjects] = useState<{ id: string; name: string; project_type?: "internal" | "external" }[]>([]);
  const [projectTypeFilter, setProjectTypeFilter] = useState("all");
  const [profiles, setProfiles] = useState<{ id: string; full_name: string | null }[]>([]);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "medium", project_id: defaultProjectId ?? "", start_date: "", due_date: "", planned_hours: 0, cost: 0 },
  });
  const watchedStartDate = watch("start_date");
  const watchedDueDate = watch("due_date");
  const visibleProjects = useMemo(
    () => projects.filter((project) => projectTypeFilter === "all" || getProjectType(project) === projectTypeFilter),
    [projectTypeFilter, projects]
  );
  const dateDuration = useMemo(
    () => getTaskDateDuration({ startDate: watchedStartDate, endDate: watchedDueDate }),
    [watchedStartDate, watchedDueDate]
  );

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: (task) => {
      applyCreatedTaskToTaskQueries(queryClient, task);
      onTaskCreated?.(task);
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      toast.success("تمت إضافة المهمة");
      recalcProjectProgress(task.project_id);
      reset({ priority: "medium", project_id: defaultProjectId ?? "", start_date: "", due_date: "", planned_hours: 0, cost: 0 });
      onClose();
      router.refresh();
    },
    onError: () => {
      toast.error("فشل إضافة المهمة");
    },
  });

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    Promise.all([
      supabase.from("projects").select("id, name").eq("status", "active").order("name"),
      supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name"),
    ]).then(async ([{ data: p }, { data: u }]) => {
      setProjects(await attachProjectTypesFromApi(p ?? []));
      setProfiles(u ?? []);
    });
  }, [open]);

  useEffect(() => {
    if (open && defaultProjectId) {
      setValue("project_id", defaultProjectId);
    }
  }, [open, defaultProjectId, setValue]);

  if (!open) return null;

  const onSubmit = async (data: FormData) => {
    const submittedDuration = getTaskDateDuration({ startDate: data.start_date, endDate: data.due_date });
    if (!submittedDuration.isValidRange) {
      toast.error("تاريخ نهاية المهمة يجب أن يكون بعد تاريخ البداية أو في نفس اليوم");
      return;
    }

    const owner = profiles.find((p) => p.id === data.owner_id);
    createTaskMutation.mutate({
      title: data.title,
      project_id: data.project_id,
      owner_id: data.owner_id || null,
      owner_name: owner?.full_name ?? null,
      start_date: data.start_date || null,
      due_date: data.due_date || null,
      priority: data.priority,
      planned_hours: data.planned_hours,
      cost: normalizeMoney(data.cost),
      status: "To Do",
      board_column: "To Do",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
          <Zap size={18} className="text-primary" />
          <h2 className="text-lg font-bold flex-1">إضافة مهمة سريعة</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">اسم المهمة *</label>
            <input {...register("title")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="ما الذي تريد إنجازه؟" autoFocus />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
          </div>

          {!defaultProjectId && (
            <div>
              <label className="block text-sm font-medium mb-1.5">نوع المشروع</label>
              <select
                value={projectTypeFilter}
                onChange={(event) => {
                  setProjectTypeFilter(event.target.value);
                  setValue("project_id", "");
                }}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              >
                <option value="all">كل أنواع المشاريع</option>
                {PROJECT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">المشروع *</label>
            <select {...register("project_id")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
              <option value="">اختر المشروع</option>
              {(defaultProjectId ? projects : visibleProjects).map((p) => (
                <option key={p.id} value={p.id}>{p.name} - {getProjectTypeLabel(getProjectType(p))}</option>
              ))}
            </select>
            {errors.project_id && <p className="text-xs text-red-500 mt-1">{errors.project_id.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">المسؤول</label>
              <select {...register("owner_id")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                <option value="">غير مخصص</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">بدأت في</label>
              <input type="date" {...register("start_date")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">انتهت في</label>
              <input type="date" {...register("due_date")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">مدة المهمة</label>
              <div
                className={`flex h-[38px] items-center rounded-lg border px-3 text-sm font-medium ${
                  dateDuration.isValidRange
                    ? "border-indigo-100 bg-indigo-50 text-indigo-700"
                    : "border-red-100 bg-red-50 text-red-600"
                }`}
              >
                {dateDuration.hasBothDates ? dateDuration.label : "بعد إدخال التاريخين"}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">الأولوية</label>
            <select {...register("priority")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
              <option value="low">منخفضة</option>
              <option value="medium">متوسطة</option>
              <option value="high">عالية</option>
              <option value="critical">حرجة</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">الساعات المخططة</label>
              <input
                type="number"
                min={0}
                step={0.25}
                {...register("planned_hours", { valueAsNumber: true })}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">مصروفات المهمة</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  {...register("cost", { valueAsNumber: true })}
                  className="w-full pl-12 pr-3 py-2 text-sm border border-emerald-100 bg-emerald-50/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  placeholder="0"
                />
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700">
                  ر.س
                </span>
              </div>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">تدخل هنا التكلفة الفعلية للمهمة.</p>
              {errors.cost && <p className="text-xs text-red-500 mt-1">{errors.cost.message}</p>}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border rounded-lg text-sm hover:bg-accent transition-colors">إلغاء</button>
            <button type="submit" disabled={createTaskMutation.isPending} className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {createTaskMutation.isPending && <Loader2 size={15} className="animate-spin" />}
              إضافة
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
