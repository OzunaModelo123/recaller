# Recaller — Phase 2 Handoff Prompt

Copy the text below into a new Cursor chat to continue building Phase 2.

---

## Context Prompt (paste this)

```
I am building Recaller, a B2B SaaS training execution platform. Before starting any work, read these files:
1. .cursor/plans/recaller_build_guide_aba69b5a.plan.md — full build specification
2. .cursor/rules/recaller-project.mdc — project context and architecture
3. .cursor/rules/phase-tracking.mdc — what's done and what's next
4. .cursor/rules/database-schema.mdc — schema and RLS conventions
5. .cursor/rules/coding-standards.mdc — TypeScript/React patterns

Phase 0 and Phase 1 are COMPLETE. Here is exactly what exists:

### Tech Stack (installed and working)
- Next.js 16.2.1 (App Router, TypeScript, Tailwind CSS v4)
- shadcn/ui (nova preset, components: button, card, input, label, sheet, badge, avatar, separator, progress, tooltip)
- Supabase (@supabase/ssr + @supabase/supabase-js) for auth + Postgres + RLS + pgvector
- OpenAI SDK, Anthropic SDK, Stripe, Inngest, Resend, @sentry/nextjs, recharts, @react-pdf/renderer
- @vercel/slack-bolt, @slack/web-api
- youtube-transcript, pdf-parse, mammoth
- supabase CLI (dev dependency)

### Database (6 migrations applied to remote Supabase, project ref: pivutjovcqtbvdnbqrgh)
All tables created with RLS enabled and policies in place:
- 001: organisations, users, invitations + pgvector extension + indexes
- 002: content_items, content_embeddings(VECTOR 1536), plans, plan_steps, plan_embeddings(VECTOR 1536) + HNSW indexes
- 003: groups, group_members, assignments, step_completions
- 007: flexible_step_count — step_number constraint relaxed from 1-4 to 1-10 (AI suggests optimal count, admin adjustable)
- 004: notifications, notification_suppressions, slack_installations, teams_installations
- 005: subscriptions
- 006: insight_reports, analytics_snapshots

Generated TypeScript types exist at src/types/database.ts (19 tables).

### Auth Flow (working, tested)
- src/lib/supabase/client.ts — browser client (createBrowserClient)
- src/lib/supabase/server.ts — server client (createServerClient with cookies)
- src/middleware.ts — protects /dashboard and /employee routes, redirects logged-in users away from auth pages
- src/app/(auth)/signup/page.tsx — email/password + full_name + org_name, stores metadata, shows confirmation message
- src/app/(auth)/login/page.tsx — email/password login, redirects to /dashboard
- src/app/(auth)/callback/route.ts — exchanges code, creates organisations + users rows for first-time signups with role='admin'

### Dashboard (working, tested)
- src/app/dashboard/layout.tsx — sticky header with org name, avatar, role badge, sidebar with Lucide icons, mobile Sheet menu, role-based nav (admin sees Team/Insights/Settings)
- src/app/dashboard/page.tsx — time-based greeting, org name, stat cards (placeholder zeros), getting-started checklist, activity/insights preview
- src/app/dashboard/content/page.tsx — empty state placeholder
- src/app/dashboard/assignments/page.tsx — empty state placeholder
- src/app/dashboard/team/page.tsx — coming soon placeholder
- src/app/dashboard/insights/page.tsx — coming soon placeholder
- src/app/dashboard/settings/page.tsx — coming soon placeholder

### Employee Routes
- src/app/employee/layout.tsx — simpler layout with My Plans + Profile nav
- src/app/employee/my-plans/page.tsx — placeholder

### .env.local (populated with real keys)
All Supabase, OpenAI, Anthropic, Stripe, Slack (client/secret/signing), Resend, Sentry, Inngest keys are filled.
Empty (deferred): STRIPE_WEBHOOK_SECRET (Phase 9), SLACK_BOT_TOKEN (Phase 6), SLACK_STATE_SECRET (Phase 6), TEAMS_* (Phase 7), SENTRY_AUTH_TOKEN (Phase 12).

### Build Status
- `npm run build` passes (0 errors, 0 warnings)
- `npm run lint` passes clean
- Dev server runs on localhost:3001

---

## YOUR TASK: Execute Phase 2 — Content Ingestion

Read the build guide at .cursor/plans/recaller_build_guide_aba69b5a.plan.md, specifically "Phase 2: Content Ingestion (8-10 hours)" starting at the "### Phase 2" heading. Follow it precisely.

Phase 2 Goal: Admin can paste a YouTube URL and instantly get a transcript. Or upload a PDF/DOCX and see it processed. Content library shows all items with status.

Phase 2 creates these files (per the build guide folder structure):
1. src/lib/content/youtubeExtractor.ts — youtube-transcript package wrapper
2. src/lib/content/pdfExtractor.ts — pdf-parse wrapper
3. src/lib/content/docxExtractor.ts — mammoth wrapper
4. src/lib/content/loomExtractor.ts — Loom transcript fetch (return null if unavailable)
5. src/lib/content/vimeoExtractor.ts — Vimeo transcript fetch (return null if unavailable)
6. src/lib/inngest/client.ts — Inngest client instance
7. src/lib/inngest/functions/transcribeContent.ts — Whisper fallback for audio/video only
8. src/app/api/inngest/route.ts — Inngest serve endpoint
9. src/app/api/content/transcribe/route.ts — Transcription trigger API
10. Update src/app/dashboard/content/page.tsx — content library with status display
11. src/app/dashboard/content/upload/page.tsx — upload form (URL paste or file upload)

Key constraints from the build guide:
- YouTube uses youtube-transcript (no API key, instant)
- PDF uses pdf-parse, DOCX uses mammoth (instant, no Whisper)
- Only MP4/MP3 files fall back to OpenAI Whisper via Inngest background job
- Content items go through status flow: queued → transcribing → analyzing → ready (or failed)
- All content is org-scoped via org_id
- Use the existing RLS policies from migration 002

Follow all 3 CURSOR PROMPTs in the Phase 2 section of the build guide. After implementing, run `npm run lint` and `npm run build` to verify everything compiles.
```

---
