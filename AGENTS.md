# AGENTS.md — Samawah Team App

## Project Summary

Arabic-first (RTL) project management platform. Next.js 16 + Supabase + shadcn/ui. All UI text is in Arabic.

## Commands

```bash
pnpm install          # install deps (lockfile is pnpm-lock.yaml, NOT npm)
pnpm dev              # dev server on localhost:3000
pnpm build            # production build
pnpm lint             # ESLint (next/core-web-vitals + typescript)
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest run
```

**CI runs:** `lint` then `typecheck` (no test step in CI).

**Verification order before committing:** `lint` -> `typecheck` -> `test`.

## Architecture

- **App Router** with route group `(app)/` for protected pages, `/login` outside it
- `middleware.ts` redirects unauthenticated users to `/login` using Supabase SSR session
- `app/page.tsx` redirects `/` to `/dashboard`
- `lib/supabase/client.ts` — browser client (anon key)
- `lib/supabase/server.ts` — server client (cookies) + `createServiceClient()` (service_role key, no cookies)
- `lib/auth/get-user.ts` — fetches profile from `profiles` table; auto-creates if missing
- `lib/supabase/types.ts` — hand-written `Database` type (NOT auto-generated from Supabase CLI). Update manually when schema changes.
- `lib/utils/index.ts` — `cn()`, Arabic label maps, date formatters (`date-fns` with `ar` locale)
- `lib/utils/recalc-progress.ts` — computes project progress as `round(done_count / total_count * 100)`

## Key Conventions

- **Path alias:** `@/*` maps to project root
- **Package manager:** pnpm (lockfile: `pnpm-lock.yaml`). CI uses `npm ci` but local dev uses pnpm.
- **UI components:** shadcn/ui in `components/ui/`. Use existing ones; add new via shadcn CLI if needed.
- **Styling:** Tailwind CSS with CSS-variable-based theme (HSL). Dark mode via `class` strategy.
- **Font:** Cairo (body) + IBM Plex Sans Arabic (headings). `html lang="ar" dir="rtl"`.
- **Forms:** react-hook-form + zod + @hookform/resolvers
- **Toast:** sonner (position: top-center)
- **DB types** are enums stored as string literals in TypeScript, not Postgres enums. Task status values: `Backlog | To Do | In Progress | Review | Done | Cancelled`
- **ESLint** treats `no-explicit-any` and `no-unused-vars` as warnings (not errors). Unused args prefixed with `_` are ignored.
- `scripts/` contains one-off utility scripts (run with `tsx scripts/foo.ts`). Not part of the app.

## Supabase Setup (local dev)

1. Copy `.env.example` to `.env.local` and fill in Supabase credentials
2. Run SQL in Supabase SQL Editor in order: `schema.sql` -> `rls.sql` -> `seed.sql`
3. Storage bucket `documents` must exist and be private
4. First admin user: invite via Supabase Auth, then `UPDATE profiles SET role = 'admin'` in SQL

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

## Vercel Cron

Three cron jobs defined in `vercel.json` hitting `/api/cron/*`. Require `CRON_SECRET` for auth.

## Testing

- Framework: vitest (`vitest run` — not watch mode)
- Only one test file exists: `tests/recalc-progress.test.ts`
- Tests are pure/unit only (no Supabase calls mocked)

## Guard Skills

- Use `$samawah-guard-suite` as the project release gate after implementation work and before presenting, committing, pushing, or merging meaningful changes.
- `$samawah-guard-suite` adapts `clean-code-guard`, `test-guard`, and `docs-guard` to Samawah's Next.js, Supabase, Arabic RTL, dashboard, and release rules.
- Use `$clean-code-guard`, `$test-guard`, or `$docs-guard` directly only when the user asks for one focused guard instead of the full Samawah gate.
- `$wp-guard` and `$woo-guard` are installed from `amElnagdy/guard-skills`, but only use them if the diff actually contains WordPress or WooCommerce code.

## Gotchas

- `lib/supabase/types.ts` is **manually maintained**, not generated. If you change `supabase/schema.sql`, update types.ts too.
- `recalcProjectProgress()` in recalc-progress.ts uses the **browser client** (`createClient` from client.ts) — do not call it from server components/API routes.
- The `mapArabicStatus()` function in `lib/utils/index.ts` maps various Arabic status strings to English enum values. Update it when adding new status labels.
- `getUser()` auto-creates profile as `role: "admin"` — this is intentional for first-user setup, not a security bug.
