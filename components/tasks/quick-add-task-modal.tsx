"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { X, Loader2, Zap } from "lucide-react";
import { recalcProjectProgress } from "@/lib/utils/recalc-progress";

const schema = z.object({
  title: z.string().min(1, "اسم المهمة مطلوب"),
  project_id: z.string().min(1, "المشروع مطلوب"),
  owner_id: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function QuickAddTaskModal({ open, onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string | null }[]>([]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "medium" },
  });

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    Promise.all([
      supabase.from("projects").select("id, name").eq("status", "active").order("name"),
      supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name"),
    ]).then(([{ data: p }, { data: u }]) => {
      setProjects(p ?? []);
      setProfiles(u ?? []);
    });
  }, [open]);

  if (!open) return null;

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    const supabase = createClient();
    const owner = profiles.find((p) => p.id === data.owner_id);
    const { error } = await supabase.from("tasks").insert({
      title: data.title,
      project_id: data.project_id,
      owner_id: data.owner_id || null,
      owner_name: owner?.full_name ?? null,
      due_date: data.due_date || null,
      priority: data.priority,
      status: "To Do",
      board_column: "To Do",
    });

    if (error) toast.error("فشل إضافة المهمة");
    else {
      toast.success("تمت إضافة المهمة");
      recalcProjectProgress(data.project_id);
      reset();
      onClose();
      router.refresh();
    }
    setLoading(false);
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

          <div>
            <label className="block text-sm font-medium mb-1.5">المشروع *</label>
            <select {...register("project_id")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
              <option value="">اختر المشروع</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
              <label className="block text-sm font-medium mb-1.5">تاريخ الاستحقاق</label>
              <input type="date" {...register("due_date")} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
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

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border rounded-lg text-sm hover:bg-accent transition-colors">إلغاء</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 size={15} className="animate-spin" />}
              إضافة
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
