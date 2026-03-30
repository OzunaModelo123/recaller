-- Private bucket for training files (PDF/DOCX/audio/video) processed by Inngest.
-- Path convention: {org_id}/{content_item_id}/{filename}

insert into storage.buckets (id, name, public, file_size_limit)
values ('content-files', 'content-files', false, 524288000)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit;

create policy "content_files_insert_own_org"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'content-files'
    and (storage.foldername(name))[1] = (select u.org_id::text from public.users u where u.id = auth.uid())
  );

create policy "content_files_select_own_org"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'content-files'
    and (storage.foldername(name))[1] = (select u.org_id::text from public.users u where u.id = auth.uid())
  );

create policy "content_files_update_own_org_admin"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'content-files'
    and (storage.foldername(name))[1] = (select u.org_id::text from public.users u where u.id = auth.uid())
    and exists (
      select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'super_admin')
    )
  )
  with check (
    bucket_id = 'content-files'
    and (storage.foldername(name))[1] = (select u.org_id::text from public.users u where u.id = auth.uid())
  );

create policy "content_files_delete_own_org_admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'content-files'
    and (storage.foldername(name))[1] = (select u.org_id::text from public.users u where u.id = auth.uid())
    and exists (
      select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'super_admin')
    )
  );
