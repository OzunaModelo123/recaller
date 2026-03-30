create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  created_by uuid not null references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  unique(group_id, user_id)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  assigned_to uuid not null references public.users(id) on delete cascade,
  assigned_by uuid not null references public.users(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  due_date timestamptz,
  scheduled_for timestamptz,
  status text not null default 'active' check (status in ('active', 'completed', 'overdue', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.step_completions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  step_number integer not null check (step_number between 1 and 4),
  completed_at timestamptz not null default now(),
  note text,
  difficulty_rating integer check (difficulty_rating between 1 and 5),
  platform_completed_on text check (platform_completed_on in ('web', 'slack', 'teams'))
);

create index if not exists assignments_org_id_idx on public.assignments(org_id);
create index if not exists assignments_assigned_to_idx on public.assignments(assigned_to);
create index if not exists step_completions_assignment_idx on public.step_completions(assignment_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.assignments enable row level security;
alter table public.step_completions enable row level security;

create policy "groups_org_admin_manage"
  on public.groups
  for all
  using (
    org_id = (select u.org_id from public.users u where u.id = auth.uid())
    and exists (
      select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'super_admin')
    )
  )
  with check (
    org_id = (select u.org_id from public.users u where u.id = auth.uid())
  );

create policy "group_members_admin_manage"
  on public.group_members
  for all
  using (
    exists (
      select 1
      from public.groups g
      join public.users u on u.id = auth.uid()
      where g.id = group_members.group_id
        and g.org_id = u.org_id
        and u.role in ('admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1
      from public.groups g
      join public.users u on u.id = auth.uid()
      where g.id = group_members.group_id
        and g.org_id = u.org_id
        and u.role in ('admin', 'super_admin')
    )
  );

create policy "assignments_admin_manage"
  on public.assignments
  for all
  using (
    org_id = (select u.org_id from public.users u where u.id = auth.uid())
    and exists (
      select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'super_admin')
    )
  )
  with check (
    org_id = (select u.org_id from public.users u where u.id = auth.uid())
  );

create policy "assignments_employee_select_own"
  on public.assignments
  for select
  using (assigned_to = auth.uid());

create policy "step_completions_employee_insert_own_assignment"
  on public.step_completions
  for insert
  with check (
    exists (
      select 1
      from public.assignments a
      where a.id = step_completions.assignment_id
        and a.assigned_to = auth.uid()
    )
  );

create policy "step_completions_select_org_scope"
  on public.step_completions
  for select
  using (
    exists (
      select 1
      from public.assignments a
      join public.users u on u.id = auth.uid()
      where a.id = step_completions.assignment_id
        and (a.assigned_to = auth.uid() or (a.org_id = u.org_id and u.role in ('admin', 'super_admin')))
    )
  );
