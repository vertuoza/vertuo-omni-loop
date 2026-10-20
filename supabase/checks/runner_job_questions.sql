-- Who may read and write a runner job's questions, and what answering or dismissing does (PRD 2255), run
-- after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/runner_job_questions.sql
-- A member of the workspace reads its jobs' questions; an account of another workspace, or signed out,
-- nothing; nobody signed in adds, changes or deletes a row, or calls the two functions. As the service
-- role: a row holds 1 to 4 questions and a lead of at most 4,000 characters; runner_job_answer() refuses
-- a job that is not waiting, an account outside the workspace and answers that do not match the
-- questions, queues the resume line to the first job's repository and target as the answerer, stores
-- the answers once (a second answer, or a dismissal after one, is refused and changes nothing), and
-- stores nothing when the queue is refused; runner_job_dismiss() closes a row with no job queued. Any
-- `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Olga owns the workspace Questions, Mo is a member of it; Eve belongs to another workspace.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000022550a1', 'olga@questions.test'),
  ('00000000-0000-4000-8000-0000022550b1', 'mo@questions.test'),
  ('00000000-0000-4000-8000-0000022550e1', 'eve@elsewhere.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000002255001', 'questions-check', 'Questions', 'questions-check'),
  ('00000000-0000-4000-8000-000002255002', 'questions-elsewhere', 'Elsewhere', 'questions-elsewhere');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000002255001', '00000000-0000-4000-8000-0000022550a1', 'owner'),
  ('00000000-0000-4000-8000-000002255001', '00000000-0000-4000-8000-0000022550b1', 'member'),
  ('00000000-0000-4000-8000-000002255002', '00000000-0000-4000-8000-0000022550e1', 'owner');

-- One runner of Olga's, and five jobs: A (sent to that runner), B and C (sent to any runner) ended
-- `human`, D is still running, E ended `human` with a line so long that its resume line cannot be queued.
insert into public.runners (id, workspace_id, owner, name, repos) values
  ('00000000-0000-4000-8000-0000022551a1', '00000000-0000-4000-8000-000002255001', '00000000-0000-4000-8000-0000022550a1', 'box', '{questions-check/app}');
insert into public.runner_jobs (id, workspace_id, line, repo, to_runner, sent_by, status, runner_id, claimed_at, running_at, ended_at, outcome) values
  ('00000000-0000-4000-8000-0000022552a1', '00000000-0000-4000-8000-000002255001', '/omni:bug-fix #314', 'questions-check/app', '00000000-0000-4000-8000-0000022551a1', '00000000-0000-4000-8000-0000022550a1', 'done', '00000000-0000-4000-8000-0000022551a1', now(), now(), now(), 'human'),
  ('00000000-0000-4000-8000-0000022552b1', '00000000-0000-4000-8000-000002255001', '/omni:bug-fix #315', 'questions-check/app', null, '00000000-0000-4000-8000-0000022550a1', 'done', '00000000-0000-4000-8000-0000022551a1', now(), now(), now(), 'human'),
  ('00000000-0000-4000-8000-0000022552c1', '00000000-0000-4000-8000-000002255001', '/omni:mega-bug-fix #316', 'questions-check/app', null, '00000000-0000-4000-8000-0000022550a1', 'done', '00000000-0000-4000-8000-0000022551a1', now(), now(), now(), 'human'),
  ('00000000-0000-4000-8000-0000022552d1', '00000000-0000-4000-8000-000002255001', '/omni:bug-fix #317', 'questions-check/app', null, '00000000-0000-4000-8000-0000022550a1', 'running', '00000000-0000-4000-8000-0000022551a1', now(), now(), null, null),
  ('00000000-0000-4000-8000-0000022552e1', '00000000-0000-4000-8000-000002255001', '/omni:' || repeat('a', 200), 'questions-check/app', null, '00000000-0000-4000-8000-0000022550a1', 'done', '00000000-0000-4000-8000-0000022551a1', now(), now(), now(), 'human');

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ── The rows, as the service role ──
set local role service_role;
do $$
declare
  one constant jsonb := '[{"question":"Which fix?","header":"Fix","options":[{"label":"Guard","description":"Check the input"},{"label":"Design it first","description":"Stop here and brainstorm the behaviour"}],"multiSelect":false}]';
  ws  constant uuid  := '00000000-0000-4000-8000-000002255001';
begin
  insert into public.runner_job_questions (job_id, workspace_id, issue, lead, questions) values
    ('00000000-0000-4000-8000-0000022552a1', ws, 314, 'The planning query fails for 31 tenants.', one),
    ('00000000-0000-4000-8000-0000022552b1', ws, 315, 'Two fixes are possible.', one),
    ('00000000-0000-4000-8000-0000022552c1', ws, 316, 'The plan repository needs a call.', one),
    ('00000000-0000-4000-8000-0000022552d1', ws, 317, 'Still running.', one),
    ('00000000-0000-4000-8000-0000022552e1', ws, 318, 'Too long to resume.', one);
  -- Zero or five questions, a lead of 4,001 characters, an issue of 0 and a second row for a job are refused.
  begin
    insert into public.runner_job_questions (job_id, workspace_id, issue, lead, questions) values ('00000000-0000-4000-8000-0000022552a1', ws, 314, 'again', one);
    raise exception 'FAIL: a second row was stored for one job';
  exception when unique_violation then null; end;
  begin
    update public.runner_job_questions set questions = '[]' where job_id = '00000000-0000-4000-8000-0000022552d1';
    raise exception 'FAIL: a row with no question was stored';
  exception when check_violation then null; end;
  begin
    update public.runner_job_questions set questions = (select jsonb_agg(q) from jsonb_array_elements(one), generate_series(1, 5) q) where job_id = '00000000-0000-4000-8000-0000022552d1';
    raise exception 'FAIL: a row with five questions was stored';
  exception when check_violation then null; end;
  begin
    update public.runner_job_questions set lead = repeat('x', 4001) where job_id = '00000000-0000-4000-8000-0000022552d1';
    raise exception 'FAIL: a lead of 4,001 characters was stored';
  exception when check_violation then null; end;
  begin
    update public.runner_job_questions set issue = 0 where job_id = '00000000-0000-4000-8000-0000022552d1';
    raise exception 'FAIL: an issue of 0 was stored';
  exception when check_violation then null; end;
  -- Answers on a row that is still open are refused.
  begin
    update public.runner_job_questions set answers = '{"Which fix?":"Guard"}' where job_id = '00000000-0000-4000-8000-0000022552d1';
    raise exception 'FAIL: an open row stored answers';
  exception when check_violation then null; end;
end $$;
reset role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.runner_job_questions limit 1; raise exception 'FAIL: anon read the runner job questions';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── A member reads; nobody signed in writes ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000022550b1');
do $$
begin
  if (select count(*) from public.runner_job_questions where workspace_id = '00000000-0000-4000-8000-000002255001') <> 5 then
    raise exception 'FAIL: a member did not read the workspace''s five rows';
  end if;
  begin
    insert into public.runner_job_questions (job_id, workspace_id, issue, lead, questions)
    values ('00000000-0000-4000-8000-0000022552a1', '00000000-0000-4000-8000-000002255001', 1, 'forged', '[{}]');
    raise exception 'FAIL: a member wrote a row';
  exception when insufficient_privilege then null; end;
  begin
    update public.runner_job_questions set lead = 'changed' where job_id = '00000000-0000-4000-8000-0000022552a1';
    raise exception 'FAIL: a member wrote a row by changing it';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.runner_job_questions where job_id = '00000000-0000-4000-8000-0000022552a1';
    raise exception 'FAIL: a member wrote a row by deleting it';
  exception when insufficient_privilege then null; end;
  begin
    perform public.runner_job_answer('00000000-0000-4000-8000-0000022552a1', '{"Which fix?":"Guard"}', '00000000-0000-4000-8000-0000022550b1');
    raise exception 'FAIL: a member answered through runner_job_answer()';
  exception when insufficient_privilege then null; end;
  begin
    perform public.runner_job_dismiss('00000000-0000-4000-8000-0000022552a1', '00000000-0000-4000-8000-0000022550b1');
    raise exception 'FAIL: a member dismissed through runner_job_dismiss()';
  exception when insufficient_privilege then null; end;
end $$;

-- An account of another workspace reads nothing.
select pg_temp.sign_in('00000000-0000-4000-8000-0000022550e1');
do $$
begin
  if exists (select 1 from public.runner_job_questions where workspace_id = '00000000-0000-4000-8000-000002255001') then
    raise exception 'FAIL: another workspace read the runner job questions';
  end if;
end $$;
reset role;

-- ── Answering, as the service role ──
set local role service_role;
do $$
declare
  a      constant uuid := '00000000-0000-4000-8000-0000022552a1';
  d      constant uuid := '00000000-0000-4000-8000-0000022552d1';
  mo     constant uuid := '00000000-0000-4000-8000-0000022550b1';
  olga   constant uuid := '00000000-0000-4000-8000-0000022550a1';
  eve    constant uuid := '00000000-0000-4000-8000-0000022550e1';
  good   constant jsonb := '{"Which fix?":"Guard"}';
  queued integer;
  resume public.runner_jobs;
  closed public.runner_job_questions;
begin
  select count(*) into queued from public.runner_jobs where status = 'queued';
  -- A job still running is not waiting: refused, nothing queued.
  begin perform public.runner_job_answer(d, good, mo); raise exception 'FAIL: a job that is not waiting was answered';
  exception when object_not_in_prerequisite_state then null; end;
  -- A job with no row has no questions.
  begin perform public.runner_job_answer('00000000-0000-4000-8000-0000022552f1', good, mo); raise exception 'FAIL: a job with no row was answered';
  exception when no_data_found then null; end;
  -- An account outside the workspace may not answer.
  begin perform public.runner_job_answer(a, good, eve); raise exception 'FAIL: an account of another workspace answered';
  exception when insufficient_privilege then null; end;
  -- Answers that do not match the questions are refused: a missing one, an extra one, none, not an object.
  begin perform public.runner_job_answer(a, '{}', mo); raise exception 'FAIL: an empty answer was taken';
  exception when invalid_parameter_value then null; end;
  begin perform public.runner_job_answer(a, '{"Which fix?":"Guard","Why?":"because"}', mo); raise exception 'FAIL: an answer to a question nobody asked was taken';
  exception when invalid_parameter_value then null; end;
  begin perform public.runner_job_answer(a, '{"Another?":"Guard"}', mo); raise exception 'FAIL: an answer to another question was taken';
  exception when invalid_parameter_value then null; end;
  begin perform public.runner_job_answer(a, '["Guard"]', mo); raise exception 'FAIL: a list of answers was taken';
  exception when invalid_parameter_value then null; end;
  if (select count(*) from public.runner_jobs where status = 'queued') <> queued
     or (select closed_at from public.runner_job_questions where job_id = a) is not null then
    raise exception 'FAIL: a refused answer queued a job or closed the row';
  end if;

  -- The first answer: the resume line, repository and target of the first job, sent by the answerer.
  resume := public.runner_job_answer(a, good, mo);
  if resume.line <> '/omni:bug-fix #314 --answers ' || a::text or resume.repo <> 'questions-check/app'
     or resume.to_runner is distinct from '00000000-0000-4000-8000-0000022551a1' or resume.to_fleet is not null
     or resume.sent_by <> mo or resume.status <> 'queued' or resume.workspace_id <> '00000000-0000-4000-8000-000002255001' then
    raise exception 'FAIL: the resume job is not the first job''s line, repository and target, sent by the answerer';
  end if;
  select * into closed from public.runner_job_questions where job_id = a;
  if closed.answers <> good or closed.closed_by <> mo or closed.closed_at is null or closed.resume_job <> resume.id then
    raise exception 'FAIL: the answers, who answered, when and the resume job were not stored';
  end if;

  -- A second answer, and a dismissal after it, are refused and change nothing.
  begin perform public.runner_job_answer(a, '{"Which fix?":"Design it first"}', olga); raise exception 'FAIL: a second answer was taken';
  exception when object_not_in_prerequisite_state then null; end;
  begin perform public.runner_job_dismiss(a, olga); raise exception 'FAIL: an answered row was dismissed';
  exception when object_not_in_prerequisite_state then null; end;
  select * into closed from public.runner_job_questions where job_id = a;
  if closed.answers <> good or closed.closed_by <> mo or closed.resume_job <> resume.id
     or (select count(*) from public.runner_jobs where status = 'queued') <> queued + 1 then
    raise exception 'FAIL: a refused second answer changed the row or queued a job';
  end if;

  -- A job sent to any runner resumes on any runner, with its own skill: C ran `/omni:mega-bug-fix`.
  resume := public.runner_job_answer('00000000-0000-4000-8000-0000022552c1', good, olga);
  if resume.line <> '/omni:mega-bug-fix #316 --answers 00000000-0000-4000-8000-0000022552c1' or resume.to_runner is not null or resume.to_fleet is not null then
    raise exception 'FAIL: the resume job of a job sent to any runner did not go to any runner';
  end if;
end $$;

-- A resume that cannot be queued stores nothing: E's line is so long that the resume line is over 240 characters.
do $$
begin
  begin
    perform public.runner_job_answer('00000000-0000-4000-8000-0000022552e1', '{"Which fix?":"Guard"}', '00000000-0000-4000-8000-0000022550b1');
    raise exception 'FAIL: a resume line over 240 characters was queued';
  exception when check_violation then null; end;
  if (select closed_at from public.runner_job_questions where job_id = '00000000-0000-4000-8000-0000022552e1') is not null
     or (select answers from public.runner_job_questions where job_id = '00000000-0000-4000-8000-0000022552e1') is not null
     or exists (select 1 from public.runner_jobs where line like '%--answers 00000000-0000-4000-8000-0000022552e1') then
    raise exception 'FAIL: a refused queue stored the answers or a job';
  end if;
end $$;

-- ── Dismissing, as the service role ──
do $$
declare
  b      constant uuid := '00000000-0000-4000-8000-0000022552b1';
  queued integer;
  closed public.runner_job_questions;
begin
  select count(*) into queued from public.runner_jobs where status = 'queued';
  begin perform public.runner_job_dismiss(b, '00000000-0000-4000-8000-0000022550e1'); raise exception 'FAIL: an account of another workspace dismissed';
  exception when insufficient_privilege then null; end;
  begin perform public.runner_job_dismiss('00000000-0000-4000-8000-0000022552d1', '00000000-0000-4000-8000-0000022550b1'); raise exception 'FAIL: a job that is not waiting was dismissed';
  exception when object_not_in_prerequisite_state then null; end;
  closed := public.runner_job_dismiss(b, '00000000-0000-4000-8000-0000022550b1');
  if closed.closed_at is null or closed.closed_by <> '00000000-0000-4000-8000-0000022550b1' or closed.answers is not null or closed.resume_job is not null then
    raise exception 'FAIL: a dismissal did not close the row with no answers and no resume job';
  end if;
  if (select count(*) from public.runner_jobs where status = 'queued') <> queued then
    raise exception 'FAIL: a dismissal queued a job';
  end if;
  -- A dismissed row is closed: it can be neither answered nor dismissed again.
  begin perform public.runner_job_answer(b, '{"Which fix?":"Guard"}', '00000000-0000-4000-8000-0000022550a1'); raise exception 'FAIL: a dismissed row was answered';
  exception when object_not_in_prerequisite_state then null; end;
  begin perform public.runner_job_dismiss(b, '00000000-0000-4000-8000-0000022550a1'); raise exception 'FAIL: a dismissed row was dismissed again';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
reset role;

-- Deleting a job deletes its questions.
delete from public.runner_jobs where id = '00000000-0000-4000-8000-0000022552d1';
do $$
begin
  if exists (select 1 from public.runner_job_questions where job_id = '00000000-0000-4000-8000-0000022552d1') then
    raise exception 'FAIL: a deleted job kept its questions';
  end if;
end $$;

rollback;

select 'runner_job_questions: every check passed' as result;
