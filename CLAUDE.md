# Recaller — AI context

**What you’re building:** B2B training execution SaaS — see **`README.md`** and the always-on Cursor rule **`.cursor/rules/recaller-project.mdc`** (product, architecture, **authoritative phase status**, GitHub checklist).

**Phased work:** `recaller-project.mdc` is the source of truth for done / next / active focus. **Mirror** the current phase in the one-liner below whenever that file changes. Glob rules: `database-schema.mdc`, `coding-standards.mdc` (SQL vs TS paths).

**Build spec:** `.cursor/plans/recaller_build_guide_aba69b5a.plan.md` — **local copy** (not in git). Open only the `### Phase N` section you need; never paste or attach the full plan.

**New chat / handoff:** Optional `@.cursor/handoff_phaseN.md` for a minimal task prompt; rely on `recaller-project.mdc` for stack and status — avoid duplicating them in the paste.

**Conventions:** `org_id` + RLS · Server Components by default · no `service_role` in browser · Inngest for jobs.

**GitHub after each phase:** audit staged files → conventional commit → push → verify. Never commit `.env.local`.

**CLI:** GitHub CLI may live at `/tmp/gh_2.89.0_macOS_arm64/bin/gh` on this machine; use `gh` if it is on your `PATH`.

**Status (mirror `recaller-project.mdc`):** Phases 0–1 done; **next Phase 2** (Content Ingestion). Repo: https://github.com/OzunaModelo123/recaller
