-- A product's MCP finds knowledge by meaning: the vectors (PRD 2728 s2, docs:
-- .omni-loop/delivery/inbox/2728-mcp-meaning-search/spec.md, "The vectors").
--
-- Every knowledge entry a product's MCP serves is turned into a vector once (the App's `knowledge-embed` job,
-- s4), and a search ranks the entries nearest to its question first (s5). The vectors are kept here, per
-- workspace and keyed by the embedded text's sha256, so an entry that did not change is never embedded twice,
-- across commits and across the repositories of one workspace.
--
--   extension vector                       pgvector, in the `extensions` schema
--   public.knowledge_vectors               (workspace_id, model, text_sha256) -> embedding vector(384),
--                                          made_at, last_used_at. Row-level security on, no policy: nobody
--                                          signed in reads or writes it, the service role reads it
--   knowledge_vectors_put(ws, model, rows) the only writer, the service role's alone. Each row is
--                                          {sha256, vector}: adds the new ones, sets last_used_at on the ones
--                                          it holds. Anything malformed (a vector not 384 numbers long, a bad
--                                          hash, no rows array) is refused whole (22023) before anything is
--                                          written. Answers how many rows were new
--   knowledge_vectors_missing(ws, model, hashes)
--                                          the hashes of the list the workspace holds no vector for, each
--                                          once, in the list's order. Service role only
--   knowledge_nearest(ws, model, hashes, query, k)
--                                          the k hashes of the list nearest to the query by cosine distance,
--                                          nearest first, with their distance. Reads only the given
--                                          workspace's rows and only the given hashes, and moves their
--                                          last_used_at at most once a day. An exact scan: no vector index (a
--                                          product holds a few thousand entries). Service role only
--   knowledge_vectors_forget()             deletes the vectors no search or job has used for 90 days
--                                          (L-GDPR-4), and answers how many; pg_cron runs it every day
--
-- A vector is never a person's: the embedded text leaves out the `Owner:` line (s1's embedText()), and a
-- workspace never reads another's (BR-PRODUCT-63): every function takes the workspace and reads only its rows.
--
-- Every change adds: one extension, one table, four functions, one cron job. Nothing existing is changed or
-- dropped. Proven by supabase/checks/knowledge_vectors.sql.
--
-- Rollback: revert the pull request (searches go back to words, the job kind has no handler); then a
-- follow-up migration runs `select cron.unschedule('knowledge-vectors-forget');` and drops the four
-- functions and public.knowledge_vectors. The `vector` extension may stay: nothing else depends on it.

create extension if not exists vector with schema extensions;

-- ── The table ────────────────────────────────────────────────────────────────────

create table public.knowledge_vectors (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  model        text not null constraint knowledge_vectors_model_check check (model ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  text_sha256  text not null constraint knowledge_vectors_text_sha256_check check (text_sha256 ~ '^[0-9a-f]{64}$'),
  embedding    extensions.vector(384) not null,
  made_at      timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  primary key (workspace_id, model, text_sha256)
);

comment on table public.knowledge_vectors is
  'PRD 2728: a vector of one knowledge text, per workspace and model, keyed by the lower-case hex sha256 of the embedded text''s UTF-8 bytes. Written only by knowledge_vectors_put(), read by the service role; nobody signed in reads or writes it.';
comment on column public.knowledge_vectors.last_used_at is
  'PRD 2728: when a job or a search last used the vector (moved at most once a day by a search); knowledge_vectors_forget() deletes the ones unused for 90 days.';

-- forget() scans by age.
create index knowledge_vectors_last_used_at_idx on public.knowledge_vectors (last_used_at);

alter table public.knowledge_vectors enable row level security;

-- ── The writer ───────────────────────────────────────────────────────────────────

-- Keeps the workspace's vectors of `p_rows` ([{sha256, vector}]): adds the new ones, sets last_used_at on the
-- ones already kept. Refuses the whole call (22023) when anything is malformed. Answers how many were new.
create function public.knowledge_vectors_put(p_workspace uuid, p_model text, p_rows jsonb) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r     jsonb;
  added integer;
begin
  if p_workspace is null then
    raise exception 'Workspace: required.' using errcode = '22023', hint = 'workspace';
  end if;
  if p_model is null or p_model !~ '^[a-z0-9][a-z0-9._-]{0,63}$' then
    raise exception 'Model: a lower-case name, such as gte-small.' using errcode = '22023', hint = 'model';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Rows: an array of {sha256, vector}.' using errcode = '22023', hint = 'rows';
  end if;
  -- Every row is checked before anything is written: one bad row refuses them all.
  for r in select x from jsonb_array_elements(p_rows) x loop
    if jsonb_typeof(r) <> 'object'
       or jsonb_typeof(r->'sha256') <> 'string' or (r->>'sha256') !~ '^[0-9a-f]{64}$' then
      raise exception 'Each row: {sha256, vector}, sha256 the lower-case hex of the text.' using errcode = '22023', hint = 'sha256';
    end if;
    if jsonb_typeof(r->'vector') <> 'array' or jsonb_array_length(r->'vector') <> 384
       or exists (select 1 from jsonb_array_elements(r->'vector') v where jsonb_typeof(v) <> 'number') then
      raise exception 'Each vector: 384 numbers.' using errcode = '22023', hint = 'vector';
    end if;
  end loop;

  with given as (
    select distinct on (x->>'sha256') x->>'sha256' as sha, (x->'vector')::text::extensions.vector(384) as embedding
      from jsonb_array_elements(p_rows) x
  ), kept as (
    insert into public.knowledge_vectors as k (workspace_id, model, text_sha256, embedding)
    select p_workspace, p_model, g.sha, g.embedding from given g
    on conflict (workspace_id, model, text_sha256) do update set last_used_at = now()
    returning (xmax = 0) as is_new
  )
  select count(*) filter (where is_new)::integer into added from kept;
  return added;
end;
$$;

comment on function public.knowledge_vectors_put(uuid, text, jsonb) is
  'PRD 2728: keeps the workspace''s vectors [{sha256, vector}] of one model: adds the new ones, sets last_used_at on the ones kept. 22023 for anything malformed (a vector not 384 numbers long, a bad hash), refused whole before anything is written. Answers how many were new. The service role''s only.';

-- ── The readers ──────────────────────────────────────────────────────────────────

-- The hashes of `p_hashes` the workspace holds no vector of `p_model` for, each once, in the list's order.
create function public.knowledge_vectors_missing(p_workspace uuid, p_model text, p_hashes text[]) returns text[]
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(h.sha order by h.first), '{}')
    from (select x.sha, min(x.o) as first
            from unnest(coalesce(p_hashes, '{}')) with ordinality as x (sha, o)
           where x.sha is not null
           group by x.sha) h
   where not exists (select 1 from public.knowledge_vectors k
                      where k.workspace_id = p_workspace and k.model = p_model and k.text_sha256 = h.sha)
$$;

comment on function public.knowledge_vectors_missing(uuid, text, text[]) is
  'PRD 2728: the hashes of the list the workspace holds no vector of the model for, each once, in the list''s order. The service role''s only.';

-- The `p_k` hashes of `p_hashes` nearest to `p_query` by cosine distance, nearest first, within the
-- workspace's vectors of `p_model` only. Moves their last_used_at, at most once a day.
create function public.knowledge_nearest(
  p_workspace uuid, p_model text, p_hashes text[], p_query extensions.vector, p_k integer
) returns table (text_sha256 text, distance double precision)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_query is null or extensions.vector_dims(p_query) <> 384 then
    raise exception 'Query: a vector of 384 numbers.' using errcode = '22023', hint = 'query';
  end if;
  if p_k is null or p_k < 1 then
    raise exception 'K: at least 1.' using errcode = '22023', hint = 'k';
  end if;

  return query
  with near as (
    select k.text_sha256 as sha, (k.embedding operator(extensions.<=>) p_query)::double precision as d
      from public.knowledge_vectors k
     where k.workspace_id = p_workspace and k.model = p_model and k.text_sha256 = any (coalesce(p_hashes, '{}'))
     order by d, k.text_sha256
     limit p_k
  ), used as (
    update public.knowledge_vectors k set last_used_at = now()
      from near n
     where k.workspace_id = p_workspace and k.model = p_model and k.text_sha256 = n.sha
       and k.last_used_at < now() - interval '1 day'
  )
  select n.sha, n.d from near n order by n.d, n.sha;
end;
$$;

comment on function public.knowledge_nearest(uuid, text, text[], extensions.vector, integer) is
  'PRD 2728: the k hashes of the list nearest to the query by cosine distance, nearest first, with their distance, read from the workspace''s vectors of the model alone; moves their last_used_at at most once a day. 22023 a query not 384 long, or k under 1. The service role''s only.';

-- ── Retention (L-GDPR-4) ─────────────────────────────────────────────────────────

-- Deletes the vectors no search or job has used for 90 days. Answers how many.
create function public.knowledge_vectors_forget() returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.knowledge_vectors k where k.last_used_at < now() - interval '90 days'
    returning 1
  )
  select count(*)::integer from gone
$$;

comment on function public.knowledge_vectors_forget() is
  'PRD 2728 (L-GDPR-4): deletes the knowledge vectors no search or job has used for 90 days, and answers how many. pg_cron runs it every day; the service role''s only otherwise.';

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('knowledge-vectors-forget', '43 3 * * *', 'select public.knowledge_vectors_forget()');

-- ── Who may call what ────────────────────────────────────────────────────────────

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false): the service role reads,
-- and writes only through knowledge_vectors_put().
revoke all on public.knowledge_vectors from public, anon, authenticated, service_role;
grant select on public.knowledge_vectors to service_role;

revoke execute on function public.knowledge_vectors_put(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.knowledge_vectors_put(uuid, text, jsonb) to service_role;
revoke execute on function public.knowledge_vectors_missing(uuid, text, text[]) from public, anon, authenticated;
grant execute on function public.knowledge_vectors_missing(uuid, text, text[]) to service_role;
revoke execute on function public.knowledge_nearest(uuid, text, text[], extensions.vector, integer) from public, anon, authenticated;
grant execute on function public.knowledge_nearest(uuid, text, text[], extensions.vector, integer) to service_role;
revoke execute on function public.knowledge_vectors_forget() from public, anon, authenticated;
grant execute on function public.knowledge_vectors_forget() to service_role;
