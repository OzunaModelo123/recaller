# Recaller — AI context

**What you’re building:** B2B training execution SaaS — see **`README.md`** and the always-on Cursor rule **`.cursor/rules/recaller-project.mdc`** (product, architecture, **authoritative phase status**, GitHub checklist).

**Phased work:** `recaller-project.mdc` is the source of truth for done / next / active focus. **Mirror** the current phase in the one-liner below whenever that file changes. Glob rules: `database-schema.mdc`, `coding-standards.mdc` (SQL vs TS paths).

**Build spec:** `.cursor/plans/recaller_build_guide_aba69b5a.plan.md` — **local copy** (not in git). Open only the `### Phase N` section you need; never paste or attach the full plan.

**New chat / new phase:** Use **`@.cursor/rules/recaller-project.mdc`** (or rely on always-on rules) plus the build guide section **`### Phase N`** only — no separate handoff files.

**Conventions:** `org_id` + RLS · Server Components by default · no `service_role` in browser · Inngest for jobs.

**Auth & team (invites):** Admins invite from `/dashboard/team` (`inviteUserByEmail` + `public.invitations`). Invite links may return session tokens in the **`/login` URL hash**; the client finishes the session and sends users through **`/post-login`** (provisions `public.users` with `invited_org_id` / org). Invited employees must set a password on **`/employee/setup-password`** (`user_metadata.password_set_at`) before other **`/employee/*`** routes — enforced in **`src/proxy.ts`** (Next.js request proxy) and **`post-login`**. Team page lists org **`users`** plus pending **`invitations`**; resending expires the prior `pending` invite row.

**AI plan pipeline (`POST /api/plans/generate`, NDJSON stream):** **Stage 1** `contentAnalyzer.ts` → **Anthropic Claude** (`ANALYSIS_MODEL`). **Stage 2** `planGenerator.ts` → **OpenAI GPT-4.1** (`GENERATION_MODEL`). **Stage 3** `planValidator.ts` → **OpenAI GPT-4.1 Mini** (`VALIDATION_MODEL`). Embeddings: **OpenAI** `text-embedding-3-small` via `embeddingService.ts`. Requires **`ANTHROPIC_API_KEY`** and **`OPENAI_API_KEY`**.

**Trackable steps & proof (mirror `recaller-project.mdc`):** Plans are **2–10** steps (dynamic **N**). After migration **013+**: proof fields on `plan_steps`, `evidence` JSONB on `step_completions`, shared completions API for web + Slack + Teams. Full detail lives in the local build guide `### Phase 3`–`### Phase 8`, not here.

**Dev server:** After finishing an implementation update, **always restart the dev server** (`npm run dev`) so the user can immediately see changes. Kill any existing dev process first, then start fresh. The user should never have to start the server manually.

**Tests:** `npm run test` (Vitest unit), `npm run build && npm run test:e2e` (Playwright on port **3333** via `next start`), `npm run test:ci` (full local CI). GitHub Actions template: `docs/github-actions-ci.yml` → copy to `.github/workflows/ci.yml`.

**Git / GitHub:** Do **not** push or open PRs to the remote repo until the **current phase** is finished and **`recaller-project.mdc`** marks it done (no mid-phase pushes unless the user explicitly asks). When a phase **is** complete: audit staged files → conventional commit → push → verify. Never commit `.env.local`.

**Supabase / secrets:** Prefer Supabase Dashboard SQL Editor or a linked local CLI for migrations. This environment does not install Supabase MCP automatically; add a Supabase MCP in Cursor settings if you want dashboard-style tools in chat. Never paste live API keys or service-role tokens into chat or commit them.

**CLI:** GitHub CLI may live at `/tmp/gh_2.89.0_macOS_arm64/bin/gh` on this machine; use `gh` if it is on your `PATH`.

**Status (mirror `recaller-project.mdc`):** Phases 0–8 done; **next Phase 9** (Billing — Stripe seat-based billing, checkout, webhooks, settings UI, trial management). Repo: https://github.com/OzunaModelo123/recaller

## Project Instructions

### Things to Remember

Before writing any code:

1. State how you will verify this change works (test, bash command, browser check, etc.)
2. Write the test or verification step first
3. Then implement the code
4. Run verification and iterate until it passes
