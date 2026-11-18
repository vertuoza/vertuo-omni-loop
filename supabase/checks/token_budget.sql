-- A mission's token budget and its fleet's daily cap (PRD 3040 s2). The supabase workflow runs it on every pull request,
-- after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/token_budget.sql
-- Initech's virtual fleet night-crew runs missions 3041 and 3042; beaver, a crew, runs mission 3043. A fleet has no daily
-- cap until an owner sets one, above 0; a member who is not an owner, a member of another workspace and anon are refused,
-- and so are 0 and a negative number (AC-9). A mandate takes an optional tokens, a whole number from 1 to 10^9; a member sets
-- a draft mission's budget, an owner alone a running one's, nobody a stopped one's. What counts is input + output + cache
-- writes of each ended job: a mission's every one, a fleet's in the 24 hours up to a time, with the end of the oldest that
-- counted (AC-2, AC-3); a member reads their workspace's counts, another workspace's member 0. The service role records a
-- budget stop, unanswered, naming missions of its fleet, one open stop per cap (AC-8). A member answers it once, as
-- themselves: stopped, or tomorrow for a fleet's cap; an owner alone raises a cap above the one reached, saved with the
-- answer (AC-5). An answer is never rewritten, nothing else of a stop changes, and nobody deletes one (BR-PRODUCT-12). A
-- member reads their workspace's stops, anyone else none. A mission event may be budget-stop or budget-answer. One
-- transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000304a1', 'ada@example.com'),
  ('00000000-0000-4000-8000-0000000304b1', 'bob@example.com'),
  ('00000000-0000-4000-8000-0000000304c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000304e1', 'eve@example.com');
-- Ada owns Initech, Bob is its member; Carl owns Acme; Eve belongs to none.
insert into public.workspaces (slug, name, github_org) values ('acme-budget', 'Acme', 'acme-budget');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('initech',     '00000000-0000-4000-8000-0000000304a1'::uuid, 'owner'),
         ('initech',     '00000000-0000-4000-8000-0000000304b1'::uuid, 'member'),
         ('acme-budget', '00000000-0000-4000-8000-0000000304c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug;

-- Initech's virtual fleet night-crew, made as it was before the migration's column: no daily cap.
insert into public.teams (workspace_id, name, label, color, motto, mascot, sort, kind)
select w.id, 'night-crew', 'Night Crew', '#7a5cff', '', 'robot', 100, 'virtual' from public.workspaces w where w.slug = 'initech';

-- Missions 3041 (running) and 3042 (running) on night-crew, 3043 (running) on beaver, 3044 (draft) and 3045 (stopped) on
-- night-crew.
insert into public.missions (id, workspace_id, repo, fleet, number, title, goal, scope, status)
select m.id, w.id, 'initech/nimbus-plan', m.fleet, m.number, 'Paid online', 'Every quote can be paid online.',
       '{"prds": [3046], "roadmaps": []}'::jsonb, m.status
  from public.workspaces w,
       (values
         ('00000000-0000-4000-8000-000003041a01'::uuid, 'night-crew', 3041, 'running'),
         ('00000000-0000-4000-8000-000003042a01'::uuid, 'night-crew', 3042, 'running'),
         ('00000000-0000-4000-8000-000003043a01'::uuid, 'beaver',     3043, 'running'),
         ('00000000-0000-4000-8000-000003044a01'::uuid, 'night-crew', 3044, 'draft'),
         ('00000000-0000-4000-8000-000003045a01'::uuid, 'night-crew', 3045, 'stopped')
       ) as m (id, fleet, number, status)
 where w.slug = 'initech';

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('initech', 'acme-budget');
grant select on ids to anon, authenticated, service_role;
create function pg_temp.ws(slug text) returns uuid language sql as $$
  select i.id from ids i where i.slug = ws.slug;
$$;
-- Runs a call that must be refused for its field: SQLSTATE 22023, the field as its hint, and a message that starts with
-- `word`.
create function pg_temp.refused_for(stmt text, field text, word text) returns void language plpgsql as $$
declare
  msg text;
  h text;
begin
  execute stmt;
  raise exception 'FAIL: % was not refused for its %', stmt, field;
exception when invalid_parameter_value then
  get stacked diagnostics msg = message_text, h = pg_exception_hint;
  if h is distinct from field or msg not like word || '%' then
    raise exception 'FAIL: % was refused without naming its %: % (hint %)', stmt, field, msg, h;
  end if;
end;
$$;
-- Runs a call that must be refused to its caller.
create function pg_temp.forbidden(stmt text, who text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran for %', stmt, who;
exception when insufficient_privilege then null;
end;
$$;
-- One ended job of a mission, its tokens as given, ended `ago` before now.
create function pg_temp.job(mission uuid, tokens jsonb, ago interval) returns void language sql as $$
  insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, mission_id, status, ended_at, tokens)
  select m.workspace_id, '/omni:yolo 3046', m.repo, 'omni-app', m.id, 'cancelled', now() - ago, job.tokens from public.missions m where m.id = mission;
$$;
grant execute on function pg_temp.refused_for(text, text, text), pg_temp.forbidden(text, text), pg_temp.job(uuid, jsonb, interval)
  to anon, authenticated, service_role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.mission_budget_stops limit 1; raise exception 'FAIL: anon read the budget stops';
  exception when insufficient_privilege then null; end;
  perform pg_temp.forbidden(format('select public.set_fleet_daily_tokens(%L, ''night-crew'', 1000)', pg_temp.ws('initech')), 'anon');
  perform pg_temp.forbidden('select public.set_mission_tokens(''00000000-0000-4000-8000-000003044a01'', 1000)', 'anon');
  perform pg_temp.forbidden('select public.mission_tokens(''00000000-0000-4000-8000-000003041a01'')', 'anon');
  perform pg_temp.forbidden(format('select public.fleet_tokens_24h(%L, ''night-crew'')', pg_temp.ws('initech')), 'anon');
  perform pg_temp.forbidden('select public.answer_mission_budget_stop(gen_random_uuid(), ''stopped'')', 'anon');
end $$;
reset role;

-- ── The fleet's daily cap: none by default, an owner alone sets it, above 0 (AC-9) ──
do $$
begin
  if exists (select 1 from public.teams where daily_tokens is not null) then
    raise exception 'FAIL: a fleet made before the migration has a daily cap';
  end if;
end $$;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000304b1');
do $$
begin
  perform pg_temp.forbidden(format('select public.set_fleet_daily_tokens(%L, ''night-crew'', 2000000)', pg_temp.ws('initech')), 'a member who is not an owner');
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000304c1');
do $$
begin
  perform pg_temp.forbidden(format('select public.set_fleet_daily_tokens(%L, ''night-crew'', 2000000)', pg_temp.ws('initech')), 'another workspace''s owner');
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000304e1');
do $$
begin
  perform pg_temp.forbidden(format('select public.set_fleet_daily_tokens(%L, ''night-crew'', 2000000)', pg_temp.ws('initech')), 'an account of no workspace');
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000304a1');
do $$
declare
  v uuid := pg_temp.ws('initech');
begin
  perform pg_temp.refused_for(format('select public.set_fleet_daily_tokens(%L, ''night-crew'', 0)', v), 'daily_tokens', 'Tokens per day:');
  perform pg_temp.refused_for(format('select public.set_fleet_daily_tokens(%L, ''night-crew'', -5)', v), 'daily_tokens', 'Tokens per day:');
  perform pg_temp.refused_for(format('select public.set_fleet_daily_tokens(%L, ''beaver'', 1000)', v), 'fleet', 'Fleet:');
  perform pg_temp.refused_for(format('select public.set_fleet_daily_tokens(%L, ''nobody'', 1000)', v), 'fleet', 'Fleet:');
  if (public.set_fleet_daily_tokens(v, 'night-crew', 2000000)).daily_tokens is distinct from 2000000::bigint then
    raise exception 'FAIL: an owner could not set a fleet''s daily cap';
  end if;
  if (public.set_fleet_daily_tokens(v, 'night-crew', null)).daily_tokens is not null then
    raise exception 'FAIL: an owner could not clear a fleet''s daily cap';
  end if;
  begin
    update public.teams set daily_tokens = 1000 where name = 'night-crew';
    raise exception 'FAIL: a signed-in person wrote a fleet''s daily cap directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$
begin
  begin
    update public.teams set daily_tokens = 0 where name = 'night-crew';
    raise exception 'FAIL: a daily cap of 0 was stored';
  exception when check_violation then null; end;
end $$;

-- ── A mission's budget: the mandate's tokens ──
do $$
declare
  good jsonb;
  bad jsonb;
begin
  foreach good in array array['{"parallel": 2}', '{"parallel": 2, "tokens": 1}', '{"parallel": 2, "tokens": 1000000000}',
                              '{"parallel": 1, "level": "alone", "hardToRevert": 0.6, "ownPrds": 0, "tokens": 2000000}']::jsonb[] loop
    if not public.mission_mandate_ok(good) then raise exception 'FAIL: the mandate % was refused', good; end if;
  end loop;
  foreach bad in array array['{"parallel": 2, "tokens": 0}', '{"parallel": 2, "tokens": -1}', '{"parallel": 2, "tokens": 1.5}',
                             '{"parallel": 2, "tokens": 1000000001}', '{"parallel": 2, "tokens": "1000"}', '{"parallel": 2, "tokens": null}',
                             '{"parallel": 2, "tokens": 99999999999999999999}', '{"tokens": 1000}']::jsonb[] loop
    if public.mission_mandate_ok(bad) then raise exception 'FAIL: the mandate % was taken', bad; end if;
  end loop;
end $$;

-- A member sets a draft's budget and clears it; a started mission's is an owner's; a stopped one's is nobody's.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000304b1');
do $$
declare
  m public.missions;
begin
  m := public.set_mission_tokens('00000000-0000-4000-8000-000003044a01', 2000000);
  if m.mandate -> 'tokens' is distinct from '2000000'::jsonb or m.mandate -> 'parallel' is distinct from '2'::jsonb then
    raise exception 'FAIL: a member could not set a draft mission''s budget: %', m.mandate;
  end if;
  if (public.set_mission_tokens('00000000-0000-4000-8000-000003044a01', null)).mandate ? 'tokens' then
    raise exception 'FAIL: a member could not clear a draft mission''s budget';
  end if;
  perform pg_temp.refused_for('select public.set_mission_tokens(''00000000-0000-4000-8000-000003044a01'', 0)', 'tokens', 'Token budget:');
  perform pg_temp.refused_for('select public.set_mission_tokens(''00000000-0000-4000-8000-000003044a01'', 1000000001)', 'tokens', 'Token budget:');
  perform pg_temp.forbidden('select public.set_mission_tokens(''00000000-0000-4000-8000-000003041a01'', 1000)', 'a member, on a running mission');
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000304c1');
do $$
begin
  perform pg_temp.forbidden('select public.set_mission_tokens(''00000000-0000-4000-8000-000003044a01'', 1000)', 'another workspace''s owner');
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000304a1');
do $$
begin
  if (public.set_mission_tokens('00000000-0000-4000-8000-000003041a01', 1000)).mandate -> 'tokens' is distinct from '1000'::jsonb then
    raise exception 'FAIL: an owner could not set a running mission''s budget';
  end if;
  perform pg_temp.refused_for('select public.set_mission_tokens(''00000000-0000-4000-8000-000003045a01'', 1000)', 'status', 'Token budget:');
end $$;
reset role;

-- ── What counts: input + output + cache writes of ended jobs (AC-2, AC-3) ──
set local role service_role;
do $$
declare
  ws uuid := pg_temp.ws('initech');
  got record;
begin
  if public.job_counted_tokens(null) <> 0 then raise exception 'FAIL: a job with no tokens did not count 0'; end if;
  if public.job_counted_tokens('{"input": 600, "output": 300, "cacheRead": 5000, "cacheWrite": 200}') <> 1100 then
    raise exception 'FAIL: a job''s counted tokens are not input + output + cache writes';
  end if;
  if public.mission_tokens('00000000-0000-4000-8000-000003041a01') <> 0 then raise exception 'FAIL: a mission with no job spent something'; end if;

  -- Mission 3041: 1100 counted an hour ago, a job with no tokens, and a job still running.
  perform pg_temp.job('00000000-0000-4000-8000-000003041a01', '{"input": 600, "output": 300, "cacheRead": 5000, "cacheWrite": 200}', interval '1 hour');
  perform pg_temp.job('00000000-0000-4000-8000-000003041a01', null, interval '30 minutes');
  insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, mission_id)
  values (ws, '/omni:yolo 3046', 'initech/nimbus-plan', 'omni-app', '00000000-0000-4000-8000-000003041a01');
  update public.runner_jobs set tokens = '{"input": 90000, "output": 0, "cacheRead": 0, "cacheWrite": 0}'
   where mission_id = '00000000-0000-4000-8000-000003041a01' and ended_at is null;
  if public.mission_tokens('00000000-0000-4000-8000-000003041a01') <> 1100 then
    raise exception 'FAIL: mission 3041 spent % instead of 1100', public.mission_tokens('00000000-0000-4000-8000-000003041a01');
  end if;

  -- Mission 3042: 100 counted two hours ago, a job of cache reads alone three hours ago, 7000 counted 30 hours ago.
  perform pg_temp.job('00000000-0000-4000-8000-000003042a01', '{"input": 50, "output": 50, "cacheRead": 0, "cacheWrite": 0}', interval '2 hours');
  perform pg_temp.job('00000000-0000-4000-8000-000003042a01', '{"input": 0, "output": 0, "cacheRead": 800, "cacheWrite": 0}', interval '3 hours');
  perform pg_temp.job('00000000-0000-4000-8000-000003042a01', '{"input": 7000, "output": 0, "cacheRead": 0, "cacheWrite": 0}', interval '30 hours');
  -- Mission 3043, on beaver: never night-crew's.
  perform pg_temp.job('00000000-0000-4000-8000-000003043a01', '{"input": 4000, "output": 0, "cacheRead": 0, "cacheWrite": 0}', interval '1 hour');

  if public.mission_tokens('00000000-0000-4000-8000-000003042a01') <> 7100 then
    raise exception 'FAIL: mission 3042 did not count every ended job it sent';
  end if;
  select * into got from public.fleet_tokens_24h(ws, 'night-crew');
  if got.tokens <> 1200 then raise exception 'FAIL: night-crew spent % in 24 hours instead of 1200', got.tokens; end if;
  if got.oldest_end is null or got.oldest_end > now() - interval '2 hours' or got.oldest_end < now() - interval '2 hours 1 minute' then
    raise exception 'FAIL: the oldest counted end is % instead of two hours ago (a job of cache reads alone counts nothing)', got.oldest_end;
  end if;
  select * into got from public.fleet_tokens_24h(ws, 'night-crew', now() - interval '90 minutes');
  if got.tokens <> 100 then raise exception 'FAIL: night-crew spent % in the 24 hours up to 90 minutes ago instead of 100', got.tokens; end if;
  select * into got from public.fleet_tokens_24h(ws, 'night-crew', now() - interval '20 hours');
  if got.tokens <> 7000 then raise exception 'FAIL: the window did not reach back 24 hours from its time (%)', got.tokens; end if;
  select * into got from public.fleet_tokens_24h(ws, 'pirates');
  if got.tokens <> 0 or got.oldest_end is not null then raise exception 'FAIL: a fleet with no job spent something'; end if;
end $$;
reset role;

-- A member reads their workspace's counts; another workspace's member reads 0.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000304b1');
do $$
begin
  if public.mission_tokens('00000000-0000-4000-8000-000003041a01') <> 1100 then raise exception 'FAIL: a member did not read the mission''s count'; end if;
  if (select tokens from public.fleet_tokens_24h(pg_temp.ws('initech'), 'night-crew')) <> 1200 then
    raise exception 'FAIL: a member did not read the fleet''s count';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000304c1');
do $$
begin
  if public.mission_tokens('00000000-0000-4000-8000-000003041a01') <> 0 then raise exception 'FAIL: another workspace''s owner read a mission''s count'; end if;
  if (select tokens from public.fleet_tokens_24h(pg_temp.ws('initech'), 'night-crew')) <> 0 then
    raise exception 'FAIL: another workspace''s owner read a fleet''s count';
  end if;
end $$;
reset role;

-- ── A budget stop: recorded unanswered, of its fleet's missions, one open per cap (AC-3, AC-8) ──
create temporary table stops (name text primary key, id uuid);
grant select, insert on stops to authenticated, service_role;
set local role service_role;
do $$
declare
  ws uuid := pg_temp.ws('initech');
  made public.mission_budget_stops;
begin
  insert into public.mission_budget_stops (workspace_id, fleet, cap, mission_id, cap_tokens, spent, missions, created_at)
  values (ws, 'night-crew', 'mission', '00000000-0000-4000-8000-000003041a01', 1000, 1100, array['00000000-0000-4000-8000-000003041a01'::uuid], now() - interval '1 year')
  returning * into made;
  if made.answer is not null or made.created_at < now() - interval '1 minute' then
    raise exception 'FAIL: a stop did not start unanswered at the database''s time';
  end if;
  insert into stops values ('mission', made.id);

  begin
    insert into public.mission_budget_stops (workspace_id, fleet, cap, mission_id, cap_tokens, spent, missions)
    values (ws, 'night-crew', 'mission', '00000000-0000-4000-8000-000003041a01', 1000, 1100, array['00000000-0000-4000-8000-000003041a01'::uuid]);
    raise exception 'FAIL: a second open stop of a mission''s budget was recorded';
  exception when unique_violation then null; end;

  insert into public.mission_budget_stops (workspace_id, fleet, cap, cap_tokens, spent, missions)
  values (ws, 'night-crew', 'fleet', 1000, 1200, array['00000000-0000-4000-8000-000003041a01', '00000000-0000-4000-8000-000003042a01']::uuid[])
  returning * into made;
  insert into stops values ('fleet', made.id);
  begin
    insert into public.mission_budget_stops (workspace_id, fleet, cap, cap_tokens, spent, missions)
    values (ws, 'night-crew', 'fleet', 1000, 1300, array['00000000-0000-4000-8000-000003042a01']::uuid[]);
    raise exception 'FAIL: a second open stop of a fleet''s daily cap was recorded';
  exception when unique_violation then null; end;

  begin
    insert into public.mission_budget_stops (workspace_id, fleet, cap, cap_tokens, spent, missions)
    values (ws, 'beaver', 'fleet', 1000, 1200, array['00000000-0000-4000-8000-000003041a01']::uuid[]);
    raise exception 'FAIL: a stop named a mission of another fleet';
  exception when invalid_parameter_value then null; end;
  begin
    insert into public.mission_budget_stops (workspace_id, fleet, cap, mission_id, cap_tokens, spent, missions)
    values (ws, 'night-crew', 'mission', '00000000-0000-4000-8000-000003042a01', 1000, 1100, array['00000000-0000-4000-8000-000003041a01'::uuid]);
    raise exception 'FAIL: a mission''s stop paused another mission';
  exception when check_violation then null; end;
  begin
    insert into public.mission_budget_stops (workspace_id, fleet, cap, cap_tokens, spent, missions)
    values (ws, 'night-crew', 'mission', 1000, 1100, array['00000000-0000-4000-8000-000003042a01'::uuid]);
    raise exception 'FAIL: a mission''s stop named no mission';
  exception when check_violation then null; end;
  begin
    insert into public.mission_budget_stops (workspace_id, fleet, cap, mission_id, cap_tokens, spent, missions, answer, answered_at)
    values (ws, 'night-crew', 'mission', '00000000-0000-4000-8000-000003042a01', 1000, 1100, array['00000000-0000-4000-8000-000003042a01'::uuid], 'stopped', now());
    raise exception 'FAIL: a stop was recorded already answered';
  exception when invalid_parameter_value then null; end;

  -- The supervisor never answers for a person, and nobody deletes a stop.
  begin
    update public.mission_budget_stops set answer = 'stopped' where id = made.id;
    raise exception 'FAIL: the service role answered a stop';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.mission_budget_stops where id = made.id;
    raise exception 'FAIL: the service role deleted a stop';
  exception when insufficient_privilege then null; end;

  insert into public.mission_events (mission_id, role, actor, kind, sentence)
  values ('00000000-0000-4000-8000-000003041a01', 'supervisor', 'agent', 'budget-stop', 'Paused: this mission''s budget reached (1000).'),
         ('00000000-0000-4000-8000-000003041a01', 'supervisor', 'ada-initech', 'budget-answer', 'Raised the cap to 5000.');
end $$;
reset role;

-- ── Answering: once, as the person; an owner alone raises (AC-5, AC-7) ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000304c1');
do $$
begin
  if exists (select 1 from public.mission_budget_stops) then raise exception 'FAIL: another workspace''s owner read Initech''s stops'; end if;
  perform pg_temp.forbidden(format('select public.answer_mission_budget_stop(%L, ''stopped'')', (select id from stops where name = 'fleet')), 'another workspace''s owner');
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000304b1');
do $$
declare
  mission_stop uuid := (select id from stops where name = 'mission');
  fleet_stop uuid := (select id from stops where name = 'fleet');
  made public.mission_budget_stops;
begin
  if (select count(*) from public.mission_budget_stops) <> 2 then raise exception 'FAIL: a member did not read their workspace''s stops'; end if;
  perform pg_temp.forbidden(format('select public.answer_mission_budget_stop(%L, ''raised'', 5000)', mission_stop), 'a member who is not an owner, raising');
  perform pg_temp.refused_for(format('select public.answer_mission_budget_stop(%L, ''tomorrow'')', mission_stop), 'answer', 'Answer: Resume tomorrow');
  perform pg_temp.refused_for(format('select public.answer_mission_budget_stop(%L, ''later'')', mission_stop), 'answer', 'Answer:');
  perform pg_temp.refused_for(format('select public.answer_mission_budget_stop(%L, ''stopped'', 5000)', mission_stop), 'tokens', 'Tokens:');
  begin
    update public.mission_budget_stops set answer = 'stopped' where id = fleet_stop;
    raise exception 'FAIL: a member answered a stop directly';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.mission_budget_stops where answer is not null) then raise exception 'FAIL: a refused answer was kept'; end if;

  made := public.answer_mission_budget_stop(fleet_stop, 'tomorrow');
  if made.answer <> 'tomorrow' or made.answered_by <> '00000000-0000-4000-8000-0000000304b1' or made.answered_at is null or made.raised_to is not null then
    raise exception 'FAIL: a member''s Resume tomorrow was not kept as theirs: %', row(made.*);
  end if;
  perform pg_temp.refused_for(format('select public.answer_mission_budget_stop(%L, ''stopped'')', fleet_stop), 'answer', 'Answer: this stop was answered already');
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000304a1');
do $$
declare
  mission_stop uuid := (select id from stops where name = 'mission');
  made public.mission_budget_stops;
begin
  perform pg_temp.refused_for(format('select public.answer_mission_budget_stop(%L, ''raised'')', mission_stop), 'tokens', 'Tokens:');
  perform pg_temp.refused_for(format('select public.answer_mission_budget_stop(%L, ''raised'', 1000)', mission_stop), 'tokens', 'Tokens:');
  perform pg_temp.refused_for(format('select public.answer_mission_budget_stop(%L, ''raised'', 1000000001)', mission_stop), 'tokens', 'Tokens:');
  made := public.answer_mission_budget_stop(mission_stop, 'raised', 5000);
  if made.answer <> 'raised' or made.raised_to <> 5000 or made.answered_by <> '00000000-0000-4000-8000-0000000304a1' then
    raise exception 'FAIL: an owner''s raise was not kept: %', row(made.*);
  end if;
  if (select mandate -> 'tokens' from public.missions where id = '00000000-0000-4000-8000-000003041a01') is distinct from '5000'::jsonb then
    raise exception 'FAIL: the raised budget was not saved on the mission';
  end if;
  perform pg_temp.refused_for(format('select public.answer_mission_budget_stop(%L, ''raised'', 9000)', mission_stop), 'answer', 'Answer: this stop was answered already');
end $$;
reset role;

-- A fleet's cap raised by its owner is saved on the fleet; an answered stop leaves room for a new one.
set local role service_role;
do $$
declare
  made public.mission_budget_stops;
begin
  insert into public.mission_budget_stops (workspace_id, fleet, cap, cap_tokens, spent, missions)
  values (pg_temp.ws('initech'), 'night-crew', 'fleet', 1000, 1250, array['00000000-0000-4000-8000-000003042a01']::uuid[])
  returning * into made;
  insert into stops values ('fleet again', made.id);
  insert into public.mission_budget_stops (workspace_id, fleet, cap, mission_id, cap_tokens, spent, missions)
  values (pg_temp.ws('initech'), 'night-crew', 'mission', '00000000-0000-4000-8000-000003041a01', 5000, 5200, array['00000000-0000-4000-8000-000003041a01'::uuid])
  returning * into made;
  insert into stops values ('mission again', made.id);
end $$;
reset role;
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000304a1');
do $$
begin
  if (public.answer_mission_budget_stop((select id from stops where name = 'fleet again'), 'raised', 3000)).raised_to <> 3000 then
    raise exception 'FAIL: an owner could not raise a fleet''s daily cap';
  end if;
  if (select daily_tokens from public.teams where name = 'night-crew') is distinct from 3000::bigint then
    raise exception 'FAIL: the raised daily cap was not saved on the fleet';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000304b1');
do $$
begin
  if (public.answer_mission_budget_stop((select id from stops where name = 'mission again'), 'stopped')).answer <> 'stopped' then
    raise exception 'FAIL: a member could not stop a mission at its budget';
  end if;
end $$;
reset role;

-- ── What a stop was never changes, and an answer is never rewritten (BR-PRODUCT-12) ──
do $$
declare
  one uuid := (select id from stops where name = 'mission');
begin
  begin
    update public.mission_budget_stops set answer = 'stopped', raised_to = null where id = one;
    raise exception 'FAIL: an answer was rewritten';
  exception when insufficient_privilege then null; end;
  begin
    update public.mission_budget_stops set spent = 1 where id = (select id from stops where name = 'fleet');
    raise exception 'FAIL: what a stop spent changed';
  exception when insufficient_privilege then null; end;
  if (select answer from public.mission_budget_stops where id = one) <> 'raised' then raise exception 'FAIL: the first answer did not stay'; end if;
end $$;

-- Anon, again: still nothing, and a fleet keeps its cap to itself.
set local role anon;
do $$
begin
  begin perform 1 from public.mission_budget_stops limit 1; raise exception 'FAIL: anon read the budget stops';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

rollback;
