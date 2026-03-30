# Recaller — AI Context

This file provides project context for AI assistants. For Cursor-specific rules, see `.cursor/rules/`.

## What is Recaller?

B2B SaaS training execution platform. Ingest content → AI generates multi-step plans (2–10 steps based on content complexity) → assign to employees → track completions → notify via Slack/Teams/email → report insights.

## Tech Stack

Next.js 16 App Router, TypeScript, Tailwind v4, shadcn/ui, Supabase (Postgres + RLS + pgvector), OpenAI + Anthropic (multi-model), Inngest (jobs), Stripe (billing), Resend (email), Sentry (monitoring).

## Key Files

- `.cursor/plans/recaller_build_guide_aba69b5a.plan.md` — Full 13-phase build specification
- `.cursor/rules/` — Cursor rules (project context, schema, coding standards, phase tracking)
- `src/lib/supabase/` — Supabase client utilities (client.ts for browser, server.ts for server)
- `src/middleware.ts` — Auth middleware protecting /dashboard and /employee routes
- `src/types/database.ts` — Auto-generated Supabase TypeScript types
- `supabase/migrations/` — 6 SQL migration files with RLS policies

## Conventions

- All data is org-scoped via `org_id` with RLS enforcement
- Server Components by default; "use client" only when needed
- Mobile-first responsive UI
- Supabase SSR pattern with cookies-based auth
- Background jobs via Inngest (not cron)
- Never expose service_role keys client-side

## Current State

Phase 0 and Phase 1 complete. Next: Phase 2 (Content Ingestion).
See `.cursor/rules/phase-tracking.mdc` for detailed status.
