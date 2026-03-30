-- Tenant-scoped vector similarity for plan few-shot retrieval and content RAG.
-- p_org_id must match the caller's org (via auth.uid()); prevents cross-tenant reads.

create or replace function public.match_plan_embeddings(
  p_org_id uuid,
  p_query_embedding extensions.vector(1536),
  p_match_count int default 3
)
returns table (
  plan_id uuid,
  plan_text text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    pe.plan_id,
    pe.plan_text,
    (1 - (pe.embedding <=> p_query_embedding))::double precision as similarity
  from plan_embeddings pe
  where pe.org_id = p_org_id
    and pe.is_admin_approved = true
    and p_org_id = (select u.org_id from public.users u where u.id = auth.uid() limit 1)
  order by pe.embedding <=> p_query_embedding
  limit least(coalesce(p_match_count, 3), 20);
$$;

revoke all on function public.match_plan_embeddings(uuid, extensions.vector, int) from public;
grant execute on function public.match_plan_embeddings(uuid, extensions.vector, int) to authenticated;

create or replace function public.match_content_chunks(
  p_org_id uuid,
  p_query_embedding extensions.vector(1536),
  p_match_count int default 5
)
returns table (
  content_item_id uuid,
  chunk_index integer,
  chunk_text text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    ce.content_item_id,
    ce.chunk_index,
    ce.chunk_text,
    (1 - (ce.embedding <=> p_query_embedding))::double precision as similarity
  from content_embeddings ce
  where ce.org_id = p_org_id
    and p_org_id = (select u.org_id from public.users u where u.id = auth.uid() limit 1)
  order by ce.embedding <=> p_query_embedding
  limit least(coalesce(p_match_count, 5), 50);
$$;

revoke all on function public.match_content_chunks(uuid, extensions.vector, int) from public;
grant execute on function public.match_content_chunks(uuid, extensions.vector, int) to authenticated;
