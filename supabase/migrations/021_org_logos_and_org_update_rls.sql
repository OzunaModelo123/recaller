-- Public bucket for organization logos (branding). Path: {org_id}/logo.{ext}
insert into storage.buckets (id, name, public, file_size_limit)
values ('org-logos', 'org-logos', true, 2097152)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists "org_logos_select_public" on storage.objects;

-- Public read for logo URLs (bucket is public).
create policy "org_logos_select_public"
  on storage.objects
  for select
  to public
  using (bucket_id = 'org-logos');

drop policy if exists "org_logos_insert_admin" on storage.objects;
drop policy if exists "org_logos_update_admin" on storage.objects;
drop policy if exists "org_logos_delete_admin" on storage.objects;

create policy "org_logos_insert_admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'org-logos'
    and (storage.foldername(name))[1] = (select public.auth_user_org_id()::text)
    and (select public.auth_user_role()) in ('admin', 'super_admin')
  );

create policy "org_logos_update_admin"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'org-logos'
    and (storage.foldername(name))[1] = (select public.auth_user_org_id()::text)
    and (select public.auth_user_role()) in ('admin', 'super_admin')
  )
  with check (
    bucket_id = 'org-logos'
    and (storage.foldername(name))[1] = (select public.auth_user_org_id()::text)
  );

create policy "org_logos_delete_admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'org-logos'
    and (storage.foldername(name))[1] = (select public.auth_user_org_id()::text)
    and (select public.auth_user_role()) in ('admin', 'super_admin')
  );

-- Restrict organisation updates to admins (employees were able to update via RLS before).
drop policy if exists "org_update_own_org" on public.organisations;

create policy "org_update_admin"
  on public.organisations
  for update
  to authenticated
  using (
    id = (select public.auth_user_org_id())
    and (select public.auth_user_role()) in ('admin', 'super_admin')
  )
  with check (
    id = (select public.auth_user_org_id())
    and (select public.auth_user_role()) in ('admin', 'super_admin')
  );

comment on policy "org_update_admin" on public.organisations is
  'Only org admins may update organisation rows (name, logo_url, org_context, etc.).';
