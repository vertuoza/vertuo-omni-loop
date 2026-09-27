-- PRD dossiers, step 4 (PRD 216, docs: .omni-loop/delivery/inbox/0216-prd-dossiers/spec.md): the
-- history. dossier_list() returns each dossier of the caller's workspaces, as /prd lists it and as the
-- planet's DOSSIER tab reads it, newest activity first:
--
-- - its repositories: the home repository first, then, once each and in order, every other repository
--   its questions were asked in (the ask session of each round dossier_rounds() returns) and, for a PRD
--   of its workspace's plan repository, its planet's regions (the ledger's REGION_SURVEYED events of the
--   PRD's number, each as <github_org>/<region>). All in lower case, as the dossier keeps its home
--   repository: GitHub's owner/name is not case-sensitive, so one repository is one entry.
-- - its latest version of each kind, as {kind: {id, version, source, created_at}}, a kind with no
--   version left out. A version's number is its place among its kind's, as the version rule counts it.
-- - its question counts: the rounds dossier_rounds() returns, and those answered. A round counts once,
--   however many questions it holds, as the Questions tab counts it (outbox item s3-02).
-- - its last activity: the latest of its opening, its numbering, its versions, and its rounds, asked or
--   answered.
--
-- Security invoker, as dossier_rounds() is: the caller's own row-level security decides what comes back
-- (the dossiers of their workspaces, the rounds PRD 144 lets them read, their workspace and its ledger),
-- so a member of another workspace lists nothing of it (supabase/checks/dossiers.sql). `p_dossier`
-- narrows it to one dossier: the page to share shows that dossier's repositories.
--
-- Rollback: a follow-up migration drops the function. Nothing else changes.

create function public.dossier_list(p_dossier uuid default null)
returns table (
  id            uuid,
  workspace_id  uuid,
  home_repo     text,
  prd           integer,
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
language sql
stable
security invoker
set search_path = ''
as $$
  select d.id as id, d.workspace_id as workspace_id, d.home_repo as home_repo, d.prd as prd, d.title as title,
         d.opened_by as opened_by, d.created_at as created_at, d.numbered_at as numbered_at,
         array[d.home_repo] || array(
           select distinct x.repo
             from unnest(q.repos || p.repos) as x (repo)
            where x.repo <> d.home_repo
            order by x.repo
         ) as repos,
         coalesce(v.latest, '{}'::jsonb) as latest,
         q.asked as asked,
         q.answered as answered,
         greatest(d.created_at, d.numbered_at, v.at, q.asked_at, q.answered_at) as last_activity
    from public.dossiers d
    -- Its rounds, by the two rules: how many, how many answered, when, and the repositories they were asked in.
    cross join lateral (
      select count(*)::integer as asked,
             (count(*) filter (where r.status = 'answered'))::integer as answered,
             max(r.created_at) as asked_at,
             max(r.answered_at) as answered_at,
             coalesce(array_agg(lower(r.repo)) filter (where r.repo is not null), '{}'::text[]) as repos
        from public.dossier_rounds(d.id) r
    ) q
    -- Its latest version of each kind, numbered by its place among its kind's.
    cross join lateral (
      select jsonb_object_agg(k.kind, jsonb_build_object('id', k.id, 'version', k.version, 'source', k.source, 'created_at', k.created_at)) as latest,
             max(k.created_at) as at
        from (
          select distinct on (dv.kind) dv.kind, dv.id, dv.source, dv.created_at, count(*) over (partition by dv.kind) as version
            from public.dossier_versions dv
           where dv.dossier_id = d.id
           order by dv.kind, dv.created_at desc, dv.id desc
        ) k
    ) v
    -- A PRD of its workspace's plan repository: its planet's regions, each a repository of the workspace's organisation.
    cross join lateral (
      select coalesce(array_agg(lower(w.github_org || '/' || e.region)), '{}'::text[]) as repos
        from public.workspaces w
        join public.ledger_events e
          on e.workspace_id = w.id and e.planet = d.prd and e.type = 'REGION_SURVEYED' and e.region is not null
       where w.id = d.workspace_id
         and w.github_org is not null
         and w.plan_repo is not null
         and d.home_repo = lower(w.github_org || '/' || w.plan_repo)
    ) p
   where p_dossier is null or d.id = p_dossier
   order by last_activity desc, d.id
$$;

comment on function public.dossier_list(uuid) is
  'Each dossier of the caller''s workspaces (or only p_dossier), newest activity first: its repositories (home, its questions'', its planet''s regions), its latest version of each kind, its question counts and its last activity. Security invoker: the caller''s row-level security decides.';

revoke execute on function public.dossier_list(uuid) from public, anon;
grant execute on function public.dossier_list(uuid) to authenticated;
