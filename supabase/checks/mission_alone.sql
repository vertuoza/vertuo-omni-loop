-- What a mission at `alone` keeps for a product roadmap (PRD omni-loop-21 s3). The supabase workflow runs it on every pull
-- request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/mission_alone.sql
-- A scope takes a product's PRD and roadmap ids beside a repository's numbers, and still refuses a number written as text, a
-- key that is no product key, a PRD id among the roadmaps and the other way round; a mandate takes `resumes` 0 to 10 only. A
-- mission's branch is kept once per repository by the service role, never changed or deleted but with its mission, read by a
-- member of its workspace only, written by nobody signed in. A step, a committee's and a PM's job take `:resume:1` to
-- `:resume:10`, each once, read as the step they resume; no other key takes one. The service role records an item's decision
-- once, through mission_decide_item() alone: carried (with the cases it was on), deferred with its option, or escalated; a
-- mission not at `alone` escalates it; a deferred approval, a deferred decision with no option, and anyone signed in are
-- refused. A mission event may be `deferred`. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000021a1', 'ada@example.com'),
  ('00000000-0000-4000-8000-0000000021c1', 'carl@acme.test');
-- Ada owns Initech; Carl belongs to Acme.
insert into public.workspaces (slug, name, github_org) values ('acme-alone', 'Acme', 'acme-alone');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('initech',    '00000000-0000-4000-8000-0000000021a1'::uuid, 'owner'),
         ('acme-alone', '00000000-0000-4000-8000-0000000021c1'::uuid, 'member')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ── The scope takes products, the mandate resumes ──
do $$
declare
  good jsonb;
  bad jsonb;
begin
  foreach good in array array[
    '{"prds": [2896, "omni-loop-15"], "roadmaps": ["omni-loop-R3"]}',
    '{"prds": [], "roadmaps": ["omni-loop-R3", 40]}',
    '{"prds": ["mobile-12", "web-app-v2-7"], "roadmaps": []}',
    '{"prds": ["mobile-2147483647"], "roadmaps": []}']::jsonb[] loop
    if not public.mission_scope_ok(good) then raise exception 'FAIL: the scope % was refused', good; end if;
  end loop;
  foreach bad in array array[
    '{"prds": ["2803"], "roadmaps": []}',
    '{"prds": ["omni-loop"], "roadmaps": []}',
    '{"prds": [], "roadmaps": ["omni-loop-R"]}',
    '{"prds": ["omni-loop-R3"], "roadmaps": []}',
    '{"prds": [], "roadmaps": ["omni-loop-15"]}',
    '{"prds": ["Omni-loop-15"], "roadmaps": []}',
    '{"prds": ["omni-loop-0"], "roadmaps": []}',
    '{"prds": ["mobile-2147483648"], "roadmaps": []}',
    '{"prds": ["1mobile-12"], "roadmaps": []}',
    '{"prds": ["mobile-2-12"], "roadmaps": []}',
    '{"prds": ["omni-loop-15", "omni-loop-15"], "roadmaps": []}',
    '{"prds": [true], "roadmaps": []}',
    '{"prds": [], "roadmaps": []}']::jsonb[] loop
    if public.mission_scope_ok(bad) then raise exception 'FAIL: the scope % was taken', bad; end if;
  end loop;
  if public.mission_scope_ok(jsonb_build_object('prds', jsonb_build_array(repeat('a', 41) || '-1'), 'roadmaps', '[]'::jsonb)) then
    raise exception 'FAIL: a product key over 40 characters was taken';
  end if;
  if not public.mission_scope_ok(jsonb_build_object('prds', jsonb_build_array(repeat('a', 40) || '-1'), 'roadmaps', '[]'::jsonb)) then
    raise exception 'FAIL: a product key of 40 characters was refused';
  end if;

  foreach good in array array['{"parallel": 2, "resumes": 0}', '{"parallel": 2, "resumes": 3}', '{"parallel": 2, "resumes": 10}',
                              '{"parallel": 1, "level": "alone", "hardToRevert": 0.6, "ownPrds": 0, "resumes": 3, "tokens": 2000000}']::jsonb[] loop
    if not public.mission_mandate_ok(good) then raise exception 'FAIL: the mandate % was refused', good; end if;
  end loop;
  foreach bad in array array['{"parallel": 2, "resumes": 11}', '{"parallel": 2, "resumes": -1}', '{"parallel": 2, "resumes": 1.5}',
                             '{"parallel": 2, "resumes": "3"}', '{"parallel": 2, "resumes": null}', '{"resumes": 3}']::jsonb[] loop
    if public.mission_mandate_ok(bad) then raise exception 'FAIL: the mandate % was taken', bad; end if;
  end loop;
end $$;

-- Mission 21 at `alone` and mission 22 `with-you`, both on Initech's fleet beaver, the first with a product scope.
insert into public.missions (id, workspace_id, repo, fleet, number, title, goal, scope, mandate, status)
select v.id, w.id, 'initech/nimbus-plan', 'beaver', v.number, v.title, 'The fleet takes the roadmap.', v.scope::jsonb, v.mandate::jsonb, 'running'
  from public.workspaces w
 cross join (values
   ('00000000-0000-4000-8000-0000000021b1'::uuid, 21, 'Alone', '{"prds": [2896, "omni-loop-15"], "roadmaps": ["omni-loop-R3"]}', '{"parallel": 2, "level": "alone", "resumes": 3}'),
   ('00000000-0000-4000-8000-0000000021b2'::uuid, 22, 'With you', '{"prds": [2897], "roadmaps": []}', '{"parallel": 2}')
 ) as v (id, number, title, scope, mandate)
 where w.slug = 'initech';

-- ── A mission's branch in each repository ──
set local role service_role;
do $$
begin
  insert into public.mission_branches (mission_id, repo, branch) values
    ('00000000-0000-4000-8000-0000000021b1', 'initech/nimbus-plan', 'mission/21-alone'),
    ('00000000-0000-4000-8000-0000000021b1', 'initech/nimbus-api', 'mission/21-alone');
  begin
    insert into public.mission_branches (mission_id, repo, branch) values ('00000000-0000-4000-8000-0000000021b1', 'initech/nimbus-plan', 'mission/21-other');
    raise exception 'FAIL: a second branch was kept for one repository';
  exception when unique_violation then null; end;
  begin
    insert into public.mission_branches (mission_id, repo, branch) values ('00000000-0000-4000-8000-0000000021b1', 'Initech/Nimbus-Web', 'mission/21-alone');
    raise exception 'FAIL: a repository out of its lowercase shape was taken';
  exception when check_violation then null; end;
  begin
    insert into public.mission_branches (mission_id, repo, branch) values ('00000000-0000-4000-8000-0000000021b1', 'initech/nimbus-web', 'mission/../main');
    raise exception 'FAIL: a branch out of its shape was taken';
  exception when check_violation then null; end;
  begin
    update public.mission_branches set branch = 'main' where repo = 'initech/nimbus-plan';
    raise exception 'FAIL: the service role changed a mission branch';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.mission_branches where repo = 'initech/nimbus-plan';
    raise exception 'FAIL: the service role deleted a mission branch';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$
begin
  begin
    update public.mission_branches set branch = 'main' where repo = 'initech/nimbus-plan';
    raise exception 'FAIL: a mission branch was changed';
  exception when insufficient_privilege then null; end;
end $$;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000021a1');
do $$
begin
  if (select count(*) from public.mission_branches) <> 2 then raise exception 'FAIL: a member of the workspace does not read its two mission branches'; end if;
  begin
    insert into public.mission_branches (mission_id, repo, branch) values ('00000000-0000-4000-8000-0000000021b1', 'initech/nimbus-web', 'mission/21-alone');
    raise exception 'FAIL: a member wrote a mission branch';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000021c1');
do $$
begin
  if exists (select 1 from public.mission_branches) then raise exception 'FAIL: a member of another workspace read a mission branch'; end if;
end $$;
reset role;
set local role anon;
do $$
begin
  begin perform 1 from public.mission_branches limit 1; raise exception 'FAIL: anon read the mission branches';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── A step resumed ──
do $$
declare
  ws uuid := (select id from public.workspaces where slug = 'initech');
  m uuid := '00000000-0000-4000-8000-0000000021b1';
  key text;
begin
  foreach key in array array[
    format('mission:%s:prd:2896:run:1:resume:1', m), format('mission:%s:prd:2896:run:1:review:1:resume:2', m),
    format('mission:%s:prd:2896:run:1:qa-fix:1:3:resume:10', m), format('mission:%s:prd:2896:approve:1:resume:1', m),
    format('mission:%s:pm:2:resume:1', m)] loop
    insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, to_fleet, mission_id, mission_key)
    values (ws, '/omni:yolo 2896', 'initech/nimbus-plan', 'omni-app', 'beaver', m, key);
  end loop;
  begin
    insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, mission_id, mission_key)
    values (ws, '/omni:yolo 2896', 'initech/nimbus-plan', 'omni-app', m, format('mission:%s:prd:2896:run:1:resume:1', m));
    raise exception 'FAIL: a resume was sent twice';
  exception when unique_violation then null; end;
  foreach key in array array[
    format('mission:%s:prd:2896:run:1:resume:0', m), format('mission:%s:prd:2896:run:1:resume:11', m),
    format('mission:%s:prd:2896:repair:1:resume:1', m), format('mission:%s:stuck:1:resume:1', m),
    format('mission:%s:bug:12:run:1:resume:1', m), format('mission:%s:prd:2896:run:1:resume:1:resume:2', m)] loop
    begin
      insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, mission_id, mission_key)
      values (ws, '/omni:yolo 2896', 'initech/nimbus-plan', 'omni-app', m, key);
      raise exception 'FAIL: a job took the mission key %', key;
    exception when check_violation then null; end;
  end loop;
  if public.mission_job_role(format('mission:%s:prd:2896:run:1:resume:1', m)) <> 'engineer'
     or public.mission_job_role(format('mission:%s:prd:2896:run:1:review:2:resume:1', m)) <> 'reviewer'
     or public.mission_job_role(format('mission:%s:prd:2896:run:1:qa:1:resume:3', m)) <> 'qa'
     or public.mission_job_role(format('mission:%s:prd:2896:approve:1:resume:1', m)) <> 'architect'
     or public.mission_job_role(format('mission:%s:pm:1:resume:10', m)) <> 'pm'
     or public.mission_job_role(format('mission:%s:prd:2896:run:1', m)) <> 'engineer'
     or public.mission_job_role(null) <> 'supervisor' then
    raise exception 'FAIL: a resume is not read as the step it resumes';
  end if;
end $$;

-- ── The committee decides an item, and defers it ──
do $$
declare
  ws uuid := (select id from public.workspaces where slug = 'initech');
begin
  insert into public.runner_jobs (id, workspace_id, line, repo, sent_by_app, to_fleet, mission_id) values
    ('00000000-0000-4000-8000-0000000021d1', ws, '/omni:committee 2896 --item 2896-s1-01 --bound 0.6', 'initech/nimbus-plan', 'omni-app', 'beaver', '00000000-0000-4000-8000-0000000021b1'),
    ('00000000-0000-4000-8000-0000000021d2', ws, '/omni:committee 2896 --item 2896-s1-02 --bound 0.6', 'initech/nimbus-plan', 'omni-app', 'beaver', '00000000-0000-4000-8000-0000000021b1'),
    ('00000000-0000-4000-8000-0000000021d3', ws, '/omni:committee 2896 --item 2896-s1-03 --bound 0.6', 'initech/nimbus-plan', 'omni-app', 'beaver', '00000000-0000-4000-8000-0000000021b1'),
    ('00000000-0000-4000-8000-0000000021d4', ws, '/omni:committee 2897 --item 2897-s1-01 --bound 0.6', 'initech/nimbus-plan', 'omni-app', 'beaver', '00000000-0000-4000-8000-0000000021b2');
end $$;

create function pg_temp.verdicts(last text default 'yes') returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('role', 'pm', 'answer', 'yes', 'sentence', 'In scope.'),
                           jsonb_build_object('role', 'architect', 'answer', 'yes', 'sentence', 'Reversible.'),
                           jsonb_build_object('role', 'reviewer', 'answer', last, 'sentence', 'Tested.'));
$$;
grant execute on function pg_temp.verdicts(text) to authenticated, service_role;

-- Nobody signed in records an item's decision.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000021a1');
do $$
begin
  begin
    perform public.mission_decide_item('00000000-0000-4000-8000-0000000021b1', 2896, '00000000-0000-4000-8000-0000000021d1', '2896-s1-01',
                                       pg_temp.verdicts(), 'carried', '[]', null);
    raise exception 'FAIL: a member recorded an item''s decision';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role service_role;
do $$
declare
  got jsonb;
  again jsonb;
  h text;
begin
  -- Carried on the escalation list: every sitting member said yes, the case it was on named.
  got := public.mission_decide_item('00000000-0000-4000-8000-0000000021b1', 2896, '00000000-0000-4000-8000-0000000021d1', '2896-s1-01',
                                    pg_temp.verdicts(), 'carried', '["on the escalation list: it bears on the business law BL-ASK-1: a person decides"]', 'B');
  if got ->> 'outcome' <> 'carried' or jsonb_array_length(got -> 'why') <> 1 or got -> 'option' <> 'null'::jsonb then
    raise exception 'FAIL: a carried item was recorded as %', got;
  end if;
  -- Recorded once: a replay answers the decision kept.
  again := public.mission_decide_item('00000000-0000-4000-8000-0000000021b1', 2896, '00000000-0000-4000-8000-0000000021d1', '2896-s1-01',
                                      pg_temp.verdicts('no'), 'deferred', '["late"]', 'A');
  if again <> got or (select count(*) from public.mission_decisions where job_id = '00000000-0000-4000-8000-0000000021d1') <> 1 then
    raise exception 'FAIL: a replayed item decision was recorded again';
  end if;

  -- Deferred: a member said no, the item settled meanwhile with A.
  got := public.mission_decide_item('00000000-0000-4000-8000-0000000021b1', 2896, '00000000-0000-4000-8000-0000000021d2', '2896-s1-02',
                                    pg_temp.verdicts('no'), 'deferred', '["on the escalation list: its hard-to-revert score is unknown", "the Reviewer answered no: Tested."]', 'A');
  if got ->> 'outcome' <> 'deferred' or got ->> 'option' <> 'A' then raise exception 'FAIL: a deferred item was recorded as %', got; end if;
  if (select d.kind || ' ' || d.item from public.mission_decisions d where d.job_id = '00000000-0000-4000-8000-0000000021d2') <> 'answer 2896-s1-02' then
    raise exception 'FAIL: a deferred item was not kept as the item''s answer';
  end if;

  -- A deferred item with no option, a why left empty, an outcome off the list, a job of another item: refused.
  foreach h in array array['option', 'why', 'outcome', 'job'] loop
    begin
      perform public.mission_decide_item('00000000-0000-4000-8000-0000000021b1', 2896, '00000000-0000-4000-8000-0000000021d3',
                                         case h when 'job' then '2896-s1-09' else '2896-s1-03' end, pg_temp.verdicts('no'),
                                         case h when 'outcome' then 'maybe' else 'deferred' end,
                                         (case h when 'why' then '[]' else '["the Reviewer answered no: Tested."]' end)::jsonb,
                                         case h when 'option' then null else 'A' end);
      raise exception 'FAIL: an item decision with a bad % was taken', h;
    exception when invalid_parameter_value or no_data_found then
      if sqlstate <> (case h when 'job' then 'P0002' else '22023' end) then
        raise exception 'FAIL: an item decision with a bad % was refused as %', h, sqlstate;
      end if;
    end;
  end loop;

  -- A mission not at alone: a person answers its items, whatever the App read.
  got := public.mission_decide_item('00000000-0000-4000-8000-0000000021b2', 2897, '00000000-0000-4000-8000-0000000021d4', '2897-s1-01',
                                    pg_temp.verdicts(), 'deferred', '["the Reviewer answered no: Tested."]', 'A');
  if got ->> 'outcome' <> 'escalated' or got -> 'option' <> 'null'::jsonb
     or not (got -> 'why') @> '["the mission is not at alone: a person answers its items"]'::jsonb then
    raise exception 'FAIL: an item of a mission not at alone was recorded as %', got;
  end if;
end $$;
reset role;

-- The table holds the rules whoever writes: no deferred approval, no deferred decision without its option.
do $$
begin
  begin
    insert into public.mission_decisions (mission_id, prd, kind, job_id, verdicts, why, outcome, option)
    values ('00000000-0000-4000-8000-0000000021b1', 2896, 'approve', gen_random_uuid(), pg_temp.verdicts('no'), '["no"]', 'deferred', 'A');
    raise exception 'FAIL: an approval was deferred';
  exception when check_violation then null; end;
  begin
    insert into public.mission_decisions (mission_id, prd, kind, item, job_id, verdicts, why, outcome)
    values ('00000000-0000-4000-8000-0000000021b1', 2896, 'answer', '2896-s1-05', gen_random_uuid(), pg_temp.verdicts('no'), '["no"]', 'deferred');
    raise exception 'FAIL: a deferred item took no option';
  exception when check_violation then null; end;
  begin
    insert into public.mission_decisions (mission_id, prd, kind, item, job_id, verdicts, why, outcome)
    values ('00000000-0000-4000-8000-0000000021b1', 2896, 'answer', '2896-s1-06', gen_random_uuid(), pg_temp.verdicts('no'), '[]', 'escalated');
    raise exception 'FAIL: an escalated decision said no why';
  exception when check_violation then null; end;
  insert into public.mission_events (mission_id, at, role, actor, kind, prd, sentence)
  values ('00000000-0000-4000-8000-0000000021b1', now(), 'pm', 'agent', 'deferred', 2896, 'The fleet deferred 2896-s1-02, option A meanwhile.');
end $$;

-- Run again: nothing changes.
set local client_min_messages = warning;
\ir ../migrations/20270129090000_mission_alone_store.sql
reset client_min_messages;

do $$
begin
  if (select count(*) from public.mission_branches) <> 2 or (select count(*) from public.mission_decisions where kind = 'answer') <> 3 then
    raise exception 'FAIL: running the migration again changed what it kept';
  end if;
end $$;

rollback;
