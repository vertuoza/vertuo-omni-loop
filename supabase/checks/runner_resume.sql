-- A runner job lost by its runner queues exactly one resume (PRD 2809), run after `supabase db start` has
-- applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/runner_resume.sql
-- A job already there, or sent anew, reads attempt 1, resumes nothing and has no wait; an attempt outside 1
-- to 3, and a resume on attempt 1, are refused. As the service role: a claimed or running job of a resumable
-- skill that ends `failed` lost (runners_mark_lost(), a runner registering again, a claim never reported
-- running, the worktree or the tmux session that could not be made) queues, in the same statement, one resume
-- with its line, repository, sender (a person, the app, or a key with its maker, whom it acted for and its
-- link) and target, `resumes` the lost job, attempt one more and its wait: 1 minute after the first loss, 5
-- after the second. A second mark of the same loss queues nothing, and neither does the third loss, a cancel,
-- a job whose cancel was asked, a refusal, the skill's own failure, a timeout, a done job, a skill outside
-- the resumable ones or a repository's own skill. runner_claim() hands out no job before its resume_after,
-- and the resume once it has passed. A member reads the new columns, another workspace nothing, and nobody
-- signed in writes them. A resume whose chain's local save a runner keeps goes to that runner while it is
-- online, to any runner once it is not, and a save past its keep date holds nothing back (s5). Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Olga owns the workspace Resume, Mo is a member of it; Eve owns another one. Olga made the key pipeline.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000028090a1', 'olga@resume.test'),
  ('00000000-0000-4000-8000-0000028090b1', 'mo@resume.test'),
  ('00000000-0000-4000-8000-0000028090e1', 'eve@elsewhere.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000002809001', 'resume-check', 'Resume', 'resume-check'),
  ('00000000-0000-4000-8000-000002809002', 'resume-elsewhere', 'Elsewhere', 'resume-elsewhere');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000002809001', '00000000-0000-4000-8000-0000028090a1', 'owner'),
  ('00000000-0000-4000-8000-000002809001', '00000000-0000-4000-8000-0000028090b1', 'member'),
  ('00000000-0000-4000-8000-000002809002', '00000000-0000-4000-8000-0000028090e1', 'owner');
insert into public.teams (workspace_id, name, label, color) values
  ('00000000-0000-4000-8000-000002809001', 'cia', 'CIA', '#123456');
insert into public.agent_tokens (id, workspace_id, made_by, name, token_hash, last_four, scope, repos)
values ('00000000-0000-4000-8000-0000028093a1', '00000000-0000-4000-8000-000002809001', '00000000-0000-4000-8000-0000028090a1', 'pipeline',
        encode(sha256(convert_to('oma_resume_pipeline_0001', 'UTF8')), 'hex'), '0001', 'api', '{}');

-- Two runners with no fleet, box-1 and box-3, and box-cia of the fleet cia, all on resume-check/app.
insert into public.runners (id, workspace_id, owner, name, fleet, slots, repos, github_app) values
  ('00000000-0000-4000-8000-0000028091a1', '00000000-0000-4000-8000-000002809001', '00000000-0000-4000-8000-0000028090a1', 'box-1', null, 8, '{resume-check/app}', true),
  ('00000000-0000-4000-8000-0000028091a3', '00000000-0000-4000-8000-000002809001', '00000000-0000-4000-8000-0000028090a1', 'box-3', null, 8, '{resume-check/app}', true),
  ('00000000-0000-4000-8000-0000028091c1', '00000000-0000-4000-8000-000002809001', '00000000-0000-4000-8000-0000028090a1', 'box-cia', 'cia', 8, '{resume-check/app}', true);

-- The jobs, each claimed or running but N0 (queued, never claimed):
--   L1 /omni:yolo, Mo's, to any runner, on box-1: the chain of three losses
--   K1 /omni:do-work, the key pipeline's, for Jane D. with a link, to the fleet cia, on box-cia: lost, the worktree not made
--   A1 /omni:pr-care, the app's, to box-3, on it: lost, the tmux session not started
--   on box-cia: C1 cancelled · Q1 cancel asked, then lost · G1 refused by the App · F1 its skill failed · T1 timed out · D1 done
--   on box-1: P1 /omni:plan and R1 a repository's own skill, lost with it
insert into public.runner_jobs (id, workspace_id, line, repo, to_runner, to_fleet, sent_by, sent_by_app, sent_by_key, acting_for, notify_url, status, runner_id, claimed_at, running_at, queued_at) values
  ('00000000-0000-4000-8000-0000028092a1', '00000000-0000-4000-8000-000002809001', '/omni:yolo 2803', 'resume-check/app', null, null, '00000000-0000-4000-8000-0000028090b1', null, null, null, null, 'running', '00000000-0000-4000-8000-0000028091a1', now() - interval '9 minutes', now() - interval '8 minutes', now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-0000028092b1', '00000000-0000-4000-8000-000002809001', '/omni:do-work 2803 s1 --in-wave', 'resume-check/app', null, 'cia', '00000000-0000-4000-8000-0000028090a1', null, '00000000-0000-4000-8000-0000028093a1', 'Jane D.', 'https://hooks.resume.test/ping', 'claimed', '00000000-0000-4000-8000-0000028091c1', now() - interval '1 minute', null, now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-0000028092c1', '00000000-0000-4000-8000-000002809001', '/omni:pr-care 2803 --once', 'resume-check/app', '00000000-0000-4000-8000-0000028091a3', null, null, 'omni-app', null, null, null, 'running', '00000000-0000-4000-8000-0000028091a3', now() - interval '9 minutes', now() - interval '8 minutes', now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-0000028092d1', '00000000-0000-4000-8000-000002809001', '/omni:yolo 2804', 'resume-check/app', null, null, '00000000-0000-4000-8000-0000028090b1', null, null, null, null, 'running', '00000000-0000-4000-8000-0000028091c1', now() - interval '9 minutes', now() - interval '8 minutes', now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-0000028092d2', '00000000-0000-4000-8000-000002809001', '/omni:yolo 2805', 'resume-check/app', null, null, '00000000-0000-4000-8000-0000028090b1', null, null, null, null, 'running', '00000000-0000-4000-8000-0000028091c1', now() - interval '9 minutes', now() - interval '8 minutes', now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-0000028092d3', '00000000-0000-4000-8000-000002809001', '/omni:wave 2806', 'resume-check/app', null, null, '00000000-0000-4000-8000-0000028090b1', null, null, null, null, 'claimed', '00000000-0000-4000-8000-0000028091c1', now() - interval '9 minutes', null, now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-0000028092d4', '00000000-0000-4000-8000-000002809001', '/omni:bug-fix #12', 'resume-check/app', null, null, '00000000-0000-4000-8000-0000028090b1', null, null, null, null, 'running', '00000000-0000-4000-8000-0000028091c1', now() - interval '9 minutes', now() - interval '8 minutes', now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-0000028092d5', '00000000-0000-4000-8000-000002809001', '/omni:yolo-fix 2807', 'resume-check/app', null, null, '00000000-0000-4000-8000-0000028090b1', null, null, null, null, 'running', '00000000-0000-4000-8000-0000028091c1', now() - interval '9 minutes', now() - interval '8 minutes', now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-0000028092d6', '00000000-0000-4000-8000-000002809001', '/omni:yolo 2808', 'resume-check/app', null, null, '00000000-0000-4000-8000-0000028090b1', null, null, null, null, 'running', '00000000-0000-4000-8000-0000028091c1', now() - interval '9 minutes', now() - interval '8 minutes', now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-0000028092d7', '00000000-0000-4000-8000-000002809001', '/omni:plan 2809', 'resume-check/app', null, null, '00000000-0000-4000-8000-0000028090b1', null, null, null, null, 'running', '00000000-0000-4000-8000-0000028091a1', now() - interval '9 minutes', now() - interval '8 minutes', now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-0000028092d8', '00000000-0000-4000-8000-000002809001', '/validate-prd 2810', 'resume-check/app', null, null, '00000000-0000-4000-8000-0000028090b1', null, null, null, null, 'running', '00000000-0000-4000-8000-0000028091a1', now() - interval '9 minutes', now() - interval '8 minutes', now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-0000028092e1', '00000000-0000-4000-8000-000002809001', '/omni:yolo 2811', 'resume-check/app', null, null, '00000000-0000-4000-8000-0000028090b1', null, null, null, null, 'queued', null, null, null, now() - interval '10 minutes');

-- ── A job someone sends: attempt 1, no resume, no wait; the columns' rules ──
do $$
declare
  got public.runner_jobs;
begin
  select * into got from public.runner_jobs where id = '00000000-0000-4000-8000-0000028092e1';
  if got.attempt <> 1 or got.resumes is not null or got.resume_after is not null then
    raise exception 'FAIL: a job sent anew reads attempt %, resumes %, resume_after %, not 1 and nothing', got.attempt, got.resumes, got.resume_after;
  end if;
  begin
    update public.runner_jobs set attempt = 4 where id = '00000000-0000-4000-8000-0000028092e1';
    raise exception 'FAIL: a fourth attempt was stored';
  exception when check_violation then null; end;
  begin
    update public.runner_jobs set attempt = 0 where id = '00000000-0000-4000-8000-0000028092e1';
    raise exception 'FAIL: an attempt 0 was stored';
  exception when check_violation then null; end;
  begin
    update public.runner_jobs set resumes = '00000000-0000-4000-8000-0000028092a1' where id = '00000000-0000-4000-8000-0000028092e1';
    raise exception 'FAIL: a first attempt was stored as a resume';
  exception when check_violation then null; end;
end $$;

-- ── Nobody signed in writes the new columns; a member reads them, another workspace nothing ──
create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000028090b1');
do $$
begin
  if (select attempt from public.runner_jobs where id = '00000000-0000-4000-8000-0000028092e1') is distinct from 1::smallint then
    raise exception 'FAIL: a member did not read a job''s attempt';
  end if;
  begin
    update public.runner_jobs set resume_after = now() where id = '00000000-0000-4000-8000-0000028092e1';
    raise exception 'FAIL: a member wrote a job''s wait';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000028090e1');
do $$
begin
  if exists (select 1 from public.runner_jobs where workspace_id = '00000000-0000-4000-8000-000002809001') then
    raise exception 'FAIL: another workspace read the jobs';
  end if;
end $$;
reset role;

set local role service_role;

-- ── The first loss, through runners_mark_lost(): one resume, attempt 2, 1 minute later ──
do $$
declare
  lost   constant uuid := '00000000-0000-4000-8000-0000028092a1';
  resume public.runner_jobs;
  queued integer;
begin
  -- box-1 falls silent; box-cia and box-3 stay in time. Every job box-1 holds ends runner lost.
  update public.runners set last_seen_at = now() - interval '91 seconds' where id = '00000000-0000-4000-8000-0000028091a1';
  perform public.runners_mark_lost(now() - interval '90 seconds');
  select * into resume from public.runner_jobs where resumes = lost;
  if resume.id is null then
    raise exception 'FAIL: the lost yolo queued no resume';
  end if;
  if resume.status <> 'queued' or resume.attempt <> 2 or resume.resume_after <> now() + interval '1 minute'
     or resume.line <> '/omni:yolo 2803' or resume.repo <> 'resume-check/app' or resume.to_runner is not null or resume.to_fleet is not null
     or resume.sent_by <> '00000000-0000-4000-8000-0000028090b1' or resume.sent_by_app is not null or resume.sent_by_key is not null
     or resume.runner_id is not null or resume.continues is not null then
    raise exception 'FAIL: the first resume is %/attempt %/after %/% to %,% by %: not the queued attempt 2, a minute on, of the same line, target and sender',
      resume.status, resume.attempt, resume.resume_after - now(), resume.line, resume.to_runner, resume.to_fleet, resume.sent_by;
  end if;

  -- A second mark of the same loss queues nothing: the job has ended…
  perform public.runners_mark_lost(now() - interval '90 seconds');
  -- …and even marked lost again from running, its resume stays the one (runner_jobs.resumes is unique).
  update public.runner_jobs set status = 'running', ended_at = null, reason = null where id = lost;
  update public.runner_jobs set status = 'failed', reason = 'runner lost', ended_at = now() where id = lost;
  select count(*) into queued from public.runner_jobs where resumes = lost;
  if queued <> 1 then
    raise exception 'FAIL: marking the same loss again left % resumes, not one', queued;
  end if;
end $$;

-- ── Not before its wait: no runner claims the resume until resume_after ──
do $$
declare
  resume uuid := (select id from public.runner_jobs where resumes = '00000000-0000-4000-8000-0000028092a1');
  got    public.runner_jobs;
begin
  -- The job sent anew, N0, is the only other job queued to any runner: box-3 takes it, and nothing else.
  update public.runner_jobs set queued_at = now() - interval '10 minutes' where id = resume;
  select * into got from public.runner_claim('00000000-0000-4000-8000-0000028091a3');
  if got.id is distinct from '00000000-0000-4000-8000-0000028092e1' then
    raise exception 'FAIL: box-3 claimed %, not the job sent anew: a resume was handed out before its wait', got.id;
  end if;
  if exists (select 1 from public.runner_claim('00000000-0000-4000-8000-0000028091a3')) then
    raise exception 'FAIL: a runner claimed a resume before its resume_after';
  end if;
  -- Its wait over, box-3 takes it.
  update public.runner_jobs set resume_after = now() - interval '1 second' where id = resume;
  select * into got from public.runner_claim('00000000-0000-4000-8000-0000028091a3');
  if got.id is distinct from resume or got.status <> 'claimed' or got.attempt <> 2 then
    raise exception 'FAIL: box-3 claimed %, not the resume once its wait was over', got.id;
  end if;
end $$;

-- ── The second loss, a runner registering again: attempt 3, 5 minutes later ──
do $$
declare
  second uuid := (select id from public.runner_jobs where resumes = '00000000-0000-4000-8000-0000028092a1');
  third  public.runner_jobs;
begin
  -- As the register route ends a restarted runner's jobs: a plain update, from running.
  update public.runner_jobs set status = 'running', running_at = now() where id = second;
  update public.runner_jobs set status = 'failed', reason = 'runner lost', ended_at = now() where id = second and status in ('claimed', 'running');
  select * into third from public.runner_jobs where resumes = second;
  if third.id is null or third.attempt <> 3 or third.resume_after <> now() + interval '5 minutes' or third.line <> '/omni:yolo 2803'
     or third.sent_by <> '00000000-0000-4000-8000-0000028090b1' then
    raise exception 'FAIL: the second loss queued %, attempt %, % on: not attempt 3 five minutes on', third.id, third.attempt, third.resume_after - now();
  end if;

  -- ── The third loss, a claim never reported running: nothing more ──
  update public.runner_jobs set resume_after = now() - interval '1 second' where id = third.id;
  if (select id from public.runner_claim('00000000-0000-4000-8000-0000028091a3')) is distinct from third.id then
    raise exception 'FAIL: box-3 did not claim the third attempt once its wait was over';
  end if;
  update public.runner_jobs set status = 'failed', reason = 'runner lost', ended_at = now() where status = 'claimed' and id = third.id;
  if exists (select 1 from public.runner_jobs where resumes = third.id) then
    raise exception 'FAIL: the third loss of a chain queued a fourth attempt';
  end if;
  if (select count(*) from public.runner_jobs where line = '/omni:yolo 2803') <> 3 then
    raise exception 'FAIL: the chain holds % jobs, not its three attempts', (select count(*) from public.runner_jobs where line = '/omni:yolo 2803');
  end if;
end $$;

-- ── A key's job and the app's: the same sender, the same target ──
do $$
declare
  key_resume public.runner_jobs;
  app_resume public.runner_jobs;
begin
  -- box-cia reports the worktree could not be made, and box-3 that the tmux session could not be started.
  update public.runner_jobs set status = 'failed', reason = 'the worktree could not be made', ended_at = now() where id = '00000000-0000-4000-8000-0000028092b1';
  select * into key_resume from public.runner_jobs where resumes = '00000000-0000-4000-8000-0000028092b1';
  if key_resume.id is null or key_resume.attempt <> 2 or key_resume.to_fleet is distinct from 'cia' or key_resume.to_runner is not null
     or key_resume.sent_by is distinct from '00000000-0000-4000-8000-0000028090a1' or key_resume.sent_by_key is distinct from '00000000-0000-4000-8000-0000028093a1'
     or key_resume.acting_for is distinct from 'Jane D.' or key_resume.notify_url is distinct from 'https://hooks.resume.test/ping'
     or key_resume.line <> '/omni:do-work 2803 s1 --in-wave' then
    raise exception 'FAIL: the key''s resume is to %/% by %, key %, for %, ping %: not the key and its maker, for Jane D., to the fleet cia (BR-PRODUCT-125)',
      key_resume.to_runner, key_resume.to_fleet, key_resume.sent_by, key_resume.sent_by_key, key_resume.acting_for, key_resume.notify_url;
  end if;

  update public.runner_jobs set status = 'failed', reason = 'the tmux session could not be started', ended_at = now() where id = '00000000-0000-4000-8000-0000028092c1';
  select * into app_resume from public.runner_jobs where resumes = '00000000-0000-4000-8000-0000028092c1';
  if app_resume.id is null or app_resume.sent_by is not null or app_resume.sent_by_app is distinct from 'omni-app'
     or app_resume.to_runner is distinct from '00000000-0000-4000-8000-0000028091a3' or app_resume.attempt <> 2 then
    raise exception 'FAIL: the app''s resume is by %/%, to %: not the app, to box-3', app_resume.sent_by, app_resume.sent_by_app, app_resume.to_runner;
  end if;
end $$;

-- ── Never resumed ──
do $$
declare
  bad record;
begin
  -- C1 is cancelled; Q1's cancel was asked, then its runner went silent; G1 the App refused; F1's skill exited 1; T1 timed out;
  -- D1 ended done; P1 (/omni:plan) and R1 (a repository's own skill) were lost, though no resumable skill runs them.
  update public.runner_jobs set status = 'cancelled', ended_at = now() where id = '00000000-0000-4000-8000-0000028092d1';
  update public.runner_jobs set cancel_requested = true where id = '00000000-0000-4000-8000-0000028092d2';
  update public.runner_jobs set status = 'failed', reason = 'runner lost', ended_at = now() where id = '00000000-0000-4000-8000-0000028092d2';
  update public.runner_jobs set status = 'failed', reason = 'github app: the Omni app is not installed on resume-check/app', ended_at = now() where id = '00000000-0000-4000-8000-0000028092d3';
  update public.runner_jobs set status = 'failed', reason = 'the skill exited 1', exit_code = 1, ended_at = now() where id = '00000000-0000-4000-8000-0000028092d4';
  update public.runner_jobs set status = 'failed', reason = 'timeout', ended_at = now() where id = '00000000-0000-4000-8000-0000028092d5';
  update public.runner_jobs set status = 'done', exit_code = 0, ended_at = now() where id = '00000000-0000-4000-8000-0000028092d6';
  for bad in
    select j.line, j.reason from public.runner_jobs j
     where j.id in ('00000000-0000-4000-8000-0000028092d1', '00000000-0000-4000-8000-0000028092d2', '00000000-0000-4000-8000-0000028092d3',
                    '00000000-0000-4000-8000-0000028092d4', '00000000-0000-4000-8000-0000028092d5', '00000000-0000-4000-8000-0000028092d6',
                    '00000000-0000-4000-8000-0000028092d7', '00000000-0000-4000-8000-0000028092d8')
       and exists (select 1 from public.runner_jobs r where r.resumes = j.id)
  loop
    raise exception 'FAIL: % that ended %, not lost by a resumable skill, queued a resume', bad.line, coalesce(bad.reason, 'with no reason');
  end loop;
  -- P1 and R1 ended lost with box-1, and are still failed runner lost.
  if (select count(*) from public.runner_jobs where id in ('00000000-0000-4000-8000-0000028092d7', '00000000-0000-4000-8000-0000028092d8') and status = 'failed' and reason = 'runner lost') <> 2 then
    raise exception 'FAIL: the plan and the repository''s own skill were not lost with box-1';
  end if;
end $$;

reset role;

-- ── A chain's local save: its resume goes to the runner that keeps it, while it is online (PRD 2809, s5) ──
-- W1 /omni:wave 2812 and E1 /omni:wave 2813, Mo's, to any runner, run on box-1 and are lost. Box-1 kept W1's save on its
-- disk (local, not deleted, kept 7 days); E1's local save is past its keep date. Each resume is queued first.
insert into public.runner_jobs (id, workspace_id, line, repo, sent_by, status, runner_id, claimed_at, running_at, queued_at) values
  ('00000000-0000-4000-8000-0000028092f1', '00000000-0000-4000-8000-000002809001', '/omni:wave 2812', 'resume-check/app', '00000000-0000-4000-8000-0000028090b1', 'running', '00000000-0000-4000-8000-0000028091a1', now() - interval '9 minutes', now() - interval '8 minutes', now() - interval '3 hours'),
  ('00000000-0000-4000-8000-0000028092f5', '00000000-0000-4000-8000-000002809001', '/omni:wave 2813', 'resume-check/app', '00000000-0000-4000-8000-0000028090b1', 'running', '00000000-0000-4000-8000-0000028091a1', now() - interval '9 minutes', now() - interval '8 minutes', now() - interval '3 hours');
insert into public.runner_checkpoints (job_id, workspace_id, runner_id, kind, manifest, bytes, keep_until) values
  ('00000000-0000-4000-8000-0000028092f1', '00000000-0000-4000-8000-000002809001', '00000000-0000-4000-8000-0000028091a1', 'local',
   '{"job": "00000000-0000-4000-8000-0000028092f1", "kind": "local"}', 4096, now() + interval '7 days'),
  ('00000000-0000-4000-8000-0000028092f5', '00000000-0000-4000-8000-000002809001', '00000000-0000-4000-8000-0000028091a1', 'local',
   '{"job": "00000000-0000-4000-8000-0000028092f5", "kind": "local"}', 4096, now() - interval '1 second');

set local role service_role;

do $$
declare
  w1     constant uuid := '00000000-0000-4000-8000-0000028092f1';
  box1   constant uuid := '00000000-0000-4000-8000-0000028091a1';
  box3   constant uuid := '00000000-0000-4000-8000-0000028091a3';
  w2     uuid;
  w3     uuid;
  got    uuid;
begin
  update public.runner_jobs set status = 'failed', reason = 'runner lost', ended_at = now() where id = w1;
  w2 := (select id from public.runner_jobs where resumes = w1);
  update public.runner_jobs set resume_after = now() - interval '1 second', queued_at = now() - interval '2 hours' where id = w2;

  -- Box-1 is back online: box-3 claims whatever else waits for it, never W2.
  update public.runners set last_seen_at = now() where id = box1;
  for i in 1..3 loop
    got := (select id from public.runner_claim(box3));
    if got = w2 then
      raise exception 'FAIL: box-3 claimed the resume of a chain whose local save box-1 keeps, while box-1 is online';
    end if;
  end loop;
  -- Box-1 claims it: the save is on its disk.
  got := (select id from public.runner_claim(box1));
  if got is distinct from w2 then
    raise exception 'FAIL: box-1, which keeps the chain''s local save, claimed %, not the resume', got;
  end if;

  -- W2 is lost too: W3's chain still holds W1's save on box-1, now silent. Any runner takes W3, box-3 here.
  update public.runner_jobs set status = 'running', running_at = now() where id = w2;
  update public.runner_jobs set status = 'failed', reason = 'runner lost', ended_at = now() where id = w2;
  w3 := (select id from public.runner_jobs where resumes = w2);
  update public.runner_jobs set resume_after = now() - interval '1 second', queued_at = now() - interval '2 hours' where id = w3;
  update public.runners set last_seen_at = now() - interval '91 seconds' where id = box1;
  got := (select id from public.runner_claim(box3));
  if got is distinct from w3 then
    raise exception 'FAIL: box-3 claimed %, not the resume whose save keeper, box-1, is offline', got;
  end if;
end $$;

do $$
declare
  e1   constant uuid := '00000000-0000-4000-8000-0000028092f5';
  e2   uuid;
  got  uuid;
begin
  -- A local save past its keep date holds nothing back: box-1 online, box-3 takes E2.
  update public.runners set last_seen_at = now() where id = '00000000-0000-4000-8000-0000028091a1';
  update public.runner_jobs set status = 'failed', reason = 'runner lost', ended_at = now() where id = e1;
  e2 := (select id from public.runner_jobs where resumes = e1);
  update public.runner_jobs set resume_after = now() - interval '1 second', queued_at = now() - interval '2 hours' where id = e2;
  got := (select id from public.runner_claim('00000000-0000-4000-8000-0000028091a3'));
  if got is distinct from e2 then
    raise exception 'FAIL: box-3 claimed %, not the resume whose only local save is past its keep date', got;
  end if;
end $$;

reset role;

rollback;

select 'runner_resume: every check passed' as result;
