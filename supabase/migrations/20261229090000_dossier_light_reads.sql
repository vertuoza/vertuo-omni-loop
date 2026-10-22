-- Lighter reads for the PRD list and a PRD's page (PRD 2401 s3). Nothing here widens what anyone reads:
-- every function stays security invoker, so the caller's row-level security decides.
--
-- - dossier_list() takes p_kind and filters by it in SQL. /prd passes 'prd' and no longer lists every
--   fix of every workspace only to drop them in the app. Its body is
--   20261120090000_dossier_list_custom_plan.sql's, with one more condition on the dossiers listed;
--   still planned for each call's own arguments, so a null p_kind folds away. Same columns, rows and
--   order without p_kind. It is dropped and recreated, not overloaded, so no ambiguous
--   dossier_list(uuid, uuid) remains; callers pass named arguments, so today's calls keep working.
-- - dossier_repos(p_dossier) gives one dossier's repositories (its home, its questions' and its
--   planet's regions, as dossier_list() gives them), its question counts and how many versions it
--   has of each kind: what a PRD page's chips and its 2-second change check read. It numbers no
--   version and reads no other dossier's rounds, where dossier_list(p_dossier) did both.
-- - dossier_versions.slices keeps a plan version's slice count, set when the version is added, so the
--   page's "m/t slices" reads no plan's body: plan_slice_count() counts as the kit's
--   parsePlanSlices() does (kit/lib/inbox/territory.ts), 0 when the kit would read no slice. Versions
--   added before this keep null: the page reads their body, as before.
--
-- Proven by supabase/checks/dossier_reads.sql; supabase/checks/dossier_list_volume.sql lists 1400
-- dossiers inside the 8 second timeout, with p_kind and without.
--
-- Rollback: a follow-up migration drops dossier_repos(uuid), the trigger dossier_versions_slices, the
-- functions dossier_versions_slices() and plan_slice_count(text) and the column
-- dossier_versions.slices, then drops dossier_list(uuid, uuid, text) and recreates
-- dossier_list(uuid, uuid) with the body of 20261120090000_dossier_list_custom_plan.sql.

-- ── A plan's slice count ─────────────────────────────────────────────────────────

-- How many slices a plan declares, as the kit's parsePlanSlices() counts them: the rows of the first
-- table whose header starts with an `id` cell and names a `territory` column (any case), up to the
-- first line that is not a row, separator rows skipped, each row with an id. 0 when the kit reads no
-- slice: no such table, no row with an id, or an id that is no slice id.
create function public.plan_slice_count(p_plan text) returns integer
language plpgsql immutable
set search_path = ''
as $$
declare
  line   text;
  header text[];
  cells  text[];
  cell   text;
  found  integer := 0;
begin
  foreach line in array regexp_split_to_array(coalesce(p_plan, ''), E'\n') loop
    line := btrim(line, E' \t\r\f\v');
    if header is null then
      if line ~* '^\|\s*id\s*\|' then
        select array_agg(lower(btrim(c, E' \t\r\f\v')) order by o) into cells
          from unnest(string_to_array(regexp_replace(regexp_replace(line, '^\|', ''), '\|$', ''), '|')) with ordinality as h (c, o);
        if array_position(cells, 'territory') is not null then
          header := cells;
        end if;
      end if;
      continue;
    end if;
    exit when left(line, 1) <> '|';
    continue when line ~ '^\|[\s:|-]+\|$';
    cell := btrim(split_part(regexp_replace(line, '^\|', ''), '|', array_position(header, 'id')), E' \t\r\f\v');
    continue when cell = '';
    if cell !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      return 0;
    end if;
    found := found + 1;
  end loop;
  return found;
end;
$$;

comment on function public.plan_slice_count(text) is
  'PRD 2401: how many slices a plan declares, as the kit''s parsePlanSlices() counts them; 0 when it reads none.';

alter table public.dossier_versions add column slices integer check (slices is null or slices >= 0);

comment on column public.dossier_versions.slices is
  'PRD 2401: a plan version''s slice count (plan_slice_count()), set when it is added; 0 when the plan declares no slice the kit reads; null for every other kind, and for a plan added before PRD 2401.';

-- Sets a plan version's slice count as it is added. Only on insert: a version is never edited.
create function public.dossier_versions_slices() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.slices := case when new.kind = 'plan' then public.plan_slice_count(new.content) end;
  return new;
end;
$$;

create trigger dossier_versions_slices
  before insert on public.dossier_versions
  for each row execute function public.dossier_versions_slices();

revoke execute on function public.dossier_versions_slices() from public, anon, authenticated;

grant select (slices) on public.dossier_versions to authenticated;

-- ── The history, by kind ─────────────────────────────────────────────────────────

drop function public.dossier_list(uuid, uuid);

create function public.dossier_list(p_dossier uuid default null, p_workspace uuid default null, p_kind text default null)
returns table (
  id            uuid,
  workspace_id  uuid,
  home_repo     text,
  prd           integer,
  kind          text,
  title         text,
  opened_by     uuid,
  created_at    timestamptz,
  numbered_at   timestamptz,
  repos         text[],
  latest        jsonb,
  asked         integer,
  answered      integer,
  last_activity timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  with
  -- The dossiers listed: every one the caller reads, or only p_dossier, or only p_workspace's, and
  -- only those of p_kind when it is given.
  ds as (
    select d.id, d.workspace_id, d.home_repo, d.prd, d.kind, d.title, d.opened_by, d.claude_session_id, d.created_at, d.numbered_at
      from public.dossiers d
     where (p_dossier is null or d.id = p_dossier)
       and (p_workspace is null or d.workspace_id = p_workspace)
       and (p_kind is null or d.kind = p_kind)
  ),
  -- Brainstorm: the window of each dossier opened in a Claude session, from its opening to that
  -- session's next dossier in its workspace (none: open-ended).
  windows as (
    select d.id, d.workspace_id, d.claude_session_id, d.created_at,
           coalesce(min(n.created_at), 'infinity'::timestamptz) as window_end
      from ds d
      left join public.dossiers n
        on n.workspace_id = d.workspace_id and n.claude_session_id = d.claude_session_id and n.created_at > d.created_at
     where d.claude_session_id is not null
     group by d.id, d.workspace_id, d.claude_session_id, d.created_at
  ),
  brainstorm as (
    select w.id as dossier_id, r.id as round_id, r.status, r.created_at, r.answered_at, s.repo
      from windows w
      join public.ask_sessions s on s.workspace_id = w.workspace_id and s.claude_session_id = w.claude_session_id
      join public.ask_rounds r on r.session_id = s.id
     where r.created_at >= w.created_at
       and r.created_at < w.window_end
  ),
  -- Delivery: its PRD number, asked in its home repository (in any case), unless brainstorm has it.
  delivery as (
    select d.id as dossier_id, r.id as round_id, r.status, r.created_at, r.answered_at, s.repo
      from ds d
      join public.ask_sessions s on s.workspace_id = d.workspace_id and lower(s.repo) = d.home_repo
      join public.ask_rounds r on r.session_id = s.id and r.prd = d.prd
     where not exists (select 1 from brainstorm b where b.dossier_id = d.id and b.round_id = r.id)
  ),
  matched as (
    select * from brainstorm
    union all
    select * from delivery
  ),
  -- Its rounds: how many, how many answered, when.
  q as (
    select m.dossier_id,
           count(*)::integer as asked,
           (count(*) filter (where m.status = 'answered'))::integer as answered,
           max(m.created_at) as asked_at,
           max(m.answered_at) as answered_at
      from matched m
     group by m.dossier_id
  ),
  -- Its versions, each numbered by its place among its kind's; the latest of each kind is n = 1.
  numbered as (
    select dv.dossier_id, dv.kind, dv.id, dv.source, dv.created_at,
           count(*) over (partition by dv.dossier_id, dv.kind) as version,
           row_number() over (partition by dv.dossier_id, dv.kind order by dv.created_at desc, dv.id desc) as n
      from public.dossier_versions dv
      join ds d on d.id = dv.dossier_id
  ),
  v as (
    select k.dossier_id,
           jsonb_object_agg(k.kind, jsonb_build_object('id', k.id, 'version', k.version, 'source', k.source, 'created_at', k.created_at)) as latest,
           max(k.created_at) as at
      from numbered k
     where k.n = 1
     group by k.dossier_id
  ),
  -- Its other repositories: its questions', and, for a PRD of its workspace's plan repository, its
  -- planet's regions (each a repository of the workspace's organisation). Lower case, once each.
  extra as (
    select x.dossier_id, array_agg(distinct x.repo order by x.repo) as repos
      from (
        select m.dossier_id, lower(m.repo) as repo
          from matched m
         where m.repo is not null
        union all
        select d.id, lower(w.github_org || '/' || e.region)
          from ds d
          join public.workspaces w on w.id = d.workspace_id
          join public.ledger_events e
            on e.workspace_id = w.id and e.planet = d.prd and e.type = 'REGION_SURVEYED' and e.region is not null
         where d.kind = 'prd'
           and w.github_org is not null
           and w.plan_repo is not null
           and d.home_repo = lower(w.github_org || '/' || w.plan_repo)
      ) x
      join ds d on d.id = x.dossier_id
     where x.repo <> d.home_repo
     group by x.dossier_id
  )
  select d.id as id, d.workspace_id as workspace_id, d.home_repo as home_repo, d.prd as prd, d.kind as kind, d.title as title,
         d.opened_by as opened_by, d.created_at as created_at, d.numbered_at as numbered_at,
         array[d.home_repo] || coalesce(e.repos, '{}'::text[]) as repos,
         coalesce(v.latest, '{}'::jsonb) as latest,
         coalesce(q.asked, 0) as asked,
         coalesce(q.answered, 0) as answered,
         greatest(d.created_at, d.numbered_at, v.at, q.asked_at, q.answered_at) as last_activity
    from ds d
    left join q on q.dossier_id = d.id
    left join v on v.dossier_id = d.id
    left join extra e on e.dossier_id = d.id
   order by last_activity desc, d.id;
end;
$$;

comment on function public.dossier_list(uuid, uuid, text) is
  'Each dossier of the caller''s workspaces (or only p_dossier, or only p_workspace''s, and only those of p_kind when given), newest activity first: its kind, its repositories (home, its questions'', its planet''s regions), its latest version of each kind, its question counts and its last activity. Set-based: no per-dossier function. Planned for each call''s own arguments (bug #1308). Security invoker: the caller''s row-level security decides.';

revoke execute on function public.dossier_list(uuid, uuid, text) from public, anon;
grant execute on function public.dossier_list(uuid, uuid, text) to authenticated;

-- ── One dossier's repositories and pulse ─────────────────────────────────────────

create function public.dossier_repos(p_dossier uuid)
returns table (
  id       uuid,
  repos    text[],
  latest   jsonb,
  asked    integer,
  answered integer
)
language plpgsql
stable
security invoker
set search_path = ''
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  with
  -- The dossier, when the caller reads it.
  ds as (
    select d.id, d.workspace_id, d.home_repo, d.prd, d.kind, d.claude_session_id, d.created_at
      from public.dossiers d
     where d.id = p_dossier
  ),
  -- Its rounds, by dossier_list()'s two rules: brainstorm (its Claude session, from its opening to
  -- that session's next dossier in its workspace) and delivery (its PRD number in its home repository).
  windows as (
    select d.id, d.workspace_id, d.claude_session_id, d.created_at,
           coalesce(min(n.created_at), 'infinity'::timestamptz) as window_end
      from ds d
      left join public.dossiers n
        on n.workspace_id = d.workspace_id and n.claude_session_id = d.claude_session_id and n.created_at > d.created_at
     where d.claude_session_id is not null
     group by d.id, d.workspace_id, d.claude_session_id, d.created_at
  ),
  brainstorm as (
    select w.id as dossier_id, r.id as round_id, r.status, s.repo
      from windows w
      join public.ask_sessions s on s.workspace_id = w.workspace_id and s.claude_session_id = w.claude_session_id
      join public.ask_rounds r on r.session_id = s.id
     where r.created_at >= w.created_at
       and r.created_at < w.window_end
  ),
  delivery as (
    select d.id as dossier_id, r.id as round_id, r.status, s.repo
      from ds d
      join public.ask_sessions s on s.workspace_id = d.workspace_id and lower(s.repo) = d.home_repo
      join public.ask_rounds r on r.session_id = s.id and r.prd = d.prd
     where not exists (select 1 from brainstorm b where b.dossier_id = d.id and b.round_id = r.id)
  ),
  matched as (
    select * from brainstorm
    union all
    select * from delivery
  ),
  q as (
    select m.dossier_id,
           count(*)::integer as asked,
           (count(*) filter (where m.status = 'answered'))::integer as answered
      from matched m
     group by m.dossier_id
  ),
  -- How many versions it has of each kind: the latest's number, as dossier_list() numbers it.
  v as (
    select k.dossier_id, jsonb_object_agg(k.kind, k.versions) as latest
      from (
        select dv.dossier_id, dv.kind, count(*)::integer as versions
          from public.dossier_versions dv
          join ds d on d.id = dv.dossier_id
         group by dv.dossier_id, dv.kind
      ) k
     group by k.dossier_id
  ),
  -- Its other repositories, as dossier_list() gives them: its questions', and, for a PRD of its
  -- workspace's plan repository, its planet's regions. Lower case, once each.
  extra as (
    select x.dossier_id, array_agg(distinct x.repo order by x.repo) as repos
      from (
        select m.dossier_id, lower(m.repo) as repo
          from matched m
         where m.repo is not null
        union all
        select d.id, lower(w.github_org || '/' || e.region)
          from ds d
          join public.workspaces w on w.id = d.workspace_id
          join public.ledger_events e
            on e.workspace_id = w.id and e.planet = d.prd and e.type = 'REGION_SURVEYED' and e.region is not null
         where d.kind = 'prd'
           and w.github_org is not null
           and w.plan_repo is not null
           and d.home_repo = lower(w.github_org || '/' || w.plan_repo)
      ) x
      join ds d on d.id = x.dossier_id
     where x.repo <> d.home_repo
     group by x.dossier_id
  )
  select d.id as id,
         array[d.home_repo] || coalesce(e.repos, '{}'::text[]) as repos,
         coalesce(v.latest, '{}'::jsonb) as latest,
         coalesce(q.asked, 0) as asked,
         coalesce(q.answered, 0) as answered
    from ds d
    left join q on q.dossier_id = d.id
    left join v on v.dossier_id = d.id
    left join extra e on e.dossier_id = d.id;
end;
$$;

comment on function public.dossier_repos(uuid) is
  'PRD 2401: one dossier''s repositories (home, its questions'', its planet''s regions, as dossier_list() gives them), its question counts and how many versions it has of each kind: a PRD page''s chips and its change check. No row when the caller may not read it. Security invoker: the caller''s row-level security decides.';

revoke execute on function public.dossier_repos(uuid) from public, anon;
grant execute on function public.dossier_repos(uuid) to authenticated;
