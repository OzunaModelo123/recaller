---
name: Recaller Build Guide
overview: Complete sequential programming guide for building Recaller — a B2B SaaS training execution platform — from empty workspace to production. 13 phases (Phase 0 through 12), all 9 architectural optimizations incorporated, with copy-paste Cursor prompts for a non-developer builder.
todos:
  - id: phase-00
    content: "Phase 0: External Services Setup — create all accounts (Supabase, Vercel, Stripe, OpenAI, Slack, Azure, Resend, Sentry, Inngest, GitHub), generate every API key, populate .env.local"
    status: pending
  - id: phase-01
    content: "Phase 1: Database Schema + Supabase Auth + Org Management (6 migrations, RLS, login/signup, dashboard layout)"
    status: pending
  - id: phase-02
    content: "Phase 2: Content Ingestion (YouTube transcript via youtube-transcript, Vimeo/Loom API, file upload + Whisper fallback, Inngest jobs, content library)"
    status: pending
  - id: phase-03
    content: "Phase 3: AI Plan Generation — 3-Layer Intelligence (Company Context Profile onboarding wizard, multi-model pipeline: Claude 3.7 Sonnet analysis -> GPT-4.1 generation -> GPT-4.1 Mini validation, pgvector embeddings for org learning, plan editor, quality scores)"
    status: pending
  - id: phase-04
    content: "Phase 4: Employee Web Interface (step-by-step view, mark complete, progress bar, completion animation, personal history)"
    status: pending
  - id: phase-05
    content: "Phase 5: Manager Dashboard + Distribution (traffic lights, funnels, CSV export, assignment creation, date filtering)"
    status: pending
  - id: phase-06
    content: "Phase 6: Slack Bot (OAuth, @vercel/slack-bolt, Block Kit messages, interactive buttons, slash commands, weekly digest)"
    status: pending
  - id: phase-07
    content: "Phase 7: Microsoft Teams Bot (Azure bot reg, REST API approach — no BotBuilder SDK, Adaptive Cards, proactive messaging)"
    status: pending
  - id: phase-08
    content: "Phase 8: NotificationService + Nudges (routing class, Inngest cron, smart 72hr suppression, Resend email fallback)"
    status: pending
  - id: phase-09
    content: "Phase 9: Billing (Stripe Checkout, Billing Portal, seat-based proration webhooks, trial tracking, usage dashboard)"
    status: pending
  - id: phase-10
    content: "Phase 10: Insight Engine (6 pre-written analytics queries, Claude 3.7 Sonnet writes narrative report, PDF generation, monthly cron)"
    status: pending
  - id: phase-11
    content: "Phase 11: Calendar Integration + Bulk Invites (Google/Outlook .ics, CSV upload + parse, user profiles)"
    status: pending
  - id: phase-12
    content: "Phase 12: Deployment + Polish (Vercel, production Supabase, Sentry, Slack/Teams app submission, smoke tests)"
    status: pending
isProject: false
---

# Recaller: Complete Build Guide for Non-Developers (v2 — Optimized)

All 9 architectural optimizations from the review are incorporated. Changes from v1 are marked with **[CHANGED]** so you can see exactly what moved.

---

## PART 0: Architecture Reasoning

### REASONING 1: Architecture Dependency Order

The dependency graph forces a strict build sequence. **Auth and database schema** must come first because every other module references `org_id`, `user_id`, and roles. The organisation model must include Slack/Teams identity fields from migration 001 because the Slack and Teams bots use these fields for user lookup — retrofitting them later risks breaking RLS policies and foreign keys.

**Content Ingestion** (Module B) depends on auth (who uploaded it?) and org isolation (which org owns it?). **AI Plan Generation** (Module C) depends on content existing in the database. **Distribution** (Module D) depends on plans existing AND on the NotificationService abstraction being in place — which itself depends on the Slack and Teams OAuth connections being wired.

The **Slack bot** (Module I) and **Teams bot** (Module J) depend on: (1) auth and org tables with platform identity fields, (2) the plans and assignments tables, (3) the NotificationService routing layer, and (4) the step completion API endpoints. They cannot be built until Phases 1-5 are complete.

The **Insight Engine** (Module G) is deliberately placed last in the feature build order. It requires 60+ days of real completion data to produce statistically meaningful reports. Building it early wastes time on an engine with nothing to query. The schema supports it from day one (timestamps, completion records), but the engine logic and AI report generation are Phase 10.

**Billing** (Module L) is placed at Phase 9 — after core functionality works but before public launch. A trial-first approach means billing does not block early client onboarding.

**[CHANGED] Phase 0 added:** Before any code, the builder must create accounts for 10 external services and gather all API keys. This prevents hitting a wall 20 minutes into Phase 1 when they realize they have no Supabase project yet.

Build order: **Accounts (Phase 0)** -> Schema/Auth -> Content Ingestion -> AI Plans -> Employee Web UI -> Manager Dashboard -> Slack Bot -> Teams Bot -> Notifications/Nudges -> Billing -> Insight Engine -> Calendar Integration -> Deploy.

### REASONING 2: MCP Server Placement

**Supabase MCP Server** — relevant from Phase 1 (database schema). It lets you ask Cursor "show me all tables with their columns" or "query the assignments table for org X" without writing SQL manually. During Phase 10 (Insight Engine), it is used in **read-only mode during development only** to help the builder debug analytics queries.

**[CHANGED]** The Insight Engine at runtime uses **pre-written parameterized query functions**, not autonomous AI-generated SQL. Claude 3.7 Sonnet's role is to interpret query results and write the narrative report — it does not write or execute SQL against production. This eliminates the risk of an AI writing bad queries against live data that a non-developer cannot review.

**Slack MCP Server** — relevant from Phase 6 (Slack Bot). Before connecting it, a Cursor prompt like "send a Block Kit message to a Slack channel" requires you to manually look up the Slack API. With it connected, Cursor can list channels, test message formatting, and verify bot permissions directly.

**Teams MCP Server** (`@floriscornel/teams-mcp`) — relevant from Phase 7 (Teams Bot). It provides Microsoft Graph API access for sending messages, managing channels, and testing Adaptive Cards.

**[CHANGED] GitHub MCP Server — removed from `.cursor/mcp.json`.** The official `github/github-mcp-server` requires Docker or Go (both violate the no-Docker constraint and add friction for a non-developer). The npm fallback (`@modelcontextprotocol/server-github`) has been deprecated since April 2025. Cursor's built-in `@codebase` context already provides full file awareness and code search for a solo developer — the GitHub MCP server adds complexity without proportional value. If the builder later wants it, they can install Go via `brew install go` and configure the binary directly.

### REASONING 3: Slack vs Teams Divergence and Shared Logic

**Shared logic:** Both platforms need to: (1) send assignment notifications, (2) handle "mark step complete" button clicks, (3) send nudge reminders, (4) post weekly digests to channels, (5) map platform user IDs to Recaller user records. All shared logic lives in the `NotificationService`.

**Divergence points:**

- **Message format:** Slack uses Block Kit JSON; Teams uses Adaptive Card JSON
- **OAuth flow:** Slack uses Slack OAuth v2 with bot scopes; Teams uses Microsoft Entra (Azure AD) with bot registration
- **Interactive payloads:** Slack sends interaction payloads to a single endpoint via `@vercel/slack-bolt`; Teams sends activity payloads via webhook POST
- **[CHANGED] Proactive messaging:** Slack requires the bot to be in the workspace (handled by OAuth install); Teams requires a stored `conversationReference` and uses the Bot Connector REST API directly — no BotBuilder SDK. The BotBuilder SDK was designed for long-running servers, not Vercel serverless functions. We use raw HTTP calls to `https://smba.trafficmanager.net/teams/v3/conversations/` with a Bearer token obtained from the MSA Login Service.
- **[CHANGED] Slack library:** We use only `@vercel/slack-bolt` (not `@slack/bolt`). The `@vercel/slack-bolt` package wraps Bolt and uses Vercel's `waitUntil` API to solve the 3-second acknowledgment deadline that breaks standard Bolt on serverless. `@slack/bolt` is included as a transitive dependency.

### REASONING 4: Database Migration Order

**Migration 001 — Core identity tables:**

- `organisations` (id UUID PK, name TEXT, industry TEXT, size TEXT, logo_url TEXT, **slack_team_id TEXT UNIQUE**, **teams_tenant_id TEXT UNIQUE**, **org_context JSONB DEFAULT '{}'**, onboarding_completed BOOLEAN DEFAULT false, created_at TIMESTAMPTZ)
- `users` (id UUID PK references auth.users, org_id UUID FK, email TEXT, full_name TEXT, title TEXT, role TEXT CHECK('super_admin','admin','employee'), **slack_user_id TEXT**, **teams_user_id TEXT**, notification_preferences JSONB, avatar_url TEXT, created_at TIMESTAMPTZ)
- `invitations` (id UUID PK, org_id UUID FK, email TEXT, role TEXT, status TEXT, invited_by UUID FK, created_at TIMESTAMPTZ)
- Indexes on `users.slack_user_id` and `users.teams_user_id`

**Migration 002 — Content and plans:**

- `content_items` (id UUID PK, org_id UUID FK, uploaded_by UUID FK, title TEXT, source_type TEXT, source_url TEXT, file_path TEXT, transcript TEXT, transcript_chunks JSONB, status TEXT CHECK('queued','transcribing','analyzing','ready','failed'), metadata JSONB, created_at TIMESTAMPTZ)
- `content_embeddings` (id UUID PK, content_item_id UUID FK, org_id UUID FK, chunk_index INT, chunk_text TEXT, **embedding VECTOR(1536)**, created_at TIMESTAMPTZ) — requires pgvector extension enabled in migration 001
- `plans` (id UUID PK, org_id UUID FK, content_item_id UUID FK, created_by UUID FK, title TEXT, original_ai_draft JSONB, current_version JSONB, **content_analysis JSONB**, **quality_scores JSONB**, category TEXT, complexity TEXT, skill_level TEXT, is_template BOOLEAN DEFAULT false, **target_role TEXT**, created_at TIMESTAMPTZ)
- `plan_steps` (id UUID PK, plan_id UUID FK, step_number INT CHECK(1-4), title TEXT, instructions TEXT, success_criteria TEXT, video_timestamp_start INT, video_timestamp_end INT, estimated_minutes INT, created_at TIMESTAMPTZ)
- `plan_embeddings` (id UUID PK, plan_id UUID FK, org_id UUID FK, plan_text TEXT, **embedding VECTOR(1536)**, is_admin_approved BOOLEAN DEFAULT false, created_at TIMESTAMPTZ) — stores embeddings of approved plans for few-shot learning

**Migration 003 — Assignments and completions:**

- `groups` (id UUID PK, org_id UUID FK, name TEXT, created_by UUID FK, created_at TIMESTAMPTZ)
- `group_members` (id UUID PK, group_id UUID FK, user_id UUID FK, UNIQUE(group_id, user_id))
- `assignments` (id UUID PK, org_id UUID FK, plan_id UUID FK, assigned_to UUID FK, assigned_by UUID FK, group_id UUID FK NULLABLE, due_date TIMESTAMPTZ, scheduled_for TIMESTAMPTZ, status TEXT CHECK('active','completed','overdue','cancelled'), created_at TIMESTAMPTZ)
- `step_completions` (id UUID PK, assignment_id UUID FK, step_number INT, completed_at TIMESTAMPTZ, note TEXT, difficulty_rating INT CHECK(1-5), platform_completed_on TEXT CHECK('web','slack','teams'))

**Migration 004 — Notifications and messaging:**

- `notifications` (id UUID PK, org_id UUID FK, user_id UUID FK, type TEXT, channel TEXT, payload JSONB, sent_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ, **slack_message_ts TEXT**, **teams_activity_id TEXT**, created_at TIMESTAMPTZ)
- `notification_suppressions` (id UUID PK, user_id UUID FK, notification_type TEXT, suppressed_until TIMESTAMPTZ)
- `slack_installations` (id UUID PK, org_id UUID FK UNIQUE, team_id TEXT, bot_token_encrypted TEXT, bot_user_id TEXT, installed_by UUID FK, scopes TEXT[], created_at TIMESTAMPTZ)
- `teams_installations` (id UUID PK, org_id UUID FK UNIQUE, tenant_id TEXT, bot_id TEXT, bot_password_encrypted TEXT, service_url TEXT, installed_by UUID FK, created_at TIMESTAMPTZ)

**Migration 005 — Billing:**

- `subscriptions` (id UUID PK, org_id UUID FK UNIQUE, stripe_customer_id TEXT, stripe_subscription_id TEXT, plan_tier TEXT CHECK('starter','growth','enterprise'), seat_count INT, seat_limit INT, status TEXT CHECK('trialing','active','past_due','cancelled'), trial_ends_at TIMESTAMPTZ, current_period_end TIMESTAMPTZ, created_at TIMESTAMPTZ)

**Migration 006 — Insights and reports:**

- `insight_reports` (id UUID PK, org_id UUID FK, report_type TEXT, period_start DATE, period_end DATE, ai_content TEXT, pdf_url TEXT, generated_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ)
- `analytics_snapshots` (id UUID PK, org_id UUID FK, metric_type TEXT, metric_value NUMERIC, snapshot_date DATE, metadata JSONB)

**All Slack/Teams identity fields flagged:**
`organisations.slack_team_id`, `organisations.teams_tenant_id`, `users.slack_user_id`, `users.teams_user_id`, `notifications.slack_message_ts`, `notifications.teams_activity_id`, `slack_installations.`*, `teams_installations.`*

---

## PART 1: MCP Setup

### .cursor/mcp.json — **[CHANGED] 3 servers (GitHub removed)**

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase",
        "--project-ref",
        "YOUR_SUPABASE_PROJECT_REF",
        "--read-only",
        "false"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "YOUR_SUPABASE_ACCESS_TOKEN"
      }
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-YOUR-SLACK-BOT-TOKEN",
        "SLACK_TEAM_ID": "T_YOUR_TEAM_ID"
      }
    },
    "teams": {
      "command": "npx",
      "args": ["-y", "@floriscornel/teams-mcp"],
      "env": {
        "TEAMS_TENANT_ID": "YOUR_AZURE_TENANT_ID",
        "TEAMS_CLIENT_ID": "YOUR_AZURE_CLIENT_ID",
        "TEAMS_CLIENT_SECRET": "YOUR_AZURE_CLIENT_SECRET"
      }
    }
  }
}
```

**Why only 3 servers:** The GitHub MCP server requires Docker or Go — both add friction for a non-developer. Cursor's built-in `@codebase` command provides equivalent file awareness for a solo developer. The Supabase, Slack, and Teams MCP servers provide capabilities Cursor does not have natively (live database queries, Slack API calls, Teams API calls).

**When to connect each:**

- **Supabase:** Connect in Phase 0 after creating your Supabase project. Used from Phase 1 onward.
- **Slack:** Connect in Phase 6 after creating your Slack app and obtaining a bot token.
- **Teams:** Connect in Phase 7 after Azure bot registration and obtaining credentials.

### Installation

```bash
# No global installs needed — npx downloads and runs each server on demand.
# Verify Node.js 18+ is installed:
node --version
# Should output v18.x.x or higher. If not, install from https://nodejs.org
```

### Cursor prompt examples per server

**Supabase MCP:** "Using the Supabase MCP server, list all tables in my database and show me the columns for the `users` table. Then query the `assignments` table to find all assignments where status = 'active' for org_id 'abc-123'. Show the results as a table."

**Slack MCP:** "Using the Slack MCP server, list all channels in my connected workspace. Then post a test message to #general using Block Kit with a section block that says 'Hello from Recaller' and an actions block containing a button with action_id 'test_click' and text 'Click Me'."

**Teams MCP:** "Using the Teams MCP server, list all teams in my Microsoft 365 tenant. Then send a message to the General channel of the first team saying 'Recaller bot is connected successfully'."

### Verification

After saving `.cursor/mcp.json` and fully quitting + reopening Cursor: go to Settings -> Tools & MCP. Each configured server should show a green circle. If any shows red, click on it to see the error message. The most common issue is a missing or invalid token — double-check the values in `mcp.json` match your dashboard credentials exactly.

---

## PART 2: Complete Database Schema

Six migration files, executed in order. Each migration includes its RLS policies. Full SQL for every migration is generated via Cursor prompts in Phase 1 — below is the complete specification each prompt will reference.

(See REASONING 4 above for the complete table-by-table breakdown with all column types, constraints, and foreign keys.)

**Critical rule for test data seeding:** When inserting test data, respect foreign key order: organisations -> users -> content_items -> plans -> plan_steps -> groups -> group_members -> assignments -> step_completions. Violating this order causes foreign key constraint errors.

---

## PART 3: Project Scaffold

### Terminal commands — **[CHANGED] Next.js 15 + no @slack/bolt + no botbuilder**

```bash
cd /Users/danielozoani/Documents/Recaller

# Create Next.js 15 project (latest stable, App Router, TypeScript, Tailwind)
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm

# Initialize shadcn/ui (select 'New York' style, defaults for everything else)
npx shadcn@latest init

# Core dependencies
npm install @supabase/supabase-js @supabase/ssr openai @anthropic-ai/sdk stripe inngest resend @react-email/components @sentry/nextjs recharts @react-pdf/renderer

# Slack — ONLY @vercel/slack-bolt (includes @slack/bolt as transitive dep)
npm install @vercel/slack-bolt @slack/web-api

# Content extraction
npm install youtube-transcript pdf-parse mammoth

# Dev dependencies
npm install -D supabase
```

**[CHANGED] What was removed and why:**

- `@slack/bolt` — included transitively by `@vercel/slack-bolt`. Installing it directly causes version conflicts.
- `botbuilder` and `@microsoft/teams-js` — the Teams bot uses the Bot Connector REST API directly (raw `fetch` calls). The BotBuilder SDK was designed for long-running servers, not Vercel serverless functions.
- `create-next-app@14` -> `create-next-app@latest` — Next.js 15 has 2.6x faster builds, better caching defaults, and React 19 support.
- Added `youtube-transcript` (90k weekly downloads, zero deps) for direct YouTube caption extraction without Whisper.
- Added `pdf-parse` and `mammoth` for PDF and DOCX text extraction without Whisper.

### .env.local template (every variable the app needs)

```bash
# === Supabase ===
NEXT_PUBLIC_SUPABASE_URL=           # From Supabase dashboard -> Settings -> API
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # From same location (anon / public key)
SUPABASE_SERVICE_ROLE_KEY=          # From same location (service_role key — KEEP SECRET)

# === OpenAI (GPT-4.1 for plan generation + validation) ===
OPENAI_API_KEY=                     # From platform.openai.com -> API Keys

# === Anthropic (Claude 3.7 Sonnet for content analysis + report writing) ===
ANTHROPIC_API_KEY=                  # From console.anthropic.com -> API Keys

# === Stripe ===
STRIPE_SECRET_KEY=                  # From Stripe dashboard -> Developers -> API keys (sk_test_...)
STRIPE_WEBHOOK_SECRET=              # From Stripe dashboard -> Developers -> Webhooks (whsec_...)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY= # From same location (pk_test_...)

# === Slack ===
SLACK_CLIENT_ID=                    # From api.slack.com -> Your App -> Basic Information
SLACK_CLIENT_SECRET=                # From same location
SLACK_SIGNING_SECRET=               # From same location
SLACK_BOT_TOKEN=                    # From OAuth & Permissions -> Bot User OAuth Token (xoxb-...)
SLACK_STATE_SECRET=                 # Any random string (generate with: openssl rand -hex 16)

# === Microsoft Teams / Azure ===
TEAMS_APP_ID=                       # From Azure Portal -> Bot registration -> Microsoft App ID
TEAMS_APP_PASSWORD=                 # From Azure Portal -> Bot registration -> Certificates & secrets
TEAMS_TENANT_ID=                    # From Azure Portal -> Microsoft Entra ID -> Overview

# === Resend (email) ===
RESEND_API_KEY=                     # From resend.com/api-keys (re_...)

# === Sentry ===
SENTRY_DSN=                         # From sentry.io -> Project Settings -> Client Keys
NEXT_PUBLIC_SENTRY_DSN=             # Same value as SENTRY_DSN (needed for client-side)
SENTRY_AUTH_TOKEN=                  # From sentry.io -> Settings -> Auth Tokens

# === Inngest ===
INNGEST_EVENT_KEY=                  # From Inngest dashboard (only needed for production)
INNGEST_SIGNING_KEY=                # From Inngest dashboard (only needed for production)

# === App ===
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Change to production URL after deployment
```

### Folder structure — **[CHANGED] teams/restClient.ts replaces activityHandler.ts**

```
src/
  app/
    (auth)/
      login/page.tsx
      signup/page.tsx
      callback/route.ts
    (dashboard)/
      layout.tsx
      page.tsx                         # Manager dashboard home
      onboarding/context/page.tsx      # Company Context Profile wizard (post-signup)
      content/page.tsx                 # Content library (B9)
      content/upload/page.tsx          # Content upload (B1-B5)
      plans/[id]/page.tsx              # Plan detail + edit (C7)
      assignments/page.tsx             # Assignment management (D1-D9)
      team/page.tsx                    # Team overview (F1-F6)
      insights/page.tsx                # Insight reports (G1-G9)
      settings/page.tsx                # Org settings + billing
    (employee)/
      layout.tsx
      my-plans/page.tsx                # Employee dashboard (E1)
      my-plans/[id]/page.tsx           # Step-by-step view (E2)
    api/
      inngest/route.ts                 # Inngest serve endpoint
      slack/events/route.ts            # Slack events + interactions (via @vercel/slack-bolt)
      slack/oauth/route.ts             # Slack OAuth callback
      teams/messages/route.ts          # Teams webhook — raw POST handler (no BotBuilder)
      teams/oauth/route.ts             # Teams/Azure OAuth callback
      stripe/webhooks/route.ts         # Stripe webhooks
      content/transcribe/route.ts      # Transcription trigger
      plans/generate/route.ts          # AI plan generation
      completions/route.ts             # Step completion API (shared by web, Slack, Teams)
  lib/
    supabase/
      client.ts                        # Browser Supabase client (createBrowserClient)
      server.ts                        # Server Supabase client (createServerClient)
      middleware.ts                     # Auth middleware (session refresh)
    notifications/
      NotificationService.ts           # Main routing class
      SlackNotifier.ts                 # Slack Block Kit message builder + sender
      TeamsNotifier.ts                 # Teams Adaptive Card builder + REST API sender
      EmailNotifier.ts                 # Resend email fallback
    ai/
      modelRouter.ts                   # Routes to correct AI model per task (Claude 3.7 Sonnet / GPT-4.1 / GPT-4.1 Mini)
      contentAnalyzer.ts               # Stage 1: deep content analysis via Claude 3.7 Sonnet (best reasoning)
      planGenerator.ts                 # Stage 2: context-aware plan generation via GPT-4.1 (best structured output)
      planValidator.ts                 # Stage 3: quality validation via GPT-4.1 Mini (cost-efficient judging)
      embeddingService.ts              # Generate + search embeddings via text-embedding-3-small + pgvector
      transcriptCleaner.ts             # Pre-analysis transcript cleaning
      insightEngine.ts                 # 6 parameterized analytics queries + Claude 3.7 Sonnet report narrative
    content/
      youtubeExtractor.ts              # youtube-transcript package wrapper
      vimeoExtractor.ts                # Vimeo API caption fetch
      loomExtractor.ts                 # Loom GraphQL transcript fetch
      pdfExtractor.ts                  # pdf-parse wrapper
      docxExtractor.ts                 # mammoth wrapper
    slack/
      blockKit.ts                      # Block Kit message JSON builders
      handlers.ts                      # Slash command + interaction handlers
      app.ts                           # Bolt app instance with VercelReceiver
    teams/
      adaptiveCards.ts                 # Adaptive Card JSON builders
      restClient.ts                    # Bot Connector REST API client (fetch-based)
      tokenManager.ts                  # MSA Login Service token acquisition
    billing/
      stripe.ts                        # Stripe helpers (Checkout, Portal, seat updates)
    inngest/
      client.ts                        # Inngest client instance
      functions/
        transcribeContent.ts           # Whisper transcription (fallback only)
        generatePlan.ts                # AI plan generation job
        sendNudges.ts                  # 48hr inactivity nudge cron
        weeklyDigest.ts                # Weekly manager digest cron
        monthlyReport.ts               # Monthly insight report cron
  emails/
    AssignmentEmail.tsx                # React Email: new assignment
    NudgeEmail.tsx                     # React Email: inactivity reminder
    WeeklyDigestEmail.tsx              # React Email: manager weekly summary
    TrialExpiryEmail.tsx               # React Email: trial Day 10, 13, 14
  components/
    ui/                                # shadcn/ui components (auto-generated)
    dashboard/                         # Manager dashboard components
    employee/                          # Employee-facing components
    content/                           # Content upload + library components
  types/
    database.ts                        # Supabase generated types (npx supabase gen types)
```

### NotificationService interface (complete)

```typescript
// src/lib/notifications/NotificationService.ts

type Platform = 'slack' | 'teams' | 'email';

interface StepSummary {
  number: number;
  title: string;
  instructions: string;
  successCriteria: string;
  estimatedMinutes: number;
  videoTimestampStart: number | null;
  videoTimestampEnd: number | null;
}

interface AssignmentNotification {
  assignmentId: string;
  planTitle: string;
  steps: StepSummary[];
  dueDate: string | null;
  sourceVideoUrl: string | null;
}

interface NudgeNotification {
  assignmentId: string;
  planTitle: string;
  currentStep: number;
  stepTitle: string;
  stepInstructions: string;
  stepSuccessCriteria: string;
  daysSinceLastActivity: number;
}

interface DigestPayload {
  orgName: string;
  period: string;
  activePlans: {
    title: string;
    completionRate: number;
    status: 'red' | 'yellow' | 'green';
    totalAssigned: number;
    totalCompleted: number;
  }[];
  topPerformers: { name: string; completionRate: number }[];
  stalledEmployees: { name: string; daysSinceActivity: number; currentPlan: string }[];
  weekOverWeekChange: number;
}

interface ReportPayload {
  orgName: string;
  period: string;
  aiSummary: string;
  keyMetrics: {
    overallCompletionRate: number;
    avgTimeToFirstStep: number;
    avgTimeToFullCompletion: number;
    topDropOffStep: number;
    mostEffectiveContent: string;
    leastEffectiveContent: string;
  };
  pdfUrl: string;
}

class NotificationService {
  // Determines which platform to use for a given user in a given org.
  // Checks: org has slack_team_id AND user has slack_user_id -> 'slack'
  //         org has teams_tenant_id AND user has teams_user_id -> 'teams'
  //         otherwise -> 'email'
  async resolvePlatform(orgId: string, userId: string): Promise<Platform>;

  // Routes to SlackNotifier, TeamsNotifier, or EmailNotifier based on resolvePlatform()
  async sendAssignment(userId: string, notification: AssignmentNotification): Promise<void>;
  async sendNudge(userId: string, nudge: NudgeNotification): Promise<void>;
  async sendStepConfirmation(userId: string, assignmentId: string, stepNumber: number): Promise<void>;

  // These always go to the org's configured channel (Slack or Teams) + admin email
  async sendWeeklyDigest(orgId: string, digest: DigestPayload): Promise<void>;
  async sendMonthlyReport(orgId: string, report: ReportPayload): Promise<void>;
}
```

---

## PART 4: 13-Phase Build Guide (Phase 0 through 12)

### Phase 0: External Services Setup **[NEW]**

**Goal:** Every external account is created, every API key is generated, and `.env.local` is fully populated before writing any code.

**Estimated hours:** 3-4 hours

**Modules covered:** None (infrastructure only)

**Dependencies:** None (first phase)

**Checklist — create these accounts in order:**

1. **GitHub** (github.com) — create a new repository called `recaller`. Initialize with a README. This is where your code lives.
2. **Supabase** (supabase.com) — create a new project. Pick a region close to your customers. Copy: Project URL, anon key, service_role key, project ref (the string in the URL after `/project/`). Also go to supabase.com/dashboard/account/tokens and create a Personal Access Token for the MCP server.
3. **Vercel** (vercel.com) — sign up with your GitHub account. Do NOT import the repo yet (we do that in Phase 12).
4. **OpenAI** (platform.openai.com) — create an account, add a payment method ($10 minimum), generate an API key. This is used for GPT-4.1 (plan generation), GPT-4.1 Mini (plan validation), and text-embedding-3-small (embeddings).
5. **Anthropic** (console.anthropic.com) — create an account, add a payment method ($5 minimum), generate an API key. This is used for Claude 3.7 Sonnet (content analysis and insight report writing). The multi-model approach uses the best AI for each task.
6. **Stripe** (stripe.com) — create an account. Stay in TEST mode. From Developers -> API keys, copy the publishable key (pk_test_...) and secret key (sk_test_...). We create the webhook secret in Phase 9.
7. **Slack** (api.slack.com/apps) — click "Create New App" -> "From scratch". Name it "Recaller", pick your test workspace. From Basic Information, copy: Client ID, Client Secret, Signing Secret. From OAuth & Permissions, add these Bot Token Scopes: `chat:write`, `commands`, `im:history`, `im:write`, `im:read`, `users:read`, `channels:read`. Install to workspace. Copy the Bot User OAuth Token (xoxb-...).
8. **Azure Portal** (portal.azure.com) — sign up for a free Azure account. Create a new "Azure Bot" resource (search for "Azure Bot" in the marketplace). Choose single-tenant. After creation: go to Configuration -> copy the Microsoft App ID. Go to Certificates & secrets -> New client secret -> copy the value. Go to Channels -> enable Microsoft Teams. Also find your Tenant ID under Microsoft Entra ID -> Overview.
9. **Resend** (resend.com) — sign up, generate an API key.
10. **Sentry** (sentry.io) — sign up, create a Next.js project, copy the DSN. Go to Settings -> Auth Tokens -> create a token.
11. **Inngest** (inngest.com) — sign up. For local development, you don't need keys (the dev server runs locally). Copy the Event Key and Signing Key for later production use.

**CURSOR PROMPT (Phase 0):**

```
In my Recaller project at /Users/danielozoani/Documents/Recaller, create a file called .env.local with the following template. Include comments explaining where to find each value:

# === Supabase ===
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# === OpenAI ===
OPENAI_API_KEY=

# === Anthropic ===
ANTHROPIC_API_KEY=

# === Stripe ===
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# === Slack ===
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
SLACK_BOT_TOKEN=
SLACK_STATE_SECRET=

# === Microsoft Teams / Azure ===
TEAMS_APP_ID=
TEAMS_APP_PASSWORD=
TEAMS_TENANT_ID=

# === Resend ===
RESEND_API_KEY=

# === Sentry ===
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# === Inngest ===
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# === App ===
NEXT_PUBLIC_APP_URL=http://localhost:3000

Also create a .env.local.example file with the same content but no values filled in (for committing to git). Create a .gitignore that includes .env.local and node_modules.
```

**TEST CHECKLIST:**

- Open `.env.local` and verify every variable has a value filled in (except STRIPE_WEBHOOK_SECRET and INNGEST keys which come later)
- Verify `.env.local.example` exists and has the same keys but empty values
- Verify `.gitignore` includes `.env.local`

**COMMON ERRORS:**

- **Supabase project not created yet:** You cannot get the URL and keys without a project. Go to supabase.com and create one first.
- **Slack app not installed to workspace:** After adding scopes, you must click "Install to Workspace" to get the bot token. The token does not appear until you install.
- **Azure "App Password" confusion:** The App Password is NOT the same as your Azure login password. It is a client secret you create under Certificates & secrets.

---

### Phase 1: Database Schema + Auth (8-10 hours)

**Goal:** User can sign up with email/password, log in, create an organisation, and see a blank dashboard with role-based routing (admin vs employee views).

**Modules covered:** A1, A4, A8, A9

**Dependencies:** Phase 0 (all API keys populated in .env.local)

**MCP servers activated:** Supabase (verify schema after migrations)

**CURSOR PROMPT 1 — Project scaffold:**

```
In my Recaller project at /Users/danielozoani/Documents/Recaller, the directory is currently empty. Run these terminal commands to scaffold the project:

1. npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
2. npx shadcn@latest init (choose New York style, Zinc base color, CSS variables yes)
3. npm install @supabase/supabase-js @supabase/ssr openai stripe inngest resend @react-email/components @sentry/nextjs recharts @react-pdf/renderer
4. npm install @vercel/slack-bolt @slack/web-api
5. npm install youtube-transcript pdf-parse mammoth
6. npm install -D supabase
7. npx supabase init

After running these commands, create the Supabase client utilities:
- src/lib/supabase/client.ts — browser client using createBrowserClient from @supabase/ssr
- src/lib/supabase/server.ts — server client using createServerClient from @supabase/ssr with cookies()
- src/middleware.ts — Supabase auth middleware that refreshes sessions and protects routes under /(dashboard) and /(employee)

Use NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from environment variables. Follow the official Supabase SSR pattern for Next.js App Router.
```

**CURSOR PROMPT 2 — Database migrations:**

```
In my Recaller project, I have Supabase initialized. Create 6 SQL migration files in the supabase/migrations/ directory. Each file must be a complete, runnable SQL script.

Migration 001_core_identity.sql:
First, enable the pgvector extension: CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
Create these tables:
- organisations: id (UUID PK DEFAULT gen_random_uuid()), name (TEXT NOT NULL), industry (TEXT), size (TEXT), logo_url (TEXT), slack_team_id (TEXT UNIQUE), teams_tenant_id (TEXT UNIQUE), org_context (JSONB DEFAULT '{}'), onboarding_completed (BOOLEAN DEFAULT false), created_at (TIMESTAMPTZ DEFAULT now())
- users: id (UUID PK REFERENCES auth.users ON DELETE CASCADE), org_id (UUID REFERENCES organisations NOT NULL), email (TEXT NOT NULL), full_name (TEXT), title (TEXT), role (TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'employee')) DEFAULT 'employee'), slack_user_id (TEXT), teams_user_id (TEXT), notification_preferences (JSONB DEFAULT '{"email": true, "slack": true, "teams": true}'), avatar_url (TEXT), created_at (TIMESTAMPTZ DEFAULT now())
- invitations: id (UUID PK DEFAULT gen_random_uuid()), org_id (UUID REFERENCES organisations NOT NULL), email (TEXT NOT NULL), role (TEXT NOT NULL DEFAULT 'employee'), status (TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired'))), invited_by (UUID REFERENCES users), created_at (TIMESTAMPTZ DEFAULT now())

Create indexes on users.slack_user_id, users.teams_user_id, users.org_id, users.email.

Enable RLS on all three tables. Create policies:
- organisations: Users can SELECT/UPDATE their own org (WHERE id = (SELECT org_id FROM users WHERE id = auth.uid()))
- users: Users can SELECT all users in their org. Users can UPDATE only their own record.
- invitations: Admins can INSERT/SELECT invitations in their org. Invited users can UPDATE their own invitation (by email match).

Migration 002_content_plans.sql:
Create tables for content_items, content_embeddings, plans, plan_steps, plan_embeddings with all columns specified in REASONING 4 above. The content_embeddings and plan_embeddings tables use the VECTOR(1536) type from pgvector (enabled in migration 001). Create an HNSW index on content_embeddings.embedding and plan_embeddings.embedding for fast similarity search: CREATE INDEX ON content_embeddings USING hnsw (embedding vector_cosine_ops). Enable RLS on all tables. Policies: users can only access content/plans in their own org. Admins can INSERT/UPDATE. Employees can SELECT.

Migration 003_assignments_completions.sql:
Create tables for groups, group_members, assignments, step_completions with all columns specified in REASONING 4. Enable RLS. Policies: admins can manage assignments in their org. Employees can SELECT their own assignments and INSERT step_completions for their own assignments.

Migration 004_notifications_messaging.sql:
Create tables for notifications, notification_suppressions, slack_installations, teams_installations with all columns specified in REASONING 4. Enable RLS. Service role access for notifications (these are created by background jobs, not directly by users).

Migration 005_billing.sql:
Create the subscriptions table with all columns specified in REASONING 4. Enable RLS. Only the org's admins can SELECT. Service role can INSERT/UPDATE (via Stripe webhooks).

Migration 006_insights.sql:
Create insight_reports and analytics_snapshots tables. Enable RLS. Admins can SELECT reports for their org. Service role can INSERT/UPDATE.

Every migration must use gen_random_uuid() for UUIDs, TIMESTAMPTZ for all timestamps, and include appropriate CHECK constraints.
```

**CURSOR PROMPT 3 — Auth pages + dashboard layout:**

```
In my Recaller project, I have Supabase client utilities at src/lib/supabase/client.ts and src/lib/supabase/server.ts, and middleware at src/middleware.ts. Now build the auth UI and dashboard shell.

Create these files:

1. src/app/(auth)/login/page.tsx — Email + password login form using shadcn/ui Card, Input, Button, Label. On submit, call supabase.auth.signInWithPassword(). On success, redirect to /dashboard. Show error messages inline. Mobile-first design.

2. src/app/(auth)/signup/page.tsx — Email + password signup form. On submit, call supabase.auth.signUp(). After signup, show a "Check your email for verification" message. Include fields for: email, password, full name, and org name (since first user creates the org). On email confirmation callback, create a row in organisations table and a row in users table with role='admin'.

3. src/app/(auth)/callback/route.ts — Handle the email confirmation redirect from Supabase Auth. Exchange the code for a session, then:
   - Check if a users record exists for this auth.uid()
   - If not, create the organisation and user (using the org_name stored in user_metadata during signup)
   - Redirect to /dashboard

4. src/app/(dashboard)/layout.tsx — Dashboard shell with:
   - Sidebar navigation: Dashboard, Content, Assignments, Team, Insights, Settings
   - Top bar with user name and logout button
   - Role-based nav: show Team, Insights, Settings only for role='admin'
   - Use shadcn/ui Sheet for mobile sidebar (hamburger menu)
   - Fetch user role from the users table server-side

5. src/app/(dashboard)/page.tsx — Simple welcome page that shows the org name and "Getting started" instructions

6. src/app/(employee)/layout.tsx — Simpler layout for employees with sidebar: My Plans, Profile

Use Tailwind CSS throughout. Mobile-first responsive design. All pages must work on a phone screen.
```

**TEST CHECKLIST:**

- Go to `http://localhost:3000/signup`, create an account, verify you get a confirmation email
- Click the email link, verify you are redirected to `/dashboard`
- Verify the sidebar shows admin navigation items
- Use the Supabase MCP server: "Query the organisations table and the users table — verify my signup created one row in each"
- Try accessing `/dashboard` in a private browser window without logging in — verify redirect to `/login`

**COMMON ERRORS:**

- **"relation users does not exist"**: Migrations have not been applied. Run `npx supabase db push` to apply all migrations to your remote Supabase project.
- **Email confirmation link goes to wrong URL**: In Supabase dashboard -> Authentication -> URL Configuration, set Site URL to `http://localhost:3000` and add `http://localhost:3000/callback` to Redirect URLs.
- **RLS blocks all reads**: If you get empty results after signup, check that the RLS policies reference `auth.uid()` correctly. Use the Supabase MCP server to query with service role to verify data exists.

---

### Phase 2: Content Ingestion (8-10 hours)

**Goal:** Admin can paste a YouTube URL and instantly get a transcript. Or upload an MP4/PDF/DOCX and see it processed. Content library shows all items with status.

**Modules covered:** B1-B10

**Dependencies:** Phase 1 (auth, org_id, content_items table)

**[CHANGED] Content extraction strategy:**

- **YouTube:** Use `youtube-transcript` npm package — extracts captions directly, no Whisper needed, no API key needed, instant results.
- **Vimeo:** Use Vimeo API to fetch text tracks/captions. Requires a Vimeo API token (free). Falls back to Whisper if no captions exist.
- **Loom:** Fetch transcript via Loom's GraphQL API (extracts VTT captions). Falls back to Whisper if unavailable.
- **Web articles:** Use `fetch` + HTML parsing to extract article text. No Whisper needed.
- **PDF files:** Use `pdf-parse` npm package. No Whisper needed.
- **DOCX files:** Use `mammoth` npm package. No Whisper needed.
- **MP4/MP3 files:** These are the ONLY types that need Whisper. Processed via Inngest background job.

This approach saves significant OpenAI API costs and makes 80% of content ingestion instant rather than async.

**CURSOR PROMPT 1 — Content extraction utilities:**

```
In my Recaller project, create content extraction utilities that pull text from various sources WITHOUT using OpenAI Whisper (Whisper is only for audio/video files that have no existing transcript).

Create these files:

1. src/lib/content/youtubeExtractor.ts
   - Export async function extractYouTubeTranscript(url: string): Promise<{transcript: string, metadata: object}>
   - Use the 'youtube-transcript' npm package (already installed)
   - Extract the video ID from various YouTube URL formats (youtube.com/watch?v=, youtu.be/, etc.)
   - Fetch the transcript, join all text segments with timestamps
   - Return the full transcript text and metadata (title, duration from segments)

2. src/lib/content/pdfExtractor.ts
   - Export async function extractPdfText(buffer: Buffer): Promise<string>
   - Use the 'pdf-parse' npm package

3. src/lib/content/docxExtractor.ts
   - Export async function extractDocxText(buffer: Buffer): Promise<string>
   - Use the 'mammoth' npm package, extract raw text

4. src/lib/content/loomExtractor.ts
   - Export async function extractLoomTranscript(url: string): Promise<string | null>
   - Extract the Loom video ID from the URL
   - Fetch transcript by querying Loom's public oembed endpoint first for metadata
   - Attempt to fetch the VTT transcript from Loom's CDN pattern
   - Return null if transcript is unavailable (caller will fall back to Whisper)

5. src/lib/content/vimeoExtractor.ts
   - Export async function extractVimeoTranscript(url: string): Promise<string | null>
   - Extract Vimeo video ID from URL
   - Use Vimeo's oEmbed endpoint for metadata
   - Return null if transcript unavailable (caller will fall back to Whisper)

Each function should throw descriptive errors for invalid URLs or failed extraction.
```

**CURSOR PROMPT 2 — Upload page + Inngest transcription job:**

```
In my Recaller project, I have content extractors at src/lib/content/. Now build the upload interface and the async transcription pipeline.

Create these files:

1. src/app/(dashboard)/content/upload/page.tsx
   - A form with two sections:
     a) "Paste a URL" — text input that accepts YouTube, Vimeo, Loom, or web article URLs
     b) "Upload a file" — drag-and-drop zone accepting MP4, MP3, PDF, DOCX (max 500MB)
   - On URL submit: call a server action that detects the source type, extracts the transcript using the appropriate extractor, creates a content_items row with status='ready' if transcript extraction succeeds, or status='queued' if it needs Whisper
   - On file upload: upload to Supabase Storage bucket 'content-files', create content_items row with status='queued', trigger Inngest event 'content/transcribe.requested'
   - Show a real-time status indicator (queued -> transcribing -> analyzing -> ready) using polling or Supabase Realtime subscription on the content_items row
   - Use shadcn/ui Card, Input, Button, Progress, Badge for status
   - Mobile-first layout

2. src/lib/inngest/client.ts
   - Create and export the Inngest client instance: new Inngest({ id: 'recaller' })

3. src/lib/inngest/functions/transcribeContent.ts
   - Create an Inngest function triggered by 'content/transcribe.requested'
   - Event data: { contentItemId: string }
   - Step 1: Fetch the content_items row, get the file_path
   - Step 2: Update status to 'transcribing'
   - Step 3: Download the file from Supabase Storage
   - Step 4: Send to OpenAI Whisper API (whisper-1 model) for transcription
   - Step 5: Update content_items row with transcript and status='ready'
   - On failure: update status='failed', log the error
   - Use inngest step.run() for each step so individual steps can retry

4. src/app/api/inngest/route.ts
   - Serve the Inngest functions: export the GET, POST, PUT handlers

5. src/app/(dashboard)/content/page.tsx
   - Content library page: list all content_items for the current org
   - Show: title, source type (YouTube/PDF/etc), status badge, created date
   - Search by title, filter by source_type, sort by date
   - Click any item to view its transcript
   - "Upload New" button links to /content/upload
   - Use shadcn/ui Table, Input (search), Select (filter), Badge (status)
```

**TEST CHECKLIST:**

- Go to `/content/upload`, paste a YouTube URL, verify transcript appears within 5 seconds (no Whisper needed)
- Upload a PDF file, verify text is extracted and status shows 'ready' immediately
- Upload an MP4 file, verify status shows 'queued', then start the Inngest dev server (`npx inngest-cli@latest dev`), verify status changes to 'transcribing' then 'ready'
- Go to `/content`, verify all uploaded items appear with correct statuses
- Search for a content item by title, verify filter works

**COMMON ERRORS:**

- **YouTube transcript fails with "Could not get transcript"**: Some YouTube videos have captions disabled. Show a user-friendly error: "This video has no captions available. Please upload the video file directly for AI transcription."
- **Inngest dev server not running**: Background jobs (Whisper transcription) only process when `npx inngest-cli@latest dev` is running locally. Always start it in a separate terminal.
- **File upload fails for large files**: Supabase Storage free tier limits files to 50MB. Upgrade to Pro ($25/month) for 500GB limit, or show a clear error for files over 50MB.

---

### Phase 3: AI Plan Generation — 3-Layer Intelligence Architecture (10-14 hours) **[CHANGED: expanded from 6-8 hours]**

**Goal:** Admin completes the Company Context Profile during onboarding, then generates plans that are deeply aware of what the company does, what employees' daily work looks like, and what "applying training" means in their specific context. Plans are analyzed, generated, and validated in a 3-stage pipeline. Quality scores are visible. Over time, the AI learns from admin-approved plans via embeddings.

**Modules covered:** C1-C9 + new: Company Context Profile, 3-stage AI pipeline, pgvector embeddings

**Dependencies:** Phase 2 (transcripts must exist in content_items), Phase 1 (org_context column, pgvector extension)

**CURSOR PROMPT 1 — Company Context Profile onboarding wizard:**

```
In my Recaller project, I have the organisations table with an org_context JSONB column and onboarding_completed BOOLEAN column. After a new admin signs up and creates their org, they must complete a Company Context Profile before they can upload content or generate plans.

Create these files:

1. src/app/(dashboard)/onboarding/context/page.tsx
   - A multi-step wizard form (4 steps) that collects company context. Use shadcn/ui Card, Input, Textarea, Select, Checkbox, Button, Progress.
   - Mobile-first design. One question group per step. Progress bar at top.

   STEP 1 — "About Your Company"
   - "In 2-3 sentences, what does your company do?" (textarea, required, min 20 chars)
   - "What industry are you in?" (select: Financial Services, Technology/SaaS, Healthcare, Professional Services, Education, Retail, Manufacturing, Other + custom input)
   - "How many employees will use Recaller?" (select: 1-25, 26-50, 51-100, 101-200, 201-500, 500+)

   STEP 2 — "Your Team's Roles"
   - "What roles will be completing training plans?" (multi-select checkboxes + custom: Sales/Account Management, Customer Success, Engineering/Technical, Compliance/Legal, Management/Leadership, Marketing, Operations, HR/People, Other)
   - For EACH selected role, a collapsible section with:
     "Describe a typical workday for someone in this role (2-3 sentences)" (textarea, required)
     "What tools do they use daily?" (multi-select: Salesforce, HubSpot, Slack, Jira, Confluence, Google Workspace, Microsoft 365, Zoom, custom text input for others)

   STEP 3 — "What 'Applying Training' Means Here"
   - "When an employee completes training, what does 'applying it' look like at your company?" (multi-select + custom:
     - "Changing how they interact with clients or customers"
     - "Adopting new internal processes or workflows"
     - "Using new tools, features, or systems"
     - "Improving technical skills (code, analysis, writing)"
     - "Meeting compliance or regulatory requirements"
     - "Improving leadership or management behaviors"
     - Custom free text)
   - "What activities should the AI NEVER suggest?" (textarea, optional. Examples: "Don't suggest cold-calling clients", "Don't suggest deploying code without review", "Don't suggest contacting patients directly")
   - "What does success look like after training at your company?" (textarea, optional. Example: "Advisors close 10% more meetings using the new discovery framework")

   STEP 4 — "Company Language" (optional, can be skipped)
   - "Add any company-specific terms or acronyms the AI should know:" (dynamic key-value pairs: term -> definition. Button: "Add another term")
   - Examples shown: "QBR -> Quarterly Business Review", "AE -> Account Executive", "ARR -> Annual Recurring Revenue"

   On completion:
   - Save the entire wizard output as a structured JSON object in organisations.org_context
   - Set organisations.onboarding_completed = true
   - Redirect to /dashboard

2. Update src/app/(dashboard)/layout.tsx:
   - Before rendering any dashboard page, check if org.onboarding_completed === false
   - If false, redirect to /onboarding/context
   - This ensures every admin completes the context profile before using the product

3. src/app/(dashboard)/settings/page.tsx:
   - Add an "AI Context" section where admins can edit the Company Context Profile at any time
   - Same form fields as the wizard, pre-populated with existing org_context data
   - "Save Changes" updates org_context and triggers re-embedding of the context

The org_context JSON structure stored should look like:
{
  "company_description": "string",
  "industry": "string",
  "employee_count": "string",
  "roles": [
    {
      "name": "Sales",
      "typical_day": "They spend mornings prospecting...",
      "tools": ["Salesforce", "Outreach", "Zoom"]
    }
  ],
  "application_types": ["Changing how they interact with clients"],
  "forbidden_activities": "Don't suggest cold-calling...",
  "success_definition": "Advisors close 10% more meetings...",
  "glossary": { "QBR": "Quarterly Business Review", "AE": "Account Executive" }
}
```

**CURSOR PROMPT 2 — Embedding service for organizational learning:**

```
In my Recaller project, I have pgvector enabled in Supabase (via migration 001) and content_embeddings + plan_embeddings tables (via migration 002). Now build the embedding service that powers organizational learning.

Create src/lib/ai/embeddingService.ts:

1. Export async function generateEmbedding(text: string): Promise<number[]>
   - Call OpenAI text-embedding-3-small API with the input text
   - Return the 1536-dimensional vector
   - Handle rate limits with exponential backoff

2. Export async function embedContentItem(contentItemId: string, orgId: string): Promise<void>
   - Fetch the content item's transcript
   - Chunk the transcript into segments of ~400 tokens each (split at paragraph boundaries)
   - For each chunk: generate embedding, insert into content_embeddings table with chunk_index, chunk_text, and embedding vector
   - Update content_items.transcript_chunks with the chunked text array

3. Export async function embedApprovedPlan(planId: string, orgId: string): Promise<void>
   - Fetch the plan's current_version JSON
   - Serialize all 4 steps into a single text: "Plan: {title}. Step 1: {title} - {instructions}. Step 2: ..."
   - Generate one embedding for the full plan text
   - Insert into plan_embeddings with is_admin_approved = true
   - This function is called when an admin saves edits to a plan (their edits represent "good" output for this org)

4. Export async function findSimilarApprovedPlans(queryText: string, orgId: string, limit: number = 3): Promise<SimilarPlan[]>
   - Generate an embedding for the query text (usually the content transcript summary)
   - Query plan_embeddings using cosine similarity:
     SELECT pe.plan_text, pe.plan_id, 1 - (pe.embedding <=> query_embedding) AS similarity
     FROM plan_embeddings pe
     WHERE pe.org_id = $1 AND pe.is_admin_approved = true
     ORDER BY pe.embedding <=> query_embedding
     LIMIT $2
   - Return the top N most similar approved plans with their full text
   - These become few-shot examples in the generation prompt

5. Export async function findRelevantContentChunks(queryText: string, orgId: string, limit: number = 5): Promise<ContentChunk[]>
   - Similar to above but searches content_embeddings
   - Used by the insight engine to find contextually relevant training content

The embedding cost is negligible: text-embedding-3-small costs $0.02 per million tokens. A typical transcript (5,000 words) generates ~10 chunks, costing less than $0.001 total.
```

**CURSOR PROMPT 3 — 3-Stage AI plan generation pipeline:**

```
In my Recaller project, I have the Company Context Profile stored in organisations.org_context, the embedding service at src/lib/ai/embeddingService.ts, and content_items with transcripts. Now build the 3-stage AI plan generation pipeline. This is the core intelligence of the product.

Create these files:

1. src/lib/ai/modelRouter.ts
   - Export configured AI clients:
     a) anthropicClient — Anthropic SDK client initialized with ANTHROPIC_API_KEY
     b) openaiClient — OpenAI SDK client initialized with OPENAI_API_KEY
   - Export constants for model names:
     ANALYSIS_MODEL = 'claude-3-7-sonnet-20250219' (Stage 1: deep comprehension)
     GENERATION_MODEL = 'gpt-4.1' (Stage 2: structured output)
     VALIDATION_MODEL = 'gpt-4.1-mini' (Stage 3: cost-efficient judging)
     EMBEDDING_MODEL = 'text-embedding-3-small' (embeddings)
     NARRATIVE_MODEL = 'claude-3-7-sonnet-20250219' (insight report writing)
   - This single file controls which AI model is used for each task. To upgrade later, change the model string here.

2. src/lib/ai/contentAnalyzer.ts (STAGE 1 — Analyze before generating)
   Export async function analyzeContent(transcript: string, orgContext: OrgContext): Promise<ContentAnalysis>

   This uses Claude 3.7 Sonnet (via Anthropic SDK) because it has the strongest reading comprehension and reasoning — scoring 84.8% on graduate-level analysis vs GPT-4.1's 66.3%. When understanding nuanced training content (leadership frameworks, compliance regulations, complex sales methodologies), Claude catches subtleties that GPT-4.1 misses.

   System prompt:
   "You are an expert corporate training content analyst. You are analyzing training content for a company with this context:

   Company: {orgContext.company_description}
   Industry: {orgContext.industry}
   Roles using this training: {orgContext.roles.map(r => r.name).join(', ')}
   How they apply training: {orgContext.application_types.join(', ')}

   Analyze the following transcript and return a structured analysis. Do NOT generate a plan — only analyze.

   Return JSON:
   {
     key_concepts: string[] (the 3-5 most important ideas taught),
     skills_taught: string[] (specific skills this content develops),
     behavioral_changes_advocated: string[] (what the content wants people to DO differently),
     applicable_roles: string[] (which of the company's roles would benefit most),
     complexity: 'beginner' | 'intermediate' | 'advanced',
     category: string (e.g., 'sales technique', 'compliance', 'leadership', 'technical skills'),
     estimated_content_quality: 1-5 (is this actually good training content?),
     risk_flags: string[] (any concerns: outdated info, contradicts common practice, compliance-sensitive, etc.),
     summary: string (3-sentence summary of what this content teaches)
   }"

   Use structured outputs with strict JSON schema for reliability.

3. src/lib/ai/planGenerator.ts (STAGE 2 — Context-aware generation)
   Export async function generatePlan(
     transcript: string,
     analysis: ContentAnalysis,
     orgContext: OrgContext,
     targetRole: string,
     similarPlans: SimilarPlan[]
   ): Promise<GeneratedPlan>

   This uses GPT-4.1 (via OpenAI SDK) because it has the best structured output reliability — strict JSON schema mode guarantees valid output every time. Its 1M token context window fits the full transcript + analysis + company context + 3 few-shot plans without truncation. GPT-4.1 also costs 20% less than GPT-4o while being more capable.

   This generates the 4-step plan using ALL available context.

   System prompt:
   "You are an expert corporate learning execution designer. You create 4-step action plans that transform training content into concrete behavioral change.

   COMPANY CONTEXT:
   {orgContext.company_description}
   Industry: {orgContext.industry}

   TARGET EMPLOYEE ROLE: {targetRole}
   Their typical day: {role.typical_day}
   Tools they use: {role.tools.join(', ')}

   HOW THIS COMPANY APPLIES TRAINING:
   {orgContext.application_types.join('. ')}

   ACTIVITIES THE AI MUST NEVER SUGGEST:
   {orgContext.forbidden_activities || 'None specified'}

   COMPANY VOCABULARY:
   {Object.entries(orgContext.glossary || {}).map(([term, def]) => `${term} = ${def}`).join(', ')}

   CONTENT ANALYSIS (from Stage 1):
   Key concepts: {analysis.key_concepts.join(', ')}
   Skills taught: {analysis.skills_taught.join(', ')}
   Behavioral changes advocated: {analysis.behavioral_changes_advocated.join(', ')}
   Category: {analysis.category}

   EXAMPLES OF GOOD PLANS PREVIOUSLY APPROVED FOR THIS COMPANY:
   {similarPlans.map((p, i) => `Example ${i+1}: ${p.plan_text}`).join('\n\n')}

   RULES:
   1. Step 1 must be completable in under 15 minutes during the employee's normal workday
   2. Every step must reference the employee's actual work activities and tools — not generic exercises
   3. Success criteria must be objectively verifiable (something a manager could confirm happened)
   4. Each step must build on the previous one, creating a progression from awareness to application to habit
   5. Use the company's vocabulary and terminology where appropriate
   6. If the content is video, include timestamp ranges for relevant sections
   7. Instructions must be specific enough that the employee knows EXACTLY what to do without interpretation
   8. If similar approved plans exist, match their tone and specificity level

   Generate a 4-step execution plan. Return JSON:
   {
     title: string,
     category: string,
     complexity: string,
     skill_level: string,
     target_role: string,
     steps: [
       {
         step_number: 1-4,
         title: string,
         instructions: string (minimum 60 words, company-specific and actionable),
         success_criteria: string (objectively verifiable),
         video_timestamp_start: number | null,
         video_timestamp_end: number | null,
         estimated_minutes: number
       }
     ]
   }"

   Use structured outputs with strict JSON schema.

4. src/lib/ai/planValidator.ts (STAGE 3 — Quality validation)
   Export async function validatePlan(
     plan: GeneratedPlan,
     orgContext: OrgContext,
     analysis: ContentAnalysis
   ): Promise<ValidationResult>

   This uses GPT-4.1 Mini (via OpenAI SDK) because validation is a simpler evaluation task — scoring 5 dimensions against clear criteria. GPT-4.1 Mini has the same structured output reliability as the full model at 80% lower cost ($0.40/$1.60 vs $2.00/$8.00 per million tokens). No need for the full model or Claude here.

   System prompt:
   "You are a quality assurance reviewer for corporate training execution plans. Score the following plan on 5 dimensions using a 1-5 scale.

   COMPANY CONTEXT:
   {orgContext.company_description}
   Activities they should NEVER suggest: {orgContext.forbidden_activities}
   How they apply training: {orgContext.application_types}

   CONTENT ANALYSIS:
   Key concepts: {analysis.key_concepts}
   Skills taught: {analysis.skills_taught}

   THE PLAN TO EVALUATE:
   {JSON.stringify(plan)}

   Score each dimension 1-5:
   1. relevance: Do the steps directly relate to what employees at this company actually do?
   2. specificity: Are instructions concrete enough to follow without interpretation? (No vague 'reflect on...' or 'think about...')
   3. progressiveness: Does each step build meaningfully on the previous one?
   4. feasibility: Can Step 1 realistically be done in 15 minutes during a normal workday?
   5. measurability: Can a manager objectively verify each success criteria was met?

   Also flag: does any step suggest a forbidden activity?

   Return JSON:
   {
     scores: { relevance: 1-5, specificity: 1-5, progressiveness: 1-5, feasibility: 1-5, measurability: 1-5 },
     overall_score: number (average of all 5),
     forbidden_activity_violation: boolean,
     feedback: string (1-2 sentences of specific improvement suggestions if any score < 4),
     pass: boolean (true if overall_score >= 3.5 AND no forbidden_activity_violation)
   }"

   Use structured outputs with strict JSON schema.

5. src/app/api/plans/generate/route.ts
   - POST handler: receives { contentItemId: string, targetRole?: string }
   - Fetch: content item transcript, org's org_context, the target role details from org_context.roles
   - If no targetRole specified, use the first role in org_context.roles
   - Pipeline:
     a) Clean transcript (transcriptCleaner.ts)
     b) STAGE 1: analyzeContent(cleanedTranscript, orgContext) -> ContentAnalysis
     c) Find similar approved plans: findSimilarApprovedPlans(analysis.summary, orgId, 3)
     d) STAGE 2: generatePlan(cleanedTranscript, analysis, orgContext, targetRole, similarPlans) -> GeneratedPlan
     e) STAGE 3: validatePlan(plan, orgContext, analysis) -> ValidationResult
     f) If validation fails (pass === false) AND retries < 2:
        - Inject the validation feedback into the Stage 2 prompt and regenerate
        - Re-validate
     g) Save to database: plans row with content_analysis, quality_scores, original_ai_draft, current_version
     h) Create 4 plan_steps rows
     i) Embed the content item (if not already embedded): embedContentItem()
   - Return: plan ID + quality scores + validation feedback

   Show a real-time progress indicator to the admin:
   "Analyzing content..." -> "Generating plan for {role}..." -> "Validating quality..." -> "Done!"
   Use Server-Sent Events or polling for status updates.

6. src/app/(dashboard)/plans/[id]/page.tsx
   - Plan detail and editor page
   - NEW: Show quality scores at the top as 5 small gauges or a radar chart:
     Relevance: 4.2/5, Specificity: 4.5/5, etc.
   - NEW: Show the content analysis summary (from Stage 1) in a collapsible "AI Analysis" section
   - NEW: Show which role this plan targets, with option to regenerate for a different role
   - NEW: If the admin edits and saves, automatically call embedApprovedPlan() to teach the AI
   - Show all 4 steps in editable Cards (same as before):
     - Step number, title (editable input)
     - Instructions (editable textarea)
     - Success criteria (editable textarea)
     - Video timestamp range (editable inputs)
     - Estimated minutes (editable number input)
   - "Save Changes" button: updates current_version, creates embedding of admin-approved version
   - "Reset to AI Draft" button: reverts to original_ai_draft
   - "Save as Template" toggle
   - "Regenerate for Different Role" dropdown using roles from org_context
   - Use shadcn/ui Card, Input, Textarea, Button, Badge, Switch, Progress
```

**TEST CHECKLIST:**

- Complete the Company Context Profile at `/onboarding/context` — fill out all 4 steps
- Verify `organisations.org_context` in the database is populated (use Supabase MCP: "Query the organisations table and show me the org_context JSON for my org")
- Go to `/content`, select a content item, click "Generate Plan"
- Verify the progress indicator shows all 3 stages: "Analyzing..." -> "Generating..." -> "Validating..."
- Verify the plan references YOUR company's specific context (your tools, your terminology, your workflows — not generic advice)
- Verify quality scores are shown on the plan detail page
- Verify Step 1 is something an employee could do during their actual workday
- Edit a plan, save it, then generate a NEW plan from different content — verify the new plan's tone and specificity are influenced by the approved plan (embedding few-shot learning)
- Try generating for two different roles — verify the steps are materially different
- Check the database: verify `plans.content_analysis`, `plans.quality_scores`, `plan_embeddings`, and `content_embeddings` all have data

**COMMON ERRORS:**

- **AI returns invalid JSON in one of the 3 stages**: For GPT-4.1 stages (2 and 3), use structured outputs with `strict: true` — this guarantees valid JSON. For the Claude stage (1), use Anthropic's structured output with JSON schema — if it occasionally prepends prose, strip everything before the first `{`.
- **Plan generation takes 30-45 seconds (3 API calls)**: This is expected with 3 sequential AI calls across two providers. The progress indicator is critical so the admin doesn't think it's broken. Consider running Stage 1 (Claude analysis) as a background job immediately after content ingestion, so it's pre-computed when the admin clicks "Generate Plan."
- **Embeddings return no similar plans for a new org**: This is expected for the first few plans — there are no approved plans yet to learn from. The `similarPlans` array will be empty, and the generation prompt handles this gracefully by omitting the examples section. Plans get better over time as the admin approves and edits more plans.
- **"forbidden_activity_violation" fails validation**: The validator caught a step that suggests something the admin said to never suggest. The retry loop regenerates with explicit feedback. If it fails twice, show the plan to the admin with a warning flag and let them decide.
- **Org_context is empty**: The onboarding redirect in the dashboard layout should prevent this, but if somehow bypassed, the plan generator should fall back to a generic prompt (similar to v1) and show a banner: "Set up your Company Context Profile to get better plans."

---

### Phase 4: Employee Web Interface (6-8 hours)

**Goal:** Employee logs in, sees all assigned plans, can view one step at a time prominently, mark steps complete, and see progress.

**Modules covered:** E1-E3, E6-E10

**Dependencies:** Phase 3 (plans and plan_steps must exist), Phase 1 (employee role)

**CURSOR PROMPT 1:**

```
In my Recaller project, I have plans with plan_steps, and a users table with roles. Now build the employee-facing interface. All employee pages MUST be mobile-first — designed for phone screens with desktop as secondary.

Create these files:

1. src/app/(employee)/my-plans/page.tsx
   - Employee dashboard showing all plans assigned to the current user
   - For each assignment, show a Card with:
     - Plan title
     - Progress bar (X of 4 steps completed) using shadcn/ui Progress
     - Status badge: 'Not Started', 'In Progress', 'Completed', 'Overdue'
     - Due date if set
   - Sort: active plans first, then completed
   - Link each card to /my-plans/[assignmentId]
   - Empty state: "No plans assigned yet. Check back soon!"

2. src/app/(employee)/my-plans/[id]/page.tsx
   - Step-by-step plan view for a single assignment
   - Show plan title and overall progress bar at top
   - Display ONE step prominently at a time (the current incomplete step)
   - Current step Card shows:
     - Step number and title (large, bold)
     - Full instructions text
     - Success criteria in a highlighted box
     - If video: a "Watch [timestamp range]" link that opens the video at the exact start time
     - Estimated time badge
     - Optional: text area for "Add a note about this step" and difficulty rating (1-5 stars)
     - Large "Mark Step Complete" button (full-width, prominent green)
   - Completed steps show above as collapsed cards with a green checkmark
   - Future steps show below as locked/dimmed cards
   - When the last step is completed, show a celebration animation (confetti or similar CSS animation) and a congratulations message
   - Include a "View All Steps" toggle that expands all steps

3. src/app/api/completions/route.ts
   - POST handler: receives { assignmentId: string, stepNumber: number, note?: string, difficultyRating?: number, platform: 'web' | 'slack' | 'teams' }
   - Verify the authenticated user is the assignee
   - Create a step_completions row
   - If all 4 steps are completed, update assignments.status to 'completed'
   - Return the updated assignment status

4. src/components/employee/CompletionAnimation.tsx
   - A celebration component shown when all 4 steps are completed
   - CSS-only confetti animation (no external library needed)
   - Shows: "Congratulations! You completed [Plan Title]"
   - Auto-dismiss after 5 seconds with a close button

Make all pages fully responsive. On mobile (< 768px): full-width cards, stacked layout, large touch targets (minimum 44px height for buttons). On desktop: centered max-width container.
```

**TEST CHECKLIST:**

- Create a test assignment (via Supabase dashboard: insert an assignment row for your employee user)
- Go to `/my-plans`, verify the assignment appears with 0/4 progress
- Click the assignment, verify Step 1 is shown prominently
- Click "Mark Step Complete", verify the step shows a green checkmark, Step 2 becomes current
- Complete all 4 steps, verify the confetti animation plays
- Resize browser to mobile width, verify the layout works on a phone screen
- Check the database: "Query step_completions for this assignment — verify 4 rows exist with platform_completed_on = 'web'"

**COMMON ERRORS:**

- **Assignment not appearing**: Check that the assignment's `assigned_to` matches the logged-in user's `id` in the users table. RLS may be blocking access.
- **Completion API returns 403**: The user must be authenticated and be the assignee. Check middleware is passing the session correctly.
- **Progress bar shows NaN**: Ensure you're dividing completed steps (count) by total steps (always 4), not by 0.

---

### Phase 5: Manager Dashboard + Distribution (8-10 hours)

**Goal:** Manager can see team completion rates with traffic lights, view completion funnels, create and distribute assignments, and export data.

**Modules covered:** F1-F8, D1-D3, D7-D9

**Dependencies:** Phase 4 (step_completions must be writable)

**CURSOR PROMPT 1 — Dashboard overview:**

```
In my Recaller project, I have assignments and step_completions data. Now build the manager dashboard and assignment distribution system.

Create these files:

1. src/app/(dashboard)/page.tsx (replace the placeholder)
   - Manager dashboard home with:
     a) Summary cards at top: Total Active Plans, Overall Completion Rate, Employees Engaged, Plans Overdue
     b) Active plans list — each plan shown as a Card with:
        - Plan title and assignment count
        - Completion rate percentage and progress bar
        - Traffic light indicator: Green (>75% complete), Yellow (50-75%), Red (<50%)
        - Click to view plan detail
     c) Recent activity feed: last 10 step completions across the org (employee name, plan title, step number, timestamp)
   - All data fetched server-side from Supabase with the user's org_id

2. src/app/(dashboard)/team/page.tsx
   - Team overview page:
     a) Employee table: name, title, active assignments count, overall completion rate, last activity date
     b) Click any employee to see their full cross-plan history
     c) Color-coded rows: green for >75% rate, yellow for 50-75%, red for <50%
   - Includes a date range filter (shadcn/ui DatePickerWithRange)
   - CSV export button: generates a CSV of the visible table data

3. src/app/(dashboard)/assignments/page.tsx
   - Assignment creation and management page:
     a) "New Assignment" button opens a modal/sheet with:
        - Select a plan (dropdown of all plans in org)
        - Assign to: individual (user dropdown), group (group dropdown), or all employees
        - Due date (optional date picker)
        - Schedule for later (optional date-time picker)
     b) Assignment history table: plan title, assigned to, assigned by, status, due date, created date
     c) Bulk actions: cancel selected assignments
   - Include group management: create groups, add/remove members

4. src/components/dashboard/CompletionFunnel.tsx
   - A recharts BarChart showing completion funnel for a specific plan:
     - X-axis: Step 1, Step 2, Step 3, Step 4
     - Y-axis: number of employees who completed that step
     - Shows the drop-off between each step
   - Used on the plan detail page

5. src/components/dashboard/CsvExport.tsx
   - Reusable component that takes an array of objects and downloads as CSV
   - Used on team page and assignment history page
```

**TEST CHECKLIST:**

- Go to `/dashboard`, verify summary cards show correct numbers
- Verify traffic light colors match completion rate thresholds
- Go to `/assignments`, create a new assignment for an individual employee
- Go to `/team`, verify the employee table shows data
- Click CSV export, verify a file downloads with correct data
- Create a group, add members, assign a plan to the group — verify all group members receive the assignment

**COMMON ERRORS:**

- **Dashboard shows 0 for everything**: You need test data. Create assignments and step_completions via Supabase dashboard or a seed script. Remember insert order: assignments first, then step_completions.
- **Traffic light colors wrong**: Ensure the completion rate calculation divides completed_steps by (total_assignments * 4), not by total_assignments alone.
- **CSV export is empty on Safari**: Some browsers handle Blob URLs differently. Use `window.URL.createObjectURL()` and clean up with `URL.revokeObjectURL()`.

---

### Phase 6: Slack Bot (14-18 hours) **[CHANGED: increased from 10-14]**

**Goal:** Employee receives a plan in Slack DM as a beautifully formatted Block Kit message and completes all 4 steps via interactive buttons without ever leaving Slack.

**Modules covered:** I1-I11, D4, E4, A2, A6

**Dependencies:** Phase 5 (assignments, completions, user table with slack_user_id)

**MCP servers activated:** Slack (test messages, list channels, verify bot)

**This phase has two sub-phases: 6a (Slack app dashboard setup) and 6b (code).**

**PHASE 6a — Slack App Dashboard Setup (no code, just clicking):**

Go to [https://api.slack.com/apps](https://api.slack.com/apps) and select your Recaller app. Configure these settings:

1. **OAuth & Permissions:**
  - Redirect URL: `http://localhost:3000/api/slack/oauth` (add your production URL later)
  - Bot Token Scopes (add all): `chat:write`, `commands`, `im:history`, `im:read`, `im:write`, `users:read`, `users:read.email`, `channels:read`
2. **Interactivity & Shortcuts:**
  - Toggle ON
  - Request URL: `https://YOUR-NGROK-URL.ngrok-free.app/api/slack/events` (you need ngrok for local development — install with `brew install ngrok` then run `ngrok http 3000`)
3. **Slash Commands:**
  - Create `/recaller-status` — Request URL: same ngrok URL + `/api/slack/events` — Description: "View your Recaller plan progress"
  - Create `/recaller-team` — Request URL: same ngrok URL + `/api/slack/events` — Description: "View team completion summary (admins)"
4. **Event Subscriptions:**
  - Toggle ON
  - Request URL: same ngrok URL + `/api/slack/events`
  - Subscribe to bot events: `app_home_opened`, `message.im`

**CURSOR PROMPT 1 — Slack Bolt app + OAuth:**

```
In my Recaller project, I have a Slack app configured at api.slack.com. Now build the Slack bot integration using @vercel/slack-bolt.

Create these files:

1. src/lib/slack/app.ts
   - Create and export a Slack Bolt app instance using VercelReceiver from @vercel/slack-bolt
   - Configure with SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET from env
   - Register action handlers for these action_ids:
     a) 'start_step' — when user clicks "Start Step 1" button
     b) 'complete_step_{1-4}' — when user clicks "Mark Step X Complete" button
   - For each complete_step action:
     - Acknowledge the action (ack())
     - Extract assignmentId and stepNumber from the action value
     - Call the completions API to record the completion with platform='slack'
     - Update the original message in-place using chat.update with the updated Block Kit (showing checkmark on completed step)
   - Register slash command handlers:
     a) '/recaller-status' — fetch user's active assignments by slack_user_id, respond with a summary
     b) '/recaller-team' — check if user is admin, fetch team stats, respond with summary

2. src/lib/slack/blockKit.ts
   - Export function buildAssignmentMessage(assignment, steps, employeeName): SlackBlockKit
     Returns complete Block Kit JSON for an assignment DM:

     {
       "blocks": [
         {
           "type": "header",
           "text": { "type": "plain_text", "text": "New Training Plan: {planTitle}" }
         },
         {
           "type": "section",
           "text": { "type": "mrkdwn", "text": "Hi {employeeName}! You've been assigned a new execution plan. Complete these 4 steps to put your training into practice." }
         },
         {
           "type": "divider"
         },
         // For each step:
         {
           "type": "section",
           "text": { "type": "mrkdwn", "text": "*Step {n}: {title}*\n{instructions}\n\n_Success criteria: {criteria}_\n_Estimated: {minutes} min_" }
         },
         {
           "type": "actions",
           "elements": [
             {
               "type": "button",
               "text": { "type": "plain_text", "text": "Mark Step {n} Complete" },
               "style": "primary",
               "action_id": "complete_step_{n}",
               "value": "{assignmentId}:{n}"
             }
           ]
         },
         // ... repeat for all 4 steps
         {
           "type": "context",
           "elements": [
             { "type": "mrkdwn", "text": "Due: {dueDate} | Reply to this message if you have questions" }
           ]
         }
       ]
     }

   - Export function buildCompletedStepMessage(assignment, steps, completedSteps): SlackBlockKit
     Same structure but completed steps show "Step {n} Completed" with a checkmark emoji instead of a button

   - Export function buildNudgeMessage(assignment, currentStep): SlackBlockKit
     A shorter message reminding the employee about their current step with full instructions inline

   - Export function buildWeeklyDigestMessage(digest: DigestPayload): SlackBlockKit
     Summary of team performance posted to a channel

3. src/app/api/slack/events/route.ts
   - Import the Bolt app and createHandler from @vercel/slack-bolt
   - Export POST handler using createHandler(app, receiver)
   - This single endpoint handles: interactive buttons, slash commands, and events

4. src/app/api/slack/oauth/route.ts
   - GET handler for Slack OAuth callback
   - Exchange the authorization code for a bot token
   - Store in slack_installations table: team_id, bot_token (encrypted), bot_user_id, scopes
   - Update the organisations table: set slack_team_id
   - Fetch workspace members via Slack users.list API, match by email to existing Recaller users, set slack_user_id on matching users
   - Redirect to /settings with success message

All Block Kit messages must include the FULL step instructions inline — not just a link to the web app. The employee must be able to understand exactly what to do and mark it complete without leaving Slack.
```

**CURSOR PROMPT 2 — Send assignment via Slack:**

```
In my Recaller project, I have the Slack bot at src/lib/slack/app.ts and Block Kit builders at src/lib/slack/blockKit.ts. Now create the SlackNotifier that sends assignment messages.

Create src/lib/notifications/SlackNotifier.ts:
- Export class SlackNotifier
- Constructor takes: slackBotToken (string)
- Method sendAssignment(slackUserId: string, notification: AssignmentNotification):
  - Build Block Kit message using buildAssignmentMessage()
  - Use @slack/web-api WebClient to call chat.postMessage to the user's DM
  - Store the returned message ts (timestamp) in the notifications table as slack_message_ts
- Method sendNudge(slackUserId: string, nudge: NudgeNotification):
  - Build nudge Block Kit message
  - Post as a new DM
- Method sendStepConfirmation(slackUserId: string, assignmentId: string, stepNumber: number):
  - Fetch the original notification's slack_message_ts
  - Build the updated message with the completed step showing a checkmark
  - Use chat.update to replace the original message in-place
  - This is critical: the message updates IN PLACE, not a new message
- Method sendWeeklyDigest(channelId: string, digest: DigestPayload):
  - Build weekly digest Block Kit message
  - Post to the designated Slack channel

The chat.update approach means the employee sees ONE message that evolves as they complete steps — not 4 separate messages. This keeps their DM clean and provides a visual progress tracker.
```

**TEST CHECKLIST:**

- Start ngrok (`ngrok http 3000`), update the ngrok URL in Slack app dashboard
- Go to `/settings`, click "Connect Slack", verify OAuth flow completes
- Verify `slack_installations` has a row and `organisations.slack_team_id` is set
- Create a test assignment for a user who has a `slack_user_id`
- Verify the user receives a DM in Slack with the full Block Kit message
- Click "Mark Step 1 Complete" in Slack — verify the message updates in-place with a checkmark
- Type `/recaller-status` in Slack — verify personal progress appears
- Complete all 4 steps in Slack, verify the assignment status is 'completed' in the database

**COMMON ERRORS:**

- **Slack says "dispatch_failed"**: Your ngrok URL changed (ngrok gives a new URL each restart on free plan). Update the URL in all three places: Interactivity, Slash Commands, Event Subscriptions.
- **Button click returns "expired_trigger_id"**: Slack requires acknowledgment within 3 seconds. `@vercel/slack-bolt` handles this via `waitUntil`, but if your handler throws an error before `ack()`, the trigger expires. Always `ack()` first, then do work.
- **chat.update fails with "message_not_found"**: The `slack_message_ts` in notifications table is wrong or missing. Verify it's stored correctly when the original message is sent.
- **Users don't have slack_user_id**: The OAuth callback must map Slack users to Recaller users by email. If emails don't match, the mapping fails silently. Add logging.

---

### Phase 7: Microsoft Teams Bot (16-22 hours) **[CHANGED: increased from 10-14, REST API approach instead of BotBuilder SDK]**

**Goal:** Employee receives a plan as a Teams Adaptive Card DM and completes all 4 steps via card buttons without leaving Teams.

**Modules covered:** J1-J9, D5, E5, A3, A6

**Dependencies:** Phase 5, Phase 6 (NotificationService pattern established in Slack phase)

**MCP servers activated:** Teams (test messages)

**WARNING: This is the hardest phase in the entire project.** The Teams bot ecosystem is more complex than Slack. The Azure Portal has more steps. Take it slowly.

**[CHANGED] Architecture decision — REST API, not BotBuilder SDK:**

The `botbuilder` npm package was designed for long-running Node.js servers. On Vercel's serverless functions (which cold-start and terminate), it causes subtle bugs with in-memory state and middleware pipelines. Instead, we use the Bot Connector REST API directly — raw `fetch` calls with proper authentication. This is more verbose but more reliable on serverless.

**PHASE 7a — Azure Portal Setup (no code):**

1. Go to [https://portal.azure.com](https://portal.azure.com)
2. Search for "Azure Bot" -> Create
3. Bot handle: "RecallerBot"
4. Subscription: your Azure subscription (free tier works)
5. Resource group: create new "recaller-resources"
6. Type: Single Tenant
7. Creation type: "Create new Microsoft App ID"
8. After creation, go to the bot resource:
  - **Configuration**: copy the Microsoft App ID. Set Messaging endpoint to: `https://YOUR-NGROK-URL.ngrok-free.app/api/teams/messages`
  - **Certificates & secrets**: create a new client secret, copy the value immediately (it's shown only once). This is your TEAMS_APP_PASSWORD.
  - **Channels**: click Microsoft Teams -> Save
9. In **Microsoft Entra ID** -> App registrations -> find your bot's app -> API Permissions: add `User.Read` (should be there by default)
10. Find your Tenant ID: Microsoft Entra ID -> Overview -> Tenant ID

**CURSOR PROMPT 1 — Teams REST client + token manager:**

```
In my Recaller project, I am building the Microsoft Teams bot using the Bot Connector REST API directly (NOT the botbuilder SDK — that SDK doesn't work well on Vercel serverless). Create the Teams bot infrastructure:

1. src/lib/teams/tokenManager.ts
   - Export class TeamsTokenManager
   - Method getAccessToken(): Promise<string>
     - POST to https://login.microsoftonline.com/{TEAMS_TENANT_ID}/oauth2/v2.0/token
     - Body (x-www-form-urlencoded): grant_type=client_credentials, client_id=TEAMS_APP_ID, client_secret=TEAMS_APP_PASSWORD, scope=https://api.botframework.com/.default
     - Cache the token in memory until it expires (check expires_in field)
     - Return the access_token string

2. src/lib/teams/restClient.ts
   - Export class TeamsRestClient
   - Constructor takes: tokenManager (TeamsTokenManager)
   - Method sendMessage(serviceUrl: string, conversationId: string, activity: object): Promise<{id: string}>
     - GET access token from tokenManager
     - POST to {serviceUrl}/v3/conversations/{conversationId}/activities
     - Headers: Authorization: Bearer {token}, Content-Type: application/json
     - Body: the activity object (which contains the Adaptive Card)
     - Return the response { id } (this is the activityId for later updates)
   - Method updateMessage(serviceUrl: string, conversationId: string, activityId: string, activity: object): Promise<void>
     - PUT to {serviceUrl}/v3/conversations/{conversationId}/activities/{activityId}
     - Same auth headers
     - Body: updated activity
   - Method createConversation(serviceUrl: string, tenantId: string, userId: string): Promise<{id: string, activityId: string}>
     - POST to {serviceUrl}/v3/conversations
     - Body: { bot: { id: TEAMS_APP_ID }, members: [{ id: userId }], tenantId, isGroup: false }
     - Return the conversation id (for proactive DMs)

3. src/lib/teams/adaptiveCards.ts
   - Export function buildAssignmentCard(assignment, steps, employeeName): AdaptiveCard
     Returns complete Adaptive Card JSON:

     {
       "type": "AdaptiveCard",
       "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
       "version": "1.5",
       "body": [
         {
           "type": "TextBlock",
           "text": "New Training Plan: {planTitle}",
           "size": "Large",
           "weight": "Bolder",
           "wrap": true
         },
         {
           "type": "TextBlock",
           "text": "Hi {employeeName}! You've been assigned a new execution plan.",
           "wrap": true
         },
         // For each step:
         {
           "type": "Container",
           "items": [
             {
               "type": "TextBlock",
               "text": "Step {n}: {title}",
               "weight": "Bolder",
               "wrap": true
             },
             {
               "type": "TextBlock",
               "text": "{instructions}",
               "wrap": true
             },
             {
               "type": "TextBlock",
               "text": "Success criteria: {criteria}",
               "isSubtle": true,
               "wrap": true
             },
             {
               "type": "TextBlock",
               "text": "Estimated: {minutes} min",
               "isSubtle": true
             }
           ]
         },
         {
           "type": "ActionSet",
           "actions": [
             {
               "type": "Action.Submit",
               "title": "Mark Step {n} Complete",
               "style": "positive",
               "data": {
                 "action": "complete_step",
                 "assignmentId": "{assignmentId}",
                 "stepNumber": {n}
               }
             }
           ]
         }
         // ... repeat for all 4 steps
       ]
     }

   - Export function buildCompletedStepCard(assignment, steps, completedSteps): AdaptiveCard
     Same structure but completed steps show a checkmark emoji in the title and no button

   - Export function buildNudgeCard(assignment, currentStep): AdaptiveCard
     Shorter card with current step instructions and "Mark Complete" button

   - Export function buildWeeklyDigestCard(digest: DigestPayload): AdaptiveCard
     Summary card with FactSet showing team metrics

4. src/app/api/teams/messages/route.ts
   - POST handler that receives incoming activities from Azure Bot Service
   - Verify the Authorization header JWT token (validate issuer, audience, signature)
   - Handle activity types:
     a) type: 'message' — user sent a text message to the bot (respond with help text)
     b) type: 'invoke', name: 'adaptiveCard/action' — user clicked an Action.Submit button
        - Extract action data (action, assignmentId, stepNumber)
        - If action === 'complete_step': call completions API with platform='teams'
        - Build updated Adaptive Card with checkmark on completed step
        - Return { statusCode: 200, type: 'application/vnd.microsoft.card.adaptive', value: updatedCard }
        - The returned card REPLACES the original card in-place (Teams does this automatically for invoke responses)
     c) type: 'conversationUpdate' — bot was added to a conversation
        - Store the conversationReference (serviceUrl, conversationId, user.aadObjectId) in teams_installations
        - This reference is needed for proactive messaging later

5. src/app/api/teams/oauth/route.ts
   - GET handler for Teams/Azure OAuth callback
   - Exchange authorization code for tokens
   - Store tenant_id, bot_id, service_url in teams_installations
   - Update organisations.teams_tenant_id
   - Map users by email (similar to Slack OAuth flow)

CRITICAL: All Adaptive Card messages must include FULL step instructions inline. The employee must complete all 4 steps entirely within Teams without ever opening the Recaller web app.
```

**CURSOR PROMPT 2 — Teams Notifier + Proactive messaging:**

```
In my Recaller project, I have the Teams REST client at src/lib/teams/restClient.ts and Adaptive Card builders at src/lib/teams/adaptiveCards.ts. Now create the TeamsNotifier.

Create src/lib/notifications/TeamsNotifier.ts:
- Export class TeamsNotifier
- Constructor takes: restClient (TeamsRestClient)
- Method sendAssignment(teamsUserId: string, notification: AssignmentNotification):
  - Look up the teams_installation for the user's org to get serviceUrl
  - Create a 1-on-1 conversation with the user using restClient.createConversation()
  - Build the Adaptive Card using buildAssignmentCard()
  - Send the card as an activity: { type: 'message', attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: card }] }
  - Store the returned activityId in notifications table as teams_activity_id
- Method sendNudge(teamsUserId: string, nudge: NudgeNotification):
  - Create conversation, send nudge card
- Method sendStepConfirmation(teamsUserId: string, assignmentId: string, stepNumber: number):
  - For Teams, the card updates in-place via the invoke response (handled in the route handler)
  - This method is a no-op for Teams because the update happens synchronously in the button click handler
- Method sendWeeklyDigest(channelId: string, digest: DigestPayload):
  - Send digest card to the designated Teams channel

The proactive messaging pattern:
1. When the bot is installed (conversationUpdate activity), we store the serviceUrl and the conversationReference
2. When we need to DM a user proactively (e.g., new assignment), we use restClient.createConversation() with the stored serviceUrl and the user's teams_user_id (which is their aadObjectId)
3. This allows the bot to initiate a conversation without the user messaging first
```

**TEST CHECKLIST:**

- Start ngrok, update the messaging endpoint URL in Azure Bot -> Configuration
- Go to `/settings`, click "Connect Teams", verify OAuth flow completes
- Open Teams, search for "RecallerBot", send it a message — verify it responds
- Create a test assignment for a user with `teams_user_id`
- Verify the user receives a DM in Teams with the Adaptive Card
- Click "Mark Step 1 Complete" in Teams — verify the card updates in-place
- Complete all 4 steps via Teams, verify database shows completions with platform='teams'

**COMMON ERRORS:**

- **401 Unauthorized from Bot Connector**: The token is expired or the app ID/password don't match. Check TEAMS_APP_ID and TEAMS_APP_PASSWORD in .env.local. Verify they match what's in Azure Portal.
- **"Bot is not part of the conversation"**: The bot must be installed by the user first (they need to find it in Teams and send a message, or an admin needs to deploy the app to the org). Proactive messaging only works after installation.
- **Adaptive Card not rendering**: Teams is strict about card schema. Validate your JSON at [https://adaptivecards.io/designer/](https://adaptivecards.io/designer/). The $schema and version fields are required.
- **JWT validation fails**: For local development, you may need to skip JWT validation temporarily (add a `// TODO: enable in production` comment). In production, validate against the Bot Framework OpenID metadata.

---

### Phase 8: NotificationService + Nudges (6-8 hours)

**Goal:** All notifications route through one unified service. Inactivity nudges fire automatically after 48 hours. Smart suppression prevents spam.

**Modules covered:** H1-H8, D6

**Dependencies:** Phase 6 + 7 (SlackNotifier and TeamsNotifier exist)

**CURSOR PROMPT 1:**

```
In my Recaller project, I have SlackNotifier at src/lib/notifications/SlackNotifier.ts and TeamsNotifier at src/lib/notifications/TeamsNotifier.ts. Now build the unified NotificationService and email fallback.

Create these files:

1. src/lib/notifications/EmailNotifier.ts
   - Uses Resend SDK to send emails
   - Method sendAssignment(email: string, notification: AssignmentNotification):
     - Use the AssignmentEmail React Email template
     - Include all 4 step instructions in the email body (not just a link)
     - Include a "View in Recaller" button linking to the web app
   - Method sendNudge, sendStepConfirmation, sendWeeklyDigest — similar pattern
   - Resend API key from env RESEND_API_KEY

2. src/lib/notifications/NotificationService.ts
   - Implement the full class as defined in the interface section
   - resolvePlatform(orgId, userId):
     - Fetch the org's slack_team_id and teams_tenant_id
     - Fetch the user's slack_user_id and teams_user_id
     - If org has slack_team_id AND user has slack_user_id -> return 'slack'
     - Else if org has teams_tenant_id AND user has teams_user_id -> return 'teams'
     - Else -> return 'email'
   - Before sending any notification, check notification_suppressions:
     - Query for suppression where user_id matches AND notification_type matches AND suppressed_until > now()
     - If suppression exists, skip sending
   - After sending any notification, create a suppression record:
     - For nudge type: suppressed_until = now() + 72 hours (prevents duplicate nudges within 72hr window)
   - Log every sent notification in the notifications table

3. src/emails/AssignmentEmail.tsx
   - React Email template for assignment notifications
   - Beautiful email design with: logo, plan title, all 4 steps with instructions, due date, CTA button
   - Use @react-email/components: Html, Head, Body, Container, Section, Text, Button, Hr

4. src/emails/NudgeEmail.tsx
   - Shorter email: "You haven't started Step {n} of {planTitle} yet"
   - Include the step's full instructions
   - CTA: "Complete This Step" button

5. src/emails/TrialExpiryEmail.tsx
   - Three variants: Day 10 ("Your trial ends in 4 days"), Day 13 ("Last day tomorrow"), Day 14 ("Trial ended")
   - Include usage stats: plans created, steps completed
   - CTA: "Upgrade Now"

6. src/lib/inngest/functions/sendNudges.ts
   - Inngest scheduled function: runs every 6 hours (cron: "0 */6 * * *")
   - Query all assignments where:
     - status = 'active'
     - last step_completion (or assignment created_at if no completions) was more than 48 hours ago
   - For each stalled assignment:
     - Determine current step (first incomplete step)
     - Call notificationService.sendNudge() — which checks suppression automatically
   - Also find assignments where an employee has been stalled more than X days (configurable per org in notification_preferences)
   - For those, send a manager alert to the admin

7. src/lib/inngest/functions/weeklyDigest.ts
   - Inngest scheduled function: runs every Monday at 9am (cron: "TZ=America/New_York 0 9 * * 1")
   - For each org:
     - Calculate: active plans with completion rates, traffic light status, top performers, stalled employees, week-over-week change
     - Call notificationService.sendWeeklyDigest() — this posts to Slack channel OR Teams channel AND sends email to admins
```

**TEST CHECKLIST:**

- Create an assignment, wait (or manually set completed_at to 3 days ago in the database)
- Trigger the nudge function manually from the Inngest dev server dashboard
- Verify the employee receives a nudge on their platform (Slack, Teams, or email)
- Send another nudge — verify suppression prevents it (72hr window)
- Trigger the weekly digest — verify it posts to the Slack/Teams channel
- Verify an email fallback is sent for users without Slack/Teams connection

**COMMON ERRORS:**

- **Resend returns 403**: You need to verify your sending domain in Resend dashboard, or use the default `onboarding@resend.dev` for testing.
- **Nudge cron never fires**: The Inngest dev server must be running. Check `http://localhost:8288` for scheduled function status.
- **72hr suppression blocks all nudges forever**: The suppression has an expiry (suppressed_until). Query the notification_suppressions table to verify the expiry is set correctly.

---

### Phase 9: Billing (6-8 hours)

**Goal:** Admin can start a 14-day free trial, subscribe via Stripe, manage billing, and see seat usage.

**Modules covered:** L1-L6

**Dependencies:** Phase 1 (organisations, subscriptions table)

**CURSOR PROMPT 1:**

```
In my Recaller project, I need to implement Stripe billing with seat-based pricing. First, in the Stripe Dashboard (TEST mode), create:
- Product: "Recaller Starter" with price: $25/seat/month (recurring, per unit)
- Product: "Recaller Growth" with price: $20/seat/month (recurring, per unit, billed annually = $240/seat/year)

Then create these files:

1. src/lib/billing/stripe.ts
   - Initialize Stripe with STRIPE_SECRET_KEY
   - Export async function createCheckoutSession(orgId, priceId, seatCount, userEmail):
     - Create Stripe Checkout Session with:
       - mode: 'subscription'
       - line_items: [{ price: priceId, quantity: seatCount }]
       - subscription_data: { trial_period_days: 14 }
       - customer_email: userEmail
       - success_url: NEXT_PUBLIC_APP_URL + '/settings?billing=success'
       - cancel_url: NEXT_PUBLIC_APP_URL + '/settings?billing=cancelled'
       - metadata: { orgId }
     - Return the session URL
   - Export async function createBillingPortalSession(stripeCustomerId):
     - Create Stripe Billing Portal session
     - Return the session URL
   - Export async function updateSeatCount(stripeSubscriptionId, newSeatCount):
     - Retrieve the subscription
     - Update the subscription item quantity with proration_behavior: 'create_prorations'

2. src/app/api/stripe/webhooks/route.ts
   - POST handler with raw body parsing (disable Next.js body parser for this route)
   - Verify webhook signature using STRIPE_WEBHOOK_SECRET
   - Handle these events:
     a) checkout.session.completed: create/update subscriptions row with stripe_customer_id, stripe_subscription_id, plan_tier, seat_count, status='trialing' or 'active', trial_ends_at
     b) customer.subscription.updated: update status, seat_count, current_period_end
     c) customer.subscription.deleted: update status to 'cancelled'
     d) invoice.payment_failed: update status to 'past_due', trigger email notification to admin

3. src/app/(dashboard)/settings/page.tsx (update existing)
   - Add a Billing section:
     - If no subscription: show pricing cards (Starter $25/seat, Growth $20/seat) with "Start Free Trial" buttons
     - If trialing: show trial days remaining, "Upgrade to Paid" button
     - If active: show current plan, seat usage (X of Y seats used), next billing date, "Manage Billing" button (opens Stripe Billing Portal)
     - If past_due: show warning banner with "Update Payment Method" button
   - Seat count auto-updates when team members are added/removed (call updateSeatCount)

When a new user is invited and accepts, automatically increment the seat count on the Stripe subscription. When a user is removed, decrement it. Proration is handled by Stripe automatically.
```

**TEST CHECKLIST:**

- Go to `/settings`, verify pricing cards appear when no subscription exists
- Click "Start Free Trial" for Starter plan with 5 seats
- Complete the Stripe Checkout flow (use test card: 4242 4242 4242 4242)
- Verify subscriptions table has a row with status='trialing'
- Click "Manage Billing" — verify Stripe Billing Portal opens
- Set up the webhook: run `stripe listen --forward-to localhost:3000/api/stripe/webhooks` (install Stripe CLI first: `brew install stripe/stripe-cli/stripe`)
- Invite a new team member — verify seat count increments

**COMMON ERRORS:**

- **Webhook signature validation fails**: The `STRIPE_WEBHOOK_SECRET` for local testing comes from `stripe listen` output (whsec_...), NOT from the Stripe dashboard. The dashboard webhook secret is for production only.
- **Raw body parsing**: Next.js App Router route handlers parse the body by default. You must read `request.text()` (not `request.json()`) and pass the raw string to `stripe.webhooks.constructEvent()`.
- **Trial not starting**: Ensure `trial_period_days: 14` is set in the Checkout Session's `subscription_data`, not at the price level.

---

### Phase 10: Insight Engine (10-14 hours)

**Goal:** Monthly AI-generated behavioral insight reports with charts, delivered via all channels.

**Modules covered:** G1-G10, F9, I10, J8

**Dependencies:** Phase 5 (dashboard queries), Phase 6+7 (delivery channels), sufficient step_completions data

**[CHANGED] Architecture: Claude 3.7 Sonnet interprets pre-written query results — the AI does NOT write or execute SQL.**

**CURSOR PROMPT 1 — Analytics query functions:**

```
In my Recaller project, I need 6 analytics query functions that the Insight Engine will use. These are pre-written SQL queries executed via Supabase — NOT dynamically generated by AI.

Create src/lib/ai/insightEngine.ts:

1. async function completionVelocity(orgId: string, periodStart: Date, periodEnd: Date)
   - Query: For each assignment completed in the period, calculate:
     - Time from assignment.created_at to first step_completion (time to start)
     - Time from first step_completion to last step_completion (time to finish)
   - Return: { medianTimeToStart: hours, medianTimeToFinish: hours, fastestCompletion: hours, slowestCompletion: hours }

2. async function dropOffAnalysis(orgId: string, periodStart: Date, periodEnd: Date)
   - Query: Count distinct users who completed each step number (1, 2, 3, 4) across all assignments
   - Calculate the percentage drop between consecutive steps
   - Return: { step1Count, step2Count, step3Count, step4Count, biggestDropStep, biggestDropPercentage }
   - Also aggregate notes from step_completions where the drop-off step has difficulty_rating >= 4

3. async function categoryEngagement(orgId: string, periodStart: Date, periodEnd: Date)
   - Query: Group plans by category, calculate average completion rate per category
   - Return: Array of { category, avgCompletionRate, totalAssignments, totalCompletions }

4. async function timeOfDayHeatmap(orgId: string, periodStart: Date, periodEnd: Date)
   - Query: Extract hour from step_completions.completed_at, count completions per hour bucket (0-23)
   - Return: Array of { hour, completionCount } for all 24 hours

5. async function performerRanking(orgId: string, periodStart: Date, periodEnd: Date)
   - Query: For users with >= 3 assignments, calculate their average completion rate
   - Return: { topPerformers: [{name, rate}], bottomPerformers: [{name, rate}], orgAverage }

6. async function contentEffectiveness(orgId: string, periodStart: Date, periodEnd: Date)
   - Query: For each plan, calculate completion rate. Rank best to worst.
   - Return: Array of { planTitle, contentType, completionRate, totalAssigned } sorted by rate

Export all 6 functions. Each function uses the Supabase service role client for server-side queries.

Then create the report generation function:

7. async function generateMonthlyReport(orgId: string, periodStart: Date, periodEnd: Date): Promise<{aiContent: string, pdfUrl: string}>
   - Call all 6 analytics functions
   - Construct a prompt for Claude 3.7 Sonnet (via Anthropic SDK — use NARRATIVE_MODEL from modelRouter.ts). Claude writes noticeably better long-form prose than GPT-4.1, producing more natural and insightful analysis:
     "You are a corporate learning analytics expert. Given the following behavioral data from a training execution platform, write a concise monthly insight report (800-1200 words). Include: executive summary (3 sentences), key findings (5 bullets), areas of concern, recommendations, and a positive highlight. Write in a professional but accessible tone. The audience is a Director of L&D.

     Data:
     - Completion velocity: {JSON}
     - Drop-off analysis: {JSON}
     - Category engagement: {JSON}
     - Time-of-day patterns: {JSON}
     - Performer rankings: {JSON}
     - Content effectiveness: {JSON}"
   - Call Claude 3.7 Sonnet (NARRATIVE_MODEL from modelRouter.ts) with this prompt
   - Generate a PDF using @react-pdf/renderer with renderToBuffer()
   - Upload the PDF to Supabase Storage bucket 'reports'
   - Save in insight_reports table
   - Return the AI content and PDF URL
```

**CURSOR PROMPT 2 — Monthly cron + PDF + delivery:**

```
In my Recaller project, I have the insight engine at src/lib/ai/insightEngine.ts. Now create the monthly cron job and PDF generation.

Create these files:

1. src/lib/inngest/functions/monthlyReport.ts
   - Inngest scheduled function: runs on the 1st of every month at 6am (cron: "TZ=America/New_York 0 6 1 * *")
   - For each org with an active subscription:
     - Calculate period: first day of last month to last day of last month
     - Check if enough data exists (minimum 10 completed assignments in the period)
     - If yes: call generateMonthlyReport()
     - Deliver via notificationService.sendMonthlyReport():
       - Posts a summary to the org's Slack/Teams channel
       - Sends email to all admins with PDF attached
     - If no: skip and log "Insufficient data for org {orgId}"

2. src/components/reports/MonthlyReportPdf.tsx
   - React component using @react-pdf/renderer primitives (Document, Page, View, Text, StyleSheet)
   - Sections: Header with org logo, executive summary, key metrics in a grid, detailed findings, recommendations
   - Professional layout with consistent typography
   - Export as a function that takes report data and returns a PDF buffer via renderToBuffer()

3. src/app/(dashboard)/insights/page.tsx
   - Insights dashboard for admins:
     - List of all generated reports with: period, generated date, "View" and "Download PDF" buttons
     - Live analytics section showing the 6 metrics from the insight engine for the current period
     - Completion velocity chart (recharts LineChart)
     - Drop-off funnel (recharts BarChart)
     - Time-of-day heatmap (recharts custom)
     - Category engagement comparison (recharts RadarChart or BarChart)

Make sure the next.config.ts includes:
  serverExternalPackages: ['@react-pdf/renderer']
to allow @react-pdf/renderer to run server-side.
```

**TEST CHECKLIST:**

- Seed the database with 60+ days of test completion data across multiple assignments and users
- Manually trigger the monthly report function from Inngest dashboard
- Verify a report appears in the insight_reports table
- Verify a PDF is uploaded to Supabase Storage
- Go to `/insights`, verify the report appears with a download link
- Verify the Slack/Teams channel receives a summary
- Download the PDF, verify it looks professional and contains all sections

**COMMON ERRORS:**

- **"Not enough data" skip message**: The engine requires 10+ completed assignments in the period. Seed enough test data.
- **@react-pdf/renderer fails server-side**: Add it to `serverExternalPackages` in next.config.ts. Without this, Next.js tries to bundle it for the edge runtime where it doesn't work.
- **Claude returns a generic report**: The prompt must include the actual data as JSON. If the data is empty or all zeros, the report will be meaningless. Verify your analytics queries return real data before calling the AI.

---

### Phase 11: Calendar Integration + Bulk Invites (4-6 hours)

**Goal:** Employees can add steps as calendar events. Admins can bulk-invite via CSV upload.

**Modules covered:** K1-K3, A5-A7, A10

**Dependencies:** Phase 4 (plans exist), Phase 1 (users exist)

**CURSOR PROMPT 1:**

```
In my Recaller project, add calendar integration and team management features.

Create these files:

1. src/components/employee/AddToCalendar.tsx
   - A button component that generates a calendar event for a plan step
   - Props: stepTitle, stepInstructions, estimatedMinutes, sourceVideoUrl
   - On click, generate an .ics file with:
     - Summary: "Recaller: {stepTitle}"
     - Description: full step instructions + video link if available
     - Duration: estimatedMinutes
     - Start time: let user pick via a small datetime picker
   - Download the .ics file (works with Google Calendar, Outlook, Apple Calendar)
   - Also provide a "Add to Google Calendar" link using the Google Calendar URL scheme:
     https://calendar.google.com/calendar/render?action=TEMPLATE&text={title}&details={instructions}&dates={start}/{end}

2. src/app/(dashboard)/settings/team/page.tsx
   - Team management page for admins:
     - Current team members table: name, email, role, platform connection (Slack/Teams/none), invite status
     - "Invite by Email" form: email input + role selector
     - "Invite by Slack Handle" form (only if org has Slack connected): uses Slack MCP to look up user by handle, sends invite
     - "Bulk Invite via CSV" section:
       - Upload a CSV with columns: email, full_name, role (optional, defaults to 'employee')
       - Parse the CSV, show preview of users to be invited
       - On confirm: create invitation rows for each, send invite emails via Resend
     - Existing invitations table with status (pending/accepted/expired)

3. src/app/(employee)/profile/page.tsx
   - User profile page:
     - Edit: full name, title, avatar
     - Notification preferences: toggle email, Slack, Teams notifications
     - Connected platforms: show Slack user status, Teams user status
     - Personal stats: plans completed, average completion rate, current streak
```

**TEST CHECKLIST:**

- On a plan step, click "Add to Calendar" — verify .ics file downloads and imports into your calendar
- Go to `/settings/team`, invite a user by email — verify invitation row created, email sent
- Upload a CSV with 3 test users — verify all 3 invitations are created
- Accept an invitation (click email link) — verify user account is created with correct role

---

### Phase 12: Deployment + Polish (6-8 hours)

**Goal:** App is live on Vercel with production Supabase, Sentry, all webhooks pointing to production URLs.

**Modules covered:** None new — deployment and hardening

**Dependencies:** All prior phases

**CURSOR PROMPT 1 — Sentry + Deployment prep:**

```
In my Recaller project, set up Sentry error tracking and prepare for Vercel deployment.

1. Run: npx @sentry/wizard@latest -i nextjs
   - This creates instrumentation files and wraps next.config.ts

2. Create vercel.json in the project root:
   {
     "functions": {
       "src/app/api/inngest/route.ts": { "maxDuration": 300 },
       "src/app/api/slack/events/route.ts": { "maxDuration": 30 },
       "src/app/api/teams/messages/route.ts": { "maxDuration": 30 },
       "src/app/api/stripe/webhooks/route.ts": { "maxDuration": 30 }
     }
   }
   The Inngest route needs 300s (5 min) because it orchestrates long-running background jobs.

3. Update next.config.ts to include:
   - Sentry config (added by wizard)
   - serverExternalPackages: ['@react-pdf/renderer']
   - images.remotePatterns for Supabase Storage URLs
```

**Deployment steps (manual, not Cursor prompts):**

1. **Push to GitHub:** `git add . && git commit -m "Initial release" && git push origin main`
2. **Create production Supabase project:** New project in Supabase dashboard. Run all 6 migrations against it: `npx supabase db push --db-url YOUR_PRODUCTION_DB_URL`. Copy the new project's URL, anon key, and service_role key.
3. **Import to Vercel:** Go to vercel.com, import the GitHub repo. Add ALL environment variables from `.env.local` but with PRODUCTION values. Set `NEXT_PUBLIC_APP_URL` to your production domain.
4. **Update Slack app URLs:** In api.slack.com, update all URLs (Interactivity, Slash Commands, Event Subscriptions, OAuth redirect) from ngrok to your Vercel production URL.
5. **Update Azure Bot URL:** In Azure Portal -> Bot -> Configuration, set the messaging endpoint to `https://your-domain.com/api/teams/messages`.
6. **Create Stripe production webhook:** In Stripe Dashboard -> Webhooks -> Add endpoint. URL: `https://your-domain.com/api/stripe/webhooks`. Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed. Copy the webhook signing secret to Vercel env vars.
7. **Verify Supabase Auth URLs:** In production Supabase -> Authentication -> URL Configuration: set Site URL to your domain, add callback URL.
8. **Custom domain:** In Vercel -> Settings -> Domains. Add your domain, configure DNS.

**Post-launch checklist:**

- Sign up on production — verify full flow works
- Create content, generate a plan, assign it — verify Slack/Teams delivery
- Complete steps via Slack and Teams — verify in-place card updates work
- Start a Stripe trial — verify subscription created
- Check Sentry — verify errors are being captured

**First 30 days priorities:**

1. Onboard 2-3 pilot clients with white-glove setup (create their org, configure Slack/Teams, upload first content together)
2. Monitor Sentry daily for errors
3. Collect feedback on Slack/Teams message formatting and adjust Block Kit/Adaptive Card layouts

**Three weekly metrics to track:**

1. Step completion rate across all orgs (target: >60% complete at least Step 1)
2. Slack/Teams vs web completion ratio (target: >70% via Slack/Teams — that proves the platform value)
3. Time-to-first-step after assignment (target: <24 hours)

**Total estimated hours for all 13 phases: 110-148 hours (approximately 8-11 weeks at 2-3 hours/day)**

Phase 3's expansion from 6-8 hours to 10-14 hours accounts for: the onboarding wizard UI (2 hrs), the 3-stage pipeline (4 hrs), the embedding service + pgvector setup (2 hrs), and the plan editor with quality scores (2 hrs). This is the most important investment in the entire product — it's what makes Recaller's AI genuinely intelligent rather than a generic task generator.

---

## PART 5: Slack Bot Architecture (Detailed)

### Slack App Dashboard Configuration

**Event Subscriptions:**

- `app_home_opened` — triggers when user opens the bot's Home tab
- `message.im` — triggers when user sends a DM to the bot

**Interactivity Request URL:** `https://your-domain.com/api/slack/events`

**Slash Commands:**

- `/recaller-status` -> `https://your-domain.com/api/slack/events` -> "View your plan progress"
- `/recaller-team` -> `https://your-domain.com/api/slack/events` -> "View team summary (admin)"

**Bot Token Scopes:** `chat:write`, `commands`, `im:history`, `im:read`, `im:write`, `users:read`, `users:read.email`, `channels:read`

**OAuth Redirect URL:** `https://your-domain.com/api/slack/oauth`

### Complete Block Kit JSON — Assignment Message

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "New Training Plan: Consultative Selling Framework",
        "emoji": true
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "Hi Sarah! You've been assigned a new execution plan based on training content. Complete these 4 steps to put what you learned into practice.\n\n*Due: April 15, 2026*"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Step 1: Identify Your Discovery Questions* (10 min)\n\nReview your last 3 client meeting notes. Write down the top 5 questions you asked during discovery. Compare them to the framework in the training (Watch 8:20-14:40). Identify 2 questions you want to change or add.\n\n_Success criteria: You have a written list of 5 current questions and 2 new questions._"
      }
    },
    {
      "type": "actions",
      "block_id": "step_1_actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Mark Step 1 Complete",
            "emoji": true
          },
          "style": "primary",
          "action_id": "complete_step_1",
          "value": "asgn_abc123:1"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Step 2: Practice the New Framework* (20 min)\n\nUsing the 2 new questions from Step 1, role-play a discovery call with a colleague. Record yourself if possible. Focus on the 'problem agitation' technique from the training (Watch 22:15-28:00).\n\n_Success criteria: You've practiced the new questions in a role-play at least once._"
      }
    },
    {
      "type": "actions",
      "block_id": "step_2_actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Mark Step 2 Complete",
            "emoji": true
          },
          "action_id": "complete_step_2",
          "value": "asgn_abc123:2"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Step 3: Use in a Real Meeting* (30 min)\n\nIn your next client discovery meeting, use at least 1 of your new questions. After the meeting, write a 3-sentence reflection: What question did you use? How did the client respond? Would you use it again?\n\n_Success criteria: You have a written reflection from a real client meeting._"
      }
    },
    {
      "type": "actions",
      "block_id": "step_3_actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Mark Step 3 Complete",
            "emoji": true
          },
          "action_id": "complete_step_3",
          "value": "asgn_abc123:3"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Step 4: Share and Commit* (15 min)\n\nShare your reflection from Step 3 with your manager. Discuss what worked and what you'd adjust. Commit to using the framework in your next 3 discovery meetings.\n\n_Success criteria: You've shared your reflection and made a verbal commitment to continue._"
      }
    },
    {
      "type": "actions",
      "block_id": "step_4_actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Mark Step 4 Complete",
            "emoji": true
          },
          "action_id": "complete_step_4",
          "value": "asgn_abc123:4"
        }
      ]
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "Assigned by your L&D team via Recaller | Reply to this message if you have questions"
        }
      ]
    }
  ]
}
```

### Complete Block Kit JSON — Nudge Message

```json
{
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "Hey Sarah, just a friendly reminder! You haven't started *Step 2: Practice the New Framework* yet for your *Consultative Selling Framework* plan. It's been 3 days since you completed Step 1."
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*What to do:*\nUsing the 2 new questions from Step 1, role-play a discovery call with a colleague. Record yourself if possible. Focus on the 'problem agitation' technique from the training (Watch 22:15-28:00).\n\n_Estimated time: 20 minutes_\n_Success criteria: You've practiced the new questions in a role-play at least once._"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "Mark Step 2 Complete" },
          "style": "primary",
          "action_id": "complete_step_2",
          "value": "asgn_abc123:2"
        }
      ]
    }
  ]
}
```

### Complete Block Kit JSON — Weekly Manager Digest

```json
{
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "Recaller Weekly Digest - Week of Mar 24" }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Overall completion rate: 67%* (up 5% from last week)\n*Active plans: 4* | *Employees engaged: 18*"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Plan Performance:*\n:large_green_circle: Consultative Selling — 82% complete (14/17 employees)\n:large_yellow_circle: Compliance Update Q1 — 61% complete (11/18 employees)\n:large_red_circle: Leadership Fundamentals — 38% complete (6/16 employees)\n:large_green_circle: Product Knowledge v3 — 91% complete (10/11 employees)"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Highlights:*\n:star: Top performer: Alex Kim (100% completion, avg 1.2 days per plan)\n:warning: 3 employees stalled >5 days on Leadership Fundamentals Step 2"
      }
    },
    {
      "type": "context",
      "elements": [
        { "type": "mrkdwn", "text": "View full dashboard: https://app.recaller.io/dashboard" }
      ]
    }
  ]
}
```

### Interactive Payload Handler

When an employee clicks a button in Slack, the `@vercel/slack-bolt` receiver at `/api/slack/events` receives an interaction payload. The handler:

1. Calls `ack()` immediately (within 3 seconds, handled by VercelReceiver's `waitUntil`)
2. Extracts `assignmentId` and `stepNumber` from the button's `value` field (format: `asgn_abc123:2`)
3. Looks up the user's `slack_user_id` from the payload's `user.id`
4. Calls the completions API: POST `/api/completions` with `{ assignmentId, stepNumber, platform: 'slack' }`
5. Builds an updated Block Kit message where the completed step's button is replaced with a checkmark text
6. Calls `chat.update` with the original message's `ts` (stored in `notifications.slack_message_ts`) to replace the message in-place
7. If all 4 steps are now complete, adds a final celebratory section block

### Identity Mapping

During Slack OAuth (`/api/slack/oauth`):

1. After obtaining the bot token, call `users.list` to get all workspace members
2. For each Slack user, match their `profile.email` to a Recaller user's `email`
3. Set `users.slack_user_id` = Slack user's `id` for each match
4. Future Slack interactions use this mapping to identify the Recaller user

---

## PART 6: Microsoft Teams Bot Architecture (Detailed)

### Teams App Manifest (manifest.json)

```json
{
  "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "YOUR_TEAMS_APP_ID",
  "developer": {
    "name": "Recaller",
    "websiteUrl": "https://recaller.io",
    "privacyUrl": "https://recaller.io/privacy",
    "termsOfUseUrl": "https://recaller.io/terms"
  },
  "name": {
    "short": "Recaller",
    "full": "Recaller Training Execution"
  },
  "description": {
    "short": "Complete training plans step-by-step",
    "full": "Recaller transforms training content into actionable execution plans delivered right to your Teams chat. Complete steps, track progress, and prove training ROI."
  },
  "icons": {
    "color": "color.png",
    "outline": "outline.png"
  },
  "accentColor": "#4F46E5",
  "bots": [
    {
      "botId": "YOUR_TEAMS_APP_ID",
      "scopes": ["personal", "team"],
      "supportsFiles": false,
      "isNotificationOnly": false,
      "commandLists": [
        {
          "scopes": ["personal"],
          "commands": [
            {
              "title": "status",
              "description": "View your active plans and progress"
            },
            {
              "title": "help",
              "description": "Learn how to use Recaller"
            }
          ]
        }
      ]
    }
  ],
  "permissions": ["identity", "messageTeamMembers"],
  "validDomains": ["recaller.io", "*.recaller.io"]
}
```

Package this as a ZIP with `manifest.json`, `color.png` (192x192), and `outline.png` (32x32).

### Azure Bot Registration Steps (Simplified)

1. Go to portal.azure.com -> Create a resource -> "Azure Bot"
2. Fill in: Handle ("RecallerBot"), Subscription, Resource Group ("recaller-rg"), Pricing (F0 free), App Type (Single Tenant), Creation Type (Create new)
3. After creation: Configuration tab -> copy Microsoft App ID -> set Messaging endpoint to your URL
4. Certificates & secrets -> New client secret -> copy value (this is TEAMS_APP_PASSWORD)
5. Channels -> Microsoft Teams -> Save
6. In Teams Admin Center (admin.teams.microsoft.com) -> Manage Apps -> Upload custom app -> upload your ZIP

### Complete Adaptive Card JSON — Assignment Card

```json
{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.5",
  "body": [
    {
      "type": "TextBlock",
      "text": "New Training Plan: Consultative Selling Framework",
      "size": "Large",
      "weight": "Bolder",
      "wrap": true
    },
    {
      "type": "TextBlock",
      "text": "Hi Sarah! You've been assigned a new execution plan. Complete these 4 steps to put your training into practice.",
      "wrap": true
    },
    {
      "type": "TextBlock",
      "text": "Due: April 15, 2026",
      "isSubtle": true
    },
    {
      "type": "Container",
      "style": "emphasis",
      "items": [
        {
          "type": "TextBlock",
          "text": "Step 1: Identify Your Discovery Questions (10 min)",
          "weight": "Bolder",
          "wrap": true
        },
        {
          "type": "TextBlock",
          "text": "Review your last 3 client meeting notes. Write down the top 5 questions you asked during discovery. Compare them to the framework in the training (Watch 8:20-14:40). Identify 2 questions you want to change or add.",
          "wrap": true
        },
        {
          "type": "TextBlock",
          "text": "Success criteria: You have a written list of 5 current questions and 2 new questions.",
          "isSubtle": true,
          "wrap": true
        }
      ]
    },
    {
      "type": "ActionSet",
      "actions": [
        {
          "type": "Action.Submit",
          "title": "Mark Step 1 Complete",
          "style": "positive",
          "data": {
            "action": "complete_step",
            "assignmentId": "asgn_abc123",
            "stepNumber": 1
          }
        }
      ]
    },
    {
      "type": "Container",
      "items": [
        {
          "type": "TextBlock",
          "text": "Step 2: Practice the New Framework (20 min)",
          "weight": "Bolder",
          "wrap": true
        },
        {
          "type": "TextBlock",
          "text": "Using the 2 new questions from Step 1, role-play a discovery call with a colleague. Record yourself if possible. Focus on the 'problem agitation' technique from the training (Watch 22:15-28:00).",
          "wrap": true
        },
        {
          "type": "TextBlock",
          "text": "Success criteria: You've practiced the new questions in a role-play at least once.",
          "isSubtle": true,
          "wrap": true
        }
      ]
    },
    {
      "type": "ActionSet",
      "actions": [
        {
          "type": "Action.Submit",
          "title": "Mark Step 2 Complete",
          "data": {
            "action": "complete_step",
            "assignmentId": "asgn_abc123",
            "stepNumber": 2
          }
        }
      ]
    },
    {
      "type": "Container",
      "items": [
        {
          "type": "TextBlock",
          "text": "Step 3: Use in a Real Meeting (30 min)",
          "weight": "Bolder",
          "wrap": true
        },
        {
          "type": "TextBlock",
          "text": "In your next client discovery meeting, use at least 1 of your new questions. After the meeting, write a 3-sentence reflection: What question did you use? How did the client respond? Would you use it again?",
          "wrap": true
        },
        {
          "type": "TextBlock",
          "text": "Success criteria: You have a written reflection from a real client meeting.",
          "isSubtle": true,
          "wrap": true
        }
      ]
    },
    {
      "type": "ActionSet",
      "actions": [
        {
          "type": "Action.Submit",
          "title": "Mark Step 3 Complete",
          "data": {
            "action": "complete_step",
            "assignmentId": "asgn_abc123",
            "stepNumber": 3
          }
        }
      ]
    },
    {
      "type": "Container",
      "items": [
        {
          "type": "TextBlock",
          "text": "Step 4: Share and Commit (15 min)",
          "weight": "Bolder",
          "wrap": true
        },
        {
          "type": "TextBlock",
          "text": "Share your reflection from Step 3 with your manager. Discuss what worked and what you'd adjust. Commit to using the framework in your next 3 discovery meetings.",
          "wrap": true
        },
        {
          "type": "TextBlock",
          "text": "Success criteria: You've shared your reflection and made a verbal commitment to continue.",
          "isSubtle": true,
          "wrap": true
        }
      ]
    },
    {
      "type": "ActionSet",
      "actions": [
        {
          "type": "Action.Submit",
          "title": "Mark Step 4 Complete",
          "data": {
            "action": "complete_step",
            "assignmentId": "asgn_abc123",
            "stepNumber": 4
          }
        }
      ]
    }
  ]
}
```

### Adaptive Card JSON — Nudge Card

```json
{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.5",
  "body": [
    {
      "type": "TextBlock",
      "text": "Friendly Reminder",
      "size": "Medium",
      "weight": "Bolder"
    },
    {
      "type": "TextBlock",
      "text": "Hey Sarah! You haven't started Step 2 of your Consultative Selling Framework plan yet. It's been 3 days since you completed Step 1.",
      "wrap": true
    },
    {
      "type": "Container",
      "style": "emphasis",
      "items": [
        {
          "type": "TextBlock",
          "text": "Step 2: Practice the New Framework (20 min)",
          "weight": "Bolder",
          "wrap": true
        },
        {
          "type": "TextBlock",
          "text": "Using the 2 new questions from Step 1, role-play a discovery call with a colleague. Record yourself if possible. Focus on the 'problem agitation' technique from the training.",
          "wrap": true
        },
        {
          "type": "TextBlock",
          "text": "Success criteria: You've practiced the new questions in a role-play at least once.",
          "isSubtle": true,
          "wrap": true
        }
      ]
    },
    {
      "type": "ActionSet",
      "actions": [
        {
          "type": "Action.Submit",
          "title": "Mark Step 2 Complete",
          "style": "positive",
          "data": {
            "action": "complete_step",
            "assignmentId": "asgn_abc123",
            "stepNumber": 2
          }
        }
      ]
    }
  ]
}
```

### Adaptive Card JSON — Weekly Manager Digest

```json
{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.5",
  "body": [
    {
      "type": "TextBlock",
      "text": "Recaller Weekly Digest - Week of Mar 24",
      "size": "Large",
      "weight": "Bolder"
    },
    {
      "type": "FactSet",
      "facts": [
        { "title": "Overall Completion", "value": "67% (up 5%)" },
        { "title": "Active Plans", "value": "4" },
        { "title": "Employees Engaged", "value": "18" }
      ]
    },
    {
      "type": "TextBlock",
      "text": "Plan Performance",
      "weight": "Bolder",
      "spacing": "Medium"
    },
    {
      "type": "FactSet",
      "facts": [
        { "title": "Consultative Selling", "value": "82% complete (14/17)" },
        { "title": "Compliance Update Q1", "value": "61% complete (11/18)" },
        { "title": "Leadership Fundamentals", "value": "38% complete (6/16)" },
        { "title": "Product Knowledge v3", "value": "91% complete (10/11)" }
      ]
    },
    {
      "type": "TextBlock",
      "text": "Highlights",
      "weight": "Bolder",
      "spacing": "Medium"
    },
    {
      "type": "TextBlock",
      "text": "Top performer: Alex Kim (100% completion)\n3 employees stalled >5 days on Leadership Fundamentals Step 2",
      "wrap": true
    }
  ],
  "actions": [
    {
      "type": "Action.OpenUrl",
      "title": "View Full Dashboard",
      "url": "https://app.recaller.io/dashboard"
    }
  ]
}
```

### Activity Handler (Webhook approach)

The `/api/teams/messages` POST route handler:

1. Receives an activity JSON from Azure Bot Service
2. Validates the JWT in the Authorization header (in production; skip locally for development)
3. Checks `activity.type`:
  - `'invoke'` with `activity.name === 'adaptiveCard/action'`: User clicked a button
    - Extract `activity.value.action.data` -> `{ action, assignmentId, stepNumber }`
    - Call completions API with platform='teams'
    - Build updated Adaptive Card with checkmark on completed step
    - Return `{ statusCode: 200, type: 'application/vnd.microsoft.card.adaptive', value: updatedCard }` (Teams replaces the card in-place)
  - `'conversationUpdate'`: Bot was installed
    - Store `serviceUrl`, `conversation.id`, `from.aadObjectId` in teams_installations
  - `'message'`: User typed a text message
    - Respond with help text via restClient.sendMessage()

### Proactive Messaging Flow

1. During bot installation (`conversationUpdate`), store the `serviceUrl` from the activity
2. When a new assignment is created for a Teams user:
  - Look up the user's `teams_user_id` (which is their Azure AD Object ID)
  - Look up the org's `teams_installations.service_url`
  - Call `restClient.createConversation(serviceUrl, tenantId, teamsUserId)` to create a 1:1 chat
  - Send the Adaptive Card via `restClient.sendMessage()` to the new conversation
3. Store the returned `activityId` as `notifications.teams_activity_id` for future updates

### Identity Mapping

During Teams OAuth / bot installation:

1. When the bot is installed in a tenant, use the Microsoft Graph API to list users: `GET https://graph.microsoft.com/v1.0/users`
2. Match each Azure AD user's `mail` to a Recaller user's `email`
3. Set `users.teams_user_id` = Azure AD user's `id` (object ID) for each match

---

## PART 7: Insight Engine Architecture (Detailed)

### Behavioral Data Structure

All analytics are powered by the `step_completions` table which records:

- `completed_at` (TIMESTAMPTZ) — enables velocity and time-of-day analysis
- `platform_completed_on` (TEXT: 'web', 'slack', 'teams') — enables platform engagement analysis
- `difficulty_rating` (INT 1-5) — enables step difficulty analysis
- `note` (TEXT) — enables qualitative drop-off analysis
- `step_number` (INT 1-4) — enables funnel/drop-off analysis

Combined with `assignments.created_at` and `plans.category`, this supports all 6 analytics dimensions without additional tables.

### 6 Analytics Query Functions (with SQL)

**[CHANGED] All queries are pre-written and parameterized. The AI does NOT write SQL.**

```sql
-- 1. Completion Velocity
SELECT
  percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_completion - a.created_at)) / 3600) AS median_hours_to_start,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (last_completion - first_completion)) / 3600) AS median_hours_to_finish
FROM assignments a
JOIN (
  SELECT assignment_id,
    MIN(completed_at) AS first_completion,
    MAX(completed_at) AS last_completion
  FROM step_completions GROUP BY assignment_id
) sc ON sc.assignment_id = a.id
WHERE a.org_id = $1 AND a.created_at BETWEEN $2 AND $3;

-- 2. Drop-Off Analysis
SELECT step_number, COUNT(DISTINCT sc.assignment_id) AS completions
FROM step_completions sc
JOIN assignments a ON a.id = sc.assignment_id
WHERE a.org_id = $1 AND sc.completed_at BETWEEN $2 AND $3
GROUP BY step_number ORDER BY step_number;

-- 3. Category Engagement
SELECT p.category,
  COUNT(DISTINCT a.id) AS total_assignments,
  COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END)::float / NULLIF(COUNT(DISTINCT a.id), 0) AS completion_rate
FROM assignments a
JOIN plans p ON p.id = a.plan_id
WHERE a.org_id = $1 AND a.created_at BETWEEN $2 AND $3
GROUP BY p.category;

-- 4. Time-of-Day Heatmap
SELECT EXTRACT(HOUR FROM sc.completed_at) AS hour, COUNT(*) AS count
FROM step_completions sc
JOIN assignments a ON a.id = sc.assignment_id
WHERE a.org_id = $1 AND sc.completed_at BETWEEN $2 AND $3
GROUP BY hour ORDER BY hour;

-- 5. Performer Ranking
SELECT u.full_name,
  COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END)::float / NULLIF(COUNT(DISTINCT a.id), 0) AS rate
FROM assignments a
JOIN users u ON u.id = a.assigned_to
WHERE a.org_id = $1 AND a.created_at BETWEEN $2 AND $3
GROUP BY u.id, u.full_name
HAVING COUNT(DISTINCT a.id) >= 3
ORDER BY rate DESC;

-- 6. Content Effectiveness
SELECT p.title,
  ci.source_type,
  COUNT(DISTINCT a.id) AS total_assigned,
  COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END)::float / NULLIF(COUNT(DISTINCT a.id), 0) AS rate
FROM assignments a
JOIN plans p ON p.id = a.plan_id
JOIN content_items ci ON ci.id = p.content_item_id
WHERE a.org_id = $1 AND a.created_at BETWEEN $2 AND $3
GROUP BY p.id, p.title, ci.source_type
ORDER BY rate DESC;
```

### AI Report Generation Flow

1. **Inngest cron** fires on the 1st of each month
2. For each org with active subscription: run all 6 queries for the previous month
3. **Construct prompt with the query results** as JSON data
4. **Claude 3.7 Sonnet writes the narrative** — it interprets the numbers, identifies patterns, and writes recommendations. Claude is used instead of GPT-4.1 here because its writing quality is noticeably better for long-form prose (the report is 800-1200 words). It does NOT write or execute additional SQL.
5. **Generate PDF** using `@react-pdf/renderer`'s `renderToBuffer()` with professional styling
6. **Upload PDF** to Supabase Storage bucket 'reports'
7. **Save to database** in `insight_reports` table
8. **Deliver** via NotificationService: summary to Slack/Teams channel + full email with PDF to admins

### Supabase MCP Server Usage (Development Only)

During development, the builder uses the Supabase MCP server to debug analytics queries:

- "Using the Supabase MCP server, run the completion velocity query for org X and show me the results"
- "Query step_completions joined with assignments — show me if there are any null completed_at values"
- This helps catch query bugs without the builder needing to write SQL manually

At runtime, the insight engine uses the Supabase service role client to execute the 6 pre-written queries. No MCP involvement.

### Inngest Cron Schedule

```typescript
inngest.createFunction(
  { id: 'monthly-insight-report' },
  { cron: 'TZ=America/New_York 0 6 1 * *' }, // 1st of month, 6am ET
  async ({ step }) => {
    const orgs = await step.run('fetch-active-orgs', async () => {
      // Query orgs with active subscriptions
    });
    for (const org of orgs) {
      await step.run(`generate-report-${org.id}`, async () => {
        // Run 6 queries, generate report, deliver
      });
    }
  }
);
```

### PDF Generation

```typescript
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

// In next.config.ts:
// serverExternalPackages: ['@react-pdf/renderer']

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  title: { fontSize: 24, marginBottom: 20 },
  section: { marginBottom: 15 },
  heading: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  body: { fontSize: 11, lineHeight: 1.5 },
  metric: { fontSize: 14, fontWeight: 'bold', color: '#4F46E5' },
});

// Component renders the full report, then:
const buffer = await renderToBuffer(<MonthlyReport data={reportData} />);
// Upload buffer to Supabase Storage
```

---

## PART 8: Deployment and Post-Launch

### Vercel Deployment Checklist

1. Push code to GitHub main branch
2. Import repo in Vercel dashboard
3. Framework: Next.js (auto-detected)
4. Add ALL environment variables with production values
5. Deploy and verify the build succeeds
6. Set custom domain in Vercel -> Settings -> Domains

### Supabase Production Setup

1. Create a new Supabase project (separate from development)
2. Apply all 6 migrations: `npx supabase db push --db-url postgresql://...`
3. Verify RLS is enabled on all tables
4. Set redirect URLs: Authentication -> URL Configuration -> add production callback URL
5. Create a Storage bucket: 'content-files' (private), 'reports' (private)

### Sentry Setup

1. `npx @sentry/wizard@latest -i nextjs` (already done in Phase 12)
2. Set SENTRY_DSN and SENTRY_AUTH_TOKEN in Vercel environment variables
3. Source maps upload automatically during Vercel build

### First 30 Days Post-Launch

**Week 1:** Onboard first client. Create their org manually if needed. Walk them through Slack/Teams connection. Upload their first piece of content together. Watch for errors in Sentry.

**Week 2:** Onboard client 2-3. Start collecting feedback on message formatting. Monitor step completion rates.

**Week 3:** First nudge cycle fires (48hr nudges). Verify they work. Adjust timing based on client feedback.

**Week 4:** Review first weekly digests. Gather manager feedback. Fix any formatting issues.

### Three Weekly Metrics

1. **Step 1 completion rate** — % of assignments where employee completes at least Step 1. Target: >60%. This measures initial engagement.
2. **Platform completion ratio** — % of completions via Slack/Teams vs web. Target: >70% via messaging. This proves your core value proposition.
3. **Time-to-first-step** — median hours from assignment delivery to Step 1 completion. Target: <24 hours. This measures urgency and notification effectiveness.

---

## What to Do When You Are Completely Stuck

### 1. Describe the Problem to Cursor Clearly

Start a NEW chat (do not continue a long thread). Use this template:

"In my Recaller project, I am working on [Phase X — module name]. The current state is: [what works — e.g., 'auth and content upload work, I can see transcripts in the database']. The problem is: [exact error message or unexpected behavior]. The file involved is: [exact path, e.g., src/lib/slack/app.ts]. Here is the full error: [paste error]."

The more specific you are, the better Claude's answer will be.

### 2. Use @codebase

Type `@codebase` at the start of your Cursor prompt to give Claude access to your entire project. This is especially useful when the error involves multiple files interacting.

Example: "@codebase I'm getting 'Cannot read properties of undefined (reading org_id)' when I try to create an assignment. The error happens in src/app/(dashboard)/assignments/page.tsx. Show me where org_id should be coming from and trace the data flow."

### 3. When to Start a Fresh Chat

If a Cursor conversation has gone back and forth **6+ times** without resolving the issue, start fresh. Long conversations accumulate stale context that causes Claude to repeat failed approaches. Copy:

- The exact error message
- The 20 most relevant lines of code
- What you've already tried

Paste these into a new chat.

### 4. Use the Supabase MCP Server to Debug Data Problems

Instead of trying to write SQL, ask Cursor:

"Using the Supabase MCP server, query the assignments table and show me all rows where org_id = 'my-org-id'. Also show me the users table for the same org. I need to figure out why assignment notifications aren't being sent — I think the slack_user_id might be null."

The MCP server lets Claude inspect your live database and find mismatches (null foreign keys, missing rows, wrong values) without you writing any SQL.

### 5. Check Inngest Dashboard for Background Job Failures

Open `http://localhost:8288` in your browser. This is the Inngest Dev Server dashboard. It shows:

- All registered functions
- Recent runs with pass/fail status
- Full error traces for failed runs

Copy the error from a failed run and paste it into a Cursor prompt: "My Inngest function transcribeContent failed with this error: [paste]. The function is at src/lib/inngest/functions/transcribeContent.ts. Fix this."

### 6. When Nothing Works

If you are truly stuck after trying all of the above:

1. Describe the problem in a GitHub Issue on your repo (this creates a written record)
2. Search for the exact error message on Google — someone has likely hit it before
3. Try rolling back your last change: `git stash` removes your recent changes temporarily, `git stash pop` brings them back
4. As a last resort, start the current phase's code from scratch in a new branch: `git checkout -b phase-X-retry`

