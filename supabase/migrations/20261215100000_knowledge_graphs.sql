-- A repository's knowledge graph, pushed to the server (PRD 1798 s1, docs:
-- .omni-loop/delivery/inbox/1798-knowledge-graph-api/spec.md, "The store").
--
-- - knowledge_graphs: one row per repository and commit, the graph `omni kb graph push` built from it
--   (P5's version 1 nodes and edges, shape `repository`, kit/lib/knowledge/graph-schema.ts) as jsonb,
--   when it was pushed and by whom. Stored per repository, never per workspace or product: a repository
--   in two products is pushed once and served in both, joined per product when it is read (s3).
-- - knowledge_graph_push(repo, sha, graph): the only writer, called by POST /api/knowledge/graphs as the
--   caller. It refuses (42501) a caller who is signed out, or a member of no workspace that lists the
--   repository, as roadmap_push() refuses a repository no workspace of the caller owns. The same commit
--   pushed again replaces its graph and its pusher; each push keeps the last 20 commits of the
--   repository, by when they were pushed, and deletes the older ones. It answers the graph's counts and
--   the products of the caller's workspaces that serve it (their link's knowledge is `own`).
-- - Who reads: a member of a workspace that lists the repository, through row-level security; anyone
--   else, or signed out, reads nothing. Nobody writes the table directly.
--
-- Every change adds: one table, one function. Nothing existing is changed or dropped.
--
-- Proven by supabase/checks/knowledge_graphs.sql.
--
-- Rollback (the down script): a follow-up migration that drops knowledge_graph_push() and
-- knowledge_graphs. Until the read route (s3) reads the table nothing depends on it; after, drop the
-- readers first.

-- ── The graphs ───────────────────────────────────────────────────────────────────

create table public.knowledge_graphs (
  repository      text not null constraint knowledge_graphs_repository_check check (repository ~ '^[a-z0-9-]{1,39}/[a-z0-9._-]{1,100}$'),
  sha             text not null constraint knowledge_graphs_sha_check check (sha ~ '^[0-9a-f]{40}$'),
  graph           jsonb not null constraint knowledge_graphs_graph_check check (
                    jsonb_typeof(graph) = 'object' and graph ->> 'shape' = 'repository'
                    and jsonb_typeof(graph -> 'nodes') = 'array' and jsonb_typeof(graph -> 'edges') = 'array'),
  pushed_at       timestamptz not null default clock_timestamp(),
  pushed_by       uuid references auth.users on delete set null,
  pushed_by_login text,
  primary key (repository, sha)
);

create index knowledge_graphs_latest_idx on public.knowledge_graphs (repository, pushed_at desc);

comment on table public.knowledge_graphs is
  'PRD 1798: a repository''s knowledge graph at one commit, as `omni kb graph push` built it. Written only by knowledge_graph_push(), which keeps the last 20 commits per repository; read by the members of a workspace that lists the repository.';
comment on column public.knowledge_graphs.repository is 'owner/name, in lower case.';
comment on column public.knowledge_graphs.sha is 'The 40-hex commit the graph was built from.';
comment on column public.knowledge_graphs.graph is 'P5''s version 1 nodes and edges, shape repository (kit/lib/knowledge/graph-schema.ts), checked by the push route.';
comment on column public.knowledge_graphs.pushed_at is 'When this commit was last pushed: the latest is the graph served.';
comment on column public.knowledge_graphs.pushed_by is 'Who last pushed it; null once their account is deleted.';
comment on column public.knowledge_graphs.pushed_by_login is 'Their GitHub login, lower case, as it was when they pushed; null when their account has no GitHub identity.';

-- ── The writer: the push route, as the caller ────────────────────────────────────

-- Keeps p_graph as the graph of p_repo at commit p_sha. Answers {repository, sha, nodes, edges, pushedAt,
-- products: [{id, key}]}, the products of the caller's workspaces whose link to the repository serves its
-- own knowledge, by key. 42501 signed out or a member of no workspace listing the repository, 22023 a
-- malformed value, its field in `hint`.
create function public.knowledge_graph_push(p_repo text, p_sha text, p_graph jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller   uuid := (select auth.uid());
  v_repo   text := lower(btrim(coalesce(p_repo, '')));
  v_sha    text := lower(btrim(coalesce(p_sha, '')));
  v_login  text;
  kept     public.knowledge_graphs;
  products jsonb;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if v_repo !~ '^[a-z0-9-]{1,39}/[a-z0-9._-]{1,100}$' then
    raise exception 'Repository: owner/name.' using errcode = '22023', hint = 'repo';
  end if;
  if v_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'Commit: the full 40-character sha.' using errcode = '22023', hint = 'commit';
  end if;
  if p_graph is null or jsonb_typeof(p_graph) <> 'object' or p_graph ->> 'shape' is distinct from 'repository'
     or jsonb_typeof(p_graph -> 'nodes') is distinct from 'array' or jsonb_typeof(p_graph -> 'edges') is distinct from 'array' then
    raise exception 'Graph: a repository''s graph, with its nodes and edges.' using errcode = '22023', hint = 'graph';
  end if;
  if octet_length(p_graph::text) > 2097152 then
    raise exception 'Graph: 2 MiB at most.' using errcode = '22023', hint = 'graph';
  end if;
  if not exists (select 1 from public.repositories r
                  join public.workspace_members m on m.workspace_id = r.workspace_id
                 where r.full_name = v_repo and m.user_id = caller) then
    raise exception 'You are not a member of a workspace that tracks %.', v_repo using errcode = '42501', hint = 'repo';
  end if;

  select lower(coalesce(i.identity_data ->> 'user_name', i.identity_data ->> 'preferred_username')) into v_login
    from auth.identities i
   where i.user_id = caller and i.provider = 'github'
   order by i.created_at
   limit 1;

  -- One push of a repository at a time, so the 20 kept are counted once.
  perform pg_advisory_xact_lock(hashtextextended('knowledge_graphs:' || v_repo, 0));

  insert into public.knowledge_graphs as g (repository, sha, graph, pushed_at, pushed_by, pushed_by_login)
  values (v_repo, v_sha, p_graph, clock_timestamp(), caller, v_login)
  on conflict (repository, sha) do update
     set graph = excluded.graph, pushed_at = excluded.pushed_at, pushed_by = excluded.pushed_by,
         pushed_by_login = excluded.pushed_by_login
  returning * into kept;

  delete from public.knowledge_graphs g
   where g.repository = v_repo
     and g.sha not in (select k.sha from public.knowledge_graphs k where k.repository = v_repo
                        order by k.pushed_at desc, k.sha limit 20);

  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'key', p.key) order by p.key nulls last, p.name, p.id), '[]'::jsonb)
    into products
    from public.product_repositories l
    join public.products p on p.id = l.product_id
   where l.repository = v_repo and l.knowledge = 'own'
     and l.workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = caller);

  return jsonb_build_object(
    'repository', kept.repository, 'sha', kept.sha,
    'nodes', jsonb_array_length(kept.graph -> 'nodes'), 'edges', jsonb_array_length(kept.graph -> 'edges'),
    'pushedAt', kept.pushed_at, 'products', products);
end;
$$;

-- ── Who reads the graphs ─────────────────────────────────────────────────────────

alter table public.knowledge_graphs enable row level security;

create policy "a member reads the graphs of their workspaces' repositories" on public.knowledge_graphs
  for select to authenticated
  using (exists (select 1 from public.repositories r
                  where r.full_name = knowledge_graphs.repository and r.workspace_id in (select public.my_workspaces())));

-- ── Who may call what ────────────────────────────────────────────────────────────

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false): read, and write only
-- through the function.
revoke all on public.knowledge_graphs from public, anon, authenticated, service_role;
grant select on public.knowledge_graphs to authenticated, service_role;

revoke execute on function public.knowledge_graph_push(text, text, jsonb) from public, anon;
grant execute on function public.knowledge_graph_push(text, text, jsonb) to authenticated;
