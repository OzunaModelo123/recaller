create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  channel text not null,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  delivered_at timestamptz,
  slack_message_ts text,
  teams_activity_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_suppressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  notification_type text not null,
  suppressed_until timestamptz not null
);

create table if not exists public.slack_installations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organisations(id) on delete cascade,
  team_id text not null,
  bot_token_encrypted text not null,
  bot_user_id text,
  installed_by uuid references public.users(id) on delete set null,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.teams_installations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organisations(id) on delete cascade,
  tenant_id text not null,
  bot_id text not null,
  bot_password_encrypted text not null,
  service_url text,
  installed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
alter table public.notification_suppressions enable row level security;
alter table public.slack_installations enable row level security;
alter table public.teams_installations enable row level security;

create policy "notifications_select_org"
  on public.notifications
  for select
  using (
    org_id = (select u.org_id from public.users u where u.id = auth.uid())
  );

create policy "notifications_service_role_write"
  on public.notifications
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "notification_suppressions_user_read_own"
  on public.notification_suppressions
  for select
  using (user_id = auth.uid());

create policy "notification_suppressions_service_role_write"
  on public.notification_suppressions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "slack_installations_org_admin_select"
  on public.slack_installations
  for select
  using (
    org_id = (select u.org_id from public.users u where u.id = auth.uid())
    and exists (
      select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'super_admin')
    )
  );

create policy "slack_installations_service_role_write"
  on public.slack_installations
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "teams_installations_org_admin_select"
  on public.teams_installations
  for select
  using (
    org_id = (select u.org_id from public.users u where u.id = auth.uid())
    and exists (
      select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'super_admin')
    )
  );

create policy "teams_installations_service_role_write"
  on public.teams_installations
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
