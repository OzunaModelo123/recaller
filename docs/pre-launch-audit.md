# Pre-launch audit trail

Single place for QA gaps, dependency audit, security review, performance notes, and manual deployment steps. Update this file when you change production configuration.

## 1. Automated baseline (CI)

**Command:** `npm run test:ci` (ESLint → Vitest → `next build` → Playwright on port 3333).

**Last verified:** `npm run test:ci` passes after pre-launch work (lint, 44 unit tests, production build, 8 e2e tests).

### Known untested surfaces (manual QA recommended)

| Area | Why |
|------|-----|
| Authenticated flows | Playwright does not log in with a real Supabase project |
| Billing / Stripe Checkout | Requires Stripe test keys and webhook tunnel or Dashboard |
| Plan generation (`/api/plans/generate`) | Full path needs auth, content, and AI API keys |
| Inngest crons / background jobs | Needs Inngest dashboard + deployed `/api/inngest` |
| Slack / Teams | OAuth and bot flows need app registrations + real workspaces |
| Email (Resend) | Requires `RESEND_API_KEY` and sending domain |

Vitest covers targeted libraries under `src/lib/**/*.test.ts` only; most API routes rely on RLS + integration testing above.

### Dependency audit

- Ran `npm audit fix` (resolves transitive issues where semver allows).
- Bumped **`@anthropic-ai/sdk`** to `^0.87.0` to clear [GHSA-5474-4w2j-mq4c](https://github.com/advisories/GHSA-5474-4w2j-mq4c) (moderate). Re-run `npm audit` after future `npm install` changes; target **zero** reported vulnerabilities before major releases.

---

## 2. Environment, Vercel, and Supabase

**Authoritative env list:** [production-env-checklist.md](./production-env-checklist.md) and [`.env.local.example`](../.env.local.example).

**Actions you must perform in dashboards (not automatable from this repo):**

1. Install Vercel CLI if missing: `npm i -g vercel` — then `vercel link`, set env vars, `vercel deploy`.
2. **Supabase (production):** Site URL and Redirect URLs must match `NEXT_PUBLIC_APP_URL` (include `/callback`).
3. **Never set `TEAMS_SKIP_JWT_VERIFY` in Production** (dev-only escape hatch).
4. **Regenerate TypeScript types** if production schema drifts from the repo:  
   `npx supabase gen types typescript --project-id <ref> > src/types/database.ts`  
   (or Dashboard → API → Generate TypeScript types).

### Database migrations (apply in order on production)

All files live in [`supabase/migrations/`](../supabase/migrations/). Apply **001 → 021** in numeric order:

`001` … `007` (core, content, assignments, notifications, billing, insights, flexible steps)  
`008` … `012` (storage, RLS fixes, org signup, embeddings RPC)  
`013` … `017` (proof/evidence, Slack hardening, assignments uniqueness)  
`018` … `021` (content storage repairs, bucket limit, org logos / RLS)

If any migration was skipped in an older environment, resolve drift before going live (compare `pg_dump` / Supabase Schema vs migrations).

---

## 3. Security review log

| ID | Area | Severity | Finding | Status |
|----|------|----------|---------|--------|
| SEC-01 | HTTP headers | Low | Added baseline headers in [`next.config.ts`](../next.config.ts): frame options, nosniff, referrer policy, permissions policy; **HSTS** when `VERCEL_ENV === "production"`. **CSP not set** — would need a tuned policy for Next.js + scripts. | Implemented |
| SEC-02 | Webhooks | — | Stripe signature verification; Slack signing secret pre-check; Teams JWT verification; Inngest `serve()` signing. | Verified in code |
| SEC-03 | Service role | — | `createAdminClient()` used from Server Components / server actions / jobs only; not imported from client components. | Verified |
| SEC-04 | Dashboard actions | — | Examples: `requireOrgAdmin()` in [`assignments/actions.ts`](../src/app/dashboard/assignments/actions.ts), `requireAdminOrg()` in [`content/actions.ts`](../src/app/dashboard/content/actions.ts). | Spot-checked |
| SEC-05 | Proxy / session | Info | [`src/proxy.ts`](../src/proxy.ts) uses `getSession()` for speed; sensitive APIs use `getUser()` where appropriate. | Documented |
| SEC-06 | Tenant isolation | — | RLS on tables per project rules; APIs scope by `org_id` + membership. | Architecture assumption |

---

## 4. Performance

- **Production build:** Succeeds; no bundle changes required for pre-launch beyond dependency updates.
- **Security headers:** No negative impact on build; verify `Strict-Transport-Security` only on Vercel Production (`VERCEL_ENV=production`).
- **Recommended after deploy:** Run Lighthouse (or Vercel Speed Insights) on `/login`, `/dashboard`, and a heavy employee page using the **real** production URL.

---

## 5. Deployment and smoke tests (manual)

Cannot be completed without your Vercel/Stripe/Supabase credentials. Use this checklist per release:

1. Deploy a **Preview** build first; confirm build logs and env scope.
2. **Auth:** Sign up / log in / log out; invite flow; invited user hits `/employee/setup-password` if required.
3. **Roles:** Employee cannot use dashboard UI; admin cannot stay on employee shell (layouts enforce).
4. **Stripe (test mode on Preview):** Webhook to `/api/stripe/webhooks` — send test event or complete test checkout; confirm `subscriptions` / org billing state in Supabase.
5. **Inngest:** Dashboard shows sync to `https://<host>/api/inngest`.
6. **Slack / Teams:** Only if enabled — complete OAuth and one bot message round-trip each.

---

## 6. Monitoring and operations

1. **Sentry:** Set `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` in Vercel; optional `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` for source maps ([checklist](./production-env-checklist.md)).
2. **Vercel:** Monitor Functions logs and error rate after deploy.
3. **Supabase:** Enable backups / PITR on a paid plan if available; restrict dashboard access to trusted operators.

---

## 7. What changed in the codebase during this audit

- [`next.config.ts`](../next.config.ts): global security headers + HSTS on Vercel Production.
- [`package.json`](../package.json) / lockfile: `npm audit fix` + `@anthropic-ai/sdk` bump to `^0.87.0` (npm audit clean).
- This document: `docs/pre-launch-audit.md`.
