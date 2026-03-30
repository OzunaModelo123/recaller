create table if not exists public.insight_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  report_type text not null,
  period_start date not null,
  period_end date not null,
  ai_content text,
  pdf_url text,
  generated_at timestamptz not null default now(),
  delivered_at timestamptz
);

create table if not exists public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  metric_type text not null,
  metric_value numeric not null,
  snapshot_date date not null default current_date,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.insight_reports enable row level security;
alter table public.analytics_snapshots enable row level security;

create policy "insight_reports_admin_select_org"
  on public.insight_reports
  for select
  using (
    org_id = (select u.org_id from public.users u where u.id = auth.uid())
    and exists (
      select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'super_admin')
    )
  );

create policy "insight_reports_service_role_write"
  on public.insight_reports
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "analytics_snapshots_admin_select_org"
  on public.analytics_snapshots
  for select
  using (
    org_id = (select u.org_id from public.users u where u.id = auth.uid())
    and exists (
      select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'super_admin')
    )
  );

create policy "analytics_snapshots_service_role_write"
  on public.analytics_snapshots
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
