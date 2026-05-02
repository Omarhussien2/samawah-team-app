"use client";

import Link from "next/link";
import {
  MessageSquare, Bell, UserPlus, AlertTriangle, 
  CheckCircle2, AtSign, Clock, Loader2, CheckCheck
} from "lucide-react";
import { formatRelativeAr, cn } from "@/lib/utils";
import type { Notification } from "@/lib/supabase/types";

interface NotificationListProps {
  notifications: Notification[];
  loading: boolean;
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
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

export function NotificationList({
  notifications,
  loading,
  unreadCount,
  onMarkAsRead,
  onMarkAllRead,
  onClose,
}: NotificationListProps) {
  return (
    <div className="absolute left-0 mt-2 w-[380px] bg-white rounded-2xl shadow-2xl border border-border z-50 overflow-hidden animate-in slide-in-from-top-2 fade-in-0 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-l from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">الإشعارات</h3>
          {unreadCount > 0 && (
            <span className="bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
              {unreadCount} جديد
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            <CheckCheck size={14} />
            قراءة الكل
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
              <Bell size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">لا توجد إشعارات</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const Icon = typeIcons[notification.type ?? ""] ?? Bell;
            const colorClass = typeColors[notification.type ?? ""] ?? "bg-gray-100 text-gray-600";
            const isUnread = !notification.read_at;

            return (
              <button
                key={notification.id}
                onClick={() => {
                  if (isUnread) onMarkAsRead(notification.id);
                }}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 text-right transition-colors border-b border-border/50 last:border-b-0",
                  isUnread
                    ? "bg-primary/[0.03] hover:bg-primary/[0.06]"
                    : "hover:bg-accent/50"
                )}
              >
                {/* Icon */}
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5", colorClass)}>
                  <Icon size={16} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm leading-tight",
                    isUnread ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}>
                    {notification.title}
                  </p>
                  {notification.body && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                      {notification.body}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    {formatRelativeAr(notification.created_at)}
                  </p>
                </div>

                {/* Unread dot */}
                {isUnread && (
                  <div className="w-2.5 h-2.5 bg-primary rounded-full flex-shrink-0 mt-2 animate-pulse" />
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border">
        <Link
          href="/notifications"
          onClick={onClose}
          className="block text-center text-sm text-primary font-medium py-3 hover:bg-primary/5 transition-colors"
        >
          عرض جميع الإشعارات
        </Link>
      </div>
    </div>
  );
}
