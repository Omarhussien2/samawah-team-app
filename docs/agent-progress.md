# Agent Progress Log

This file tracks the implementation state for agent-led work so a future session can continue without rediscovering context.

## Workflow

- Work one backlog task per branch and one PR per task.
- Do not merge to `main` directly.
- Before opening a PR, run: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Keep unrelated untracked files untouched.
- Discuss the next task's UX and benefit before editing code.

## Completed Tasks

### Task 03 - Search Functionality

- Branch: `fix/search-functionality`
- PR: https://github.com/Omarhussien2/samawah-team-app/pull/24
- Status: Merged into `main`
- Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed.

### Task 04 - Task Data Flow / React Query

- Branch: `refactor/task-data-flow`
- Started: 2026-05-17
- PR: https://github.com/Omarhussien2/samawah-team-app/pull/25
- Status: Merged into `main`

### UX Decisions

- Prefer server-confirmed updates for task edits and board moves.
- Use React Query cache writes after successful mutations, then invalidate task queries for fresh relation data.
- Avoid broad optimistic updates for now; small optimistic interactions can be added later if the flow stays predictable.
- Modals should close from local UI state, not depend on `router.refresh()` to make lists correct.

### Implementation Notes

- `lib/queries/tasks.ts` is the shared task data layer for fetching, creating, updating, and cache list updates.
- Project detail, task table, board, and My Tasks should read task rows from React Query.
- Realtime events should write into React Query and then invalidate the relevant task key.
- `docs/task-data-flow.md` documents the source-of-truth pattern.

### Verification

- `pnpm lint`: Passed with existing warnings only.
- `pnpm typecheck`: Passed.
- `pnpm test`: Passed, 9 files / 27 tests.
- `pnpm build`: Passed. Build still reports the existing Next.js middleware-to-proxy warning.
- Browser smoke test: `http://localhost:3001/board` redirected to `/login` because no auth session was available; login page loaded with 0 console errors.

### Task 02 - KPI Center Field QA / Workspaces

- Branch: `fix/kpi-center-field-qa`
- Started: 2026-05-17
- PR: https://github.com/Omarhussien2/samawah-team-app/pull/26
- Status: Merged into `main`

### UX Decisions

- Keep the KPI radar and cards visible, then add a section workspace below each section tab.
- Treat operational records as the editing surface for semi-automatic KPIs: products, project performance, revenue, clients, audience, services, and partnerships.
- After every save/delete, update the current period's `kpi_values` cache and roll monthly values into the matching quarter so executive and board-share views stay aligned.
- Revenue remains admin-only; other operational workspaces are editable by admins and project managers according to current RLS intent.

### Implementation Notes

- Added `components/kpis/kpi-workspace.tsx` for section records, charts, KPI cards, and record forms.
- Wired section tabs in `components/kpis/kpi-center-client.tsx` to render the matching workspace.
- Added a KPI auto-calculation test for clearing simple workspace values when records are deleted.

### Verification

- `pnpm lint`: Passed with existing warnings only.
- `pnpm typecheck`: Passed.
- `pnpm test`: Passed, 9 files / 28 tests.
- `pnpm build`: Passed. Build still reports the existing Next.js middleware-to-proxy warning.
- Browser smoke test: `http://localhost:3001/kpis` redirected to `/login` because no auth session was available; login page loaded with 0 console errors.

### Project Documents V1 - Detailed Project-Only Attachments

- Branch: `feat/project-documents-v1`
- Started: 2026-05-17
- PR: https://github.com/Omarhussien2/samawah-team-app/pull/27
- Status: Merged into `main`

### UX Decisions

- The user explicitly does not want task attachments. Document upload/detail work is project-only.
- Use the existing `documents` table and the private `documents` Supabase Storage bucket instead of creating `task_attachments`.
- A project document can be a real uploaded file, an external URL, or both.
- Documents carry operational metadata: type, project stage, original file name, MIME type, file size, creator, and timestamps.
- Project detail and global Documents pages should expose the same document actions: create, open, edit metadata, delete, and filter/search where relevant.

### Implementation Notes

- Added project-document metadata columns to `documents`: `file_name`, `file_type`, `file_size`, `stage`, and `updated_at`.
- Added Storage RLS policies for files stored under `documents/projects/{projectId}/...`.
- Task-related document UI remains out of scope for this task.

### Verification

- `pnpm lint`: Passed with existing warnings only.
- `pnpm typecheck`: Passed.
- `pnpm test`: Passed, 10 files / 30 tests.
- `pnpm build`: Passed. Build still reports the existing Next.js middleware-to-proxy warning.
- Browser smoke test: `http://127.0.0.1:3001/documents` and `/projects/test-project?tab=documents` redirected to `/login` because no auth session was available; login page loaded with 0 console errors.

### Follow-up Fix - Storage RLS

- Branch: `fix/project-document-storage-rls`
- Started: 2026-05-17
- PR: https://github.com/Omarhussien2/samawah-team-app/pull/28
- Status: Merged into `main`
- Reason: User reported upload failure: `new row violates row-level security policy`.
- Fix: Rework Storage policies through explicit `TO authenticated` policies and security-definer helpers; add `supabase/project-documents-storage-rls-fix.sql` for immediate Supabase SQL Editor application.
- Result: User confirmed document upload works after applying the SQL fix in Supabase.

### Follow-up Fix - Document Storage Key

- Branch: `codex/fix-document-storage-key`
- Started: 2026-05-17
- Reason: User reported PDF upload failure: `Invalid key` for a Storage path that included the Arabic original file name.
- Fix: Store uploaded files under an ASCII-safe technical object key (`uuid-document.ext`) while preserving the original file name in `documents.file_name` for display/search.
- Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed.

### Task - Task Display Hierarchy

- Branch: `codex/task-display-hierarchy`
- Started: 2026-05-17
- UX decision: In task lists/cards, show the sub task as the bold primary line because it carries the actionable task name, then show the task category/section below it as supporting context.
- Implementation notes: Added a shared `TaskTitleStack` and `getTaskDisplayLines()` helper; wired task table, board cards, My Tasks cards, and dashboard task lists to the same hierarchy.
- Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed.
