import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PROJECT_WITH_MANAGER_SELECT,
  getScopedProjects,
  uniqueProjectIds,
  type ProjectListScope,
  type ProjectWithManager,
} from "@/lib/projects/project-access";
import type { Challenge, Comment, Database, Profile, Project, ProjectMember, Task } from "@/lib/supabase/types";

const DASHBOARD_TASK_SELECT = "*, owner:profiles(id,full_name,avatar_url), project:projects(id,name)";
const DASHBOARD_CHALLENGE_SELECT = "*, owner:profiles(id,full_name), project:projects(id,name)";
const DASHBOARD_COMMENT_SELECT =
  "id, body, created_at, task_id, user:profiles(full_name), task:tasks(id,title,project_id)";

type DashboardTask = Task & {
  owner?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
  project?: Pick<Project, "id" | "name"> | null;
};

type DashboardChallenge = Challenge & {
  owner?: Pick<Profile, "id" | "full_name"> | null;
  project?: Pick<Project, "id" | "name"> | null;
};

type DashboardComment = Pick<Comment, "id" | "body" | "created_at" | "task_id"> & {
  user?: Pick<Profile, "full_name"> | null;
  task?: Pick<Task, "id" | "title" | "project_id"> | null;
};

type DashboardProjectMember = Pick<ProjectMember, "project_id" | "user_id" | "role_in_project">;

export interface DashboardWorkspaceData {
  projects: ProjectWithManager[];
  tasks: DashboardTask[];
  projectMembers: DashboardProjectMember[];
  challenges: DashboardChallenge[];
  comments: DashboardComment[];
}

async function getDashboardProjects(
  supabase: SupabaseClient<Database>,
  user: Pick<Profile, "id" | "role">,
  scope: ProjectListScope
) {
  return getScopedProjects<ProjectWithManager>(supabase, user, scope, {
    select: PROJECT_WITH_MANAGER_SELECT,
    sortField: "updated_at",
  });
}

async function getDashboardRowsForProjects(
  supabase: SupabaseClient<Database>,
  scope: ProjectListScope,
  projectIds: string[]
) {
  const tasksQuery = supabase.from("tasks").select(DASHBOARD_TASK_SELECT).order("due_date", {
    ascending: true,
    nullsFirst: false,
  });
  const projectMembersQuery = supabase.from("project_members").select("project_id,user_id,role_in_project");
  const challengesQuery = supabase.from("challenges").select(DASHBOARD_CHALLENGE_SELECT).order("created_at", {
    ascending: false,
  });

  return Promise.all([
    scope === "mine" ? tasksQuery.in("project_id", projectIds) : tasksQuery,
    scope === "mine" ? projectMembersQuery.in("project_id", projectIds) : projectMembersQuery,
    scope === "mine" ? challengesQuery.in("project_id", projectIds) : challengesQuery,
  ]);
}

async function getDashboardComments(supabase: SupabaseClient<Database>, scope: ProjectListScope, taskIds: string[]) {
  if (scope === "mine" && taskIds.length === 0) return [];

  const query = supabase.from("comments").select(DASHBOARD_COMMENT_SELECT).order("created_at", { ascending: false });
  const { data } = await (scope === "mine" ? query.in("task_id", taskIds).limit(12) : query.limit(12));

  return (data ?? []) as unknown as DashboardComment[];
}

export async function getDashboardWorkspaceData(
  supabase: SupabaseClient<Database>,
  user: Pick<Profile, "id" | "role">,
  scope: ProjectListScope
): Promise<DashboardWorkspaceData> {
  const projects = await getDashboardProjects(supabase, user, scope);
  const projectIds = uniqueProjectIds(projects.map((project) => project.id));

  if (scope === "mine" && projectIds.length === 0) {
    return { projects, tasks: [], projectMembers: [], challenges: [], comments: [] };
  }

  const [{ data: tasks }, { data: projectMembers }, { data: challenges }] = await getDashboardRowsForProjects(
    supabase,
    scope,
    projectIds
  );
  const dashboardTasks = (tasks ?? []) as unknown as DashboardTask[];
  const taskIds = uniqueProjectIds(dashboardTasks.map((task) => task.id));

  return {
    projects,
    tasks: dashboardTasks,
    projectMembers: (projectMembers ?? []) as DashboardProjectMember[],
    challenges: (challenges ?? []) as unknown as DashboardChallenge[],
    comments: await getDashboardComments(supabase, scope, taskIds),
  };
}
