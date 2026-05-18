"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, AlertTriangle, Send, MessageSquare, CalendarDays, AlignLeft, CheckSquare, Paperclip, MoreHorizontal, Clock, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getStatusLabel, getAlertLevelColor, formatRelativeAr, formatDateShort, cn, getAvatarUrl, getPriorityColor } from "@/lib/utils";
import { useCommentsSubscription } from "@/lib/supabase/realtime";
import { createClient } from "@/lib/supabase/client";
import { recalcProjectProgress } from "@/lib/utils/recalc-progress";
import {
  applyMyTaskRealtimeChange,
  applyTaskToTaskQueries,
  createTaskTimeEntry,
  deleteTaskTimeEntry,
  fetchTaskById,
  fetchTaskTimeEntries,
  taskKeys,
  taskTimeKeys,
  updateTask,
  updateTaskTimeEntry,
  type TaskTimeEntryWithUser,
} from "@/lib/queries/tasks";
import { formatHours, getTaskHourSummary } from "@/lib/tasks/hours";
import { getTaskDateDuration } from "@/lib/tasks/duration";
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
  myTasksOwnerId?: string;
}

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

export function TaskModal({ task, profiles, onClose, onTaskSaved, myTasksOwnerId }: Props) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority || "medium");
  const [progress, setProgress] = useState(task.progress ?? 0);
  const [progressMode, setProgressMode] = useState<TaskProgressMode>(task.progress_mode ?? "manual");
  const [quantityDone, setQuantityDone] = useState(task.quantity_done?.toString() ?? "");
  const [quantityTotal, setQuantityTotal] = useState(task.quantity_total?.toString() ?? "");
  const [ownerId, setOwnerId] = useState(task.owner_id ?? "");
  const [startDate, setStartDate] = useState(task.start_date ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [plannedHours, setPlannedHours] = useState((task.planned_hours ?? 0).toString());
  const [currentUserId, setCurrentUserId] = useState("");
  const [timeUserId, setTimeUserId] = useState(task.owner_id ?? "");
  const [timeDate, setTimeDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [timeHours, setTimeHours] = useState("");
  const [timeNote, setTimeNote] = useState("");
  const [editingTimeEntry, setEditingTimeEntry] = useState<TaskTimeEntryWithUser | null>(null);
  
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<CommentWithUser[]>([]);
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

  useEffect(() => {
    setPlannedHours((task.planned_hours ?? 0).toString());
  }, [task.planned_hours]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id ?? "";
      setCurrentUserId(userId);
      setTimeUserId((current) => current || task.owner_id || userId);
    });
  }, [task.owner_id]);

  const { data: timeEntries = [], isLoading: loadingTimeEntries } = useQuery({
    queryKey: taskTimeKeys.byTask(task.id),
    queryFn: () => fetchTaskTimeEntries(task.id),
  });

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

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: TaskUpdate }) => updateTask(taskId, payload),
    onSuccess: (updatedTask) => {
      applyTaskToTaskQueries(queryClient, updatedTask);
      if (myTasksOwnerId) {
        applyMyTaskRealtimeChange(queryClient, myTasksOwnerId, "UPDATE", updatedTask);
      }
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      onTaskSaved?.(updatedTask);
    },
  });

  const createTimeEntryMutation = useMutation({
    mutationFn: createTaskTimeEntry,
  });

  const updateTimeEntryMutation = useMutation({
    mutationFn: ({ entryId, payload }: { entryId: string; payload: Database["public"]["Tables"]["task_time_entries"]["Update"] }) =>
      updateTaskTimeEntry(entryId, payload),
  });

  const deleteTimeEntryMutation = useMutation({
    mutationFn: deleteTaskTimeEntry,
  });

  const refreshTaskAfterTimeChange = useCallback(async () => {
    queryClient.invalidateQueries({ queryKey: taskTimeKeys.byTask(task.id) });
    const updatedTask = await fetchTaskById(task.id);
    applyTaskToTaskQueries(queryClient, updatedTask);
    if (myTasksOwnerId) {
      applyMyTaskRealtimeChange(queryClient, myTasksOwnerId, "UPDATE", updatedTask);
    }
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
    onTaskSaved?.(updatedTask);
  }, [myTasksOwnerId, onTaskSaved, queryClient, task.id]);

  const calculatedProgress = useMemo(() => {
    if (status === "Done") return 100;
    if (progressMode === "manual") return progress;

    const done = Number(quantityDone) || 0;
    const total = Number(quantityTotal) || 0;
    if (total <= 0) return 0;

    return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
  }, [progress, progressMode, quantityDone, quantityTotal, status]);

  const hourSummary = useMemo(
    () => getTaskHourSummary({ plannedHours: Number(plannedHours) || 0, actualHours: task.actual_hours ?? 0 }),
    [plannedHours, task.actual_hours]
  );

  const hourProgressWidth = hourSummary.hasPlan
    ? Math.min(100, hourSummary.utilization ?? 0)
    : hourSummary.actual > 0
      ? 100
      : 0;

  const dateDuration = useMemo(
    () => getTaskDateDuration({ startDate, endDate: dueDate }),
    [startDate, dueDate]
  );

  const handleSave = async () => {
    if (!dateDuration.isValidRange) {
      toast.error("تاريخ نهاية المهمة يجب أن يكون بعد تاريخ البداية أو في نفس اليوم");
      return;
    }

    const owner = profiles.find((p) => p.id === ownerId);
    const previousOwnerId = task.owner_id;

    const progressVal = status === "Done" ? 100 : progressMode === "quantity" ? calculatedProgress : progress;
    const quantityDoneVal = quantityDone === "" ? null : Number(quantityDone);
    const quantityTotalVal = quantityTotal === "" ? null : Number(quantityTotal);
    const plannedHoursVal = plannedHours === "" ? 0 : Math.max(0, Number(plannedHours) || 0);
    const updatePayload: TaskUpdate = {
      title,
      status,
      priority,
      board_column: status,
      planned_hours: plannedHoursVal,
      progress_mode: progressMode,
      progress: progressVal,
      quantity_done: progressMode === "quantity" ? quantityDoneVal : task.quantity_done,
      quantity_total: progressMode === "quantity" ? quantityTotalVal : task.quantity_total,
      owner_id: ownerId || null,
      owner_name: owner?.full_name ?? null,
      start_date: startDate || null,
      due_date: dueDate || null,
    };

    try {
      const updatedTask = await updateTaskMutation.mutateAsync({ taskId: task.id, payload: updatePayload });
      toast.success("تم الحفظ");
      recalcProjectProgress(updatedTask.project_id);

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

      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`ما نجح حفظ التغييرات: ${message}`);
    }
  };

  const resetTimeEntryForm = () => {
    setEditingTimeEntry(null);
    setTimeDate(new Date().toISOString().split("T")[0]);
    setTimeHours("");
    setTimeNote("");
    setTimeUserId(task.owner_id || currentUserId);
  };

  const handleTimeEntrySubmit = async () => {
    const hours = Number(timeHours);
    const userId = timeUserId || currentUserId;

    if (!currentUserId) {
      toast.error("لم نتمكن من تحديد المستخدم الحالي");
      return;
    }
    if (!userId) {
      toast.error("اختر صاحب الساعات");
      return;
    }
    if (!timeDate) {
      toast.error("اختر تاريخ العمل");
      return;
    }
    if (!hours || hours <= 0 || hours > 24) {
      toast.error("عدد الساعات يجب أن يكون أكبر من صفر ولا يتجاوز 24");
      return;
    }

    try {
      if (editingTimeEntry) {
        await updateTimeEntryMutation.mutateAsync({
          entryId: editingTimeEntry.id,
          payload: {
            user_id: userId,
            work_date: timeDate,
            hours,
            note: timeNote.trim() || null,
          },
        });
        toast.success("تم تحديث الساعات");
      } else {
        await createTimeEntryMutation.mutateAsync({
          task_id: task.id,
          user_id: userId,
          logged_by: currentUserId,
          work_date: timeDate,
          hours,
          note: timeNote.trim() || null,
        });
        toast.success("تم تسجيل الساعات");
      }
      resetTimeEntryForm();
      await refreshTaskAfterTimeChange();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`ما نجح حفظ الساعات: ${message}`);
    }
  };

  const handleEditTimeEntry = (entry: TaskTimeEntryWithUser) => {
    setEditingTimeEntry(entry);
    setTimeUserId(entry.user_id);
    setTimeDate(entry.work_date);
    setTimeHours(entry.hours.toString());
    setTimeNote(entry.note ?? "");
  };

  const handleDeleteTimeEntry = async (entryId: string) => {
    try {
      await deleteTimeEntryMutation.mutateAsync(entryId);
      toast.success("تم حذف الساعات");
      if (editingTimeEntry?.id === entryId) resetTimeEntryForm();
      await refreshTaskAfterTimeChange();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`ما نجح حذف الساعات: ${message}`);
    }
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
            <button onClick={handleSave} disabled={updateTaskMutation.isPending}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 font-medium disabled:opacity-60 flex items-center gap-2 transition-colors shadow-sm active:scale-95">
              {updateTaskMutation.isPending && <Loader2 size={15} className="animate-spin" />}
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

              {/* Date Duration */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                  مدة المهمة بالأيام
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">بدأت في</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full pl-2 pr-8 py-2 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white shadow-sm hover:border-slate-300 transition-colors"
                      />
                      <CalendarDays size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">انتهت في</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full pl-2 pr-8 py-2 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white shadow-sm hover:border-slate-300 transition-colors"
                      />
                      <CalendarDays size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div
                  className={cn(
                    "mt-2 rounded-lg border px-3 py-2 text-xs font-bold",
                    dateDuration.isValidRange
                      ? "border-indigo-100 bg-indigo-50 text-indigo-700"
                      : "border-red-100 bg-red-50 text-red-600"
                  )}
                >
                  {dateDuration.hasBothDates ? `استمرت: ${dateDuration.label}` : dateDuration.label}
                </div>
              </div>

              {/* Planned and Actual Hours */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={16} className="text-slate-400" />
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">الساعات</h4>
                </div>

                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-600 mb-2">الساعات المخططة</label>
                  <input
                    type="number"
                    min={0}
                    step={0.25}
                    value={plannedHours}
                    onChange={(e) => setPlannedHours(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white shadow-sm"
                    placeholder="0"
                  />
                </div>

                <div
                  className={cn(
                    "rounded-xl border p-3 mb-3 bg-white",
                    hourSummary.isOverPlan ? "border-red-200 bg-red-50/50" : "border-slate-200"
                  )}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                    <span>فعلي / مخطط</span>
                    <span className={hourSummary.isOverPlan ? "text-red-600" : "text-indigo-600"}>
                      {hourSummary.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-xl font-black text-slate-800">{formatHours(hourSummary.actual)}</span>
                    <span className="text-xs text-slate-400">
                      / {hourSummary.hasPlan ? formatHours(hourSummary.planned) : "بدون مخطط"} س
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", hourSummary.isOverPlan ? "bg-red-500" : "bg-indigo-500")}
                      style={{ width: `${hourProgressWidth}%` }}
                    />
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    {hourSummary.hasPlan
                      ? hourSummary.isOverPlan
                        ? `زائد ${formatHours(hourSummary.overrun)} س`
                        : `متبقي ${formatHours(hourSummary.remaining)} س`
                      : "الفعلية محفوظة بدون مخطط"}
                    {hourSummary.utilization !== null && (
                      <span className="mr-2 font-semibold">{hourSummary.utilization}%</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">التاريخ</label>
                      <input
                        type="date"
                        value={timeDate}
                        onChange={(e) => setTimeDate(e.target.value)}
                        className="w-full px-2 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">الساعات</label>
                      <input
                        type="number"
                        min={0.25}
                        max={24}
                        step={0.25}
                        value={timeHours}
                        onChange={(e) => setTimeHours(e.target.value)}
                        className="w-full px-2 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        placeholder="1.5"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">صاحب الساعات</label>
                    <select
                      value={timeUserId}
                      onChange={(e) => setTimeUserId(e.target.value)}
                      className="w-full px-2 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white"
                    >
                      <option value="">اختر المستخدم</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name ?? p.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={timeNote}
                    onChange={(e) => setTimeNote(e.target.value)}
                    rows={2}
                    className="w-full px-2 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                    placeholder="ملاحظة اختيارية"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleTimeEntrySubmit}
                      disabled={createTimeEntryMutation.isPending || updateTimeEntryMutation.isPending}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {createTimeEntryMutation.isPending || updateTimeEntryMutation.isPending ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : editingTimeEntry ? (
                        <Pencil size={12} />
                      ) : (
                        <Plus size={12} />
                      )}
                      {editingTimeEntry ? "تحديث" : "إضافة"}
                    </button>
                    {editingTimeEntry && (
                      <button
                        type="button"
                        onClick={resetTimeEntryForm}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {loadingTimeEntries ? (
                    <div className="flex justify-center py-3">
                      <Loader2 size={16} className="animate-spin text-slate-300" />
                    </div>
                  ) : timeEntries.length === 0 ? (
                    <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">لا توجد ساعات فعلية بعد.</p>
                  ) : (
                    timeEntries.map((entry) => (
                      <div key={entry.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700">
                              {formatHours(entry.hours)} س
                              <span className="font-medium text-slate-400"> · {formatDateShort(entry.work_date)}</span>
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-slate-500">
                              {entry.user?.full_name ?? "مستخدم"}
                            </p>
                            {entry.note && <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{entry.note}</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label="تعديل الساعات"
                              onClick={() => handleEditTimeEntry(entry)}
                              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              aria-label="حذف الساعات"
                              onClick={() => handleDeleteTimeEntry(entry.id)}
                              disabled={deleteTimeEntryMutation.isPending}
                              className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
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
