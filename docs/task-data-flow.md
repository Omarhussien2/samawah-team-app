# Task Data Flow

This app uses React Query as the client-side source of truth for task lists that can change after the first server render.

## Query Keys

Task query helpers live in `lib/queries/tasks.ts`.

Use these shared keys:

- `taskKeys.all` for broad invalidation after any task mutation.
- `taskKeys.list()` for the global board task list.
- `taskKeys.byProject(projectId)` for a project-scoped task list.
- `taskKeys.myTasks(userId)` for the signed-in user's assigned tasks.

Do not introduce a second `useState(tasks)` source for data already managed by React Query. Local state is fine for UI-only values such as selected filters, selected task ids, modal open state, search input, or form drafts.

## Fetching

Server pages still fetch initial data for fast first render, then client components pass that array to `useQuery` as `initialData`.

Current task readers:

- `ProjectDetailClient` observes `taskKeys.byProject(project.id)` so overview counts, members, the table, and the board see the same cached project task list.
- `TasksTable` observes `taskKeys.byProject(projectId)` when scoped to a project, otherwise `taskKeys.list()`.
- `KanbanBoard` observes `taskKeys.byProject(projectId)` for project boards and `taskKeys.list()` for the global board.
- `MyTasksClient` observes `taskKeys.myTasks(currentUser.id)`.

## Mutations

Task mutations should go through `lib/queries/tasks.ts`:

- `createTask(payload)`
- `updateTask(taskId, payload)`
- `markTaskDone(taskId)`

After a successful mutation:

1. Write the returned row into the relevant task cache with the shared helpers.
2. Invalidate `taskKeys.all` so joined fields such as `project.name` and `owner.full_name` are refreshed.
3. Keep notification side effects and project progress recalculation outside the cache helpers.

## Cache Helpers

Use the shared cache helpers instead of hand-rolled list updates:

- `applyTaskChangeToList(tasks, eventType, task, scope)` is the pure list updater.
- `applyTaskListChange(queryClient, queryKey, eventType, task, scope)` updates one cached list.
- `applyTaskToTaskQueries(queryClient, task)` merges a saved task into existing task caches.
- `applyCreatedTaskToTaskQueries(queryClient, task)` inserts a newly created task into global, project, and owner caches.
- `applyMyTaskRealtimeChange(queryClient, userId, eventType, task)` keeps My Tasks scoped to the current owner.

## Realtime

Realtime subscriptions should update React Query cache, then invalidate the matching task key. This avoids duplicate rows while still refreshing relation fields that realtime payloads do not include.

For project and board views, `KanbanBoard` listens to task changes and calls `applyTaskListChange` against the board's current query key.

For My Tasks, `MyTasksClient` listens with an owner filter and calls `applyMyTaskRealtimeChange`. That helper removes a task if it no longer belongs to the current user and removes deleted tasks by id.

## UI Flow

Task editing from `TaskModal` updates the shared cache after the server confirms the save. The modal closes from local UI state; it should not rely on `router.refresh()` to make the list correct.

Board drag-and-drop also waits for the server result, then writes the saved row into React Query. This favors consistency over broad optimistic updates.

Quick add uses `createTask`, writes the returned task into React Query, invalidates `taskKeys.all`, and still calls `router.refresh()` so server-rendered dashboard summaries can catch up.

## Future Features

Delete task should remove the task from cached lists on success and invalidate `taskKeys.all`.

Attachments, subtasks, planned hours, and actual hours should add focused helpers in `lib/queries/tasks.ts`. If they change task summary fields, update or invalidate the relevant task query keys after success.
