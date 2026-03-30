create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  uploaded_by uuid not null references public.users(id) on delete set null,
  title text not null,
  source_type text not null,
  source_url text,
  file_path text,
  transcript text,
  transcript_chunks jsonb,
  status text not null default 'queued' check (status in ('queued', 'transcribing', 'analyzing', 'ready', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.content_embeddings (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  org_id uuid not null references public.organisations(id) on delete cascade,
  chunk_index integer not null,
  chunk_text text not null,
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  content_item_id uuid references public.content_items(id) on delete set null,
  created_by uuid not null references public.users(id) on delete set null,
  title text not null,
  original_ai_draft jsonb,
  current_version jsonb not null default '{}'::jsonb,
  content_analysis jsonb,
  quality_scores jsonb,
  category text,
  complexity text,
  skill_level text,
  is_template boolean not null default false,
  target_role text,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_steps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  step_number integer not null check (step_number between 1 and 4),
  title text not null,
  instructions text not null,
  success_criteria text not null,
  video_timestamp_start integer,
  video_timestamp_end integer,
  estimated_minutes integer,
  created_at timestamptz not null default now(),
  unique(plan_id, step_number)
);

create table if not exists public.plan_embeddings (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  org_id uuid not null references public.organisations(id) on delete cascade,
  plan_text text not null,
  embedding extensions.vector(1536) not null,
  is_admin_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists content_items_org_id_idx on public.content_items(org_id);
create index if not exists plans_org_id_idx on public.plans(org_id);
create index if not exists plan_steps_plan_id_idx on public.plan_steps(plan_id);
create index if not exists content_embeddings_embedding_hnsw_idx
  on public.content_embeddings using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists plan_embeddings_embedding_hnsw_idx
  on public.plan_embeddings using hnsw (embedding extensions.vector_cosine_ops);

alter table public.content_items enable row level security;
alter table public.content_embeddings enable row level security;
alter table public.plans enable row level security;
alter table public.plan_steps enable row level security;
alter table public.plan_embeddings enable row level security;

create policy "content_select_same_org"
  on public.content_items
  for select
  using (org_id = (select u.org_id from public.users u where u.id = auth.uid()));

create policy "content_admin_insert"
  on public.content_items
  for insert
  with check (
    org_id = (select u.org_id from public.users u where u.id = auth.uid())
    and exists (
      select 1
      from public.users u
      where u.id = auth.uid() and u.role in ('admin', 'super_admin')
    )
  );

create policy "content_admin_update"
  on public.content_items
  for update
  using (
    org_id = (select u.org_id from public.users u where u.id = auth.uid())
    and exists (
      select 1
      from public.users u
      where u.id = auth.uid() and u.role in ('admin', 'super_admin')
    )
  )
  with check (
    org_id = (select u.org_id from public.users u where u.id = auth.uid())
  );

create policy "content_embeddings_same_org_select"
  on public.content_embeddings
  for select
  using (org_id = (select u.org_id from public.users u where u.id = auth.uid()));

create policy "content_embeddings_admin_write"
  on public.content_embeddings
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

create policy "plans_same_org_select"
  on public.plans
  for select
  using (org_id = (select u.org_id from public.users u where u.id = auth.uid()));

create policy "plans_admin_write"
  on public.plans
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

create policy "plan_steps_same_org_select"
  on public.plan_steps
  for select
  using (
    exists (
      select 1
      from public.plans p
      join public.users u on u.id = auth.uid()
      where p.id = plan_steps.plan_id and p.org_id = u.org_id
    )
  );

create policy "plan_steps_admin_write"
  on public.plan_steps
  for all
  using (
    exists (
      select 1
      from public.plans p
      join public.users u on u.id = auth.uid()
      where p.id = plan_steps.plan_id
        and p.org_id = u.org_id
        and u.role in ('admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1
      from public.plans p
      join public.users u on u.id = auth.uid()
      where p.id = plan_steps.plan_id
        and p.org_id = u.org_id
        and u.role in ('admin', 'super_admin')
    )
  );

create policy "plan_embeddings_same_org_select"
  on public.plan_embeddings
  for select
  using (org_id = (select u.org_id from public.users u where u.id = auth.uid()));

create policy "plan_embeddings_admin_write"
  on public.plan_embeddings
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
