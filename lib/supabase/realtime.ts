"use client";

import { useEffect, useRef } from "react";
import { createClient } from "./client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Subscribe to Supabase Realtime changes on a table.
 * Automatically unsubscribes on unmount.
 */
export function useRealtimeSubscription(
  table: string,
  filter: string | null,
  callback: (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void,
  enabled = true
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    const channelName = `realtime-${table}-${filter ?? "all"}-${Date.now()}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channelConfig: any = {
      event: "*",
      schema: "public",
      table,
    };

    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", channelConfig, (payload) => {
        callback({
          eventType: payload.eventType,
          new: (payload.new ?? {}) as Record<string, unknown>,
          old: (payload.old ?? {}) as Record<string, unknown>,
        });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [table, filter, callback, enabled]);

  return channelRef;
}

/**
 * Subscribe to notifications for the current user.
 */
export function useNotificationSubscription(
  userId: string | null,
  onNewNotification: (notification: Record<string, unknown>) => void
) {
  return useRealtimeSubscription(
    "notifications",
    userId ? `user_id=eq.${userId}` : null,
    (payload) => {
      if (payload.eventType === "INSERT") {
        onNewNotification(payload.new);
      }
    },
    !!userId
  );
}

/**
 * Subscribe to comments on a specific task.
 */
export function useCommentsSubscription(
  taskId: string | null,
  onNewComment: (comment: Record<string, unknown>) => void
) {
  return useRealtimeSubscription(
    "comments",
    taskId ? `task_id=eq.${taskId}` : null,
    (payload) => {
      if (payload.eventType === "INSERT") {
        onNewComment(payload.new);
      }
    },
    !!taskId
  );
}

/**
 * Subscribe to task changes (for board/kanban realtime updates).
 */
export function useTasksSubscription(
  projectId: string | null,
  onTaskChange: (payload: { eventType: string; task: Record<string, unknown> }) => void
) {
  return useRealtimeSubscription(
    "tasks",
    projectId ? `project_id=eq.${projectId}` : null,
    (payload) => {
      onTaskChange({
        eventType: payload.eventType,
        task: payload.eventType === "DELETE" ? payload.old : payload.new,
      });
    },
    true
  );
}
