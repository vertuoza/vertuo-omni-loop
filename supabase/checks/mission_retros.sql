-- A mission's retros, its own outbox and its pause by stuck (PRD 3065 s2). The supabase workflow runs it on every pull
-- request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/mission_retros.sql
-- Mission 3065 of initech/nimbus-plan. As the service role (the supervisor): a repair reads `failure` unless it says
-- `stuck`; a stuck repair may name no PRD, a failure always does; a stuck repair spends from the same 3 per cause in a
-- round and the same 9 per mission, a 4th of one cause and a 10th of the mission refused whatever the trigger (AC-3); a
-- repair's trigger never changes. A milestone retro is kept once per roadmap and once for the mission, with a file or
-- none (at with-you), or skipped saying why; it is never changed and never deleted. A mission item names a target, a
-- wording and cited evidence, raised by one retro or one repair of its own mission, and starts unanswered. A member of
-- the mission's workspace reads its retros and items, answers an item once through answer_mission_item(), as themselves,
-- Adopt or Decline with an optional note; a second answer is refused (AC-8); a member of another workspace, an account
-- of none and anon read nothing and answer nothing; nobody signed in writes a retro or an item; the service role answers
-- none. A mission is paused by stuck only while paused: a mission not paused keeps none, and leaving the pause clears it,
-- whoever writes the status. A mission event may be stuck,
-- stuck-answer, milestone-retro, item-proposed or item-answered; a job's mission_key may be the mission's k-th stuck
-- repair or a milestone's retro; runner_claim() hands out a stuck repair before a fresh job queued earlier. Its
-- migration runs twice. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000306a1', 'ada@example.com'),
  ('00000000-0000-4000-8000-0000000306b1', 'bob@example.com'),
  ('00000000-0000-4000-8000-0000000306c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000306e1', 'eve@example.com');
-- Ada owns Initech, Bob is a member of it; Carl belongs to Acme; Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme-retros', 'Acme', 'acme-retros');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('initech',     '00000000-0000-4000-8000-0000000306a1'::uuid, 'owner'),
         ('initech',     '00000000-0000-4000-8000-0000000306b1'::uuid, 'member'),
         ('acme-retros', '00000000-0000-4000-8000-0000000306c1'::uuid, 'member')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug;

-- Mission 3065, running, on Initech's fleet beaver, its scope roadmap 12. The jobs its repairs name, ...b0x, are kept by
-- id alone, as a job that is gone is.
insert into public.missions (id, workspace_id, repo, fleet, number, title, goal, scope, status)
select '00000000-0000-4000-8000-000003065a01', w.id, 'initech/nimbus-plan', 'beaver', 3065, 'Paid online',
       'Every quote can be paid online.', '{"prds": [3066, 3067], "roadmaps": [12]}'::jsonb, 'running'
  from public.workspaces w where w.slug = 'initech';

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- One repair of mission 3065 for a cause, in a round, by a trigger: a stuck one names no PRD. Its number.
create function pg_temp.repair(cause text, round integer default 1, kind text default 'failure') returns smallint language sql as $$
  insert into public.mission_repairs (mission_id, prd, fingerprint, round, failed_job_id, trigger)
  values ('00000000-0000-4000-8000-000003065a01', case when kind = 'stuck' then null else 3066 end, cause, round,
          '00000000-0000-4000-8000-000003065b01', kind)
  returning number;
$$;

-- A repair that must be refused for `hint`: SQLSTATE 23514 and the hint.
create function pg_temp.refused(cause text, round integer, kind text, hint text) returns void language plpgsql as $$
declare
  h text;
begin
  perform pg_temp.repair(cause, round, kind);
  raise exception 'FAIL: a % repair of % in round % was not refused for its %', kind, cause, round, hint;
exception when check_violation then
  get stacked diagnostics h = pg_exception_hint;
  if h is distinct from hint then
    raise exception 'FAIL: a % repair of % in round % was refused for % instead of its %', kind, cause, round, h, hint;
  end if;
end;
$$;

-- An answer that must be refused with `state`, and `hint` when one is named.
create function pg_temp.answer_refused(item uuid, answer text, note text, state text, hint text, why text) returns void language plpgsql as $$
declare
  s text;
  h text;
begin
  perform public.answer_mission_item(item, answer, note);
  raise exception 'FAIL: %', why;
exception when others then
  get stacked diagnostics s = returned_sqlstate, h = pg_exception_hint;
  if s like 'P0%' and sqlerrm like 'FAIL:%' then raise; end if;
  if s is distinct from state or (hint is not null and h is distinct from hint) then
    raise exception 'FAIL: % (refused with % %, not % %): %', why, s, h, state, hint, sqlerrm;
  end if;
end;
$$;

grant execute on function pg_temp.repair(text, integer, text), pg_temp.refused(text, integer, text, text) to service_role;
grant execute on function pg_temp.answer_refused(uuid, text, text, text, text, text) to authenticated, service_role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.mission_retros limit 1; raise exception 'FAIL: anon read the mission retros';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.mission_items limit 1; raise exception 'FAIL: anon read the mission items';
  exception when insufficient_privilege then null; end;
  begin perform public.answer_mission_item('00000000-0000-4000-8000-000003065d01', 'adopted', null); raise exception 'FAIL: anon reached answer_mission_item()';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── A repair's trigger: failure by default, stuck with or without a PRD, inside the same 3 and 9 ──
set local role service_role;
do $$
declare
  got public.mission_repairs;
begin
  insert into public.mission_repairs (mission_id, prd, fingerprint, failed_job_id)
  values ('00000000-0000-4000-8000-000003065a01', 3066, 'aaaaaaaa30650000000000000000000000000000000000000000000000000000', '00000000-0000-4000-8000-000003065b01')
  returning * into got;
  if got.trigger is distinct from 'failure' then raise exception 'FAIL: a repair that names no trigger reads %, not failure', got.trigger; end if;

  -- The cause aaaaaaaa: once by a failure, twice more stuck, then refused whatever the trigger.
  if pg_temp.repair('aaaaaaaa30650000000000000000000000000000000000000000000000000000', 1, 'stuck') <> 2 then raise exception 'FAIL: a stuck repair did not count with its cause''s failure'; end if;
  if pg_temp.repair('aaaaaaaa30650000000000000000000000000000000000000000000000000000', 1, 'stuck') <> 3 then raise exception 'FAIL: the third repair of a cause is not number 3'; end if;
  perform pg_temp.refused('aaaaaaaa30650000000000000000000000000000000000000000000000000000', 1, 'stuck', 'fingerprint');
  perform pg_temp.refused('aaaaaaaa30650000000000000000000000000000000000000000000000000000', 1, 'failure', 'fingerprint');

  -- A stuck repair names no PRD; a failure always does; a trigger off the list is refused.
  if (select count(*) from public.mission_repairs where trigger = 'stuck' and prd is null) <> 2 then
    raise exception 'FAIL: the stuck repairs were not kept with no PRD';
  end if;
  begin
    insert into public.mission_repairs (mission_id, prd, fingerprint, failed_job_id)
    values ('00000000-0000-4000-8000-000003065a01', null, 'abababab30650000000000000000000000000000000000000000000000000000', '00000000-0000-4000-8000-000003065b01');
    raise exception 'FAIL: a failure''s repair was kept with no PRD';
  exception when check_violation then null; end;
  begin
    perform pg_temp.repair('abababab30650000000000000000000000000000000000000000000000000000', 1, 'idle');
    raise exception 'FAIL: a trigger off the list was taken';
  exception when check_violation then null; end;

  -- A stuck repair may also name the PRD its cause sits in.
  insert into public.mission_repairs (mission_id, prd, fingerprint, failed_job_id, trigger)
  values ('00000000-0000-4000-8000-000003065a01', 3067, 'bbbbbbbb30650000000000000000000000000000000000000000000000000000', '00000000-0000-4000-8000-000003065b02', 'stuck');

  -- 4 spent; five more causes, stuck and not, make 9; a 10th is refused naming the mission, stuck or not (AC-3).
  perform pg_temp.repair('cccccccc30650000000000000000000000000000000000000000000000000000', 1, 'stuck');
  perform pg_temp.repair('dddddddd30650000000000000000000000000000000000000000000000000000');
  perform pg_temp.repair('eeeeeeee30650000000000000000000000000000000000000000000000000000', 1, 'stuck');
  perform pg_temp.repair('ffffffff30650000000000000000000000000000000000000000000000000000');
  perform pg_temp.repair('aaaaaaaa30650000000000000000000000000000000000000000000000000000', 2, 'stuck');
  if (select count(*) from public.mission_repairs) <> 9 then raise exception 'FAIL: the mission has not run 9 repairs'; end if;
  perform pg_temp.refused('abababab30650000000000000000000000000000000000000000000000000000', 2, 'stuck', 'mission');
  perform pg_temp.refused('abababab30650000000000000000000000000000000000000000000000000000', 2, 'failure', 'mission');

  -- What a repair was never changes: its trigger neither.
  begin
    update public.mission_repairs set trigger = 'failure' where fingerprint = 'cccccccc30650000000000000000000000000000000000000000000000000000';
    raise exception 'FAIL: a repair''s trigger changed';
  exception when insufficient_privilege then null; end;
  begin
    update public.mission_repairs set prd = 3066 where fingerprint = 'cccccccc30650000000000000000000000000000000000000000000000000000';
    raise exception 'FAIL: a stuck repair''s PRD changed';
  exception when insufficient_privilege then null; end;
  -- While it runs, its job, retro and fix are still filled in, and it ends once.
  update public.mission_repairs
     set job_id = '00000000-0000-4000-8000-000003065b11', retro = '{"cause": "No PRD moved for 5 jobs.", "class": "flake"}'::jsonb
   where fingerprint = 'cccccccc30650000000000000000000000000000000000000000000000000000';
  update public.mission_repairs set outcome = 'fixed' where fingerprint = 'cccccccc30650000000000000000000000000000000000000000000000000000';
  if (select ended_at from public.mission_repairs where fingerprint = 'cccccccc30650000000000000000000000000000000000000000000000000000') is null then
    raise exception 'FAIL: an ended stuck repair has no end';
  end if;
end $$;

-- ── A milestone retro: once per roadmap and once for the mission, never changed ──
do $$
declare
  got public.mission_retros;
begin
  insert into public.mission_retros (id, mission_id, milestone, job_id, retro, file, created_at)
  values ('00000000-0000-4000-8000-000003065c01', '00000000-0000-4000-8000-000003065a01', '12', '00000000-0000-4000-8000-000003065b21',
          '{"wentWell": [{"text": "PRD 3066 joined the branch on its first round.", "cites": ["prd:3066"]}], "toChange": [{"text": "Repair aaaaaaaa ran three times.", "cites": ["repair:aaaaaaaa"]}]}'::jsonb,
          '.omni-loop/missions/3065-paid-online/retros/1-12.md', now() - interval '3 days')
  returning * into got;
  if got.created_at < now() - interval '1 minute' then raise exception 'FAIL: a retro took the caller''s time'; end if;
  begin
    insert into public.mission_retros (mission_id, milestone, retro) values ('00000000-0000-4000-8000-000003065a01', '12', '{"wentWell": []}'::jsonb);
    raise exception 'FAIL: a roadmap''s retro was kept twice';
  exception when unique_violation then null; end;
  -- The mission's own, kept on the page only (at with-you: no file).
  insert into public.mission_retros (id, mission_id, milestone, retro)
  values ('00000000-0000-4000-8000-000003065c02', '00000000-0000-4000-8000-000003065a01', 'mission', '{"wentWell": [], "toChange": []}'::jsonb);
  begin
    insert into public.mission_retros (mission_id, milestone, retro) values ('00000000-0000-4000-8000-000003065a01', 'roadmap 7', '{}'::jsonb);
    raise exception 'FAIL: a milestone off its shape was taken';
  exception when check_violation then null; end;
  begin
    insert into public.mission_retros (mission_id, milestone, retro) values ('00000000-0000-4000-8000-000003065a01', '13', '"a log excerpt"'::jsonb);
    raise exception 'FAIL: a retro that is no object was taken';
  exception when check_violation then null; end;
  begin
    insert into public.mission_retros (mission_id, milestone, retro, file) values ('00000000-0000-4000-8000-000003065a01', '13', '{}'::jsonb, '../../etc/passwd.md');
    raise exception 'FAIL: a file climbing out of the repository was taken';
  exception when check_violation then null; end;
  begin
    insert into public.mission_retros (mission_id, milestone) values ('00000000-0000-4000-8000-000003065a01', '13');
    raise exception 'FAIL: a retro neither written nor skipped was kept';
  exception when check_violation then null; end;
  begin
    insert into public.mission_retros (mission_id, milestone, retro, skipped) values ('00000000-0000-4000-8000-000003065a01', '13', '{}'::jsonb, 'budget reached');
    raise exception 'FAIL: a retro both written and skipped was kept';
  exception when check_violation then null; end;
  -- A retro a cap or an unreadable line held back is kept as skipped, saying why (BL-GATE-1).
  insert into public.mission_retros (mission_id, milestone, skipped) values ('00000000-0000-4000-8000-000003065a01', '13', 'budget reached');

  begin
    update public.mission_retros set file = null where id = '00000000-0000-4000-8000-000003065c01';
    raise exception 'FAIL: the service role changed a retro';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.mission_retros where id = '00000000-0000-4000-8000-000003065c01';
    raise exception 'FAIL: the service role deleted a retro';
  exception when insufficient_privilege then null; end;
end $$;

-- ── A mission item: a target, a wording and cited evidence, raised by one retro or one repair, starting unanswered ──
do $$
declare
  repair uuid := (select id from public.mission_repairs where fingerprint = 'cccccccc30650000000000000000000000000000000000000000000000000000');
begin
  insert into public.mission_items (id, mission_id, retro_id, number, target, wording, evidence, file) values
    ('00000000-0000-4000-8000-000003065d01', '00000000-0000-4000-8000-000003065a01', '00000000-0000-4000-8000-000003065c01', 1,
     'testing › Levels', 'A migration is proven by its check before its readers change.', '["Repair aaaaaaaa ran three times on one migration."]'::jsonb,
     '.omni-loop/missions/3065-paid-online/outbox/12-01-testing-levels.md'),
    ('00000000-0000-4000-8000-000003065d02', '00000000-0000-4000-8000-000003065a01', '00000000-0000-4000-8000-000003065c01', 2,
     'BR-PRODUCT-139', 'A stuck repair is a repair.', '["The stuck repair cccccccc spent one of the 9."]'::jsonb, null);
  insert into public.mission_items (id, mission_id, repair_id, number, target, wording, evidence) values
    ('00000000-0000-4000-8000-000003065d03', '00000000-0000-4000-8000-000003065a01', repair, 1,
     'verification › Before a push', 'Run the supabase checks before a migration is pushed.', '["The stuck repair cccccccc found a red check."]'::jsonb);
  begin
    insert into public.mission_items (mission_id, retro_id, number, target, wording, evidence)
    values ('00000000-0000-4000-8000-000003065a01', '00000000-0000-4000-8000-000003065c01', 1, 'conventions', 'Again.', '["x"]'::jsonb);
    raise exception 'FAIL: a retro''s item was kept twice under one number';
  exception when unique_violation then null; end;
  begin
    insert into public.mission_items (mission_id, number, target, wording, evidence)
    values ('00000000-0000-4000-8000-000003065a01', 3, 'conventions', 'From nowhere.', '["x"]'::jsonb);
    raise exception 'FAIL: an item raised by no retro and no repair was kept';
  exception when check_violation then null; end;
  begin
    insert into public.mission_items (mission_id, retro_id, repair_id, number, target, wording, evidence)
    values ('00000000-0000-4000-8000-000003065a01', '00000000-0000-4000-8000-000003065c01', repair, 3, 'conventions', 'From both.', '["x"]'::jsonb);
    raise exception 'FAIL: an item raised by a retro and a repair at once was kept';
  exception when check_violation then null; end;
  begin
    insert into public.mission_items (mission_id, retro_id, number, target, wording, evidence)
    values ('00000000-0000-4000-8000-000003065a01', '00000000-0000-4000-8000-000003065c01', 3, '', 'No target.', '["x"]'::jsonb);
    raise exception 'FAIL: an item with no target was kept';
  exception when check_violation then null; end;
  begin
    insert into public.mission_items (mission_id, retro_id, number, target, wording, evidence)
    values ('00000000-0000-4000-8000-000003065a01', '00000000-0000-4000-8000-000003065c01', 3, 'conventions', '', '["x"]'::jsonb);
    raise exception 'FAIL: an item with no wording was kept';
  exception when check_violation then null; end;
  begin
    insert into public.mission_items (mission_id, retro_id, number, target, wording, evidence)
    values ('00000000-0000-4000-8000-000003065a01', '00000000-0000-4000-8000-000003065c01', 3, 'conventions', 'No evidence.', '[]'::jsonb);
    raise exception 'FAIL: an item with no evidence was kept';
  exception when check_violation then null; end;
  begin
    insert into public.mission_items (mission_id, retro_id, number, target, wording, evidence)
    values ('00000000-0000-4000-8000-000003065a01', '00000000-0000-4000-8000-000003065c01', 3, 'conventions', 'Odd evidence.', '[{"log": "x"}]'::jsonb);
    raise exception 'FAIL: evidence that is no sentence was kept';
  exception when invalid_parameter_value then null; end;
  begin
    insert into public.mission_items (mission_id, retro_id, number, target, wording, evidence, answer)
    values ('00000000-0000-4000-8000-000003065a01', '00000000-0000-4000-8000-000003065c01', 3, 'conventions', 'Answered already.', '["x"]'::jsonb, 'adopted');
    raise exception 'FAIL: an item started answered';
  exception when invalid_parameter_value then null; end;

  -- An item's retro is its own mission's.
  insert into public.missions (id, workspace_id, repo, fleet, number, title, goal, scope, status)
  select '00000000-0000-4000-8000-000003065a02', m.workspace_id, m.repo, m.fleet, 3068, 'Other', 'Another goal.', '{"prds": [3069], "roadmaps": []}'::jsonb, 'running'
    from public.missions m where m.id = '00000000-0000-4000-8000-000003065a01';
  begin
    insert into public.mission_items (mission_id, retro_id, number, target, wording, evidence)
    values ('00000000-0000-4000-8000-000003065a02', '00000000-0000-4000-8000-000003065c01', 1, 'conventions', 'Borrowed.', '["x"]'::jsonb);
    raise exception 'FAIL: an item was raised by another mission''s retro';
  exception when invalid_parameter_value then null; end;

  -- Nobody but a member answers, the service role neither.
  begin
    update public.mission_items set answer = 'adopted' where id = '00000000-0000-4000-8000-000003065d01';
    raise exception 'FAIL: the service role answered an item';
  exception when insufficient_privilege then null; end;
  begin
    perform public.answer_mission_item('00000000-0000-4000-8000-000003065d01', 'adopted', null);
    raise exception 'FAIL: the service role reached answer_mission_item()';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.mission_items where id = '00000000-0000-4000-8000-000003065d01';
    raise exception 'FAIL: the service role deleted an item';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Who reads the retros and items, and who answers ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000306c1');
do $$
begin
  if exists (select 1 from public.mission_retros) then raise exception 'FAIL: a member of another workspace read a retro'; end if;
  if exists (select 1 from public.mission_items) then raise exception 'FAIL: a member of another workspace read an item'; end if;
  perform pg_temp.answer_refused('00000000-0000-4000-8000-000003065d01', 'declined', null, '42501', null, 'a member of another workspace answered an item');
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000306e1');
do $$
begin
  if exists (select 1 from public.mission_retros) then raise exception 'FAIL: an account of no workspace read a retro'; end if;
  if exists (select 1 from public.mission_items) then raise exception 'FAIL: an account of no workspace read an item'; end if;
  perform pg_temp.answer_refused('00000000-0000-4000-8000-000003065d01', 'declined', null, '42501', null, 'an account of no workspace answered an item');
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000306b1');
do $$
declare
  got public.mission_items;
begin
  if (select count(*) from public.mission_retros) <> 3 then raise exception 'FAIL: a member does not read the 3 retros of their mission'; end if;
  if (select count(*) from public.mission_items) <> 3 then raise exception 'FAIL: a member does not read the 3 items of their mission'; end if;
  begin
    insert into public.mission_retros (mission_id, milestone, skipped) values ('00000000-0000-4000-8000-000003065a01', '14', 'x');
    raise exception 'FAIL: a member wrote a retro';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.mission_items (mission_id, retro_id, number, target, wording, evidence)
    values ('00000000-0000-4000-8000-000003065a01', '00000000-0000-4000-8000-000003065c01', 9, 'conventions', 'Mine.', '["x"]'::jsonb);
    raise exception 'FAIL: a member wrote an item';
  exception when insufficient_privilege then null; end;
  begin
    update public.mission_items set answer = 'adopted' where id = '00000000-0000-4000-8000-000003065d01';
    raise exception 'FAIL: a member answered an item around answer_mission_item()';
  exception when insufficient_privilege then null; end;

  perform pg_temp.answer_refused('00000000-0000-4000-8000-000003065d01', 'maybe', null, '22023', 'answer', 'an answer off the list was taken');
  perform pg_temp.answer_refused('00000000-0000-4000-8000-000003065d01', 'adopted', repeat('x', 501), '22023', 'note', 'a note over 500 characters was taken');
  perform pg_temp.answer_refused('00000000-0000-4000-8000-0000000306ff', 'adopted', null, '42501', null, 'an item that does not exist was answered');

  -- Bob adopts, with a note; the answer is his, dated by the database.
  select * into got from public.answer_mission_item('00000000-0000-4000-8000-000003065d01', 'adopted', '  Worth a try.  ');
  if got.answer is distinct from 'adopted' or got.note is distinct from 'Worth a try.' or got.answered_by is distinct from '00000000-0000-4000-8000-0000000306b1'
     or got.answered_at is null then
    raise exception 'FAIL: an adopted item does not read as Bob''s answer: %', row(got.*);
  end if;
  -- An answer is given once (AC-8, BR-PRODUCT-12).
  perform pg_temp.answer_refused('00000000-0000-4000-8000-000003065d01', 'declined', null, '22023', 'answer', 'a second answer was taken');
  -- A blank note is none.
  select * into got from public.answer_mission_item('00000000-0000-4000-8000-000003065d02', 'declined', '   ');
  if got.answer is distinct from 'declined' or got.note is not null then raise exception 'FAIL: a declined item with a blank note: %', row(got.*); end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000306a1');
do $$
begin
  perform pg_temp.answer_refused('00000000-0000-4000-8000-000003065d01', 'declined', null, '22023', 'answer', 'an owner rewrote a member''s answer');
  if (select answer from public.mission_items where id = '00000000-0000-4000-8000-000003065d01') is distinct from 'adopted' then
    raise exception 'FAIL: the first answer was not kept';
  end if;
end $$;
reset role;

-- What an item was never changes, and its answer neither, whoever writes it.
do $$
begin
  begin
    update public.mission_items set wording = 'Rewritten.' where id = '00000000-0000-4000-8000-000003065d03';
    raise exception 'FAIL: an item''s wording changed';
  exception when insufficient_privilege then null; end;
  begin
    update public.mission_items set answer = 'declined' where id = '00000000-0000-4000-8000-000003065d01';
    raise exception 'FAIL: an answered item''s answer changed';
  exception when insufficient_privilege then null; end;
  begin
    update public.mission_items set note = 'Rewritten.' where id = '00000000-0000-4000-8000-000003065d01';
    raise exception 'FAIL: an answered item''s note changed';
  exception when insufficient_privilege then null; end;
end $$;

-- ── Paused by stuck: only while paused, and cleared once it is not ──
set local role service_role;
do $$
declare
  mission constant uuid := '00000000-0000-4000-8000-000003065a01';
begin
  update public.missions set paused_by = 'stuck' where id = mission;
  if (select paused_by from public.missions where id = mission) is not null then raise exception 'FAIL: a running mission read as paused by stuck'; end if;
  begin
    insert into public.missions (workspace_id, repo, fleet, number, title, goal, scope, status, paused_by)
    select m.workspace_id, m.repo, m.fleet, 3070, 'Stuck at birth', 'A goal.', '{"prds": [3071], "roadmaps": []}'::jsonb, 'running', 'stuck'
      from public.missions m where m.id = mission;
    raise exception 'FAIL: a running mission was made paused by stuck';
  exception when check_violation then null; end;
  begin
    update public.missions set status = 'paused', paused_by = 'budget' where id = mission;
    raise exception 'FAIL: a pause off the list was taken';
  exception when check_violation then null; end;
  update public.missions set status = 'paused', paused_by = 'stuck', waiting_on = 'Paused: stuck' where id = mission;
  if (select paused_by from public.missions where id = mission) is distinct from 'stuck' then raise exception 'FAIL: the pause by stuck was not kept'; end if;
  -- A replayed run pauses it again: still once, still by stuck.
  update public.missions set status = 'paused', waiting_on = 'Paused: stuck' where id = mission;
  if (select paused_by from public.missions where id = mission) is distinct from 'stuck' then raise exception 'FAIL: a second pause lost the pause by stuck'; end if;
  -- Resume: running again, the pause by stuck cleared with it, whoever wrote the status.
  update public.missions set status = 'running', waiting_on = null where id = mission;
  if (select paused_by from public.missions where id = mission) is not null then raise exception 'FAIL: a resumed mission still reads paused by stuck'; end if;
  update public.missions set status = 'paused', paused_by = 'stuck' where id = mission;
  update public.missions set status = 'stopped', waiting_on = 'Stopped: it was stuck.' where id = mission;
  if (select paused_by from public.missions where id = mission) is not null then raise exception 'FAIL: a stopped mission still reads paused by stuck'; end if;
end $$;

-- ── The five event kinds, the two job keys, and a stuck repair claimed first ──
do $$
declare
  mission constant uuid := '00000000-0000-4000-8000-000003065a02';
  ws uuid := (select workspace_id from public.missions where id = mission);
  kind text;
begin
  foreach kind in array array['stuck', 'milestone-retro', 'item-proposed'] loop
    insert into public.mission_events (mission_id, role, actor, kind, sentence)
    values (mission, 'supervisor', 'agent', kind, format('A %s.', kind));
  end loop;
  foreach kind in array array['stuck-answer', 'item-answered'] loop
    insert into public.mission_events (mission_id, role, actor, kind, sentence)
    values (mission, 'supervisor', 'bob-initech', kind, format('A %s.', kind));
  end loop;
  begin
    insert into public.mission_events (mission_id, role, actor, kind, sentence) values (mission, 'supervisor', 'agent', 'unstuck', 'x');
    raise exception 'FAIL: an event kind off the list was taken';
  exception when check_violation then null; end;

  insert into public.runners (id, workspace_id, owner, name, fleet, slots, repos, github_app, last_seen_at)
  values ('00000000-0000-4000-8000-000003065e01', ws, '00000000-0000-4000-8000-0000000306a1', 'box-retros', null, 4, '{initech/nimbus-plan}', true, now());
  insert into public.runner_jobs (id, workspace_id, line, repo, sent_by_app, mission_id, mission_key, queued_at) values
    ('00000000-0000-4000-8000-000003065b31', ws, '/omni:yolo 3069', 'initech/nimbus-plan', 'omni-app', mission,
     format('mission:%s:prd:3069:run:1', mission), now() - interval '2 hours'),
    ('00000000-0000-4000-8000-000003065b32', ws, '/omni:mission-retro --mission 3068 --milestone 12', 'initech/nimbus-plan', 'omni-app', mission,
     format('mission:%s:retro:12', mission), now() - interval '1 hour'),
    ('00000000-0000-4000-8000-000003065b33', ws, '/omni:repair --mission 3068 --stuck --jobs a,b,c,d,e', 'initech/nimbus-plan', 'omni-app', mission,
     format('mission:%s:stuck:1', mission), now());
  insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, mission_id, mission_key) values
    (ws, '/omni:mission-retro --mission 3068 --milestone mission', 'initech/nimbus-plan', 'omni-app', mission, format('mission:%s:retro:mission', mission));
  begin
    insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, mission_id, mission_key)
    values (ws, '/omni:repair', 'initech/nimbus-plan', 'omni-app', mission, format('mission:%s:stuck:1', mission));
    raise exception 'FAIL: a stuck repair''s key was taken twice';
  exception when unique_violation then null; end;
  foreach kind in array array['stuck:0', 'stuck', 'retro:0', 'retro:roadmap', 'retro:12:1', 'prd:3069:stuck:1'] loop
    begin
      insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, mission_id, mission_key)
      values (ws, '/omni:repair', 'initech/nimbus-plan', 'omni-app', mission, format('mission:%s:%s', mission, kind));
      raise exception 'FAIL: a key ending % was taken', kind;
    exception when check_violation then null; end;
  end loop;
  if (select id from public.runner_claim('00000000-0000-4000-8000-000003065e01')) is distinct from '00000000-0000-4000-8000-000003065b33' then
    raise exception 'FAIL: the runner did not claim the stuck repair before fresh jobs queued earlier';
  end if;
  if (select id from public.runner_claim('00000000-0000-4000-8000-000003065e01')) is distinct from '00000000-0000-4000-8000-000003065b31' then
    raise exception 'FAIL: the runner did not claim the oldest fresh job after the stuck repair';
  end if;
  if (select id from public.runner_claim('00000000-0000-4000-8000-000003065e01')) is distinct from '00000000-0000-4000-8000-000003065b32' then
    raise exception 'FAIL: a milestone retro was not claimed in its turn, as a fresh job';
  end if;
end $$;
reset role;

-- ── A mission's deletion takes its retros and items ──
delete from public.missions where id = '00000000-0000-4000-8000-000003065a01';
do $$
begin
  if exists (select 1 from public.mission_retros) or exists (select 1 from public.mission_items) then
    raise exception 'FAIL: a mission''s retros or items outlived it';
  end if;
end $$;

-- Run again: its tables, kept, say so; nothing else does.
set local client_min_messages = warning;
\ir ../migrations/20270126110000_mission_retros.sql
reset client_min_messages;

rollback;
