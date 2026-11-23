-- A mission stores a product PRD (PRD omni-loop-21 s3b). The supabase workflow runs it on every pull request, after
-- `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/mission_product_prd.sql
-- A mission's events, decisions and repairs name a PRD by its number or by a product PRD's id, never both, and read it back as
-- text either way (`2896`, `omni-loop-15`), the rows written before as their number; nobody writes that text. A run's step, a
-- committee's job and a repair's take a product PRD's id in their key, each once, read as their step, and a product PRD's repair
-- is claimed first in line; a key whose PRD is no product id is refused. The service role records an item's decision on a product
-- PRD through mission_decide_item() once, as on a number; a PRD named both ways, or neither, is refused, and so is anyone signed
-- in. What was kept is never changed. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000023a1', 'ada@example.com');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, '00000000-0000-4000-8000-0000000023a1', 'owner' from public.workspaces w where w.slug = 'initech';

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.verdicts() returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('role', 'pm', 'answer', 'yes', 'sentence', 'In scope.'),
                           jsonb_build_object('role', 'architect', 'answer', 'yes', 'sentence', 'Reversible.'),
                           jsonb_build_object('role', 'reviewer', 'answer', 'yes', 'sentence', 'Tested.'));
$$;
grant execute on function pg_temp.verdicts() to authenticated, service_role;

-- Mission 23 at `alone`, on Initech's fleet beaver, a repository PRD and a product PRD in its scope.
insert into public.missions (id, workspace_id, repo, fleet, number, title, goal, scope, mandate, status)
select '00000000-0000-4000-8000-0000000023b1', w.id, 'initech/nimbus-plan', 'beaver', 23, 'Products', 'The fleet takes the products.',
       '{"prds": [2896, "omni-loop-15"], "roadmaps": []}', '{"parallel": 2, "level": "alone"}', 'running'
  from public.workspaces w where w.slug = 'initech';

-- A repository PRD's event, written as before.
insert into public.mission_events (mission_id, at, role, actor, kind, prd, sentence)
values ('00000000-0000-4000-8000-0000000023b1', now(), 'supervisor', 'agent', 'prd-joined', 2896, '2896 joined the mission branch.');

-- ── Events, decisions and repairs name a product PRD ──
do $$
declare
  m uuid := '00000000-0000-4000-8000-0000000023b1';
  got text;
begin
  insert into public.mission_events (mission_id, at, role, actor, kind, product_prd, sentence)
  values (m, now(), 'supervisor', 'agent', 'prd-joined', 'omni-loop-15', 'omni-loop-15 joined the mission branch.');
  select string_agg(e.prd_id, ' ' order by e.product_prd nulls first) into got from public.mission_events e where e.mission_id = m and e.kind = 'prd-joined';
  if got is distinct from '2896 omni-loop-15' then raise exception 'FAIL: the joins read their PRDs as %', got; end if;

  begin
    insert into public.mission_events (mission_id, at, role, actor, kind, prd, product_prd, sentence)
    values (m, now(), 'supervisor', 'agent', 'prd-joined', 2896, 'omni-loop-15', 'Both.');
    raise exception 'FAIL: an event named its PRD both ways';
  exception when check_violation then null; end;
  begin
    insert into public.mission_events (mission_id, at, role, actor, kind, product_prd, sentence)
    values (m, now(), 'supervisor', 'agent', 'prd-joined', 'omni-loop-R3', 'A roadmap.');
    raise exception 'FAIL: an event took a roadmap''s id for its PRD';
  exception when check_violation then null; end;
  begin
    insert into public.mission_events (mission_id, at, role, actor, kind, prd_id, sentence)
    values (m, now(), 'supervisor', 'agent', 'prd-joined', '2897', 'Written by hand.');
    raise exception 'FAIL: an event''s PRD text was written';
  exception when generated_always then null; end;

  insert into public.mission_repairs (mission_id, product_prd, fingerprint, failed_job_id)
  values (m, 'omni-loop-15', repeat('a', 64), gen_random_uuid());
  if (select r.prd_id from public.mission_repairs r where r.mission_id = m) is distinct from 'omni-loop-15' then
    raise exception 'FAIL: a product PRD''s repair does not read its PRD';
  end if;
  begin
    insert into public.mission_repairs (mission_id, fingerprint, failed_job_id) values (m, repeat('b', 64), gen_random_uuid());
    raise exception 'FAIL: a repair that is not stuck named no PRD';
  exception when check_violation then null; end;
  begin
    update public.mission_repairs set product_prd = 'omni-loop-16' where mission_id = m;
    raise exception 'FAIL: a repair''s product PRD was changed';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.mission_decisions (mission_id, kind, item, job_id, verdicts, why, outcome)
    values (m, 'answer', 'omni-loop-15-s1-09', gen_random_uuid(), pg_temp.verdicts(), '[]', 'carried');
    raise exception 'FAIL: a decision named no PRD';
  exception when check_violation then null; end;
  begin
    insert into public.mission_decisions (mission_id, prd, product_prd, kind, item, job_id, verdicts, why, outcome)
    values (m, 2896, 'omni-loop-15', 'answer', 'omni-loop-15-s1-09', gen_random_uuid(), pg_temp.verdicts(), '[]', 'carried');
    raise exception 'FAIL: a decision named its PRD both ways';
  exception when check_violation then null; end;
end $$;

-- ── A job's key names a product PRD ──
do $$
declare
  ws uuid := (select id from public.workspaces where slug = 'initech');
  m uuid := '00000000-0000-4000-8000-0000000023b1';
  key text;
begin
  foreach key in array array[
    format('mission:%s:prd:omni-loop-15:run:1', m), format('mission:%s:prd:omni-loop-15:run:1:review:1:resume:2', m),
    format('mission:%s:prd:omni-loop-15:approve:1', m), format('mission:%s:prd:web-app-v2-7:repair:1', m),
    format('mission:%s:prd:2896:run:1', m)] loop
    insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, to_fleet, mission_id, mission_key)
    values (ws, '/omni:ultra-yolo omni-loop-15', 'initech/nimbus-plan', 'omni-app', 'beaver', m, key);
  end loop;
  begin
    insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, mission_id, mission_key)
    values (ws, '/omni:ultra-yolo omni-loop-15', 'initech/nimbus-plan', 'omni-app', m, format('mission:%s:prd:omni-loop-15:run:1', m));
    raise exception 'FAIL: a product PRD''s step was sent twice';
  exception when unique_violation then null; end;
  foreach key in array array[
    format('mission:%s:prd:omni-loop-R3:run:1', m), format('mission:%s:prd:Omni-loop-15:run:1', m),
    format('mission:%s:prd:omni-loop:run:1', m), format('mission:%s:prd:omni-loop-0:run:1', m),
    format('mission:%s:prd:omni-loop-15:repair:1:resume:1', m)] loop
    begin
      insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, mission_id, mission_key)
      values (ws, '/omni:ultra-yolo omni-loop-15', 'initech/nimbus-plan', 'omni-app', m, key);
      raise exception 'FAIL: a job took the mission key %', key;
    exception when check_violation then null; end;
  end loop;
  if public.mission_job_role(format('mission:%s:prd:omni-loop-15:run:1:review:1', m)) <> 'reviewer'
     or public.mission_job_role(format('mission:%s:prd:omni-loop-15:approve:1', m)) <> 'architect'
     or public.mission_job_role(format('mission:%s:prd:omni-loop-15:run:1', m)) <> 'engineer' then
    raise exception 'FAIL: a product PRD''s job is not read as its step';
  end if;
end $$;

-- A product PRD's repair is claimed before a fresh job queued before it.
set local role service_role;
do $$
declare
  ws uuid := (select id from public.workspaces where slug = 'initech');
  m uuid := '00000000-0000-4000-8000-0000000023b1';
begin
  insert into public.runners (id, workspace_id, owner, name, fleet, slots, repos, github_app, last_seen_at)
  values ('00000000-0000-4000-8000-0000000023e1', ws, '00000000-0000-4000-8000-0000000023a1', 'box-products', null, 4, '{initech/nimbus-api}', true, now());
  insert into public.runner_jobs (id, workspace_id, line, repo, sent_by_app, mission_id, mission_key, queued_at) values
    ('00000000-0000-4000-8000-0000000023c1', ws, '/omni:ultra-yolo omni-loop-15', 'initech/nimbus-api', 'omni-app', m,
     format('mission:%s:prd:omni-loop-15:run:2', m), now() - interval '2 hours'),
    ('00000000-0000-4000-8000-0000000023c2', ws, '/omni:repair --mission 23 --prd omni-loop-15', 'initech/nimbus-api', 'omni-app', m,
     format('mission:%s:prd:omni-loop-15:repair:1', m), now());
  if (select id from public.runner_claim('00000000-0000-4000-8000-0000000023e1')) is distinct from '00000000-0000-4000-8000-0000000023c2' then
    raise exception 'FAIL: the runner did not claim a product PRD''s repair before a fresh job queued earlier';
  end if;
end $$;
reset role;

-- ── An item's decision on a product PRD ──
do $$
declare
  ws uuid := (select id from public.workspaces where slug = 'initech');
begin
  insert into public.runner_jobs (id, workspace_id, line, repo, sent_by_app, to_fleet, mission_id) values
    ('00000000-0000-4000-8000-0000000023d1', ws, '/omni:committee omni-loop-15 --item omni-loop-15-s1-01 --bound 0.6', 'initech/nimbus-plan', 'omni-app', 'beaver', '00000000-0000-4000-8000-0000000023b1'),
    ('00000000-0000-4000-8000-0000000023d2', ws, '/omni:committee 2896 --item 2896-s1-01 --bound 0.6', 'initech/nimbus-plan', 'omni-app', 'beaver', '00000000-0000-4000-8000-0000000023b1'),
    ('00000000-0000-4000-8000-0000000023d3', ws, '/omni:committee omni-loop-15 --item omni-loop-15-s1-01 --bound 0.6', 'initech/nimbus-plan', 'omni-app', 'beaver', '00000000-0000-4000-8000-0000000023b1');
end $$;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000023a1');
do $$
begin
  begin
    perform public.mission_decide_item('00000000-0000-4000-8000-0000000023b1', 'omni-loop-15'::text, '00000000-0000-4000-8000-0000000023d1',
                                       'omni-loop-15-s1-01', pg_temp.verdicts(), 'carried', '[]', null);
    raise exception 'FAIL: a member recorded a product PRD''s item decision';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role service_role;
do $$
declare
  got jsonb;
  again jsonb;
begin
  got := public.mission_decide_item('00000000-0000-4000-8000-0000000023b1', 'omni-loop-15'::text, '00000000-0000-4000-8000-0000000023d1',
                                    'omni-loop-15-s1-01', pg_temp.verdicts(), 'deferred', '["the Reviewer answered no: Tested."]', 'A');
  if got ->> 'outcome' <> 'deferred' or got ->> 'option' <> 'A' then raise exception 'FAIL: a product PRD''s item was recorded as %', got; end if;
  again := public.mission_decide_item('00000000-0000-4000-8000-0000000023b1', 'omni-loop-15'::text, '00000000-0000-4000-8000-0000000023d1',
                                      'omni-loop-15-s1-01', pg_temp.verdicts(), 'carried', '[]', null);
  if again <> got then raise exception 'FAIL: a replayed product PRD decision was recorded again'; end if;
  if (select d.prd_id || ' ' || coalesce(d.prd::text, '-') from public.mission_decisions d where d.job_id = '00000000-0000-4000-8000-0000000023d1')
     is distinct from 'omni-loop-15 -' then
    raise exception 'FAIL: a product PRD''s decision was not kept under its id';
  end if;

  -- A repository PRD's, as before.
  got := public.mission_decide_item('00000000-0000-4000-8000-0000000023b1', 2896, '00000000-0000-4000-8000-0000000023d2',
                                    '2896-s1-01', pg_temp.verdicts(), 'carried', '[]', null);
  if (select d.prd_id || ' ' || d.prd::text from public.mission_decisions d where d.job_id = '00000000-0000-4000-8000-0000000023d2')
     is distinct from '2896 2896' then
    raise exception 'FAIL: a repository PRD''s decision does not read its number as text';
  end if;

  -- A product PRD's committee job is no committee of another PRD; a roadmap's id is no PRD.
  begin
    perform public.mission_decide_item('00000000-0000-4000-8000-0000000023b1', 'omni-loop-16'::text, '00000000-0000-4000-8000-0000000023d3',
                                       'omni-loop-15-s1-01', pg_temp.verdicts(), 'carried', '[]', null);
    raise exception 'FAIL: a committee job of another PRD was taken';
  exception when no_data_found then null; end;
  begin
    perform public.mission_decide_item('00000000-0000-4000-8000-0000000023b1', 'omni-loop-R3'::text, gen_random_uuid(),
                                       'omni-loop-15-s1-02', pg_temp.verdicts(), 'carried', '[]', null);
    raise exception 'FAIL: a roadmap''s id was taken for a PRD';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;

-- What was kept never changes.
do $$
begin
  begin
    update public.mission_decisions set product_prd = 'omni-loop-16' where job_id = '00000000-0000-4000-8000-0000000023d1';
    raise exception 'FAIL: a decision''s product PRD was changed';
  exception when insufficient_privilege then null; end;
  begin
    update public.mission_events set product_prd = 'omni-loop-16' where product_prd = 'omni-loop-15';
    raise exception 'FAIL: an event''s product PRD was changed';
  exception when insufficient_privilege then null; end;
end $$;

-- Run again: nothing changes.
set local client_min_messages = warning;
\ir ../migrations/20270129100000_mission_product_prd.sql
reset client_min_messages;

do $$
begin
  if (select count(*) from public.mission_events where prd_id is not null) <> 2
     or (select count(*) from public.mission_decisions where prd_id is not null) <> 2 then
    raise exception 'FAIL: running the migration again changed what it kept';
  end if;
end $$;

rollback;
