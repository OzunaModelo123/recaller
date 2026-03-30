create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organisations(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_tier text not null default 'starter' check (plan_tier in ('starter', 'growth', 'enterprise')),
  seat_count integer not null default 1,
  seat_limit integer not null default 1,
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "subscriptions_admin_select_org"
  on public.subscriptions
  for select
  using (
    org_id = (select u.org_id from public.users u where u.id = auth.uid())
    and exists (
      select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'super_admin')
    )
  );

create policy "subscriptions_service_role_write"
  on public.subscriptions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
