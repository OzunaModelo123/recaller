# Recaller

**B2B SaaS training execution platform** — turn any learning content into actionable, trackable training plans delivered where your team already works.

## What Recaller Does

1. **Ingest** — Upload YouTube videos, PDFs, documents, or paste URLs. Recaller extracts the content automatically.
2. **Generate** — AI analyzes the content and creates multi-step training plans (2–10 steps) tailored to your organization's context and industry.
3. **Assign** — Distribute plans to employees individually or in groups, with due dates and scheduling.
4. **Track** — Employees complete steps directly in Slack, Microsoft Teams, or the web app. Managers see real-time progress with traffic-light dashboards.
5. **Report** — Monthly AI-generated insight reports identify learning trends, top performers, and areas needing attention.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Supabase (Postgres + Row Level Security + pgvector) |
| Auth | Supabase Auth (email/password, org-based) |
| AI — Content Analysis | Claude 3.7 Sonnet (Anthropic) |
| AI — Plan Generation | GPT-4.1 (OpenAI) |
| AI — Plan Validation | GPT-4.1 Mini (OpenAI) |
| AI — Embeddings | text-embedding-3-small (1536 dimensions) |
| Background Jobs | Inngest |
| Billing | Stripe (seat-based, trial-first) |
| Notifications | Slack (@vercel/slack-bolt), Microsoft Teams (REST API), Resend (email) |
| Monitoring | Sentry |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js App                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────┐  │
│  │ Auth     │  │ Dashboard│  │ Employee  │  │ API       │  │
│  │ (signup, │  │ (admin   │  │ (my plans,│  │ (inngest, │  │
│  │  login,  │  │  content,│  │  complete │  │  slack,   │  │
│  │  callback│  │  assign, │  │  steps)   │  │  teams,   │  │
│  │  )       │  │  team)   │  │           │  │  stripe)  │  │
│  └──────────┘  └──────────┘  └───────────┘  └───────────┘  │
├─────────────────────────────────────────────────────────────┤
│                     Shared Libraries                        │
│  supabase/ │ ai/ │ content/ │ notifications/ │ billing/    │
├─────────────────────────────────────────────────────────────┤
│                   Supabase (Postgres + RLS)                 │
│  organisations │ users │ content_items │ plans │ assignments│
│  + pgvector embeddings │ + notifications │ + billing       │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

7 migrations, executed in order:

| Migration | Tables |
|---|---|
| 001 | organisations, users, invitations + pgvector extension |
| 002 | content_items, content_embeddings, plans, plan_steps, plan_embeddings |
| 003 | groups, group_members, assignments, step_completions |
| 004 | notifications, notification_suppressions, slack_installations, teams_installations |
| 005 | subscriptions |
| 006 | insight_reports, analytics_snapshots |
| 007 | Flexible step count (constraint relaxed to 1–10 steps) |

All tables enforce Row Level Security with org-scoped tenant isolation.

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project
- API keys for: OpenAI, Anthropic, Stripe, Slack, Resend, Sentry, Inngest

### Setup

```bash
# Install dependencies
npm install

# Copy environment template and fill in your keys
cp .env.local.example .env.local

# Link your Supabase project
npx supabase link --project-ref YOUR_PROJECT_REF

# Apply database migrations
npx supabase db push

# Generate TypeScript types from your database
npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/types/database.ts

# Start development server
npm run dev
```

### Environment Variables

See `.env.local.example` for the full list. Required services:

- **Supabase** — Database, auth, and storage
- **OpenAI** — Plan generation and validation
- **Anthropic** — Content analysis and insight reports
- **Stripe** — Subscription billing (test mode)
- **Slack** — Bot notifications (client ID, secret, signing secret)
- **Resend** — Email notifications
- **Sentry** — Error monitoring
- **Inngest** — Background job processing

## Project Structure

```
src/
  app/
    (auth)/           # Login, signup, email callback
    dashboard/        # Admin: content, assignments, team, insights, settings
    employee/         # Employee: my plans, profile
    api/              # REST endpoints (inngest, slack, teams, stripe, content, plans)
  lib/
    supabase/         # Browser + server Supabase clients
    ai/               # Multi-model AI pipeline (analysis, generation, validation)
    content/          # Content extractors (YouTube, PDF, DOCX, Vimeo, Loom)
    notifications/    # NotificationService routing (Slack, Teams, email)
    billing/          # Stripe helpers
    inngest/          # Background job definitions
  components/
    ui/               # shadcn/ui components
  types/
    database.ts       # Auto-generated Supabase types
  emails/             # React Email templates
supabase/
  migrations/         # SQL migration files with RLS policies
```

## Build Phases

This project follows a 13-phase sequential build plan:

| Phase | Description | Status |
|---|---|---|
| 0 | External service accounts + API keys | Done |
| 1 | Database schema + auth + dashboard shell | Done |
| 2 | Content ingestion (YouTube, PDF, DOCX, Whisper fallback) | Next |
| 3 | AI plan generation (3-layer: analyze → generate → validate) | Planned |
| 4 | Employee web interface | Planned |
| 5 | Manager dashboard + distribution | Planned |
| 6 | Slack bot | Planned |
| 7 | Microsoft Teams bot | Planned |
| 8 | NotificationService + nudges | Planned |
| 9 | Billing (Stripe) | Planned |
| 10 | Insight engine | Planned |
| 11 | Calendar integration + bulk invites | Planned |
| 12 | Deployment + polish | Planned |

## Key Design Decisions

- **Multi-model AI pipeline**: Different AI models for different tasks — Claude for deep analysis, GPT-4.1 for structured generation, GPT-4.1 Mini for cost-efficient validation.
- **Flexible step count**: Plans can have 2–10 steps. AI suggests the optimal number based on content complexity; admins can adjust before publishing.
- **Serverless-first**: Slack uses `@vercel/slack-bolt` for serverless-safe 3-second ack. Teams uses raw Bot Connector REST API instead of BotBuilder SDK.
- **NotificationService abstraction**: Single routing layer determines Slack vs Teams vs email per user; platform-specific rendering is isolated in adapter classes.
- **Org-scoped multi-tenancy**: Every data access is isolated by `org_id` at the database level via RLS policies.

## License

Private — All rights reserved.
