"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";
import { normalizeMoney } from "@/lib/projects/budget";
import { PROJECT_TYPE_OPTIONS } from "@/lib/utils";
import type { Profile, ProjectTemplate } from "@/lib/supabase/types";

const budgetFieldSchema = z.preprocess(
  (value) => {
    const numericValue = Number(value);
    return value === "" || value === undefined || Number.isNaN(numericValue) ? 0 : numericValue;
  },
  z.number().min(0, "الميزانية يجب أن تكون صفرا أو أكثر").default(0)
);

const schema = z.object({
  name: z.string().min(1, "اسم المشروع مطلوب"),
  project_type: z.enum(["external", "internal"]),
  manager_id: z.string().optional(),
  current_stage: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  total_budget: budgetFieldSchema,
  description: z.string().optional(),
  template_id: z.string().optional(),
  forms_owner_id: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  profiles: Pick<Profile, "id" | "full_name">[];
  currentUser: Pick<Profile, "id" | "full_name" | "role">;
  templates: (ProjectTemplate & { task_templates: { id: string; title: string }[] })[];
}

export function CreateProjectModal({ open, onClose, profiles, currentUser, templates }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const canCreateProject = currentUser.role === "admin" || currentUser.role === "project_manager";
  const defaultManagerId = currentUser.role === "project_manager" ? currentUser.id : "";
  const managerOptions =
    currentUser.role === "admin"
      ? profiles
      : [{ id: currentUser.id, full_name: currentUser.full_name ?? "المستخدم الحالي" }];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      project_type: "internal",
      manager_id: defaultManagerId,
      total_budget: 0,
      forms_owner_id: "",
    },
  });

  if (!open) return null;

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    if (!canCreateProject) {
      toast.error("إنشاء المشاريع متاح لمدير النظام أو مدير المشاريع فقط");
      setLoading(false);
      return;
    }

    const managerId = currentUser.role === "project_manager" ? currentUser.id : data.manager_id || null;
    const manager = managerOptions.find((p) => p.id === managerId);

    const budget = normalizeMoney(data.total_budget);

    const payload = {
      name: data.name,
      project_type: data.project_type,
      manager_id: managerId,
      manager_name: manager?.full_name ?? null,
      current_stage: data.current_stage || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      total_budget: budget,
      description: data.description || null,
      forms_owner_id: data.forms_owner_id || null,
      status: "active" as const,
    };

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = typeof result.error === "string" ? result.error : "فشل إنشاء المشروع";
      toast.error(message);
      setLoading(false);
      return;
    }
    const project = result.project as { id: string } | null;

    // Create tasks from template if selected
    if (data.template_id && project) {
      const supabase = createClient();
      const template = templates.find((t) => t.id === data.template_id);
      if (template?.task_templates) {
        const tasks = template.task_templates.map((tt, idx) => ({
          project_id: project.id,
          title: tt.title,
          status: "To Do" as const,
          board_column: "To Do",
          priority: "medium" as const,
          sort_order: idx,
        }));
        await supabase.from("tasks").insert(tasks);
      }
    }

    toast.success("تم إنشاء المشروع بنجاح");
    reset({ project_type: "internal", manager_id: defaultManagerId, total_budget: 0, forms_owner_id: "" });
    onClose();
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold">مشروع جديد</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">اسم المشروع *</label>
            <input {...register("name")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="اسم المشروع" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">نوع المشروع</label>
            <select {...register("project_type")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
              {PROJECT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {currentUser.role === "admin" ? (
            <div>
              <label className="block text-sm font-medium mb-1.5">مدير المشروع</label>
              <select {...register("manager_id")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                <option value="">اختر المدير</option>
                {managerOptions.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1.5">مدير المشروع</label>
              <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                {currentUser.full_name ?? "المستخدم الحالي"}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">مسؤول التدريب/التوصيات</label>
            <select {...register("forms_owner_id")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
              <option value="">بدون مسؤول محدد</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
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
            <label className="block text-sm font-medium mb-1.5">المرحلة الحالية</label>
            <input {...register("current_stage")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="مثال: التخطيط، التنفيذ..." />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">الميزانية الإجمالية</label>
            <input type="number" min={0} step={0.01} {...register("total_budget", { valueAsNumber: true })} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="0" />
            {errors.total_budget && <p className="text-xs text-red-500 mt-1">{errors.total_budget.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">الوصف</label>
            <textarea {...register("description")} rows={3} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="وصف المشروع..." />
          </div>

          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1.5">إنشاء من قالب (اختياري)</label>
              <select {...register("template_id")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                <option value="">بدون قالب</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border rounded-lg text-sm hover:bg-accent transition-colors">
              إلغاء
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              إنشاء المشروع
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
