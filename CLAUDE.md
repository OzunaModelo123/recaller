# Recaller — AI context

**What you’re building:** B2B training execution SaaS — see **`README.md`** and the always-on Cursor rule **`.cursor/rules/recaller-project.mdc`** (product, architecture, **authoritative phase status**, GitHub checklist).

**Phased work:** `recaller-project.mdc` is the source of truth for done / next / active focus. **Mirror** the current phase in the one-liner below whenever that file changes. Glob rules: `database-schema.mdc`, `coding-standards.mdc` (SQL vs TS paths).

**Build spec:** `.cursor/plans/recaller_build_guide_aba69b5a.plan.md` — **local copy** (not in git). Open only the `### Phase N` section you need; never paste or attach the full plan.

**New chat / new phase:** Use **`@.cursor/rules/recaller-project.mdc`** (or rely on always-on rules) plus the build guide section **`### Phase N`** only — no separate handoff files.

**Conventions:** `org_id` + RLS · Server Components by default · no `service_role` in browser · Inngest for jobs.

**Dev server:** After finishing an implementation update, **always restart the dev server** (`npm run dev`) so the user can immediately see changes. Kill any existing dev process first, then start fresh. The user should never have to start the server manually.

**Git / GitHub:** Do **not** push or open PRs to the remote repo until the **current phase** is finished and **`recaller-project.mdc`** marks it done (no mid-phase pushes unless the user explicitly asks). When a phase **is** complete: audit staged files → conventional commit → push → verify. Never commit `.env.local`.

**Supabase / secrets:** Prefer Supabase Dashboard SQL Editor or a linked local CLI for migrations. This environment does not install Supabase MCP automatically; add a Supabase MCP in Cursor settings if you want dashboard-style tools in chat. Never paste live API keys or service-role tokens into chat or commit them.

**CLI:** GitHub CLI may live at `/tmp/gh_2.89.0_macOS_arm64/bin/gh` on this machine; use `gh` if it is on your `PATH`.

**Status (mirror `recaller-project.mdc`):** Phases 0–2 done; **next Phase 3** (AI Plan Generation). Repo: https://github.com/OzunaModelo123/recaller
