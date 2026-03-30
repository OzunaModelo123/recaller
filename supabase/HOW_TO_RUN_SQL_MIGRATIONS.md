# Run SQL migrations on your hosted Supabase project

Use this when you are **not** using `supabase link` + `supabase db push` (or you just want to fix the DB quickly).

## “email rate limit exceeded” on sign up

Supabase Auth limits how many confirmation emails a project can send per hour. During development, repeated sign-ups hit this quickly.

**Options:**

1. **Wait** (often ~1 hour) or **use another email address**.
2. **Local dev:** Supabase Dashboard → **Authentication** → **Providers** → **Email** → disable **Confirm email** (users get a session immediately; our app already supports that flow).  
   Turn confirmation back on before production.
3. **Custom SMTP** (higher limits) under **Authentication** → **Email** when you need more volume.

## Signup blocked: “row-level security policy for table organisations”

The app **creates the org and user with the service role** on the server (`SUPABASE_SERVICE_ROLE_KEY` in `.env.local`), so RLS does not block signup. If you still see this error, confirm **`SUPABASE_SERVICE_ROLE_KEY`** is set and restart `next dev`.

Optional DB migrations **`010`** / **`011`** remain in the repo for policy/RPC fixes on projects that prefer not to use the service role for provisioning.

## Fix “infinite recursion” on Content page (migration `009`)

1. Open **[Supabase Dashboard](https://supabase.com/dashboard)** and sign in.
2. Click your **Recaller** project (the one whose URL matches `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`).
3. In the left sidebar, click **SQL Editor**.
4. Click **New query**.
5. Open this file in your editor and **copy its entire contents**:  
   `supabase/migrations/009_fix_users_rls_recursion.sql`
6. Paste into the SQL Editor.
7. Click **Run** (or press the shortcut shown in the UI).

You should see **Success**. Reload your app and open **Content** again.

## Phase 2 file uploads (migration `008`) — if you have not run it yet

If uploads to Storage fail or the bucket is missing:

1. Same steps as above, but paste **`supabase/migrations/008_content_storage.sql`** and **Run**.

## Trackable steps (migration `013`) + TypeScript types

After **`013_trackable_step_proof.sql`** runs on the hosted project (SQL Editor, MCP `apply_migration`, or `supabase db push`):

1. Regenerate **`src/types/database.ts`** so the app matches the live schema:
   - **CLI** (needs `npx supabase login` or `SUPABASE_ACCESS_TOKEN`):
     ```bash
     npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/types/database.ts
     ```
   - **Dashboard:** Settings → API → **Generate TypeScript types** (paste into `src/types/database.ts` if you prefer).

`YOUR_PROJECT_REF` is the segment in `https://supabase.com/dashboard/project/<THIS_PART>/...` (same as in `NEXT_PUBLIC_SUPABASE_URL` before `.supabase.co`).

## Optional: CLI later

To push all migrations from the terminal in the future:

```bash
cd /path/to/Recaller
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

`YOUR_PROJECT_REF` is the id in the project URL:  
`https://supabase.com/dashboard/project/<THIS_PART>/...`

## Sync repo migrations ↔ hosted DB (recommended)

Use one of these so `supabase_migrations` matches `supabase/migrations/`:

| Method | What to add |
|--------|-------------|
| **A. Postgres URL** | Dashboard → **Project Settings** → **Database** → copy **URI** (URI mode) into `.env.local` as `DATABASE_URL` (or `DIRECT_URL`). |
| **B. Supabase access token** | Dashboard → **Account** → **Access Tokens** (or run `npx supabase login` once), then add `SUPABASE_ACCESS_TOKEN` to `.env.local`. `NEXT_PUBLIC_SUPABASE_URL` is used to derive the project ref, or set `SUPABASE_PROJECT_REF` explicitly. |

Then from the repo root:

```bash
npm run db:sync
```

**Local Docker stack** (Supabase CLI + Postgres in containers):

```bash
npm run db:sync:local
```

Requires Docker Desktop (or `docker` on your PATH). Use this when you want a disposable local DB that matches migrations.

**If `npm run db:sync` fails**, read the script’s error message — it lists which variables are missing. Never commit real tokens or database URLs.
