import type { QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Database, Profile, Task } from "@/lib/supabase/types";

export type TaskInsertPayload = Database["public"]["Tables"]["tasks"]["Insert"];
export type TaskUpdatePayload = Database["public"]["Tables"]["tasks"]["Update"];
export type TaskWithRelations = Task & {
  project?: { id: string; name: string } | null;
  owner?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
};
export type TaskRealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | string;

interface TaskListScope {
  projectId?: string | null;
  ownerId?: string | null;
}

export const taskSelect = "*, project:projects(id,name), owner:profiles(id,full_name,avatar_url)";

export const taskKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskKeys.all, "list"] as const,
  list: (projectId?: string | null) => [...taskKeys.lists(), projectId || "all"] as const,
  myTasks: (userId: string) => [...taskKeys.all, "my", userId] as const,
  byProject: (projectId: string) => taskKeys.list(projectId),
};

export async function fetchTasks({ projectId }: { projectId?: string | null } = {}): Promise<TaskWithRelations[]> {
  const supabase = createClient();
  let query = supabase.from("tasks").select(taskSelect);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query.order("sort_order");

  if (error) throw error;
  return (data ?? []) as TaskWithRelations[];
}

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

export async function createTask(payload: TaskInsertPayload): Promise<TaskWithRelations> {
  const supabase = createClient();
  const { data, error } = await supabase.from("tasks").insert(payload).select(taskSelect).single();

  if (error) throw error;
  return data as TaskWithRelations;
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

export function taskMatchesScope(task: TaskWithRelations, scope: TaskListScope = {}) {
  if (scope.projectId && task.project_id !== scope.projectId) return false;
  if (scope.ownerId && task.owner_id !== scope.ownerId) return false;
  return true;
}

export function applyTaskChangeToList(
  tasks: TaskWithRelations[] | undefined,
  eventType: TaskRealtimeEvent,
  task: TaskWithRelations,
  scope: TaskListScope = {}
) {
  if (eventType === "DELETE") return removeTaskFromList(tasks, task.id);
  if (!taskMatchesScope(task, scope)) return removeTaskFromList(tasks, task.id);
  return upsertTaskInList(tasks, task);
}

export function applyTaskListChange(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  eventType: TaskRealtimeEvent,
  task: TaskWithRelations,
  scope: TaskListScope = {}
) {
  queryClient.setQueryData<TaskWithRelations[]>(queryKey, (old) =>
    applyTaskChangeToList(old, eventType, task, scope)
  );
}

export function applyTaskToTaskQueries(queryClient: QueryClient, task: TaskWithRelations) {
  queryClient.setQueriesData<TaskWithRelations[]>({ queryKey: taskKeys.all }, (old) => {
    if (!old?.some((item) => item.id === task.id)) return old;
    return applyTaskChangeToList(old, "UPDATE", task);
  });

  if (task.owner_id) {
    applyTaskListChange(queryClient, taskKeys.myTasks(task.owner_id), "UPDATE", task, { ownerId: task.owner_id });
  }
}

export function applyCreatedTaskToTaskQueries(queryClient: QueryClient, task: TaskWithRelations) {
  applyTaskListChange(queryClient, taskKeys.list(), "INSERT", task);

  if (task.project_id) {
    applyTaskListChange(queryClient, taskKeys.byProject(task.project_id), "INSERT", task, {
      projectId: task.project_id,
    });
  }

  if (task.owner_id) {
    applyTaskListChange(queryClient, taskKeys.myTasks(task.owner_id), "INSERT", task, { ownerId: task.owner_id });
  }
}

export function applyMyTaskRealtimeChange(
  queryClient: QueryClient,
  userId: string,
  eventType: TaskRealtimeEvent,
  task: TaskWithRelations
) {
  applyTaskListChange(queryClient, taskKeys.myTasks(userId), eventType, task, { ownerId: userId });
}
