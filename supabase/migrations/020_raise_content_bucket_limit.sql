-- Allow larger media uploads for transcription-heavy workflows.
insert into storage.buckets (id, name, public, file_size_limit)
values ('content-files', 'content-files', false, 2147483648)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit;
