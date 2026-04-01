-- Ensure the private training-content bucket exists in environments where
-- migration 008 was not applied successfully.
insert into storage.buckets (id, name, public, file_size_limit)
values ('content-files', 'content-files', false, 524288000)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit;
