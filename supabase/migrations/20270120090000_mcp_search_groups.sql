-- A logged search can hold a category and a group (PRD omni-loop-7 s1, the spec's "Solution").
--
-- The App's `search-categorize` job (s3) takes the searches not yet grouped, embeds each question, joins it to
-- its product's nearest group within 0.92 cosine or starts one, and sets its category from Jev's
-- `search-category` decision (s2). The Search page's Categories view (s4) reads both.
--
--   public.mcp_search_log            gains `category` (one of the product's domains, or `other`; at most 80
--                                    characters, null until set) and `group_id` (its group, null until
--                                    grouped; a search never joins another product's group). Members read
--                                    them as they read the rest of a row; the service role sets them, and
--                                    still nothing else of a row
--   public.mcp_search_groups         one row per group of near-identical questions of a product: its
--                                    workspace, the id and question of the search that started it, that
--                                    question's vector(384) and the model that made it (as knowledge_vectors
--                                    names one), when it was started. A member of the product's workspace
--                                    reads its groups (L-GDPR-1, BR-PRODUCT-63); a member of another
--                                    workspace and anon read none. The service role reads and adds groups,
--                                    and nobody changes one
--   mcp_search_group_nearest()       the product's one group of the model nearest to a vector, with its
--                                    cosine, so the job never reads every group's vector. Service role only
--   mcp_search_log_forget()          also deletes a group none of whose searches is left once its first
--                                    search is forgotten (L-GDPR-4); it still answers how many searches went
--   jev_decision_names()             gains `search-category`
--
-- Every change adds: two columns, one table, one function, one name of an existing function's answer, one
-- statement of the nightly forget. Nothing is dropped. Proven by supabase/checks/mcp_search_groups.sql.
--
-- Rollback: revert the pull request (the job and the view go); then a follow-up migration restores
-- mcp_search_log_forget() and jev_decision_names() as 20270119090000_mcp_search_log.sql and
-- 20261128140000_law_worth.sql wrote them, deletes the decision's jev_decisions rows, drops
-- mcp_search_group_nearest(), the two columns and public.mcp_search_groups. The categories and groups are
-- derived: dropping them loses nothing logged.

-- ── The groups ───────────────────────────────────────────────────────────────────

create table public.mcp_search_groups (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null,
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  first_search_id uuid references public.mcp_search_log (id) on delete set null,
  question        text not null constraint mcp_search_groups_question_check check (char_length(question) between 1 and 300),
  model           text not null constraint mcp_search_groups_model_check check (model ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  embedding       extensions.vector(384) not null,
  created_at      timestamptz not null default now(),
  -- The group's workspace is its product's, always: a group is never filed under another workspace.
  constraint mcp_search_groups_product_fkey foreign key (product_id, workspace_id)
    references public.products (id, workspace_id) on delete cascade,
  -- What a search's group_id references, so a search never joins another product's group.
  constraint mcp_search_groups_id_product_key unique (id, product_id)
);

comment on table public.mcp_search_groups is
  'PRD omni-loop-7: one group of near-identical questions of a product, started by its first search: that search''s id (null once it is forgotten) and question, the question''s vector and the model that made it. Added by the service role''s search-categorize job, never changed; a member of the product''s workspace reads its groups. mcp_search_log_forget() deletes a group none of whose searches is left.';
comment on column public.mcp_search_groups.first_search_id is
  'PRD omni-loop-7: the search that started the group; null once mcp_search_log_forget() deleted it. The group stays while one of its searches is left.';
comment on column public.mcp_search_groups.embedding is
  'PRD omni-loop-7: the vector of the first question, by `model`; a later question joins the group within 0.92 cosine of it (the job''s setting).';

-- The job asks a product's nearest group of one model; the forget sets first_search_id to null by the search.
create index mcp_search_groups_product_model_idx on public.mcp_search_groups (product_id, model);
create index mcp_search_groups_first_search_idx on public.mcp_search_groups (first_search_id);

alter table public.mcp_search_groups enable row level security;

create policy "a member reads their workspace's MCP search groups" on public.mcp_search_groups
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));

-- ── A search's category and group ────────────────────────────────────────────────

alter table public.mcp_search_log
  add column category text constraint mcp_search_log_category_check check (char_length(category) between 1 and 80),
  add column group_id uuid,
  add constraint mcp_search_log_group_fkey foreign key (group_id, product_id)
    references public.mcp_search_groups (id, product_id) on delete set null (group_id);

comment on column public.mcp_search_log.category is
  'PRD omni-loop-7: one of the product''s domains, or `other`, as Jev''s search-category decision chose it; null until set, and kept null where the workspace has not switched the decision on.';
comment on column public.mcp_search_log.group_id is
  'PRD omni-loop-7: the group of near-identical questions of the product the search joined; null until the search-categorize job grouped it.';

-- The view counts a group's searches and the forget looks for one; the job takes the searches not yet grouped.
create index mcp_search_log_group_idx on public.mcp_search_log (group_id) where group_id is not null;
create index mcp_search_log_ungrouped_idx on public.mcp_search_log (asked_at)
  where group_id is null and tool = 'search_knowledge' and query is not null;

-- ── The nearest group ────────────────────────────────────────────────────────────

-- The product's one group of `p_model` nearest to `p_query` by cosine distance, with its cosine (1 - the
-- distance); nothing when the product has no group of that model. An exact scan of that product's groups.
create function public.mcp_search_group_nearest(p_product uuid, p_model text, p_query extensions.vector)
returns table (group_id uuid, cosine double precision)
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if p_query is null or extensions.vector_dims(p_query) <> 384 then
    raise exception 'Query: a vector of 384 numbers.' using errcode = '22023', hint = 'query';
  end if;

  return query
  select g.id, (1 - (g.embedding operator(extensions.<=>) p_query))::double precision
    from public.mcp_search_groups g
   where g.product_id = p_product and g.model = p_model
   order by g.embedding operator(extensions.<=>) p_query, g.id
   limit 1;
end;
$$;

comment on function public.mcp_search_group_nearest(uuid, text, extensions.vector) is
  'PRD omni-loop-7: the product''s one group of the model nearest to the vector, with its cosine (1 - the cosine distance), or nothing. 22023 a vector not 384 long. The service role''s only.';

-- ── Retention (L-GDPR-4) ─────────────────────────────────────────────────────────

-- As 20270119090000_mcp_search_log.sql wrote it, then deletes the groups none of whose searches is left once
-- their first search is gone: a group just started, whose first search the job has not joined to it yet, stays.
-- Still answers how many searches went.
create or replace function public.mcp_search_log_forget() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  with gone as (
    delete from public.mcp_search_log l where l.asked_at < now() - interval '90 days'
    returning 1
  )
  select count(*)::integer into n from gone;

  delete from public.mcp_search_groups g
   where g.first_search_id is null
     and not exists (select 1 from public.mcp_search_log l where l.group_id = g.id);

  return n;
end;
$$;

comment on function public.mcp_search_log_forget() is
  'PRD omni-loop-6 (L-GDPR-4): deletes the MCP search log''s rows asked more than 90 days ago, and answers how many; PRD omni-loop-7: then deletes the search groups none of whose searches is left. pg_cron runs it every night; the service role''s only otherwise.';

-- ── The Jev decision ─────────────────────────────────────────────────────────────

-- As 20261128140000_law_worth.sql wrote it, with `search-category` (s2) added: Off until a workspace's owner
-- switches it on, as every decision.
create or replace function public.jev_decision_names() returns text[]
language sql immutable
set search_path = ''
as $$
  select array['question-category', 'outbox-risk', 'bug-risk', 'unknown-worth-asking', 'constituent-break', 'hitl-category', 'law-worth', 'search-category']
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false): a member reads through
-- the policy above; the service role reads and adds groups, and deletes them only through
-- mcp_search_log_forget(). A member reads a search's category and group through the log's table grant.
revoke all on public.mcp_search_groups from public, anon, authenticated, service_role;
grant select on public.mcp_search_groups to authenticated;
grant select, insert on public.mcp_search_groups to service_role;
grant update (category, group_id) on public.mcp_search_log to service_role;

revoke execute on function public.mcp_search_group_nearest(uuid, text, extensions.vector) from public, anon, authenticated;
grant execute on function public.mcp_search_group_nearest(uuid, text, extensions.vector) to service_role;

-- create or replace keeps the functions' grants; they are stated again, as their migrations left them.
revoke execute on function public.mcp_search_log_forget() from public, anon, authenticated;
grant execute on function public.mcp_search_log_forget() to service_role;
