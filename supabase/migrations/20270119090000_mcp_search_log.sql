-- A product's MCP server logs every search it answers (PRD omni-loop-6 s1, the spec's "The log").
--
-- Each search_knowledge and get_knowledge call to /api/products/<key>/mcp that passed the key check adds one
-- row, written by the route once its answer is sent (a write that fails is logged and dropped). The Search
-- section of the product's Knowledge page reads them (s3); a get_knowledge on a hit of a search, from the same
-- key and product within 10 minutes, fills that search's opened rank (s2).
--
--   public.mcp_search_log        one row per call: the product and its workspace, the API key's id (never the
--                                key, never its hash: L-GDPR-2), the tool, the query (the `query`, or the `id`
--                                asked), the filters, the mode, the total, the hits' ids in rank order, the id
--                                opened and its rank (empty until s2 fills them), and when it was asked.
--                                A member of the product's workspace reads its rows (L-GDPR-1, BR-PRODUCT-63);
--                                a member of another workspace and anon read none. The service role writes:
--                                it adds rows and fills the opened id and rank, and nobody else writes
--   mcp_search_log_forget()      deletes the rows asked more than 90 days ago (L-GDPR-4), and answers how
--                                many; pg_cron runs it every night. The service role's only otherwise
--   product_mcp_for_key()        answers `key_id` too, the id of the key it served, so the route files the
--                                row under the key's id; nothing else of its answer changes
--
-- Every change adds: one table, one function, one cron job, one key of an existing function's answer. Nothing
-- is dropped. Proven by supabase/checks/mcp_search_log.sql.
--
-- Rollback: revert the pull request (the route stops logging, the Search section goes); then a follow-up
-- migration runs `select cron.unschedule('mcp-search-log-forget');` and drops mcp_search_log_forget() and
-- public.mcp_search_log. product_mcp_for_key()'s `key_id` may stay: nothing else reads it.

-- ── The table ────────────────────────────────────────────────────────────────────

create table public.mcp_search_log (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  api_key_id   uuid references public.agent_tokens (id) on delete set null,
  tool         text not null constraint mcp_search_log_tool_check check (tool in ('search_knowledge', 'get_knowledge')),
  query        text constraint mcp_search_log_query_check check (char_length(query) <= 300),
  filters      jsonb not null default '{}'::jsonb constraint mcp_search_log_filters_check check (jsonb_typeof(filters) = 'object'),
  mode         text constraint mcp_search_log_mode_check check (mode in ('meaning', 'words')),
  total        integer not null constraint mcp_search_log_total_check check (total >= 0),
  hit_ids      text[] not null default '{}' constraint mcp_search_log_hit_ids_check check (cardinality(hit_ids) <= 20),
  opened_id    text constraint mcp_search_log_opened_id_check check (char_length(opened_id) <= 300),
  opened_rank  integer constraint mcp_search_log_opened_rank_check check (opened_rank between 1 and 20),
  asked_at     timestamptz not null default now(),
  -- The row's workspace is its product's, always: a row is never filed under another workspace.
  constraint mcp_search_log_product_fkey foreign key (product_id, workspace_id)
    references public.products (id, workspace_id) on delete cascade,
  constraint mcp_search_log_opened_check check ((opened_id is null) = (opened_rank is null))
);

comment on table public.mcp_search_log is
  'PRD omni-loop-6: one row per search_knowledge or get_knowledge call a product''s MCP server answered, written by the service role after the answer. Holds the API key''s id, never the key. A member of the product''s workspace reads its rows; kept 90 days (mcp_search_log_forget()).';
comment on column public.mcp_search_log.query is
  'PRD omni-loop-6: the `query` of a search_knowledge (null for a listing), or the `id` a get_knowledge asked.';
comment on column public.mcp_search_log.total is
  'PRD omni-loop-6: how many entries the search ranked; for a get_knowledge, 1 when the entry was found, else 0.';
comment on column public.mcp_search_log.hit_ids is
  'PRD omni-loop-6: the ids of the hits answered, in rank order (at most 20); for a get_knowledge, the id found.';
comment on column public.mcp_search_log.opened_rank is
  'PRD omni-loop-6: the rank (from 1) in hit_ids of the entry a later get_knowledge of the same key and product opened within 10 minutes, with opened_id; empty until then.';

-- The Search section reads a product's latest rows; the opened rank looks up a key's latest searches of a
-- product; forget() scans by age.
create index mcp_search_log_product_asked_idx on public.mcp_search_log (product_id, asked_at desc);
create index mcp_search_log_key_asked_idx on public.mcp_search_log (api_key_id, product_id, asked_at desc);
create index mcp_search_log_asked_idx on public.mcp_search_log (asked_at);

alter table public.mcp_search_log enable row level security;

create policy "a member reads their workspace's MCP search log" on public.mcp_search_log
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));

-- ── Retention (L-GDPR-4) ─────────────────────────────────────────────────────────

-- Deletes the rows asked more than 90 days ago. Answers how many.
create function public.mcp_search_log_forget() returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.mcp_search_log l where l.asked_at < now() - interval '90 days'
    returning 1
  )
  select count(*)::integer from gone
$$;

comment on function public.mcp_search_log_forget() is
  'PRD omni-loop-6 (L-GDPR-4): deletes the MCP search log''s rows asked more than 90 days ago, and answers how many. pg_cron runs it every night; the service role''s only otherwise.';

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('mcp-search-log-forget', '51 3 * * *', 'select public.mcp_search_log_forget()');

-- ── The key's id in the route's check ────────────────────────────────────────────

-- As 20270115090000_product_mcp.sql wrote it, with `key_id` added to its answer: the id of the key served.
create or replace function public.product_mcp_for_key(p_hash text, p_key text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key  text := lower(btrim(coalesce(p_key, '')));
  k      jsonb;
  allow  text[];
  p      public.products;
  repos  text[];
  home   text;
begin
  if v_key !~ '^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$' or char_length(v_key) > 40 then
    return null;
  end if;
  k := public.api_key_of(p_hash);
  if k is null then
    return null;
  end if;
  select * into p from public.products x
   where x.workspace_id = (k->>'workspace_id')::uuid and x.key = v_key
     and x.archived_at is null and x.mcp_enabled;
  if not found then
    return null;
  end if;

  select coalesce(array_agg(r order by r), '{}') into allow from jsonb_array_elements_text(k->'repos') r;
  select coalesce(array_agg(l.repository order by l.repository collate "C"), '{}') into repos
    from public.product_repositories l
   where l.product_id = p.id and (cardinality(allow) = 0 or l.repository = any (allow));
  if cardinality(allow) > 0 and cardinality(repos) = 0 then
    return null;
  end if;

  home := public.product_law_home(p.id);
  return jsonb_build_object(
    'product', jsonb_build_object('id', p.id, 'key', p.key, 'name', p.name, 'workspace_id', p.workspace_id),
    'key_id', k->'key_id',
    'repositories', coalesce((select jsonb_agg(public.product_mcp_repository(p.workspace_id, r) order by o)
                                from unnest(repos) with ordinality as x (r, o)), '[]'::jsonb),
    'law_home', case when home is not null then public.product_mcp_repository(p.workspace_id, home) end,
    'knowledge', public.product_knowledge_for_agents(p.id));
end;
$$;

comment on function public.product_mcp_for_key(text, text) is
  'PRD 2707: what a live API key of the product''s workspace reads of it through its MCP server: {product, key_id, repositories, law_home, knowledge}, or null when the key does not work, the product is not the key''s workspace''s, archived or off, or the key''s allow-list names none of its repositories. key_id (PRD omni-loop-6) is the served key''s id, never the key. The service role''s only.';

-- ── Who may do what ──────────────────────────────────────────────────────────────

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false): a member reads through
-- the policy above; the service role reads, adds rows and fills the opened id and rank, and deletes only
-- through mcp_search_log_forget().
revoke all on public.mcp_search_log from public, anon, authenticated, service_role;
grant select on public.mcp_search_log to authenticated;
grant select, insert on public.mcp_search_log to service_role;
grant update (opened_id, opened_rank) on public.mcp_search_log to service_role;

revoke execute on function public.mcp_search_log_forget() from public, anon, authenticated;
grant execute on function public.mcp_search_log_forget() to service_role;

-- create or replace keeps the function's grants; they are stated again, as 20270115090000 left them.
revoke execute on function public.product_mcp_for_key(text, text) from public, anon, authenticated;
grant execute on function public.product_mcp_for_key(text, text) to service_role;
