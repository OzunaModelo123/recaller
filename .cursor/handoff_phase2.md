# Recaller — Phase 2 handoff (new chat)

## Token discipline

- Do **not** attach the full build guide. Open only **`### Phase 2: Content Ingestion`** in `.cursor/plans/recaller_build_guide_aba69b5a.plan.md`.
- **`recaller-project.mdc`** is always-on in Cursor — it already has product, stack, and phase status. **Do not** repeat that block in your paste unless the model has no project rules.

## Context (when editing)

1. `.cursor/rules/recaller-project.mdc` — phase status, architecture, GitHub checklist.
2. `.cursor/rules/database-schema.mdc` — SQL / `supabase/` / `database.ts`.
3. `.cursor/rules/coding-standards.mdc` — `*.ts` / `*.tsx`.

## Minimal paste prompt

```
Implement Recaller Phase 2 only: build guide section "### Phase 2: Content Ingestion". Follow .cursor/rules/recaller-project.mdc (org_id, RLS). Afterward: npm run lint && npm run build.
```

## Optional detail (only if rules unavailable)

If the session has **no** access to project rules, paste the long form from git history or add: Phase 0–1 complete; 7 migrations + `src/types/database.ts`; auth under `src/lib/supabase/*` and `src/middleware.ts`; dashboard/employee shells — then the minimal prompt above.

## After Phase 2

Update **Phase status** and **Active implementation focus** in `recaller-project.mdc`, sync **Status** in `CLAUDE.md`, README roadmap checkmarks, run the GitHub checklist in `recaller-project.mdc`, push. Use **`handoff_phase3.md`** for the next chat.
