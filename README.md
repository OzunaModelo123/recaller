<div align="center">

<br />

# `recaller`

<br />

### Training intelligence that proves ROI.

<br />

Most training platforms tell you who *completed* a course.<br />
**Recaller tells you who actually *changed their behavior* because of it.**

<br />

![Next.js](https://img.shields.io/badge/Next.js_16-000?style=flat-square&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)
![Anthropic](https://img.shields.io/badge/Anthropic-Claude-191919?style=flat-square)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=flat-square&logo=stripe&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

<br />

---

</div>

<br />

## The Problem

Organizations spend **$400B+ annually** on employee training. But nobody can answer the most basic question:

> *"Did that training actually change how our people work?"*

Completion rates are vanity metrics. A 95% completion rate means nothing if employees revert to old habits the next week. L&D teams have no visibility into whether training content translates into real behavioral change — or which specific steps employees struggle to implement.

<br />

## How Recaller Works

Recaller transforms passive training content into active, measurable behavioral programs.

<br />

<table>
<tr>
<td width="60" align="center">
<br />
<b>01</b>
</td>
<td>
<b>Ingest</b><br />
<sub>Upload a YouTube video, PDF, document, or paste a URL. Recaller extracts and understands the content in seconds — not hours of manual course-building.</sub>
</td>
</tr>
<tr>
<td width="60" align="center">
<br />
<b>02</b>
</td>
<td>
<b>Analyze & Generate</b><br />
<sub>A three-stage AI pipeline: <b>Anthropic Claude</b> analyzes the transcript, <b>OpenAI GPT-4.1</b> generates the structured plan (2–10 behavioral steps), and <b>GPT-4.1 Mini</b> validates quality — plus OpenAI embeddings for similarity search. Steps are <i>actions employees take</i> at work, not quiz questions.</sub>
</td>
</tr>
<tr>
<td width="60" align="center">
<br />
<b>03</b>
</td>
<td>
<b>Assign & Deliver</b><br />
<sub>Distribute plans to individuals or teams with deadlines. Steps arrive in Slack, Microsoft Teams, or email — where your people already work. No separate app to check.</sub>
</td>
</tr>
<tr>
<td width="60" align="center">
<br />
<b>04</b>
</td>
<td>
<b>Measure Behavior</b><br />
<sub>Track which behavioral steps employees complete, skip, or struggle with. See patterns across teams, content types, and time periods. Identify who implements training and who doesn't.</sub>
</td>
</tr>
<tr>
<td width="60" align="center">
<br />
<b>05</b>
</td>
<td>
<b>Prove Impact</b><br />
<sub>AI-generated insight reports surface which training content drives real behavioral change, which steps employees excel at vs. fall behind on, and whether your L&D investment is actually working.</sub>
</td>
</tr>
</table>

<br />

## What Makes This Different

<table>
<tr>
<th align="left" width="320">Traditional LMS</th>
<th align="left" width="320">Recaller</th>
</tr>
<tr>
<td><sub>Tracks course completion</sub></td>
<td><sub><b>Tracks behavioral implementation</b></sub></td>
</tr>
<tr>
<td><sub>One-size-fits-all quiz</sub></td>
<td><sub><b>AI-generated action steps tailored to content</b></sub></td>
</tr>
<tr>
<td><sub>Separate platform nobody checks</sub></td>
<td><sub><b>Delivered in Slack, Teams, and email</b></sub></td>
</tr>
<tr>
<td><sub>"95% completion rate"</sub></td>
<td><sub><b>"72% of sales team implemented objection handling within 2 weeks"</b></sub></td>
</tr>
<tr>
<td><sub>Manual content creation</sub></td>
<td><sub><b>Upload any content — AI does the rest</b></sub></td>
</tr>
<tr>
<td><sub>No insight into what works</sub></td>
<td><sub><b>Behavioral patterns show which steps employees excel at or fall behind on</b></sub></td>
</tr>
</table>

<br />

## Architecture

```
                            ┌──────────────────────┐
                            │      Next.js 16       │
                            │    (App Router, TS)    │
                            └──────────┬───────────┘
                                       │
                 ┌─────────────────────┼─────────────────────┐
                 │                     │                     │
          ┌──────┴──────┐       ┌──────┴──────┐       ┌──────┴──────┐
          │  Dashboard  │       │  Employee   │       │    API      │
          │  ─────────  │       │  ─────────  │       │  ─────────  │
          │  Content    │       │  My Plans   │       │  Inngest    │
          │  Assign     │       │  Complete   │       │  Slack Bot  │
          │  Team       │       │  Steps      │       │  Teams Bot  │
          │  Insights   │       │             │       │  Stripe     │
          └──────┬──────┘       └──────┬──────┘       └──────┬──────┘
                 │                     │                     │
                 └─────────────────────┼─────────────────────┘
                                       │
                 ┌─────────────────────┼─────────────────────┐
                 │                     │                     │
          ┌──────┴──────┐       ┌──────┴──────┐       ┌──────┴──────┐
          │  Supabase   │       │  AI Layer   │       │  Inngest    │
          │  ─────────  │       │  ─────────  │       │  ─────────  │
          │  Postgres   │       │  Claude     │       │  Background │
          │  RLS        │       │  (analyze)  │       │  Jobs &     │
          │  pgvector   │       │  GPT-4.1    │       │  Scheduling │
          │  Auth       │       │  + Mini +   │       │             │
          │             │       │  embeddings │       │             │
          └─────────────┘       └─────────────┘       └─────────────┘
```

<br />

## Tech Stack

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| **Framework** | Next.js 16 (App Router) | Server-first React with TypeScript |
| **Styling** | Tailwind CSS v4 + shadcn/ui | Clean, accessible component system |
| **Database** | Supabase Postgres | Row Level Security + pgvector embeddings |
| **AI — Analysis** | Anthropic Claude (Sonnet) | Structured content analysis from transcript + org context |
| **AI — Generation** | OpenAI GPT-4.1 | Strict JSON plan with 2–10 steps and proof fields |
| **AI — Validation** | OpenAI GPT-4.1 Mini | Quality scoring and optional regen loop |
| **AI — Embeddings** | OpenAI `text-embedding-3-small` | 1536-dim semantic search (content + plans) |
| **Background Jobs** | Inngest | Serverless event-driven automation |
| **Billing** | Stripe | Seat-based subscriptions |
| **Notifications** | Slack + Teams + Resend | Multi-channel delivery |
| **Monitoring** | Sentry | Error tracking and performance |

<br />

## Database

**13 SQL migrations** (apply in order) with Row Level Security enforcing org-level tenant isolation. Later migrations add flexible step counts (2–10), private content storage, pgvector RPCs, and **trackable step proof** (`plan_steps.proof_*`, `step_completions.evidence`, unique per assignment step). See `supabase/migrations/` and `.cursor/rules/database-schema.mdc` for the full list.

```
organisations ─┬── users
               ├── invitations
               ├── content_items ──── content_embeddings (pgvector)
               ├── plans ──┬── plan_steps (2–10 per plan)
               │           └── plan_embeddings (pgvector)
               ├── groups ──── group_members
               ├── assignments ──── step_completions
               ├── notifications ──── notification_suppressions
               ├── slack_installations / teams_installations
               ├── subscriptions
               └── insight_reports ──── analytics_snapshots
```

<br />

## Team & employee onboarding

Admins invite people from **`/dashboard/team`**. Recaller stores a row in **`public.invitations`** and sends a Supabase Auth invite email. The recipient follows the link; invite acceptance may return session tokens in the **URL hash** on `/login`, which the app completes and then routes through **`/post-login`** (which provisions **`public.users`** with the correct `org_id` and `role`).

**Invited employees** carry `invited_org_id` in Supabase **`user_metadata`**. Until they set a password and the app writes **`password_set_at`** in that metadata, **middleware** keeps them on **`/employee/setup-password`** — they cannot open My Plans or other employee routes first. After that, they sign in with email and password like anyone else.

The Team page lists **active org members** (`users` for your `org_id`) and **pending invites** (`invitations` with `status = 'pending'`). Resending an invite expires the previous pending row so a fresh email can be sent.

## Plan generation API (`POST /api/plans/generate`)

The admin UI streams **NDJSON** progress while the server runs, in order:

1. **Transcript cleanup** (`transcriptCleaner`)
2. **Stage 1 — Analyze** — `src/lib/ai/contentAnalyzer.ts` → **Anthropic** `anthropicClient.messages` with tool-use structured output (`ANALYSIS_MODEL`)
3. **Similar plans** — pgvector / embeddings (`embeddingService`) when available
4. **Stage 2 — Generate** — `src/lib/ai/planGenerator.ts` → **OpenAI** `GENERATION_MODEL` (GPT-4.1), strict JSON schema
5. **Stage 3 — Validate** — `src/lib/ai/planValidator.ts` → **OpenAI** `VALIDATION_MODEL` (GPT-4.1 Mini); up to two refinement loops if validation fails
6. **Persist** — `plans`, `plan_steps`, optional content embeddings

Requires **`ANTHROPIC_API_KEY`** and **`OPENAI_API_KEY`** (plus Supabase). Content must be **`ready`** with a non-empty transcript.

## Getting Started

```bash
# Clone
git clone https://github.com/OzunaModelo123/recaller.git
cd recaller

# Install
npm install

# Configure
cp .env.local.example .env.local
# Fill in your API keys (see .env.local.example for instructions)

# Database
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push

# Generate types
npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/types/database.ts

# Run
npm run dev
```

<br />

## Project Structure

```
src/
├── app/
│   ├── (auth)/              Login, signup, `/callback` (OAuth / code exchange)
│   ├── dashboard/           Admin: content, assignments, team directory, insights, settings
│   ├── employee/            My Plans, step completion, `/employee/setup-password` (invite onboarding)
│   └── api/                 Inngest, Slack, Teams, Stripe webhooks
├── lib/
│   ├── supabase/            Browser + server clients
│   ├── ai/                  Multi-model pipeline
│   ├── content/             Extractors (YouTube, PDF, DOCX, audio)
│   ├── notifications/       Slack, Teams, email routing
│   └── billing/             Stripe helpers
├── components/ui/           shadcn/ui components
├── types/database.ts        Auto-generated Supabase types
└── emails/                  React Email templates
```

<br />

## Build Roadmap

<table>
<tr><th align="center" width="50">Phase</th><th align="left">Description</th><th align="center" width="80">Status</th></tr>
<tr><td align="center"><code>00</code></td><td>Service accounts & API keys</td><td align="center">&#9745;</td></tr>
<tr><td align="center"><code>01</code></td><td>Database schema, auth, dashboard shell</td><td align="center">&#9745;</td></tr>
<tr><td align="center"><code>02</code></td><td>Content ingestion — YouTube, PDF, DOCX, Whisper</td><td align="center">&#9745;</td></tr>
<tr><td align="center"><code>03</code></td><td>AI plan generation — analyze, generate, validate</td><td align="center">&#9745;</td></tr>
<tr><td align="center"><code>04</code></td><td>Employee web interface & step completion</td><td align="center">&#9745;</td></tr>
<tr><td align="center"><code>05</code></td><td>Manager dashboard & distribution</td><td align="center">&#9744;</td></tr>
<tr><td align="center"><code>06</code></td><td>Slack bot integration</td><td align="center">&#9744;</td></tr>
<tr><td align="center"><code>07</code></td><td>Microsoft Teams bot</td><td align="center">&#9744;</td></tr>
<tr><td align="center"><code>08</code></td><td>Notification service & smart nudges</td><td align="center">&#9744;</td></tr>
<tr><td align="center"><code>09</code></td><td>Stripe billing & seat management</td><td align="center">&#9744;</td></tr>
<tr><td align="center"><code>10</code></td><td>AI insight engine & behavioral analytics</td><td align="center">&#9744;</td></tr>
<tr><td align="center"><code>11</code></td><td>Calendar sync & bulk invitations</td><td align="center">&#9744;</td></tr>
<tr><td align="center"><code>12</code></td><td>Deployment, monitoring & polish</td><td align="center">&#9744;</td></tr>
</table>

<br />

## AI assistants & phased development

Authoritative **phase status** and architecture live in **`.cursor/rules/recaller-project.mdc`** (Cursor always-on rule). **`CLAUDE.md`** mirrors the current phase in one line — update both when you advance a phase. For a new phase or new chat, reference that rule and open only **`### Phase N`** in the build guide (`.cursor/plans/`, local — not committed); do not paste the full plan.

<br />

## Design Decisions

| Decision | Rationale |
|:---------|:----------|
| **Structured AI pipeline** | Claude (Anthropic) for Stage 1 analysis; GPT-4.1 for Stage 2 plan JSON; GPT-4.1 Mini for Stage 3 validation; OpenAI embeddings; strict schemas where applicable. |
| **Behavioral steps, not quizzes** | Quizzes test recall. Steps test *implementation*. That's the behavioral signal. |
| **Flexible step count (2–10)** | AI suggests optimal count based on content complexity. Admins can adjust before publishing. |
| **Deliver where they work** | Slack/Teams/email delivery means zero friction. No new app to adopt. |
| **Org-scoped RLS** | Every query is tenant-isolated at the database level. Security by design, not by hope. |
| **Serverless-first** | Slack uses serverless-safe bolt. Teams uses raw REST. No persistent server required. |

<br />

---

<div align="center">

<sub>

**Recaller** — Stop measuring who clicked "complete." Start measuring who changed.

</sub>

<br />
<br />

<sub>Built with Next.js, Supabase, Anthropic (Claude), and OpenAI (GPT-4.1 family + embeddings)</sub>

</div>
