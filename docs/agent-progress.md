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

## Current Task

### Task 02 - KPI Center Field QA / Workspaces

- Branch: `fix/kpi-center-field-qa`
- Started: 2026-05-17
- PR: https://github.com/Omarhussien2/samawah-team-app/pull/26
- Status: Draft PR opened

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
