-- A mission's repairs and the Omni Loop bugs it reported (PRD 2980 s2). The supabase workflow runs it on every pull request,
-- after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/mission_repairs.sql
-- Mission 2980 of initech/nimbus-plan. As the service role (the supervisor), a cause is repaired 1, 2 and 3 times in a round and
-- a 4th is refused naming its fingerprint; the number is the database's, whatever the caller sent; a lost repair spends nothing;
-- a new round gives the cause 3 again; the mission's 9 count every round, and a 10th is refused naming the mission (AC-4). A
-- repair starts with no outcome; its job, retro and fix are filled in while it runs; its outcome dates its end, after which
-- nothing of it changes, and what it was never changes; nobody deletes one, but it goes with its mission. A member of the
-- mission's workspace reads its repairs; a member of another workspace, an account of none, nothing; anon nothing; nobody
-- signed in writes them. omni_bug_reports holds one row per fingerprint, counted again in one statement by
-- omni_bug_report_seen(); nobody signed in reads, writes or counts it. A mission event may be repair-started, retro,
-- repair-ended or bug-reported; a job's mission_key may be a PRD's k-th repair; runner_claim() hands out a repair before a
-- fresh job queued earlier; set_repository_runner_skill() refuses a repository's own skill named repair. A new Engineer lists
-- repair last, and the migration run again gives it to an Engineer made before while its skills are still its default, never
-- to one a person changed. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000298a1', 'ada@example.com'),
  ('00000000-0000-4000-8000-0000000298c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000298e1', 'eve@example.com');
-- Ada owns Initech; Carl belongs to Acme; Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme-repairs', 'Acme', 'acme-repairs');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('initech',      '00000000-0000-4000-8000-0000000298a1'::uuid, 'owner'),
         ('acme-repairs', '00000000-0000-4000-8000-0000000298c1'::uuid, 'member')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug;

-- Mission 2980, running, on Initech's fleet beaver. The job whose failure its repairs name, ...b01, is kept by id alone, as a
-- job that is gone is.
insert into public.missions (id, workspace_id, repo, fleet, number, title, goal, scope, status)
select '00000000-0000-4000-8000-000002980a01', w.id, 'initech/nimbus-plan', 'beaver', 2980, 'Paid online',
       'Every quote can be paid online.', '{"prds": [2981, 2982], "roadmaps": []}'::jsonb, 'running'
  from public.workspaces w where w.slug = 'initech';

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- One repair of mission 2980's PRD 2981, for a cause, in a round; the number it got.
create function pg_temp.repair(cause text, round integer default 1, number smallint default 1) returns smallint language sql as $$
  insert into public.mission_repairs (mission_id, prd, fingerprint, round, number, failed_job_id)
  values ('00000000-0000-4000-8000-000002980a01', 2981, cause, round, number, '00000000-0000-4000-8000-000002980b01')
  returning number;
$$;

-- A repair that must be refused for `hint`: SQLSTATE 23514 and the hint.
create function pg_temp.refused(cause text, round integer, hint text) returns void language plpgsql as $$
declare
  h text;
begin
  perform pg_temp.repair(cause, round);
  raise exception 'FAIL: a repair of % in round % was not refused for its %', cause, round, hint;
exception when check_violation then
  get stacked diagnostics h = pg_exception_hint;
  if h is distinct from hint then
    raise exception 'FAIL: a repair of % in round % was refused for % instead of its %', cause, round, h, hint;
  end if;
end;
$$;

grant execute on function pg_temp.repair(text, integer, smallint), pg_temp.refused(text, integer, text) to service_role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.mission_repairs limit 1; raise exception 'FAIL: anon read the mission repairs';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.omni_bug_reports limit 1; raise exception 'FAIL: anon read the Omni Loop bug reports';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── The budget: 3 per cause in a round, 9 per mission ──
set local role service_role;
do $$
begin
  if pg_temp.repair('aaaaaaaa11112222000000000000000000000000000000000000000000000000', 1, 3::smallint) <> 1 then raise exception 'FAIL: the first repair of a cause took the caller''s number'; end if;
  if pg_temp.repair('aaaaaaaa11112222000000000000000000000000000000000000000000000000') <> 2 then raise exception 'FAIL: the second repair of a cause is not number 2'; end if;
  if pg_temp.repair('aaaaaaaa11112222000000000000000000000000000000000000000000000000') <> 3 then raise exception 'FAIL: the third repair of a cause is not number 3'; end if;
  perform pg_temp.refused('aaaaaaaa11112222000000000000000000000000000000000000000000000000', 1, 'fingerprint');

  -- A lost repair spends nothing: the next one of its cause takes its number again.
  if pg_temp.repair('bbbbbbbb11112222000000000000000000000000000000000000000000000000') <> 1 then raise exception 'FAIL: a new cause did not start at 1'; end if;
  update public.mission_repairs set outcome = 'lost' where fingerprint = 'bbbbbbbb11112222000000000000000000000000000000000000000000000000';
  if pg_temp.repair('bbbbbbbb11112222000000000000000000000000000000000000000000000000') <> 1 then raise exception 'FAIL: a lost repair spent its cause''s number'; end if;

  -- A new round gives a cause 3 again.
  if pg_temp.repair('aaaaaaaa11112222000000000000000000000000000000000000000000000000', 2) <> 1 then raise exception 'FAIL: a new round did not give the cause 3 again'; end if;

  -- 3 + 1 + 1 spent; four causes more make 9, the lost one apart.
  perform pg_temp.repair('cccccccc11112222000000000000000000000000000000000000000000000000');
  perform pg_temp.repair('dddddddd11112222000000000000000000000000000000000000000000000000');
  perform pg_temp.repair('eeeeeeee11112222000000000000000000000000000000000000000000000000');
  perform pg_temp.repair('ffffffff11112222000000000000000000000000000000000000000000000000');
  if (select count(*) from public.mission_repairs where outcome is distinct from 'lost') <> 9 then
    raise exception 'FAIL: the mission has not run 9 repairs';
  end if;
  perform pg_temp.refused('abababab11112222000000000000000000000000000000000000000000000000', 1, 'mission');
  perform pg_temp.refused('aaaaaaaa11112222000000000000000000000000000000000000000000000000', 3, 'mission');
end $$;

-- ── A repair's life: filled in while it runs, ended once, never changed after ──
do $$
declare
  one uuid := (select id from public.mission_repairs where fingerprint = 'cccccccc11112222000000000000000000000000000000000000000000000000');
  got public.mission_repairs;
begin
  begin
    insert into public.mission_repairs (mission_id, prd, fingerprint, failed_job_id, outcome, ended_at)
    values ('00000000-0000-4000-8000-000002980a01', 2981, 'abababab11112222000000000000000000000000000000000000000000000000', '00000000-0000-4000-8000-000002980b01', 'fixed', now());
    raise exception 'FAIL: a repair started with an outcome';
  exception when invalid_parameter_value then null; end;
  begin
    perform pg_temp.repair('NOT-HEX');
    raise exception 'FAIL: a fingerprint out of its shape was taken';
  exception when check_violation then null; end;
  begin
    perform pg_temp.repair('abababab11112222');
    raise exception 'FAIL: a fingerprint shorter than a sha256 was taken';
  exception when check_violation then null; end;
  begin
    update public.mission_repairs set fix_pr = 'https://example.test/pull/1' where id = one;
    raise exception 'FAIL: a fix that is no GitHub pull request was taken';
  exception when check_violation then null; end;
  begin
    update public.mission_repairs set retro = '"a log excerpt"'::jsonb where id = one;
    raise exception 'FAIL: a retro that is no object was taken';
  exception when check_violation then null; end;

  update public.mission_repairs
     set job_id = '00000000-0000-4000-8000-000002980b02',
         retro = '{"cause": "A test reads a removed column.", "class": "code"}'::jsonb,
         fix_pr = 'https://github.com/initech/nimbus-plan/pull/42'
   where id = one;
  select * into got from public.mission_repairs where id = one;
  if got.ended_at is not null or got.outcome is not null or got.fix_pr is null then
    raise exception 'FAIL: a running repair was not filled in, or read as ended: %', row(got.*);
  end if;
  begin
    update public.mission_repairs set fingerprint = 'abababab11112222000000000000000000000000000000000000000000000000' where id = one;
    raise exception 'FAIL: a repair''s cause changed';
  exception when insufficient_privilege then null; end;
  begin
    update public.mission_repairs set round = 2 where id = one;
    raise exception 'FAIL: a repair''s round changed';
  exception when insufficient_privilege then null; end;

  update public.mission_repairs set outcome = 'fixed' where id = one;
  select * into got from public.mission_repairs where id = one;
  if got.ended_at is null then raise exception 'FAIL: an ended repair has no end'; end if;
  begin
    update public.mission_repairs set outcome = 'not fixed' where id = one;
    raise exception 'FAIL: an ended repair''s outcome changed';
  exception when insufficient_privilege then null; end;
  begin
    update public.mission_repairs set fix_pr = null where id = one;
    raise exception 'FAIL: an ended repair''s fix changed';
  exception when insufficient_privilege then null; end;
  begin
    update public.mission_repairs set outcome = 'gone' where fingerprint = 'dddddddd11112222000000000000000000000000000000000000000000000000';
    raise exception 'FAIL: an outcome off the list was taken';
  exception when check_violation then null; end;
  begin
    delete from public.mission_repairs where id = one;
    raise exception 'FAIL: the service role deleted a repair';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Who reads the repairs ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000298a1');
do $$
begin
  if (select count(*) from public.mission_repairs) <> 10 then
    raise exception 'FAIL: a member does not read the 10 repair rows of their workspace''s mission';
  end if;
  begin
    insert into public.mission_repairs (mission_id, prd, fingerprint, failed_job_id)
    values ('00000000-0000-4000-8000-000002980a01', 2981, 'abababab11112222000000000000000000000000000000000000000000000000', '00000000-0000-4000-8000-000002980b01');
    raise exception 'FAIL: a member wrote a repair';
  exception when insufficient_privilege then null; end;
  begin
    update public.mission_repairs set outcome = 'fixed';
    raise exception 'FAIL: a member ended a repair';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.omni_bug_reports limit 1; raise exception 'FAIL: a member read the Omni Loop bug reports';
  exception when insufficient_privilege then null; end;
  begin perform public.omni_bug_report_seen('aaaaaaaa11112222000000000000000000000000000000000000000000000000'); raise exception 'FAIL: a member counted an Omni Loop bug report';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000298c1');
do $$
begin
  if exists (select 1 from public.mission_repairs) then raise exception 'FAIL: a member of another workspace read a repair'; end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000298e1');
do $$
begin
  if exists (select 1 from public.mission_repairs) then raise exception 'FAIL: an account of no workspace read a repair'; end if;
end $$;
reset role;

-- ── The Omni Loop bugs: one row per fingerprint, a repeat counted ──
set local role service_role;
do $$
declare
  got public.omni_bug_reports;
begin
  insert into public.omni_bug_reports (fingerprint, repo, issue) values ('0123456789abcdef000000000000000000000000000000000000000000000000', 'demo-org/omni-loop', 3001);
  begin
    insert into public.omni_bug_reports (fingerprint, repo, issue) values ('0123456789abcdef000000000000000000000000000000000000000000000000', 'demo-org/omni-loop', 3002);
    raise exception 'FAIL: a fingerprint was filed twice';
  exception when unique_violation then null; end;
  begin
    insert into public.omni_bug_reports (fingerprint, repo, issue) values ('fedcba9876543210000000000000000000000000000000000000000000000000', 'Demo-Org/Omni Loop', 3003);
    raise exception 'FAIL: a repository out of its shape was taken';
  exception when check_violation then null; end;
  select * into got from public.omni_bug_report_seen('0123456789abcdef000000000000000000000000000000000000000000000000');
  if got.count is distinct from 2 or got.issue is distinct from 3001 then raise exception 'FAIL: a repeat was not counted: %', row(got.*); end if;
  if exists (select 1 from public.omni_bug_report_seen('fedcba9876543210000000000000000000000000000000000000000000000000')) then
    raise exception 'FAIL: a fingerprint never filed was counted';
  end if;
end $$;

-- ── The four event kinds, a repair's key, and a repair claimed first ──
do $$
declare
  mission constant uuid := '00000000-0000-4000-8000-000002980a01';
  ws uuid := (select workspace_id from public.missions where id = mission);
  kind text;
begin
  foreach kind in array array['repair-started', 'retro', 'repair-ended', 'bug-reported'] loop
    insert into public.mission_events (mission_id, role, actor, kind, prd, sentence)
    values (mission, 'supervisor', 'agent', kind, 2981, format('A %s of cause aaaaaaaa.', kind));
  end loop;
  begin
    insert into public.mission_events (mission_id, role, actor, kind, sentence) values (mission, 'supervisor', 'agent', 'repaired', 'x');
    raise exception 'FAIL: an event kind off the list was taken';
  exception when check_violation then null; end;

  insert into public.runners (id, workspace_id, owner, name, fleet, slots, repos, github_app, last_seen_at)
  values ('00000000-0000-4000-8000-000002980c01', ws, '00000000-0000-4000-8000-0000000298a1', 'box-repair', null, 4, '{initech/nimbus-plan}', true, now());
  insert into public.runner_jobs (id, workspace_id, line, repo, sent_by_app, mission_id, mission_key, queued_at) values
    ('00000000-0000-4000-8000-000002980b11', ws, '/omni:yolo 2982', 'initech/nimbus-plan', 'omni-app', mission,
     format('mission:%s:prd:2982:run:1', mission), now() - interval '1 hour'),
    ('00000000-0000-4000-8000-000002980b12', ws, '/omni:repair --mission 2980 --prd 2981', 'initech/nimbus-plan', 'omni-app', mission,
     format('mission:%s:prd:2981:repair:1', mission), now());
  begin
    insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, mission_id, mission_key)
    values (ws, '/omni:repair', 'initech/nimbus-plan', 'omni-app', mission, format('mission:%s:prd:2981:repair:0', mission));
    raise exception 'FAIL: a repair key numbered 0 was taken';
  exception when check_violation then null; end;
  if (select id from public.runner_claim('00000000-0000-4000-8000-000002980c01')) is distinct from '00000000-0000-4000-8000-000002980b12' then
    raise exception 'FAIL: the runner did not claim the repair before a fresh job queued an hour earlier';
  end if;
  if (select id from public.runner_claim('00000000-0000-4000-8000-000002980c01')) is distinct from '00000000-0000-4000-8000-000002980b11' then
    raise exception 'FAIL: the runner did not claim the fresh job after the repair';
  end if;
end $$;

-- ── A mission's deletion takes its repairs ──
do $$
begin
  if (select count(*) from public.mission_repairs) <> 10 then raise exception 'FAIL: the service role does not read the 10 repairs'; end if;
end $$;
reset role;
delete from public.missions where id = '00000000-0000-4000-8000-000002980a01';
do $$
begin
  if exists (select 1 from public.mission_repairs) then raise exception 'FAIL: a mission''s repairs outlived it'; end if;
end $$;

-- ── repair is the loop's own skill ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000298a1');
do $$
declare
  h text;
begin
  perform public.set_repository_runner_skill((select id from public.workspaces where slug = 'initech'), 'initech/nimbus-plan', 'repair', true);
  raise exception 'FAIL: a repository allowed its own skill named repair';
exception when invalid_parameter_value then
  get stacked diagnostics h = pg_exception_hint;
  if h is distinct from 'skill' then raise exception 'FAIL: a skill named repair was refused for % instead of its skill', h; end if;
end $$;

-- ── The Engineer repairs: a new one lists it, one made before takes it while its skills are still the default ──
do $$
declare
  ws uuid := (select id from public.workspaces where slug = 'initech');
begin
  perform public.create_virtual_fleet(ws, 'Night Fix', 'beaver', array['engineer']);
  perform public.create_virtual_fleet(ws, 'Day Fix', 'octopod', array['engineer']);
  if (select h.skills[array_upper(h.skills, 1)] from public.virtual_heroes h where h.fleet = 'night-fix' and h.role = 'engineer') <> 'repair' then
    raise exception 'FAIL: a new Engineer does not list repair last';
  end if;
end $$;
reset role;
update public.virtual_heroes h
   set skills = case h.fleet when 'night-fix'
                  then array['yolo', 'yolo-fix', 'wave', 'do-work', 'pr-care', 'bug-fix', 'mega-bug-fix', 'ultra-yolo', 'ultra-yolo-fix', 'ultra-wave', 'mega-pr-care', 'drive', 'mega-drive']
                  else array['yolo', 'bug-fix'] end
 where h.fleet in ('night-fix', 'day-fix');

-- Run again: its tables, kept, say so; nothing else does.
set local client_min_messages = warning;
\ir ../migrations/20270125140000_mission_repairs.sql
reset client_min_messages;

do $$
begin
  if (select h.skills from public.virtual_heroes h where h.fleet = 'night-fix' and h.role = 'engineer')
     <> array['yolo', 'yolo-fix', 'wave', 'do-work', 'pr-care', 'bug-fix', 'mega-bug-fix', 'ultra-yolo', 'ultra-yolo-fix', 'ultra-wave', 'mega-pr-care', 'drive', 'mega-drive', 'repair'] then
    raise exception 'FAIL: an Engineer made before, still on its default, did not take repair';
  end if;
  if (select h.skills from public.virtual_heroes h where h.fleet = 'day-fix' and h.role = 'engineer') <> array['yolo', 'bug-fix'] then
    raise exception 'FAIL: an Engineer whose skills a person changed did not keep them';
  end if;
end $$;

rollback;
