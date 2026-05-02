"use client";

import { useState, useCallback } from "react";
import {
  Bell, MessageSquare, UserPlus, AlertTriangle,
  CheckCircle2, AtSign, Clock, CheckCheck, Loader2, Inbox
} from "lucide-react";
import { formatRelativeAr, formatDateAr, cn } from "@/lib/utils";
import { useNotificationSubscription } from "@/lib/supabase/realtime";
import { toast } from "sonner";
import type { Notification } from "@/lib/supabase/types";

interface Props {
  initialNotifications: Notification[];
  totalCount: number;
  userId: string;
}

const typeIcons: Record<string, typeof Bell> = {
  comment: MessageSquare,
  task_assigned: UserPlus,
  task_status: CheckCircle2,
  mention: AtSign,
  reminder: Clock,
  overdue: AlertTriangle,
  daily_digest: Bell,
  project_status: CheckCircle2,
};

const typeLabels: Record<string, string> = {
  comment: "تعليق",
  task_assigned: "تعيين مهمة",
  task_status: "تغيير حالة",
  mention: "إشارة",
  reminder: "تذكير",
  overdue: "تأخير",
  daily_digest: "ملخص يومي",
  project_status: "حالة مشروع",
};

const typeColors: Record<string, string> = {
  comment: "bg-blue-100 text-blue-600",
  task_assigned: "bg-indigo-100 text-indigo-600",
  task_status: "bg-green-100 text-green-600",
  mention: "bg-purple-100 text-purple-600",
  reminder: "bg-amber-100 text-amber-600",
  overdue: "bg-red-100 text-red-600",
  daily_digest: "bg-sky-100 text-sky-600",
  project_status: "bg-teal-100 text-teal-600",
};

export function NotificationsPageClient({ initialNotifications, totalCount, userId }: Props) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [total, setTotal] = useState(totalCount);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  // Realtime subscription
  const handleNewNotification = useCallback(
    (payload: Record<string, unknown>) => {
      const notification = payload as unknown as Notification;
      setNotifications((prev) => [notification, ...prev]);
      setTotal((prev) => prev + 1);
      toast.info(notification.title ?? "إشعار جديد");
    },
    []
  );
  useNotificationSubscription(userId, handleNewNotification);

  const filteredNotifications = filter === "unread"
    ? notifications.filter((n) => !n.read_at)
    : notifications;

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    } catch {
      toast.error("فشل تحديث الإشعار");
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
      );
      toast.success("تم تحديد الكل كمقروء");
    } catch {
      toast.error("فشل تحديث الإشعارات");
    } finally {
      setMarkingAll(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || notifications.length >= total) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/notifications?limit=20&offset=${notifications.length}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications((prev) => [...prev, ...data.notifications]);
        setTotal(data.total);
      }
    } catch {
      toast.error("فشل تحميل المزيد");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الإشعارات</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total} إشعار • {unreadCount} غير مقروء
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-muted rounded-xl w-fit">
        {(["all", "unread"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-all",
              filter === tab
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "all" ? "الكل" : `غير مقروء (${unreadCount})`}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center">
              <Inbox size={28} className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">
              {filter === "unread" ? "لا توجد إشعارات غير مقروءة" : "لا توجد إشعارات"}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            const Icon = typeIcons[notification.type ?? ""] ?? Bell;
            const colorClass = typeColors[notification.type ?? ""] ?? "bg-gray-100 text-gray-600";
            const label = typeLabels[notification.type ?? ""] ?? "إشعار";
            const isUnread = !notification.read_at;

            return (
              <div
                key={notification.id}
                onClick={() => { if (isUnread) markAsRead(notification.id); }}
                className={cn(
                  "flex items-start gap-4 px-5 py-4 border-b border-border/50 last:border-b-0 cursor-pointer transition-colors",
                  isUnread
                    ? "bg-primary/[0.02] hover:bg-primary/[0.05]"
                    : "hover:bg-accent/30"
                )}
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5", colorClass)}>
                  <Icon size={18} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-md",
                      colorClass
                    )}>
                      {label}
                    </span>
                    {isUnread && (
                      <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    )}
                  </div>
                  <p className={cn(
                    "text-sm",
                    isUnread ? "font-semibold text-foreground" : "text-foreground/80"
                  )}>
                    {notification.title}
                  </p>
                  {notification.body && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {notification.body}
                    </p>
                  )}
                </div>

                <div className="text-left flex-shrink-0 min-w-[80px]">
                  <p className="text-[11px] text-muted-foreground/60">
                    {formatRelativeAr(notification.created_at)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                    {formatDateAr(notification.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Load More */}
      {notifications.length < total && (
        <div className="text-center mt-6">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-2.5 text-sm font-medium text-primary bg-primary/5 rounded-xl hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            {loadingMore ? (
              <Loader2 size={14} className="animate-spin inline ml-2" />
            ) : null}
            تحميل المزيد
          </button>
        </div>
      )}
    </>
  );
}
