alter table public.assignments
  add column if not exists require_content_consumption boolean not null default false,
  add column if not exists content_consumed boolean not null default false;

create table if not exists public.content_consumptions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  watch_time_seconds integer not null default 0,
  platform text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_consumptions_assignment_id_idx on public.content_consumptions(assignment_id);
create index if not exists content_consumptions_user_id_idx on public.content_consumptions(user_id);

alter table public.content_consumptions enable row level security;

create policy "content_consumptions_employee_select_own"
  on public.content_consumptions for select
  using (user_id = auth.uid());

create policy "content_consumptions_employee_insert_own"
  on public.content_consumptions for insert
  with check (
    user_id = auth.uid() and
    exists (select 1 from public.assignments a where a.id = assignment_id and a.assigned_to = auth.uid())
  );

create policy "content_consumptions_employee_update_own"
  on public.content_consumptions for update
  using (
    user_id = auth.uid() and
    exists (select 1 from public.assignments a where a.id = assignment_id and a.assigned_to = auth.uid())
  )
  with check (
    user_id = auth.uid() and
    exists (select 1 from public.assignments a where a.id = assignment_id and a.assigned_to = auth.uid())
  );

create policy "content_consumptions_org_admin_select"
  on public.content_consumptions for select
  using (
    exists (
      select 1
      from public.assignments a
      join public.users u on u.id = auth.uid()
      where a.id = content_consumptions.assignment_id
        and a.org_id = u.org_id
        and u.role in ('admin', 'super_admin')
    )
  );

-- To update `updated_at` timestamps seamlessly:
create extension if not exists moddatetime schema extensions;
drop trigger if exists handle_updated_at on public.content_consumptions;
create trigger handle_updated_at before update on public.content_consumptions
  for each row execute procedure extensions.moddatetime (updated_at);
