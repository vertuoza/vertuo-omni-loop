-- Who may read and write the loops (PRD 1139). The supabase workflow runs it on every pull request,
-- after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/loops.sql
-- Accounts each with its own JWT. loop_push() opens a loop as its caller, in the workspace the
-- repository belongs to for them, with plan version 1; refuses a second running loop of the caller on
-- that repository, naming the first, and takes over a silent one only when asked; appends a tick to the
-- ledger and moves the next wake; adds a plan version when a tick replanned; records a parked PRD; and
-- stops the loop, parked when PRDs still wait on people. Another account cannot push to the loop, and
-- nobody signed in writes the three tables directly. A member of the workspace reads the loop, its
-- ticks and its plans; an account of another workspace, of none, or signed out, nothing. One
-- transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
-- Ada and Bob belong to Vertuoza; Carl to Acme, which owns the GitHub organisation acme; Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme', 'Acme', 'acme');
insert into public.workspace_members (workspace_id, user_id)
select w.id, m.user_id
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000000000a1'::uuid),
         ('vertuoza', '00000000-0000-4000-8000-0000000000b1'::uuid),
         ('acme',     '00000000-0000-4000-8000-0000000000c1'::uuid)
       ) as m (slug, user_id)
  join public.workspaces w on w.slug = m.slug;

-- Act as a signed-in account for the rest of the transaction: the claims of its access token.
create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- The loop ids the steps below share, kept outside the roles' reach.
create table pg_temp.ids (name text primary key, id uuid);
grant all on pg_temp.ids to authenticated;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.loops limit 1; raise exception 'FAIL: anon read the loops';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.loop_ticks limit 1; raise exception 'FAIL: anon read the loop ticks';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.loop_plans limit 1; raise exception 'FAIL: anon read the loop plans';
  exception when insufficient_privilege then null; end;
  begin perform public.loop_push('start', null, '{"repo": "vertuoza/vertuo-omni-loop", "prds": [7], "plan": {}}'); raise exception 'FAIL: anon started a loop';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada's loop: started, ticked, replanned, parked, stopped ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  ws     uuid := (select id from public.workspaces where slug = 'vertuoza');
  answer jsonb;
  loop_a uuid;
begin
  answer := public.loop_push('start', null, '{"repo": "Vertuoza/Vertuo-Omni-Loop", "prds": [7, 9], "plan": {"steps": [{"prd": 7, "slice": "s1"}]}}');
  loop_a := (answer ->> 'loopId')::uuid;
  insert into pg_temp.ids values ('a', loop_a);
  if answer ->> 'state' <> 'running' or (answer ->> 'planVersion')::integer <> 1 then
    raise exception 'FAIL: a start did not answer the running loop with plan version 1: %', answer;
  end if;
  if not exists (
    select 1 from public.loops
     where id = loop_a and user_id = '00000000-0000-4000-8000-0000000000a1' and workspace_id = ws
       and repo = 'vertuoza/vertuo-omni-loop' and prds = '{7,9}' and state = 'running' and parked = '[]'
       and next_wake_at is null and stopped_at is null) then
    raise exception 'FAIL: a loop was not stored as its owner''s, in the repository''s workspace, running';
  end if;
  if not exists (select 1 from public.loop_plans where loop_id = loop_a and version = 1 and reason = 'the first plan' and plan -> 'steps' -> 0 ->> 'slice' = 's1') then
    raise exception 'FAIL: the start did not keep the plan as version 1';
  end if;

  -- A second start on the same repository is refused, naming the first.
  begin
    perform public.loop_push('start', null, '{"repo": "vertuoza/vertuo-omni-loop", "prds": [7], "plan": {}}');
    raise exception 'FAIL: a second running loop on the same repository was opened';
  exception when object_not_in_prerequisite_state then
    if sqlerrm not like '%' || loop_a::text || '%' then raise exception 'FAIL: the refusal did not name the running loop: %', sqlerrm; end if;
  end;
  begin
    perform public.loop_push('start', null, '{"repo": "vertuoza/vertuo-omni-loop", "prds": [7], "plan": {}, "takeOver": true}');
    raise exception 'FAIL: a loop that is not silent was taken over';
  exception when object_not_in_prerequisite_state then null; end;

  -- A tick: one ledger row, the next wake moved.
  answer := public.loop_push('tick', loop_a, jsonb_build_object(
    'step', 1, 'steps', 4, 'prd', 7, 'action', 'wave', 'result', 'wave 1 merged',
    'link', 'https://omni.example/prd/7', 'merged', jsonb_build_array(101, 102), 'items', jsonb_build_array('7-s1-a'),
    'nextWakeAt', now() + interval '90 seconds'));
  if (answer ->> 'planVersion')::integer <> 1 then raise exception 'FAIL: a tick without a replan moved the plan version'; end if;
  if not exists (select 1 from public.loop_ticks where loop_id = loop_a and step = 1 and steps = 4 and prd = 7 and action = 'wave'
                   and merged = '{101,102}' and items = '{7-s1-a}' and link = 'https://omni.example/prd/7') then
    raise exception 'FAIL: the tick was not appended to the ledger';
  end if;
  if not exists (select 1 from public.loops where id = loop_a and last_tick_at is not null and next_wake_at = now() + interval '90 seconds') then
    raise exception 'FAIL: the tick did not move the next wake';
  end if;

  -- A tick that replanned adds version 2, with its reason.
  answer := public.loop_push('tick', loop_a, jsonb_build_object(
    'step', 2, 'steps', 5, 'prd', 9, 'action', 'wait', 'result', 'CI running', 'nextWakeAt', now() + interval '5 minutes',
    'replan', jsonb_build_object('reason', 's4 of PRD 9 stuck: 7 moves up', 'plan', jsonb_build_object('steps', jsonb_build_array()))));
  if (answer ->> 'planVersion')::integer <> 2
     or not exists (select 1 from public.loop_plans where loop_id = loop_a and version = 2 and reason = 's4 of PRD 9 stuck: 7 moves up') then
    raise exception 'FAIL: a replanned tick did not add plan version 2 with its reason';
  end if;

  -- Malformed pushes are refused.
  begin perform public.loop_push('pause', loop_a, '{}'); raise exception 'FAIL: an unknown event was taken';
  exception when invalid_parameter_value then null; end;
  begin perform public.loop_push('tick', loop_a, '{"step": 1, "steps": 4, "prd": 7, "action": "wave"}'); raise exception 'FAIL: a tick without a result was taken';
  exception when invalid_parameter_value then null; end;
  begin perform public.loop_push('tick', loop_a, '{"step": 5, "steps": 4, "prd": 7, "action": "wave", "result": "x"}'); raise exception 'FAIL: a step past the plan''s end was taken';
  exception when invalid_parameter_value then null; end;
  begin perform public.loop_push('start', null, '{"repo": "widgets", "prds": [7], "plan": {}}'); raise exception 'FAIL: a repository not owner/name was taken';
  exception when invalid_parameter_value then null; end;
  begin perform public.loop_push('start', null, '{"repo": "vertuoza/other", "prds": [], "plan": {}}'); raise exception 'FAIL: a loop driving no PRD was taken';
  exception when invalid_parameter_value then null; end;
  begin perform public.loop_push('tick', '00000000-0000-4000-8000-00000000dead', '{}'); raise exception 'FAIL: a push to no loop was taken';
  exception when no_data_found then null; end;

  -- Park PRD 9 on a person, then stop: the loop ends parked.
  perform public.loop_push('park', loop_a, '{"prd": 9, "who": "Pierre", "what": "the outbox questions", "link": "https://github.com/vertuoza/vertuo-omni-loop/pull/9"}');
  if not exists (select 1 from public.loops where id = loop_a and parked -> 0 ->> 'who' = 'Pierre' and (parked -> 0 ->> 'prd')::integer = 9) then
    raise exception 'FAIL: the parked PRD was not recorded';
  end if;
  answer := public.loop_push('stop', loop_a, '{}');
  if answer ->> 'state' <> 'parked' or not exists (select 1 from public.loops where id = loop_a and state = 'parked' and stopped_at is not null) then
    raise exception 'FAIL: a loop stopped with a parked PRD did not end parked';
  end if;
  begin perform public.loop_push('tick', loop_a, '{"step": 3, "steps": 5, "prd": 7, "action": "wave", "result": "x"}'); raise exception 'FAIL: a stopped loop took a tick';
  exception when object_not_in_prerequisite_state then null; end;

  -- A loop whose parked PRD moved again stops stopped.
  answer := public.loop_push('start', null, '{"repo": "vertuoza/vertuo-omni-loop", "prds": [7], "plan": {}}');
  insert into pg_temp.ids values ('b', (answer ->> 'loopId')::uuid);
  perform public.loop_push('park', (answer ->> 'loopId')::uuid, '{"prd": 7, "who": "Pierre", "what": "phase-0"}');
  perform public.loop_push('tick', (answer ->> 'loopId')::uuid, '{"step": 1, "steps": 1, "prd": 7, "action": "yolo", "result": "ready", "nextWakeAt": null}');
  if (public.loop_push('stop', (answer ->> 'loopId')::uuid, '{}') ->> 'state') <> 'stopped' then
    raise exception 'FAIL: a loop with nothing parked did not end stopped';
  end if;

  -- Nothing is written but through the function.
  begin
    insert into public.loops (user_id, workspace_id, repo, prds) values ('00000000-0000-4000-8000-0000000000a1', ws, 'vertuoza/planted', '{1}');
    raise exception 'FAIL: a signed-in account wrote a loop directly';
  exception when insufficient_privilege then null; end;
  begin
    update public.loops set state = 'running' where id = loop_a;
    raise exception 'FAIL: a signed-in account changed a loop directly';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.loop_ticks (loop_id, step, steps, prd, action, result) values (loop_a, 1, 1, 7, 'wave', 'planted');
    raise exception 'FAIL: a signed-in account wrote a tick directly';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.loop_plans where loop_id = loop_a;
    raise exception 'FAIL: a signed-in account deleted a plan directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── A silent loop: refused without a take-over, taken over with one ──
-- Its session died: its next wake is long past (set as the database owner, which no account can do).
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
begin
  insert into pg_temp.ids values ('silent', (public.loop_push('start', null, '{"repo": "vertuoza/vertuo-omni-loop", "prds": [7], "plan": {}}') ->> 'loopId')::uuid);
end $$;
reset role;
update public.loops set next_wake_at = now() - interval '6 minutes' where id = (select id from pg_temp.ids where name = 'silent');
set local role authenticated;
do $$
declare
  silent uuid := (select id from pg_temp.ids where name = 'silent');
  taken  uuid;
begin
  begin
    perform public.loop_push('start', null, '{"repo": "vertuoza/vertuo-omni-loop", "prds": [7], "plan": {}}');
    raise exception 'FAIL: a silent loop was replaced without a take-over';
  exception when object_not_in_prerequisite_state then
    if sqlerrm not like '%' || silent::text || '%' then raise exception 'FAIL: the refusal did not name the silent loop: %', sqlerrm; end if;
  end;
  taken := (public.loop_push('start', null, '{"repo": "vertuoza/vertuo-omni-loop", "prds": [7], "plan": {}, "takeOver": true}') ->> 'loopId')::uuid;
  if taken = silent or not exists (select 1 from public.loops where id = silent and state = 'stopped')
     or not exists (select 1 from public.loops where id = taken and state = 'running') then
    raise exception 'FAIL: the take-over did not stop the silent loop and open a new one';
  end if;
  insert into pg_temp.ids values ('taken', taken);
end $$;
reset role;

-- ── Bob, of the same workspace: reads Ada's loops, cannot push to them ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com');
do $$
declare
  loop_a uuid := (select id from pg_temp.ids where name = 'a');
  taken  uuid := (select id from pg_temp.ids where name = 'taken');
begin
  if not exists (select 1 from public.loops where id = loop_a)
     or (select count(*) from public.loop_ticks where loop_id = loop_a) <> 2
     or (select count(*) from public.loop_plans where loop_id = loop_a) <> 2 then
    raise exception 'FAIL: a member of the workspace did not read the loop, its ticks and its plans';
  end if;
  begin
    perform public.loop_push('stop', taken, '{}');
    raise exception 'FAIL: another account stopped Ada''s loop';
  exception when insufficient_privilege then null; end;
  -- His own loop on the same repository is his: one running loop per person, not per repository.
  perform public.loop_push('start', null, '{"repo": "vertuoza/vertuo-omni-loop", "prds": [7], "plan": {}}');
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.loops where id = (select id from pg_temp.ids where name = 'taken') and state = 'running') then
    raise exception 'FAIL: a refused push changed Ada''s loop';
  end if;
end $$;

-- ── Carl, of another workspace, and Eve, of none: read nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
begin
  if exists (select 1 from public.loops) or exists (select 1 from public.loop_ticks) or exists (select 1 from public.loop_plans) then
    raise exception 'FAIL: an account of another workspace read a loop';
  end if;
  begin
    perform public.loop_push('tick', (select id from pg_temp.ids where name = 'taken'), '{"step": 1, "steps": 1, "prd": 7, "action": "wave", "result": "x"}');
    raise exception 'FAIL: an account of another workspace pushed to Ada''s loop';
  exception when insufficient_privilege then null; end;
  begin
    perform public.loop_push('start', null, '{"repo": "vertuoza/vertuo-omni-loop", "prds": [7], "plan": {}}');
    raise exception 'FAIL: an account of another workspace started a loop on its repository';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
do $$
begin
  if exists (select 1 from public.loops) then raise exception 'FAIL: an account in no workspace read a loop'; end if;
  begin
    perform public.loop_push('start', null, '{"repo": "vertuoza/vertuo-omni-loop", "prds": [7], "plan": {}}');
    raise exception 'FAIL: an account in no workspace started a loop';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select 'loops checks passed' as result;
rollback;
