---
name: samawah-guard-suite
description: Run a Samawah-specific quality gate for the Samawah Team App before presenting, committing, pushing, or merging code/docs/tests. Use after implementation work, dashboard/UI changes, Supabase schema/RLS/auth changes, project/task/KPI/notification changes, Arabic RTL UX edits, docs updates, or Arabic/English requests for final review, verification, upload, merge readiness, or logical effectiveness. Combines guard-skills clean-code-guard, test-guard, docs-guard, and the existing samawah-code-review workflow; WordPress/Woo guards are only relevant if the diff actually contains WordPress or WooCommerce code.
---

# Samawah Guard Suite

Use this skill as the one-command review gate for Samawah Team App changes. It adapts `amElnagdy/guard-skills` to this project without replacing the original guard skills.

## Project Fit

- App: Arabic-first RTL project management platform.
- Stack: Next.js App Router, Supabase, React Query, shadcn/ui, Tailwind, Recharts.
- Package manager: `pnpm`.
- Required checks before commit or push: `pnpm lint`, `pnpm typecheck`, `pnpm test`; run `pnpm build` for production-facing UI/routing changes.
- Protect: Supabase RLS, `profiles.role`, service-role code, financial/admin data, share links, notifications, project/task mutations, KPI calculations, Arabic UI clarity.

## Guard Flow

1. Read `AGENTS.md`, the request, the changed files, and the current diff.
2. Run the Samawah project checklist in [references/samawah-quality-gate.md](references/samawah-quality-gate.md).
3. Apply `clean-code-guard` to production code changes.
4. Apply `test-guard` to test changes or when new behavior needs coverage.
5. Apply `docs-guard` to documentation, README, prompts, changelog, API notes, or user guide changes.
6. Apply `samawah-code-review` for PR/release readiness or mixed feature changes.
7. Apply `wp-guard` and `woo-guard` only when the diff contains WordPress or WooCommerce code. Do not apply them to normal Samawah Next.js/Supabase code.
8. Fix actionable findings before delivery when the user asked you to implement. In review-only mode, lead with findings and do not edit unless asked.

## Output Rules

- For implementation tasks, summarize what was fixed and which checks passed.
- For review tasks, lead with findings ordered by severity and cite file/line evidence.
- For deployment-sensitive work, distinguish between GitHub push success and Vercel deployment success.
- Keep Arabic user-facing UI requirements explicit: all visible app text stays Arabic, RTL layouts must be checked on mobile, and dashboards should avoid clutter.
