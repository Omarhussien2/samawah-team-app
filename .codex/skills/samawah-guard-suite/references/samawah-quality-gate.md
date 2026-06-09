# Samawah Quality Gate

Use this checklist after any Samawah Team App change.

## Scope

- Keep changes narrowly tied to the user request.
- Do not stage unrelated untracked files or generated reports.
- Avoid broad refactors unless they are required to make the requested change safe.
- Preserve existing role permissions; UI view modes must never grant access beyond Supabase RLS.

## Supabase And Security

- Client code uses the anon browser client only.
- Service-role access stays server-side in routes, server actions, scripts, or cron paths that genuinely need it.
- Any schema change updates `supabase/schema.sql`, `supabase/rls.sql` if needed, and `lib/supabase/types.ts`.
- RLS changes must be reviewed for admin, project manager, member, project membership, task ownership, and share-link access.
- Auth/profile logic must not let users self-escalate `profiles.role`.
- Mutations for projects, tasks, expenses, risks, documents, KPIs, and notifications must refresh or invalidate the UI data they affect.

## Next.js And React

- Keep App Router boundaries clear: server data loading in route/page components, browser-only interactions in client components.
- Avoid passing secrets or service-role results into client components.
- Prefer existing shadcn/ui components and local helpers over new UI patterns.
- For dashboard and analytics interactions, clicks should either navigate with query filters or visibly filter the relevant section.
- URL query filters should survive refresh and be shareable when they represent user intent.

## Arabic RTL UX

- Visible app copy is Arabic only.
- Layouts must respect `dir="rtl"` and work on mobile.
- Avoid crowded dashboard screens; move advanced analytics into dedicated pages, drawers, dialogs, or drill-down views.
- Use concise action labels. If the sidebar already exposes a destination, avoid duplicate hero/header action buttons.
- Icons should clarify actions, not add decoration.

## Data And Calculations

- Project progress stays consistent with `lib/utils/recalc-progress.ts`.
- Budget, expense, KPI, and task-hour calculations need units, zero-state handling, and tests when logic changes.
- Do not silently hide database or permission failures behind empty data unless the UX explicitly treats it as no-access or empty state.

## Verification

Run in this order before commit or push:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Run `pnpm build` for production-facing UI, routing, API, middleware/proxy, or deploy-risk changes.

If warnings remain, distinguish old warnings from new ones.

