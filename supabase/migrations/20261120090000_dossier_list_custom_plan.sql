-- The PRD list loads again (bug #1308): dossier_list() is planned for the arguments it is called with.
--
-- dossier_list() was a SQL function. On Postgres 17 the statement of a SQL function that is not
-- inlined (this one sets search_path, so it never is) is planned with its arguments as unknown
-- parameters. `(p_dossier is null or d.id = p_dossier)` then reads as "a few dossiers", the planner
-- picks nested loops, among them a nested-loop anti join of the delivery rounds against the brainstorm
-- rounds, and the read grows with the square of the workspace. At about 1400 dossiers it ran for over
-- a minute and /prd, run as the signed-in person, hit the 8 second statement timeout ("The dossier
-- database could not answer"). The same statement with its arguments written in runs in under 100 ms.
--
-- The body below is 20261012100000_dossier_list_workspace.sql's, unchanged. It now runs in PL/pgSQL
-- with plan_cache_mode = force_custom_plan, so every call is planned with its own arguments: a null
-- p_dossier and p_workspace fold away, and the planner sees every dossier it is about to list. Same
-- signature, same columns, rows and order (supabase/checks/dossiers.sql); still security invoker, so
-- the caller's row-level security decides. `create or replace` keeps its grants (authenticated only).
-- supabase/checks/dossier_list_volume.sql lists 1400 dossiers inside the 8 second timeout.
--
-- Rollback: a follow-up migration recreates it as `language sql` with the body of
-- 20261012100000_dossier_list_workspace.sql, which is this file's body without `return query`.

create or replace function public.dossier_list(p_dossier uuid default null, p_workspace uuid default null)
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
  -- The dossiers listed: every one the caller reads, or only p_dossier, or only p_workspace's.
  ds as (
    select d.id, d.workspace_id, d.home_repo, d.prd, d.kind, d.title, d.opened_by, d.claude_session_id, d.created_at, d.numbered_at
      from public.dossiers d
     where (p_dossier is null or d.id = p_dossier)
       and (p_workspace is null or d.workspace_id = p_workspace)
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

comment on function public.dossier_list(uuid, uuid) is
  'Each dossier of the caller''s workspaces (or only p_dossier, or only p_workspace''s), newest activity first: its kind, its repositories (home, its questions'', its planet''s regions), its latest version of each kind, its question counts and its last activity. Set-based: no per-dossier function. Planned for each call''s own arguments (bug #1308). Security invoker: the caller''s row-level security decides.';
