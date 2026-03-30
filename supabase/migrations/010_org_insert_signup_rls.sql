-- Signup creates a new organisation before public.users exists. The original policy used
-- `auth.role() = 'authenticated'`, which can fail in some JWT/session contexts and
-- blocks inserts with: "new row violates row-level security policy for table organisations".

drop policy if exists "org_insert_authenticated" on public.organisations;

create policy "org_insert_authenticated"
  on public.organisations
  for insert
  to authenticated
  with check (auth.uid() is not null);
