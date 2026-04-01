# Phase rescue assessment (Phases 1–7) and forward path

This document records the honest state of the codebase after the rescue pass, what was fixed, and what remains for Phases 8–12.

## 2A — Phase completion status (after fixes)

| Phase | Status | Notes |
|-------|--------|--------|
| **1** — Schema & auth | **Mostly complete** | Supabase RLS, `users` / `organisations` / `invitations`, proxy + post-login provisioning. Apply migration **017** on hosted DB if not already. |
| **2** — Content ingestion | **Complete** | URLs + files, Storage, Inngest Whisper for media. Content library and detail pages now **explicitly filter by `org_id`**. |
| **3** — AI plan generation | **Complete** | NDJSON stream, analyze → generate → validate, embeddings. |
| **4** — Employee web | **Complete** | My Plans, completions API, proof/evidence. |
| **5** — Manager dashboard | **Complete** | Assignments, team, evidence views. |
| **6** — Slack | **Complete** | Bolt app, DMs, completions. **Slack OAuth callback** now verifies the signed-in user matches OAuth `state` and is still an admin of that org. |
| **7** — Teams | **Mostly complete** | Bot messages route, Adaptive Cards, Graph mapping. **Teams admin OAuth** re-checks org + admin role. **Web completions** now refresh the Teams Adaptive Card via `updateActivity` when a prior assignment notification exists. Shared **`mapTeamsUsersToRecaller`** lives in `src/lib/teams/mapTeamsUsersToRecaller.ts` (oauth, resync, connect). |

## 2B — Critical disconnections (addressed in this pass)

- **Slack OAuth callback** did not verify the browser session matched `state.userId` — **fixed** in `src/app/api/slack/oauth/route.ts`.
- **Teams OAuth callback** did not re-check admin + org on callback — **fixed** in `src/app/api/teams/oauth/route.ts`.
- **`mapTeamsUsersToRecaller` imported from a route file** — **moved** to `src/lib/teams/mapTeamsUsersToRecaller.ts`; `resync` and `oauth` import from lib; **`/api/teams/connect`** reuses the same mapper (removed duplicate Graph loop).
- **Web completion did not refresh Teams cards** — **fixed**: `TeamsNotifier.sendStepConfirmation` uses stored `teamsConversationId` + `teams_activity_id` from `notifications`; `refreshTeamsAssignmentCardAfterWebCompletion` called from `POST /api/completions` when `platform === "web"`.
- **Content list/detail did not explicitly scope `org_id`** — **fixed** in dashboard content pages (defense in depth with RLS).

Remaining intentional gaps (not bugs):

- **`notification_suppressions`**: table exists; no app writes yet — **Phase 8**.
- **Nudge / digest methods** on `SlackNotifier` / `TeamsNotifier`: implemented but **no cron/Inngest callers** — **Phase 8**.
- **Stripe, Resend runtime, Sentry wiring, insights UI**: scaffold or deps only — **Phases 9–10 / 12**.

## 2C — Logic and flow problems (mitigated)

- **Cross-channel UI drift**: Completing on web left Teams card stale — mitigated by card **update** after web completion.
- **OAuth hijack window**: Stolen `state` alone could complete Slack install for an org if attacker had no session — mitigated by **session + role + org** check on callback.

## 2D — Top 5 risks (if left unfixed)

1. **Missing DB migration 017** on production → duplicate active assignments possible.
2. **Teams JWT verification** disabled via `TEAMS_SKIP_JWT_VERIFY` in production → forged traffic.
3. **`SUPABASE_SERVICE_ROLE_KEY` leaked** to client → full DB bypass.
4. **Slack signing secret wrong/missing** → forged Slack events.
5. **Drift between Slack / Teams / web completion rules** → inconsistent proof validation (still worth a future **shared server module** refactor).

## 2E — What Phases 8–12 need from 1–7

| Need | Source in codebase |
|------|---------------------|
| Assignments + completions | `assignments`, `step_completions`, `POST /api/completions` |
| Org + user identity | `users`, `organisations`, proxy, post-login |
| Notification audit trail | `notifications` rows (Slack ts, Teams activity + conversation id) |
| Slack send path | `slack_installations` + `SlackNotifier` |
| Teams send path | `teams_installations` + `TeamsNotifier` |
| Suppression table | `notification_suppressions` (wire in Phase 8) |
| Billing anchor | `subscriptions` (trial seed in provisioning) |
| Insights tables | `insight_reports`, `analytics_snapshots` (app usage TBD) |

---

## 4A — Phase 8 readiness

**Ready to start Phase 8** once:

- Migration **017** is applied remotely.
- Env vars for Slack, Teams, Inngest, Resend are set for the target environment.

**Solid dependencies:** completions contract, notification rows with Slack/Teams metadata, notifier classes, Inngest webhook at `/api/inngest`.

## 4B — Recommended build order (Phases 8–12)

1. **Phase 8** — `NotificationService` (single router), Inngest cron nudges, use `notification_suppressions`, Resend fallback.
2. **Phase 9** — Stripe webhooks + seat sync to `subscriptions`.
3. **Phase 10** — Analytics snapshots + AI insight reports (read-only SQL + narrative).
4. **Phase 11** — Calendar (after core notifications and billing are stable).
5. **Phase 12** — Sentry, hardening, CI, runbooks.

## 4C — Manual testing checklist (non-developer friendly)

1. Sign up or log in as **admin** → you reach **Dashboard** (or company context onboarding if required).
2. **Upload** a PDF or paste a YouTube URL → item appears in **Content** with status **ready** (or queued then ready for audio/video).
3. Open the content item → **Generate plan** → plan appears under **Plans**.
4. **Assign** the plan to an employee → they see it under **My Plans**.
5. Complete a step **in the browser** → progress updates; **manager** dashboard/team views show activity.
6. With **Slack** connected, assign a plan to a linked employee → DM arrives; complete a step **in Slack** → DM updates.
7. With **Teams** connected, assign → Adaptive Card arrives; complete **in Teams** → card updates.
8. Complete the **next** step **only in the web app** → the **same** Teams card should refresh (checkmarks/progress).
9. **Invite** a new employee from Team page → they accept email → **setup password** → **employee** home works.
10. **Disconnect** Slack or Teams from integrations → no crash; reconnect still works.
11. Try to open **Content** from another org’s URL (if you have two test orgs) → should **not** show their items (404 / empty).
12. Run **Inngest** dev for a large upload → transcript completes and content becomes **ready**.

## 4D — Rough hours to first real client (indicative)

| Phase | Hours (indicative) |
|-------|-------------------|
| 8 — Notifications + nudges | 24–40 |
| 9 — Stripe | 16–24 |
| 10 — Insights | 24–40 |
| 11 — Calendar | 24–40 |
| 12 — Production hardening | 16–32 |
| **Total** | **~100–180** |

Depends on design decisions, test coverage, and how polished onboarding must be.
