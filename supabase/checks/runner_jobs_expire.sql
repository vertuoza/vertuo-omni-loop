-- Jobs expire after 48 h doing nothing (PRD omni-loop-35 s1), run after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/runner_jobs_expire.sql
-- As the service role, runner_jobs_expire(now()): a queued job that no runner took 48 h since it could first run, in no
-- mission, ends failed with `Expired: no runner took it in 48 h` and queues no resume (AC-1); a job queued 60 h ago whose
-- resume waited until 20 h ago stays queued (AC-2); a job ended Held 49 h ago that no job continues keeps status done and
-- takes the outcome expired with `Expired: nobody continued it in 48 h` (AC-3, the store half); a job ended Need human 49 h
-- ago keeps no open round, closed with no answer and nobody named, and reads expired (AC-4); a mission's job, a queued job
-- whose cancel was asked and a held job another job continues are unchanged, and so are a job queued or held under 48 h,
-- a done job of another outcome and an answered round (AC-5). The open per-job findings `stuck:queue:<job>` and
-- `stuck:waiting:<job>` close as resolved with one `Grouped now` line in their thread; the group forms and other checks'
-- findings stay open. The function answers its counts; run a second time it changes nothing and answers zeros. A failed
-- job never claimed may hold no runner, one claimed may not. A null time is refused; nobody but the service role calls
-- either function.
-- Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Olga owns the workspace Expire; the fleet cia runs its mission; box-1 holds expire-check/app.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000035000a1', 'olga@expire.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000003500001', 'expire-check', 'Expire', 'expire-check');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000003500001', '00000000-0000-4000-8000-0000035000a1', 'owner');
insert into public.teams (workspace_id, name, label, color) values
  ('00000000-0000-4000-8000-000003500001', 'cia', 'CIA', '#123456');
insert into public.missions (id, workspace_id, repo, fleet, number, title, goal, scope, status) values
  ('00000000-0000-4000-8000-0000035000d1', '00000000-0000-4000-8000-000003500001', 'expire-check/plan', 'cia', 3500,
   'Expire', 'The fleet takes the PRD.', '{"prds": [3500], "roadmaps": []}', 'running');
insert into public.runners (id, workspace_id, owner, name, repos) values
  ('00000000-0000-4000-8000-0000035001a1', '00000000-0000-4000-8000-000003500001', '00000000-0000-4000-8000-0000035000a1', 'box-1', '{expire-check/app}');

-- The jobs:
--   Q1 queued 49 h ago                       → failed, expired (AC-1)
--   Q2 queued 60 h ago, resume until 20 h ago → queued (AC-2)
--   Q3 queued 49 h ago, a mission's          → queued (AC-5)
--   Q4 queued 49 h ago, cancel asked         → queued (AC-5)
--   Q5 queued 10 h ago                       → queued
--   Q6 queued 47 h ago                       → queued
--   H1 held 49 h ago, not continued          → done, expired (AC-3)
--   H2 held 49 h ago, continued by C1        → held (AC-5)
--   H3 held 10 h ago                         → held
--   H4 held 49 h ago, a mission's            → held
--   H5 held 47 h ago                         → held
--   N1 human 49 h ago, one round open        → done, expired, the round closed (AC-4)
--   N2 human 49 h ago, its round answered, continued by C2 → human, the answer kept
--   N3 human 49 h ago, its round answered, its continuation gone → done, expired, the answer kept
--   A1 answers 49 h ago, not continued       → done, expired
--   R1 ready 49 h ago                        → ready
insert into public.runner_jobs (id, workspace_id, line, repo, sent_by, status, runner_id, claimed_at, running_at, ended_at, queued_at, resume_after, outcome, mission_id, cancel_requested, continues)
select v.id::uuid, '00000000-0000-4000-8000-000003500001', v.line, 'expire-check/app', '00000000-0000-4000-8000-0000035000a1', v.status,
       case when v.status = 'queued' then null else '00000000-0000-4000-8000-0000035001a1'::uuid end,
       case when v.status = 'queued' then null else now() - v.ended - interval '1 hour' end,
       case when v.status = 'queued' then null else now() - v.ended - interval '50 minutes' end,
       case when v.status = 'queued' then null else now() - v.ended end,
       now() - v.queued, now() - v.resume, v.outcome, v.mission::uuid, v.cancel, v.continues::uuid
  from (values
    ('00000000-0000-4000-8000-0000035002a1', '/omni:yolo 3501',     'queued', interval '0',        interval '49 hours', null::interval,     null,      null,                                   false, null),
    ('00000000-0000-4000-8000-0000035002a2', '/omni:yolo 3502',     'queued', interval '0',        interval '60 hours', interval '20 hours', null,      null,                                   false, null),
    ('00000000-0000-4000-8000-0000035002a3', '/omni:yolo 3503',     'queued', interval '0',        interval '49 hours', null,               null,      '00000000-0000-4000-8000-0000035000d1', false, null),
    ('00000000-0000-4000-8000-0000035002a4', '/omni:yolo 3504',     'queued', interval '0',        interval '49 hours', null,               null,      null,                                   true,  null),
    ('00000000-0000-4000-8000-0000035002a5', '/omni:yolo 3505',     'queued', interval '0',        interval '10 hours', null,               null,      null,                                   false, null),
    ('00000000-0000-4000-8000-0000035002a6', '/omni:yolo 3506',     'queued', interval '0',        interval '47 hours', null,               null,      null,                                   false, null),
    ('00000000-0000-4000-8000-0000035002b1', '/omni:yolo 3511',     'done',   interval '49 hours', interval '52 hours', null,               'held',    null,                                   false, null),
    ('00000000-0000-4000-8000-0000035002b2', '/omni:yolo 3512',     'done',   interval '49 hours', interval '52 hours', null,               'held',    null,                                   false, null),
    ('00000000-0000-4000-8000-0000035002b3', '/omni:yolo 3513',     'done',   interval '10 hours', interval '12 hours', null,               'held',    null,                                   false, null),
    ('00000000-0000-4000-8000-0000035002b4', '/omni:yolo 3514',     'done',   interval '49 hours', interval '52 hours', null,               'held',    '00000000-0000-4000-8000-0000035000d1', false, null),
    ('00000000-0000-4000-8000-0000035002b5', '/omni:yolo 3515',     'done',   interval '47 hours', interval '50 hours', null,               'held',    null,                                   false, null),
    ('00000000-0000-4000-8000-0000035002c1', '/omni:bug-fix #3521', 'done',   interval '49 hours', interval '52 hours', null,               'human',   null,                                   false, null),
    ('00000000-0000-4000-8000-0000035002c2', '/omni:bug-fix #3522', 'done',   interval '49 hours', interval '52 hours', null,               'human',   null,                                   false, null),
    ('00000000-0000-4000-8000-0000035002c3', '/omni:bug-fix #3523', 'done',   interval '49 hours', interval '52 hours', null,               'human',   null,                                   false, null),
    ('00000000-0000-4000-8000-0000035002d1', '/omni:yolo-fix 3531', 'done',   interval '49 hours', interval '52 hours', null,               'answers', null,                                   false, null),
    ('00000000-0000-4000-8000-0000035002e1', '/omni:pr-care 3541',  'done',   interval '49 hours', interval '52 hours', null,               'ready',   null,                                   false, null)
  ) as v (id, line, status, ended, queued, resume, outcome, mission, cancel, continues);

-- C1 continues H2, C2 continues N2 (both still running).
insert into public.runner_jobs (id, workspace_id, line, repo, sent_by, status, runner_id, claimed_at, running_at, queued_at, continues) values
  ('00000000-0000-4000-8000-0000035002f1', '00000000-0000-4000-8000-000003500001', '/omni:yolo-fix 3512', 'expire-check/app', '00000000-0000-4000-8000-0000035000a1',
   'running', '00000000-0000-4000-8000-0000035001a1', now() - interval '1 hour', now() - interval '1 hour', now() - interval '2 hours', '00000000-0000-4000-8000-0000035002b2'),
  ('00000000-0000-4000-8000-0000035002f2', '00000000-0000-4000-8000-000003500001', '/omni:bug-fix #3522 --answers 00000000-0000-4000-8000-0000035002c2', 'expire-check/app', '00000000-0000-4000-8000-0000035000a1',
   'running', '00000000-0000-4000-8000-0000035001a1', now() - interval '1 hour', now() - interval '1 hour', now() - interval '2 hours', '00000000-0000-4000-8000-0000035002c2');

-- N1's round is open; N2's and N3's were answered by Olga (N3's resume job since deleted).
insert into public.runner_job_questions (job_id, workspace_id, issue, lead, questions, answers, closed_by, closed_at, resume_job, asked_at)
select v.job::uuid, '00000000-0000-4000-8000-000003500001', v.issue, 'Two fixes are possible.',
       '[{"question":"Which fix?","header":"Fix","options":[{"label":"Guard","description":"Check the input"},{"label":"Design it first","description":"Stop here"}],"multiSelect":false}]'::jsonb,
       v.answers::jsonb, v.closed_by::uuid, v.closed_at, v.resume_job::uuid, now() - interval '49 hours'
  from (values
    ('00000000-0000-4000-8000-0000035002c1', 3521, null, null, null::timestamptz, null),
    ('00000000-0000-4000-8000-0000035002c2', 3522, '{"Which fix?":"Guard"}', '00000000-0000-4000-8000-0000035000a1', now() - interval '3 hours', '00000000-0000-4000-8000-0000035002f2'),
    ('00000000-0000-4000-8000-0000035002c3', 3523, '{"Which fix?":"Guard"}', '00000000-0000-4000-8000-0000035000a1', now() - interval '3 hours', null)
  ) as v (job, issue, answers, closed_by, closed_at, resume_job);

-- The findings: two per-job ones (F1 on Q1's queue, F2 on H1's wait), two of the group forms, one of another check.
insert into public.supervisor_findings (id, workspace_id, fingerprint, kind, severity, title, check_line, evidence_key, raised_by) values
  ('00000000-0000-4000-8000-0000035003f1', '00000000-0000-4000-8000-000003500001', 'stuck:queue:00000000-0000-4000-8000-0000035002a1', 'stuck', 'medium', 'A job nobody takes', 'Queue nobody can take: 49 h', 'k1', 'check'),
  ('00000000-0000-4000-8000-0000035003f2', '00000000-0000-4000-8000-000003500001', 'stuck:waiting:00000000-0000-4000-8000-0000035002b1', 'stuck', 'medium', 'A job held', 'Waiting too long: 49 h', 'k2', 'check'),
  ('00000000-0000-4000-8000-0000035003f3', '00000000-0000-4000-8000-000003500001', 'stuck:queue-repo:expire-check/app', 'stuck', 'medium', 'Jobs nobody takes', 'Queue nobody can take: 2 jobs', 'k3', 'check'),
  ('00000000-0000-4000-8000-0000035003f4', '00000000-0000-4000-8000-000003500001', 'stuck:waiting:held', 'stuck', 'medium', 'Jobs held', 'Waiting too long: 2 jobs', 'k4', 'check'),
  ('00000000-0000-4000-8000-0000035003f5', '00000000-0000-4000-8000-000003500001', 'stuck:silent:00000000-0000-4000-8000-0000035002f1', 'stuck', 'high', 'A silent job', 'Silent job: no line for 52 min', 'k5', 'check');

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ── The shape: a failed job never claimed may hold no runner, one claimed may not ──
do $$
begin
  begin
    update public.runner_jobs set status = 'failed', ended_at = now(), claimed_at = now()
     where id = '00000000-0000-4000-8000-0000035002a5';
    raise exception 'FAIL: a failed job that a runner claimed was stored with no runner';
  exception when check_violation then null; end;
  begin
    update public.runner_jobs set outcome = 'expiring' where id = '00000000-0000-4000-8000-0000035002e1';
    raise exception 'FAIL: an outcome outside the list was stored';
  exception when check_violation then null; end;
end $$;

-- ── Nobody but the service role calls the functions ──
do $$
begin
  if has_function_privilege('anon', 'public.runner_jobs_expire(timestamptz)', 'execute')
     or has_function_privilege('authenticated', 'public.runner_jobs_expire(timestamptz)', 'execute')
     or has_function_privilege('anon', 'public.supervisor_findings_group_per_job(timestamptz)', 'execute')
     or has_function_privilege('authenticated', 'public.supervisor_findings_group_per_job(timestamptz)', 'execute') then
    raise exception 'FAIL: anon or a signed-in person may call the sweep';
  end if;
  if not has_function_privilege('service_role', 'public.runner_jobs_expire(timestamptz)', 'execute') then
    raise exception 'FAIL: the service role may not call the sweep';
  end if;
end $$;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000035000a1');
do $$
begin
  perform public.runner_jobs_expire(now());
  raise exception 'FAIL: the workspace''s owner ran the sweep';
exception when insufficient_privilege then null;
end $$;
reset role;

-- ── The sweep, as the service role ──
set local role service_role;
do $$
begin
  perform public.runner_jobs_expire(null);
  raise exception 'FAIL: a sweep with no time ran';
exception when invalid_parameter_value then null;
end $$;

do $$
declare
  got jsonb := public.runner_jobs_expire(now());
  j   public.runner_jobs;
  q   public.runner_job_questions;
begin
  if got is distinct from '{"failed": 1, "expired": 4, "questions": 1, "grouped": 2}'::jsonb then
    raise exception 'FAIL: the sweep answered %, not 1 failed, 4 expired, 1 round and 2 findings', got;
  end if;

  -- AC-1
  select * into j from public.runner_jobs where id = '00000000-0000-4000-8000-0000035002a1';
  if j.status <> 'failed' or j.reason is distinct from 'Expired: no runner took it in 48 h' or j.ended_at is null
     or j.runner_id is not null or j.outcome is not null then
    raise exception 'FAIL: Q1, queued 49 h ago, reads % %, not failed with its reason', j.status, j.reason;
  end if;
  if exists (select 1 from public.runner_jobs r where r.resumes = '00000000-0000-4000-8000-0000035002a1') then
    raise exception 'FAIL: a resume was queued for the expired Q1';
  end if;
  if (select count(*) from public.runner_jobs where workspace_id = '00000000-0000-4000-8000-000003500001') <> 18 then
    raise exception 'FAIL: the sweep queued a job';
  end if;

  -- AC-2, AC-5 and the queued jobs under 48 h
  if exists (select 1 from public.runner_jobs
              where id in ('00000000-0000-4000-8000-0000035002a2', '00000000-0000-4000-8000-0000035002a3',
                           '00000000-0000-4000-8000-0000035002a4', '00000000-0000-4000-8000-0000035002a5',
                           '00000000-0000-4000-8000-0000035002a6')
                and (status <> 'queued' or reason is not null or ended_at is not null)) then
    raise exception 'FAIL: a queued job the sweep must leave (a resume waited until 20 h ago, a mission''s, a cancel asked, 10 h or 47 h old) changed';
  end if;

  -- AC-3, A1 waiting on answers, and N3 whose continuation is gone
  for j in select * from public.runner_jobs
            where id in ('00000000-0000-4000-8000-0000035002b1', '00000000-0000-4000-8000-0000035002d1', '00000000-0000-4000-8000-0000035002c3') loop
    if j.status <> 'done' or j.outcome is distinct from 'expired' or j.reason is distinct from 'Expired: nobody continued it in 48 h' then
      raise exception 'FAIL: %, ended 49 h ago and not continued, reads % % %, not done, expired, with its reason', j.line, j.status, j.outcome, j.reason;
    end if;
  end loop;

  -- AC-4
  select * into j from public.runner_jobs where id = '00000000-0000-4000-8000-0000035002c1';
  if j.status <> 'done' or j.outcome is distinct from 'expired' then
    raise exception 'FAIL: N1, Need human 49 h ago, reads % %, not done, expired', j.status, j.outcome;
  end if;
  select * into q from public.runner_job_questions where job_id = '00000000-0000-4000-8000-0000035002c1';
  if q.closed_at is null or q.answers is not null or q.closed_by is not null or q.closed_by_key is not null
     or q.closed_for is not null or q.resume_job is not null then
    raise exception 'FAIL: N1''s round reads closed_at %, answers %, closed_by %: not closed as expired', q.closed_at, q.answers, q.closed_by;
  end if;

  -- AC-5: the continued held job, the mission's held job, the one under 48 h, the answered round and another outcome
  if exists (select 1 from public.runner_jobs
              where id in ('00000000-0000-4000-8000-0000035002b2', '00000000-0000-4000-8000-0000035002b3', '00000000-0000-4000-8000-0000035002b4',
                           '00000000-0000-4000-8000-0000035002b5')
                and (outcome is distinct from 'held' or reason is not null)) then
    raise exception 'FAIL: a held job the sweep must leave (continued, 10 h or 47 h old, a mission''s) changed';
  end if;
  if (select outcome from public.runner_jobs where id = '00000000-0000-4000-8000-0000035002c2') is distinct from 'human'
     or (select outcome from public.runner_jobs where id = '00000000-0000-4000-8000-0000035002e1') is distinct from 'ready' then
    raise exception 'FAIL: a continued Need human job or a Ready job changed';
  end if;
  for q in select * from public.runner_job_questions
            where job_id in ('00000000-0000-4000-8000-0000035002c2', '00000000-0000-4000-8000-0000035002c3') loop
  if q.answers is distinct from '{"Which fix?":"Guard"}'::jsonb or q.closed_by is distinct from '00000000-0000-4000-8000-0000035000a1'
     or q.closed_at > now() - interval '2 hours' then
    raise exception 'FAIL: an answered round changed (BR-PRODUCT-12)';
  end if;
  end loop;
  if exists (select 1 from public.runner_jobs
              where id in ('00000000-0000-4000-8000-0000035002f1', '00000000-0000-4000-8000-0000035002f2') and status <> 'running') then
    raise exception 'FAIL: a running continuation changed';
  end if;

  -- The per-job findings close, grouped; the others stay open.
  if (select count(*) from public.supervisor_findings
       where id in ('00000000-0000-4000-8000-0000035003f1', '00000000-0000-4000-8000-0000035003f2')
         and state = 'resolved' and closed_at is not null) <> 2 then
    raise exception 'FAIL: the per-job findings stuck:queue:<job> and stuck:waiting:<job> did not close as resolved';
  end if;
  if (select count(*) from public.supervisor_findings
       where id in ('00000000-0000-4000-8000-0000035003f3', '00000000-0000-4000-8000-0000035003f4', '00000000-0000-4000-8000-0000035003f5')
         and state = 'open') <> 3 then
    raise exception 'FAIL: a group finding (stuck:queue-repo:, stuck:waiting:held) or another check''s finding closed';
  end if;
  if (select body from public.supervisor_messages where finding_id = '00000000-0000-4000-8000-0000035003f1')
       is distinct from 'Grouped now: see the finding for expire-check/app, one for the jobs queued there.'
     or (select body from public.supervisor_messages where finding_id = '00000000-0000-4000-8000-0000035003f2') not like 'Grouped now: %'
     or exists (select 1 from public.supervisor_messages m
                 where m.finding_id in ('00000000-0000-4000-8000-0000035003f1', '00000000-0000-4000-8000-0000035003f2')
                   and (m.kind <> 'supervisor' or m.author_id is not null or m.workspace_id <> '00000000-0000-4000-8000-000003500001')) then
    raise exception 'FAIL: a grouped finding''s thread does not say Grouped now, signed by no person, in its own workspace';
  end if;
  if exists (select 1 from public.supervisor_messages
              where finding_id in ('00000000-0000-4000-8000-0000035003f3', '00000000-0000-4000-8000-0000035003f4', '00000000-0000-4000-8000-0000035003f5')) then
    raise exception 'FAIL: a finding left open got a Grouped now line';
  end if;
end $$;

-- ── Safe twice: a second sweep changes nothing ──
do $$
declare
  before jsonb := (select jsonb_agg(to_jsonb(j) order by j.id) from public.runner_jobs j where j.workspace_id = '00000000-0000-4000-8000-000003500001');
  rounds jsonb := (select jsonb_agg(to_jsonb(q) order by q.job_id) from public.runner_job_questions q where q.workspace_id = '00000000-0000-4000-8000-000003500001');
  got    jsonb := public.runner_jobs_expire(now());
begin
  if got is distinct from '{"failed": 0, "expired": 0, "questions": 0, "grouped": 0}'::jsonb then
    raise exception 'FAIL: a second sweep answered %, not zeros', got;
  end if;
  if before is distinct from (select jsonb_agg(to_jsonb(j) order by j.id) from public.runner_jobs j where j.workspace_id = '00000000-0000-4000-8000-000003500001')
     or rounds is distinct from (select jsonb_agg(to_jsonb(q) order by q.job_id) from public.runner_job_questions q where q.workspace_id = '00000000-0000-4000-8000-000003500001') then
    raise exception 'FAIL: a second sweep changed a job or a round';
  end if;
  if (select count(*) from public.supervisor_messages where workspace_id = '00000000-0000-4000-8000-000003500001') <> 2 then
    raise exception 'FAIL: a second sweep wrote another Grouped now line';
  end if;
end $$;

reset role;

rollback;

select 'runner_jobs_expire: every check passed' as result;
