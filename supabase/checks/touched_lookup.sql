-- A GitHub webhook finds its repository's snapshots through an index (bug #2956). Run it after
-- `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/touched_lookup.sql
-- Every webhook of an organisation looks up the dossier_github rows of its repository
-- (apps/galaxy/src/touched/store.ts, snapshotsOf). Matching on the summary's JSON could use no index:
-- each call decompressed every summary of the workspace, 97 ms at 775 rows in production, the
-- costliest query of the database. At that size, with summaries as large as production's, the lookup
-- by repo_key, the repository in lower case, must use an index and read no other repository's row,
-- and find a repository's rows whatever case the webhook names it in.
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

-- The fixture is written as the database owner, without the tables' guards: they check who writes,
-- which is not what this check is about.
set local session_replication_role = replica;

-- 800 PRD dossiers over 20 repositories, each with a snapshot of about 6 kB, as production's. The
-- summary names the repository as GitHub spells it, in mixed case.
insert into public.dossiers (id, workspace_id, home_repo, kind, prd, title, numbered_at)
select ('00000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, w.id, 'initech/repo-' || (g % 20), 'prd', g,
       'Dossier ' || g, now()
  from public.workspaces w, generate_series(1, 800) g
 where w.slug = 'initech';

insert into public.dossier_github (dossier_id, workspace_id, summary)
select d.id, d.workspace_id,
       jsonb_build_object('repo', 'Initech/Repo-' || (d.prd % 20), 'prd', d.prd,
                          'padding', (select string_agg(md5(d.prd::text || i), '') from generate_series(1, 200) i))
  from public.dossiers d
 where d.home_repo like 'initech/repo-%';

analyze public.dossier_github;

set local role service_role;

do $$
declare
  initech uuid := (select id from public.workspaces where slug = 'initech');
  plan    text;
  found   int;
begin
  -- The lookup of a repository with no dossier, the most common touch, uses an index.
  begin
    execute format('explain select dossier_id, summary from public.dossier_github where workspace_id = %L and repo_key = %L',
                   initech, lower('Initech/Nobody')) into plan;
  exception when undefined_column then
    raise exception 'FAIL: dossier_github has no repo_key to look a repository up by: every touch reads every summary of the workspace';
  end;
  if plan not like '%dossier_github_repo_idx%' then
    raise exception 'FAIL: the lookup by repository uses no index: %', plan;
  end if;

  -- It finds the repository's rows whatever case the webhook names it in, and only those.
  execute format('select count(*) from public.dossier_github where workspace_id = %L and repo_key = %L',
                 initech, lower('INITECH/repo-3')) into found;
  if found <> 40 then
    raise exception 'FAIL: the lookup of initech/repo-3 found % rows, expected 40', found;
  end if;
end $$;

reset role;

-- repo_key is derived from the summary: a refresh that moves a dossier's repository moves its key.
do $$
declare
  key text;
begin
  update public.dossier_github set summary = summary || '{"repo": "Initech/Moved"}'
   where dossier_id = '00000000-0000-4000-8000-000000000001';
  select repo_key into key from public.dossier_github where dossier_id = '00000000-0000-4000-8000-000000000001';
  if key is distinct from 'initech/moved' then
    raise exception 'FAIL: repo_key did not follow the summary: %', key;
  end if;
end $$;

\echo 'touched_lookup: ok'

rollback;
