create extension if not exists pgcrypto;
create extension if not exists vector with schema extensions;

create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  size text,
  logo_url text,
  slack_team_id text unique,
  teams_tenant_id text unique,
  org_context jsonb not null default '{}'::jsonb,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organisations(id) on delete cascade,
  email text not null,
  full_name text,
  title text,
  role text not null default 'employee' check (role in ('super_admin', 'admin', 'employee')),
  slack_user_id text,
  teams_user_id text,
  notification_preferences jsonb not null default '{"email": true, "slack": true, "teams": true}'::jsonb,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  email text not null,
  role text not null default 'employee',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  invited_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists users_slack_user_id_idx on public.users(slack_user_id);
create index if not exists users_teams_user_id_idx on public.users(teams_user_id);
create index if not exists users_org_id_idx on public.users(org_id);
create index if not exists users_email_idx on public.users(email);

alter table public.organisations enable row level security;
alter table public.users enable row level security;
alter table public.invitations enable row level security;

create policy "org_select_own_org"
  on public.organisations
  for select
  using (id = (select u.org_id from public.users u where u.id = auth.uid()));

create policy "org_insert_authenticated"
  on public.organisations
  for insert
  with check (auth.role() = 'authenticated');

create policy "org_update_own_org"
  on public.organisations
  for update
  using (id = (select u.org_id from public.users u where u.id = auth.uid()))
  with check (id = (select u.org_id from public.users u where u.id = auth.uid()));

create policy "users_select_same_org"
  on public.users
  for select
  using (org_id = (select u.org_id from public.users u where u.id = auth.uid()));

create policy "users_insert_self"
  on public.users
  for insert
  with check (id = auth.uid());

create policy "users_update_self"
  on public.users
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "invitations_admin_insert"
  on public.invitations
  for insert
  with check (
    org_id = (select u.org_id from public.users u where u.id = auth.uid())
    and exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role in ('admin', 'super_admin')
    )
  );

create policy "invitations_admin_select"
  on public.invitations
  for select
  using (
    org_id = (select u.org_id from public.users u where u.id = auth.uid())
    and exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role in ('admin', 'super_admin')
    )
  );

create policy "invitations_update_by_email_match"
  on public.invitations
  for update
  using (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')))
  with check (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));
