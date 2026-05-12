import type { QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Database, Profile, Task } from "@/lib/supabase/types";

export type TaskUpdatePayload = Database["public"]["Tables"]["tasks"]["Update"];
export type TaskWithRelations = Task & {
  project?: { id: string; name: string } | null;
  owner?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
};

export const taskSelect = "*, project:projects(id,name), owner:profiles(id,full_name,avatar_url)";

export const taskKeys = {
  all: ["tasks"] as const,
  myTasks: (userId: string) => [...taskKeys.all, "my", userId] as const,
  byProject: (projectId: string) => [...taskKeys.all, "project", projectId] as const,
};

export async function fetchMyTasks(userId: string): Promise<TaskWithRelations[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(taskSelect)
    .eq("owner_id", userId)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as TaskWithRelations[];
}

export async function updateTask(taskId: string, payload: TaskUpdatePayload): Promise<TaskWithRelations> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", taskId)
    .select(taskSelect)
    .single();

  if (error) throw error;
  return data as TaskWithRelations;
}

export function markTaskDone(taskId: string) {
  return updateTask(taskId, { status: "Done", board_column: "Done", progress: 100 });
}

export function upsertTaskInList(tasks: TaskWithRelations[] | undefined, task: TaskWithRelations) {
  if (!tasks) return [task];
  if (tasks.some((item) => item.id === task.id)) {
    return tasks.map((item) => (item.id === task.id ? { ...item, ...task } : item));
  }
  return [...tasks, task];
}

export function removeTaskFromList(tasks: TaskWithRelations[] | undefined, taskId: string) {
  return (tasks ?? []).filter((task) => task.id !== taskId);
}

export function applyTaskToTaskQueries(queryClient: QueryClient, task: TaskWithRelations) {
  queryClient.setQueriesData<TaskWithRelations[]>({ queryKey: taskKeys.all }, (old) => {
    if (!old?.some((item) => item.id === task.id)) return old;
    return old.map((item) => (item.id === task.id ? { ...item, ...task } : item));
  });

  queryClient.setQueryData<TaskWithRelations[]>(taskKeys.myTasks(task.owner_id ?? ""), (old) =>
    upsertTaskInList(old, task)
  );
}

export function applyMyTaskRealtimeChange(
  queryClient: QueryClient,
  userId: string,
  eventType: string,
  task: TaskWithRelations
) {
  const key = taskKeys.myTasks(userId);

  if (eventType === "DELETE") {
    queryClient.setQueryData<TaskWithRelations[]>(key, (old) => removeTaskFromList(old, task.id));
    return;
  }

  queryClient.setQueryData<TaskWithRelations[]>(key, (old) => {
    if (task.owner_id !== userId) return removeTaskFromList(old, task.id);
    return upsertTaskInList(old, task);
  });
}
