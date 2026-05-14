import type {
  Json,
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
} from "@/lib/supabase/types";

export type {
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
};

export interface NotificationPayload {
  user_id: string;
  actor_id?: string | null;
  project_id?: string | null;
  task_id?: string | null;
  challenge_id?: string | null;
  form_instance_id?: string | null;
  kpi_id?: string | null;
  category?: NotificationCategory | null;
  priority?: NotificationPriority;
  type: string;
  title: string;
  body: string;
  action_url?: string | null;
  metadata?: Json;
  dedupe_key?: string | null;
  status?: NotificationStatus;
  sent_via?: string | null;
  sent_at?: string | null;
  read_at?: string | null;
  expires_at?: string | null;
}

export type NotificationAction = "read" | "done" | "dismiss" | "snooze" | "archive";
