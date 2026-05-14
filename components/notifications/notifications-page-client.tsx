"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Inbox,
  Loader2,
  Mail,
  MessageSquare,
  Settings,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateAr, formatRelativeAr, cn } from "@/lib/utils";
import { useNotificationSubscription } from "@/lib/supabase/realtime";
import type { Notification } from "@/lib/supabase/types";
import type { NotificationAction, NotificationCategory, NotificationPriority } from "@/lib/notifications/types";

interface Props {
  initialNotifications: Notification[];
  totalCount: number;
  userId: string;
}

type ViewFilter = "all" | "important" | "summaries" | "unread";
type PriorityFilter = "all" | NotificationPriority;
type CategoryFilter = "all" | NotificationCategory;

const typeIcons: Record<string, typeof Bell> = {
  comment: MessageSquare,
  task_assigned: UserPlus,
  task_status: CheckCircle2,
  mention: MessageSquare,
  reminder: Clock,
  overdue: AlertTriangle,
  daily_digest: Bell,
  manager_followup: AlertTriangle,
  project_status: CheckCircle2,
};

const categoryLabels: Record<NotificationCategory, string> = {
  task: "المهام",
  project: "المشاريع",
  challenge: "التحديات",
  form: "النماذج",
  kpi: "المؤشرات",
  digest: "الملخصات",
  comment: "التعليقات",
  system: "النظام",
};

const priorityLabels: Record<NotificationPriority, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "مهم",
  critical: "حرج",
};

const priorityColors: Record<NotificationPriority, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

const categoryFilters: Array<{ value: CategoryFilter; label: string }> = [
  { value: "all", label: "كل الأنواع" },
  { value: "task", label: "المهام" },
  { value: "project", label: "المشاريع" },
  { value: "challenge", label: "التحديات" },
  { value: "form", label: "النماذج" },
  { value: "kpi", label: "المؤشرات" },
  { value: "digest", label: "الملخصات" },
];

const priorityFilters: Array<{ value: PriorityFilter; label: string }> = [
  { value: "all", label: "كل الأولويات" },
  { value: "critical", label: "حرج" },
  { value: "high", label: "مهم" },
  { value: "medium", label: "متوسط" },
  { value: "low", label: "منخفض" },
];

function tomorrowIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

function getNotificationIcon(notification: Notification) {
  return typeIcons[notification.type ?? ""] ?? (notification.priority === "critical" ? AlertTriangle : Bell);
}

function isImportant(notification: Notification) {
  return notification.priority === "high" || notification.priority === "critical";
}

export function NotificationsPageClient({ initialNotifications, totalCount, userId }: Props) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialView = searchParams.get("important") === "true"
    ? "important"
    : tabParam === "summaries"
      ? "summaries"
      : "all";
  const [notifications, setNotifications] = useState(initialNotifications);
  const [total, setTotal] = useState(totalCount);
  const [view, setView] = useState<ViewFilter>(initialView);
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read_at).length, [notifications]);
  const importantCount = useMemo(() => notifications.filter((n) => isImportant(n) && n.status !== "done").length, [notifications]);
  const summariesCount = useMemo(() => notifications.filter((n) => n.category === "digest").length, [notifications]);

  const buildQuery = useCallback((offset = 0) => {
    const params = new URLSearchParams({ limit: "20", offset: `${offset}` });
    if (view === "important") params.set("important", "true");
    if (view === "summaries") params.set("category", "digest");
    if (priority !== "all") params.set("priority", priority);
    if (category !== "all") params.set("category", category);
    return params.toString();
  }, [category, priority, view]);

  const refreshNotifications = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/notifications?${buildQuery(0)}`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setNotifications(data.notifications);
      setTotal(data.total);
    } catch {
      toast.error("ما نجح تحديث الإشعارات");
    } finally {
      setRefreshing(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const handleNewNotification = useCallback((payload: Record<string, unknown>) => {
    const notification = payload as unknown as Notification;
    setNotifications((prev) => [notification, ...prev]);
    setTotal((prev) => prev + 1);
    toast.info(notification.title ?? "إشعار جديد", {
      description: (notification.body ?? "").slice(0, 90),
    });
  }, []);
  useNotificationSubscription(userId, handleNewNotification);

  const runAction = async (id: string, action: NotificationAction, snoozedUntil?: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/notifications/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, snoozed_until: snoozedUntil }),
      });
      if (!res.ok) throw new Error("failed");

      const now = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n;
          if (action === "read") return { ...n, read_at: now };
          if (action === "done") return { ...n, status: "done", read_at: now, dismissed_at: now };
          if (action === "dismiss") return { ...n, status: "dismissed", read_at: now, dismissed_at: now };
          if (action === "snooze") return { ...n, status: "snoozed", read_at: now, snoozed_until: snoozedUntil ?? now };
          if (action === "archive") return { ...n, status: "archived", read_at: now, archived_at: now };
          return n;
        })
      );

      if (action === "done") toast.success("تم التعامل مع الإشعار");
      if (action === "dismiss") toast.success("تم تجاهل الإشعار");
      if (action === "snooze") toast.success("تم تأجيل التذكير");
    } catch {
      toast.error("ما نجح تنفيذ الإجراء");
    } finally {
      setBusyId(null);
    }
  };

  const markAsRead = (id: string) => runAction(id, "read");

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true }),
      });
      if (!res.ok) throw new Error("failed");
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
      );
      toast.success("تم تحديد الكل كمقروء");
    } catch {
      toast.error("ما نجح تحديث الإشعارات");
    } finally {
      setMarkingAll(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || notifications.length >= total) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/notifications?${buildQuery(notifications.length)}`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setNotifications((prev) => [...prev, ...data.notifications]);
      setTotal(data.total);
    } catch {
      toast.error("ما نجح التحميل");
    } finally {
      setLoadingMore(false);
    }
  };

  const visibleNotifications = notifications.filter((notification) => {
    if (view === "unread" && notification.read_at) return false;
    if (view === "important" && !isImportant(notification)) return false;
    if (view === "summaries" && notification.category !== "digest") return false;
    if (notification.status === "archived") return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الإشعارات</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total} إشعار · {unreadCount} غير مقروء · {importantCount} مهم
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings?tab=notifications"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground bg-white border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <Settings size={14} />
            الإعدادات
          </Link>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {markingAll ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
              قراءة الكل
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "all", label: "الكل", count: total },
          { key: "important", label: "المهم", count: importantCount },
          { key: "summaries", label: "الملخصات", count: summariesCount },
          { key: "unread", label: "غير مقروء", count: unreadCount },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key as ViewFilter)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-all border",
              view === tab.key
                ? "bg-primary text-white border-primary"
                : "bg-white text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryFilter)}
          className="h-10 rounded-lg border border-border bg-white px-3 text-sm"
        >
          {categoryFilters.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as PriorityFilter)}
          className="h-10 rounded-lg border border-border bg-white px-3 text-sm"
        >
          {priorityFilters.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
        {refreshing ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={22} className="animate-spin text-muted-foreground" />
          </div>
        ) : visibleNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center">
              <Inbox size={28} className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">لا توجد إشعارات في هذا العرض</p>
          </div>
        ) : (
          visibleNotifications.map((notification) => {
            const Icon = getNotificationIcon(notification);
            const colorClass = priorityColors[notification.priority] ?? priorityColors.medium;
            const isUnread = !notification.read_at;
            const isBusy = busyId === notification.id;

            return (
              <div
                key={notification.id}
                className={cn(
                  "flex flex-col gap-3 px-5 py-4 border-b border-border/60 last:border-b-0 transition-colors",
                  isUnread ? "bg-primary/[0.02]" : "bg-white"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5", colorClass)}>
                    <Icon size={18} />
                  </div>

                  <button
                    onClick={() => { if (isUnread) markAsRead(notification.id); }}
                    className="flex-1 min-w-0 text-right"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={cn("text-xs px-2 py-0.5 rounded-md", colorClass)}>
                        {priorityLabels[notification.priority] ?? "متوسط"}
                      </span>
                      {notification.category && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                          {categoryLabels[notification.category] ?? "إشعار"}
                        </span>
                      )}
                      {notification.status === "done" && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-green-100 text-green-700">
                          تم التعامل
                        </span>
                      )}
                      {notification.status === "snoozed" && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">
                          مؤجل
                        </span>
                      )}
                      {isUnread && <span className="w-2 h-2 bg-primary rounded-full" />}
                    </div>
                    <p className={cn("text-sm", isUnread ? "font-semibold text-foreground" : "text-foreground/80")}>
                      {notification.title}
                    </p>
                    {notification.body && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">
                        {notification.body}
                      </p>
                    )}
                  </button>

                  <div className="text-left flex-shrink-0 min-w-[86px]">
                    <p className="text-[11px] text-muted-foreground/70">
                      {formatRelativeAr(notification.created_at)}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                      {formatDateAr(notification.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pr-14">
                  {notification.action_url && (
                    <Link
                      href={notification.action_url}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90"
                    >
                      <ExternalLink size={13} />
                      فتح
                    </Link>
                  )}
                  <button
                    onClick={() => runAction(notification.id, "done")}
                    disabled={isBusy || notification.status === "done"}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50"
                  >
                    {isBusy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    تم التعامل
                  </button>
                  <button
                    onClick={() => runAction(notification.id, "snooze", tomorrowIso())}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 disabled:opacity-50"
                  >
                    <Clock size={13} />
                    تذكيري غدًا
                  </button>
                  <button
                    onClick={() => runAction(notification.id, "dismiss")}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted text-muted-foreground rounded-lg hover:bg-accent disabled:opacity-50"
                  >
                    <Archive size={13} />
                    تجاهل اليوم
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {notifications.length < total && (
        <div className="text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-2.5 text-sm font-medium text-primary bg-primary/5 rounded-xl hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            {loadingMore ? <Loader2 size={14} className="animate-spin inline ml-2" /> : null}
            حمّل المزيد
          </button>
        </div>
      )}

      {view === "summaries" && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <Mail size={18} className="mt-0.5 flex-shrink-0" />
          <p>البريد يرسل للحالات المهمة فقط حسب التفضيلات، أما الإشعارات داخل المنصة فتظل هي القناة الأساسية.</p>
        </div>
      )}
    </div>
  );
}
