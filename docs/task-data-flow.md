# Task Data Flow

This app uses React Query as the client-side source of truth for task lists that can change after the first server render.

## Fetching

Task query helpers live in `lib/queries/tasks.ts`.

Use the shared query keys:

- `taskKeys.all`
- `taskKeys.myTasks(userId)`
- `taskKeys.byProject(projectId)`

The My Tasks page still fetches initial data in `app/(app)/my-tasks/page.tsx` for a fast first render. `components/tasks/my-tasks-client.tsx` passes that array to `useQuery` as `initialData`, then reads all filtering and counts from the React Query result.

## Mutations

Task mutations also live in `lib/queries/tasks.ts`.

Current helpers:

- `updateTask(taskId, payload)`
- `markTaskDone(taskId)`

`TaskModal` uses `useMutation` with `updateTask`. The mutation returns the saved row using the same task select shape as list fetching, including `project` and `owner` relations.

## Cache Updates

After a task update, update the relevant cache immediately and then invalidate the query:

```ts
const updatedTask = await updateTask(taskId, payload);
applyMyTaskRealtimeChange(queryClient, userId, "UPDATE", updatedTask);
queryClient.invalidateQueries({ queryKey: taskKeys.myTasks(userId) });
```

Use immediate cache writes for responsive UI. Use invalidation after writes or realtime events to re-fetch joined fields that may not be present in realtime payloads, such as `project.name` or `owner.full_name`.

For create and delete flows, follow the same shape:

- Create: insert/upsert the task into the relevant list cache, then invalidate.
- Update: merge the task into existing cached rows, then invalidate.
- Delete: remove the task id from cached lists, then invalidate.

## Realtime

Realtime subscriptions should update React Query cache, not local task arrays.

For My Tasks, `useRealtimeSubscription("tasks", owner filter, ...)` calls `applyMyTaskRealtimeChange`. That helper prevents duplicates by checking task ids and removes deleted tasks from the list. The component also invalidates the My Tasks query after realtime events so related data stays complete.

Avoid introducing a second `useState(tasks)` source for data that already lives in React Query. Local state is fine for UI-only values such as selected filter, selected task id, open modals, search input, or form draft values.

## Future Features

Search and filters should operate on `useQuery` data. If search becomes server-side, include the search term in the query key, for example `["tasks", "my", userId, { search }]`.

Delete task should use a mutation helper in `lib/queries/tasks.ts`, remove the task from cache on success, and invalidate the matching task keys.

Attachments, subtasks, planned hours, and actual hours should add focused helpers in the same data layer. If they change task summary fields, update or invalidate the relevant task query keys after success.

## Example Mutation

```ts
const mutation = useMutation({
  mutationFn: ({ taskId, payload }) => updateTask(taskId, payload),
  onSuccess: (task) => {
    applyMyTaskRealtimeChange(queryClient, userId, "UPDATE", task);
    queryClient.invalidateQueries({ queryKey: taskKeys.myTasks(userId) });
  },
});
```

Keep notification side effects, project progress recalculation, and comments separate from the task cache helpers unless they directly change task rows.
