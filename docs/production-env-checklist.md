# Production environment checklist

Use this when onboarding a new deployment (e.g. Vercel Production + Supabase production project). Copy values from [`.env.local.example`](../.env.local.example); set secrets only in the host (Vercel / Supabase dashboard), not in git.

## Vercel (Project → Settings → Environment Variables)

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `NEXT_PUBLIC_SUPABASE_PROJECT_REF` | Optional — required for **resumable uploads** if the API URL is a **custom domain** (not `*.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_STORAGE_TUS_URL` | Optional — full TUS endpoint URL; overrides default `{ref}.storage.supabase.co` mapping |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — never expose to browser |
| `NEXT_PUBLIC_APP_URL` | **Canonical public origin** (e.g. `https://recaller-seven.vercel.app` or custom domain) |
| AI, Stripe, Slack, Teams, Resend, Inngest, Sentry | As in `.env.local.example` |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Optional — enable source maps on build when org/project + auth token are set |

Apply to **Production** (and **Preview** if you want preview deploys fully wired).

## Supabase (Auth → URL configuration)

- **Site URL:** same origin as `NEXT_PUBLIC_APP_URL`.
- **Redirect URLs:** include at least:
  - `{NEXT_PUBLIC_APP_URL}/callback`
  - `{NEXT_PUBLIC_APP_URL}/auth/callback` if used
  - Local dev: `http://localhost:3000/callback` (and matching paths)

## Stripe

- **Webhook endpoint:** `https://{your-domain}/api/stripe/webhooks`
- Events: checkout completion, subscription updated/deleted, invoice payment failed (as implemented in [`src/app/api/stripe/webhooks/route.ts`](../src/app/api/stripe/webhooks/route.ts)).
- **`STRIPE_WEBHOOK_SECRET` differs by environment:** (1) **Local:** run `npm run stripe:listen` in a second terminal and set `STRIPE_WEBHOOK_SECRET` to the value from `npm run stripe:webhook-secret` (Stripe CLI tunnel). (2) **Vercel Production:** use the signing secret from **Stripe Dashboard → Developers → Webhooks** for your deployed URL, or create the endpoint with `node scripts/ensure-stripe-dashboard-webhook.mjs` once and copy the printed `whsec_…`.
- **Sync env to Vercel (Stripe only):** after linking the repo (`npx vercel link`), set `STRIPE_VERCEL_WEBHOOK_SECRET` to the **Dashboard** `whsec` and run `node scripts/push-stripe-env-to-vercel.mjs` (or add variables in the Vercel UI).
- **`STRIPE_STARTER_PRICE_ID` / `STRIPE_GROWTH_PRICE_ID`:** Stripe Dashboard → Products → copy the **Price** id (not Product id) for each plan. Starter should be **monthly** recurring per seat; Growth should be **annual** recurring per seat, matching copy in [`src/lib/billing/stripe.ts`](../src/lib/billing/stripe.ts) (`PLANS`). These ids sync `plan_tier` when customers change plans in the Billing Portal.
- **Customer portal:** Stripe Dashboard → Settings → Billing → Customer portal — enable so “Manage billing” in Settings works.
- **Test mode:** Use test keys and test Price ids on Preview/staging; live keys and live Price ids on Production.

## Inngest

- Production **Serve** URL should point to `https://{your-domain}/api/inngest`.
- Set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` in Vercel to match the Inngest dashboard.

## Slack / Teams OAuth

- Redirect URIs must match the deployed host (see comments in `.env.local.example` for Teams paths and Slack OAuth routes).

## Custom domain

- Add the domain in Vercel → Domains; update `NEXT_PUBLIC_APP_URL` and Supabase redirect URLs to the new origin.

## Build hygiene

- Do **not** commit `.env` or `.env.local` (see [`.gitignore`](../.gitignore)).
- Prefer Vercel env over a committed `.env` file (Vercel warns if `.env` is present in the repo).
