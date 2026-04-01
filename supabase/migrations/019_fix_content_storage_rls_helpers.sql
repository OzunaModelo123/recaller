-- Use SECURITY DEFINER helpers inside storage policies so org/role checks
-- do not depend on inline selects against public.users under RLS.

create or replace function public.auth_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.role
  from public.users u
  where u.id = auth.uid()
  limit 1;
$$;

comment on function public.auth_user_role() is
  'Caller role from public.users; SECURITY DEFINER avoids fragile nested RLS checks.';

revoke all on function public.auth_user_role() from public;
grant execute on function public.auth_user_role() to authenticated;
grant execute on function public.auth_user_role() to service_role;

drop policy if exists "content_files_insert_own_org" on storage.objects;
drop policy if exists "content_files_select_own_org" on storage.objects;
drop policy if exists "content_files_update_own_org_admin" on storage.objects;
drop policy if exists "content_files_delete_own_org_admin" on storage.objects;

create policy "content_files_insert_own_org"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'content-files'
    and (storage.foldername(name))[1] = (select public.auth_user_org_id()::text)
  );

create policy "content_files_select_own_org"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'content-files'
    and (storage.foldername(name))[1] = (select public.auth_user_org_id()::text)
  );

create policy "content_files_update_own_org_admin"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'content-files'
    and (storage.foldername(name))[1] = (select public.auth_user_org_id()::text)
    and (select public.auth_user_role()) in ('admin', 'super_admin')
  )
  with check (
    bucket_id = 'content-files'
    and (storage.foldername(name))[1] = (select public.auth_user_org_id()::text)
  );

create policy "content_files_delete_own_org_admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'content-files'
    and (storage.foldername(name))[1] = (select public.auth_user_org_id()::text)
    and (select public.auth_user_role()) in ('admin', 'super_admin')
  );
