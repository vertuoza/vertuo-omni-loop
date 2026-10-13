-- Who may read and write the runners, and how a runner claims a job (PRD 1830). The supabase workflow
-- runs it on every pull request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/runners.sql
-- A member of the workspace reads its runners and jobs; an account of another workspace, or signed
-- out, nothing; nobody signed in writes either table or calls runner_claim() or runners_mark_lost().
-- As the service role: a runner claims the oldest queued job it may run, addressed to it, to its
-- fleet, or, for a runner with no fleet only, to any runner, for a repository it holds, while it has a
-- free slot; a runner silent for over the cutoff leaves its claimed and running jobs failed, reason
-- `runner lost`, and a runner still in time keeps its own. Then two runners claim one job at once, in
-- two sessions through dblink: exactly one takes it. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Olga owns the workspace Runners, Mo is a member of it; Eve belongs to another workspace.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000018300a1', 'olga@runners.test'),
  ('00000000-0000-4000-8000-0000018300b1', 'mo@runners.test'),
  ('00000000-0000-4000-8000-0000018300e1', 'eve@elsewhere.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000001830001', 'runners-check', 'Runners', 'runners-check'),
  ('00000000-0000-4000-8000-000001830002', 'runners-elsewhere', 'Elsewhere', 'runners-elsewhere');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000001830001', '00000000-0000-4000-8000-0000018300a1', 'owner'),
  ('00000000-0000-4000-8000-000001830001', '00000000-0000-4000-8000-0000018300b1', 'member'),
  ('00000000-0000-4000-8000-000001830002', '00000000-0000-4000-8000-0000018300e1', 'owner');
insert into public.teams (workspace_id, name, label, color) values
  ('00000000-0000-4000-8000-000001830001', 'cia', 'CIA', '#123456'),
  ('00000000-0000-4000-8000-000001830001', 'pirates', 'PIRATES', '#654321');

-- Three runners of Olga's: a shared one with one slot, one of the fleet cia, and one that holds
-- another repository only.
insert into public.runners (id, workspace_id, owner, name, fleet, slots, repos) values
  ('00000000-0000-4000-8000-0000018301a1', '00000000-0000-4000-8000-000001830001', '00000000-0000-4000-8000-0000018300a1', 'shared', null, 1, '{runners-check/app}'),
  ('00000000-0000-4000-8000-0000018301b1', '00000000-0000-4000-8000-000001830001', '00000000-0000-4000-8000-0000018300a1', 'cia-box', 'cia', 4, '{runners-check/app}'),
  ('00000000-0000-4000-8000-0000018301c1', '00000000-0000-4000-8000-000001830001', '00000000-0000-4000-8000-0000018300a1', 'other', null, 4, '{runners-check/other}');

-- Queued in this order: to any runner, to the fleet cia, to the runner `other` on a repository it
-- does not hold, to the fleet pirates, and a second one to any runner.
insert into public.runner_jobs (id, workspace_id, line, repo, to_runner, to_fleet, sent_by, queued_at) values
  ('00000000-0000-4000-8000-0000018302a1', '00000000-0000-4000-8000-000001830001', '/omni:yolo 1', 'runners-check/app', null, null, '00000000-0000-4000-8000-0000018300b1', now() - interval '5 minutes'),
  ('00000000-0000-4000-8000-0000018302b1', '00000000-0000-4000-8000-000001830001', '/omni:yolo 2', 'runners-check/app', null, 'cia', '00000000-0000-4000-8000-0000018300b1', now() - interval '4 minutes'),
  ('00000000-0000-4000-8000-0000018302c1', '00000000-0000-4000-8000-000001830001', '/omni:yolo 3', 'runners-check/app', '00000000-0000-4000-8000-0000018301c1', null, '00000000-0000-4000-8000-0000018300b1', now() - interval '3 minutes'),
  ('00000000-0000-4000-8000-0000018302d1', '00000000-0000-4000-8000-000001830001', '/omni:yolo 4', 'runners-check/app', null, 'pirates', '00000000-0000-4000-8000-0000018300b1', now() - interval '2 minutes'),
  ('00000000-0000-4000-8000-0000018302e1', '00000000-0000-4000-8000-000001830001', '/omni:yolo 5', 'runners-check/app', null, null, '00000000-0000-4000-8000-0000018300b1', now() - interval '1 minute');

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.runners limit 1; raise exception 'FAIL: anon read the runners';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.runner_jobs limit 1; raise exception 'FAIL: anon read the runner jobs';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── A member reads; nobody signed in writes ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000018300b1');
do $$
begin
  if (select count(*) from public.runners where workspace_id = '00000000-0000-4000-8000-000001830001') <> 3 then
    raise exception 'FAIL: a member did not read the workspace''s three runners';
  end if;
  if (select count(*) from public.runner_jobs where workspace_id = '00000000-0000-4000-8000-000001830001') <> 5 then
    raise exception 'FAIL: a member did not read the workspace''s five jobs';
  end if;
  begin
    insert into public.runner_jobs (workspace_id, line, repo, sent_by)
    values ('00000000-0000-4000-8000-000001830001', '/omni:yolo 9', 'runners-check/app', '00000000-0000-4000-8000-0000018300b1');
    raise exception 'FAIL: a member queued a job directly';
  exception when insufficient_privilege then null; end;
  begin
    update public.runners set fleet = null where workspace_id = '00000000-0000-4000-8000-000001830001';
    raise exception 'FAIL: a member changed a runner directly';
  exception when insufficient_privilege then null; end;
  begin
    perform public.runner_claim('00000000-0000-4000-8000-0000018301a1');
    raise exception 'FAIL: a member claimed a job';
  exception when insufficient_privilege then null; end;
  begin
    perform public.runners_mark_lost(now());
    raise exception 'FAIL: a member marked jobs lost';
  exception when insufficient_privilege then null; end;
end $$;

-- An account of another workspace reads nothing.
select pg_temp.sign_in('00000000-0000-4000-8000-0000018300e1');
do $$
begin
  if exists (select 1 from public.runners where workspace_id = '00000000-0000-4000-8000-000001830001')
     or exists (select 1 from public.runner_jobs where workspace_id = '00000000-0000-4000-8000-000001830001') then
    raise exception 'FAIL: another workspace read the runners or their jobs';
  end if;
end $$;
reset role;

-- ── The claim, as the service role ──
set local role service_role;
do $$
declare
  shared constant uuid := '00000000-0000-4000-8000-0000018301a1';
  cia    constant uuid := '00000000-0000-4000-8000-0000018301b1';
  other  constant uuid := '00000000-0000-4000-8000-0000018301c1';
  got    public.runner_jobs;
begin
  -- The fleet's runner skips the jobs sent to any runner, and takes the one sent to its fleet.
  select * into got from public.runner_claim(cia);
  if got.id is distinct from '00000000-0000-4000-8000-0000018302b1' or got.status <> 'claimed' or got.runner_id <> cia or got.claimed_at is null then
    raise exception 'FAIL: the fleet''s runner claimed %, not the job sent to its fleet', got.id;
  end if;
  -- It takes nothing else: the rest go to any runner, to another fleet, or to another runner.
  if exists (select 1 from public.runner_claim(cia)) then
    raise exception 'FAIL: the fleet''s runner claimed a job sent to any runner, to another fleet or to another runner';
  end if;
  -- A runner never takes a job for a repository it does not hold, even one sent to it.
  if exists (select 1 from public.runner_claim(other)) then
    raise exception 'FAIL: a runner claimed a job for a repository it does not hold';
  end if;
  -- The shared runner takes the oldest job sent to any runner, then, its one slot full, nothing.
  select * into got from public.runner_claim(shared);
  if got.id is distinct from '00000000-0000-4000-8000-0000018302a1' then
    raise exception 'FAIL: the shared runner claimed %, not the oldest job sent to any runner', got.id;
  end if;
  if exists (select 1 from public.runner_claim(shared)) then
    raise exception 'FAIL: a runner with no free slot claimed a job';
  end if;
  -- An unknown runner claims nothing.
  if exists (select 1 from public.runner_claim('00000000-0000-4000-8000-000001830fff')) then
    raise exception 'FAIL: an unknown runner claimed a job';
  end if;

  -- A lost runner: the fleet's, silent 91 seconds, loses its job; the shared one, 89, keeps its own.
  update public.runners set last_seen_at = now() - interval '91 seconds' where id = cia;
  update public.runners set last_seen_at = now() - interval '89 seconds' where id = shared;
  update public.runner_jobs set status = 'running', running_at = now() where id = '00000000-0000-4000-8000-0000018302a1';
  if public.runners_mark_lost(now() - interval '90 seconds') <> 1 then
    raise exception 'FAIL: marking the lost runners did not end exactly one job';
  end if;
  select * into got from public.runner_jobs where id = '00000000-0000-4000-8000-0000018302b1';
  if got.status <> 'failed' or got.reason <> 'runner lost' or got.ended_at is null then
    raise exception 'FAIL: the silent runner''s job is %/%, not failed with runner lost', got.status, got.reason;
  end if;
  if (select status from public.runner_jobs where id = '00000000-0000-4000-8000-0000018302a1') <> 'running' then
    raise exception 'FAIL: a runner still in time lost its job';
  end if;
  -- A failed job is never claimed again.
  update public.runners set last_seen_at = now() where id = cia;
  if exists (select 1 from public.runner_claim(cia) where id = '00000000-0000-4000-8000-0000018302b1') then
    raise exception 'FAIL: a lost job was claimed again';
  end if;
end $$;
reset role;

rollback;

-- ── Two runners, one job, at once ──
-- Two sessions through dblink each take a runner of the same workspace and claim. The first holds its
-- claim uncommitted; the second runs while it does, and skips the locked job: exactly one runner takes
-- it. The setup is committed through a third session, for the other two to see, and deleted at the end.
begin;
create extension if not exists dblink schema extensions;
do $$
declare
  link     constant text := 'host=db port=5432 dbname=postgres user=postgres password=postgres';
  setup    constant text := $s$
    delete from public.workspaces where id = '00000000-0000-4000-8000-000001830003';
    delete from auth.users where id = '00000000-0000-4000-8000-0000018303a1';
    insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000018303a1', 'race@runners.test');
    insert into public.workspaces (id, slug, name, github_org) values ('00000000-0000-4000-8000-000001830003', 'runners-race', 'Race', 'runners-race');
    insert into public.workspace_members (workspace_id, user_id, role) values ('00000000-0000-4000-8000-000001830003', '00000000-0000-4000-8000-0000018303a1', 'owner');
    insert into public.runners (id, workspace_id, owner, name, repos) values
      ('00000000-0000-4000-8000-0000018303b1', '00000000-0000-4000-8000-000001830003', '00000000-0000-4000-8000-0000018303a1', 'one', '{runners-race/app}'),
      ('00000000-0000-4000-8000-0000018303b2', '00000000-0000-4000-8000-000001830003', '00000000-0000-4000-8000-0000018303a1', 'two', '{runners-race/app}');
    insert into public.runner_jobs (id, workspace_id, line, repo, sent_by) values
      ('00000000-0000-4000-8000-0000018303c1', '00000000-0000-4000-8000-000001830003', '/omni:yolo 1', 'runners-race/app', '00000000-0000-4000-8000-0000018303a1');
  $s$;
  teardown constant text := $s$
    delete from public.workspaces where id = '00000000-0000-4000-8000-000001830003';
    delete from auth.users where id = '00000000-0000-4000-8000-0000018303a1';
  $s$;
  claim_one constant text := $s$select coalesce((select id::text from public.runner_claim('00000000-0000-4000-8000-0000018303b1')), 'none')$s$;
  claim_two constant text := $s$select coalesce((select id::text from public.runner_claim('00000000-0000-4000-8000-0000018303b2')), 'none')$s$;
  first    text;
  second   text;
  claimed  integer;
begin
  perform extensions.dblink_connect('rn_setup', link);
  perform extensions.dblink_exec('rn_setup', setup);
  perform extensions.dblink_connect('rn_one', link);
  perform extensions.dblink_connect('rn_two', link);
  begin
    perform extensions.dblink_exec('rn_one', 'begin; set local role service_role');
    perform extensions.dblink_exec('rn_two', 'begin; set local role service_role');
    select r into first from extensions.dblink('rn_one', claim_one) as t (r text);
    select r into second from extensions.dblink('rn_two', claim_two) as t (r text);
    perform extensions.dblink_exec('rn_one', 'commit');
    perform extensions.dblink_exec('rn_two', 'commit');
    if first <> '00000000-0000-4000-8000-0000018303c1' or second <> 'none' then
      raise exception 'FAIL: two runners at once claimed % and %, not the job and nothing', first, second;
    end if;
    select n into claimed from extensions.dblink('rn_setup',
      $s$select count(*)::integer from public.runner_jobs where id = '00000000-0000-4000-8000-0000018303c1' and status = 'claimed' and runner_id = '00000000-0000-4000-8000-0000018303b1'$s$) as t (n integer);
    if claimed <> 1 then
      raise exception 'FAIL: the job is not claimed by the first runner alone';
    end if;
  exception when others then
    perform extensions.dblink_disconnect('rn_one');
    perform extensions.dblink_disconnect('rn_two');
    perform extensions.dblink_exec('rn_setup', teardown);
    perform extensions.dblink_disconnect('rn_setup');
    raise;
  end;
  perform extensions.dblink_disconnect('rn_one');
  perform extensions.dblink_disconnect('rn_two');
  perform extensions.dblink_exec('rn_setup', teardown);
  perform extensions.dblink_disconnect('rn_setup');
end $$;
rollback;

select 'runners: every check passed' as result;
