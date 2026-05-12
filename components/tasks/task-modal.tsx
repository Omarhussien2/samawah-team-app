"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, AlertTriangle, Send, MessageSquare, CalendarDays, AlignLeft, CheckSquare, Paperclip, MoreHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getStatusLabel, getAlertLevelColor, formatRelativeAr, cn, getAvatarUrl, getPriorityColor } from "@/lib/utils";
import { useCommentsSubscription } from "@/lib/supabase/realtime";
import { recalcProjectProgress } from "@/lib/utils/recalc-progress";
import Image from "next/image";
import type { Database, Profile, Task, TaskProgressMode } from "@/lib/supabase/types";

const STATUSES = ["Backlog", "To Do", "In Progress", "Review", "Done", "Cancelled"];
const PRIORITIES = ["low", "medium", "high", "critical"];

interface CommentWithUser {
  id: string;
  task_id: string;
  user_id: string | null;
  body: string;
  created_at: string;
  user?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

interface Props {
  task: Task & { owner?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null; project?: { id: string, name: string } | null };
  profiles: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  onClose: () => void;
  onTaskSaved?: (task: Task) => void;
}

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

export function TaskModal({ task, profiles, onClose, onTaskSaved }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority || "medium");
  const [progress, setProgress] = useState(task.progress ?? 0);
  const [progressMode, setProgressMode] = useState<TaskProgressMode>(task.progress_mode ?? "manual");
  const [quantityDone, setQuantityDone] = useState(task.quantity_done?.toString() ?? "");
  const [quantityTotal, setQuantityTotal] = useState(task.quantity_total?.toString() ?? "");
  const [ownerId, setOwnerId] = useState(task.owner_id ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/comments?task_id=${task.id}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch {
      // silent
    } finally {
      setLoadingComments(false);
    }
  }, [task.id]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Realtime comments subscription
  const handleNewComment = useCallback(
    (payload: Record<string, unknown>) => {
      const newComment = payload as unknown as CommentWithUser;
      setComments((prev) => {
        if (prev.some((c) => c.id === newComment.id)) return prev;
        const user = profiles.find((p) => p.id === newComment.user_id);
        return [...prev, { ...newComment, user: user ?? null }];
      });
    },
    [profiles]
  );
  useCommentsSubscription(task.id, handleNewComment);

  const calculatedProgress = useMemo(() => {
    if (status === "Done") return 100;
    if (progressMode === "manual") return progress;

    const done = Number(quantityDone) || 0;
    const total = Number(quantityTotal) || 0;
    if (total <= 0) return 0;

    return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
  }, [progress, progressMode, quantityDone, quantityTotal, status]);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const owner = profiles.find((p) => p.id === ownerId);
    const previousOwnerId = task.owner_id;

    const progressVal = status === "Done" ? 100 : progressMode === "quantity" ? calculatedProgress : progress;
    const quantityDoneVal = quantityDone === "" ? null : Number(quantityDone);
    const quantityTotalVal = quantityTotal === "" ? null : Number(quantityTotal);
    const updatePayload: TaskUpdate = {
      title,
      status,
      priority,
      board_column: status,
      progress_mode: progressMode,
      progress: progressVal,
      quantity_done: progressMode === "quantity" ? quantityDoneVal : task.quantity_done,
      quantity_total: progressMode === "quantity" ? quantityTotalVal : task.quantity_total,
      owner_id: ownerId || null,
      owner_name: owner?.full_name ?? null,
      due_date: dueDate || null,
    };

    const { data: updatedTask, error } = await supabase
      .from("tasks")
      .update(updatePayload)
      .eq("id", task.id)
      .select()
      .single();

    if (error) {
      toast.error("ما نجح حفظ التغييرات");
    } else {
      toast.success("تم الحفظ");
      if (updatedTask) {
        onTaskSaved?.(updatedTask);
      }
      recalcProjectProgress(task.project_id);

      // Send notifications for status change or assignment via API
      if (status !== task.status || (ownerId && ownerId !== previousOwnerId)) {
        try {
          await fetch("/api/task-events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              task_id: task.id,
              task_title: task.title,
              project_id: task.project_id,
              old_status: task.status,
              new_status: status,
              old_owner_id: previousOwnerId,
              new_owner_id: ownerId || null,
            }),
          });
        } catch { }
      }

      router.refresh();
      onClose();
    }
    setSaving(false);
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    setSendingComment(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task.id, body: comment.trim() }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => {
          if (prev.some((c) => c.id === newComment.id)) return prev;
          return [...prev, newComment];
        });
        setComment("");
        toast.success("تم إرسال التعليق");
      } else {
        toast.error("ما نجح إرسال التعليق");
      }
    } catch {
      toast.error("ما نجح إرسال التعليق");
    } finally {
      setSendingComment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col animate-in zoom-in-95 duration-200" 
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
              <X size={20} />
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
              <MoreHorizontal size={20} />
            </button>
            {task.project && (
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md uppercase tracking-wider">
                {task.project.name}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 font-medium transition-colors">إلغاء</button>
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 font-medium disabled:opacity-60 flex items-center gap-2 transition-colors shadow-sm active:scale-95">
              {saving && <Loader2 size={15} className="animate-spin" />}
              حفظ التغييرات
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          
          {/* Main Content (Right Side - RTL) */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar border-l border-slate-100">
            
            {/* Title Input */}
            <div className="mb-8">
              <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)}
                className="text-2xl font-bold font-heading text-slate-900 w-full bg-transparent border-none focus:ring-0 focus:outline-none placeholder-slate-300"
                placeholder="عنوان المهمة..."
              />
            </div>

            {/* Alert Level */}
            {task.alert_message && (
              <div className={cn("mb-8 px-4 py-3 rounded-xl border text-sm flex items-start gap-3 shadow-sm", getAlertLevelColor(task.alert_level))}>
                <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">{task.alert_level}</p>
                  <p className="mt-0.5">{task.alert_message}</p>
                  {task.alert_action && <p className="mt-2 text-xs font-medium opacity-80 p-2 bg-white/50 rounded inline-block">الإجراء: {task.alert_action}</p>}
                </div>
              </div>
            )}

            {/* Description (Placeholder for markdown) */}
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-3">
                <AlignLeft size={18} className="text-slate-400" />
                <h3 className="text-base font-bold font-heading text-slate-800">الوصف</h3>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 min-h-[120px] text-slate-500 text-sm hover:bg-slate-100/80 transition-colors cursor-pointer ring-1 ring-transparent hover:ring-slate-200">
                {task.sub_task ? task.sub_task : "أضف وصفاً أكثر تفصيلاً للمهمة..."}
              </div>
            </div>

            {/* Comments Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare size={18} className="text-slate-400" />
                <h3 className="text-base font-bold font-heading text-slate-800">النشاطات والتعليقات</h3>
              </div>

              {/* Comment Input */}
              <div className="flex gap-3 mb-8">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex-shrink-0 flex items-center justify-center text-indigo-600 font-bold text-xs">
                  أنت
                </div>
                <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all overflow-hidden">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    placeholder="أضف تعليقاً..."
                    className="w-full px-4 py-3 text-sm bg-transparent border-none focus:ring-0 focus:outline-none resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleComment();
                    }}
                  />
                  <div className="bg-slate-50 border-t border-slate-100 px-3 py-2 flex justify-between items-center">
                    <p className="text-[11px] text-slate-400 font-medium">Ctrl + Enter للإرسال السريع</p>
                    <button
                      onClick={handleComment}
                      disabled={!comment.trim() || sendingComment}
                      className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700 font-medium disabled:opacity-40 flex items-center gap-1.5 transition-colors"
                    >
                      {sendingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      إرسال
                    </button>
                  </div>
                </div>
              </div>

              {/* Comments List */}
              <div className="space-y-6">
                {loadingComments ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-slate-300" />
                  </div>
                ) : comments.map((c) => (
                  <div key={c.id} className="flex gap-4">
                    <Image
                      src={c.user?.avatar_url ?? getAvatarUrl(c.user?.full_name)}
                      alt={c.user?.full_name ?? ""}
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full flex-shrink-0 mt-1 object-cover border border-slate-100 shadow-sm"
                    />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-800">{c.user?.full_name ?? "مستخدم"}</span>
                        <span className="text-[11px] font-medium text-slate-400">{formatRelativeAr(c.created_at)}</span>
                      </div>
                      <div className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-xl rounded-tr-none px-4 py-3 leading-relaxed whitespace-pre-wrap">
                        {c.body}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Sidebar (Left Side) */}
          <div className="w-80 bg-slate-50/50 p-6 overflow-y-auto custom-scrollbar shrink-0">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">خصائص المهمة</h3>
            
            <div className="space-y-6">
              
              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">الحالة</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as Task["status"])}
                  className="w-full px-3 py-2.5 text-sm font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white shadow-sm hover:border-slate-300 transition-colors">
                  {STATUSES.map((s) => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">الأولوية</label>
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriority(p as Task["priority"])}
                      className={cn(
                        "px-2 py-1.5 text-xs font-bold rounded-md border transition-all flex items-center justify-center gap-1.5",
                        priority === p 
                          ? cn(getPriorityColor(p), "border-transparent text-white ring-2 ring-offset-1", p === 'critical' ? 'ring-red-500' : p === 'high' ? 'ring-orange-500' : p === 'low' ? 'ring-slate-400' : 'ring-blue-500') 
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      <div className={cn("w-2 h-2 rounded-full", priority === p ? "bg-white" : getPriorityColor(p).split(' ')[0])} />
                      {p === "high" ? "عالي" : p === "critical" ? "حرج" : p === "medium" ? "متوسط" : "منخفض"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">المسؤول</label>
                <div className="relative">
                  <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 text-sm font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white shadow-sm hover:border-slate-300 transition-colors appearance-none">
                    <option value="">غير مخصص</option>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                  {ownerId && (
                    <Image
                      src={profiles.find(p => p.id === ownerId)?.avatar_url ?? getAvatarUrl(profiles.find(p => p.id === ownerId)?.full_name)}
                      alt="" width={20} height={20}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full object-cover pointer-events-none"
                    />
                  )}
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                  تاريخ الاستحقاق
                </label>
                <div className="relative">
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 text-sm font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white shadow-sm hover:border-slate-300 transition-colors" 
                  />
                  <CalendarDays size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Progress Slider */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-600 mb-2">طريقة حساب الإنجاز</label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setProgressMode("manual")}
                    className={cn(
                      "px-3 py-2 text-xs font-bold rounded-lg border transition-colors",
                      progressMode === "manual"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    يدوي
                  </button>
                  <button
                    type="button"
                    onClick={() => setProgressMode("quantity")}
                    className={cn(
                      "px-3 py-2 text-xs font-bold rounded-lg border transition-colors",
                      progressMode === "quantity"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    حسب الكمية
                  </button>
                </div>

                {progressMode === "quantity" && (
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">المنجز</label>
                      <input
                        type="number"
                        min={0}
                        value={quantityDone}
                        onChange={(e) => setQuantityDone(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">الإجمالي</label>
                      <input
                        type="number"
                        min={0}
                        value={quantityTotal}
                        onChange={(e) => setQuantityTotal(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white shadow-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-600">نسبة الإنجاز</label>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{calculatedProgress}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={calculatedProgress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  disabled={progressMode === "quantity" || status === "Done"}
                  className={cn("w-full accent-indigo-600", (progressMode === "quantity" || status === "Done") && "opacity-50 cursor-not-allowed")}
                />
                {progressMode === "quantity" && (
                  <p className="mt-1 text-[11px] text-slate-400">يتم حساب النسبة تلقائياً من الكمية المنجزة.</p>
                )}
              </div>

              {/* Sub-tasks / Checklists Placeholder */}
              <div className="pt-4 border-t border-slate-200">
                <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-50 transition-colors shadow-sm">
                  <CheckSquare size={16} /> إضافة قائمة مهام فرعية
                </button>
              </div>

              {/* Attachments Placeholder */}
              <div>
                <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-50 transition-colors shadow-sm">
                  <Paperclip size={16} /> إرفاق ملف
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
