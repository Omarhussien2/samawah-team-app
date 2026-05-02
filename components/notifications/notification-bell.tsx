"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useNotificationSubscription } from "@/lib/supabase/realtime";
import { NotificationList } from "./notification-list";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/supabase/types";

interface NotificationBellProps {
  userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch {
      // silent
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=15");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Load notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Realtime: listen for new notifications
  const handleNewNotification = useCallback(
    (payload: Record<string, unknown>) => {
      const notification = payload as unknown as Notification;
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
      toast.info(notification.title ?? "إشعار جديد", {
        description: (notification.body ?? "").substring(0, 80),
      });
    },
    []
  );

  useNotificationSubscription(userId, handleNewNotification);

  // Mark single as read
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
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  };

  // Mark all as read
  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // silent
    }
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2 rounded-lg transition-colors",
          isOpen
            ? "bg-primary/10 text-primary"
            : "hover:bg-accent text-muted-foreground"
        )}
        aria-label="الإشعارات"
        id="notification-bell"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 animate-in zoom-in-50 duration-200">
            {unreadCount > 99 ? "+99" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationList
          notifications={notifications}
          loading={loading}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onMarkAllRead={markAllRead}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
