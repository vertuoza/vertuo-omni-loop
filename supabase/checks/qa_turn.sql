-- QA's turn (PRD 3001 s2). The supabase workflow runs it on every pull request, after `supabase db start` has applied the
-- migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/qa_turn.sql
-- Mission 3001 of initech/nimbus-plan. As the service role (the App), a job keeps the four counts of its tokens, or none, and
-- refuses a count missing, an unknown one, a negative one, one that is no whole number and one that is no number (AC-8). A
-- mission event may be `checked`, signed by QA. A job's mission_key may be QA's round 1 or 2 and the Engineer's fix of the 1st
-- to 5th bug of round 1, each once; a third round, a sixth bug and a fix of round 2 are refused. set_repository_runner_skill()
-- refuses a repository's own skill named qa. A new QA lists qa, prove, bug-fix and validate-e2e and its four limits after every
-- hero's two (AC-10); the migration run again gives them to a QA made before while its skills, or its limits, are still its
-- default, never to one a person changed. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000300a1', 'ada@example.com');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, '00000000-0000-4000-8000-0000000300a1', 'owner' from public.workspaces w where w.slug = 'initech';

-- Mission 3001, running, on Initech's fleet beaver.
insert into public.missions (id, workspace_id, repo, fleet, number, title, goal, scope, status)
select '00000000-0000-4000-8000-000003001a01', w.id, 'initech/nimbus-plan', 'beaver', 3001, 'Checked before review',
       'Every PRD is checked on its preview before the Reviewer reads it.', '{"prds": [3002], "roadmaps": []}'::jsonb, 'running'
  from public.workspaces w where w.slug = 'initech';

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ── A job's tokens: the four counts, or none ──
set local role service_role;
do $$
declare
  mission constant uuid := '00000000-0000-4000-8000-000003001a01';
  ws uuid := (select workspace_id from public.missions where id = mission);
  job constant uuid := '00000000-0000-4000-8000-000003001b01';
  bad jsonb;
begin
  insert into public.runner_jobs (id, workspace_id, line, repo, sent_by_app, mission_id)
  values (job, ws, '/omni:qa 3002', 'initech/nimbus-plan', 'omni-app', mission);
  update public.runner_jobs set tokens = '{"input": 41000, "output": 2000, "cacheRead": 0, "cacheWrite": 0}' where id = job;
  if (select tokens ->> 'input' from public.runner_jobs where id = job) is distinct from '41000' then
    raise exception 'FAIL: a job did not keep its four counts';
  end if;
  update public.runner_jobs set tokens = null where id = job;
  if (select tokens from public.runner_jobs where id = job) is not null then
    raise exception 'FAIL: a job whose agent gave no count did not keep none';
  end if;
  foreach bad in array array[
    '{"input": 1, "output": 1, "cacheRead": 1}',
    '{"input": 1, "output": 1, "cacheRead": 1, "cacheWrite": 1, "reasoning": 1}',
    '{"input": -1, "output": 1, "cacheRead": 1, "cacheWrite": 1}',
    '{"input": 1.5, "output": 1, "cacheRead": 1, "cacheWrite": 1}',
    '{"input": "1", "output": 1, "cacheRead": 1, "cacheWrite": 1}',
    '[1, 2, 3, 4]'
  ]::jsonb[] loop
    begin
      update public.runner_jobs set tokens = bad where id = job;
      raise exception 'FAIL: a job took the tokens %', bad;
    exception when check_violation then null; end;
  end loop;
end $$;

-- ── QA's verdict is a mission event ──
do $$
declare
  mission constant uuid := '00000000-0000-4000-8000-000003001a01';
begin
  insert into public.mission_events (mission_id, role, actor, kind, prd, link, sentence)
  values (mission, 'qa', 'agent', 'checked', 3002, 'https://github.com/initech/nimbus-plan/pull/3010#issuecomment-1',
          '2 bugs found · Round 1 of 2 · #3012 #3013');
  if not exists (select 1 from public.mission_events where mission_id = mission and kind = 'checked' and role = 'qa') then
    raise exception 'FAIL: QA''s checked event was not kept';
  end if;
  begin
    insert into public.mission_events (mission_id, role, actor, kind, sentence) values (mission, 'qa', 'agent', 'tested', 'x');
    raise exception 'FAIL: an event kind off the list was taken';
  exception when check_violation then null; end;
end $$;

-- ── The QA pair's keys ──
do $$
declare
  mission constant uuid := '00000000-0000-4000-8000-000003001a01';
  ws uuid := (select workspace_id from public.missions where id = mission);
  run text := format('mission:%s:prd:3002:run:1', mission);
  key text;
begin
  foreach key in array array[run || ':qa:1', run || ':qa-fix:1:1', run || ':qa-fix:1:5', run || ':qa:2'] loop
    insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, mission_id, mission_key)
    values (ws, '/omni:qa 3002', 'initech/nimbus-plan', 'omni-app', mission, key);
  end loop;
  begin
    insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, mission_id, mission_key)
    values (ws, '/omni:qa 3002', 'initech/nimbus-plan', 'omni-app', mission, run || ':qa:1');
    raise exception 'FAIL: QA''s round 1 was sent twice';
  exception when unique_violation then null; end;
  foreach key in array array[run || ':qa:3', run || ':qa-fix:1:6', run || ':qa-fix:2:1', run || ':qa-fix:1', format('mission:%s:prd:3002:qa:1', mission)] loop
    begin
      insert into public.runner_jobs (workspace_id, line, repo, sent_by_app, mission_id, mission_key)
      values (ws, '/omni:qa 3002', 'initech/nimbus-plan', 'omni-app', mission, key);
      raise exception 'FAIL: the key % was taken', key;
    exception when check_violation then null; end;
  end loop;
end $$;
reset role;

-- ── qa is the loop's own skill ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000300a1');
do $$
declare
  h text;
begin
  perform public.set_repository_runner_skill((select id from public.workspaces where slug = 'initech'), 'initech/nimbus-plan', 'qa', true);
  raise exception 'FAIL: a repository allowed its own skill named qa';
exception when invalid_parameter_value then
  get stacked diagnostics h = pg_exception_hint;
  if h is distinct from 'skill' then raise exception 'FAIL: a skill named qa was refused for % instead of its skill', h; end if;
end $$;

-- ── QA's skills and limits: a new one lists them, one made before takes them while they are still its default ──
do $$
declare
  ws uuid := (select id from public.workspaces where slug = 'initech');
begin
  perform public.create_virtual_fleet(ws, 'Night Check', 'beaver', array['qa']);
  perform public.create_virtual_fleet(ws, 'Day Check', 'octopod', array['qa']);
  if (select h.skills from public.virtual_heroes h where h.fleet = 'night-check' and h.role = 'qa') <> array['qa', 'prove', 'bug-fix', 'validate-e2e'] then
    raise exception 'FAIL: a new QA does not list qa, prove, bug-fix and validate-e2e';
  end if;
  if (select h.limits from public.virtual_heroes h where h.fleet = 'night-check' and h.role = 'qa')
     <> array['It never merges into the default branch.', 'It never answers for a person.', 'It never writes the branch.',
              'It reports bugs to the Engineer.', 'It reports five bugs at most.', 'It checks two rounds at most.'] then
    raise exception 'FAIL: a new QA does not carry its four limits after every hero''s two';
  end if;
end $$;
reset role;

-- Night Check's QA as PRD 2873 left it; Day Check's as a person changed it.
update public.virtual_heroes h
   set skills = case h.fleet when 'night-check' then array['prove', 'bug-fix', 'validate-e2e'] else array['prove'] end,
       limits = case h.fleet when 'night-check'
                  then array['It never merges into the default branch.', 'It never answers for a person.', 'It reports what it saw; a person decides.']
                  else array['It keeps its owner''s limit.'] end
 where h.fleet in ('night-check', 'day-check');

-- Run again: nothing says a word.
set local client_min_messages = warning;
\ir ../migrations/20270125160000_qa_turn.sql
reset client_min_messages;

do $$
begin
  if (select h.skills from public.virtual_heroes h where h.fleet = 'night-check' and h.role = 'qa') <> array['qa', 'prove', 'bug-fix', 'validate-e2e'] then
    raise exception 'FAIL: a QA made before, still on its default skills, did not take qa';
  end if;
  if (select h.limits[3] from public.virtual_heroes h where h.fleet = 'night-check' and h.role = 'qa') <> 'It never writes the branch.' then
    raise exception 'FAIL: a QA made before, still on its default limits, did not take the four';
  end if;
  if (select h.skills from public.virtual_heroes h where h.fleet = 'day-check' and h.role = 'qa') <> array['prove'] then
    raise exception 'FAIL: a QA whose skills a person changed did not keep them';
  end if;
  if (select h.limits from public.virtual_heroes h where h.fleet = 'day-check' and h.role = 'qa') <> array['It keeps its owner''s limit.'] then
    raise exception 'FAIL: a QA whose limits a person changed did not keep them';
  end if;
end $$;

rollback;
