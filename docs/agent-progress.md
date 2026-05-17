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

## Current Task

### Task 04 - Task Data Flow / React Query

- Branch: `refactor/task-data-flow`
- Started: 2026-05-17
- PR: https://github.com/Omarhussien2/samawah-team-app/pull/25
- Status: Draft PR opened

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
