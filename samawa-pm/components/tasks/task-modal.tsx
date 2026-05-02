"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getStatusLabel, getAlertLevelColor, cn } from "@/lib/utils";
import type { Profile, Task } from "@/lib/supabase/types";

const STATUSES = ["Backlog", "To Do", "In Progress", "Review", "Done", "Cancelled"];

interface Props {
  task: Task & { owner?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null };
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  onClose: () => void;
}

export function TaskModal({ task, profiles, onClose }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(task.status);
  const [progress, setProgress] = useState(task.progress ?? 0);
  const [ownerId, setOwnerId] = useState(task.owner_id ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "comments">("details");

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const owner = profiles.find((p) => p.id === ownerId);
    const { error } = await supabase.from("tasks").update({
      status,
      board_column: status,
      progress,
      owner_id: ownerId || null,
      owner_name: owner?.full_name ?? null,
      due_date: dueDate || null,
    }).eq("id", task.id);

    if (error) toast.error("فشل حفظ التغييرات");
    else { toast.success("تم الحفظ"); router.refresh(); onClose(); }
    setSaving(false);
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("comments").insert({
      task_id: task.id, user_id: user.id, body: comment.trim(),
    });
    if (error) toast.error("فشل إرسال التعليق");
    else { toast.success("تم الإرسال"); setComment(""); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">{task.title}</h2>
            {task.sub_task && <p className="text-sm text-muted-foreground mt-0.5">{task.sub_task}</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-0.5">
            <X size={20} />
          </button>
        </div>

        {/* Alert */}
        {task.alert_message && (
          <div className={cn("mx-6 mt-4 px-4 py-3 rounded-lg border text-sm flex items-start gap-2", getAlertLevelColor(task.alert_level))}>
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{task.alert_level}</p>
              <p>{task.alert_message}</p>
              {task.alert_action && <p className="mt-1 text-xs opacity-80">الإجراء: {task.alert_action}</p>}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border px-6 mt-4">
          {[{ key: "details", label: "التفاصيل" }, { key: "comments", label: "التعليقات" }].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as "details" | "comments")}
              className={cn("px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "details" ? (
            <div className="space-y-4">
              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">الحالة</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as Task["status"])}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                    {STATUSES.map((s) => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">المسؤول</label>
                  <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                    <option value="">غير مخصص</option>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">تاريخ الاستحقاق</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">نسبة الإنجاز: {progress}%</label>
                  <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))}
                    className="w-full" />
                </div>
              </div>

              {/* Info */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-muted/30 rounded-xl text-sm">
                {task.category && <div><span className="text-muted-foreground">الفئة: </span>{task.category}</div>}
                {task.cost && <div><span className="text-muted-foreground">التكلفة: </span>{task.cost?.toLocaleString("ar")} ر.س</div>}
                {task.quantity_total && <div><span className="text-muted-foreground">الكمية: </span>{task.quantity_done ?? 0}/{task.quantity_total}</div>}
                {task.days_to_due !== null && <div><span className="text-muted-foreground">الأيام المتبقية: </span>{task.days_to_due}</div>}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-lg text-sm hover:bg-accent">إلغاء</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  حفظ التغييرات
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="أضف تعليقاً..."
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
              <button onClick={handleComment} disabled={!comment.trim()}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 font-medium disabled:opacity-40">
                إرسال التعليق
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
