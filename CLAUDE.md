# Recaller — AI context

**Cursor:** Project rules live in `.cursor/rules/` (not committed to GitHub). The single always-on rule is `recaller-project.mdc` (product, architecture, phase status, GitHub checklist). Schema and coding standards attach via globs when you edit SQL / Supabase / TS.

**Build spec:** `.cursor/plans/recaller_build_guide_aba69b5a.plan.md` — keep a **local** copy; the repo `.gitignore` excludes `.cursor/`. In chats, read only the `### Phase N` section you need — not the full plan.

**Conventions:** `org_id` + RLS · Server Components by default · no `service_role` in browser · Inngest for jobs.

**GitHub after each phase:** audit staged files → conventional commit → push → verify. Never commit `.env.local`.

**CLI:** GitHub CLI may live at `/tmp/gh_2.89.0_macOS_arm64/bin/gh` on this machine; use `gh` if it is on your `PATH`.

**Status:** Phases 0–1 done; next Phase 2 (Content Ingestion). Repo: https://github.com/OzunaModelo123/recaller
